import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listVendorsAction } from '@/lib/actions/vendors';
import { FinanceNav } from '../finance-nav';
import { VendorsList } from './vendors-list';

export default async function VendorsPage() {
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

  // Activos e inactivos para poder togglear en cliente
  const [activeRes, inactiveRes] = await Promise.all([
    listVendorsAction({ is_active: true }),
    listVendorsAction({ is_active: false }),
  ]);

  const active = 'vendors' in activeRes ? activeRes.vendors : [];
  const inactive = 'vendors' in inactiveRes ? inactiveRes.vendors : [];
  const vendors = [...(active || []), ...(inactive || [])];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Administración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Building2 className="w-7 h-7 text-photocan-amber" />
          Proveedores
        </h1>
        <p className="text-muted-foreground text-sm">
          Quién recibe los pagos del negocio
        </p>
      </div>

      <FinanceNav
        canViewCobros={hasPermission(ctx, 'finance.view')}
        canViewExpenses
        canViewReports={hasPermission(ctx, 'finance.view_reports')}
      />

      <VendorsList vendors={vendors as never} canManage={canManage} />
    </div>
  );
}
