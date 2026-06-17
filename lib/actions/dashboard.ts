'use server';

import { createClient } from '@/lib/supabase/server';

// ============================================================
// TYPES (DTOs)
// ============================================================

export type DashboardCriticalAlerts = {
  overdue_invoices_count: number;
  overdue_invoices_total: number;
  overdue_work_orders_count: number;
  overdue_expenses_count: number;
};

export type DashboardTodayItem = {
  type:
    | 'strategy_review'
    | 'schedule_conversion'
    | 'schedule_item_approval'
    | 'work_order_overdue'
    | 'invoice_overdue';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  urgency: 'critical' | 'high' | 'medium';
  meta?: Record<string, unknown>;
};

export type DashboardWeekItem = {
  type:
    | 'work_order_due_soon'
    | 'subscription_renew'
    | 'invoice_due'
    | 'expense_due'
    | 'contract_expiring';
  id: string;
  title: string;
  subtitle: string;
  due_date: string;
  days_until_due: number;
  href: string;
};

export type CommercialPipelineStats = {
  draft_quotes: number;
  sent_quotes: number;
  approved_quotes: number;
  draft_contracts: number;
  sent_contracts: number;
  signed_contracts: number;
  active_subscriptions: number;
  total_clients: number;
  active_clients: number;
};

export type ProductionStats = {
  total_strategies: number;
  approved_strategies: number;
  total_schedules: number;
  ready_schedules: number;
  work_orders_by_status: Record<string, number>;
  schedule_items_pending_approval: number;
};

export type TeamWorkloadItem = {
  user_id: string;
  user_name: string;
  active_tasks_count: number;
  pending_count: number;
  in_progress_count: number;
  blocked_count: number;
};

export type ActivityItem = {
  type:
    | 'quote_created'
    | 'contract_signed'
    | 'invoice_paid'
    | 'work_order_published';
  title: string;
  subtitle: string;
  timestamp: string;
  href: string;
};

// ============================================================
// CONSTANTES
// ============================================================

const WO_ACTIVE = ['pending', 'in_production', 'review', 'ready'] as const;
const TASK_ACTIVE = ['pending', 'in_progress', 'blocked'] as const;

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

async function getAuth() {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return { can: (code: string) => hasPermission(authCtx, code) };
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}

// Diferencia en días entre una fecha (YYYY-MM-DD) y hoy
function daysFromToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ============================================================
// 1. ALERTAS CRÍTICAS
// ============================================================

export async function getCriticalAlertsAction(): Promise<DashboardCriticalAlerts> {
  const empty: DashboardCriticalAlerts = {
    overdue_invoices_count: 0,
    overdue_invoices_total: 0,
    overdue_work_orders_count: 0,
    overdue_expenses_count: 0,
  };

  try {
    const ctx = await getContext();
    if ('error' in ctx) return empty;
    const orgId = resolveOrgId(ctx);
    if (!orgId) return empty;

    const today = todayISO();
    await ctx.supabase.rpc('mark_overdue_invoices');

    const [inv, wo, exp] = await Promise.all([
      ctx.supabase
        .from('invoices')
        .select('total')
        .eq('organization_id', orgId)
        .eq('status', 'overdue'),
      ctx.supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .lt('deadline', today)
        .in('status', WO_ACTIVE),
      ctx.supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pending')
        .lt('due_date', today),
    ]);

    const invRows = inv.data || [];
    return {
      overdue_invoices_count: invRows.length,
      overdue_invoices_total: Math.round(
        invRows.reduce((s, i) => s + Number(i.total), 0) * 100
      ) / 100,
      overdue_work_orders_count: wo.count ?? 0,
      overdue_expenses_count: exp.count ?? 0,
    };
  } catch (err) {
    console.error('[Dashboard] getCriticalAlerts:', err);
    return empty;
  }
}

// ============================================================
// 2. ITEMS DE HOY
// ============================================================

const URGENCY_RANK = { critical: 0, high: 1, medium: 2 };

