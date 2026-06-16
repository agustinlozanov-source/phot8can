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

  const canManage = hasPermission(ctx, 'subscriptions.manage');
  const canCancel = hasPermission(ctx, 'subscriptions.cancel');

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
        canManage={canManage}
        canCancel={canCancel}
      />
    </div>
  );
}
