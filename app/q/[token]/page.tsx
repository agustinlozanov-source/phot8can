import { createServiceClient, createClient } from '@/lib/supabase/server';
import { PublicQuoteView } from './public-quote-view';
import type { QuoteLayer } from '@/lib/types/database';

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const debug: Record<string, unknown> = {
    token_recibido: token,
    token_length: token?.length || 0,
    service_role_existe: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabase_url_existe: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  };

  try {
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = hasServiceRole
      ? await createServiceClient()
      : await createClient();

    debug.cliente_usado = hasServiceRole ? 'service_role' : 'anon (con RLS)';

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('public_share_token', token)
      .maybeSingle();

    debug.query_error = quoteError ? JSON.stringify(quoteError) : null;
    debug.quote_encontrada = !!quote;

    if (quote) {
      debug.quote_id = quote.id;
      debug.quote_folio = quote.folio;
      debug.quote_status = quote.status;
      debug.quote_has_layers = Array.isArray(quote.layers);
    }

    if (quoteError || !quote) {
      return (
        <DebugPage debug={debug} reason="Quote no encontrada o error en query" />
      );
    }

    if (!['sent', 'viewed', 'approved', 'rejected', 'expired'].includes(quote.status)) {
      return (
        <DebugPage debug={debug} reason={`Status no permitido: ${quote.status}`} />
      );
    }

    // Cargar relaciones
    const [clientResult, orgResult, itemsResult, adjustmentsResult, taxesResult] =
      await Promise.all([
        supabase
          .from('clients')
          .select('id, name, legal_name, tax_id')
          .eq('id', quote.client_id)
          .maybeSingle(),
        supabase
          .from('organizations')
          .select('id, name, primary_color, logo_url')
          .eq('id', quote.organization_id)
          .maybeSingle(),
        supabase.from('quote_items').select('*').eq('quote_id', quote.id).order('position'),
        supabase.from('quote_adjustments').select('*').eq('quote_id', quote.id).order('position'),
        supabase.from('quote_taxes').select('*').eq('quote_id', quote.id).order('position'),
      ]);

    debug.client_encontrado = !!clientResult.data;
    debug.org_encontrada = !!orgResult.data;
    debug.items_count = itemsResult.data?.length || 0;

    const quoteWithRelations = {
      ...quote,
      client: clientResult.data ?? null,
      contact: null,
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
  } catch (err) {
    debug.exception = err instanceof Error ? err.message : String(err);
    debug.exception_stack = err instanceof Error ? err.stack : undefined;
    return <DebugPage debug={debug} reason="Excepción no controlada" />;
  }
}

function DebugPage({
  debug,
  reason,
}: {
  debug: Record<string, unknown>;
  reason: string;
}) {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-destructive">
          🔍 Debug: 404 diagnóstico
        </h1>
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded">
          <strong>Razón:</strong> {reason}
        </div>
        <h2 className="text-lg font-semibold mb-2">Información:</h2>
        <pre className="bg-card border border-border rounded p-4 text-xs overflow-auto whitespace-pre-wrap">
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>
    </div>
  );
}
