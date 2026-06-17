import { redirect } from 'next/navigation';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { getDashboardSummaryAction } from '@/lib/actions/dashboard';
import { getMonthVsMonthAction } from '@/lib/actions/finance-reports';
import { DashboardView } from './dashboard-view';

const DASHBOARD_PERMS = [
  'clients.view',
  'work_orders.view',
  'finance.view',
  'strategy.view',
];

export default async function DashboardPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  const canSeeDashboard = DASHBOARD_PERMS.some((p) => hasPermission(ctx, p));
  if (!canSeeDashboard) redirect('/my-work');

  const canViewFinance = hasPermission(ctx, 'finance.view');

  const [summary, mvm] = await Promise.all([
    getDashboardSummaryAction(),
    canViewFinance ? getMonthVsMonthAction() : Promise.resolve(null),
  ]);

  const monthVsMonth = mvm && 'current_month' in mvm ? mvm : null;

  const firstName =
    ctx.mode === 'user' && ctx.user ? ctx.user.first_name : 'Director';

  return (
    <DashboardView
      firstName={firstName}
      summary={summary as never}
      monthVsMonth={monthVsMonth as never}
      canViewFinance={canViewFinance}
      canViewTeam={hasPermission(ctx, 'team.view')}
    />
  );
}
