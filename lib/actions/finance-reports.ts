'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

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

async function checkReports(): Promise<boolean> {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return hasPermission(authCtx, 'finance.view_reports');
}

// ============================================================
// HELPERS DE FECHA
// ============================================================

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromISO(iso: string | null): string | null {
  return iso ? iso.slice(0, 7) : null;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-MX', {
    month: 'short',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function startOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================
// 1. P&L MENSUAL
// ============================================================

const plSchema = z.object({
  months_back: z.number().int().min(1).max(24).default(6),
});

export async function getPLReportAction(payload?: { months_back?: number }) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };
  if (!(await checkReports())) return { error: 'Sin permiso para ver reportes' };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { months_back } = plSchema.parse(payload ?? {});

  // Rango de meses (del más viejo al más reciente)
  const now = new Date();
  const months: string[] = [];
  for (let i = months_back - 1; i >= 0; i--) {
    months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  const rangeStart = `${months[0]}-01`;

  const [{ data: invoices }, { data: expenses }] = await Promise.all([
    ctx.supabase
      .from('invoices')
      .select('total, paid_amount, paid_at')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_at', rangeStart),
    ctx.supabase
      .from('expenses')
      .select('total, paid_amount, paid_at')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_at', rangeStart),
  ]);

  const acc: Record<
    string,
    { income: number; expenses: number; income_count: number; expense_count: number }
  > = {};
  for (const m of months)
    acc[m] = { income: 0, expenses: 0, income_count: 0, expense_count: 0 };

  for (const inv of invoices || []) {
    const k = monthKeyFromISO(inv.paid_at);
    if (k && acc[k]) {
      acc[k].income += Number(inv.paid_amount ?? inv.total);
      acc[k].income_count++;
    }
  }
  for (const exp of expenses || []) {
    const k = monthKeyFromISO(exp.paid_at);
    if (k && acc[k]) {
      acc[k].expenses += Number(exp.paid_amount ?? exp.total);
      acc[k].expense_count++;
    }
  }

  const data = months.map((m) => ({
    month: m,
    month_label: monthLabel(m),
    income: r2(acc[m].income),
    expenses: r2(acc[m].expenses),
    profit: r2(acc[m].income - acc[m].expenses),
    income_count: acc[m].income_count,
    expense_count: acc[m].expense_count,
  }));

  return { data };
}

// ============================================================
// 2. GASTOS POR CATEGORÍA
// ============================================================

