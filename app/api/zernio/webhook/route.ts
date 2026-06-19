import { NextRequest, NextResponse } from 'next/server';
import {
  verifyWebhookSignatureGlobal,
  claimWebhookEvent,
  markWebhookEventProcessed,
  handleMessageReceived,
  handleMessageStatusUpdate,
  handleMessageFailed,
  handleConversationStarted,
  handleAccountConnected,
  handleAccountDisconnected,
  handleWhatsappNumberActivated,
} from '@/lib/zernio-webhook-handler';

interface ZernioPayload {
  id?: string;
  event?: string;
  account?: { id?: string };
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

  // 4. Disparar procesamiento en background SIN await (fire-and-forget).
  //    Riesgo conocido en serverless: el runtime puede congelarse tras el
  //    response. El trabajo pesado real (el agente IA) ya corre en su propia
  //    Netlify Background Function, así que aquí solo persistimos el mensaje.
  processInBackground(payload, eventId).catch((err) =>
    console.error('[ZernioWebhook] Background error:', err)
  );

  // 5. RESPONDER 200 INMEDIATAMENTE
  console.log('[ZernioWebhook] Respondido en', Date.now() - startTime, 'ms');
  return NextResponse.json({ received: true }, { status: 200 });
}

// ============================================================
// PROCESAMIENTO EN BACKGROUND (post-response)
// ============================================================

async function processInBackground(
  payload: ZernioPayload,
  eventId: string | null
) {
  if (!payload.event) return;

  // Idempotencia por event_id (header X-Zernio-Event-Id o payload.id).
  const id = eventId || payload.id || null;
  if (id) {
    const claim = await claimWebhookEvent(id, payload.event, payload as never);
    if (claim.alreadyProcessed) {
      console.log(`[ZernioWebhook] Evento ${id} ya procesado — skip`);
      return;
    }
  } else {
    console.warn(
      '[ZernioWebhook] Evento sin id — no se puede deduplicar, se procesa igual'
    );
  }

  let handlerError: string | null = null;
  try {
    switch (payload.event) {
      case 'message.received':
        await handleMessageReceived(payload as never);
        break;
      case 'message.sent':
        await handleMessageStatusUpdate(payload as never, 'sent');
        break;
      case 'message.delivered':
        await handleMessageStatusUpdate(payload as never, 'delivered');
        break;
      case 'message.read':
        await handleMessageStatusUpdate(payload as never, 'read');
        break;
      case 'message.failed':
        await handleMessageFailed(payload as never);
        break;
      case 'conversation.started':
        await handleConversationStarted(payload as never);
        break;
      case 'account.connected':
        await handleAccountConnected(payload as never);
        break;
      case 'account.disconnected':
        await handleAccountDisconnected(payload as never);
        break;
      case 'whatsapp.number.activated':
        await handleWhatsappNumberActivated(payload as never);
        break;
      default:
        console.log('[ZernioWebhook] Evento no manejado:', payload.event);
    }
  } catch (err) {
    handlerError = err instanceof Error ? err.message : 'Error procesando';
    console.error('[ZernioWebhook] Error en handler:', err);
  }

  if (id) {
    await markWebhookEventProcessed(id, handlerError);
  }
}
