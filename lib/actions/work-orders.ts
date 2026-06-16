'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type {
  Database,
  WorkOrderStatus,
  TaskStageType,
  WorkOrderBriefSnapshot,
} from '@/lib/types/database';

type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update'];

// ============================================================
// CONSTANTES
// ============================================================

// Transiciones válidas de estado de una OT
const WO_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  pending: ['in_production', 'cancelled'],
  in_production: ['review', 'ready', 'cancelled'],
  review: ['in_production', 'ready', 'cancelled'],
  ready: ['published', 'cancelled'],
  published: ['ready'],
  cancelled: [],
};

const WO_STATUSES = [
  'pending',
  'in_production',
  'review',
  'ready',
  'published',
  'cancelled',
] as const;

// ============================================================
// SCHEMAS
// ============================================================

const taskOverrideSchema = z.object({
  stage_type: z.enum(['design', 'edit', 'copy', 'review', 'shoot', 'other']),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
  estimated_hours: z.number().min(0).max(100).optional().nullable(),
  skip: z.boolean().optional(),
});

const createFromScheduleSchema = z.object({
  schedule_id: z.string().uuid(),
  item_ids: z.array(z.string().uuid()).min(1, 'Selecciona al menos una pieza'),
  assignments: z
    .array(
      z.object({
        schedule_item_id: z.string().uuid(),
        owner_user_id: z.string().uuid().optional().nullable(),
        task_overrides: z.array(taskOverrideSchema).optional(),
      })
    )
    .optional(),
});

const previewSchema = z.object({
  schedule_id: z.string().uuid(),
  item_ids: z.array(z.string().uuid()).min(1),
});

const updateWorkOrderSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  notes: z.string().max(2000).optional().nullable(),
  owner_user_id: z.string().uuid().optional().nullable(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  scheduled_publish_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  scheduled_publish_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
});

const transitionSchema = z.object({
  id: z.string().uuid(),
  new_status: z.enum(WO_STATUSES),
  notes: z.string().max(2000).optional(),
});

const cancelSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5, 'Indica el motivo (mín. 5 caracteres)').max(500),
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

function resolveOrgId(
  ctx: Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>
): string | null {
  if (!ctx.isSuperAdmin) return ctx.organizationId;
  if (ctx.impersonatingOrgId) return ctx.impersonatingOrgId;
  return null;
}

async function getAuth() {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return { can: (code: string) => hasPermission(authCtx, code) };
}

function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

type RuleRow = {
  stage_type: TaskStageType;
  stage_name_template: string;
  default_days_before_publish: number;
  default_estimated_hours: number | null;
  default_user_id: string | null;
  position: number;
};

// ============================================================
// 🌟 CREAR OTs DESDE EL CRONOGRAMA
// ============================================================