export async function getTodayItemsAction(): Promise<DashboardTodayItem[]> {
  try {
    const ctx = await getContext();
    if ('error' in ctx) return [];
    const orgId = resolveOrgId(ctx);
    if (!orgId) return [];

    const today = todayISO();
    const items: DashboardTodayItem[] = [];

    // a) Estrategias en revisión interna (draft)
    const { data: strategies } = await ctx.supabase
      .from('strategies')
      .select('id, title, created_at, client:clients(name)')
      .eq('organization_id', orgId)
      .eq('status', 'draft');

    for (const s of strategies || []) {
      const client = s.client as unknown as { name: string } | null;
      const ageDays = Math.abs(daysFromToday(s.created_at.slice(0, 10)));
      items.push({
        type: 'strategy_review',
        id: s.id,
        title: s.title,
        subtitle: client?.name || 'Estrategia por revisar',
        href: `/strategy/strategies/${s.id}`,
        urgency: ageDays > 3 ? 'high' : 'medium',
      });
    }

    // b + c) Cronogramas ready: conversión a OTs y piezas por aprobar
    const { data: schedules } = await ctx.supabase
      .from('schedules')
      .select(
        `
        id, generated_at,
        subscription_period:subscription_periods!schedules_subscription_period_id_fkey(
          subscription:client_subscriptions!subscription_periods_subscription_id_fkey(name)
        ),
        schedule_items(id, status)
      `
      )
      .eq('organization_id', orgId)
      .eq('status', 'ready');

    const schedList = schedules || [];
    // Set de schedule_item_id que ya tienen OT
    const approvedItemIds = schedList.flatMap((s) =>
      ((s.schedule_items as unknown as Array<{ id: string; status: string }>) || [])
        .filter((it) => it.status === 'approved')
        .map((it) => it.id)
    );
    const woItemSet = new Set<string>();
    if (approvedItemIds.length > 0) {
      const { data: woRows } = await ctx.supabase
        .from('work_orders')
        .select('source_schedule_item_id')
        .in('source_schedule_item_id', approvedItemIds);
      for (const w of woRows || [])
        if (w.source_schedule_item_id) woItemSet.add(w.source_schedule_item_id);
    }

    for (const s of schedList) {
      const sub = s.subscription_period as unknown as {
        subscription: { name: string } | null;
      } | null;
      const subName = sub?.subscription?.name || 'Cronograma';
      const itemsArr =
        (s.schedule_items as unknown as Array<{ id: string; status: string }>) ||
        [];
      const approvedNoWO = itemsArr.filter(
        (it) => it.status === 'approved' && !woItemSet.has(it.id)
      );
      const drafts = itemsArr.filter((it) => it.status === 'draft');
      const ageDays = Math.abs(daysFromToday(s.generated_at?.slice(0, 10) || today));

      if (approvedNoWO.length > 0) {
        items.push({
          type: 'schedule_conversion',
          id: s.id,
          title: subName,
          subtitle: `${approvedNoWO.length} piezas aprobadas listas para convertir`,
          href: `/schedules/${s.id}`,
          urgency: ageDays > 7 ? 'high' : 'medium',
        });
      }
      if (drafts.length > 0) {
        items.push({
          type: 'schedule_item_approval',
          id: `${s.id}-draft`,
          title: subName,
          subtitle: `${drafts.length} piezas en borrador por aprobar`,
          href: `/schedules/${s.id}`,
          urgency: 'medium',
        });
      }
    }

    // d) Work orders vencidas
    const { data: wos } = await ctx.supabase
      .from('work_orders')
      .select('id, folio, title, deadline')
      .eq('organization_id', orgId)
      .lt('deadline', today)
      .in('status', WO_ACTIVE);

    for (const w of wos || []) {
      const overdue = Math.abs(daysFromToday(w.deadline));
      items.push({
        type: 'work_order_overdue',
        id: w.id,
        title: w.title,
        subtitle: `${w.folio} · vencida hace ${overdue} ${overdue === 1 ? 'día' : 'días'}`,
        href: `/work-orders/${w.id}`,
        urgency: 'critical',
      });
    }

    // e) Invoices vencidos
    const { data: invoices } = await ctx.supabase
      .from('invoices')
      .select('id, folio, total, currency, due_date, client:clients(name)')
      .eq('organization_id', orgId)
      .eq('status', 'overdue');

    for (const inv of invoices || []) {
      const client = inv.client as unknown as { name: string } | null;
      const overdue = Math.abs(daysFromToday(inv.due_date));
      items.push({
        type: 'invoice_overdue',
        id: inv.id,
        title: inv.folio,
        subtitle: `${client?.name || 'Cliente'} · vencido hace ${overdue} días`,
        href: `/finance/${inv.id}`,
        urgency: overdue > 30 ? 'critical' : 'high',
        meta: { total: Number(inv.total), currency: inv.currency },
      });
    }

    items.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
    return items.slice(0, 20);
  } catch (err) {
    console.error('[Dashboard] getTodayItems:', err);
    return [];
  }
}

