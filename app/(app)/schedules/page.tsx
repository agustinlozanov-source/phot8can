import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { SchedulesList } from './schedules-list';

export default async function SchedulesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'schedules.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver cronogramas.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: schedulesRaw } = await supabase
    .from('schedules')
    .select(
      `
      *,
      subscription_period:subscription_periods!schedules_subscription_period_id_fkey(
        period_number, start_date, end_date, status,
        subscription:client_subscriptions!subscription_periods_subscription_id_fkey(
          name, billing_cycle,
          client:clients(id, name, legal_name)
        )
      ),
      creator:users!schedules_created_by_fkey(id, first_name, last_name)
    `
    )
    .order('created_at', { ascending: false });

  const schedules = schedulesRaw || [];

  // Conteo de piezas (total + aprobadas) por cronograma — 1 query y se combina en TS
  const scheduleIds = schedules.map((s) => s.id);
  const countsBySchedule: Record<string, { total: number; approved: number }> =
    {};

  if (scheduleIds.length > 0) {
    const { data: itemRows } = await supabase
      .from('schedule_items')
      .select('schedule_id, status')
      .in('schedule_id', scheduleIds);

    for (const row of itemRows || []) {
      if (!countsBySchedule[row.schedule_id]) {
        countsBySchedule[row.schedule_id] = { total: 0, approved: 0 };
      }
      countsBySchedule[row.schedule_id].total++;
      if (row.status === 'approved') {
        countsBySchedule[row.schedule_id].approved++;
      }
    }
  }

  // Adjuntar los conteos a cada cronograma
  const schedulesWithCounts = schedules.map((s) => ({
    ...s,
    item_total: countsBySchedule[s.id]?.total ?? 0,
    item_approved: countsBySchedule[s.id]?.approved ?? 0,
  }));

  const stats = {
    total: schedules.length,
    pending: schedules.filter(
      (s) => s.status === 'pending' || s.status === 'generating'
    ).length,
    ready: schedules.filter((s) => s.status === 'ready').length,
    failed: schedules.filter((s) => s.status === 'failed').length,
  };

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Producción
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Calendar className="w-7 h-7 text-photocan-amber" />
          Cronograma
        </h1>
        <p className="text-muted-foreground text-sm">
          Calendarios de contenido generados con IA por período de suscripción
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<Calendar className="w-4 h-4" />}
          tone="muted"
        />
        <StatCard
          label="Pendientes"
          value={stats.pending}
          icon={<Clock className="w-4 h-4" />}
          tone="amber"
        />
        <StatCard
          label="Listos"
          value={stats.ready}
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="green"
        />
        <StatCard
          label="Fallidos"
          value={stats.failed}
          icon={<XCircle className="w-4 h-4" />}
          tone="red"
        />
      </div>

      {schedules.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="font-medium mb-2">Sin cronogramas todavía</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Los cronogramas se generan desde el detalle de un período activo de
            una suscripción. Ve a una suscripción activa y abre su período
            actual para generar uno.
          </p>
          <Link
            href="/subscriptions"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Ir a Suscripciones
          </Link>
        </div>
      ) : (
        <SchedulesList schedules={schedulesWithCounts as never} />
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
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
