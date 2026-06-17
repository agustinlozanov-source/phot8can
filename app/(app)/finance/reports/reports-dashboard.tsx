'use client';

import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Building2,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  CategoryIcon,
  InvoiceStatusBadge,
} from '../finance-ui';

const CCY = 'MXN';

type PLMonth = {
  month: string;
  month_label: string;
  income: number;
  expenses: number;
  profit: number;
};

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

type CategorySlice = {
  category_id: string | null;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  total: number;
  count: number;
  percentage: number;
};

type Vendor = {
  vendor_id: string | null;
  vendor_name: string;
  total: number;
  count: number;
  last_payment_date: string | null;
};

type PendingReport = {
  total_pending: number;
  total_overdue: number;
  buckets: {
    not_due_yet: { count: number; total: number };
    overdue_0_30: { count: number; total: number };
    overdue_31_60: { count: number; total: number };
    overdue_60_plus: { count: number; total: number };
  };
  invoices: Array<{
    id: string;
    folio: string;
    total: number;
    currency: string;
    status: 'pending' | 'overdue';
    due_date: string;
    days_overdue: number;
    client: { id: string; name: string } | null;
  }>;
} | null;

type ClientIncome = {
  client_id: string;
  client_name: string;
  total_invoiced: number;
  total_paid: number;
  total_pending: number;
  invoice_count: number;
};

interface Props {
  pl: PLMonth[];
  monthVsMonth: MonthVsMonth;
  byCategory: { total: number; categories: CategorySlice[] };
  topVendors: Vendor[];
  pending: PendingReport;
  byClient: ClientIncome[];
}

export function ReportsDashboard({
  pl,
  monthVsMonth,
  byCategory,
  topVendors,
  pending,
  byClient,
}: Props) {
  return (
    <div className="space-y-6">
      {monthVsMonth && <MonthSummary mvm={monthVsMonth} />}
      <PLSection pl={pl} />
      <CategorySection data={byCategory} />
      <VendorsSection vendors={topVendors} />
      {pending && <AgingSection report={pending} />}
      <ClientsSection clients={byClient} />
    </div>
  );
}

// ============================================================
// SECCIÓN 1 — RESUMEN DEL MES
// ============================================================