export async function createWorkOrdersFromScheduleAction(payload: {
  schedule_id: string;
  item_ids: string[];
  assignments?: Array<{
    schedule_item_id: string;
    owner_user_id?: string | null;
    task_overrides?: Array<{
      stage_type: TaskStageType;
      assigned_to_user_id?: string | null;
      estimated_hours?: number | null;
      skip?: boolean;
    }>;
  }>;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkManage())) {
    return { error: 'No tienes permiso para gestionar órdenes de trabajo' };
  }

  const validation = createFromScheduleSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { schedule_id, item_ids, assignments } = validation.data;

  // 1. Cargar el schedule + cadena hasta el cliente
  const { data: schedule } = await ctx.supabase
    .from('schedules')
    .select(
      `
      id, organization_id,
      subscription_period:subscription_periods!schedules_subscription_period_id_fkey(
        subscription:client_subscriptions!subscription_periods_subscription_id_fkey(client_id)
      )
    `
    )
    .eq('id', schedule_id)
    .maybeSingle();

  if (!schedule) return { error: 'Cronograma no encontrado' };
  if (schedule.organization_id !== orgId) {
    return { error: 'Este cronograma no pertenece a tu organización' };
  }

  const clientId = (
    schedule.subscription_period as unknown as {
      subscription: { client_id: string } | null;
    } | null
  )?.subscription?.client_id;

  if (!clientId) {
    return { error: 'No se pudo determinar el cliente del cronograma' };
  }

  // 2. Cargar las piezas aprobadas seleccionadas
  const { data: items } = await ctx.supabase
    .from('schedule_items')
    .select('*')
    .eq('schedule_id', schedule_id)
    .in('id', item_ids)
    .eq('status', 'approved');

  const approvedItems = items || [];

  const created: Array<{
    schedule_item_id: string;
    work_order_id: string;
    folio: string;
  }> = [];
  const failed: Array<{ item_id: string; error: string }> = [];

  // Piezas pedidas que no están aprobadas / no existen
  const foundIds = new Set(approvedItems.map((i) => i.id));
  for (const reqId of item_ids) {
    if (!foundIds.has(reqId)) {
      failed.push({ item_id: reqId, error: 'No aprobada o no encontrada' });
    }
  }

  if (approvedItems.length === 0) {
    return { success: true, created, failed };
  }

  // 3. OTs ya existentes para estas piezas
  const { data: existingWOs } = await ctx.supabase
    .from('work_orders')
    .select('source_schedule_item_id')
    .in('source_schedule_item_id', Array.from(foundIds));

  const existingSet = new Set(
    (existingWOs || []).map((w) => w.source_schedule_item_id)
  );

  // 4. Cargar reglas activas de la org agrupadas por item_type
  const { data: rules } = await ctx.supabase
    .from('assignment_rules')
    .select(
      'item_type, stage_type, stage_name_template, default_days_before_publish, default_estimated_hours, default_user_id, position'
    )
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('position');

  const rulesByType: Record<string, RuleRow[]> = {};
  for (const r of rules || []) {
    if (!rulesByType[r.item_type]) rulesByType[r.item_type] = [];
    rulesByType[r.item_type].push(r as RuleRow);
  }

  // Map de overrides por pieza
  const assignmentMap: Record<
    string,
    NonNullable<typeof assignments>[number]
  > = {};
  for (const a of assignments || []) {
    assignmentMap[a.schedule_item_id] = a;
  }

  // 5. Crear OT por pieza (sin rollback global)
  for (const item of approvedItems) {
    if (existingSet.has(item.id)) {
      failed.push({ item_id: item.id, error: 'Ya tiene una OT creada' });
      continue;
    }

    try {
      const itemRules = rulesByType[item.item_type] || [];
      const maxDays = itemRules.reduce(
        (m, r) => Math.max(m, r.default_days_before_publish || 0),
        0
      );
      const deadline = subtractDays(item.scheduled_date, maxDays);

      const { data: folio, error: folioError } = await ctx.supabase.rpc(
        'generate_work_order_folio',
        { p_organization_id: orgId }
      );
      if (folioError || !folio) {
        throw new Error(folioError?.message || 'No se pudo generar el folio');
      }

      const assignment = assignmentMap[item.id];

      const briefSnapshot: WorkOrderBriefSnapshot = {
        item_type: item.item_type,
        pillar_name: item.pillar_name,
        pillar_index: item.pillar_index,
        hook: item.hook,
        body_copy_suggestion: item.body_copy_suggestion,
        cta: item.cta,
        format_notes: item.format_notes,
        hashtags_suggested: item.hashtags_suggested,
        key_message: item.key_message,
      };

      const { data: wo, error: woError } = await ctx.supabase
        .from('work_orders')
        .insert({
          organization_id: orgId,
          source_schedule_item_id: item.id,
          folio: folio as string,
          title: item.title,
          status: 'pending',
          scheduled_publish_date: item.scheduled_date,
          scheduled_publish_time: item.scheduled_time,
          deadline,
          owner_user_id: assignment?.owner_user_id ?? null,
          brief_snapshot: briefSnapshot as never,
          client_id: clientId,
          created_by: ctx.isSuperAdmin ? null : ctx.userId,
        })
        .select('id, folio')
        .single();

      if (woError || !wo) {
        throw new Error(woError?.message || 'No se pudo crear la OT');
      }

      // Tareas según reglas (respetando overrides)
      const tasksToInsert = [];
      for (const rule of itemRules) {
        const override = assignment?.task_overrides?.find(
          (o) => o.stage_type === rule.stage_type
        );
        if (override?.skip) continue;

        tasksToInsert.push({
          work_order_id: wo.id,
          stage_name: rule.stage_name_template,
          stage_type: rule.stage_type,
          position: rule.position,
          assigned_to_user_id:
            override?.assigned_to_user_id ?? rule.default_user_id ?? null,
          estimated_hours:
            override?.estimated_hours ?? rule.default_estimated_hours ?? null,
          status: 'pending' as const,
        });
      }

      if (tasksToInsert.length > 0) {
        const { error: tasksError } = await ctx.supabase
          .from('work_order_tasks')
          .insert(tasksToInsert);
        if (tasksError) {
          throw new Error(
            `OT creada pero fallaron las tareas: ${tasksError.message}`
          );
        }
      }

      created.push({
        schedule_item_id: item.id,
        work_order_id: wo.id,
        folio: wo.folio,
      });
    } catch (err) {
      failed.push({
        item_id: item.id,
        error: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  }

  revalidatePath('/work-orders');
  revalidatePath(`/schedules/${schedule_id}`);

  return { success: true, created, failed };
}

// ============================================================
// PREVIEW (sin guardar)
// ============================================================

export async function previewWorkOrdersFromScheduleAction(payload: {
  schedule_id: string;
  item_ids: string[];
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkManage())) {
    return { error: 'No tienes permiso para gestionar órdenes de trabajo' };
  }

  const validation = previewSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: items } = await ctx.supabase
    .from('schedule_items')
    .select(
      'id, title, scheduled_date, item_type, pillar_name'
    )
    .eq('schedule_id', validation.data.schedule_id)
    .in('id', validation.data.item_ids)
    .eq('status', 'approved');

  const { data: rules } = await ctx.supabase
    .from('assignment_rules')
    .select(
      `
      item_type, stage_type, stage_name_template, default_days_before_publish,
      default_estimated_hours, default_user_id, position,
      default_user:users!assignment_rules_default_user_id_fkey(id, first_name, last_name)
    `
    )
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('position');

  const rulesByType: Record<string, typeof rules> = {};
  for (const r of rules || []) {
    if (!rulesByType[r.item_type]) rulesByType[r.item_type] = [];
    rulesByType[r.item_type]!.push(r);
  }

  const preview = (items || []).map((item) => {
    const itemRules = rulesByType[item.item_type] || [];
    const maxDays = itemRules.reduce(
      (m, r) => Math.max(m, r.default_days_before_publish || 0),
      0
    );
    return {
      schedule_item: {
        id: item.id,
        title: item.title,
        scheduled_publish_date: item.scheduled_date,
        item_type: item.item_type,
        pillar_name: item.pillar_name,
      },
      suggested_deadline: subtractDays(item.scheduled_date, maxDays),
      tasks: itemRules.map((r) => ({
        stage_type: r.stage_type,
        stage_name: r.stage_name_template,
        default_days_before_publish: r.default_days_before_publish,
        suggested_user: r.default_user ?? null,
        estimated_hours: r.default_estimated_hours,
      })),
    };
  });

  return { preview };
}

