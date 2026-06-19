import type { Handler } from '@netlify/functions';
import { processWebhookEvent } from '../../lib/zernio-webhook-handler';

/**
 * Background function: corre hasta 15 minutos.
 * Disparada de forma asíncrona desde /api/zernio/webhook tras devolver 200.
 * Netlify la trata como background porque el nombre termina en "-background".
 *
 * Importa processWebhookEvent desde lib/zernio-webhook-handler, que es lógica
 * pura (sin next/*, con cliente service-role directo), por lo que se bundlea
 * sin problemas.
 */
export const handler: Handler = async (event) => {
  console.log('[process-webhook-bg] Handler entered. ENV check:', {
    has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_zernio: !!process.env.ZERNIO_API_KEY,
    body_length: event.body?.length || 0,
  });

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');
    const { payload, eventId } = body as {
      payload?: unknown;
      eventId?: string | null;
    };

    if (!payload) {
      console.error('[process-webhook-background] Missing payload');
      return { statusCode: 400, body: 'Missing payload' };
    }

    console.log(
      '[process-webhook-bg] Processing event:',
      (payload as { event?: string }).event,
      '| id:',
      eventId ?? null
    );

    await processWebhookEvent(payload as never, eventId ?? null);

    return { statusCode: 200, body: JSON.stringify({ processed: true }) };
  } catch (err) {
    // 200 igualmente: no queremos que Netlify reintente el background job.
    console.error('[process-webhook-background] Error:', err);
    return { statusCode: 200, body: JSON.stringify({ error: String(err) }) };
  }
};
