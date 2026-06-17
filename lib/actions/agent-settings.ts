'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database } from '@/lib/types/database';
import {
  DEFAULT_TOOLS,
  ensureAgentSettings,
  buildAgentPrompt,
} from '@/lib/agent-prompt-builder';

type AgentSettingsUpdate =
  Database['public']['Tables']['agent_settings']['Update'];

// ============================================================
// DEFAULTS DE RESET
// ============================================================

const RESET_DEFAULTS: AgentSettingsUpdate = {
  is_enabled: false,
  auto_respond: true,
  agent_name: 'Asistente',
  agent_personality: null,
  language_register: 'español neutro',
  enable_contextual_intelligence: true,
  hard_limits: null,
  org_description: null,
  org_services_summary: null,
  org_process_summary: null,
  human_contact_info: null,
  changes_policy: null,
  complaints_policy: null,
  escalation_triggers: null,
  upsell_policy: null,
  collections_policy: null,
  tools_enabled: DEFAULT_TOOLS as never,
  context_message_history_limit: 20,
};

// ============================================================
// SCHEMAS — uno por capa
// ============================================================

const identitySchema = z.object({
  agent_name: z.string().min(1).max(100).optional(),
  agent_personality: z.string().max(2000).optional().nullable(),
  language_register: z.string().max(200).optional().nullable(),
  enable_contextual_intelligence: z.boolean().optional(),
});

const knowledgeSchema = z.object({
  org_description: z.string().max(5000).optional().nullable(),
  org_services_summary: z.string().max(5000).optional().nullable(),
  org_process_summary: z.string().max(5000).optional().nullable(),
  human_contact_info: z.string().max(1000).optional().nullable(),
});

const policiesSchema = z.object({
  hard_limits: z.string().max(5000).optional().nullable(),
  changes_policy: z.string().max(3000).optional().nullable(),
  complaints_policy: z.string().max(3000).optional().nullable(),
  escalation_triggers: z.string().max(3000).optional().nullable(),
  upsell_policy: z.string().max(3000).optional().nullable(),
  collections_policy: z.string().max(3000).optional().nullable(),
});

const toolsSchema = z.object({
  tools_enabled: z
    .object({
      view_strategy: z.boolean(),
      view_schedule: z.boolean(),
      view_work_orders: z.boolean(),
      view_invoices: z.boolean(),
      view_subscription: z.boolean(),
    })
    .optional(),
  context_message_history_limit: z.number().int().min(1).max(100).optional(),
});

const activationSchema = z.object({
  is_enabled: z.boolean().optional(),
  auto_respond: z.boolean().optional(),
});

const LAYER_SCHEMAS = {
  identity: identitySchema,
  knowledge: knowledgeSchema,
  policies: policiesSchema,
  tools: toolsSchema,
  activation: activationSchema,
} as const;

type AgentLayer = keyof typeof LAYER_SCHEMAS;

// ============================================================
// HELPERS DE CONTEXTO
// ============================================================

async function getContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' as const };

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    const { getImpersonatedOrganizationId } = await import(
      '@/lib/actions/impersonation'
    );
    const impersonatingOrgId = await getImpersonatedOrganizationId();
    return { isSuperAdmin: true as const, supabase, impersonatingOrgId };
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!appUser) return { error: 'Usuario no encontrado' as const };

  return {
    isSuperAdmin: false as const,
    supabase,
    userId: appUser.id,
    organizationId: appUser.organization_id,
  };
}

function resolveOrgId(
  ctx: Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>
): string | null {
  if (!ctx.isSuperAdmin) return ctx.organizationId;
  if (ctx.impersonatingOrgId) return ctx.impersonatingOrgId;
  return null;
}

async function checkPermission(code: string): Promise<boolean> {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return hasPermission(authCtx, code);
}

// ============================================================
// 1. OBTENER CONFIGURACIÓN
// ============================================================

export async function getAgentSettingsAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.configure_agent'))) {
    return { error: 'No tienes permiso para configurar el agente' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const settings = await ensureAgentSettings(ctx.supabase, orgId);
  if (!settings) return { error: 'No se pudo cargar la configuración' };

  return { settings };
}

// ============================================================
// 2. ACTUALIZAR UNA CAPA
// ============================================================

export async function updateAgentLayerAction(payload: {
  layer: AgentLayer;
  data: Record<string, unknown>;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.configure_agent'))) {
    return { error: 'No tienes permiso para configurar el agente' };
  }

  const schema = LAYER_SCHEMAS[payload.layer];
  if (!schema) return { error: 'Capa de configuración inválida' };

  const validation = schema.safeParse(payload.data);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const existing = await ensureAgentSettings(ctx.supabase, orgId);
  if (!existing) return { error: 'No se pudo cargar la configuración' };

  const update = validation.data as AgentSettingsUpdate;
  if (Object.keys(update).length === 0) {
    return { error: 'No hay cambios que guardar' };
  }

  const { error } = await ctx.supabase
    .from('agent_settings')
    .update(update)
    .eq('organization_id', orgId);

  if (error) return { error: `Error al guardar: ${error.message}` };

  revalidatePath('/conversations/agent-settings');
  return { success: true };
}

// ============================================================
// 3. CONSTRUIR SYSTEM PROMPT
// ============================================================

export async function buildAgentSystemPromptAction(payload?: {
  conversation_id?: string;
  client_id?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.view'))) {
    return { error: 'No tienes permiso para ver conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const built = await buildAgentPrompt(ctx.supabase, orgId, payload ?? {});
  return {
    system_prompt: built.system_prompt,
    conversation_history: built.conversation_history,
    tools: built.tools,
  };
}

// ============================================================
// 4. PREVIEW (sin llamar a Claude)
// ============================================================

export async function previewAgentResponseAction(payload: {
  message: string;
  client_id?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.configure_agent'))) {
    return { error: 'No tienes permiso para configurar el agente' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  if (!payload.message?.trim()) {
    return { error: 'Escribe un mensaje de prueba' };
  }

  const built = await buildAgentPrompt(ctx.supabase, orgId, {
    client_id: payload.client_id,
  });

  return {
    success: true,
    system_prompt: built.system_prompt,
    tools: built.tools,
    test_message: payload.message.trim(),
    note: 'Preview del prompt. La respuesta real de Claude se genera en el runtime del agente.',
  };
}

// ============================================================
// 5. RESET
// ============================================================

export async function resetAgentSettingsAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.configure_agent'))) {
    return { error: 'No tienes permiso para configurar el agente' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  await ensureAgentSettings(ctx.supabase, orgId);

  const { error } = await ctx.supabase
    .from('agent_settings')
    .update(RESET_DEFAULTS)
    .eq('organization_id', orgId);

  if (error) return { error: `Error al reiniciar: ${error.message}` };

  revalidatePath('/conversations/agent-settings');
  return { success: true };
}
