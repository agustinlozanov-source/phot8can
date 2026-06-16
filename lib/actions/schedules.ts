'use server';

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// CONFIGURACIÓN DEL MODELO DE IA
// ============================================================

const STRATEGY_MODEL = 'claude-sonnet-4-6';
const MAX_REGENERATION_TOKENS = 2000;

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
// SCHEMAS
// ============================================================

const createScheduleSchema = z.object({
  subscription_period_id: z.string().uuid(),
  days_planned: z.number().int().min(1).max(90).default(30),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generation_notes: z.string().max(1000).optional(),
});

const regenerateItemSchema = z.object({
  item_id: z.string().uuid(),
  feedback: z
    .string()
    .min(5, 'El feedback debe ser específico (mín. 5 caracteres)')
    .max(500),
});

const rejectItemSchema = z.object({
  item_id: z.string().uuid(),
  reason: z.string().min(5, 'Indica el motivo (mín. 5 caracteres)').max(500),
});

const updateItemSchema = z.object({
  item_id: z.string().uuid(),
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  scheduled_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  item_type: z.enum(ITEM_TYPES).optional(),
  title: z.string().min(1).max(300).optional(),
  hook: z.string().max(2000).optional().nullable(),
  body_copy_suggestion: z.string().max(5000).optional().nullable(),
  cta: z.string().max(1000).optional().nullable(),
  format_notes: z.string().max(2000).optional().nullable(),
  hashtags_suggested: z.string().max(2000).optional().nullable(),
  key_message: z.string().max(2000).optional().nullable(),
});

const claudeRegenerationResponseSchema = z.object({
  title: z.string().min(1).max(300),
  hook: z.string().max(2000),
  body_copy_suggestion: z.string().max(5000),
  cta: z.string().max(1000),
  format_notes: z.string().max(2000),
  hashtags_suggested: z.string().max(2000).optional().nullable(),
  key_message: z.string().min(1).max(2000),
});

// ============================================================
// HELPER DE CONTEXTO (auth)
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

    return {
      isSuperAdmin: true as const,
      supabase,
      impersonatingOrgId,
    };
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

/**
 * Verifica un permiso usando el contexto activo (roles/permisos reales).
 * Import dinámico para no acoplar el módulo de actions a auth/context.
 */
async function checkPermission(code: string): Promise<boolean> {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return hasPermission(authCtx, code);
}

// ============================================================
// 🌟 CREAR CRONOGRAMA Y DISPARAR GENERACIÓN EN BACKGROUND
// ============================================================

