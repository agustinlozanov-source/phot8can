'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database, AgentToolsEnabled } from '@/lib/types/database';

type AgentSettingsRow = Database['public']['Tables']['agent_settings']['Row'];
type AgentSettingsUpdate =
  Database['public']['Tables']['agent_settings']['Update'];

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_TOOLS: AgentToolsEnabled = {
  view_strategy: true,
  view_schedule: true,
  view_work_orders: true,
  view_invoices: true,
  view_subscription: true,
};

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

type Ctx = Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>;

// Asegura que exista un agent_settings para la org y lo devuelve.
async function ensureAgentSettings(
  ctx: Ctx,
  orgId: string
): Promise<AgentSettingsRow | null> {
  const { data: existing } = await ctx.supabase
    .from('agent_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (existing) return existing as AgentSettingsRow;

  const { data: created, error } = await ctx.supabase
    .from('agent_settings')
    .insert({ organization_id: orgId })
    .select('*')
    .single();

  if (error) {
    // Posible carrera: si otro proceso lo creó, re-leer
    const { data: again } = await ctx.supabase
      .from('agent_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();
    return (again as AgentSettingsRow) ?? null;
  }
  return created as AgentSettingsRow;
}

// ============================================================
// 1. OBTENER CONFIGURACIÓN DEL AGENTE
// ============================================================

export async function getAgentSettingsAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.configure_agent'))) {
    return { error: 'No tienes permiso para configurar el agente' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const settings = await ensureAgentSettings(ctx, orgId);
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

  // Asegurar que exista la fila
  const existing = await ensureAgentSettings(ctx, orgId);
  if (!existing) return { error: 'No se pudo cargar la configuración' };

  // Solo los campos validados de esta capa
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
// HELPER INTERNO: construir el system prompt
// ============================================================

type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const TOOL_DEFS: Record<keyof AgentToolsEnabled, ToolDefinition> = {
  view_strategy: {
    name: 'view_strategy',
    description:
      'Consulta la estrategia digital aprobada del cliente (posicionamiento, audiencia, pilares, tono).',
    input_schema: { type: 'object', properties: {} },
  },
  view_schedule: {
    name: 'view_schedule',
    description:
      'Consulta el cronograma de contenido del período actual del cliente.',
    input_schema: { type: 'object', properties: {} },
  },
  view_work_orders: {
    name: 'view_work_orders',
    description:
      'Consulta el estado de producción de las piezas (órdenes de trabajo y sus tareas).',
    input_schema: { type: 'object', properties: {} },
  },
  view_invoices: {
    name: 'view_invoices',
    description:
      'Consulta los cobros del cliente y su estado de pago (pendiente, pagado, vencido).',
    input_schema: { type: 'object', properties: {} },
  },
  view_subscription: {
    name: 'view_subscription',
    description:
      'Consulta los datos de la suscripción del cliente (plan, ciclo, estado).',
    input_schema: { type: 'object', properties: {} },
  },
};

async function buildSystemPrompt(
  ctx: Ctx,
  orgId: string,
  opts: { conversation_id?: string; client_id?: string }
): Promise<{
  system_prompt: string;
  conversation_history: Array<{ role: string; content: string; timestamp: string }>;
  tools: ToolDefinition[];
}> {
  const settings = await ensureAgentSettings(ctx, orgId);

  // Resolver cliente: explícito o desde la conversación
  let clientId = opts.client_id ?? null;
  let conversationRemoteName: string | null = null;
  if (opts.conversation_id) {
    const { data: conv } = await ctx.supabase
      .from('conversations')
      .select('client_id, remote_display_name')
      .eq('id', opts.conversation_id)
      .maybeSingle();
    if (conv) {
      if (!clientId) clientId = conv.client_id;
      conversationRemoteName = conv.remote_display_name;
    }
  }

  // Datos de la organización
  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();

  const tools = (settings?.tools_enabled as unknown as AgentToolsEnabled) ||
    DEFAULT_TOOLS;
  const contextual = settings?.enable_contextual_intelligence ?? true;

  // ---- Armar el prompt ----
  const parts: string[] = [];

  parts.push(
    `Eres ${settings?.agent_name || 'Asistente'}, un asistente de atención a clientes de la agencia "${org?.name || 'la agencia'}".`
  );
  if (settings?.language_register)
    parts.push(`Registro de lenguaje: ${settings.language_register}.`);
  if (settings?.agent_personality)
    parts.push(`Personalidad: ${settings.agent_personality}`);

  // Conocimiento del negocio
  const knowledge: string[] = [];
  if (settings?.org_description)
    knowledge.push(`Sobre el negocio: ${settings.org_description}`);
  if (settings?.org_services_summary)
    knowledge.push(`Servicios: ${settings.org_services_summary}`);
  if (settings?.org_process_summary)
    knowledge.push(`Proceso de trabajo: ${settings.org_process_summary}`);
  if (settings?.human_contact_info)
    knowledge.push(`Contacto humano: ${settings.human_contact_info}`);
  if (knowledge.length)
    parts.push(`\n# Conocimiento del negocio\n${knowledge.join('\n')}`);

  // Políticas
  const policies: string[] = [];
  if (settings?.hard_limits)
    policies.push(`Límites estrictos (NUNCA los rompas): ${settings.hard_limits}`);
  if (settings?.changes_policy)
    policies.push(`Cambios: ${settings.changes_policy}`);
  if (settings?.complaints_policy)
    policies.push(`Quejas: ${settings.complaints_policy}`);
  if (settings?.escalation_triggers)
    policies.push(`Escalar a un humano cuando: ${settings.escalation_triggers}`);
  if (settings?.upsell_policy)
    policies.push(`Venta adicional: ${settings.upsell_policy}`);
  if (settings?.collections_policy)
    policies.push(`Cobranza: ${settings.collections_policy}`);
  if (policies.length)
    parts.push(`\n# Políticas\n${policies.join('\n')}`);

  // Contexto del cliente (inteligencia contextual)
  if (contextual && clientId) {
    const ctxLines: string[] = [];
    const { data: client } = await ctx.supabase
      .from('clients')
      .select('name, legal_name, industry')
      .eq('id', clientId)
      .maybeSingle();
    if (client) {
      ctxLines.push(`Nombre: ${client.name}`);
      if (client.industry) ctxLines.push(`Industria: ${client.industry}`);
    }

    if (tools.view_subscription) {
      const { data: sub } = await ctx.supabase
        .from('client_subscriptions')
        .select('name, status, billing_cycle')
        .eq('client_id', clientId)
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (sub)
        ctxLines.push(
          `Suscripción activa: ${sub.name} (${sub.billing_cycle}, ${sub.status})`
        );
    }

    if (tools.view_strategy) {
      const { data: strat } = await ctx.supabase
        .from('strategies')
        .select('title')
        .eq('client_id', clientId)
        .eq('organization_id', orgId)
        .eq('status', 'approved')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (strat) ctxLines.push(`Estrategia aprobada: ${strat.title}`);
    }

    if (ctxLines.length)
      parts.push(`\n# Cliente con el que hablas\n${ctxLines.join('\n')}`);
  } else if (contextual && conversationRemoteName) {
    parts.push(
      `\n# Cliente con el que hablas\nNombre del contacto: ${conversationRemoteName} (aún no vinculado a un cliente registrado).`
    );
  }

  parts.push(
    `\n# Reglas generales\nResponde de forma clara, breve y útil. Si no sabes algo o el caso requiere intervención humana según las políticas, dilo y ofrece escalar. No inventes información.`
  );

  // Historial de la conversación
  const conversation_history: Array<{
    role: string;
    content: string;
    timestamp: string;
  }> = [];
  if (opts.conversation_id) {
    const limit = settings?.context_message_history_limit ?? 20;
    const { data: msgs } = await ctx.supabase
      .from('messages')
      .select('direction, content, created_at')
      .eq('conversation_id', opts.conversation_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    for (const m of (msgs || []).slice().reverse()) {
      conversation_history.push({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content || '',
        timestamp: m.created_at,
      });
    }
  }

  // Tools habilitadas
  const enabledTools = (Object.keys(TOOL_DEFS) as Array<keyof AgentToolsEnabled>)
    .filter((k) => tools[k])
    .map((k) => TOOL_DEFS[k]);

  return {
    system_prompt: parts.join('\n'),
    conversation_history,
    tools: enabledTools,
  };
}

// ============================================================
// 3. CONSTRUIR SYSTEM PROMPT (acción)
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

  const built = await buildSystemPrompt(ctx, orgId, payload ?? {});
  return built;
}

// ============================================================
// 4. PREVIEW DE RESPUESTA (sin llamar a Claude todavía)
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

  const built = await buildSystemPrompt(ctx, orgId, {
    client_id: payload.client_id,
  });

  // PREVIEW: NO se llama a Claude (eso es el Bloque 14.7).
  return {
    success: true,
    system_prompt: built.system_prompt,
    tools: built.tools,
    test_message: payload.message.trim(),
    note: 'Preview del prompt. La respuesta real de Claude se genera en el bloque del runtime del agente.',
  };
}

// ============================================================
// 5. RESETEAR CONFIGURACIÓN
// ============================================================

export async function resetAgentSettingsAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.configure_agent'))) {
    return { error: 'No tienes permiso para configurar el agente' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  await ensureAgentSettings(ctx, orgId);

  const { error } = await ctx.supabase
    .from('agent_settings')
    .update(RESET_DEFAULTS)
    .eq('organization_id', orgId);

  if (error) return { error: `Error al reiniciar: ${error.message}` };

  revalidatePath('/conversations/agent-settings');
  return { success: true };
}
