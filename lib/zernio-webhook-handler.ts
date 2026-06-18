/**
 * Procesamiento de webhooks entrantes de Zernio.
 * NO es server action — lo invoca el route handler /api/zernio/webhook.
 * Usa createServiceClient porque el webhook no tiene sesión de usuario.
 */

import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

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
    error?: string;
    errorCode?: string | number;
    failureReason?: string;
  };
  conversation?: {
    id: string;
    platform?: string;
    platformConversationId?: string;
    participantId?: string;
    participantName?: string;
    participantUsername?: string;
    participantPhone?: string;
    status?: string;
  };
  account?: {
    id: string;
    platform?: string;
    username?: string;
    displayName?: string;
    phoneNumber?: string;
  };
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// ============================================================
// HELPER: resolver organización por account de Zernio
// ============================================================

async function resolveOrgByAccount(
  supabase: ServiceClient,
  accountId: string | undefined | null
): Promise<string | null> {
  if (!accountId) return null;
  const { data: channel } = await supabase
    .from('organization_channels')
    .select('organization_id')
    .eq('zernio_account_id', accountId)
    .maybeSingle();
  return channel?.organization_id ?? null;
}

// ============================================================
// VERIFICACIÓN DE FIRMA (FIX 4: secret por organización)
// ============================================================

