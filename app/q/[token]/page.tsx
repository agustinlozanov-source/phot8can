import { notFound } from 'next/navigation';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { markAsViewedAction } from '@/lib/actions/quotes';
import { PublicQuoteView } from './public-quote-view';
import type { QuoteLayer } from '@/lib/types/database';

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = hasServiceRole
    ? await createServiceClient()
    : await createClient();

  // 1. Query mínima — solo la cotización por token, sin joins
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('public_share_token', token)
    .maybeSingle();

  if (quoteError) {
    console.error('[/q] Error cargando quote:', JSON.stringify(quoteError));
    notFound();
  }
  if (!quote) {
    console.error('[/q] Quote not found for token:', token);
    notFound();
  }

  // 2. Verificar estado
  if (!['sent', 'viewed', 'approved', 'rejected', 'expired'].includes(quote.status)) {
    console.error('[/q] Status no permitido:', quote.status);
    notFound();
  }

  // 3. Cargar relaciones por separado (no dependen de FKs en PostgREST)
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
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('organizations')
        .select('id, name, primary_color, logo_url')
        .eq('id', quote.organization_id)
        .maybeSingle(),
      supabase.from('quote_items').select('*').eq('quote_id', quote.id).order('position'),
      supabase.from('quote_adjustments').select('*').eq('quote_id', quote.id).order('position'),
      supabase.from('quote_taxes').select('*').eq('quote_id', quote.id).order('position'),
    ]);

  if (orgResult.error) {
    console.error('[/q] Error cargando org:', JSON.stringify(orgResult.error));
  }

  // 4. Marcar como vista
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
      quote={quoteWithRelations as any}
      items={itemsResult.data || []}
      adjustments={adjustmentsResult.data || []}
      taxes={taxesResult.data || []}
      layers={layers}
    />
  );
}
