'use server';

import crypto from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { zernioFetch } from '@/lib/zernio-client';
import type { Database, ChannelPlatform } from '@/lib/types/database';

// Eventos a los que nos suscribimos en el webhook de Zernio
const WEBHOOK_EVENTS = [
  'message.received',
  'message.sent',
  'message.delivered',
  'message.read',
  'message.failed',
  'conversation.started',
  'account.connected',
  'account.disconnected',
  'whatsapp.number.activated',
];

// ============================================================
// CONSTANTES / SCHEMAS
// ============================================================

// Plataformas que admiten conexión OAuth (sms se da de alta de otra forma)
const CONNECT_PLATFORMS = [
  'whatsapp',
  'instagram',
  'facebook',
  'telegram',
] as const;

const startSchema = z.object({
  platform: z.enum(CONNECT_PLATFORMS),
});

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_URL ||
    ''
  );
}

function tempAccountId(): string {
  return `pending_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

// ============================================================
// HELPERS DE CONTEXTO
// ============================================================

async function getContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' as const };

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    const { getImpersonatedOrganizationId } = await import(
      '@/lib/actions/impersonation'
    );
    const impersonatingOrgId = await getImpersonatedOrganizationId();
    return { isSuperAdmin: true as const, supabase, impersonatingOrgId };
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!appUser) return { error: 'Usuario no encontrado' as const };

  return {
    isSuperAdmin: false as const,
    supabase,
    userId: appUser.id,
    organizationId: appUser.organization_id,
  };
}

function resolveOrgId(
  ctx: Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>
): string | null {
  if (!ctx.isSuperAdmin) return ctx.organizationId;
  if (ctx.impersonatingOrgId) return ctx.impersonatingOrgId;
  return null;
}

async function checkPermission(code: string): Promise<boolean> {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return hasPermission(authCtx, code);
}

type Ctx = Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>;

// ============================================================
// HELPER INTERNO: asegurar profile de Zernio
// ============================================================

async function ensureProfile(
  ctx: Ctx,
  orgId: string
): Promise<{ profileId: string } | { error: string }> {
  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('id, name, zernio_profile_id')
    .eq('id', orgId)
    .maybeSingle();

  if (!org) return { error: 'Organización no encontrada' };
  if (org.zernio_profile_id) return { profileId: org.zernio_profile_id };

  try {
    const res = await zernioFetch<{ profile: { _id: string } }>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: org.name, description: 'Photocan OS' }),
    });
    const profileId = res.profile?._id;
    if (!profileId) {
      return { error: 'Zernio no devolvió un profile válido' };
    }

    const { error: updateError } = await ctx.supabase
      .from('organizations')
      .update({ zernio_profile_id: profileId })
      .eq('id', orgId);
    if (updateError) {
      console.error('[Zernio] Error guardando profile_id:', updateError);
      return { error: 'No se pudo guardar el profile de Zernio' };
    }

    console.log(`[Zernio] Profile creado para org ${orgId}: ${profileId}`);
    return { profileId };
  } catch (err) {
    console.error('[Zernio] ensureProfile error:', err);
    return {
      error: err instanceof Error ? err.message : 'Error al crear profile',
    };
  }
}

// ============================================================
// HELPER INTERNO: asegurar webhook por organización
// ============================================================
// Cada org tiene su propio webhook en Zernio, con su propio secret aleatorio.
// Esto aísla la verificación de firma por org (el secret no se comparte).
// Se llama al iniciar la conexión de un canal (cuando ya hay profileId).

async function ensureWebhookForOrg(
  sb: SupabaseClient<Database>,
  orgId: string,
  profileId: string
): Promise<{ webhookId: string; secret: string } | { error: string }> {
  const { data: org } = await sb
    .from('organizations')
    .select('zernio_webhook_id, zernio_webhook_secret')
    .eq('id', orgId)
    .maybeSingle();

  if (org?.zernio_webhook_id && org?.zernio_webhook_secret) {
    return { webhookId: org.zernio_webhook_id, secret: org.zernio_webhook_secret };
  }

  const secret = crypto.randomBytes(32).toString('hex');
  const url = `${appUrl()}/api/zernio/webhook`;

  try {
    // POST /v1/webhooks → registra el webhook para esta org/profile
    const res = await zernioFetch<{
      webhook?: { _id?: string; id?: string };
      _id?: string;
      id?: string;
    }>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        url,
        events: WEBHOOK_EVENTS,
        secret,
        profileId,
      }),
    });

    const webhookId =
      res.webhook?._id || res.webhook?.id || res._id || res.id || null;
    if (!webhookId) {
      return { error: 'Zernio no devolvió un webhook válido' };
    }

    const update: Database['public']['Tables']['organizations']['Update'] = {
      zernio_webhook_id: webhookId,
      zernio_webhook_secret: secret,
    };
    const { error: updateError } = await sb
      .from('organizations')
      .update(update)
      .eq('id', orgId);
    if (updateError) {
      console.error('[Zernio] Error guardando webhook:', updateError);
      return { error: 'No se pudo guardar el webhook de Zernio' };
    }

    console.log(`[Zernio] Webhook ${webhookId} registrado para org ${orgId}`);
    return { webhookId, secret };
  } catch (err) {
    console.error('[Zernio] ensureWebhookForOrg error:', err);
    return {
      error: err instanceof Error ? err.message : 'Error al registrar webhook',
    };
  }
}

// ============================================================
// 1. ASEGURAR PROFILE (acción pública)
// ============================================================

export async function ensureZernioProfileAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage_channels'))) {
    return { error: 'No tienes permiso para gestionar canales' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const result = await ensureProfile(ctx, orgId);
  if ('error' in result) return { error: result.error };

  return { success: true, profileId: result.profileId };
}

// ============================================================
// 2. INICIAR CONEXIÓN DE CANAL
// ============================================================

export async function startChannelConnectionAction(payload: {
  platform: (typeof CONNECT_PLATFORMS)[number];
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage_channels'))) {
    return { error: 'No tienes permiso para gestionar canales' };
  }

  const validation = startSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }
  const { platform } = validation.data;

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // 1. Asegurar profile
  const profileRes = await ensureProfile(ctx, orgId);
  if ('error' in profileRes) return { error: profileRes.error };
  const profileId = profileRes.profileId;

  // 1b. Asegurar webhook por org (idempotente). No bloquea la conexión si falla,
  // pero sin webhook no llegarían los mensajes entrantes — lo registramos.
  const webhookRes = await ensureWebhookForOrg(ctx.supabase, orgId, profileId);
  if ('error' in webhookRes) {
    console.error('[Zernio] No se pudo asegurar webhook:', webhookRes.error);
  }

  // 2. No permitir un segundo canal conectado del mismo platform
  const { data: existing } = await ctx.supabase
    .from('organization_channels')
    .select('id')
    .eq('organization_id', orgId)
    .eq('platform', platform)
    .eq('status', 'connected')
    .maybeSingle();

  if (existing) {
    return { error: `Ya tienes un canal de ${platform} conectado` };
  }

  // 3. Pedir authUrl a Zernio
  // Zernio devuelve en el callback ?connected=...&profileId=...&accountId=...
  // (NO incluye org_id). Resolvemos la org por profileId en el callback, así que
  // el redirect_url no necesita llevar org_id.
  const redirectUrl = `${appUrl()}/api/zernio/callback?platform=${platform}`;
  let authUrl: string;
  try {
    const res = await zernioFetch<{ authUrl: string }>(
      `/connect/${platform}?profileId=${encodeURIComponent(
        profileId
      )}&redirect_url=${encodeURIComponent(redirectUrl)}`
    );
    if (!res.authUrl) return { error: 'Zernio no devolvió un authUrl' };
    authUrl = res.authUrl;
  } catch (err) {
    console.error('[Zernio] startChannelConnection error:', err);
    return {
      error: err instanceof Error ? err.message : 'Error al iniciar conexión',
    };
  }

  // 4. Crear el canal pending (account_id temporal para no chocar con UNIQUE)
  const { error: insertError } = await ctx.supabase
    .from('organization_channels')
    .insert({
      organization_id: orgId,
      platform,
      status: 'pending',
      zernio_profile_id: profileId,
      zernio_account_id: tempAccountId(),
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    });

  if (insertError) {
    return { error: `Error al registrar el canal: ${insertError.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true, authUrl };
}

