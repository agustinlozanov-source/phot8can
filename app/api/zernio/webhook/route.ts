import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignatureGlobal } from '@/lib/zernio-webhook-handler';

interface ZernioPayload {
  id?: string;
  event?: string;
  account?: { id?: string; accountId?: string };
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  console.log('[ZernioWebhook] ===== ENTRY =====');
  const startTime = Date.now();

  // 1. Leer body (rápido)
  const rawBody = await req.text();

  // El header oficial es X-Zernio-Signature; aceptamos variantes de casing y el
  // legacy X-Late-Signature por compatibilidad.
  const signature =
    req.headers.get('X-Zernio-Signature') ||
    req.headers.get('x-zernio-signature') ||
    req.headers.get('X-Late-Signature') ||
    '';
  const eventId =
    req.headers.get('X-Zernio-Event-Id') ||
    req.headers.get('x-zernio-event-id') ||
    null;

  // 2. Parsear (rápido)
  let payload: ZernioPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error('[ZernioWebhook] Body no es JSON válido');
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 3. Verificar firma (CPU local, sin BD → <10ms)
  if (!verifyWebhookSignatureGlobal(rawBody, signature)) {
    console.error('[ZernioWebhook] Firma inválida');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  console.log('[ZernioWebhook] Firma válida, evento:', payload.event);

  // 4. Delegar el procesamiento a una Netlify Background Function (15min).
  //    CLAVE: hay que AWAIT el dispatch del fetch. Un fire-and-forget sin await
  //    se descarta cuando el runtime serverless se congela tras el response, y
  //    la background function nunca recibe la invocación. Las Background
  //    Functions responden 202 al instante (no esperan los 15 min), así que
  //    await-earlo es rápido y garantiza que la request se envía.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_URL ||
    '';

  console.log('[ZernioWebhook] About to trigger background:', baseUrl);
  if (!baseUrl) {
    console.error(
      '[ZernioWebhook] Sin base URL (NEXT_PUBLIC_APP_URL/URL/DEPLOY_URL) — no se puede invocar la background function'
    );
  } else {
    try {
      const bgRes = await fetch(
        `${baseUrl}/.netlify/functions/process-webhook-background`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, eventId }),
        }
      );
      console.log('[ZernioWebhook] BG trigger response:', bgRes.status);
    } catch (err) {
      console.error('[ZernioWebhook] BG trigger failed:', err);
    }
  }

  // 5. RESPONDER 200
  console.log('[ZernioWebhook] Respondido en', Date.now() - startTime, 'ms');
  return NextResponse.json({ received: true }, { status: 200 });
}
