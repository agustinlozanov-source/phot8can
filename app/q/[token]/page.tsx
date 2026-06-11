import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { markAsViewedAction } from '@/lib/actions/quotes';
import { PublicQuoteView } from './public-quote-view';
import type { QuoteLayer } from '@/lib/types/database';

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Cliente con service role para acceso público (sin RLS)
  const supabase = await createServiceClient();

  // Cargar cotización por token
  const { data: quote } = await supabase
    .from('quotes')
    .select(
      `
      *,
      client:clients(id, name, legal_name, tax_id),
      organization:organizations(id, name, primary_color, logo_url),
      contact:contacts(id, first_name, last_name, email, phone, position)
    `
    )
    .eq('public_share_token', token)
    .maybeSingle();

  if (!quote) notFound();

  // Solo permitir ver si está enviada, vista, aprobada o rechazada
  if (!['sent', 'viewed', 'approved', 'rejected', 'expired'].includes(quote.status)) {
    notFound();
  }

  // Marcar como vista (solo cambia si está en 'sent' y no tiene viewed_at)
  await markAsViewedAction(token);

  // Cargar items, ajustes, impuestos
  const [itemsResult, adjustmentsResult, taxesResult] = await Promise.all([
    supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id)
      .order('position'),
    supabase
      .from('quote_adjustments')
      .select('*')
      .eq('quote_id', quote.id)
      .order('position'),
    supabase
      .from('quote_taxes')
      .select('*')
      .eq('quote_id', quote.id)
      .order('position'),
  ]);

  const layers = Array.isArray(quote.layers)
    ? (quote.layers as unknown as QuoteLayer[])
    : [];

  return (
    <PublicQuoteView
      quote={quote as any}
      items={itemsResult.data || []}
      adjustments={adjustmentsResult.data || []}
      taxes={taxesResult.data || []}
      layers={layers}
    />
  );
}
