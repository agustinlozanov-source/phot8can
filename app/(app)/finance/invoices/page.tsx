import { redirect } from 'next/navigation';
import { Receipt, DollarSign, AlertCircle, Building2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listInvoicesAction } from '@/lib/actions/invoices';
import { InvoicesList } from './invoices-list';
import { FinanceNav } from '../finance-nav';
import { formatCurrency } from '../finance-ui';

export default async function FinancePage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'finance.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver finanzas.
          </div>
        </div>
      </div>
    );
  }

  const canManage = hasPermission(ctx, 'finance.manage');

  const result = await listInvoicesAction();
  const invoices = ('invoices' in result ? result.invoices : []) ?? [];

  // Clientes activos para el modal de cobro manual
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('organization_id', ctx.organization.id)
    .eq('status', 'active')
    .is('archived_at', null)
    .order('name');

  // Stats del mes actual
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const inThisMonth = (d: string | null) => !!d && d.slice(0, 7) === ym;

  const currency =
    invoices.find((i) => i.currency)?.currency || 'MXN';

  const porCobrarMes = invoices
    .filter(
      (i) =>
        (i.status === 'pending' || i.status === 'overdue') &&
        inThisMonth(i.due_date)
    )
    .reduce((sum, i) => sum + Number(i.total), 0);

  const cobradoMes = invoices
    .filter((i) => i.status === 'paid' && inThisMonth(i.paid_at))
    .reduce((sum, i) => sum + Number(i.paid_amount ?? i.total), 0);

  const overdue = invoices.filter((i) => i.status === 'overdue');
  const overdueTotal = overdue.reduce((sum, i) => sum + Number(i.total), 0);

  const clientsWithDebt = new Set(
    invoices
      .filter((i) => i.status === 'pending' || i.status === 'overdue')
      .map((i) => i.client_id)
  ).size;

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Administración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Receipt className="w-7 h-7 text-photocan-amber" />
          Cobros
        </h1>
        <p className="text-muted-foreground text-sm">
          Cobros a clientes — facturas internas y registro de pagos
        </p>
      </div>

      <FinanceNav
        canViewCobros
        canViewExpenses={hasPermission(ctx, 'expenses.view')}
        canViewReports={hasPermission(ctx, 'finance.view_reports')}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat
          label="Por cobrar (mes)"
          value={formatCurrency(porCobrarMes, currency)}
          icon={<Clock className="w-4 h-4" />}
          tone="amber"
        />
        <Stat
          label="Cobrado (mes)"
          value={formatCurrency(cobradoMes, currency)}
          icon={<DollarSign className="w-4 h-4" />}
          tone="green"
        />
        <Stat
          label="Vencidos"
          value={`${overdue.length} · ${formatCurrency(overdueTotal, currency)}`}
          icon={<AlertCircle className="w-4 h-4" />}
          tone="red"
        />
        <Stat
          label="Clientes con saldo"
          value={String(clientsWithDebt)}
          icon={<Building2 className="w-4 h-4" />}
          tone="muted"
        />
      </div>

      <InvoicesList
        invoices={invoices as never}
        clients={(clients || []) as never}
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
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'muted' | 'amber' | 'green' | 'red';
}) {
  const toneClass = {
    muted: 'text-muted-foreground',
    amber: 'text-photocan-amber',
    green: 'text-green-500',
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
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