// ============================================================
// 3. COMPLETAR CONEXIÓN (llamada desde el callback, sin sesión)
// ============================================================

export async function completeChannelConnectionAction(payload: {
  profile_id: string;
  platform: string;
  account_id: string;
  account_data?: {
    display_name?: string;
    phone_number?: string;
    handle?: string;
    username?: string;
    avatar_url?: string;
    [key: string]: unknown;
  };
}) {
  // Sin sesión de usuario → service client (bypass RLS)
  const supabase = await createServiceClient();

  // Resolver la org por profileId (Zernio no devuelve org_id en el callback)
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('zernio_profile_id', payload.profile_id)
    .maybeSingle();

  if (!org) {
    console.error(
      `[Zernio] completeChannelConnection: sin org para profileId ${payload.profile_id}`
    );
    return { error: 'No se encontró la organización del profile de Zernio' };
  }
  const orgId = org.id;

  // Buscar el canal pending de esa org + platform (el más reciente)
  const { data: channel } = await supabase
    .from('organization_channels')
    .select('id')
    .eq('organization_id', orgId)
    .eq('platform', payload.platform as ChannelPlatform)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!channel) {
    console.error(
      `[Zernio] completeChannelConnection: sin canal pending para ${orgId}/${payload.platform}`
    );
    return { error: 'No hay un canal pendiente para completar' };
  }

  const ad = payload.account_data || {};
  const { error: updateError } = await supabase
    .from('organization_channels')
    .update({
      zernio_account_id: payload.account_id,
      status: 'connected',
      connected_at: new Date().toISOString(),
      display_name: ad.display_name || null,
      phone_number: ad.phone_number || null,
      handle: ad.handle || ad.username || null,
      avatar_url: ad.avatar_url || null,
      metadata: (payload.account_data as never) ?? null,
      last_error: null,
      last_error_at: null,
    })
    .eq('id', channel.id);

  if (updateError) {
    console.error('[Zernio] Error completando canal:', updateError);
    return { error: `Error al completar la conexión: ${updateError.message}` };
  }

  // Crear agent_settings inicial si la org aún no tiene (UNIQUE por org)
  await supabase
    .from('agent_settings')
    .insert({ organization_id: orgId })
    .select('id')
    .maybeSingle();
  // (si ya existe, el UNIQUE lo rechaza silenciosamente — lo ignoramos)

  // NOTA: conversation_events requiere conversation_id (NOT NULL), así que el
  // evento 'channel_connected' a nivel canal no se registra aquí. Se podría
  // mover a una tabla de eventos de canal si se necesita auditoría.

  console.log(
    `[Zernio] Canal ${channel.id} conectado (${payload.platform}) para org ${orgId}`
  );

  revalidatePath('/settings/integrations');
  return { success: true, channelId: channel.id };
}