// ============================================================
// 3. ITEMS DE LA SEMANA
// ============================================================

export async function getWeekItemsAction(): Promise<DashboardWeekItem[]> {
  try {
    const ctx = await getContext();
    if ('error' in ctx) return [];
    const orgId = resolveOrgId(ctx);
    if (!orgId) return [];

    const today = todayISO();
    const in7 = addDays(today, 7);
    const items: DashboardWeekItem[] = [];

    // a) Work orders próximas a vencer
    const { data: wos } = await ctx.supabase
      .from('work_orders')
      .select('id, folio, title, deadline')
      .eq('organization_id', orgId)
      .gte('deadline', today)
      .lte('deadline', in7)
      .in('status', WO_ACTIVE);

    for (const w of wos || [])
      items.push({
        type: 'work_order_due_soon',
        id: w.id,
        title: w.title,
        subtitle: w.folio,
        due_date: w.deadline,
        days_until_due: daysFromToday(w.deadline),
        href: `/work-orders/${w.id}`,
      });

    // b) Períodos de suscripción a renovar
    const { data: periods } = await ctx.supabase
      .from('subscription_periods')
      .select(
        `
        id, period_number, end_date,
        subscription:client_subscriptions!subscription_periods_subscription_id_fkey(
          id, name, organization_id
        )
      `
      )
      .eq('status', 'active')
      .gte('end_date', today)
      .lte('end_date', in7);

    for (const p of periods || []) {
      const sub = p.subscription as unknown as {
        id: string;
        name: string;
        organization_id: string;
      } | null;
      if (!sub || sub.organization_id !== orgId) continue;
      items.push({
        type: 'subscription_renew',
        id: p.id,
        title: sub.name,
        subtitle: `Período ${p.period_number} termina`,
        due_date: p.end_date,
        days_until_due: daysFromToday(p.end_date),
        href: `/subscriptions/${sub.id}`,
      });
    }

    // c) Invoices por vencer
    const { data: invoices } = await ctx.supabase
      .from('invoices')
      .select('id, folio, title, due_date, client:clients(name)')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .gte('due_date', today)
      .lte('due_date', in7);

    for (const inv of invoices || []) {
      const client = inv.client as unknown as { name: string } | null;
      items.push({
        type: 'invoice_due',
        id: inv.id,
        title: inv.folio,
        subtitle: client?.name || 'Cobro por vencer',
        due_date: inv.due_date,
        days_until_due: daysFromToday(inv.due_date),
        href: `/finance/${inv.id}`,
      });
    }

    // d) Gastos por pagar
    const { data: expenses } = await ctx.supabase
      .from('expenses')
      .select('id, folio, concept, due_date, vendor_name_snapshot')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .gte('due_date', today)
      .lte('due_date', in7);

    for (const e of expenses || []) {
      if (!e.due_date) continue;
      items.push({
        type: 'expense_due',
        id: e.id,
        title: e.concept,
        subtitle: e.vendor_name_snapshot,
        due_date: e.due_date,
        days_until_due: daysFromToday(e.due_date),
        href: `/finance/expenses/${e.id}`,
      });
    }

    // e) Contratos próximos a expirar — NOTA: la tabla contracts no tiene
    // columna de fin de vigencia (solo expires_at del link de firma). Se omite
    // hasta tener un campo de término del contrato.

    items.sort((a, b) => a.days_until_due - b.days_until_due);
    return items.slice(0, 30);
  } catch (err) {
    console.error('[Dashboard] getWeekItems:', err);
    return [];
  }
}

// ============================================================
// 4. PIPELINE COMERCIAL
// ============================================================

