import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignatureGlobal } from '@/lib/zernio-webhook-handler';

interface ZernioPayload {
  id?: string;
  event?: string;
  account?: { id?: string; accountId?: string };
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
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
  //    El fire-and-forget directo NO sirve en serverless: Netlify congela el
  //    runtime tras el response y la promise flotante nunca completa. La
  //    background function garantiza la ejecución post-response.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.URL || process.env.DEPLOY_URL || '';

  fetch(`${baseUrl}/.netlify/functions/process-webhook-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, eventId }),
  }).catch((err) =>
    console.error('[ZernioWebhook] Failed to trigger background:', err)
  );

  // 5. RESPONDER 200 INMEDIATAMENTE
  console.log('[ZernioWebhook] Respondido en', Date.now() - startTime, 'ms');
  return NextResponse.json({ received: true }, { status: 200 });
}
