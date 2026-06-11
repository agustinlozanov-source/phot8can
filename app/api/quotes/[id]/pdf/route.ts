import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { QuoteDocument } from '@/lib/pdf/quote-document';
import type { QuoteLayer } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quoteId } = await params;
  const url = new URL(request.url);
  const publicToken = url.searchParams.get('token');

  let supabase;
  let isPublicAccess = false;

  // Modo 1: acceso público con token
  if (publicToken) {
    supabase = await createServiceClient();
    isPublicAccess = true;
  } else {
    // Modo 2: acceso autenticado (RLS valida la pertenencia a la org)
    supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
  }

  // Cargar cotización
  let quoteQuery = supabase.from('quotes').select('*').eq('id', quoteId);

  if (isPublicAccess && publicToken) {
    quoteQuery = quoteQuery.eq('public_share_token', publicToken);
  }

  const { data: quote, error: quoteError } = await quoteQuery.maybeSingle();

  if (quoteError || !quote) {
    return NextResponse.json(
      { error: 'Cotización no encontrada' },
      { status: 404 }
    );
  }

  // En modo público, validar estado
  if (
    isPublicAccess &&
    !['sent', 'viewed', 'approved', 'rejected', 'expired'].includes(quote.status)
  ) {
    return NextResponse.json(
      { error: 'Esta cotización no está disponible' },
      { status: 403 }
    );
  }

  // Cargar relaciones en paralelo
  const [clientResult, orgResult, itemsResult, adjustmentsResult, taxesResult] =
    await Promise.all([
      supabase
        .from('clients')
        .select('id, name, legal_name, tax_id')
        .eq('id', quote.client_id)
        .maybeSingle(),
      supabase
        .from('organizations')
        .select('id, name, primary_color')
        .eq('id', quote.organization_id)
        .maybeSingle(),
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

  // Generar PDF
  try {
    const doc = QuoteDocument({
      quote,
      client: clientResult.data,
      organization: orgResult.data,
      items: itemsResult.data || [],
      adjustments: adjustmentsResult.data || [],
      taxes: taxesResult.data || [],
      layers,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(doc as any);

    const filename = `${quote.folio}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Error generando PDF:', err);
    return NextResponse.json(
      {
        error: 'Error al generar PDF',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
