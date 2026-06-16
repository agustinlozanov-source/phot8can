import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { ScheduleDetail } from './schedule-detail';

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

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

  const { data: schedule } = await supabase
    .from('schedules')
    .select(
      `
      *,
      subscription_period:subscription_periods!schedules_subscription_period_id_fkey(
        period_number, start_date, end_date, status,
        subscription:client_subscriptions!subscription_periods_subscription_id_fkey(
          id, name, billing_cycle,
          client:clients(id, name, legal_name)
        )
      ),
      creator:users!schedules_created_by_fkey(id, first_name, last_name)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!schedule) notFound();

  const { data: items } = await supabase
    .from('schedule_items')
    .select('*')
    .eq('schedule_id', id)
    .order('position');

  const canManage = hasPermission(ctx, 'schedules.manage');
  const canRegenerateAI = hasPermission(ctx, 'schedules.regenerate_ai');

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/schedules"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Cronogramas
      </Link>

      <ScheduleDetail
        schedule={schedule as never}
        items={(items || []) as never}
        canManage={canManage}
        canRegenerateAI={canRegenerateAI}
      />
    </div>
  );
}
