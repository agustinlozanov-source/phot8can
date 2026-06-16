'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database, WorkOrderTaskStatus } from '@/lib/types/database';

type TaskUpdate = Database['public']['Tables']['work_order_tasks']['Update'];

// ============================================================
// CONSTANTES
// ============================================================

const TASK_STATUSES = [
  'pending',
  'in_progress',
  'blocked',
  'done',
  'skipped',
] as const;

// Transiciones explícitas (skipped se permite desde cualquier estado)
const TASK_TRANSITIONS: Record<WorkOrderTaskStatus, WorkOrderTaskStatus[]> = {
  pending: ['in_progress'],
  in_progress: ['blocked', 'done'],
  blocked: ['in_progress'],
  done: ['in_progress'],
  skipped: ['pending'],
};

const DEFAULT_MY_TASK_STATUSES: WorkOrderTaskStatus[] = [
  'pending',
  'in_progress',
  'blocked',
];

// ============================================================
// SCHEMAS
// ============================================================

const assignmentSchema = z.object({
  task_id: z.string().uuid(),
  assigned_to_user_id: z.string().uuid().nullable(),
});

const statusSchema = z.object({
  task_id: z.string().uuid(),
  new_status: z.enum(TASK_STATUSES),
  notes: z.string().max(500).optional(),
});

const notesSchema = z.object({
  task_id: z.string().uuid(),
  notes: z.string().max(2000).nullable(),
});

const hoursSchema = z.object({
  task_id: z.string().uuid(),
  actual_hours: z.number().min(0).max(1000),
});

const blockedSchema = z.object({
  task_id: z.string().uuid(),
  blocked_reason: z
    .string()
    .min(5, 'Indica el motivo del bloqueo (mín. 5 caracteres)')
    .max(500),
});

// ============================================================
// HELPERS
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

async function getAuth() {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return { can: (code: string) => hasPermission(authCtx, code) };
}

type TaskRow = {
  id: string;
  work_order_id: string;
  status: WorkOrderTaskStatus;
  assigned_to_user_id: string | null;
  depends_on_task_id: string | null;
  started_at: string | null;
};

async function loadTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string
): Promise<TaskRow | null> {
  const { data } = await supabase
    .from('work_order_tasks')
    .select(
      'id, work_order_id, status, assigned_to_user_id, depends_on_task_id, started_at'
    )
    .eq('id', taskId)
    .maybeSingle();
  return (data as TaskRow) || null;
}

// ¿El usuario es dueño de la tarea o tiene permiso de gestión?
function ownsOrManages(
  task: TaskRow,
  can: (c: string) => boolean,
  userId: string | undefined
): boolean {
  if (can('work_orders.manage')) return true;
  return !!userId && task.assigned_to_user_id === userId;
}

// ============================================================
// ASIGNAR / REASIGNAR TAREA
// ============================================================

