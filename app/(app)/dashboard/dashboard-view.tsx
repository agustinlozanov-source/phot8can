'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Factory,
  Users,
  Activity,
} from 'lucide-react';
import type {
  DashboardCriticalAlerts,
  DashboardTodayItem,
  DashboardWeekItem,
  CommercialPipelineStats,
  ProductionStats,
  TeamWorkloadItem,
  ActivityItem,
} from '@/lib/actions/dashboard';
import {
  getGreeting,
  fullDate,
  relativeTime,
  todayIcon,
  todayLabel,
  weekIcon,
  activityMeta,
  UrgencyBadge,
  URGENCY_BORDER,
  DaysBadge,
  formatMoney,
} from './dashboard-ui';

type MonthVsMonth = {
  current_month: { label: string; income: number; expenses: number; profit: number };
  previous_month: { label: string; income: number; expenses: number; profit: number };
  comparison: {
    income_change_pct: number;
    expenses_change_pct: number;
    profit_change_pct: number;
  };
} | null;

interface Summary {
  alerts: DashboardCriticalAlerts;
  today: DashboardTodayItem[];
  week: DashboardWeekItem[];
  commercial: CommercialPipelineStats | null;
  production: ProductionStats | null;
  workload: TeamWorkloadItem[];
  activity: ActivityItem[];
}

interface Props {
  firstName: string;
  summary: Summary;
  monthVsMonth: MonthVsMonth;
  canViewFinance: boolean;
  canViewTeam: boolean;
}

