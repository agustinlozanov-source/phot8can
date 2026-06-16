import { redirect } from 'next/navigation';
import { Repeat } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { SubscriptionsList } from './subscriptions-list';

export default async function SubscriptionsPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

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

  const { data: subscriptions } = await supabase
    .from('client_subscriptions')
    .select(
      `
      *,
      client:clients(id, name),
      source_contract:contracts!client_subscriptions_source_contract_id_fkey(id, folio)
    `
    )
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Suscripciones
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Servicios recurrentes
        </h1>
        <p className="text-muted-foreground text-sm">
          {(subscriptions || []).length} suscripciones en total
        </p>
      </div>

      {(subscriptions || []).length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Repeat className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin suscripciones todavía</div>
          <div className="text-sm text-muted-foreground">
            Las suscripciones se crean desde un contrato firmado. Abre el
            detalle de un contrato firmado y usa{' '}
            <span className="text-foreground font-medium">
              «Crear suscripción»
            </span>{' '}
            para empezar a gestionar sus entregables por período.
          </div>
        </div>
      ) : (
        <SubscriptionsList subscriptions={(subscriptions || []) as never} />
      )}
    </div>
  );
}