function MonthSummary({ mvm }: { mvm: NonNullable<MonthVsMonth> }) {
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground mb-3">
        {mvm.current_month.label} vs {mvm.previous_month.label}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          label="Ingresos"
          icon={<DollarSign className="w-4 h-4" />}
          current={mvm.current_month.income}
          previous={mvm.previous_month.income}
          pct={mvm.comparison.income_change_pct}
          positiveIsGood
        />
        <SummaryCard
          label="Gastos"
          icon={<Receipt className="w-4 h-4" />}
          current={mvm.current_month.expenses}
          previous={mvm.previous_month.expenses}
          pct={mvm.comparison.expenses_change_pct}
          positiveIsGood={false}
        />
        <SummaryCard
          label="Ganancia"
          icon={<TrendingUp className="w-4 h-4" />}
          current={mvm.current_month.profit}
          previous={mvm.previous_month.profit}
          pct={mvm.comparison.profit_change_pct}
          positiveIsGood
        />
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  icon,
  current,
  previous,
  pct,
  positiveIsGood,
}: {
  label: string;
  icon: React.ReactNode;
  current: number;
  previous: number;
  pct: number;
  positiveIsGood: boolean;
}) {
  const up = pct > 0;
  const flat = pct === 0;
  const good = flat ? null : up === positiveIsGood;
  const toneClass = flat
    ? 'text-muted-foreground'
    : good
      ? 'text-green-500'
      : 'text-destructive';

  return (
    <div className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
        {icon}
        {label}
      </div>
      <div
        className={`text-2xl font-semibold tabular-nums font-mono ${current < 0 ? 'text-destructive' : ''}`}
      >
        {formatCurrency(current, CCY)}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground font-mono">
          antes {formatCurrency(previous, CCY)}
        </span>
        <span className={`inline-flex items-center gap-0.5 text-xs font-mono ${toneClass}`}>
          {flat ? (
            <Minus className="w-3 h-3" />
          ) : up ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {Math.abs(pct)}%
        </span>
      </div>
    </div>
  );
}

// ============================================================
// SECCIÓN 2 — P&L MENSUAL (bar chart SVG)
// ============================================================

function PLSection({ pl }: { pl: PLMonth[] }) {
  const maxVal = Math.max(
    1,
    ...pl.flatMap((m) => [m.income, m.expenses, Math.max(m.profit, 0)])
  );

  // Layout SVG
  const W = 720;
  const H = 220;
  const padB = 24;
  const padT = 10;
  const chartH = H - padB - padT;
  const groupW = W / Math.max(pl.length, 1);
  const barW = Math.min(18, groupW / 5);

  return (
    <section className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-photocan-amber" />
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
          P&amp;L últimos {pl.length} meses
        </h2>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mb-2 text-[10px] font-mono text-muted-foreground">
        <LegendDot color="#22C55E" label="Ingresos" />
        <LegendDot color="#EF4444" label="Gastos" />
        <LegendDot color="#E89A1F" label="Ganancia" />
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" style={{ height: 220 }}>
          {/* baseline */}
          <line x1={0} y1={padT + chartH} x2={W} y2={padT + chartH} stroke="currentColor" className="text-border" strokeWidth={1} />
          {pl.map((m, i) => {
            const gx = i * groupW + groupW / 2;
            const bars = [
              { v: m.income, color: '#22C55E', off: -barW - 2 },
              { v: m.expenses, color: '#EF4444', off: 0 },
              { v: Math.max(m.profit, 0), color: '#E89A1F', off: barW + 2 },
            ];
            return (
              <g key={m.month}>
                {bars.map((b, j) => {
                  const h = (b.v / maxVal) * chartH;
                  return (
                    <rect
                      key={j}
                      x={gx + b.off - barW / 2}
                      y={padT + chartH - h}
                      width={barW}
                      height={h}
                      rx={2}
                      fill={b.color}
                    >
                      <title>
                        {b.color === '#22C55E'
                          ? `Ingresos: ${formatCurrency(m.income, CCY)}`
                          : b.color === '#EF4444'
                            ? `Gastos: ${formatCurrency(m.expenses, CCY)}`
                            : `Ganancia: ${formatCurrency(m.profit, CCY)}`}
                      </title>
                    </rect>
                  );
                })}
                <text
                  x={gx}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 10, fontFamily: 'monospace' }}
                >
                  {m.month_label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tabla */}
      <div className="border border-border rounded-md overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <Th>Mes</Th>
              <Th className="text-right">Ingresos</Th>
              <Th className="text-right">Gastos</Th>
              <Th className="text-right">Ganancia</Th>
            </tr>
          </thead>
          <tbody>
            {pl.map((m) => (
              <tr key={m.month} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{m.month_label}</td>
                <td className="px-3 py-2 text-right font-mono text-green-500">
                  {formatCurrency(m.income, CCY)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-destructive">
                  {formatCurrency(m.expenses, CCY)}
                </td>
                <td className={`px-3 py-2 text-right font-mono font-medium ${m.profit < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {formatCurrency(m.profit, CCY)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================
// SECCIÓN 3 — GASTOS POR CATEGORÍA (donut)
// ============================================================

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function slicePath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

function CategorySection({
  data,
}: {
  data: { total: number; categories: CategorySlice[] };
}) {
  const router = useRouter();
  let acc = 0;
  const slices = data.categories.map((c) => {
    const start = (acc / Math.max(data.total, 1)) * 360;
    acc += c.total;
    const end = (acc / Math.max(data.total, 1)) * 360;
    return { ...c, start, end };
  });

  return (
    <section className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-4 h-4 text-photocan-amber" />
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
          Gastos por categoría (mes)
        </h2>
      </div>

      {data.categories.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Sin gastos pagados este mes.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Donut */}
          <div className="relative grid place-items-center">
            <svg viewBox="0 0 200 200" className="w-48 h-48">
              {slices.map((s) => (
                <path key={s.category_id ?? s.category_name} d={slicePath(100, 100, 90, s.start, s.end)} fill={s.category_color}>
                  <title>{`${s.category_name}: ${formatCurrency(s.total, CCY)} (${s.percentage}%)`}</title>
                </path>
              ))}
              <circle cx={100} cy={100} r={55} className="fill-card" />
            </svg>
            <div className="absolute text-center">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Total mes
              </div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {formatCurrency(data.total, CCY)}
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <Th>Categoría</Th>
                  <Th className="text-center">Gastos</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">%</Th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr
                    key={c.category_id ?? c.category_name}
                    onClick={() =>
                      c.category_id &&
                      router.push(`/finance/expenses?category=${c.category_id}`)
                    }
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded"
                        style={{ background: `${c.category_color}1a`, color: c.category_color }}
                      >
                        <CategoryIcon name={c.category_icon} size={12} />
                        {c.category_name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{c.count}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(c.total, CCY)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{c.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// SECCIÓN 4 — TOP PROVEEDORES
// ============================================================

function VendorsSection({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter();
  return (
    <section className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4 text-photocan-amber" />
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
          Top proveedores (mes)
        </h2>
      </div>
      {vendors.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Sin pagos a proveedores este mes.
        </div>
      ) : (
        <div className="space-y-1">
          {vendors.map((v, i) => (
            <div
              key={v.vendor_name + i}
              onClick={() => v.vendor_id && router.push(`/finance/vendors/${v.vendor_id}`)}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-md ${
                v.vendor_id ? 'cursor-pointer hover:bg-secondary/40' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{v.vendor_name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {v.count} {v.count === 1 ? 'pago' : 'pagos'}
                    {v.last_payment_date && ` · último ${formatDate(v.last_payment_date.slice(0, 10))}`}
                  </div>
                </div>
              </div>
              <div className="font-mono font-medium tabular-nums">
                {formatCurrency(v.total, CCY)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// SECCIÓN 5 — AGING DE COBROS
// ============================================================

function AgingSection({ report }: { report: NonNullable<PendingReport> }) {
  const router = useRouter();
  return (
    <section className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-photocan-amber" />
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
          Cobros pendientes (aging)
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-border rounded-md p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Total pendiente
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums">
            {formatCurrency(report.total_pending, CCY)}
          </div>
        </div>
        <div className="border border-border rounded-md p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Total vencido
          </div>
          <div className={`text-2xl font-semibold font-mono tabular-nums ${report.total_overdue > 0 ? 'text-destructive' : ''}`}>
            {formatCurrency(report.total_overdue, CCY)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Bucket label="Por vencer" b={report.buckets.not_due_yet} tone="muted" />
        <Bucket label="0-30 días" b={report.buckets.overdue_0_30} tone="amber" />
        <Bucket label="31-60 días" b={report.buckets.overdue_31_60} tone="orange" />
        <Bucket label="60+ días" b={report.buckets.overdue_60_plus} tone="red" />
      </div>

      {report.invoices.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <Th>Folio</Th>
                <Th>Cliente</Th>
                <Th className="text-right">Total</Th>
                <Th>Vence</Th>
                <Th className="text-right">Días vencido</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {report.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/finance/${inv.id}`)}
                  className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-xs font-medium">{inv.folio}</td>
                  <td className="px-3 py-2">{inv.client?.name || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(Number(inv.total), inv.currency)}</td>
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{formatDate(inv.due_date)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${inv.days_overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {inv.days_overdue > 0 ? `${inv.days_overdue}d` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Bucket({
  label,
  b,
  tone,
}: {
  label: string;
  b: { count: number; total: number };
  tone: 'muted' | 'amber' | 'orange' | 'red';
}) {
  const toneClass = {
    muted: 'text-muted-foreground',
    amber: 'text-photocan-amber-deep',
    orange: 'text-orange-500',
    red: 'text-destructive',
  }[tone];
  return (
    <div className="border border-border rounded-md p-3">
      <div className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${toneClass}`}>
        {label}
      </div>
      <div className="font-mono font-semibold tabular-nums">{formatCurrency(b.total, CCY)}</div>
      <div className="text-[10px] font-mono text-muted-foreground">
        {b.count} {b.count === 1 ? 'cobro' : 'cobros'}
      </div>
    </div>
  );
}

// ============================================================
// SECCIÓN 6 — INGRESOS POR CLIENTE
// ============================================================

function ClientsSection({ clients }: { clients: ClientIncome[] }) {
  const router = useRouter();
  return (
    <section className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-photocan-amber" />
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
          Ingresos por cliente (mes)
        </h2>
      </div>
      {clients.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Sin cobros registrados este mes.
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c, i) => {
            const pct =
              c.total_invoiced > 0
                ? Math.round((c.total_paid / c.total_invoiced) * 100)
                : 0;
            return (
              <div
                key={c.client_id}
                onClick={() => router.push(`/clients/${c.client_id}`)}
                className="px-3 py-2.5 rounded-md cursor-pointer hover:bg-secondary/40"
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                    <span className="font-medium truncate">{c.client_name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-medium text-green-500 tabular-nums">
                      {formatCurrency(c.total_paid, CCY)}
                    </div>
                    {c.total_pending > 0 && (
                      <div className="text-[10px] font-mono text-photocan-amber-deep">
                        {formatCurrency(c.total_pending, CCY)} pendiente
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================
// AUXILIARES
// ============================================================

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground ${className || 'text-left'}`}>
      {children}
    </th>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