// ============================================================
// LISTAR OTs
// ============================================================

export async function listWorkOrdersAction(filters?: {
  status?: WorkOrderStatus;
  client_id?: string;
  owner_user_id?: string;
  deadline_from?: string;
  deadline_to?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { can } = await getAuth();
  const viewAll = can('work_orders.view');
  const viewOwn = can('work_orders.view_own');

  if (!viewAll && !viewOwn) {
    return { error: 'No tienes permiso para ver órdenes de trabajo' };
  }

  let query = ctx.supabase
    .from('work_orders')
    .select(
      `
      *,
      client:clients(id, name),
      source_schedule_item:schedule_items!work_orders_source_schedule_item_id_fkey(id, title, item_type, pillar_name),
      owner:users!work_orders_owner_user_id_fkey(id, first_name, last_name)
    `
    )
    .eq('organization_id', orgId);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.owner_user_id)
    query = query.eq('owner_user_id', filters.owner_user_id);
  if (filters?.deadline_from)
    query = query.gte('deadline', filters.deadline_from);
  if (filters?.deadline_to) query = query.lte('deadline', filters.deadline_to);

  // Si solo tiene view_own, restringir a OTs donde tenga tareas asignadas
  if (!viewAll && viewOwn) {
    if (ctx.isSuperAdmin || !ctx.userId) return { workOrders: [] };
    const { data: myTasks } = await ctx.supabase
      .from('work_order_tasks')
      .select('work_order_id')
      .eq('assigned_to_user_id', ctx.userId);

    const ids = Array.from(
      new Set((myTasks || []).map((t) => t.work_order_id))
    );
    if (ids.length === 0) return { workOrders: [] };
    query = query.in('id', ids);
  }

  const { data, error } = await query.order('deadline');

  if (error) return { error: `Error al cargar OTs: ${error.message}` };

  const workOrders = data || [];

  // Conteo de tareas por estado
  const woIds = workOrders.map((w) => w.id);
  const countsByWO: Record<string, Record<string, number>> = {};

  if (woIds.length > 0) {
    const { data: taskRows } = await ctx.supabase
      .from('work_order_tasks')
      .select('work_order_id, status')
      .in('work_order_id', woIds);

    for (const t of taskRows || []) {
      if (!countsByWO[t.work_order_id]) countsByWO[t.work_order_id] = {};
      countsByWO[t.work_order_id][t.status] =
        (countsByWO[t.work_order_id][t.status] || 0) + 1;
    }
  }

  const withCounts = workOrders.map((w) => {
    const counts = countsByWO[w.id] || {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      ...w,
      task_counts: {
        total,
        pending: counts.pending || 0,
        in_progress: counts.in_progress || 0,
        blocked: counts.blocked || 0,
        done: counts.done || 0,
        skipped: counts.skipped || 0,
      },
    };
  });

  return { workOrders: withCounts };
}

