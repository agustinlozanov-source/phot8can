import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, Clock, Eye, CheckCircle2, Send, Settings } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listWorkOrdersAction } from '@/lib/actions/work-orders';
import { WorkOrdersList } from './work-orders-list';

export default async function WorkOrdersPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  const canView = hasPermission(ctx, 'work_orders.view');
  const canViewOwn = hasPermission(ctx, 'work_orders.view_own');

  if (!canView && !canViewOwn) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver órdenes de trabajo.
          </div>
        </div>
      </div>
    );
  }

  const canManageRules = hasPermission(ctx, 'work_orders.manage_rules');

  const result = await listWorkOrdersAction();
  const workOrders = ('workOrders' in result ? result.workOrders : []) ?? [];

  const stats = {
    total: workOrders.length,
    pending: workOrders.filter(
      (w) => w.status === 'pending' || w.status === 'in_production'
    ).length,
    review: workOrders.filter((w) => w.status === 'review').length,
    ready: workOrders.filter((w) => w.status === 'ready').length,
    published: workOrders.filter((w) => w.status === 'published').length,
  };

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Producción
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-photocan-amber" />
            Órdenes de trabajo
          </h1>
          <p className="text-muted-foreground text-sm">
            Producción de las piezas aprobadas del cronograma
          </p>
        </div>

        {canManageRules && (
          <Link
            href="/work-orders/rules"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configurar reglas
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Total" value={stats.total} icon={<ClipboardList className="w-4 h-4" />} tone="muted" />
        <StatCard label="Pendientes" value={stats.pending} icon={<Clock className="w-4 h-4" />} tone="amber" />
        <StatCard label="En revisión" value={stats.review} icon={<Eye className="w-4 h-4" />} tone="blue" />
        <StatCard label="Listas" value={stats.ready} icon={<CheckCircle2 className="w-4 h-4" />} tone="green" />
        <StatCard label="Publicadas" value={stats.published} icon={<Send className="w-4 h-4" />} tone="green" />
      </div>

      {workOrders.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
            <ClipboardList className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="font-medium mb-2">Sin órdenes de trabajo todavía</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Las OTs se crean desde el detalle de un cronograma con piezas
            aprobadas. Ve a Cronograma → abre un cronograma → click{' '}
            <strong>«Convertir aprobadas en OTs»</strong>.
          </p>
          <Link
            href="/schedules"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Ir a Cronograma
          </Link>
        </div>
      ) : (
        <WorkOrdersList workOrders={workOrders as never} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'muted' | 'amber' | 'green' | 'blue';
}) {
  const toneClass = {
    muted: 'text-muted-foreground',
    amber: 'text-photocan-amber',
    green: 'text-green-500',
    blue: 'text-blue-500',
  }[tone];

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div
        className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-2 ${toneClass}`}
      >
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
