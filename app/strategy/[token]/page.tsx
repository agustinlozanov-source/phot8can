import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { markStrategyAsViewedPublicAction } from '@/lib/actions/strategies';
import { StrategyView } from './strategy-view';
import type { StrategyLayer } from '@/lib/types/database';

export default async function StrategyPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createServiceClient();

  const { data: strategy } = await supabase
    .from('strategies')
    .select(
      `
      id, title, status, public_access_token,
      sent_to_client_at, viewed_by_client_at, decided_at,
      approved_by_name, rejection_reason,
      organization_id, client_id,
      client:clients(id, name, legal_name)
    `
    )
    .eq('public_access_token', token)
    .maybeSingle();

  if (!strategy) notFound();

  // Solo permitir ver si está en estado adecuado
  const validStates = ['sent', 'viewed', 'approved', 'rejected'];
  if (!validStates.includes(strategy.status)) {
    return <StrategyNotAvailable />;
  }

  // Cargar las 7 capas (solo las aprobadas - si alguna no está aprobada, no debería estar 'sent')
  const { data: layers } = await supabase
    .from('strategy_layers')
    .select('id, kind, layer_order, title, content_html, status')
    .eq('strategy_id', strategy.id)
    .order('layer_order', { ascending: true });

  // Cargar info de la organización (nombre + color para branding)
  const { data: organization } = await supabase
    .from('organizations')
    .select('name, primary_color, logo_url')
    .eq('id', strategy.organization_id)
    .maybeSingle();

  // Marcar como vista si era 'sent' (cliente abre por primera vez)
  if (strategy.status === 'sent') {
    await markStrategyAsViewedPublicAction(token);
  }

  return (
    <StrategyView
      strategy={strategy as never}
      layers={(layers || []) as StrategyLayer[]}
      organization={{
        name: organization?.name || 'la agencia',
        primaryColor: organization?.primary_color || '#E89A1F',
        logoUrl: organization?.logo_url || null,
      }}
    />
  );
}

// ============================================================
// PANTALLA: ESTRATEGIA NO DISPONIBLE
// ============================================================

function StrategyNotAvailable() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
          <div className="text-2xl text-muted-foreground">×</div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Estrategia no disponible
        </h1>
        <p className="text-muted-foreground">
          Este link no está activo en este momento. Contacta a tu agencia si
          crees que es un error.
        </p>
      </div>
    </div>
  );
}