export function DashboardView({
  firstName,
  summary,
  monthVsMonth,
  canViewFinance,
  canViewTeam,
}: Props) {
  const router = useRouter();
  const { alerts, today, week, commercial, production, workload, activity } =
    summary;

  const hasAlerts =
    alerts.overdue_invoices_count > 0 ||
    alerts.overdue_work_orders_count > 0 ||
    alerts.overdue_expenses_count > 0;

  return (
    <div className="p-8 max-w-7xl">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-muted-foreground text-sm capitalize">{fullDate()}</p>
        </div>
        <button
          onClick={() => router.refresh()}
          title="Actualizar"
          className="w-9 h-9 grid place-items-center rounded-md border border-border hover:bg-secondary transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* SECCIÓN 1 — ALERTAS */}
      {hasAlerts && (
        <div className="mb-10 rounded-lg border border-destructive/30 border-l-4 border-l-destructive bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="font-medium text-sm">Atención requerida</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
            {alerts.overdue_invoices_count > 0 && (
              <AlertLink
                href="/finance/invoices"
                text={`${alerts.overdue_invoices_count} ${alerts.overdue_invoices_count === 1 ? 'cobro vencido' : 'cobros vencidos'} (${formatMoney(alerts.overdue_invoices_total)})`}
              />
            )}
            {alerts.overdue_work_orders_count > 0 && (
              <AlertLink
                href="/work-orders"
                text={`${alerts.overdue_work_orders_count} ${alerts.overdue_work_orders_count === 1 ? 'orden de trabajo vencida' : 'órdenes de trabajo vencidas'}`}
              />
            )}
            {alerts.overdue_expenses_count > 0 && (
              <AlertLink
                href="/finance/expenses"
                text={`${alerts.overdue_expenses_count} ${alerts.overdue_expenses_count === 1 ? 'gasto vencido' : 'gastos vencidos'}`}
              />
            )}
          </div>
        </div>
      )}

      {/* SECCIÓN 2 — HOY */}
      <section className="mb-12">
        <SectionHeader
          title="Hoy"
          subtitle="Lo que requiere atención inmediata"
          count={today.length}
        />
        {today.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-10 h-10 text-green-500" />}
            text="¡Todo al día! No hay pendientes urgentes hoy"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {today.map((item) => {
              const Icon = todayIcon(item.type);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`border border-border border-l-4 ${URGENCY_BORDER[item.urgency]} rounded-lg bg-card p-4 hover:border-photocan-amber/40 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Icon className="w-4 h-4 text-photocan-amber flex-shrink-0 mt-0.5" />
                    <UrgencyBadge urgency={item.urgency} />
                  </div>
                  <div className="font-medium text-sm leading-tight mb-0.5 line-clamp-2">
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {item.subtitle}
                  </div>
                  <div className="mt-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
                    {todayLabel(item.type)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* SECCIÓN 3 — ESTA SEMANA */}
      <section className="mb-12">
        <SectionHeader
          title="Esta semana"
          subtitle="Lo que viene en los próximos 7 días"
          count={week.length}
        />
        {week.length === 0 ? (
          <EmptyState text="Semana tranquila ☕" />
        ) : (
          <WeekTimeline items={week} />
        )}
      </section>

      {/* SECCIÓN 4 — MÉTRICAS */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          Métricas del negocio
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {commercial && <CommercialCard stats={commercial} />}
          {canViewFinance && monthVsMonth && (
            <FinanceCard mvm={monthVsMonth} />
          )}
          {production && <ProductionCard stats={production} />}
          {canViewTeam && <TeamCard workload={workload} />}
        </div>
      </section>

      {/* SECCIÓN 5 — ACTIVIDAD RECIENTE */}
      <section>
        <SectionHeader title="Actividad reciente" subtitle="Últimos 7 días" />
        {activity.length === 0 ? (
          <EmptyState text="Sin actividad reciente" />
        ) : (
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            {activity.map((a, i) => {
              const { Icon, color } = activityMeta(a.type);
              return (
                <Link
                  key={i}
                  href={a.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.subtitle}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {relativeTime(a.timestamp)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// SEMANA — timeline agrupado
// ============================================================

function WeekTimeline({ items }: { items: DashboardWeekItem[] }) {
  const groups: { label: string; items: DashboardWeekItem[] }[] = [
    { label: 'Hoy', items: items.filter((i) => i.days_until_due <= 0) },
    { label: 'Mañana', items: items.filter((i) => i.days_until_due === 1) },
    { label: 'Esta semana', items: items.filter((i) => i.days_until_due > 1) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            {g.label}
          </div>
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            {g.items.map((item) => {
              const Icon = weekIcon(item.type);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <DaysBadge days={item.days_until_due} />
                  <Icon className="w-4 h-4 text-photocan-amber flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.subtitle}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// CARDS DE MÉTRICAS
// ============================================================

function MetricCard({
  title,
  icon,
  link,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
            {title}
          </h3>
        </div>
        {link && (
          <Link
            href={link.href}
            className="text-xs font-mono text-photocan-amber-deep hover:underline inline-flex items-center gap-1"
          >
            {link.label}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function CommercialCard({ stats }: { stats: CommercialPipelineStats }) {
  return (
    <MetricCard
      title="Pipeline comercial"
      icon={<Briefcase className="w-4 h-4 text-photocan-amber" />}
      link={{ href: '/clients', label: 'Ver clientes' }}
    >
      <div className="grid grid-cols-3 gap-3">
        <PipelineStat
          label="Cotizaciones"
          big={stats.draft_quotes + stats.sent_quotes}
          sub={`${stats.sent_quotes} enviadas · ${stats.approved_quotes} aprob.`}
        />
        <PipelineStat
          label="Contratos"
          big={stats.draft_contracts + stats.sent_contracts}
          sub={`${stats.sent_contracts} enviados · ${stats.signed_contracts} firmados`}
        />
        <PipelineStat
          label="Suscripciones"
          big={stats.active_subscriptions}
          sub="activas"
        />
      </div>
      <div className="text-[10px] font-mono text-muted-foreground mt-4 pt-3 border-t border-border">
        {stats.total_clients} clientes totales · {stats.active_clients} con
        suscripción activa
      </div>
    </MetricCard>
  );
}

function PipelineStat({
  label,
  big,
  sub,
}: {
  label: string;
  big: number;
  sub: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{big}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function FinanceCard({ mvm }: { mvm: NonNullable<MonthVsMonth> }) {
  const { income, expenses, profit } = mvm.current_month;
  return (
    <MetricCard
      title={`Finanzas · ${mvm.current_month.label}`}
      icon={<DollarSign className="w-4 h-4 text-photocan-amber" />}
      link={{ href: '/finance', label: 'Ver detalle' }}
    >
      <div className="grid grid-cols-3 gap-3">
        <FinKpi label="Ingresos" value={formatMoney(income)} icon={<TrendingUp className="w-3.5 h-3.5 text-green-500" />} />
        <FinKpi label="Gastos" value={formatMoney(expenses)} icon={<TrendingDown className="w-3.5 h-3.5 text-destructive" />} />
        <FinKpi
          label="Ganancia"
          value={formatMoney(profit)}
          valueClass={profit < 0 ? 'text-destructive' : 'text-green-500'}
        />
      </div>
    </MetricCard>
  );
}

function FinKpi({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-base font-semibold font-mono tabular-nums ${valueClass || ''}`}>
        {value}
      </div>
    </div>
  );
}

const WO_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#6B7280' },
  in_production: { label: 'En producción', color: '#E89A1F' },
  review: { label: 'Revisión', color: '#3B82F6' },
  ready: { label: 'Lista', color: '#22C55E' },
  published: { label: 'Publicada', color: '#16A34A' },
  cancelled: { label: 'Cancelada', color: '#EF4444' },
};
const WO_ORDER = ['pending', 'in_production', 'review', 'ready', 'published', 'cancelled'];

function ProductionCard({ stats }: { stats: ProductionStats }) {
  const entries = WO_ORDER.filter(
    (s) => (stats.work_orders_by_status[s] ?? 0) > 0
  ).map((s) => ({
    status: s,
    count: stats.work_orders_by_status[s],
    ...WO_STATUS_META[s],
  }));
  const woTotal = entries.reduce((sum, e) => sum + e.count, 0);

  return (
    <MetricCard
      title="Producción"
      icon={<Factory className="w-4 h-4 text-photocan-amber" />}
    >
      <div className="space-y-1.5 text-sm mb-4">
        <ProdRow label="Estrategias" value={`${stats.total_strategies} totales · ${stats.approved_strategies} aprobadas`} />
        <ProdRow label="Cronogramas" value={`${stats.total_schedules} totales · ${stats.ready_schedules} listos`} />
        <ProdRow label="Piezas por aprobar" value={String(stats.schedule_items_pending_approval)} />
      </div>

      {woTotal > 0 ? (
        <Link href="/work-orders" className="block group">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            Órdenes de trabajo ({woTotal})
          </div>
          <div className="flex h-2 rounded-full overflow-hidden mb-2">
            {entries.map((e) => (
              <div
                key={e.status}
                style={{ width: `${(e.count / woTotal) * 100}%`, background: e.color }}
                title={`${e.label}: ${e.count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {entries.map((e) => (
              <span key={e.status} className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <span className="w-2 h-2 rounded-sm" style={{ background: e.color }} />
                {e.label} {e.count}
              </span>
            ))}
          </div>
        </Link>
      ) : (
        <div className="text-xs text-muted-foreground">Sin órdenes de trabajo.</div>
      )}
    </MetricCard>
  );
}

function ProdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-right">{value}</span>
    </div>
  );
}

function TeamCard({ workload }: { workload: TeamWorkloadItem[] }) {
  const top = workload.slice(0, 5);
  return (
    <MetricCard
      title="Carga del equipo"
      icon={<Users className="w-4 h-4 text-photocan-amber" />}
      link={{ href: '/team', label: 'Ver equipo' }}
    >
      {top.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Sin tareas asignadas todavía
        </div>
      ) : (
        <div className="space-y-2">
          {top.map((u) => (
            <div key={u.user_id} className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center text-[10px] font-bold text-black flex-shrink-0">
                {initials(u.user_name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u.user_name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {u.pending_count} pend · {u.in_progress_count} prog
                  {u.blocked_count > 0 && (
                    <span className="text-destructive"> · {u.blocked_count} bloq</span>
                  )}
                </div>
              </div>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {u.active_tasks_count}
              </span>
            </div>
          ))}
        </div>
      )}
    </MetricCard>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

// ============================================================
// AUXILIARES
// ============================================================

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground">
          {count} {count === 1 ? 'pendiente' : 'pendientes'}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  text,
}: {
  icon?: React.ReactNode;
  text: string;
}) {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      {icon && <div className="grid place-items-center mb-3">{icon}</div>}
      <div className="text-sm text-muted-foreground">{text}</div>
    </div>
  );
}

function AlertLink({ href, text }: { href: string; text: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-destructive hover:text-photocan-amber-deep transition-colors"
    >
      {text}
      <ArrowRight className="w-3 h-3" />
    </Link>
  );
}
