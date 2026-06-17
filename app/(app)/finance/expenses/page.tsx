import { redirect } from 'next/navigation';
import { TrendingDown, Clock, AlertCircle, Tag } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listExpensesAction } from '@/lib/actions/expenses';
import { listVendorsAction } from '@/lib/actions/vendors';
import { listCategoriesAction } from '@/lib/actions/expense-categories';
import { FinanceNav } from '../finance-nav';
import { ExpensesList } from './expenses-list';
import { formatCurrency } from '../finance-ui';

export default async function ExpensesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'expenses.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver gastos.
          </div>
        </div>
      </div>
    );
  }

  const canManage = hasPermission(ctx, 'expenses.manage');

  const [expensesRes, vendorsRes, categoriesRes] = await Promise.all([
    listExpensesAction(),
    listVendorsAction(),
    listCategoriesAction(),
  ]);

  const expenses = ('expenses' in expensesRes ? expensesRes.expenses : []) ?? [];
  const vendors = ('vendors' in vendorsRes ? vendorsRes.vendors : []) ?? [];
  const categories =
    ('categories' in categoriesRes ? categoriesRes.categories : []) ?? [];

  // Stats del mes actual
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = now.toISOString().split('T')[0];
  const inThisMonth = (d: string | null) => !!d && d.slice(0, 7) === ym;

  const currency = expenses.find((e) => e.currency)?.currency || 'MXN';

  const totalMes = expenses
    .filter((e) => e.status === 'paid' && inThisMonth(e.paid_at))
    .reduce((s, e) => s + Number(e.paid_amount ?? e.total), 0);

  const pendientes = expenses
    .filter((e) => e.status === 'pending')
    .reduce((s, e) => s + Number(e.total), 0);

  const vencidos = expenses.filter(
    (e) => e.status === 'pending' && e.due_date && e.due_date < todayStr
  );
  const vencidosTotal = vencidos.reduce((s, e) => s + Number(e.total), 0);

  // Top categoría del mes (por gasto pagado)
  const catSpend: Record<string, number> = {};
  for (const e of expenses) {
    if (e.status === 'paid' && inThisMonth(e.paid_at) && e.category_name_snapshot) {
      catSpend[e.category_name_snapshot] =
        (catSpend[e.category_name_snapshot] || 0) +
        Number(e.paid_amount ?? e.total);
    }
  }
  const topCat = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Administración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <TrendingDown className="w-7 h-7 text-photocan-amber" />
          Gastos
        </h1>
        <p className="text-muted-foreground text-sm">
          Renta, sueldos, software, marketing — todo lo que sale de la empresa
        </p>
      </div>

      <FinanceNav
        canViewCobros={hasPermission(ctx, 'finance.view')}
        canViewExpenses
        canViewReports={hasPermission(ctx, 'finance.view_reports')}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Gastado (mes)" value={formatCurrency(totalMes, currency)} icon={<TrendingDown className="w-4 h-4" />} tone="muted" />
        <Stat label="Pendiente de pagar" value={formatCurrency(pendientes, currency)} icon={<Clock className="w-4 h-4" />} tone="amber" />
        <Stat label="Vencidos" value={`${vencidos.length} · ${formatCurrency(vencidosTotal, currency)}`} icon={<AlertCircle className="w-4 h-4" />} tone="red" />
        <Stat label="Top categoría (mes)" value={topCat ? topCat[0] : '—'} icon={<Tag className="w-4 h-4" />} tone="muted" small />
      </div>

      <ExpensesList
        expenses={expenses as never}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name })) as never}
        categories={
          categories.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
          })) as never
        }
        canManage={canManage}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
  small,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'muted' | 'amber' | 'red';
  small?: boolean;
}) {
  const toneClass = {
    muted: 'text-muted-foreground',
    amber: 'text-photocan-amber',
    red: 'text-destructive',
  }[tone];
  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div
        className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-2 ${toneClass}`}
      >
        {icon}
        {label}
      </div>
      <div
        className={`font-semibold tabular-nums ${small ? 'text-base truncate' : 'text-xl'}`}
      >
        {value}
      </div>
    </div>
  );
}
