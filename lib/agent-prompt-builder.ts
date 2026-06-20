/**
 * Construcción del system prompt y tools del agente IA.
 * Lógica pura (NO 'use server', NO next/*) para reusarse desde:
 *  - agent-settings.ts (preview/config, con cliente de sesión)
 *  - agent-runner.ts (runtime, con createServiceClient)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, AgentToolsEnabled } from '@/lib/types/database';

type SB = SupabaseClient<Database>;
type AgentSettingsRow = Database['public']['Tables']['agent_settings']['Row'];

export const DEFAULT_TOOLS: AgentToolsEnabled = {
  view_strategy: true,
  view_schedule: true,
  view_work_orders: true,
  view_invoices: true,
  view_subscription: true,
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

// ============================================================
// DEFINICIONES DE HERRAMIENTAS
// ============================================================

export function buildToolDefinitions(
  toolsEnabled: AgentToolsEnabled
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  if (toolsEnabled.view_strategy) {
    tools.push({
      name: 'view_strategy',
      description:
        'Consulta la estrategia de contenido aprobada del cliente actual. Útil cuando preguntan sobre objetivos, posicionamiento, audiencia, mensajes clave, pilares de contenido o plan de acción.',
      input_schema: { type: 'object', properties: {} },
    });
  }

  if (toolsEnabled.view_schedule) {
    tools.push({
      name: 'view_schedule',
      description:
        'Consulta el cronograma de contenido activo del cliente. Útil cuando preguntan qué piezas vienen, cuándo se publica algo, o cuál es el plan del mes.',
      input_schema: {
        type: 'object',
        properties: {
          upcoming_days: {
            type: 'number',
            description: 'Cuántos días hacia adelante mostrar (default 30, max 90)',
          },
        },
      },
    });
  }

  if (toolsEnabled.view_work_orders) {
    tools.push({
      name: 'view_work_orders',
      description:
        'Consulta las órdenes de trabajo del cliente (piezas en producción). Útil cuando preguntan en qué andan, cuándo entregan algo, o el estado de una pieza.',
      input_schema: {
        type: 'object',
        properties: {
          status_filter: {
            type: 'string',
            enum: ['active', 'all', 'recent_published'],
            description:
              'Qué OTs traer. Default: active (pending/in_production/review/ready)',
          },
        },
      },
    });
  }

  if (toolsEnabled.view_invoices) {
    tools.push({
      name: 'view_invoices',
      description:
        'Consulta el estado de cobros del cliente: pendientes, pagados, vencidos. SOLO úsala si el cliente pregunta directamente sobre facturación o pagos.',
      input_schema: {
        type: 'object',
        properties: {
          status_filter: {
            type: 'string',
            enum: ['pending', 'overdue', 'all', 'recent_paid'],
          },
        },
      },
    });
  }

  if (toolsEnabled.view_subscription) {
    tools.push({
      name: 'view_subscription',
      description:
        'Consulta los detalles de la suscripción del cliente: plan, ciclo de facturación, período activo y entregables del mes.',
      input_schema: { type: 'object', properties: {} },
    });
  }

  return tools;
}

// ============================================================
// ASEGURAR AGENT_SETTINGS
// ============================================================

export async function ensureAgentSettings(
  sb: SB,
  orgId: string
): Promise<AgentSettingsRow | null> {
  const { data: existing } = await sb
    .from('agent_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (existing) return existing as AgentSettingsRow;

  const { data: created, error } = await sb
    .from('agent_settings')
    .insert({ organization_id: orgId })
    .select('*')
    .single();

  if (error) {
    const { data: again } = await sb
      .from('agent_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();
    return (again as AgentSettingsRow) ?? null;
  }
  return created as AgentSettingsRow;
}

// ============================================================
// CONSTRUIR PROMPT
// ============================================================

export async function buildAgentPrompt(
  sb: SB,
  orgId: string,
  opts: { conversation_id?: string; client_id?: string }
): Promise<{
  settings: AgentSettingsRow | null;
  system_prompt: string;
  conversation_history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: ToolDefinition[];
}> {
  const settings = await ensureAgentSettings(sb, orgId);

  // Resolver cliente: explícito o desde la conversación
  let clientId = opts.client_id ?? null;
  let conversationRemoteName: string | null = null;
  if (opts.conversation_id) {
    const { data: conv } = await sb
      .from('conversations')
      .select('client_id, remote_display_name')
      .eq('id', opts.conversation_id)
      .maybeSingle();
    if (conv) {
      if (!clientId) clientId = conv.client_id;
      conversationRemoteName = conv.remote_display_name;
    }
  }

  const { data: org } = await sb
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();

  const toolsEnabled =
    (settings?.tools_enabled as unknown as AgentToolsEnabled) || DEFAULT_TOOLS;
  const contextual = settings?.enable_contextual_intelligence ?? true;

  const parts: string[] = [];
  parts.push(
    `Eres ${settings?.agent_name || 'Asistente'}, un asistente de atención a clientes de la agencia "${org?.name || 'la agencia'}".`
  );
  if (settings?.language_register)
    parts.push(`Registro de lenguaje: ${settings.language_register}.`);
  if (settings?.agent_personality)
    parts.push(`Personalidad: ${settings.agent_personality}`);

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
  if (policies.length) parts.push(`\n# Políticas\n${policies.join('\n')}`);

  if (contextual && clientId) {
    try {
      const ctxLines: string[] = [];
      const { data: client, error: clientErr } = await sb
        .from('clients')
        .select('name, legal_name, industry')
        .eq('id', clientId)
        .maybeSingle();
      if (clientErr) {
        console.error(
          '[agent-prompt-builder] Failed loading client context:',
          clientErr
        );
      }
      if (client) {
        ctxLines.push(`Nombre: ${client.name}`);
        if (client.industry) ctxLines.push(`Industria: ${client.industry}`);
      }
      if (ctxLines.length)
        parts.push(`\n# Cliente con el que hablas\n${ctxLines.join('\n')}`);
    } catch (err) {
      // No crashear todo el prompt si falla cargar el contexto del cliente.
      console.error(
        '[agent-prompt-builder] Error loading client context:',
        err
      );
    }
  } else if (contextual && conversationRemoteName) {
    parts.push(
      `\n# Cliente con el que hablas\nNombre del contacto: ${conversationRemoteName} (aún no vinculado a un cliente registrado).`
    );
  }

  parts.push(
    `\n# Herramientas\nTienes herramientas para consultar datos reales del cliente (estrategia, cronograma, producción, cobros, suscripción). Úsalas cuando el cliente pregunte por algo concreto. No inventes datos: si una herramienta no devuelve nada, dilo.`
  );

  parts.push(
    `\n# Reglas generales\nResponde de forma clara, breve y útil. Si el caso requiere intervención humana según las políticas, ofrece escalar con una persona del equipo. Nunca prometas cosas fuera de tus límites.`
  );

  // Historial
  const conversation_history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];
  if (opts.conversation_id) {
    try {
      const limit = settings?.context_message_history_limit ?? 20;
      const { data: msgs, error: msgsErr } = await sb
        .from('messages')
        .select('direction, content, created_at')
        .eq('conversation_id', opts.conversation_id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (msgsErr) {
        console.error(
          '[agent-prompt-builder] Failed loading history:',
          msgsErr
        );
      }
      for (const m of (msgs || []).slice().reverse()) {
        if (!m.content) continue;
        conversation_history.push({
          role: m.direction === 'inbound' ? 'user' : 'assistant',
          content: m.content,
        });
      }
    } catch (err) {
      console.error('[agent-prompt-builder] Error loading history:', err);
    }
  }

  return {
    settings,
    system_prompt: parts.join('\n'),
    conversation_history,
    tools: buildToolDefinitions(toolsEnabled),
  };
}
