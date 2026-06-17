import { redirect } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import {
  getMonthVsMonthAction,
  getPendingInvoicesReportAction,
  getExpensesByCategoryAction,
} from '@/lib/actions/finance-reports';
import { listExpensesAction } from '@/lib/actions/expenses';
import { FinanceNav } from './finance-nav';
import { FinanceSummary } from './finance-summary';

const TODAY = () => new Date().toISOString().split('T')[0];

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

  const canViewReports = hasPermission(ctx, 'finance.view_reports');
  const canViewExpenses = hasPermission(ctx, 'expenses.view');

  const [mvm, pending, byCategory, expensesRes] = await Promise.all([
    getMonthVsMonthAction(),
    getPendingInvoicesReportAction(),
    getExpensesByCategoryAction(),
    listExpensesAction({ status: 'pending' }),
  ]);

  const pendingReport = 'buckets' in pending ? pending : null;
  const monthVsMonth = 'current_month' in mvm ? mvm : null;
  const categories =
    'categories' in byCategory ? (byCategory.categories ?? []).slice(0, 5) : [];
  const categoryTotal =
    'total' in byCategory ? (byCategory.total ?? 0) : 0;

  // Próximos cobros: pending/overdue ordenados por vencimiento (ya vienen asc)
  const upcomingInvoices = (pendingReport?.invoices ?? []).slice(0, 5);

  // Próximos pagos: expenses pending ordenados por due_date (nulls al final)
  const allPendingExpenses = 'expenses' in expensesRes ? expensesRes.expenses : [];
  const today = TODAY();
  const upcomingExpenses = [...(allPendingExpenses || [])]
    .sort((a, b) => {
      const ad = a.due_date ?? '9999-12-31';
      const bd = b.due_date ?? '9999-12-31';
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    })
    .slice(0, 5);

  // Alertas
  const overdueInvoicesCount = (pendingReport?.invoices ?? []).filter(
    (i) => i.days_overdue > 0
  ).length;
  const overdueExpenses = (allPendingExpenses || []).filter(
    (e) => e.due_date && e.due_date < today
  );
  const overdueExpensesTotal = overdueExpenses.reduce(
    (s, e) => s + Number(e.total),
    0
  );

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Administración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <LayoutDashboard className="w-7 h-7 text-photocan-amber" />
          Finanzas
        </h1>
        <p className="text-muted-foreground text-sm">
          Resumen ejecutivo del negocio
        </p>
      </div>

      <FinanceNav
        canViewCobros
        canViewExpenses={canViewExpenses}
        canViewReports={canViewReports}
      />

      <FinanceSummary
        monthVsMonth={monthVsMonth as never}
        pending={pendingReport as never}
        upcomingInvoices={upcomingInvoices as never}
        upcomingExpenses={
          upcomingExpenses.map((e) => ({
            id: e.id,
            folio: e.folio,
            vendor_name_snapshot: e.vendor_name_snapshot,
            total: e.total,
            currency: e.currency,
            due_date: e.due_date,
          })) as never
        }
        categories={categories as never}
        categoryTotal={categoryTotal}
        overdueInvoicesCount={overdueInvoicesCount}
        overdueExpensesCount={overdueExpenses.length}
        overdueExpensesTotal={overdueExpensesTotal}
        canViewReports={canViewReports}
      />
    </div>
  );
}
