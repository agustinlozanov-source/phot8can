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

  const supabase = await createServiceClient();

  // 1. Cargar cotización por token
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('public_share_token', token)
    .maybeSingle();

  if (!quote) notFound();

  // 2. Solo permitir ver si está enviada/vista/decidida
  if (!['sent', 'viewed', 'approved', 'rejected', 'expired'].includes(quote.status)) {
    notFound();
  }

  // 3. Cargar relaciones en paralelo
  const [clientResult, contactResult, orgResult, itemsResult, adjustmentsResult, taxesResult] =
    await Promise.all([
      supabase
        .from('clients')
        .select('id, name, legal_name, tax_id')
        .eq('id', quote.client_id)
        .maybeSingle(),
      quote.contact_id
        ? supabase
            .from('contacts')
            .select('id, first_name, last_name, email, phone, position')
            .eq('id', quote.contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('organizations')
        .select('id, name, primary_color, logo_url')
        .eq('id', quote.organization_id)
        .maybeSingle(),
      supabase.from('quote_items').select('*').eq('quote_id', quote.id).order('position'),
      supabase.from('quote_adjustments').select('*').eq('quote_id', quote.id).order('position'),
      supabase.from('quote_taxes').select('*').eq('quote_id', quote.id).order('position'),
    ]);

  // 4. Marcar como vista (idempotente: solo cambia si está en 'sent')
  await markAsViewedAction(token);

  const quoteWithRelations = {
    ...quote,
    client: clientResult.data ?? null,
    contact: contactResult.data ?? null,
    organization: orgResult.data ?? null,
  };

  const layers = Array.isArray(quote.layers)
    ? (quote.layers as unknown as QuoteLayer[])
    : [];

  return (
    <PublicQuoteView
      quote={quoteWithRelations as never}
      items={itemsResult.data || []}
      adjustments={adjustmentsResult.data || []}
      taxes={taxesResult.data || []}
      layers={layers}
    />
  );
}