export async function getExpensesByCategoryAction(payload?: {
  date_from?: string;
  date_to?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };
  if (!(await checkReports())) return { error: 'Sin permiso para ver reportes' };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const from = payload?.date_from || startOfMonth(new Date());
  const to = payload?.date_to || todayISO();

  // Mapa de categorías (color/icon) de la org
  const { data: cats } = await ctx.supabase
    .from('expense_categories')
    .select('id, name, color, icon')
    .eq('organization_id', orgId);
  const catMap = new Map(
    (cats || []).map((c) => [c.id, c])
  );

  const { data: expenses } = await ctx.supabase
    .from('expenses')
    .select('category_id, category_name_snapshot, total, paid_amount, paid_at')
    .eq('organization_id', orgId)
    .eq('status', 'paid')
    .gte('paid_at', from)
    .lte('paid_at', `${to}T23:59:59`);

  const groups: Record<
    string,
    {
      category_id: string | null;
      category_name: string;
      category_color: string;
      category_icon: string | null;
      total: number;
      count: number;
    }
  > = {};

  let total = 0;
  for (const e of expenses || []) {
    const amount = Number(e.paid_amount ?? e.total);
    total += amount;
    const key = e.category_id ?? `snap:${e.category_name_snapshot ?? 'Sin categoría'}`;
    if (!groups[key]) {
      const cat = e.category_id ? catMap.get(e.category_id) : null;
      groups[key] = {
        category_id: e.category_id,
        category_name: cat?.name || e.category_name_snapshot || 'Sin categoría',
        category_color: cat?.color || '#6B7280',
        category_icon: cat?.icon ?? null,
        total: 0,
        count: 0,
      };
    }
    groups[key].total += amount;
    groups[key].count++;
  }

  const categories = Object.values(groups)
    .map((g) => ({
      ...g,
      total: r2(g.total),
      percentage: total > 0 ? Math.round((g.total / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { total: r2(total), categories };
}

// ============================================================
// 3. TOP PROVEEDORES
// ============================================================

export async function getTopVendorsAction(payload?: {
  date_from?: string;
  date_to?: string;
  limit?: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };
  if (!(await checkReports())) return { error: 'Sin permiso para ver reportes' };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const limit = payload?.limit ?? 10;

  let query = ctx.supabase
    .from('expenses')
    .select('vendor_id, vendor_name_snapshot, total, paid_amount, paid_at')
    .eq('organization_id', orgId)
    .eq('status', 'paid');

  if (payload?.date_from) query = query.gte('paid_at', payload.date_from);
  if (payload?.date_to) query = query.lte('paid_at', `${payload.date_to}T23:59:59`);

  const { data: expenses } = await query;

  const groups: Record<
    string,
    {
      vendor_id: string | null;
      vendor_name: string;
      total: number;
      count: number;
      last_payment_date: string | null;
    }
  > = {};

  for (const e of expenses || []) {
    const key = e.vendor_name_snapshot;
    if (!groups[key]) {
      groups[key] = {
        vendor_id: e.vendor_id,
        vendor_name: e.vendor_name_snapshot,
        total: 0,
        count: 0,
        last_payment_date: null,
      };
    }
    groups[key].total += Number(e.paid_amount ?? e.total);
    groups[key].count++;
    if (e.vendor_id && !groups[key].vendor_id) groups[key].vendor_id = e.vendor_id;
    if (
      e.paid_at &&
      (!groups[key].last_payment_date || e.paid_at > groups[key].last_payment_date!)
    ) {
      groups[key].last_payment_date = e.paid_at;
    }
  }

  const vendors = Object.values(groups)
    .map((g) => ({ ...g, total: r2(g.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return { vendors };
}

// ============================================================
// 4. MES vs MES
// ============================================================

export async function getMonthVsMonthAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };
  if (!(await checkReports())) return { error: 'Sin permiso para ver reportes' };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const now = new Date();
  const curKey = monthKey(now);
  const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const rangeStart = `${prevKey}-01`;

  const [{ data: invoices }, { data: expenses }] = await Promise.all([
    ctx.supabase
      .from('invoices')
      .select('total, paid_amount, paid_at')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_at', rangeStart),
    ctx.supabase
      .from('expenses')
      .select('total, paid_amount, paid_at')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_at', rangeStart),
  ]);

  function sums(key: string) {
    let income = 0;
    let exp = 0;
    for (const inv of invoices || [])
      if (monthKeyFromISO(inv.paid_at) === key)
        income += Number(inv.paid_amount ?? inv.total);
    for (const e of expenses || [])
      if (monthKeyFromISO(e.paid_at) === key)
        exp += Number(e.paid_amount ?? e.total);
    return { income: r2(income), expenses: r2(exp), profit: r2(income - exp) };
  }

  const cur = sums(curKey);
  const prev = sums(prevKey);

  return {
    current_month: { label: monthLabel(curKey), ...cur },
    previous_month: { label: monthLabel(prevKey), ...prev },
    comparison: {
      income_change_pct: pctChange(cur.income, prev.income),
      expenses_change_pct: pctChange(cur.expenses, prev.expenses),
      profit_change_pct: pctChange(cur.profit, prev.profit),
    },
  };
}

// ============================================================
// 5. AGING DE COBROS PENDIENTES
// ============================================================

export async function getPendingInvoicesReportAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };
  if (!(await checkReports())) return { error: 'Sin permiso para ver reportes' };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  await ctx.supabase.rpc('mark_overdue_invoices');

  const { data: invoices } = await ctx.supabase
    .from('invoices')
    .select(
      `
      id, folio, title, total, currency, status, due_date, client_id,
      client:clients(id, name)
    `
    )
    .eq('organization_id', orgId)
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = {
    not_due_yet: { count: 0, total: 0 },
    overdue_0_30: { count: 0, total: 0 },
    overdue_31_60: { count: 0, total: 0 },
    overdue_60_plus: { count: 0, total: 0 },
  };

  let totalPending = 0;
  let totalOverdue = 0;

  const result = (invoices || []).map((inv) => {
    const total = Number(inv.total);
    totalPending += total;
    const due = new Date(inv.due_date + 'T00:00:00');
    const daysOverdue = Math.floor(
      (today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysOverdue <= 0) {
      buckets.not_due_yet.count++;
      buckets.not_due_yet.total += total;
    } else {
      totalOverdue += total;
      if (daysOverdue <= 30) {
        buckets.overdue_0_30.count++;
        buckets.overdue_0_30.total += total;
      } else if (daysOverdue <= 60) {
        buckets.overdue_31_60.count++;
        buckets.overdue_31_60.total += total;
      } else {
        buckets.overdue_60_plus.count++;
        buckets.overdue_60_plus.total += total;
      }
    }

    return { ...inv, days_overdue: Math.max(0, daysOverdue) };
  });

  // Redondear buckets
  for (const b of Object.values(buckets)) b.total = r2(b.total);

  return {
    total_pending: r2(totalPending),
    total_overdue: r2(totalOverdue),
    buckets,
    invoices: result,
  };
}

// ============================================================
// 6. INGRESOS POR CLIENTE
// ============================================================

export async function getIncomeByClientAction(payload?: {
  date_from?: string;
  date_to?: string;
  limit?: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };
  if (!(await checkReports())) return { error: 'Sin permiso para ver reportes' };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const limit = payload?.limit ?? 10;

  let query = ctx.supabase
    .from('invoices')
    .select(
      `
      client_id, total, paid_amount, status, issue_date,
      client:clients(id, name)
    `
    )
    .eq('organization_id', orgId)
    .neq('status', 'cancelled');

  if (payload?.date_from) query = query.gte('issue_date', payload.date_from);
  if (payload?.date_to) query = query.lte('issue_date', payload.date_to);

  const { data: invoices } = await query;

  const groups: Record<
    string,
    {
      client_id: string;
      client_name: string;
      total_invoiced: number;
      total_paid: number;
      total_pending: number;
      invoice_count: number;
    }
  > = {};

  for (const inv of invoices || []) {
    if (!inv.client_id) continue;
    const client = inv.client as unknown as { id: string; name: string } | null;
    if (!groups[inv.client_id]) {
      groups[inv.client_id] = {
        client_id: inv.client_id,
        client_name: client?.name || 'Cliente',
        total_invoiced: 0,
        total_paid: 0,
        total_pending: 0,
        invoice_count: 0,
      };
    }
    const g = groups[inv.client_id];
    const total = Number(inv.total);
    g.total_invoiced += total;
    g.invoice_count++;
    if (inv.status === 'paid') g.total_paid += Number(inv.paid_amount ?? total);
    else g.total_pending += total;
  }

  const clients = Object.values(groups)
    .map((g) => ({
      ...g,
      total_invoiced: r2(g.total_invoiced),
      total_paid: r2(g.total_paid),
      total_pending: r2(g.total_pending),
    }))
    .sort((a, b) => b.total_paid - a.total_paid)
    .slice(0, limit);

  return { clients };
}
