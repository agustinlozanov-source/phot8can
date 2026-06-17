import { redirect } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import {
  getPLReportAction,
  getMonthVsMonthAction,
  getExpensesByCategoryAction,
  getTopVendorsAction,
  getPendingInvoicesReportAction,
  getIncomeByClientAction,
} from '@/lib/actions/finance-reports';
import { FinanceNav } from '../finance-nav';
import { ReportsDashboard } from './reports-dashboard';

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today(): string {
  return new Date().toISOString().split('T')[0];
}

export default async function FinanceReportsPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'finance.view_reports')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver reportes financieros.
          </div>
        </div>
      </div>
    );
  }

  const monthRange = { date_from: startOfMonth(), date_to: today() };

  const [pl, mvm, byCategory, topVendors, pending, byClient] =
    await Promise.all([
      getPLReportAction({ months_back: 6 }),
      getMonthVsMonthAction(),
      getExpensesByCategoryAction(monthRange),
      getTopVendorsAction({ ...monthRange, limit: 10 }),
      getPendingInvoicesReportAction(),
      getIncomeByClientAction({ ...monthRange, limit: 10 }),
    ]);

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Administración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-photocan-amber" />
          Reportes financieros
        </h1>
        <p className="text-muted-foreground text-sm">
          Salud del negocio: ingresos, gastos, ganancia y cobranza
        </p>
      </div>

      <FinanceNav
        canViewCobros={hasPermission(ctx, 'finance.view')}
        canViewExpenses={hasPermission(ctx, 'expenses.view')}
        canViewReports
      />

      <ReportsDashboard
        pl={('data' in pl ? pl.data : []) as never}
        monthVsMonth={('current_month' in mvm ? mvm : null) as never}
        byCategory={
          ('categories' in byCategory ? byCategory : { total: 0, categories: [] }) as never
        }
        topVendors={('vendors' in topVendors ? topVendors.vendors : []) as never}
        pending={
          ('buckets' in pending ? pending : null) as never
        }
        byClient={('clients' in byClient ? byClient.clients : []) as never}
      />
    </div>
  );
}
