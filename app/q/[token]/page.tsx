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

  // Usar service role si está configurado, si no fallback a anon
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = hasServiceRole
    ? await createServiceClient()
    : await createClient();

  // Cargar cotización por token
  const { data: quote, error: quoteError } = await supabase
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

  if (quoteError) {
    console.error('[/q/[token]] Supabase error:', quoteError);
    // Si las columnas primary_color/logo_url no existen en el DB real,
    // intentamos una query de fallback sin esas columnas
    const { data: quoteFallback, error: fallbackError } = await supabase
      .from('quotes')
      .select(
        `
        *,
        client:clients(id, name, legal_name, tax_id),
        organization:organizations(id, name),
        contact:contacts(id, first_name, last_name, email, phone, position)
      `
      )
      .eq('public_share_token', token)
      .maybeSingle();

    if (fallbackError) {
      console.error('[/q/[token]] Fallback error:', fallbackError);
      notFound();
    }
    if (!quoteFallback) notFound();

    // Normalizar para que tenga primary_color y logo_url null
    const quoteNormalized = {
      ...quoteFallback,
      organization: quoteFallback.organization
        ? { ...quoteFallback.organization as object, primary_color: null, logo_url: null }
        : null,
    };

    const layers = Array.isArray(quoteNormalized.layers)
      ? (quoteNormalized.layers as unknown as QuoteLayer[])
      : [];

    if (!['sent', 'viewed', 'approved', 'rejected', 'expired'].includes(quoteNormalized.status)) {
      notFound();
    }

    await markAsViewedAction(token);

    const [itemsResult, adjustmentsResult, taxesResult] = await Promise.all([
      supabase.from('quote_items').select('*').eq('quote_id', quoteNormalized.id).order('position'),
      supabase.from('quote_adjustments').select('*').eq('quote_id', quoteNormalized.id).order('position'),
      supabase.from('quote_taxes').select('*').eq('quote_id', quoteNormalized.id).order('position'),
    ]);

    return (
      <PublicQuoteView
        quote={quoteNormalized as any}
        items={itemsResult.data || []}
        adjustments={adjustmentsResult.data || []}
        taxes={taxesResult.data || []}
        layers={layers}
      />
    );
  }

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
