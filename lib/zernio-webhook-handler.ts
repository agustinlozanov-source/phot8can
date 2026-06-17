/**
 * Procesamiento de webhooks entrantes de Zernio.
 * NO es server action — lo invoca el route handler /api/zernio/webhook.
 * Usa createServiceClient porque el webhook no tiene sesión de usuario.
 */

import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// TIPOS DEL PAYLOAD DE ZERNIO
// ============================================================

interface ZernioWebhookPayload {
  id?: string;
  event: string;
  timestamp?: string;
  message?: {
    id: string;
    conversationId?: string;
    platform?: string;
    platformMessageId?: string;
    direction?: string;
    text?: string;
    attachments?: unknown[];
    sender?: {
      id?: string;
      name?: string;
      phoneNumber?: string;
      username?: string;
    };
    sentAt?: string;
    isRead?: boolean;
  };
  conversation?: {
    id: string;
    platform?: string;
    platformConversationId?: string;
    participantId?: string;
    participantName?: string;
    participantUsername?: string;
    status?: string;
  };
  account?: {
    id: string;
    platform?: string;
    username?: string;
    displayName?: string;
  };
}

// ============================================================
// VERIFICACIÓN DE FIRMA
// ============================================================

export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      '[ZernioWebhook] ZERNIO_WEBHOOK_SECRET no configurado — saltando verificación (modo dev)'
    );
    return true;
  }
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================================
// HELPER: auto-match de cliente por teléfono (vía contacts)
// ============================================================

async function matchClientByPhone(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  orgId: string,
  phoneNumber: string | undefined | null
): Promise<string | null> {
  if (!phoneNumber) return null;

  const digits = phoneNumber.replace(/[^\d]/g, '');
  const candidates = Array.from(
    new Set([phoneNumber, phoneNumber.replace('+', ''), digits])
  ).filter(Boolean);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('phone, client:clients(id, organization_id)')
    .in('phone', candidates);

  for (const c of contacts || []) {
    const client = c.client as unknown as {
      id: string;
      organization_id: string;
    } | null;
    if (client && client.organization_id === orgId) return client.id;
  }
  return null;
}

// ============================================================
// 1. MENSAJE ENTRANTE
// ============================================================

export async function handleMessageReceived(payload: ZernioWebhookPayload) {
  const supabase = await createServiceClient();

  const accountId = payload.account?.id;
  const msg = payload.message;
  const conv = payload.conversation;

  if (!accountId || !msg?.id || !conv?.id) {
    console.warn('[ZernioWebhook] message.received con payload incompleto');
    return;
  }

  // a) Identificar la organización vía el canal
  const { data: channel } = await supabase
    .from('organization_channels')
    .select('id, organization_id, platform')
    .eq('zernio_account_id', accountId)
    .maybeSingle();

  if (!channel) {
    console.warn(
      `[ZernioWebhook] Sin canal para account ${accountId} — ignorando`
    );
    return;
  }

  const orgId = channel.organization_id;

  // b) Buscar conversación existente
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('channel_id', channel.id)
    .eq('remote_id', conv.id)
    .maybeSingle();

  let conversationId = existingConv?.id ?? null;

  // c) Crear conversación si no existe
  if (!conversationId) {
    const phone = msg.sender?.phoneNumber || null;
    const matchedClientId = await matchClientByPhone(supabase, orgId, phone);

    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        organization_id: orgId,
        channel_id: channel.id,
        platform: channel.platform,
        remote_id: conv.id,
        zernio_conversation_id: conv.id,
        remote_phone: phone,
        remote_handle:
          msg.sender?.username || conv.participantUsername || null,
        remote_display_name:
          msg.sender?.name || conv.participantName || null,
        client_id: matchedClientId,
        client_match_method: matchedClientId ? 'auto_phone' : null,
        status: 'open',
        agent_handles: true,
      })
      .select('id')
      .single();

    if (convError || !newConv) {
      console.error(
        '[ZernioWebhook] Error creando conversación:',
        convError?.message
      );
      return;
    }
    conversationId = newConv.id;
    console.log(
      `[ZernioWebhook] Conversación creada ${conversationId} (org ${orgId})`
    );
  }

  // d) Idempotencia: no duplicar el mensaje si Zernio reintenta
  const { data: existingMsg } = await supabase
    .from('messages')
    .select('id')
    .eq('zernio_message_id', msg.id)
    .maybeSingle();

  if (existingMsg) {
    console.log(`[ZernioWebhook] Mensaje ${msg.id} ya procesado — skip`);
    return;
  }

  // e) Guardar el mensaje entrante (el trigger actualiza la conversación)
  const attachments =
    Array.isArray(msg.attachments) && msg.attachments.length > 0
      ? (msg.attachments as never)
      : null;

  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    organization_id: orgId,
    zernio_message_id: msg.id,
    direction: 'inbound',
    sender_type: 'client',
    content: msg.text || null,
    attachments,
    status: 'sent',
    sent_at: msg.sentAt || new Date().toISOString(),
  });

  if (msgError) {
    console.error('[ZernioWebhook] Error guardando mensaje:', msgError.message);
    return;
  }

  console.log(
    `[ZernioWebhook] Mensaje entrante guardado en conversación ${conversationId}`
  );

  // f) Disparar el agente IA (cuando exista el runtime)
  // TODO(14.7): consultar conversation.agent_handles + agent_settings
  //   (is_enabled, auto_respond) y, si aplica, disparar asincrónicamente:
  //   runAgentForConversation(conversationId).catch(console.error);
}

// ============================================================
// 2. ACTUALIZACIÓN DE STATUS (outbound)
// ============================================================

export async function handleMessageStatusUpdate(
  payload: ZernioWebhookPayload,
  newStatus: 'sent' | 'delivered' | 'read'
) {
  const supabase = await createServiceClient();

  const zernioMessageId = payload.message?.id;
  if (!zernioMessageId) {
    console.warn('[ZernioWebhook] status update sin message.id');
    return;
  }

  const { data: message } = await supabase
    .from('messages')
    .select('id, status')
    .eq('zernio_message_id', zernioMessageId)
    .maybeSingle();

  if (!message) {
    console.log(
      `[ZernioWebhook] status '${newStatus}' para mensaje desconocido ${zernioMessageId} — skip`
    );
    return;
  }

  const now = new Date().toISOString();
  const update: {
    status: 'sent' | 'delivered' | 'read';
    sent_at?: string;
    delivered_at?: string;
    read_at?: string;
  } = { status: newStatus };

  if (newStatus === 'sent') update.sent_at = now;
  if (newStatus === 'delivered') update.delivered_at = now;
  if (newStatus === 'read') update.read_at = now;

  const { error } = await supabase
    .from('messages')
    .update(update)
    .eq('id', message.id);

  if (error) {
    console.error('[ZernioWebhook] Error actualizando status:', error.message);
  }
}
