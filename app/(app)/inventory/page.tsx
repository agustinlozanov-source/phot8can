import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Warehouse,
  ArrowRight,
  Boxes,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Send,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';

export default async function InventoryDashboardPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'inventory.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver el inventario.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Cargar stats en paralelo
  const [warehousesResult, assetsResult, requestsResult] = await Promise.all([
    supabase
      .from('warehouses')
      .select('id, name, type', { count: 'exact' })
      .is('archived_at', null)
      .eq('is_active', true),
    supabase
      .from('assets')
      .select('id, status', { count: 'exact' })
      .is('archived_at', null),
    supabase
      .from('asset_requests')
      .select('id, status', { count: 'exact' }),
  ]);

  const warehouses = warehousesResult.data || [];
  const assets = assetsResult.data || [];
  const requests = requestsResult.data || [];

  const availableCount = assets.filter((a) => a.status === 'available').length;
  const checkedOutCount = assets.filter((a) => a.status === 'checked_out').length;
  const maintenanceCount = assets.filter((a) => a.status === 'in_maintenance').length;
  const lostCount = assets.filter((a) => a.status === 'lost').length;

  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const activeRequests = requests.filter((r) => r.status === 'active').length;

  const canManageWarehouses = hasPermission(ctx, 'inventory.manage_warehouses');
  const canManageAssets = hasPermission(ctx, 'inventory.manage_assets');
  const canRequest = hasPermission(ctx, 'inventory.request_assets');
  const canApprove = hasPermission(ctx, 'inventory.approve_requests');

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Inventario
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Equipos y activos
        </h1>
        <p className="text-muted-foreground text-sm">
          {assets.length} activos · {warehouses.length} almacenes ·{' '}
          {pendingRequests + activeRequests} solicitudes en curso
        </p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-8">
        <StatCard
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          label="Disponibles"
          value={availableCount}
          color="text-green-500"
        />
        <StatCard
          icon={<Send className="w-3.5 h-3.5" />}
          label="En mano"
          value={checkedOutCount}
          color="text-photocan-amber"
        />
        <StatCard
          icon={<Wrench className="w-3.5 h-3.5" />}
          label="En mantenimiento"
          value={maintenanceCount}
          color="text-blue-500"
        />
        <StatCard
          icon={<AlertCircle className="w-3.5 h-3.5" />}
          label="Perdidos"
          value={lostCount}
          color="text-destructive"
        />
      </div>

      {/* Solicitudes destacadas */}
      {(pendingRequests > 0 || activeRequests > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {pendingRequests > 0 && (
            <Link
              href="/inventory/requests?filter=pending"
              className="border border-photocan-amber/40 bg-photocan-amber/5 rounded-lg p-5 hover:bg-photocan-amber/10 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-photocan-amber-deep mb-1">
                  {canApprove ? 'Pendientes de tu aprobación' : 'Tus solicitudes pendientes'}
                </div>
                <div className="text-2xl font-semibold text-photocan-amber-deep">
                  {pendingRequests}
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-photocan-amber-deep group-hover:translate-x-1 transition-transform" />
            </Link>
          )}

          {activeRequests > 0 && (
            <Link
              href="/inventory/requests?filter=active"
              className="border border-border rounded-lg p-5 hover:bg-secondary/30 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Activas (equipos en mano)
                </div>
                <div className="text-2xl font-semibold">{activeRequests}</div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      )}

      {/* Secciones principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard
          href="/inventory/assets"
          icon={<Package className="w-5 h-5" />}
          title="Activos"
          description="Lista completa, búsqueda y filtros"
          count={assets.length}
          cta={canManageAssets ? 'Gestionar' : 'Ver'}
        />

        <SectionCard
          href="/inventory/warehouses"
          icon={<Warehouse className="w-5 h-5" />}
          title="Almacenes"
          description="Ubicaciones físicas o lógicas"
          count={warehouses.length}
          cta={canManageWarehouses ? 'Gestionar' : 'Ver'}
        />

        <SectionCard
          href="/inventory/requests"
          icon={<Boxes className="w-5 h-5" />}
          title="Solicitudes"
          description="Pedir o aprobar equipo"
          count={requests.length}
          cta={canRequest ? 'Solicitar' : 'Ver'}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="p-4 border-r border-border last:border-r-0">
      <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold tracking-tight ${color}`}>
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  href,
  icon,
  title,
  description,
  count,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="border border-border rounded-lg bg-card p-5 hover:border-photocan-amber/40 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center text-photocan-amber-deep">
          {icon}
        </div>
        <div className="text-2xl font-semibold font-mono text-muted-foreground">
          {count}
        </div>
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      <div className="text-xs font-mono text-photocan-amber-deep flex items-center gap-1 group-hover:gap-2 transition-all">
        {cta} →
      </div>
    </Link>
  );
}