export async function getCommercialPipelineAction(): Promise<CommercialPipelineStats | null> {
  try {
    const ctx = await getContext();
    if ('error' in ctx) return null;
    const orgId = resolveOrgId(ctx);
    if (!orgId) return null;

    const { can } = await getAuth();
    if (!can('clients.view') && !can('quote.view')) return null;

    const [quotes, contracts, subs, clients, activeSubClients] =
      await Promise.all([
        ctx.supabase.from('quotes').select('status').eq('organization_id', orgId),
        ctx.supabase.from('contracts').select('status').eq('organization_id', orgId),
        ctx.supabase
          .from('client_subscriptions')
          .select('status')
          .eq('organization_id', orgId),
        ctx.supabase.from('clients').select('id').eq('organization_id', orgId),
        ctx.supabase
          .from('client_subscriptions')
          .select('client_id')
          .eq('organization_id', orgId)
          .eq('status', 'active'),
      ]);

    const q = quotes.data || [];
    const c = contracts.data || [];
    const s = subs.data || [];

    return {
      draft_quotes: q.filter((x) => x.status === 'draft').length,
      sent_quotes: q.filter((x) => ['sent', 'viewed'].includes(x.status)).length,
      approved_quotes: q.filter((x) => x.status === 'approved').length,
      draft_contracts: c.filter((x) => x.status === 'draft').length,
      sent_contracts: c.filter((x) => ['sent', 'viewed'].includes(x.status)).length,
      signed_contracts: c.filter((x) => x.status === 'signed').length,
      active_subscriptions: s.filter((x) => x.status === 'active').length,
      total_clients: (clients.data || []).length,
      active_clients: new Set(
        (activeSubClients.data || []).map((r) => r.client_id)
      ).size,
    };
  } catch (err) {
    console.error('[Dashboard] getCommercialPipeline:', err);
    return null;
  }
}

// ============================================================
// 5. PRODUCCIÓN
// ============================================================

export async function getProductionStatsAction(): Promise<ProductionStats | null> {
  try {
    const ctx = await getContext();
    if ('error' in ctx) return null;
    const orgId = resolveOrgId(ctx);
    if (!orgId) return null;

    const [strategies, schedules, wos] = await Promise.all([
      ctx.supabase.from('strategies').select('status').eq('organization_id', orgId),
      ctx.supabase.from('schedules').select('id, status').eq('organization_id', orgId),
      ctx.supabase.from('work_orders').select('status').eq('organization_id', orgId),
    ]);

    const sched = schedules.data || [];
    const scheduleIds = sched.map((s) => s.id);

    let pendingApproval = 0;
    if (scheduleIds.length > 0) {
      const { count } = await ctx.supabase
        .from('schedule_items')
        .select('id', { count: 'exact', head: true })
        .in('schedule_id', scheduleIds)
        .eq('status', 'draft');
      pendingApproval = count ?? 0;
    }

    const woByStatus: Record<string, number> = {};
    for (const w of wos.data || [])
      woByStatus[w.status] = (woByStatus[w.status] || 0) + 1;

    const strat = strategies.data || [];
    return {
      total_strategies: strat.length,
      approved_strategies: strat.filter((s) => s.status === 'approved').length,
      total_schedules: sched.length,
      ready_schedules: sched.filter((s) => s.status === 'ready').length,
      work_orders_by_status: woByStatus,
      schedule_items_pending_approval: pendingApproval,
    };
  } catch (err) {
    console.error('[Dashboard] getProductionStats:', err);
    return null;
  }
}

// ============================================================
// 6. CARGA DEL EQUIPO
// ============================================================

export async function getTeamWorkloadAction(): Promise<TeamWorkloadItem[]> {
  try {
    const ctx = await getContext();
    if ('error' in ctx) return [];
    const orgId = resolveOrgId(ctx);
    if (!orgId) return [];

    const { can } = await getAuth();
    if (!can('team.view')) return [];

    const { data: users } = await ctx.supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('organization_id', orgId)
      .eq('is_active', true);

    const userIds = (users || []).map((u) => u.id);
    if (userIds.length === 0) return [];

    const { data: tasks } = await ctx.supabase
      .from('work_order_tasks')
      .select('assigned_to_user_id, status')
      .in('assigned_to_user_id', userIds)
      .in('status', TASK_ACTIVE);

    const byUser: Record<
      string,
      { pending: number; in_progress: number; blocked: number }
    > = {};
    for (const t of tasks || []) {
      if (!t.assigned_to_user_id) continue;
      if (!byUser[t.assigned_to_user_id])
        byUser[t.assigned_to_user_id] = { pending: 0, in_progress: 0, blocked: 0 };
      const b = byUser[t.assigned_to_user_id];
      if (t.status === 'pending') b.pending++;
      else if (t.status === 'in_progress') b.in_progress++;
      else if (t.status === 'blocked') b.blocked++;
    }

    const result: TeamWorkloadItem[] = [];
    for (const u of users || []) {
      const b = byUser[u.id];
      if (!b) continue; // solo usuarios con tareas activas
      const total = b.pending + b.in_progress + b.blocked;
      if (total === 0) continue;
      result.push({
        user_id: u.id,
        user_name: `${u.first_name} ${u.last_name}`,
        active_tasks_count: total,
        pending_count: b.pending,
        in_progress_count: b.in_progress,
        blocked_count: b.blocked,
      });
    }

    result.sort((a, b) => b.active_tasks_count - a.active_tasks_count);
    return result;
  } catch (err) {
    console.error('[Dashboard] getTeamWorkload:', err);
    return [];
  }
}