export async function createScheduleAction(payload: {
  subscription_period_id: string;
  days_planned?: number;
  start_date: string;
  generation_notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // 1. Permiso
  if (!(await checkPermission('schedules.manage'))) {
    return { error: 'No tienes permiso para gestionar cronogramas' };
  }

  const validation = createScheduleSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // 2. Cargar el período y verificar estado
  const { data: period } = await ctx.supabase
    .from('subscription_periods')
    .select('id, subscription_id, status')
    .eq('id', validation.data.subscription_period_id)
    .maybeSingle();

  if (!period) return { error: 'Período no encontrado' };

  if (period.status !== 'active') {
    return {
      error: `Solo se puede generar cronograma para un período activo (actual: ${period.status})`,
    };
  }

  // 3. Cargar suscripción → verificar organización y obtener cliente
  const { data: subscription } = await ctx.supabase
    .from('client_subscriptions')
    .select('id, organization_id, client_id')
    .eq('id', period.subscription_id)
    .maybeSingle();

  if (!subscription) return { error: 'Suscripción no encontrada' };
  if (subscription.organization_id !== orgId) {
    return { error: 'Este período no pertenece a tu organización' };
  }

  // 4. Verificar que NO exista ya un cronograma para este período
  const { data: existing } = await ctx.supabase
    .from('schedules')
    .select('id, status')
    .eq('subscription_period_id', period.id)
    .maybeSingle();

  if (existing) {
    return {
      error: `Este período ya tiene un cronograma (estado: ${existing.status}). Bórralo si quieres regenerarlo.`,
    };
  }

  // 5. Verificar que el cliente tenga una estrategia aprobada
  const { data: strategy } = await ctx.supabase
    .from('strategies')
    .select('id')
    .eq('organization_id', orgId)
    .eq('client_id', subscription.client_id)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();

  if (!strategy) {
    return {
      error:
        'El cliente necesita una estrategia aprobada antes de generar cronograma',
    };
  }

  // 6. Crear el schedule en estado 'pending'
  const { data: newSchedule, error: insertError } = await ctx.supabase
    .from('schedules')
    .insert({
      organization_id: orgId,
      subscription_period_id: period.id,
      status: 'pending',
      days_planned: validation.data.days_planned,
      start_date: validation.data.start_date,
      generation_notes: validation.data.generation_notes?.trim() || null,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (insertError || !newSchedule) {
    return { error: `Error al crear cronograma: ${insertError?.message}` };
  }

  // 7. Disparar el background function (fire-and-forget)
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || '';
  fetch(`${siteUrl}/.netlify/functions/generate-schedule-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedule_id: newSchedule.id }),
  }).catch((err) => {
    console.error('[createSchedule] Error disparando background:', err);
  });

  // 8. Revalidar rutas relevantes
  revalidatePath('/schedule');
  revalidatePath(`/subscriptions/${subscription.id}`);
  revalidatePath(`/schedule/${newSchedule.id}`);

  return { success: true, scheduleId: newSchedule.id };
}

// ============================================================
// 🌟 REGENERAR UNA PIEZA INDIVIDUAL CON FEEDBACK (SÍNCRONO)
// ============================================================

export async function regenerateScheduleItemAction(payload: {
  item_id: string;
  feedback: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('schedules.regenerate_ai'))) {
    return { error: 'No tienes permiso para regenerar piezas con IA' };
  }

  const validation = regenerateItemSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // 1. Cargar el item completo
  const { data: item } = await ctx.supabase
    .from('schedule_items')
    .select(
      'id, schedule_id, status, scheduled_date, scheduled_time, item_type, pillar_name, pillar_index, title, hook, body_copy_suggestion, cta, format_notes, hashtags_suggested, key_message, regenerated_count'
    )
    .eq('id', validation.data.item_id)
    .maybeSingle();

  if (!item) return { error: 'Pieza no encontrada' };

  if (item.status !== 'draft') {
    return {
      error: 'Solo se pueden regenerar piezas en borrador (no aprobadas)',
    };
  }

  // 2. Cargar schedule → período → suscripción → cliente
  const { data: schedule } = await ctx.supabase
    .from('schedules')
    .select('id, organization_id, subscription_period_id')
    .eq('id', item.schedule_id)
    .maybeSingle();

  if (!schedule) return { error: 'Cronograma no encontrado' };
  if (schedule.organization_id !== orgId) {
    return { error: 'Esta pieza no pertenece a tu organización' };
  }

  const { data: period } = await ctx.supabase
    .from('subscription_periods')
    .select('id, subscription_id')
    .eq('id', schedule.subscription_period_id)
    .maybeSingle();

  if (!period) return { error: 'Período no encontrado' };

  const { data: subscription } = await ctx.supabase
    .from('client_subscriptions')
    .select('id, client_id')
    .eq('id', period.subscription_id)
    .maybeSingle();

  if (!subscription) return { error: 'Suscripción no encontrada' };

  const { data: client } = await ctx.supabase
    .from('clients')
    .select('id, name, legal_name')
    .eq('id', subscription.client_id)
    .maybeSingle();

  // 3. Estrategia aprobada + capas (contexto para mantener tono/voz)
  const { data: strategy } = await ctx.supabase
    .from('strategies')
    .select('id')
    .eq('organization_id', orgId)
    .eq('client_id', subscription.client_id)
    .eq('status', 'approved')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let layersBlock = '(sin estrategia disponible)';
  if (strategy) {
    const { data: layers } = await ctx.supabase
      .from('strategy_layers')
      .select('kind, title, content_html, layer_order')
      .eq('strategy_id', strategy.id)
      .order('layer_order');

    if (layers && layers.length > 0) {
      layersBlock = layers
        .map((l) => `## ${l.title} (${l.kind})\n${l.content_html}`)
        .join('\n\n');
    }
  }

  try {
    // 4. Construir el prompt
    const systemPrompt = `Eres un experto en estrategia de contenido digital. Tu tarea es regenerar el brief de UNA sola pieza de contenido, incorporando el feedback del Director de la cuenta, sin perder coherencia con la estrategia aprobada del cliente.

Mantén el tono y la voz definidos en la estrategia. NO cambies la fecha, la hora, el pilar ni el tipo de pieza: solo reescribes el brief (título, hook, copy, CTA, notas de formato, hashtags y mensaje clave).

# Cliente
${client?.name ?? 'Cliente'}${client?.legal_name ? ` (${client.legal_name})` : ''}

# Estrategia aprobada del cliente
${layersBlock}

Devuelve el resultado usando la herramienta regenerate_item.`;

    const userMessage = `Tienes que reemplazar esta pieza del cronograma (mantén fecha, hora, pilar y tipo):

- Fecha: ${item.scheduled_date}${item.scheduled_time ? ` ${item.scheduled_time}` : ''}
- Tipo: ${item.item_type}
- Pilar: ${item.pillar_name} (índice ${item.pillar_index})

Brief actual:
- Título: ${item.title}
- Hook: ${item.hook ?? ''}
- Copy: ${item.body_copy_suggestion ?? ''}
- CTA: ${item.cta ?? ''}
- Notas de formato: ${item.format_notes ?? ''}
- Hashtags: ${item.hashtags_suggested ?? ''}
- Mensaje clave: ${item.key_message ?? ''}

El Director pide ajustar: ${validation.data.feedback}

Genera la nueva versión del brief usando la herramienta regenerate_item.`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: STRATEGY_MODEL,
      max_tokens: MAX_REGENERATION_TOKENS,
      system: systemPrompt,
      tools: [
        {
          name: 'regenerate_item',
          description: 'Guarda el nuevo brief de la pieza de contenido',
          input_schema: {
            type: 'object',
            properties: {
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
                description: 'Llamado a la acción',
              },
              format_notes: {
                type: 'string',
                description: 'Notas de formato/producción para el equipo',
              },
              hashtags_suggested: {
                type: 'string',
                description: 'Hashtags sugeridos separados por espacio',
              },
              key_message: {
                type: 'string',
                description:
                  'Mensaje clave alineado a la estrategia del cliente',
              },
            },
            required: [
              'title',
              'hook',
              'body_copy_suggestion',
              'cta',
              'format_notes',
              'key_message',
            ],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'regenerate_item' },
      messages: [{ role: 'user', content: userMessage }],
    });

    // 5. Extraer el tool_use
    const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new Error('Claude no usó la herramienta regenerate_item');
    }

    const validationResult = claudeRegenerationResponseSchema.safeParse(
      toolUseBlock.input
    );
    if (!validationResult.success) {
      throw new Error('Claude devolvió un formato inválido');
    }

    const data = validationResult.data;

    // 6. Actualizar el item
    const { error } = await ctx.supabase
      .from('schedule_items')
      .update({
        title: data.title,
        hook: data.hook,
        body_copy_suggestion: data.body_copy_suggestion,
        cta: data.cta,
        format_notes: data.format_notes,
        hashtags_suggested: data.hashtags_suggested ?? null,
        key_message: data.key_message,
        regenerated_count: (item.regenerated_count || 0) + 1,
        last_regenerated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      throw new Error(`Error guardando: ${error.message}`);
    }

    revalidatePath(`/schedule/${schedule.id}`);

    return {
      success: true,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
    };
  } catch (err) {
    console.error('[regenerateScheduleItem] Error:', err);
    return {
      error: err instanceof Error ? err.message : 'Error al regenerar la pieza',
    };
  }
}

// ============================================================
// APROBAR UNA PIEZA
// ============================================================

export async function approveScheduleItemAction(itemId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('schedules.manage'))) {
    return { error: 'No tienes permiso para gestionar cronogramas' };
  }

  const { data: item } = await ctx.supabase
    .from('schedule_items')
    .select('id, schedule_id, status')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) return { error: 'Pieza no encontrada' };
  if (item.status !== 'draft') {
    return { error: 'Solo se pueden aprobar piezas en borrador' };
  }

  const { error } = await ctx.supabase
    .from('schedule_items')
    .update({
      status: 'approved',
      approved_by: ctx.isSuperAdmin ? null : ctx.userId,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', itemId);

  if (error) return { error: `Error al aprobar: ${error.message}` };

  revalidatePath(`/schedule/${item.schedule_id}`);
  return { success: true };
}

// ============================================================
// RECHAZAR UNA PIEZA
// ============================================================

export async function rejectScheduleItemAction(payload: {
  item_id: string;
  reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('schedules.manage'))) {
    return { error: 'No tienes permiso para gestionar cronogramas' };
  }

  const validation = rejectItemSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { data: item } = await ctx.supabase
    .from('schedule_items')
    .select('id, schedule_id, status')
    .eq('id', validation.data.item_id)
    .maybeSingle();

  if (!item) return { error: 'Pieza no encontrada' };
  if (item.status !== 'draft') {
    return { error: 'Solo se pueden rechazar piezas en borrador' };
  }

  const { error } = await ctx.supabase
    .from('schedule_items')
    .update({
      status: 'rejected',
      rejection_reason: validation.data.reason.trim(),
    })
    .eq('id', validation.data.item_id);

  if (error) return { error: `Error al rechazar: ${error.message}` };

  revalidatePath(`/schedule/${item.schedule_id}`);
  return { success: true };
}

