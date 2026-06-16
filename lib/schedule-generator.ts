/**
 * schedule-generator.ts
 *
 * Lógica pura de generación de cronogramas de contenido con Claude.
 * SIN dependencias de Next.js (no 'use server', no next/cache, no next/headers).
 * Puede ser importado desde server actions Y desde Netlify background functions.
 *
 * Espejo de strategy-generator.ts. Mantener el mismo patrón:
 *  - @supabase/supabase-js DIRECTO (no @supabase/ssr)
 *  - transport: ws (Node 20 sin WebSocket global)
 *  - tool_use de Anthropic (no JSON.parse de texto libre)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { z } from 'zod';
import type { Database } from './types/database';

// ============================================================
// CONFIGURACIÓN
// ============================================================

const STRATEGY_MODEL = 'claude-sonnet-4-6';
const MAX_GENERATION_TOKENS = 16000;

const ITEM_TYPES = [
  'post',
  'reel',
  'story',
  'carousel',
  'video',
  'live',
  'other',
] as const;

// ============================================================
// SCHEMAS ZOD (defensa adicional sobre el tool_use)
// ============================================================

const scheduleItemSchema = z.object({
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  item_type: z.enum(ITEM_TYPES),
  pillar_name: z.string().min(1).max(200),
  pillar_index: z.number().int().min(0),
  title: z.string().min(1).max(300),
  hook: z.string().max(2000),
  body_copy_suggestion: z.string().max(5000),
  cta: z.string().max(1000),
  format_notes: z.string().max(2000),
  hashtags_suggested: z.string().max(2000).optional().nullable(),
  key_message: z.string().min(1).max(2000),
});

const claudeScheduleResponseSchema = z.object({
  items: z.array(scheduleItemSchema).min(1, 'Claude debe devolver al menos 1 pieza'),
});

type ClaudeScheduleItem = z.infer<typeof scheduleItemSchema>;

// ============================================================
// CLIENTE SUPABASE DIRECTO (sin next/headers)
// ============================================================

function createServiceClientDirect() {
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
        params: {
          eventsPerSecond: 0,
        },
        transport: ws as unknown as typeof WebSocket,
      },
      global: {
        headers: {
          'x-application-name': 'photocan-bg-function',
        },
      },
    }
  );
}

// ============================================================
// HELPERS
// ============================================================

function cycleLabel(cycle: string): string {
  const labels: Record<string, string> = {
    monthly: 'mensual',
    quarterly: 'trimestral',
    annual: 'anual',
    one_time: 'único',
  };
  return labels[cycle] || cycle;
}

// ============================================================
// FUNCIÓN PRINCIPAL: GENERAR CRONOGRAMA
// ============================================================

export type GenerateScheduleResult = {
  success?: true;
  scheduleId?: string;
  itemsGenerated?: number;
  tokensInput?: number;
  tokensOutput?: number;
  durationMs?: number;
  error?: string;
};

export async function generateScheduleCore(payload: {
  schedule_id: string;
}): Promise<GenerateScheduleResult> {
  const supabase = createServiceClientDirect();

  // 1. Cargar el schedule
  const { data: schedule } = await supabase
    .from('schedules')
    .select(
      'id, organization_id, subscription_period_id, status, days_planned, start_date, generation_notes'
    )
    .eq('id', payload.schedule_id)
    .maybeSingle();

  if (!schedule) {
    return { error: 'Cronograma no encontrado' };
  }

  // 2. Marcar como 'generating' (evita dobles ejecuciones)
  await supabase
    .from('schedules')
    .update({ status: 'generating', error_message: null })
    .eq('id', schedule.id);

  const startTime = Date.now();

  try {
    // 3. Cargar el contexto completo
    const { data: period } = await supabase
      .from('subscription_periods')
      .select('id, subscription_id, period_number, start_date, end_date')
      .eq('id', schedule.subscription_period_id)
      .maybeSingle();

    if (!period) {
      throw new Error('Período de la suscripción no encontrado');
    }

    const { data: subscription } = await supabase
      .from('client_subscriptions')
      .select('id, client_id, name, billing_cycle')
      .eq('id', period.subscription_id)
      .maybeSingle();

    if (!subscription) {
      throw new Error('Suscripción no encontrada');
    }

    const [clientResult, orgResult, deliverablesResult] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, legal_name')
        .eq('id', subscription.client_id)
        .maybeSingle(),
      supabase
        .from('organizations')
        .select('id, name')
        .eq('id', schedule.organization_id)
        .maybeSingle(),
      supabase
        .from('period_deliverables')
        .select('service_name, service_type, unit, quantity_planned')
        .eq('period_id', period.id)
        .order('position'),
    ]);

    const client = clientResult.data;
    const organization = orgResult.data;
    const deliverables = deliverablesResult.data || [];

    if (!client || !organization) {
      throw new Error('No se pudo cargar el cliente o la organización');
    }

    // Estrategia aprobada más reciente del cliente
    const { data: strategy } = await supabase
      .from('strategies')
      .select('id, title')
      .eq('organization_id', schedule.organization_id)
      .eq('client_id', subscription.client_id)
      .eq('status', 'approved')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Sin estrategia aprobada → no se puede generar cronograma
    if (!strategy) {
      throw new Error(
        'El cliente necesita una estrategia aprobada antes de generar cronograma'
      );
    }

    const { data: layers } = await supabase
      .from('strategy_layers')
      .select('kind, title, content_html, layer_order')
      .eq('strategy_id', strategy.id)
      .order('layer_order');

    const strategyLayers = layers || [];

    // ----------------------------------------------------------
    // Resumen de entregables planeados
    // ----------------------------------------------------------
    const totalPieces = deliverables.reduce(
      (sum, d) => sum + (d.quantity_planned || 0),
      0
    );

    if (totalPieces <= 0) {
      throw new Error(
        'El período no tiene entregables planeados; no hay piezas que programar'
      );
    }

    const deliverablesSummary = deliverables
      .map((d) => {
        const unit = d.unit ? ` ${d.unit}` : '';
        const type = d.service_type ? ` (${d.service_type})` : '';
        return `- ${d.quantity_planned}× ${d.service_name}${unit}${type}`;
      })
      .join('\n');

    // ----------------------------------------------------------
    // 5. System prompt
    // ----------------------------------------------------------
    const layersBlock = strategyLayers
      .map(
        (layer) =>
          `## ${layer.title} (${layer.kind})\n${layer.content_html}`
      )
      .join('\n\n');

    const systemPrompt = `Eres un experto en estrategia de contenido digital para redes sociales. Trabajas para la agencia "${organization.name}" y tu tarea es construir un cronograma de publicaciones ejecutable a partir de la estrategia aprobada del cliente.

# Cliente
Nombre: ${client.name}${client.legal_name ? `\nRazón social: ${client.legal_name}` : ''}

# Estrategia aprobada del cliente
La siguiente estrategia define la industria, el posicionamiento, la audiencia, los mensajes, los pilares de contenido, el tono de voz y el plan de acción. DEBES respetarla fielmente: el tono, la voz y los pilares de contenido salen de aquí.

${layersBlock}

# Entregables que debes planear en este período
Tienes que distribuir EXACTAMENTE ${totalPieces} piezas de contenido, repartidas según estos entregables contratados:
${deliverablesSummary}

El número total de piezas que generes DEBE ser igual a ${totalPieces} (la suma de las cantidades planeadas).

# Reglas de planeación
- Distribuye las piezas entre los pilares de contenido de la estrategia de forma balanceada (usa pillar_name y pillar_index según el orden en el que aparecen los pilares en la capa "pillars", empezando en 0).
- Cada pieza debe ser un brief ejecutable por el equipo creativo: incluye hook, copy sugerido (body_copy_suggestion), CTA y notas de formato (format_notes).
- Usa horarios óptimos típicos: mañana entre 9:00 y 11:00, o tarde entre 18:00 y 20:00. Devuelve scheduled_time en formato 24h HH:MM.
- No publiques 2 piezas del mismo pilar el mismo día.
- Espacia las piezas de forma razonable a lo largo de los días planeados; no satures un solo día.
- Mantén SIEMPRE el tono y la voz definidos en la estrategia.
- item_type debe ser uno de: ${ITEM_TYPES.join(', ')}.
- Las fechas (scheduled_date) deben caer dentro del rango de días planeados a partir de la fecha de inicio.

Devuelve el resultado usando la herramienta save_schedule_items.`;

    // ----------------------------------------------------------
    // 6. User message
    // ----------------------------------------------------------
    const userMessage = `Genera el cronograma de contenido para ${client.name}.

- Días a planear: ${schedule.days_planned}
- Fecha de inicio: ${schedule.start_date}
- Período de la suscripción: #${period.period_number} (${period.start_date} → ${period.end_date}), plan ${cycleLabel(subscription.billing_cycle)} "${subscription.name}"
- Total de piezas a generar: ${totalPieces}
${schedule.generation_notes ? `\nNotas del Director de la cuenta (priorízalas):\n${schedule.generation_notes}` : ''}

Genera las ${totalPieces} piezas usando la herramienta save_schedule_items.`;

    // ----------------------------------------------------------
    // 7. Llamada a Claude con tool_use
    // ----------------------------------------------------------
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: STRATEGY_MODEL,
      max_tokens: MAX_GENERATION_TOKENS,
      system: systemPrompt,
      tools: [
        {
          name: 'save_schedule_items',
          description:
            'Guarda el cronograma de contenido generado como una lista de piezas planeadas',
          input_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                description:
                  'Lista de piezas de contenido planeadas, en orden cronológico',
                items: {
                  type: 'object',
                  properties: {
                    scheduled_date: {
                      type: 'string',
                      description: 'Fecha de publicación en formato YYYY-MM-DD',
                    },
                    scheduled_time: {
                      type: 'string',
                      description: 'Hora de publicación en formato 24h HH:MM',
                    },
                    item_type: {
                      type: 'string',
                      enum: [...ITEM_TYPES],
                      description: 'Tipo de pieza de contenido',
                    },
                    pillar_name: {
                      type: 'string',
                      description: 'Nombre del pilar de contenido al que pertenece',
                    },
                    pillar_index: {
                      type: 'number',
                      description:
                        'Índice del pilar (0-5) según el orden en la estrategia',
                    },
                    title: {
                      type: 'string',
                      description: 'Título corto e interno de la pieza',
                    },
                    hook: {
                      type: 'string',
                      description: 'Gancho de apertura para captar atención',
                    },
                    body_copy_suggestion: {
                      type: 'string',
                      description: 'Copy sugerido para el cuerpo de la pieza',
                    },
                    cta: {
                      type: 'string',
                      description: 'Llamado a la acción (call to action)',
                    },
                    format_notes: {
                      type: 'string',
                      description:
                        'Notas de formato/producción para el equipo creativo',
                    },
                    hashtags_suggested: {
                      type: 'string',
                      description: 'Hashtags sugeridos separados por espacio',
                    },
                    key_message: {
                      type: 'string',
                      description:
                        'Mensaje clave que la pieza debe comunicar, alineado a la estrategia',
                    },
                  },
                  required: [
                    'scheduled_date',
                    'item_type',
                    'pillar_name',
                    'pillar_index',
                    'title',
                    'hook',
                    'body_copy_suggestion',
                    'cta',
                    'format_notes',
                    'key_message',
                  ],
                },
              },
            },
            required: ['items'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'save_schedule_items' },
      messages: [{ role: 'user', content: userMessage }],
    });
    const durationMs = Date.now() - startTime;

    // 8. Extraer el tool_use block
    const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new Error('Claude no usó la herramienta save_schedule_items');
    }

    const parsedData = toolUseBlock.input as { items: ClaudeScheduleItem[] };

    // 9. Validar estructura con Zod
    const validation = claudeScheduleResponseSchema.safeParse(parsedData);
    if (!validation.success) {
      console.error(
        '[generateScheduleCore] Tool use no cumple schema:',
        validation.error
      );
      throw new Error(
        `Formato inválido: ${validation.error.errors[0].message}`
      );
    }

    const items = validation.data.items;

    // 10. Insertar los schedule_items
    const itemsToInsert = items.map((item, idx) => ({
      schedule_id: schedule.id,
      scheduled_date: item.scheduled_date,
      scheduled_time: item.scheduled_time ?? null,
      item_type: item.item_type,
      pillar_name: item.pillar_name,
      pillar_index: item.pillar_index,
      title: item.title,
      hook: item.hook,
      body_copy_suggestion: item.body_copy_suggestion,
      cta: item.cta,
      format_notes: item.format_notes,
      hashtags_suggested: item.hashtags_suggested ?? null,
      key_message: item.key_message,
      status: 'draft' as const,
      position: idx,
    }));

    const { error: itemsError } = await supabase
      .from('schedule_items')
      .insert(itemsToInsert);

    if (itemsError) {
      throw new Error(`Error guardando las piezas: ${itemsError.message}`);
    }

    // 11. Marcar schedule como 'ready'
    const { error: updateError } = await supabase
      .from('schedules')
      .update({
        status: 'ready',
        ai_model_used: STRATEGY_MODEL,
        generation_tokens_input: response.usage.input_tokens,
        generation_tokens_output: response.usage.output_tokens,
        generation_duration_ms: durationMs,
        generated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', schedule.id);

    if (updateError) {
      throw new Error(
        `Piezas guardadas pero falló actualizar el cronograma: ${updateError.message}`
      );
    }

    console.log(
      `[generateScheduleCore] OK. Schedule ${schedule.id}: ${items.length} piezas, tokens ${response.usage.input_tokens}/${response.usage.output_tokens}, ${durationMs}ms`
    );

    // 12. Return success
    return {
      success: true,
      scheduleId: schedule.id,
      itemsGenerated: items.length,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      durationMs,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Error desconocido';

    await supabase
      .from('schedules')
      .update({
        status: 'failed',
        error_message: errorMessage.slice(0, 1000),
        generation_duration_ms: Date.now() - startTime,
      })
      .eq('id', schedule.id);

    console.error('[generateScheduleCore] Error:', err);
    return { error: errorMessage };
  }
}