// ============================================================
// 7. ACTIVIDAD RECIENTE
// ============================================================

export async function getRecentActivityAction(
  limit = 10
): Promise<ActivityItem[]> {
  try {
    const ctx = await getContext();
    if ('error' in ctx) return [];
    const orgId = resolveOrgId(ctx);
    if (!orgId) return [];

    const since = daysAgoISO(7);
    const sinceDate = since.slice(0, 10);
    const items: ActivityItem[] = [];

    const [quotes, contracts, invoices, wos] = await Promise.all([
      ctx.supabase
        .from('quotes')
        .select('id, folio, title, created_at, client:clients(name)')
        .eq('organization_id', orgId)
        .gte('created_at', since),
      ctx.supabase
        .from('contracts')
        .select('id, folio, title, signed_at, client:clients(name)')
        .eq('organization_id', orgId)
        .eq('status', 'signed')
        .gte('signed_at', since),
      ctx.supabase
        .from('invoices')
        .select('id, folio, total, currency, paid_at, client:clients(name)')
        .eq('organization_id', orgId)
        .eq('status', 'paid')
        .gte('paid_at', since),
      ctx.supabase
        .from('work_orders')
        .select('id, folio, title, published_at')
        .eq('organization_id', orgId)
        .eq('status', 'published')
        .gte('published_at', since),
    ]);

    for (const q of quotes.data || []) {
      const client = q.client as unknown as { name: string } | null;
      items.push({
        type: 'quote_created',
        title: `Cotización ${q.folio}`,
        subtitle: client?.name || q.title || 'Nueva cotización',
        timestamp: q.created_at,
        href: `/quotes/${q.id}`,
      });
    }
    for (const c of contracts.data || []) {
      if (!c.signed_at) continue;
      const client = c.client as unknown as { name: string } | null;
      items.push({
        type: 'contract_signed',
        title: `Contrato ${c.folio} firmado`,
        subtitle: client?.name || c.title || 'Contrato firmado',
        timestamp: c.signed_at,
        href: `/contracts/${c.id}`,
      });
    }
    for (const inv of invoices.data || []) {
      if (!inv.paid_at) continue;
      const client = inv.client as unknown as { name: string } | null;
      items.push({
        type: 'invoice_paid',
        title: `Cobro ${inv.folio} pagado`,
        subtitle: client?.name || 'Pago recibido',
        timestamp: inv.paid_at,
        href: `/finance/${inv.id}`,
      });
    }
    for (const w of wos.data || []) {
      if (!w.published_at) continue;
      items.push({
        type: 'work_order_published',
        title: `OT ${w.folio} publicada`,
        subtitle: w.title,
        timestamp: w.published_at,
        href: `/work-orders/${w.id}`,
      });
    }

    items.sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0
    );
    return items.slice(0, limit);
  } catch (err) {
    console.error('[Dashboard] getRecentActivity:', err);
    return [];
  }
}

// ============================================================
// 8. RESUMEN COMPLETO
// ============================================================

export async function getDashboardSummaryAction() {
  const [alerts, today, week, commercial, production, workload, activity] =
    await Promise.all([
      getCriticalAlertsAction(),
      getTodayItemsAction(),
      getWeekItemsAction(),
      getCommercialPipelineAction(),
      getProductionStatsAction(),
      getTeamWorkloadAction(),
      getRecentActivityAction(10),
    ]);

  return { alerts, today, week, commercial, production, workload, activity };
}