// ============================================================
// OBTENER UNA OT
// ============================================================

export async function getWorkOrderByIdAction(id: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { can } = await getAuth();
  const viewAll = can('work_orders.view');
  const viewOwn = can('work_orders.view_own');

  if (!viewAll && !viewOwn) {
    return { error: 'No tienes permiso para ver órdenes de trabajo' };
  }

  const { data: workOrder, error } = await ctx.supabase
    .from('work_orders')
    .select(
      `
      *,
      client:clients(id, name, legal_name),
      source_schedule_item:schedule_items!work_orders_source_schedule_item_id_fkey(id, title, item_type, pillar_name, schedule_id),
      owner:users!work_orders_owner_user_id_fkey(id, first_name, last_name),
      creator:users!work_orders_created_by_fkey(id, first_name, last_name),
      tasks:work_order_tasks(
        *,
        assigned_to:users!work_order_tasks_assigned_to_user_id_fkey(id, first_name, last_name)
      )
    `
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) return { error: `Error al cargar la OT: ${error.message}` };
  if (!workOrder) return { error: 'Orden de trabajo no encontrada' };

  // Si solo tiene view_own, verificar que sea owner o tenga una tarea asignada
  if (!viewAll && viewOwn) {
    const tasks = (workOrder.tasks as unknown as Array<{
      assigned_to_user_id: string | null;
    }>) || [];
    const isOwner = workOrder.owner_user_id === ctx.userId;
    const hasTask = tasks.some((t) => t.assigned_to_user_id === ctx.userId);
    if (!isOwner && !hasTask) {
      return { error: 'No tienes acceso a esta orden de trabajo' };
    }
  }

  // Ordenar tareas por position
  const tasks = (workOrder.tasks as unknown as Array<{ position: number }>) || [];
  tasks.sort((a, b) => a.position - b.position);

  return { workOrder };
}

// ============================================================
// ACTUALIZAR OT (campos editables)
// ============================================================

export async function updateWorkOrderAction(payload: {
  id: string;
  title?: string;
  notes?: string | null;
  owner_user_id?: string | null;
  deadline?: string;
  scheduled_publish_date?: string;
  scheduled_publish_time?: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkManage())) {
    return { error: 'No tienes permiso para gestionar órdenes de trabajo' };
  }

  const validation = updateWorkOrderSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { id, ...updateData } = validation.data;

  if (Object.keys(updateData).length === 0) {
    return { error: 'No hay cambios que guardar' };
  }

  const { error } = await ctx.supabase
    .from('work_orders')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) return { error: `Error al actualizar: ${error.message}` };

  revalidatePath('/work-orders');
  revalidatePath(`/work-orders/${id}`);
  return { success: true };
}

