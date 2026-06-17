'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  ArrowRight,
  Receipt,
  Plus,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  CategoryIcon,
  dueDateInfo,
  TONE_CLASS,
} from './finance-ui';

const CCY = 'MXN';

type MonthFigure = { label: string; income: number; expenses: number; profit: number };
type MonthVsMonth = {
  current_month: MonthFigure;
  previous_month: MonthFigure;
  comparison: {
    income_change_pct: number;
    expenses_change_pct: number;
    profit_change_pct: number;
  };
} | null;

type PendingReport = {
  total_pending: number;
  total_overdue: number;
} | null;

type UpcomingInvoice = {
  id: string;
  folio: string;
  total: number;
  currency: string;
  status: 'pending' | 'overdue';
  due_date: string;
  days_overdue: number;
  client: { id: string; name: string } | null;
};

type UpcomingExpense = {
  id: string;
  folio: string;
  vendor_name_snapshot: string;
  total: number;
  currency: string;
  due_date: string | null;
};

type CategorySlice = {
  category_id: string | null;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  total: number;
  percentage: number;
};

interface Props {
  monthVsMonth: MonthVsMonth;
  pending: PendingReport;
  upcomingInvoices: UpcomingInvoice[];
  upcomingExpenses: UpcomingExpense[];
  categories: CategorySlice[];
  categoryTotal: number;
  overdueInvoicesCount: number;
  overdueExpensesCount: number;
  overdueExpensesTotal: number;
  canViewReports: boolean;
}