// ============================================================
// DESAPROBAR UNA PIEZA (approved → draft)
// ============================================================

export async function unapproveScheduleItemAction(itemId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('schedules.manage'))) {
    return { error: 'No tienes permiso para gestionar cronogramas' };
  }

  const { data: item } = await ctx.supabase
    .from('schedule_items')
    .select('id, schedule_id, status')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) return { error: 'Pieza no encontrada' };
  if (item.status !== 'approved') {
    return { error: 'Esta pieza no está aprobada' };
  }

  const { error } = await ctx.supabase
    .from('schedule_items')
    .update({
      status: 'draft',
      approved_by: null,
      approved_at: null,
    })
    .eq('id', itemId);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath(`/schedule/${item.schedule_id}`);
  return { success: true };
}

// ============================================================
// EDICIÓN MANUAL DE UNA PIEZA (sin IA)
// ============================================================

export async function updateScheduleItemAction(payload: {
  item_id: string;
  scheduled_date?: string;
  scheduled_time?: string | null;
  item_type?: (typeof ITEM_TYPES)[number];
  title?: string;
  hook?: string | null;
  body_copy_suggestion?: string | null;
  cta?: string | null;
  format_notes?: string | null;
  hashtags_suggested?: string | null;
  key_message?: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('schedules.manage'))) {
    return { error: 'No tienes permiso para gestionar cronogramas' };
  }

  const validation = updateItemSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { item_id, ...updateData } = validation.data;

  if (Object.keys(updateData).length === 0) {
    return { error: 'No hay cambios que guardar' };
  }

  const { data: item } = await ctx.supabase
    .from('schedule_items')
    .select('id, schedule_id, status')
    .eq('id', item_id)
    .maybeSingle();

  if (!item) return { error: 'Pieza no encontrada' };
  if (item.status !== 'draft') {
    return {
      error: 'Solo se editan piezas en borrador; desaprueba la pieza primero',
    };
  }

  const { error } = await ctx.supabase
    .from('schedule_items')
    .update(updateData)
    .eq('id', item_id);

  if (error) return { error: `Error al guardar: ${error.message}` };

  revalidatePath(`/schedule/${item.schedule_id}`);
  return { success: true };
}