// ============================================================
// TRANSICIÓN DE ESTADO
// ============================================================

export async function transitionWorkOrderStatusAction(payload: {
  id: string;
  new_status: WorkOrderStatus;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkManage())) {
    return { error: 'No tienes permiso para gestionar órdenes de trabajo' };
  }

  const validation = transitionSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: wo } = await ctx.supabase
    .from('work_orders')
    .select('id, status, started_at')
    .eq('id', validation.data.id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!wo) return { error: 'Orden de trabajo no encontrada' };

  const current = wo.status as WorkOrderStatus;
  const next = validation.data.new_status;

  if (current === next) return { success: true };

  if (!WO_TRANSITIONS[current].includes(next)) {
    return {
      error: `Transición no válida: ${current} → ${next}`,
    };
  }

  const update: WorkOrderUpdate = { status: next };
  const now = new Date().toISOString();

  if (next === 'in_production' && !wo.started_at) update.started_at = now;
  if (next === 'ready') update.completed_at = now;
  if (next === 'published') update.published_at = now;
  if (next === 'cancelled') update.cancelled_at = now;
  // Revertir publicación
  if (current === 'published' && next === 'ready') update.published_at = null;

  if (validation.data.notes) update.notes = validation.data.notes;

  const { error } = await ctx.supabase
    .from('work_orders')
    .update(update)
    .eq('id', validation.data.id);

  if (error) return { error: `Error al cambiar estado: ${error.message}` };

  revalidatePath('/work-orders');
  revalidatePath(`/work-orders/${validation.data.id}`);
  return { success: true };
}

// ============================================================
// CANCELAR OT
// ============================================================

export async function cancelWorkOrderAction(payload: {
  id: string;
  reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('work_orders.cancel'))) {
    return { error: 'No tienes permiso para cancelar órdenes de trabajo' };
  }

  const validation = cancelSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: wo } = await ctx.supabase
    .from('work_orders')
    .select('id, status')
    .eq('id', validation.data.id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!wo) return { error: 'Orden de trabajo no encontrada' };

  if (wo.status === 'published') {
    return { error: 'No se puede cancelar una OT ya publicada' };
  }
  if (wo.status === 'cancelled') {
    return { error: 'Esta OT ya está cancelada' };
  }

  const { error } = await ctx.supabase
    .from('work_orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: validation.data.reason.trim(),
    })
    .eq('id', validation.data.id);

  if (error) return { error: `Error al cancelar: ${error.message}` };

  revalidatePath('/work-orders');
  revalidatePath(`/work-orders/${validation.data.id}`);
  return { success: true };
}

// ============================================================
// BORRAR OT (cascade borra tareas)
// ============================================================

export async function deleteWorkOrderAction(id: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: wo } = await ctx.supabase
    .from('work_orders')
    .select('id, status')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!wo) return { error: 'Orden de trabajo no encontrada' };

  // Solo Super Admin, o una OT cancelada (con permiso de gestión)
  if (!ctx.isSuperAdmin) {
    if (!(await checkManage())) {
      return { error: 'No tienes permiso para borrar órdenes de trabajo' };
    }
    if (wo.status !== 'cancelled') {
      return {
        error: 'Solo se pueden borrar OTs canceladas. Cancélala primero.',
      };
    }
  }

  const { error } = await ctx.supabase
    .from('work_orders')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) return { error: `Error al borrar: ${error.message}` };

  console.log(
    `[deleteWorkOrder] OT ${id} borrada por ${
      ctx.isSuperAdmin ? 'super-admin' : ctx.userId
    }`
  );

  revalidatePath('/work-orders');
  return { success: true };
}

// ============================================================
// HELPER: permiso de gestión
// ============================================================

async function checkManage(): Promise<boolean> {
  return checkPermission('work_orders.manage');
}

async function checkPermission(code: string): Promise<boolean> {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return hasPermission(authCtx, code);
}
