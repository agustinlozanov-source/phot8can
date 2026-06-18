/**
 * Runtime del agente IA de Conversaciones.
 * Lógica pura: NO 'use server', NO next/*.
 * Invocado desde el webhook (auto) y desde la UI (suggest).
 * Espejo de strategy-generator.ts / schedule-generator.ts.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { buildAgentPrompt } from '@/lib/agent-prompt-builder';
import { zernioFetch } from '@/lib/zernio-client';
import type { Database } from '@/lib/types/database';

type SB = SupabaseClient<Database>;

const AGENT_MODEL = 'claude-sonnet-4-6';
const MAX_AGENT_TOKENS = 4096;
const MAX_TOOL_ROUNDS = 5;

// ============================================================
// CLIENTE SUPABASE DIRECTO (sin next/headers)
// ============================================================
// Permite importar este módulo desde server actions Y desde la Netlify
// background function (que no puede resolver next/headers).

function createServiceClientDirect(): SB {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: { eventsPerSecond: 0 },
        transport: ws as unknown as typeof WebSocket,
      },
      global: {
        headers: { 'x-application-name': 'photocan-agent-runner' },
      },
    }
  );
}

const WO_ACTIVE = ['pending', 'in_production', 'review', 'ready'] as const;
const ESCALATION_HINTS = [
  'humano',
  'asesor',
  'un agente',
  'una persona',
  'te conecto',
  'te comunico',
  'escalar',
  'pasar con',
];

export type AgentRunResult = {
  success?: true;
  message_id?: string;
  content?: string;
  escalation_suggested?: boolean;
  tokens_input?: number;
  tokens_output?: number;
  tools_used?: string[];
  duration_ms?: number;
  error?: string;
};

// ============================================================
// EJECUCIÓN DE HERRAMIENTAS (read-only)
// ============================================================

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  clientId: string | null,
  orgId: string,
  sb: SB
): Promise<string> {
  if (!clientId) {
    return 'No hay cliente asociado a esta conversación. Esta información no está disponible.';
  }

  try {
    switch (toolName) {
      case 'view_strategy': {
        const { data: strategy } = await sb
          .from('strategies')
          .select('id, title')
          .eq('client_id', clientId)
          .eq('organization_id', orgId)
          .eq('status', 'approved')
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!strategy) return 'El cliente no tiene una estrategia aprobada aún.';

        const { data: layers } = await sb
          .from('strategy_layers')
          .select('title, kind, content_html, layer_order')
          .eq('strategy_id', strategy.id)
          .order('layer_order');

        const body = (layers || [])
          .map(
            (l) =>
              `## ${l.title} (${l.kind})\n${stripHtml(l.content_html || '').slice(0, 400)}`
          )
          .join('\n\n');
        return `Estrategia: ${strategy.title}\n\n${body || '(sin capas)'}`;
      }

      case 'view_subscription': {
        const { data: sub } = await sb
          .from('client_subscriptions')
          .select(
            'id, name, billing_cycle, status, price_per_period, currency, current_period_start, current_period_end, next_renewal_date'
          )
          .eq('client_id', clientId)
          .eq('organization_id', orgId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!sub) return 'El cliente no tiene una suscripción registrada.';

        const lines = [
          `Plan: ${sub.name} (${sub.billing_cycle})`,
          `Estado: ${sub.status}`,
          `Precio por período: ${sub.price_per_period} ${sub.currency}`,
        ];
        if (sub.current_period_start && sub.current_period_end)
          lines.push(
            `Período actual: ${sub.current_period_start} → ${sub.current_period_end}`
          );
        if (sub.next_renewal_date)
          lines.push(`Próxima renovación: ${sub.next_renewal_date}`);
        return lines.join('\n');
      }

      case 'view_schedule': {
        const days = Math.min(
          Math.max(Number(toolInput.upcoming_days) || 30, 1),
          90
        );
        const { data: sub } = await sb
          .from('client_subscriptions')
          .select('id')
          .eq('client_id', clientId)
          .eq('organization_id', orgId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (!sub) return 'El cliente no tiene una suscripción activa con cronograma.';

        const { data: period } = await sb
          .from('subscription_periods')
          .select('id')
          .eq('subscription_id', sub.id)
          .eq('status', 'active')
          .order('period_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!period) return 'No hay un período activo con cronograma.';

        const { data: schedule } = await sb
          .from('schedules')
          .select('id, status')
          .eq('subscription_period_id', period.id)
          .maybeSingle();
        if (!schedule) return 'Aún no se ha generado el cronograma de este período.';

        const today = todayISO();
        const { data: items } = await sb
          .from('schedule_items')
          .select('scheduled_date, item_type, title, status')
          .eq('schedule_id', schedule.id)
          .gte('scheduled_date', today)
          .lte('scheduled_date', addDays(today, days))
          .order('scheduled_date')
          .limit(20);

        if (!items || items.length === 0)
          return `No hay piezas programadas en los próximos ${days} días.`;
        const body = items
          .map(
            (i) =>
              `- ${i.scheduled_date} · ${i.item_type} · ${i.title} (${i.status})`
          )
          .join('\n');
        return `Próximas piezas (${days} días):\n${body}`;
      }

      case 'view_work_orders': {
        const filter = String(toolInput.status_filter || 'active');
        let q = sb
          .from('work_orders')
          .select('folio, title, status, deadline')
          .eq('client_id', clientId)
          .eq('organization_id', orgId);
        if (filter === 'active') q = q.in('status', WO_ACTIVE);
        else if (filter === 'recent_published')
          q = q.eq('status', 'published');
        const { data: wos } = await q
          .order('deadline', { ascending: true })
          .limit(15);

        if (!wos || wos.length === 0)
          return 'No hay órdenes de trabajo que coincidan.';
        const body = wos
          .map(
            (w) => `- ${w.folio} · ${w.title} · ${w.status} · entrega ${w.deadline}`
          )
          .join('\n');
        return `Órdenes de trabajo (${filter}):\n${body}`;
      }

      case 'view_invoices': {
        const filter = String(toolInput.status_filter || 'all');
        await sb.rpc('mark_overdue_invoices');
        let q = sb
          .from('invoices')
          .select('folio, total, currency, status, due_date, paid_at')
          .eq('client_id', clientId)
          .eq('organization_id', orgId);
        if (filter === 'pending') q = q.eq('status', 'pending');
        else if (filter === 'overdue') q = q.eq('status', 'overdue');
        else if (filter === 'recent_paid') q = q.eq('status', 'paid');
        const { data: invoices } = await q
          .order('issue_date', { ascending: false })
          .limit(15);

        if (!invoices || invoices.length === 0)
          return 'No hay cobros que coincidan.';
        const body = invoices
          .map(
            (i) =>
              `- ${i.folio} · ${i.total} ${i.currency} · ${i.status}` +
              (i.status === 'paid'
                ? ''
                : ` · vence ${i.due_date}`)
          )
          .join('\n');
        return `Cobros (${filter}):\n${body}`;
      }

      default:
        return `Herramienta desconocida: ${toolName}`;
    }
  } catch (err) {
    console.error('[AgentRunner] executeToolCall error:', err);
    return 'Ocurrió un error al consultar esa información.';
  }
}

// ============================================================
// RUNNER PRINCIPAL
// ============================================================

export async function runAgentForConversation(
  conversationId: string,
  options?: {
    mode?: 'auto' | 'suggest';
    triggered_by?: 'webhook' | 'user_request';
  }
): Promise<AgentRunResult> {
  const mode = options?.mode ?? 'auto';
  const startTime = Date.now();

  try {
    const sb = createServiceClientDirect();

    // 1-2. Cargar conversación
    const { data: conversation } = await sb
      .from('conversations')
      .select(
        'id, organization_id, client_id, status, agent_handles, zernio_conversation_id'
      )
      .eq('id', conversationId)
      .maybeSingle();

    if (!conversation) return { error: 'Conversación no encontrada' };

    // 3. Validaciones de la conversación
    if (!conversation.agent_handles)
      return { error: 'Agent not handling this conversation' };
    if (conversation.status === 'archived')
      return { error: 'Conversation archived' };

    const orgId = conversation.organization_id;

    // 4. Validar agent_settings
    const { data: settings } = await sb
      .from('agent_settings')
      .select('is_enabled, auto_respond')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!settings?.is_enabled) return { error: 'Agent disabled' };
    if (mode === 'auto' && !settings.auto_respond)
      return { error: 'Auto-respond disabled' };

    // 5. Construir prompt + tools + history
    const built = await buildAgentPrompt(sb, orgId, {
      conversation_id: conversationId,
      client_id: conversation.client_id ?? undefined,
    });

    const messages: Anthropic.MessageParam[] = built.conversation_history.map(
      (m) => ({ role: m.role, content: m.content })
    );

    if (messages.length === 0) {
      return { error: 'No hay mensajes en la conversación para responder' };
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const tools = built.tools as unknown as Anthropic.Tool[];

    // 6. Loop de tool_use
    let finalText = '';
    let tokensInput = 0;
    let tokensOutput = 0;
    const toolsUsed: string[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: AGENT_MODEL,
        max_tokens: MAX_AGENT_TOKENS,
        system: built.system_prompt,
        messages,
        tools,
      });
      tokensInput += response.usage.input_tokens;
      tokensOutput += response.usage.output_tokens;

      if (response.stop_reason === 'tool_use') {
        // Ejecutar cada tool_use y devolver resultados
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            toolsUsed.push(block.name);
            const result = await executeToolCall(
              block.name,
              (block.input as Record<string, unknown>) || {},
              conversation.client_id,
              orgId,
              sb
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // end_turn / max_tokens → extraer texto
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    // Si tras el loop seguimos sin texto, forzar respuesta sin herramientas
    if (!finalText) {
      const forced = await anthropic.messages.create({
        model: AGENT_MODEL,
        max_tokens: MAX_AGENT_TOKENS,
        system: built.system_prompt,
        messages,
      });
      tokensInput += forced.usage.input_tokens;
      tokensOutput += forced.usage.output_tokens;
      finalText = forced.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
    }

    if (!finalText) {
      return { error: 'El agente no generó una respuesta' };
    }

    // 7. Detección de escalación
    const lower = finalText.toLowerCase();
    const escalationSuggested = ESCALATION_HINTS.some((h) => lower.includes(h));

    const durationMs = Date.now() - startTime;

    // 8. Guardar el mensaje outbound del agente
    const { data: message, error: insertError } = await sb
      .from('messages')
      .insert({
        conversation_id: conversationId,
        organization_id: orgId,
        direction: 'outbound',
        sender_type: 'agent',
        sender_user_id: null,
        content: finalText,
        status: 'pending',
        ai_metadata: {
          model: AGENT_MODEL,
          prompt_tokens: tokensInput,
          completion_tokens: tokensOutput,
          duration_ms: durationMs,
          tools_used: toolsUsed,
          escalation_suggested: escalationSuggested,
          is_suggestion: mode === 'suggest',
        } as never,
      })
      .select('id')
      .single();

    if (insertError || !message) {
      return { error: `Error al guardar la respuesta: ${insertError?.message}` };
    }

    // 9-10. Enviar (auto) o dejar como sugerencia
    if (mode === 'auto') {
      if (!conversation.zernio_conversation_id) {
        await sb
          .from('messages')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: 'Conversación sin zernio_conversation_id',
          })
          .eq('id', message.id);
      } else {
        try {
          // NOTA WhatsApp 24h: WhatsApp solo permite enviar mensajes de texto
          // libre dentro de las 24h posteriores al último mensaje entrante del
          // cliente. Fuera de esa ventana, la API devuelve el error 131047
          // ("Re-engagement message") y se requiere una plantilla aprobada.
          // El agente IA solo se dispara por mensajes entrantes (webhook), así
          // que normalmente está dentro de la ventana; si aun así Zernio
          // rechaza por 131047, el catch de abajo marca el mensaje como failed.
          const res = await zernioFetch<{
            message?: { id?: string; _id?: string };
            id?: string;
          }>(
            `/inbox/conversations/${conversation.zernio_conversation_id}/messages`,
            { method: 'POST', body: JSON.stringify({ text: finalText }) }
          );
          const zernioMessageId =
            res.message?.id || res.message?._id || res.id || null;
          await sb
            .from('messages')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              zernio_message_id: zernioMessageId,
            })
            .eq('id', message.id);
        } catch (err) {
          console.error('[AgentRunner] Error enviando a Zernio:', err);
          await sb
            .from('messages')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              failure_reason:
                err instanceof Error ? err.message : 'Error al enviar a Zernio',
            })
            .eq('id', message.id);
        }
      }
    }
    // mode === 'suggest' → queda en 'pending' con is_suggestion=true para la UI

    return {
      success: true,
      message_id: message.id,
      content: finalText,
      escalation_suggested: escalationSuggested,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      tools_used: toolsUsed,
      duration_ms: durationMs,
    };
  } catch (err) {
    console.error('[AgentRunner] Error:', err);
    return { error: err instanceof Error ? err.message : 'Error del agente' };
  }
}
