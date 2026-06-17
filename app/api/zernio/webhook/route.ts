import { NextRequest, NextResponse } from 'next/server';
import {
  verifyWebhookSignature,
  handleMessageReceived,
  handleMessageStatusUpdate,
} from '@/lib/zernio-webhook-handler';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-zernio-signature') || '';

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('[ZernioWebhook] Firma inválida');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    let payload: {
      event?: string;
      account?: { id?: string };
      [key: string]: unknown;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[ZernioWebhook] Body no es JSON válido');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log(
      '[ZernioWebhook] Event:',
      payload.event,
      '| Account:',
      payload.account?.id
    );

    // Validación mínima: si falta algo, igual devolvemos 200 (no reintentar)
    if (!payload.event || !payload.account?.id) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

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
      default:
        console.log('[ZernioWebhook] Evento no manejado:', payload.event);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    // NUNCA devolver 500: Zernio reintentaría y duplicaría.
    console.error('[ZernioWebhook] Error:', err);
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}