// ============================================================
// BORRAR UNA PIEZA
// ============================================================

export async function deleteScheduleItemAction(itemId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('schedules.manage'))) {
    return { error: 'No tienes permiso para gestionar cronogramas' };
  }

  const { data: item } = await ctx.supabase
    .from('schedule_items')
    .select('id, schedule_id, status')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) return { error: 'Pieza no encontrada' };
  if (item.status !== 'draft') {
    return { error: 'Solo se pueden borrar piezas en borrador' };
  }

  const { error } = await ctx.supabase
    .from('schedule_items')
    .delete()
    .eq('id', itemId);

  if (error) return { error: `Error al borrar: ${error.message}` };

  revalidatePath(`/schedule/${item.schedule_id}`);
  return { success: true };
}

// ============================================================
// REINTENTAR UN CRONOGRAMA FALLIDO
// ============================================================

export async function retryFailedScheduleAction(scheduleId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('schedules.manage'))) {
    return { error: 'No tienes permiso para gestionar cronogramas' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: schedule } = await ctx.supabase
    .from('schedules')
    .select('id, organization_id, status, subscription_period_id')
    .eq('id', scheduleId)
    .maybeSingle();

  if (!schedule) return { error: 'Cronograma no encontrado' };
  if (schedule.organization_id !== orgId) {
    return { error: 'Este cronograma no pertenece a tu organización' };
  }
  if (schedule.status !== 'failed') {
    return {
      error: `Solo se reintenta un cronograma fallido (actual: ${schedule.status})`,
    };
  }

  // Volver a 'pending' y limpiar el error
  const { error } = await ctx.supabase
    .from('schedules')
    .update({ status: 'pending', error_message: null })
    .eq('id', schedule.id);

  if (error) return { error: `Error: ${error.message}` };

  // Disparar el background otra vez (fire-and-forget)
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || '';
  fetch(`${siteUrl}/.netlify/functions/generate-schedule-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedule_id: schedule.id }),
  }).catch((err) => {
    console.error('[retryFailedSchedule] Error disparando background:', err);
  });

  revalidatePath('/schedule');
  revalidatePath(`/schedule/${schedule.id}`);
  return { success: true };
}

// ============================================================
// BORRAR UN CRONOGRAMA COMPLETO (cascade borra los items)
// ============================================================

export async function deleteScheduleAction(scheduleId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('schedules.manage'))) {
    return { error: 'No tienes permiso para gestionar cronogramas' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: schedule } = await ctx.supabase
    .from('schedules')
    .select('id, organization_id, subscription_period_id')
    .eq('id', scheduleId)
    .maybeSingle();

  if (!schedule) return { error: 'Cronograma no encontrado' };
  if (schedule.organization_id !== orgId) {
    return { error: 'Este cronograma no pertenece a tu organización' };
  }

  const { error } = await ctx.supabase
    .from('schedules')
    .delete()
    .eq('id', schedule.id);

  if (error) return { error: `Error al borrar: ${error.message}` };

  console.log(
    `[deleteSchedule] Cronograma ${scheduleId} borrado por ${
      ctx.isSuperAdmin ? 'super-admin' : ctx.userId
    }`
  );

  revalidatePath('/schedule');
  return { success: true };
}
