import { NextRequest, NextResponse } from 'next/server';
import {
  verifyWebhookSignature,
  resolveWebhookSecret,
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
  try {
    const rawBody = await req.text();

    // FIX 1: el header oficial es X-Zernio-Signature. Aceptamos variantes de
    // casing y el legacy X-Late-Signature por compatibilidad.
    const signature =
      req.headers.get('X-Zernio-Signature') ||
      req.headers.get('x-zernio-signature') ||
      req.headers.get('X-Late-Signature') ||
      '';

    // event_id: header X-Zernio-Event-Id o, si no, payload.id (lo resolvemos
    // tras parsear el body).
    const headerEventId = req.headers.get('X-Zernio-Event-Id');

    let payload: ZernioPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[ZernioWebhook] Body no es JSON válido');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // FIX 1+4: verificar firma con el secret de la org (fallback env en dev)
    const secret = await resolveWebhookSecret(payload as never);
    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      console.error('[ZernioWebhook] Firma inválida');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log(
      '[ZernioWebhook] Event:',
      payload.event,
      '| Account:',
      payload.account?.id
    );

    if (!payload.event) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // FIX 2: idempotencia por event_id. Si Zernio reintenta, evitamos reprocesar.
    const eventId = headerEventId || payload.id || null;
    if (eventId) {
      const claim = await claimWebhookEvent(
        eventId,
        payload.event,
        payload as never
      );
      if (claim.alreadyProcessed) {
        console.log(`[ZernioWebhook] Evento ${eventId} ya procesado — skip`);
        return NextResponse.json({ received: true }, { status: 200 });
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

    // FIX 2: marcar processed_at (con error si lo hubo)
    if (eventId) {
      await markWebhookEventProcessed(eventId, handlerError);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    // NUNCA devolver 500: Zernio reintentaría y duplicaría.
    console.error('[ZernioWebhook] Error:', err);
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}
