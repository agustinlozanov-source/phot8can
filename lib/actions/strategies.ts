'use server';

import Anthropic from '@anthropic-ai/sdk';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateStrategyCore, extractJSON, transcriptToText } from '@/lib/strategy-generator';
import type {
  InterviewTurn,
  StrategyLayerKind,
  StrategyLayer,
} from '@/lib/types/database';

// ============================================================
// CONFIGURACIÓN DEL MODELO DE IA
// ============================================================

const STRATEGY_MODEL = 'claude-sonnet-4-6';
const MAX_REGENERATION_TOKENS = 4000;

// ============================================================
// SCHEMAS
// ============================================================

const updateLayerSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  content_html: z.string().min(1).max(50000).optional(),
});

const regenerateLayerSchema = z.object({
  layer_id: z.string().uuid(),
  feedback: z.string().min(10, 'El feedback debe ser específico (mín. 10 caracteres)').max(2000),
});

const claudeRegenerationResponseSchema = z.object({
  content_html: z.string().min(1).max(20000),
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

// ============================================================
// HELPER: PARSEAR JSON DE CLAUDE
// ============================================================

// Re-exportados desde strategy-generator para uso interno
// extractJSON y transcriptToText vienen del import de arriba

// ============================================================
// GENERAR ESTRATEGIA DESDE ENTREVISTA (llama a Claude)
// ============================================================

export async function generateStrategyFromInterviewAction(payload: {
  interview_id: string;
}) {
  // Delega al core (sin dependencias Next.js) y agrega revalidatePath al finalizar
  const result = await generateStrategyCore(payload);

  if (result.success && result.strategyId) {
    revalidatePath('/strategy');
    revalidatePath('/strategy/strategies');
    revalidatePath(`/strategy/strategies/${result.strategyId}`);
  }

  return result;
}

// ============================================================
// EDITAR UNA CAPA (título o contenido)
// ============================================================

export async function updateLayerAction(payload: {
  id: string;
  title?: string;
  content_html?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = updateLayerSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { id: _, ...updateData } = validation.data;

  // Si se está editando, cambia status a 'edited' (a menos que ya estuviera approved)
  const { data: current } = await ctx.supabase
    .from('strategy_layers')
    .select('status, strategy_id')
    .eq('id', payload.id)
    .maybeSingle();

  if (!current) return { error: 'Capa no encontrada' };

  // Si estaba aprobada y la editan, vuelve a 'edited' (debe re-aprobarse)
  const newStatus = current.status === 'approved' ? 'edited' : current.status;

  const { error } = await ctx.supabase
    .from('strategy_layers')
    .update({
      ...updateData,
      status: newStatus,
      ...(current.status === 'approved' && {
        reviewed_by: null,
        reviewed_at: null,
      }),
    })
    .eq('id', payload.id);

  if (error) {
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath(`/strategy/strategies/${current.strategy_id}`);
  return { success: true };
}

// ============================================================
// APROBAR UNA CAPA
// ============================================================

export async function approveLayerAction(layerId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: layer } = await ctx.supabase
    .from('strategy_layers')
    .select('strategy_id')
    .eq('id', layerId)
    .maybeSingle();

  if (!layer) return { error: 'Capa no encontrada' };

  const { error } = await ctx.supabase
    .from('strategy_layers')
    .update({
      status: 'approved',
      reviewed_by: ctx.isSuperAdmin ? null : ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', layerId);

  if (error) {
    return { error: `Error al aprobar: ${error.message}` };
  }

  revalidatePath(`/strategy/strategies/${layer.strategy_id}`);
  return { success: true };
}

// ============================================================
// DESAPROBAR (revertir aprobación de una capa)
// ============================================================

export async function unapproveLayerAction(layerId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: layer } = await ctx.supabase
    .from('strategy_layers')
    .select('strategy_id, status')
    .eq('id', layerId)
    .maybeSingle();

  if (!layer) return { error: 'Capa no encontrada' };

  if (layer.status !== 'approved') {
    return { error: 'Esta capa no está aprobada' };
  }

  const { error } = await ctx.supabase
    .from('strategy_layers')
    .update({
      status: 'edited',
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq('id', layerId);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath(`/strategy/strategies/${layer.strategy_id}`);
  return { success: true };
}

// ============================================================
// REGENERAR UNA CAPA CON FEEDBACK (llama a Claude)
// ============================================================

export async function regenerateLayerAction(payload: {
  layer_id: string;
  feedback: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = regenerateLayerSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // 1. Cargar la capa actual
  const { data: currentLayer } = await ctx.supabase
    .from('strategy_layers')
    .select('id, kind, title, content_html, strategy_id, regeneration_count')
    .eq('id', validation.data.layer_id)
    .maybeSingle();

  if (!currentLayer) return { error: 'Capa no encontrada' };

  // 2. Cargar la estrategia, su entrevista y otras capas aprobadas (para contexto)
  const { data: strategy } = await ctx.supabase
    .from('strategies')
    .select('id, organization_id, client_id, interview_id, title')
    .eq('id', currentLayer.strategy_id)
    .maybeSingle();

  if (!strategy) return { error: 'Estrategia no encontrada' };

  // 3. Cargar transcript de la entrevista
  let transcriptText = '';
  if (strategy.interview_id) {
    const { data: interview } = await ctx.supabase
      .from('interviews')
      .select('transcript')
      .eq('id', strategy.interview_id)
      .maybeSingle();

    if (interview) {
      const transcript = (interview.transcript as InterviewTurn[]) || [];
      transcriptText = transcriptToText(transcript);
    }
  }

  // 4. Cargar otras capas aprobadas (contexto para consistencia)
  const { data: otherLayers } = await ctx.supabase
    .from('strategy_layers')
    .select('kind, title, content_html, status')
    .eq('strategy_id', strategy.id)
    .neq('id', currentLayer.id);

  const approvedLayers = (otherLayers || []).filter(
    (l) => l.status === 'approved'
  );

  // 5. Cargar prompts de la organización
  const { data: prompts } = await ctx.supabase
    .from('strategy_prompts')
    .select('layer_regeneration_prompt')
    .eq('organization_id', strategy.organization_id)
    .maybeSingle();

  if (!prompts) {
    return { error: 'No hay configuración de prompts' };
  }

  try {
    // 6. Construir el mensaje
    const userMessage = `# Información del contexto

## Transcripción de la entrevista original
${transcriptText || '(no hay transcripción disponible)'}

## Capas aprobadas hasta ahora (para mantener consistencia)
${
  approvedLayers.length === 0
    ? '(ninguna capa aprobada todavía)'
    : approvedLayers
        .map(
          (l) => `### ${l.title}\n${l.content_html}`
        )
        .join('\n\n')
}

## Capa actual que vas a reemplazar
**Tipo:** ${currentLayer.kind}
**Título:** ${currentLayer.title}

**Contenido actual:**
${currentLayer.content_html}

## Feedback del estratega
${validation.data.feedback}

---

Genera la nueva versión de esta capa incorporando el feedback. Devuelve solo el JSON con la estructura: { "content_html": "..." }`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: STRATEGY_MODEL,
      max_tokens: MAX_REGENERATION_TOKENS,
      system: prompts.layer_regeneration_prompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // 7. Parsear respuesta
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude no devolvió contenido');
    }

    const jsonText = extractJSON(textBlock.text);
    const parsedData = JSON.parse(jsonText);

    const validationResult = claudeRegenerationResponseSchema.safeParse(parsedData);
    if (!validationResult.success) {
      throw new Error('Claude devolvió formato inválido');
    }

    // 8. Actualizar la capa (sin tocar ai_draft_content que es el original)
    const { error } = await ctx.supabase
      .from('strategy_layers')
      .update({
        content_html: validationResult.data.content_html,
        status: 'edited',
        regeneration_feedback: validation.data.feedback,
        regenerated_at: new Date().toISOString(),
        regeneration_count: (currentLayer.regeneration_count || 0) + 1,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq('id', currentLayer.id);

    if (error) {
      throw new Error(`Error guardando: ${error.message}`);
    }

    revalidatePath(`/strategy/strategies/${currentLayer.strategy_id}`);

    return {
      success: true,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
    };
  } catch (err) {
    console.error('[regenerateLayer] Error:', err);
    return {
      error: err instanceof Error ? err.message : 'Error al regenerar',
    };
  }
}

// ============================================================
// ENVIAR ESTRATEGIA AL CLIENTE
// ============================================================

export async function sendStrategyToClientAction(strategyId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // 1. Verificar que TODAS las capas estén aprobadas
  const { data: layers } = await ctx.supabase
    .from('strategy_layers')
    .select('id, status, title')
    .eq('strategy_id', strategyId);

  if (!layers || layers.length === 0) {
    return { error: 'La estrategia no tiene capas' };
  }

  const notApproved = layers.filter((l) => l.status !== 'approved');
  if (notApproved.length > 0) {
    const names = notApproved.map((l) => l.title).join(', ');
    return {
      error: `Estas capas aún no están aprobadas: ${names}`,
    };
  }

  // 2. Cargar strategy
  const { data: strategy } = await ctx.supabase
    .from('strategies')
    .select('id, status, public_access_token')
    .eq('id', strategyId)
    .maybeSingle();

  if (!strategy) return { error: 'Estrategia no encontrada' };

  if (!['draft', 'review'].includes(strategy.status)) {
    return {
      error: `No se puede enviar una estrategia en estado ${strategy.status}`,
    };
  }

  // 3. Generar token si no existe
  let token = strategy.public_access_token;
  if (!token) {
    const { data: newToken } = await ctx.supabase.rpc('generate_share_token');
    if (!newToken) {
      return { error: 'Error generando token de acceso' };
    }
    token = newToken;
  }

  // 4. Actualizar estado
  const { error } = await ctx.supabase
    .from('strategies')
    .update({
      status: 'sent',
      public_access_token: token,
      sent_to_client_at: new Date().toISOString(),
    })
    .eq('id', strategyId);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/strategy');
  revalidatePath(`/strategy/strategies/${strategyId}`);
  return { success: true, token };
}

// ============================================================
// ARCHIVAR ESTRATEGIA (versión vieja)
// ============================================================

export async function archiveStrategyAction(strategyId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('strategies')
    .update({ status: 'archived' })
    .eq('id', strategyId);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/strategy');
  revalidatePath(`/strategy/strategies/${strategyId}`);
  return { success: true };
}

// ============================================================
// PÚBLICO: MARCAR COMO VISTA (cliente abre el link)
// ============================================================

export async function markStrategyAsViewedPublicAction(token: string) {
  const supabase = await createServiceClient();

  await supabase.rpc('mark_strategy_as_viewed', { p_token: token });

  return { success: true };
}

// ============================================================
// PÚBLICO: CLIENTE APRUEBA LA ESTRATEGIA
// ============================================================

export async function approveStrategyPublicAction(payload: {
  token: string;
  approved_by_name: string;
}) {
  if (!payload.approved_by_name || payload.approved_by_name.trim().length < 2) {
    return { error: 'Por favor escribe tu nombre completo' };
  }

  const supabase = await createServiceClient();

  const { data: strategy } = await supabase
    .from('strategies')
    .select('id, status')
    .eq('public_access_token', payload.token)
    .maybeSingle();

  if (!strategy) return { error: 'Estrategia no encontrada' };

  if (!['sent', 'viewed'].includes(strategy.status)) {
    return {
      error:
        'Esta estrategia no se puede aprobar en este momento. Contacta a tu agencia.',
    };
  }

  const { error } = await supabase
    .from('strategies')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      approved_by_name: payload.approved_by_name.trim(),
    })
    .eq('id', strategy.id);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  return { success: true };
}

// ============================================================
// PÚBLICO: CLIENTE RECHAZA LA ESTRATEGIA
// ============================================================

export async function rejectStrategyPublicAction(payload: {
  token: string;
  reason: string;
}) {
  if (!payload.reason || payload.reason.trim().length < 10) {
    return {
      error:
        'Por favor explica qué quisieras que ajustemos (mínimo 10 caracteres)',
    };
  }

  const supabase = await createServiceClient();

  const { data: strategy } = await supabase
    .from('strategies')
    .select('id, status')
    .eq('public_access_token', payload.token)
    .maybeSingle();

  if (!strategy) return { error: 'Estrategia no encontrada' };

  if (!['sent', 'viewed'].includes(strategy.status)) {
    return {
      error: 'Esta estrategia no se puede modificar en este momento',
    };
  }

  const { error } = await supabase
    .from('strategies')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      rejection_reason: payload.reason.trim(),
    })
    .eq('id', strategy.id);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  return { success: true };
}