export async function updateTaskAssignmentAction(payload: {
  task_id: string;
  assigned_to_user_id: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = assignmentSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { can } = await getAuth();
  if (!can('work_orders.manage')) {
    return { error: 'No tienes permiso para asignar tareas' };
  }

  const task = await loadTask(ctx.supabase, validation.data.task_id);
  if (!task) return { error: 'Tarea no encontrada' };

  const { error } = await ctx.supabase
    .from('work_order_tasks')
    .update({ assigned_to_user_id: validation.data.assigned_to_user_id })
    .eq('id', task.id);

  if (error) return { error: `Error al asignar: ${error.message}` };

  revalidatePath(`/work-orders/${task.work_order_id}`);
  return { success: true };
}

// ============================================================
// CAMBIAR ESTADO DE TAREA
// ============================================================

export async function updateTaskStatusAction(payload: {
  task_id: string;
  new_status: WorkOrderTaskStatus;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = statusSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const task = await loadTask(ctx.supabase, validation.data.task_id);
  if (!task) return { error: 'Tarea no encontrada' };

  // Permiso: manage, o execute sobre su propia tarea
  const { can } = await getAuth();
  const userId = ctx.isSuperAdmin ? undefined : ctx.userId;
  const allowed =
    can('work_orders.manage') ||
    (can('work_orders.execute') && task.assigned_to_user_id === userId);

  if (!allowed) {
    return { error: 'No tienes permiso para cambiar el estado de esta tarea' };
  }

  const current = task.status;
  const next = validation.data.new_status;

  if (current === next) return { success: true };

  // skipped se permite desde cualquier estado; el resto según el mapa
  const valid = next === 'skipped' || TASK_TRANSITIONS[current].includes(next);
  if (!valid) {
    return { error: `Transición no válida: ${current} → ${next}` };
  }

  // Validar dependencia al pasar a in_progress
  if (next === 'in_progress' && task.depends_on_task_id) {
    const { data: dep } = await ctx.supabase
      .from('work_order_tasks')
      .select('status')
      .eq('id', task.depends_on_task_id)
      .maybeSingle();

    if (dep && dep.status !== 'done') {
      return {
        error:
          'No puedes iniciar esta tarea hasta completar la tarea de la que depende',
      };
    }
  }

  const update: TaskUpdate = { status: next };
  const now = new Date().toISOString();

  if (next === 'in_progress') {
    if (!task.started_at) update.started_at = now;
    update.blocked_reason = null; // si venía de blocked
    update.completed_at = null; // si venía de done
  }
  if (next === 'done') update.completed_at = now;

  if (next === 'blocked') {
    if (!validation.data.notes || validation.data.notes.trim().length < 5) {
      return {
        error:
          'Para bloquear indica el motivo en las notas (mín. 5 caracteres)',
      };
    }
    update.blocked_reason = validation.data.notes.trim();
  }

  const { error } = await ctx.supabase
    .from('work_order_tasks')
    .update(update)
    .eq('id', task.id);

  if (error) return { error: `Error al cambiar estado: ${error.message}` };

  // Al completar, desbloquear las tareas que dependían de esta
  if (next === 'done') {
    await ctx.supabase
      .from('work_order_tasks')
      .update({ status: 'pending', blocked_reason: null })
      .eq('depends_on_task_id', task.id)
      .eq('status', 'blocked');
  }

  revalidatePath(`/work-orders/${task.work_order_id}`);
  revalidatePath('/my-work');
  return { success: true };
}

// ============================================================
// NOTAS DE TAREA
// ============================================================

export async function updateTaskNotesAction(payload: {
  task_id: string;
  notes: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = notesSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const task = await loadTask(ctx.supabase, validation.data.task_id);
  if (!task) return { error: 'Tarea no encontrada' };

  const { can } = await getAuth();
  const userId = ctx.isSuperAdmin ? undefined : ctx.userId;
  if (!ownsOrManages(task, can, userId)) {
    return { error: 'No tienes permiso para editar esta tarea' };
  }

  const { error } = await ctx.supabase
    .from('work_order_tasks')
    .update({ notes: validation.data.notes?.trim() || null })
    .eq('id', task.id);

  if (error) return { error: `Error al guardar notas: ${error.message}` };

  revalidatePath(`/work-orders/${task.work_order_id}`);
  return { success: true };
}

// ============================================================
// HORAS REALES DE TAREA
// ============================================================

export async function updateTaskHoursAction(payload: {
  task_id: string;
  actual_hours: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = hoursSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const task = await loadTask(ctx.supabase, validation.data.task_id);
  if (!task) return { error: 'Tarea no encontrada' };

  const { can } = await getAuth();
  const userId = ctx.isSuperAdmin ? undefined : ctx.userId;
  if (!ownsOrManages(task, can, userId)) {
    return { error: 'No tienes permiso para editar esta tarea' };
  }

  const { error } = await ctx.supabase
    .from('work_order_tasks')
    .update({ actual_hours: validation.data.actual_hours })
    .eq('id', task.id);

  if (error) return { error: `Error al guardar horas: ${error.message}` };

  revalidatePath(`/work-orders/${task.work_order_id}`);
  return { success: true };
}

// ============================================================
// BLOQUEAR TAREA
// ============================================================

export async function setTaskBlockedAction(payload: {
  task_id: string;
  blocked_reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = blockedSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const task = await loadTask(ctx.supabase, validation.data.task_id);
  if (!task) return { error: 'Tarea no encontrada' };

  const { can } = await getAuth();
  const userId = ctx.isSuperAdmin ? undefined : ctx.userId;
  if (!ownsOrManages(task, can, userId)) {
    return { error: 'No tienes permiso para bloquear esta tarea' };
  }

  const { error } = await ctx.supabase
    .from('work_order_tasks')
    .update({
      status: 'blocked',
      blocked_reason: validation.data.blocked_reason.trim(),
    })
    .eq('id', task.id);

  if (error) return { error: `Error al bloquear: ${error.message}` };

  revalidatePath(`/work-orders/${task.work_order_id}`);
  revalidatePath('/my-work');
  return { success: true };
}

// ============================================================
// DESBLOQUEAR TAREA
// ============================================================

export async function unblockTaskAction(taskId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const task = await loadTask(ctx.supabase, taskId);
  if (!task) return { error: 'Tarea no encontrada' };

  if (task.status !== 'blocked') {
    return { error: 'Esta tarea no está bloqueada' };
  }

  const { can } = await getAuth();
  const userId = ctx.isSuperAdmin ? undefined : ctx.userId;
  if (!ownsOrManages(task, can, userId)) {
    return { error: 'No tienes permiso para desbloquear esta tarea' };
  }

  const update: TaskUpdate = {
    status: 'in_progress',
    blocked_reason: null,
  };
  if (!task.started_at) update.started_at = new Date().toISOString();

  const { error } = await ctx.supabase
    .from('work_order_tasks')
    .update(update)
    .eq('id', task.id);

  if (error) return { error: `Error al desbloquear: ${error.message}` };

  revalidatePath(`/work-orders/${task.work_order_id}`);
  revalidatePath('/my-work');
  return { success: true };
}

// ============================================================
// MIS TAREAS
// ============================================================

export async function listMyTasksAction(filters?: {
  status?: WorkOrderTaskStatus[];
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // Super admin no tiene tareas personales
  if (ctx.isSuperAdmin) return { tasks: [] };

  const statuses =
    filters?.status && filters.status.length > 0
      ? filters.status
      : DEFAULT_MY_TASK_STATUSES;

  const { data, error } = await ctx.supabase
    .from('work_order_tasks')
    .select(
      `
      *,
      work_order:work_orders!work_order_tasks_work_order_id_fkey(
        id, folio, title, deadline, status,
        client:clients(id, name)
      )
    `
    )
    .eq('assigned_to_user_id', ctx.userId)
    .in('status', statuses);

  if (error) return { error: `Error al cargar tus tareas: ${error.message}` };

  // Ordenar por deadline de la OT (asc); las sin deadline al final
  const tasks = (data || []).slice().sort((a, b) => {
    const da =
      (a.work_order as unknown as { deadline: string | null } | null)
        ?.deadline ?? '9999-12-31';
    const db =
      (b.work_order as unknown as { deadline: string | null } | null)
        ?.deadline ?? '9999-12-31';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  return { tasks };
}