// ============================================================
// 4. DESCONECTAR CANAL
// ============================================================

export async function disconnectChannelAction(channelId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage_channels'))) {
    return { error: 'No tienes permiso para gestionar canales' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: channel } = await ctx.supabase
    .from('organization_channels')
    .select('id, organization_id')
    .eq('id', channelId)
    .maybeSingle();

  if (!channel || channel.organization_id !== orgId) {
    return { error: 'Canal no encontrado' };
  }

  const { error } = await ctx.supabase
    .from('organization_channels')
    .update({
      status: 'disconnected',
      disconnected_at: new Date().toISOString(),
    })
    .eq('id', channelId);

  if (error) return { error: `Error al desconectar: ${error.message}` };

  revalidatePath('/settings/integrations');
  return { success: true };
}

// ============================================================
// 5. LISTAR CANALES
// ============================================================

export async function listChannelsAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.view'))) {
    return { error: 'No tienes permiso para ver conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data, error } = await ctx.supabase
    .from('organization_channels')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return { error: `Error al cargar canales: ${error.message}` };

  return { channels: data || [] };
}

// ============================================================
// 6. REINTENTAR CONEXIÓN
// ============================================================

export async function retryChannelConnectionAction(channelId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage_channels'))) {
    return { error: 'No tienes permiso para gestionar canales' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: channel } = await ctx.supabase
    .from('organization_channels')
    .select('id, organization_id, platform, status, created_at')
    .eq('id', channelId)
    .maybeSingle();

  if (!channel || channel.organization_id !== orgId) {
    return { error: 'Canal no encontrado' };
  }

  const isError = channel.status === 'error';
  const isStalePending =
    channel.status === 'pending' &&
    Date.now() - new Date(channel.created_at).getTime() > 60 * 60 * 1000;

  if (!isError && !isStalePending) {
    return {
      error: 'Este canal no se puede reintentar en su estado actual',
    };
  }

  // El platform de la BD puede incluir 'sms', pero el reintento OAuth solo
  // aplica a las plataformas conectables.
  const platform = channel.platform as ChannelPlatform;
  if (!CONNECT_PLATFORMS.includes(platform as (typeof CONNECT_PLATFORMS)[number])) {
    return { error: `La plataforma ${platform} no admite reconexión OAuth` };
  }

  // Limpiar el canal viejo y reiniciar el flujo
  await ctx.supabase
    .from('organization_channels')
    .delete()
    .eq('id', channelId);

  return startChannelConnectionAction({
    platform: platform as (typeof CONNECT_PLATFORMS)[number],
  });
}
