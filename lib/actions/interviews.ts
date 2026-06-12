'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { InterviewMode, InterviewTurn } from '@/lib/types/database';

// ============================================================
// SCHEMAS
// ============================================================

const createInterviewSchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  contact_id: z.string().uuid().optional().nullable(),
  mode: z.enum(['voice', 'text']),
});

const appendTurnSchema = z.object({
  token: z.string().min(10),
  role: z.enum(['assistant', 'user']),
  content: z.string().min(1).max(50000),
});

// ============================================================
// HELPER DE CONTEXTO
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

// ============================================================
// CREAR ENTREVISTA (genera token público)
// ============================================================

export async function createInterviewAction(payload: {
  client_id: string;
  contact_id?: string | null;
  mode: InterviewMode;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = createInterviewSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  // 1. Verificar que el cliente exista y pertenezca a la org
  const { data: client } = await ctx.supabase
    .from('clients')
    .select('id, organization_id, name')
    .eq('id', validation.data.client_id)
    .maybeSingle();

  if (!client || client.organization_id !== orgId) {
    return { error: 'Cliente no válido' };
  }

  // 2. Cargar el prompt del sistema de la organización
  const { data: promptConfig } = await ctx.supabase
    .from('strategy_prompts')
    .select('interview_system_prompt')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!promptConfig) {
    return {
      error:
        'No hay configuración de prompts para esta organización. Contacta a soporte.',
    };
  }

  // 3. Generar token público URL-safe
  const { data: tokenResult } = await ctx.supabase.rpc(
    'generate_share_token'
  );

  if (!tokenResult) {
    return { error: 'Error al generar token de acceso' };
  }

  // 4. Insertar entrevista
  const { data: newInterview, error: insertError } = await ctx.supabase
    .from('interviews')
    .insert({
      organization_id: orgId,
      client_id: validation.data.client_id,
      contact_id: validation.data.contact_id || null,
      mode: validation.data.mode,
      status: 'pending',
      public_access_token: tokenResult,
      system_prompt_snapshot: promptConfig.interview_system_prompt,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id, public_access_token')
    .single();

  if (insertError) {
    return { error: `Error al crear entrevista: ${insertError.message}` };
  }

  revalidatePath('/strategy');
  revalidatePath('/strategy/interviews');
  return {
    success: true,
    interviewId: newInterview.id,
    token: newInterview.public_access_token,
  };
}

// ============================================================
// CANCELAR ENTREVISTA (antes de empezar)
// ============================================================

export async function cancelInterviewAction(interviewId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: interview } = await ctx.supabase
    .from('interviews')
    .select('id, status')
    .eq('id', interviewId)
    .maybeSingle();

  if (!interview) return { error: 'Entrevista no encontrada' };

  if (interview.status === 'completed') {
    return {
      error:
        'No se puede cancelar una entrevista completada. Si quieres descartarla, elimínala.',
    };
  }

  if (interview.status === 'cancelled') {
    return { error: 'Esta entrevista ya está cancelada' };
  }

  const { error } = await ctx.supabase
    .from('interviews')
    .update({ status: 'cancelled' })
    .eq('id', interviewId);

  if (error) {
    return { error: `Error al cancelar: ${error.message}` };
  }

  revalidatePath('/strategy');
  revalidatePath('/strategy/interviews');
  revalidatePath(`/strategy/interviews/${interviewId}`);
  return { success: true };
}

// ============================================================
// ELIMINAR ENTREVISTA (permanente)
// ============================================================

export async function deleteInterviewAction(interviewId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // Verificar que no haya estrategias asociadas
  const { count } = await ctx.supabase
    .from('strategies')
    .select('*', { count: 'exact', head: true })
    .eq('interview_id', interviewId);

  if (count && count > 0) {
    return {
      error: `No se puede eliminar: existen ${count} estrategias generadas a partir de esta entrevista. Archívalas primero.`,
    };
  }

  const { error } = await ctx.supabase
    .from('interviews')
    .delete()
    .eq('id', interviewId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath('/strategy/interviews');
  return { success: true };
}

// ============================================================
// PÚBLICO: INICIAR ENTREVISTA (cliente abre el link)
// ============================================================

export async function startInterviewPublicAction(token: string) {
  // Cliente público sin auth → usar service client (bypass RLS)
  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from('interviews')
    .select('id, status, mode, system_prompt_snapshot, organization_id, client_id')
    .eq('public_access_token', token)
    .maybeSingle();

  if (!interview) {
    return { error: 'Entrevista no encontrada' };
  }

  if (interview.status === 'cancelled') {
    return { error: 'Esta entrevista fue cancelada' };
  }

  if (interview.status === 'completed' || interview.status === 'processing') {
    return { error: 'Esta entrevista ya fue completada' };
  }

  // Cargar info del cliente para personalizar saludo
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', interview.client_id)
    .maybeSingle();

  // Cargar nombre del entrevistador (de los prompts de la org)
  const { data: prompts } = await supabase
    .from('strategy_prompts')
    .select('interviewer_name')
    .eq('organization_id', interview.organization_id)
    .maybeSingle();

  // Si está pending, marcar como in_progress
  if (interview.status === 'pending') {
    await supabase
      .from('interviews')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', interview.id);
  }

  return {
    success: true,
    interview: {
      id: interview.id,
      mode: interview.mode,
      system_prompt: interview.system_prompt_snapshot,
      client_name: client?.name || 'el negocio',
      interviewer_name: prompts?.interviewer_name || 'Lía',
    },
  };
}

// ============================================================
// PÚBLICO: AGREGAR TURNO AL TRANSCRIPT
// ============================================================

export async function appendTurnPublicAction(payload: {
  token: string;
  role: 'assistant' | 'user';
  content: string;
}) {
  const validation = appendTurnSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const supabase = await createServiceClient();

  // Cargar entrevista actual
  const { data: interview } = await supabase
    .from('interviews')
    .select('id, status, transcript')
    .eq('public_access_token', validation.data.token)
    .maybeSingle();

  if (!interview) return { error: 'Entrevista no encontrada' };

  if (interview.status !== 'in_progress') {
    return { error: 'Esta entrevista no está activa' };
  }

  // Agregar nuevo turno al array existente
  const currentTranscript = (interview.transcript as InterviewTurn[]) || [];
  const newTurn: InterviewTurn = {
    role: validation.data.role,
    content: validation.data.content,
    at: new Date().toISOString(),
  };

  const newTranscript = [...currentTranscript, newTurn];

  const { error } = await supabase
    .from('interviews')
    .update({ transcript: newTranscript })
    .eq('id', interview.id);

  if (error) {
    return { error: `Error al guardar turno: ${error.message}` };
  }

  return { success: true, turnCount: newTranscript.length };
}

// ============================================================
// PÚBLICO: COMPLETAR ENTREVISTA
// ============================================================

export async function completeInterviewPublicAction(token: string) {
  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from('interviews')
    .select('id, status, started_at, transcript, organization_id, client_id')
    .eq('public_access_token', token)
    .maybeSingle();

  if (!interview) return { error: 'Entrevista no encontrada' };

  if (interview.status !== 'in_progress') {
    return { error: 'Esta entrevista no se puede completar en su estado actual' };
  }

  const transcript = (interview.transcript as InterviewTurn[]) || [];
  if (transcript.length < 4) {
    return {
      error:
        'La entrevista es muy corta para procesar (mínimo 4 turnos). Continúa la conversación.',
    };
  }

  const now = new Date();
  const startedAt = interview.started_at
    ? new Date(interview.started_at)
    : now;
  const durationSeconds = Math.round(
    (now.getTime() - startedAt.getTime()) / 1000
  );

  // Marcar como completed
  const { error } = await supabase
    .from('interviews')
    .update({
      status: 'completed',
      completed_at: now.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('id', interview.id);

  if (error) {
    return { error: `Error al completar: ${error.message}` };
  }

  // ⚠️ El procesamiento automático con Claude lo dispararemos en el Bloque 6
  // Por ahora solo dejamos la entrevista en estado 'completed'
  // En el Bloque 6 agregamos llamada a generateStrategyFromInterviewAction()

  return {
    success: true,
    interviewId: interview.id,
    turnCount: transcript.length,
    durationSeconds,
  };
}

// ============================================================
// PÚBLICO: ABANDONAR (cliente cierra sin terminar)
// ============================================================

export async function abandonInterviewPublicAction(token: string) {
  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from('interviews')
    .select('id, status, transcript')
    .eq('public_access_token', token)
    .maybeSingle();

  if (!interview) return { error: 'Entrevista no encontrada' };

  // Si está in_progress y tiene contenido, marcamos failed para no perder lo registrado
  // Si está in_progress y sin contenido, regresamos a pending para que pueda reabrirse
  if (interview.status === 'in_progress') {
    const transcript = (interview.transcript as InterviewTurn[]) || [];

    if (transcript.length === 0) {
      // Regresamos a pending — todavía puede empezar
      await supabase
        .from('interviews')
        .update({ status: 'pending', started_at: null })
        .eq('id', interview.id);
    }
    // Si tiene contenido, lo dejamos in_progress para que pueda continuar al reabrir
  }

  return { success: true };
}

// ============================================================
// REGENERAR TOKEN PÚBLICO (si se compromete)
// ============================================================

export async function regenerateInterviewTokenAction(interviewId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: newToken } = await ctx.supabase.rpc('generate_share_token');

  if (!newToken) {
    return { error: 'Error al generar token' };
  }

  const { error } = await ctx.supabase
    .from('interviews')
    .update({ public_access_token: newToken })
    .eq('id', interviewId);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath(`/strategy/interviews/${interviewId}`);
  return { success: true, token: newToken };
}
