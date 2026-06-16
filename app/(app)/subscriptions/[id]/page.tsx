import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { SubscriptionDetail } from './subscription-detail';

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'subscriptions.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from('client_subscriptions')
    .select(
      `
      *,
      client:clients(id, name),
      source_contract:contracts!client_subscriptions_source_contract_id_fkey(id, folio, title)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!subscription) notFound();

  // Entregables base de la suscripción (plantilla)
  const { data: deliverables } = await supabase
    .from('subscription_deliverables')
    .select('*')
    .eq('subscription_id', id)
    .order('position');

  // Períodos con sus entregables
  const { data: periods } = await supabase
    .from('subscription_periods')
    .select(
      `
      *,
      period_deliverables(*)
    `
    )
    .eq('subscription_id', id)
    .order('period_number', { ascending: false });

  // Cronogramas asociados a los períodos (1 por período como máximo)
  const periodIds = (periods || []).map((p) => p.id);
  const schedulesByPeriod: Record<
    string,
    {
      id: string;
      status: string;
      generated_at: string | null;
      error_message: string | null;
      item_total: number;
      item_approved: number;
    }
  > = {};

  if (periodIds.length > 0) {
    const { data: scheduleRows } = await supabase
      .from('schedules')
      .select('id, subscription_period_id, status, generated_at, error_message')
      .in('subscription_period_id', periodIds);

    const scheduleRowList = scheduleRows || [];
    const scheduleIds = scheduleRowList.map((s) => s.id);

    // Conteo de piezas (total + aprobadas) por cronograma
    const countsBySchedule: Record<
      string,
      { total: number; approved: number }
    > = {};

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

    for (const s of scheduleRowList) {
      schedulesByPeriod[s.subscription_period_id] = {
        id: s.id,
        status: s.status,
        generated_at: s.generated_at,
        error_message: s.error_message,
        item_total: countsBySchedule[s.id]?.total ?? 0,
        item_approved: countsBySchedule[s.id]?.approved ?? 0,
      };
    }
  }

  const canManage = hasPermission(ctx, 'subscriptions.manage');
  const canCancel = hasPermission(ctx, 'subscriptions.cancel');
  const canManageSchedules = hasPermission(ctx, 'schedules.manage');

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/subscriptions"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Suscripciones
      </Link>

      <SubscriptionDetail
        subscription={subscription as never}
        deliverables={(deliverables || []) as never}
        periods={(periods || []) as never}
        schedulesByPeriod={schedulesByPeriod}
        canManage={canManage}
        canCancel={canCancel}
        canManageSchedules={canManageSchedules}
      />
    </div>
  );
}
