import { redirect } from 'next/navigation';
import { Tag } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listCategoriesAction } from '@/lib/actions/expense-categories';
import { FinanceNav } from '../finance-nav';
import { CategoriesList } from './categories-list';

export default async function CategoriesPage() {
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

  const canManage = hasPermission(ctx, 'expenses.manage_vendors');

  const [activeRes, inactiveRes] = await Promise.all([
    listCategoriesAction({ is_active: true }),
    listCategoriesAction({ is_active: false }),
  ]);

  const active = 'categories' in activeRes ? activeRes.categories : [];
  const inactive = 'categories' in inactiveRes ? inactiveRes.categories : [];

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Administración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Tag className="w-7 h-7 text-photocan-amber" />
          Categorías de gasto
        </h1>
        <p className="text-muted-foreground text-sm">
          Organiza en qué se gasta el dinero del negocio
        </p>
      </div>

      <FinanceNav
        canViewCobros={hasPermission(ctx, 'finance.view')}
        canViewExpenses
        canViewReports={hasPermission(ctx, 'finance.view_reports')}
      />

      <CategoriesList
        active={(active || []) as never}
        inactive={(inactive || []) as never}
        canManage={canManage}
      />
    </div>
  );
}