// Resuelve el secret del webhook: primero el de la org (por account.id),
// y como fallback de desarrollo ZERNIO_WEBHOOK_SECRET.
export async function resolveWebhookSecret(
  payload: ZernioWebhookPayload
): Promise<string | null> {
  const accountId = payload.account?.id;
  if (accountId) {
    const supabase = await createServiceClient();
    const orgId = await resolveOrgByAccount(supabase, accountId);
    if (orgId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('zernio_webhook_secret')
        .eq('id', orgId)
        .maybeSingle();
      if (org?.zernio_webhook_secret) return org.zernio_webhook_secret;
    }
  }
  return process.env.ZERNIO_WEBHOOK_SECRET || null;
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string | null
): boolean {
  if (!secret) {
    console.warn(
      '[ZernioWebhook] Sin secret configurado — saltando verificación (modo dev)'
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
// IDEMPOTENCIA POR EVENT_ID (FIX 2)
// ============================================================

// Reclama el evento insertando su event_id (PK). Si ya existía (unique
// violation), significa que Zernio reintentó y ya lo procesamos → skip.
export async function claimWebhookEvent(
  eventId: string,
  eventType: string,
  payload: ZernioWebhookPayload
): Promise<{ alreadyProcessed: boolean; orgId: string | null }> {
  const supabase = await createServiceClient();
  const orgId = await resolveOrgByAccount(supabase, payload.account?.id);

  const insert: Database['public']['Tables']['zernio_webhook_events']['Insert'] =
    {
      event_id: eventId,
      organization_id: orgId,
      event_type: eventType,
      payload: payload as never,
    };

  const { error } = await supabase.from('zernio_webhook_events').insert(insert);

  if (error) {
    // 23505 = unique_violation → ya procesado
    if (error.code === '23505') {
      return { alreadyProcessed: true, orgId };
    }
    // Si el registro de auditoría falla por otra causa, preferimos procesar
    // igual (perder el evento sería peor que un posible duplicado).
    console.error(
      '[ZernioWebhook] Error registrando evento (se procesa igual):',
      error.message
    );
    return { alreadyProcessed: false, orgId };
  }

  return { alreadyProcessed: false, orgId };
}

export async function markWebhookEventProcessed(
  eventId: string,
  errorMessage?: string | null
): Promise<void> {
  const supabase = await createServiceClient();
  const update: Database['public']['Tables']['zernio_webhook_events']['Update'] =
    {
      processed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    };
  await supabase
    .from('zernio_webhook_events')
    .update(update)
    .eq('event_id', eventId);
}

// ============================================================
// HELPER: disparar el agente vía Netlify Background Function (FIX 5)
// ============================================================

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_URL ||
    ''
  );
}

// Fire-and-forget hacia la background function (15 min de timeout). NO se
// hace await: el webhook debe responder 200 de inmediato.
function triggerAgentBackground(conversationId: string) {
  const baseUrl = appBaseUrl();
  if (!baseUrl) {
    console.error(
      '[ZernioWebhook] Sin base URL — no se pudo invocar la background function'
    );
    return;
  }
  fetch(`${baseUrl}/.netlify/functions/run-agent-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationId,
      mode: 'auto',
      triggered_by: 'webhook',
    }),
  }).catch((err) =>
    console.error('[ZernioWebhook] Error invocando background fn:', err)
  );
}

// ============================================================
// HELPER: auto-match de cliente por teléfono (vía contacts)
// ============================================================

async function matchClientByPhone(
  supabase: ServiceClient,
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
    const phone = msg.sender?.phoneNumber || conv.participantPhone || null;
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

  // d) Idempotencia a nivel mensaje: no duplicar si Zernio reintenta
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

  // f) Disparar el agente IA si la conversación lo permite y el agente está
  //    activo con auto_respond. Se invoca la background function (FIX 5) para
  //    garantizar ejecución tras devolver 200 al webhook.
  const { data: settings } = await supabase
    .from('agent_settings')
    .select('is_enabled, auto_respond')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (settings?.is_enabled && settings.auto_respond) {
    triggerAgentBackground(conversationId);
  }
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
  const update: Database['public']['Tables']['messages']['Update'] = {
    status: newStatus,
  };

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

// ============================================================
// 3. MENSAJE FALLIDO (FIX 6)
// ============================================================

export async function handleMessageFailed(payload: ZernioWebhookPayload) {
  const supabase = await createServiceClient();

  const zernioMessageId = payload.message?.id;
  if (!zernioMessageId) {
    console.warn('[ZernioWebhook] message.failed sin message.id');
    return;
  }

  const reason =
    payload.message?.failureReason ||
    payload.message?.error ||
    (payload.message?.errorCode != null
      ? `Error ${payload.message.errorCode}`
      : 'Envío fallido');

  const { data: message } = await supabase
    .from('messages')
    .select('id')
    .eq('zernio_message_id', zernioMessageId)
    .maybeSingle();

  if (!message) {
    console.log(
      `[ZernioWebhook] message.failed para mensaje desconocido ${zernioMessageId} — skip`
    );
    return;
  }

  const update: Database['public']['Tables']['messages']['Update'] = {
    status: 'failed',
    failed_at: new Date().toISOString(),
    failure_reason: reason,
  };

  const { error } = await supabase
    .from('messages')
    .update(update)
    .eq('id', message.id);

  if (error) {
    console.error('[ZernioWebhook] Error marcando mensaje fallido:', error.message);
  }
}

// ============================================================
// 4. CONVERSACIÓN INICIADA (FIX 6)
// ============================================================

// Asegura que la conversación exista aunque aún no haya un mensaje guardado.
export async function handleConversationStarted(payload: ZernioWebhookPayload) {
  const supabase = await createServiceClient();

  const accountId = payload.account?.id;
  const conv = payload.conversation;
  if (!accountId || !conv?.id) {
    console.warn('[ZernioWebhook] conversation.started con payload incompleto');
    return;
  }

  const { data: channel } = await supabase
    .from('organization_channels')
    .select('id, organization_id, platform')
    .eq('zernio_account_id', accountId)
    .maybeSingle();

  if (!channel) {
    console.warn(
      `[ZernioWebhook] conversation.started: sin canal para account ${accountId}`
    );
    return;
  }

  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('channel_id', channel.id)
    .eq('remote_id', conv.id)
    .maybeSingle();

  if (existingConv) return; // ya existe — nada que hacer

  const orgId = channel.organization_id;
  const phone = conv.participantPhone || null;
  const matchedClientId = await matchClientByPhone(supabase, orgId, phone);

  const { error } = await supabase.from('conversations').insert({
    organization_id: orgId,
    channel_id: channel.id,
    platform: channel.platform,
    remote_id: conv.id,
    zernio_conversation_id: conv.id,
    remote_phone: phone,
    remote_handle: conv.participantUsername || null,
    remote_display_name: conv.participantName || null,
    client_id: matchedClientId,
    client_match_method: matchedClientId ? 'auto_phone' : null,
    status: 'open',
    agent_handles: true,
  });

  if (error) {
    console.error(
      '[ZernioWebhook] Error creando conversación (started):',
      error.message
    );
  }
}

// ============================================================
// 5. CUENTA CONECTADA / DESCONECTADA / NÚMERO ACTIVADO (FIX 6)
// ============================================================

export async function handleAccountConnected(payload: ZernioWebhookPayload) {
  const supabase = await createServiceClient();
  const account = payload.account;
  if (!account?.id) return;

  const update: Database['public']['Tables']['organization_channels']['Update'] =
    {
      status: 'connected',
      connected_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    };
  if (account.displayName) update.display_name = account.displayName;
  if (account.username) update.handle = account.username;
  if (account.phoneNumber) update.phone_number = account.phoneNumber;

  const { error } = await supabase
    .from('organization_channels')
    .update(update)
    .eq('zernio_account_id', account.id);

  if (error) {
    console.error(
      '[ZernioWebhook] Error en account.connected:',
      error.message
    );
  }
}

export async function handleAccountDisconnected(payload: ZernioWebhookPayload) {
  const supabase = await createServiceClient();
  const accountId = payload.account?.id;
  if (!accountId) return;

  const update: Database['public']['Tables']['organization_channels']['Update'] =
    {
      status: 'disconnected',
      disconnected_at: new Date().toISOString(),
    };

  const { error } = await supabase
    .from('organization_channels')
    .update(update)
    .eq('zernio_account_id', accountId);

  if (error) {
    console.error(
      '[ZernioWebhook] Error en account.disconnected:',
      error.message
    );
  }
}

export async function handleWhatsappNumberActivated(
  payload: ZernioWebhookPayload
) {
  const supabase = await createServiceClient();
  const account = payload.account;
  if (!account?.id) return;

  const update: Database['public']['Tables']['organization_channels']['Update'] =
    {
      status: 'connected',
    };
  if (account.phoneNumber) update.phone_number = account.phoneNumber;
  if (account.displayName) update.display_name = account.displayName;

  const { error } = await supabase
    .from('organization_channels')
    .update(update)
    .eq('zernio_account_id', account.id);

  if (error) {
    console.error(
      '[ZernioWebhook] Error en whatsapp.number.activated:',
      error.message
    );
  }
}