export function FinanceSummary({
  monthVsMonth,
  pending,
  upcomingInvoices,
  upcomingExpenses,
  categories,
  categoryTotal,
  overdueInvoicesCount,
  overdueExpensesCount,
  overdueExpensesTotal,
  canViewReports,
}: Props) {
  const router = useRouter();

  const income = monthVsMonth?.current_month.income ?? 0;
  const expenses = monthVsMonth?.current_month.expenses ?? 0;
  const profit = monthVsMonth?.current_month.profit ?? 0;
  const margin = income > 0 ? Math.round((profit / income) * 100) : 0;
  const totalPending = pending?.total_pending ?? 0;
  const totalOverdue = pending?.total_overdue ?? 0;

  const hasAlerts = overdueInvoicesCount > 0 || overdueExpensesCount > 0;

  return (
    <div className="space-y-6">
      {/* SECCIÓN 2 (arriba) — ALERTAS */}
      {hasAlerts && (
        <div className="space-y-2">
          {overdueInvoicesCount > 0 && (
            <AlertBanner
              tone="red"
              text={`Tienes ${overdueInvoicesCount} ${overdueInvoicesCount === 1 ? 'cobro vencido' : 'cobros vencidos'} por ${formatCurrency(totalOverdue, CCY)}.`}
              href="/finance/invoices"
            />
          )}
          {overdueExpensesCount > 0 && (
            <AlertBanner
              tone="amber"
              text={`Tienes ${overdueExpensesCount} ${overdueExpensesCount === 1 ? 'gasto por pagar vencido' : 'gastos por pagar vencidos'} por ${formatCurrency(overdueExpensesTotal, CCY)}.`}
              href="/finance/expenses"
            />
          )}
        </div>
      )}

      {/* SECCIÓN 1 — KPIs DEL MES */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Ingresos del mes"
            value={formatCurrency(income, CCY)}
            icon={<TrendingUp className="w-4 h-4" />}
            iconClass="text-green-500"
            pct={monthVsMonth?.comparison.income_change_pct}
            positiveIsGood
          />
          <Kpi
            label="Gastos del mes"
            value={formatCurrency(expenses, CCY)}
            icon={<TrendingDown className="w-4 h-4" />}
            iconClass="text-destructive"
            pct={monthVsMonth?.comparison.expenses_change_pct}
            positiveIsGood={false}
          />
          <Kpi
            label="Ganancia neta"
            value={formatCurrency(profit, CCY)}
            valueClass={profit < 0 ? 'text-destructive' : 'text-green-500'}
            icon={<DollarSign className="w-4 h-4" />}
            iconClass="text-photocan-amber"
            hint={income > 0 ? `Margen ${margin}%` : undefined}
          />
          <Kpi
            label="Por cobrar"
            value={formatCurrency(totalPending, CCY)}
            icon={<Clock className="w-4 h-4" />}
            iconClass="text-photocan-amber"
            badge={
              totalOverdue > 0
                ? `${formatCurrency(totalOverdue, CCY)} vencidos`
                : undefined
            }
          />
        </div>
      </section>

      {/* SECCIÓN 3 — PRÓXIMOS MOVIMIENTOS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Próximos cobros */}
        <Card>
          <CardHeader
            title="Próximos cobros"
            icon={<Receipt className="w-4 h-4 text-photocan-amber" />}
            href="/finance/invoices"
          />
          {upcomingInvoices.length === 0 ? (
            <Empty text="No hay cobros pendientes 🎉" />
          ) : (
            <div className="divide-y divide-border">
              {upcomingInvoices.map((inv) => {
                const dd = dueDateInfo(inv.due_date, inv.status);
                return (
                  <button
                    key={inv.id}
                    onClick={() => router.push(`/finance/${inv.id}`)}
                    className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-secondary/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {inv.client?.name || '—'}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {inv.folio} ·{' '}
                        <span className={TONE_CLASS[dd.tone]}>{dd.label}</span>
                      </div>
                    </div>
                    <div className="font-mono text-sm font-medium tabular-nums flex-shrink-0">
                      {formatCurrency(Number(inv.total), inv.currency)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Próximos pagos */}
        <Card>
          <CardHeader
            title="Próximos pagos"
            icon={<TrendingDown className="w-4 h-4 text-photocan-amber" />}
            href="/finance/expenses"
          />
          {upcomingExpenses.length === 0 ? (
            <Empty text="No hay gastos pendientes" />
          ) : (
            <div className="divide-y divide-border">
              {upcomingExpenses.map((e) => {
                const dd = e.due_date ? dueDateInfo(e.due_date, 'pending') : null;
                return (
                  <button
                    key={e.id}
                    onClick={() => router.push(`/finance/expenses/${e.id}`)}
                    className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-secondary/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {e.vendor_name_snapshot}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {e.folio} ·{' '}
                        {dd ? (
                          <span className={TONE_CLASS[dd.tone]}>{dd.label}</span>
                        ) : (
                          'Sin fecha'
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-medium tabular-nums flex-shrink-0">
                      {formatCurrency(Number(e.total), e.currency)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      {/* SECCIÓN 4 — GASTOS DEL MES POR CATEGORÍA */}
      {categories.length > 0 && (
        <Card>
          <CardHeader
            title="Gastos del mes por categoría"
            icon={<BarChart3 className="w-4 h-4 text-photocan-amber" />}
            href={canViewReports ? '/finance/reports' : undefined}
            linkLabel="Ver reporte completo"
          />
          <div className="space-y-3 pt-1">
            {categories.map((c) => (
              <div key={c.category_id ?? c.category_name}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: `${c.category_color}1a`, color: c.category_color }}
                  >
                    <CategoryIcon name={c.category_icon} size={12} />
                    {c.category_name}
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {formatCurrency(c.total, CCY)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${c.percentage}%`, background: c.category_color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-3 text-right">
            Total mes: {formatCurrency(categoryTotal, CCY)}
          </div>
        </Card>
      )}

      {/* SECCIÓN 5 — ACCESO RÁPIDO */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction href="/finance/invoices" icon={<Plus className="w-4 h-4" />} label="Registrar cobro" />
        <QuickAction href="/finance/expenses" icon={<Plus className="w-4 h-4" />} label="Registrar gasto" />
        {canViewReports && (
          <QuickAction href="/finance/reports" icon={<BarChart3 className="w-4 h-4" />} label="Ver reportes" />
        )}
      </section>
    </div>
  );
}

// ============================================================
// AUXILIARES
// ============================================================

function Kpi({
  label,
  value,
  icon,
  iconClass,
  valueClass,
  pct,
  positiveIsGood,
  hint,
  badge,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconClass?: string;
  valueClass?: string;
  pct?: number;
  positiveIsGood?: boolean;
  hint?: string;
  badge?: string;
}) {
  const showPct = pct !== undefined;
  const up = (pct ?? 0) > 0;
  const flat = (pct ?? 0) === 0;
  const good = flat ? null : up === positiveIsGood;
  const pctTone = flat
    ? 'text-muted-foreground'
    : good
      ? 'text-green-500'
      : 'text-destructive';

  return (
    <div className="border border-border rounded-lg bg-card p-5">
      <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-2 ${iconClass || 'text-muted-foreground'}`}>
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums font-mono ${valueClass || ''}`}>
        {value}
      </div>
      <div className="mt-2 min-h-[16px]">
        {showPct ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-mono ${pctTone}`}>
            {flat ? <Minus className="w-3 h-3" /> : up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(pct ?? 0)}% vs mes anterior
          </span>
        ) : hint ? (
          <span className="text-xs font-mono text-muted-foreground">{hint}</span>
        ) : badge ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
            <AlertTriangle className="w-3 h-3" />
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AlertBanner({
  tone,
  text,
  href,
}: {
  tone: 'red' | 'amber';
  text: string;
  href: string;
}) {
  const cls =
    tone === 'red'
      ? 'border-destructive/30 bg-destructive/5 text-destructive'
      : 'border-photocan-amber/30 bg-photocan-amber/5 text-photocan-amber-deep';
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${cls} hover:opacity-90 transition-opacity`}
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {text}
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-mono whitespace-nowrap">
        Revisar
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border rounded-lg bg-card p-5">{children}</div>;
}

function CardHeader({
  title,
  icon,
  href,
  linkLabel = 'Ver todos',
}: {
  title: string;
  icon: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="text-xs font-mono text-photocan-amber-deep hover:underline inline-flex items-center gap-1">
          {linkLabel}
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-green-500/60" />
      {text}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 h-12 rounded-lg border border-border bg-card text-sm font-medium hover:border-photocan-amber/50 hover:bg-secondary/40 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
