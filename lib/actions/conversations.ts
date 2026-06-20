'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zernioFetch } from '@/lib/zernio-client';
import type { Database, ConversationStatus } from '@/lib/types/database';

type MessageUpdate = Database['public']['Tables']['messages']['Update'];
type ConversationUpdate =
  Database['public']['Tables']['conversations']['Update'];

// ============================================================
// SCHEMAS
// ============================================================

const sendSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1, 'El mensaje no puede estar vacío').max(4096),
});

const assignSchema = z.object({
  conversation_id: z.string().uuid(),
  assigned_to_user_id: z.string().uuid().nullable(),
});

const associateSchema = z.object({
  conversation_id: z.string().uuid(),
  client_id: z.string().uuid(),
});

const toggleSchema = z.object({
  conversation_id: z.string().uuid(),
  agent_handles: z.boolean(),
});

// ============================================================
// HELPERS
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

// Registrar un evento de auditoría de la conversación
async function logEvent(
  ctx: Ctx,
  params: {
    conversation_id: string;
    organization_id: string;
    event_type: Database['public']['Tables']['conversation_events']['Insert']['event_type'];
    description?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) {
  const { error } = await ctx.supabase.from('conversation_events').insert({
    conversation_id: params.conversation_id,
    organization_id: params.organization_id,
    event_type: params.event_type,
    actor_user_id: ctx.isSuperAdmin ? null : ctx.userId,
    description: params.description ?? null,
    metadata: (params.metadata as never) ?? null,
  });
  if (error) console.error('[Conversations] logEvent error:', error.message);
}

// Enviar un mensaje vía Zernio. No lanza: devuelve resultado estructurado.
async function deliverViaZernio(
  zernioConversationId: string,
  content: string
): Promise<{ ok: true; zernioMessageId: string | null } | { ok: false; error: string }> {
  try {
    const res = await zernioFetch<{
      message?: { id?: string; _id?: string };
      id?: string;
    }>(`/inbox/conversations/${zernioConversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text: content }),
    });
    const zernioMessageId =
      res.message?.id || res.message?._id || res.id || null;
    return { ok: true, zernioMessageId };
  } catch (err) {
    console.error('[Conversations] deliverViaZernio error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error al enviar a Zernio',
    };
  }
}

// ============================================================
// 1. LISTAR CONVERSACIONES
// ============================================================

export async function listConversationsAction(filters?: {
  status?: ConversationStatus | 'all';
  assigned_to_user_id?: string;
  client_id?: string;
  unread_only?: boolean;
  search?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.view'))) {
    return { error: 'No tienes permiso para ver conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  let query = ctx.supabase
    .from('conversations')
    .select(
      `
      *,
      channel:organization_channels!conversations_channel_id_fkey(id, platform, display_name),
      client:clients(id, name, legal_name),
      assigned_to:users!conversations_assigned_to_user_id_fkey(id, first_name, last_name, avatar_url)
    `
    )
    .eq('organization_id', orgId);

  const status = filters?.status ?? 'open';
  if (status !== 'all') query = query.eq('status', status);

  if (filters?.assigned_to_user_id) {
    // "me" se resuelve contra el usuario actual. Un super admin no tiene
    // registro en `users`, así que su filtro "Mías" devuelve lista vacía
    // (no hay un UUID propio que aplicar).
    if (filters.assigned_to_user_id === 'me') {
      if (ctx.isSuperAdmin || !ctx.userId) return { conversations: [] };
      query = query.eq('assigned_to_user_id', ctx.userId);
    } else {
      query = query.eq('assigned_to_user_id', filters.assigned_to_user_id);
    }
  }
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.unread_only) query = query.gt('unread_count', 0);

  const { data, error } = await query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) return { error: `Error al cargar conversaciones: ${error.message}` };

  let conversations = data || [];

  // Búsqueda en memoria (cubre nombre del cliente además de los campos propios)
  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase();
    conversations = conversations.filter((c) => {
      const client = c.client as unknown as { name: string } | null;
      return (
        c.remote_display_name?.toLowerCase().includes(q) ||
        c.last_message_preview?.toLowerCase().includes(q) ||
        client?.name.toLowerCase().includes(q)
      );
    });
  }

  return { conversations };
}

// ============================================================
// 2. OBTENER CONVERSACIÓN
// ============================================================

export async function getConversationByIdAction(id: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.view'))) {
    return { error: 'No tienes permiso para ver conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: conversation, error } = await ctx.supabase
    .from('conversations')
    .select(
      `
      *,
      channel:organization_channels!conversations_channel_id_fkey(id, platform, display_name, status),
      client:clients(id, name, legal_name, tax_id),
      assigned_to:users!conversations_assigned_to_user_id_fkey(id, first_name, last_name, avatar_url)
    `
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) return { error: `Error al cargar la conversación: ${error.message}` };
  if (!conversation) return { error: 'Conversación no encontrada' };

  return { conversation };
}

// ============================================================
// 3. LISTAR MENSAJES
// ============================================================

export async function listMessagesAction(
  conversationId: string,
  options?: { before?: string; limit?: number }
) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.view'))) {
    return { error: 'No tienes permiso para ver conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const limit = Math.min(options?.limit ?? 50, 200);

  let query = ctx.supabase
    .from('messages')
    .select(
      `
      *,
      sender:users!messages_sender_user_id_fkey(id, first_name, last_name)
    `
    )
    .eq('conversation_id', conversationId)
    .eq('organization_id', orgId);

  if (options?.before) query = query.lt('created_at', options.before);

  // Traemos los más recientes y los devolvemos en orden ascendente
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { error: `Error al cargar mensajes: ${error.message}` };

  const messages = (data || []).slice().reverse();
  return { messages };
}

// ============================================================
// 4. ENVIAR MENSAJE
// ============================================================

export async function sendMessageAction(payload: {
  conversation_id: string;
  content: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage'))) {
    return { error: 'No tienes permiso para enviar mensajes' };
  }

  const validation = sendSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: conversation } = await ctx.supabase
    .from('conversations')
    .select(
      'id, organization_id, platform, zernio_conversation_id, last_inbound_at'
    )
    .eq('id', validation.data.conversation_id)
    .maybeSingle();

  if (!conversation || conversation.organization_id !== orgId) {
    return { error: 'Conversación no encontrada' };
  }
  if (!conversation.zernio_conversation_id) {
    return { error: 'Esta conversación no tiene ID de Zernio asociado' };
  }

  // Regla de las 24h de WhatsApp: solo se puede responder con texto libre
  // dentro de las 24h posteriores al último mensaje entrante del cliente.
  // Fuera de esa ventana WhatsApp exige una plantilla aprobada (error 131047).
  if (conversation.platform === 'whatsapp') {
    const lastInbound = conversation.last_inbound_at
      ? new Date(conversation.last_inbound_at).getTime()
      : null;
    const windowMs = 24 * 60 * 60 * 1000;
    if (!lastInbound || Date.now() - lastInbound > windowMs) {
      return {
        error:
          'Esta conversación está fuera del rango de 24h de WhatsApp. Para reabrirla necesitas que el cliente escriba de nuevo o enviar una plantilla aprobada.',
      };
    }
  }

  // 1. Guardar el mensaje pending
  const { data: message, error: insertError } = await ctx.supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      organization_id: orgId,
      direction: 'outbound',
      sender_type: 'user',
      sender_user_id: ctx.isSuperAdmin ? null : ctx.userId,
      status: 'pending',
      content: validation.data.content,
    })
    .select('id')
    .single();

  if (insertError || !message) {
    return { error: `Error al guardar el mensaje: ${insertError?.message}` };
  }

  // 2. Entregar vía Zernio
  const delivery = await deliverViaZernio(
    conversation.zernio_conversation_id,
    validation.data.content
  );

  const update: MessageUpdate = delivery.ok
    ? {
        status: 'sent',
        sent_at: new Date().toISOString(),
        zernio_message_id: delivery.zernioMessageId,
      }
    : {
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: delivery.error,
      };

  await ctx.supabase.from('messages').update(update).eq('id', message.id);

  revalidatePath('/conversations');
  revalidatePath(`/conversations/${conversation.id}`);

  return { success: true, messageId: message.id, failed: !delivery.ok };
}

// ============================================================
// 5. REINTENTAR MENSAJE FALLIDO
// ============================================================

export async function retryFailedMessageAction(messageId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage'))) {
    return { error: 'No tienes permiso para enviar mensajes' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: message } = await ctx.supabase
    .from('messages')
    .select('id, organization_id, conversation_id, content, status')
    .eq('id', messageId)
    .maybeSingle();

  if (!message || message.organization_id !== orgId) {
    return { error: 'Mensaje no encontrado' };
  }
  if (message.status !== 'failed') {
    return { error: 'Solo se pueden reintentar mensajes fallidos' };
  }

  const { data: conversation } = await ctx.supabase
    .from('conversations')
    .select('id, zernio_conversation_id')
    .eq('id', message.conversation_id)
    .maybeSingle();

  if (!conversation?.zernio_conversation_id) {
    return { error: 'Esta conversación no tiene ID de Zernio asociado' };
  }

  // Marcar de nuevo como pending
  await ctx.supabase
    .from('messages')
    .update({ status: 'pending', failure_reason: null })
    .eq('id', message.id);

  const delivery = await deliverViaZernio(
    conversation.zernio_conversation_id,
    message.content || ''
  );

  const update: MessageUpdate = delivery.ok
    ? {
        status: 'sent',
        sent_at: new Date().toISOString(),
        zernio_message_id: delivery.zernioMessageId,
        failed_at: null,
        failure_reason: null,
      }
    : {
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: delivery.error,
      };

  await ctx.supabase.from('messages').update(update).eq('id', message.id);

  revalidatePath(`/conversations/${message.conversation_id}`);
  return { success: true, failed: !delivery.ok };
}

// ============================================================
// 6. MARCAR COMO LEÍDA
// ============================================================

export async function markConversationAsReadAction(conversationId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.view'))) {
    return { error: 'No tienes permiso para ver conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { error } = await ctx.supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
    .eq('organization_id', orgId);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/conversations');
  return { success: true };
}

export async function markConversationAsUnreadAction(conversationId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.view'))) {
    return { error: 'No tienes permiso para ver conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { error } = await ctx.supabase
    .from('conversations')
    .update({ unread_count: 1 })
    .eq('id', conversationId)
    .eq('organization_id', orgId);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/conversations');
  return { success: true };
}

// ============================================================
// 7. ASIGNAR CONVERSACIÓN
// ============================================================

export async function assignConversationAction(payload: {
  conversation_id: string;
  assigned_to_user_id: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.assign'))) {
    return { error: 'No tienes permiso para asignar conversaciones' };
  }

  const validation = assignSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: conversation } = await ctx.supabase
    .from('conversations')
    .select('id, organization_id')
    .eq('id', validation.data.conversation_id)
    .maybeSingle();

  if (!conversation || conversation.organization_id !== orgId) {
    return { error: 'Conversación no encontrada' };
  }

  // Validar que el usuario sea miembro activo de la org
  if (validation.data.assigned_to_user_id) {
    const { data: member } = await ctx.supabase
      .from('users')
      .select('id, organization_id, is_active')
      .eq('id', validation.data.assigned_to_user_id)
      .maybeSingle();
    if (!member || member.organization_id !== orgId || !member.is_active) {
      return { error: 'El usuario no es un miembro activo de la organización' };
    }
  }

  const { error } = await ctx.supabase
    .from('conversations')
    .update({ assigned_to_user_id: validation.data.assigned_to_user_id })
    .eq('id', conversation.id);

  if (error) return { error: `Error al asignar: ${error.message}` };

  await logEvent(ctx, {
    conversation_id: conversation.id,
    organization_id: orgId,
    event_type: 'conversation_assigned',
    metadata: { assigned_to_user_id: validation.data.assigned_to_user_id },
  });

  revalidatePath('/conversations');
  revalidatePath(`/conversations/${conversation.id}`);
  return { success: true };
}

// ============================================================
// 8 / 9. ARCHIVAR / DESARCHIVAR
// ============================================================

export async function archiveConversationAction(conversationId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.archive'))) {
    return { error: 'No tienes permiso para archivar conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: conversation } = await ctx.supabase
    .from('conversations')
    .select('id, organization_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation || conversation.organization_id !== orgId) {
    return { error: 'Conversación no encontrada' };
  }

  const { error } = await ctx.supabase
    .from('conversations')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      archived_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .eq('id', conversation.id);

  if (error) return { error: `Error al archivar: ${error.message}` };

  await logEvent(ctx, {
    conversation_id: conversation.id,
    organization_id: orgId,
    event_type: 'conversation_archived',
  });

  revalidatePath('/conversations');
  revalidatePath(`/conversations/${conversation.id}`);
  return { success: true };
}

export async function unarchiveConversationAction(conversationId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.archive'))) {
    return { error: 'No tienes permiso para archivar conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: conversation } = await ctx.supabase
    .from('conversations')
    .select('id, organization_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation || conversation.organization_id !== orgId) {
    return { error: 'Conversación no encontrada' };
  }

  const { error } = await ctx.supabase
    .from('conversations')
    .update({ status: 'open', archived_at: null, archived_by: null })
    .eq('id', conversation.id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/conversations');
  revalidatePath(`/conversations/${conversation.id}`);
  return { success: true };
}

// ============================================================
// 10 / 11. ASOCIAR / DESASOCIAR CLIENTE
// ============================================================

export async function associateConversationToClientAction(payload: {
  conversation_id: string;
  client_id: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage'))) {
    return { error: 'No tienes permiso para gestionar conversaciones' };
  }

  const validation = associateSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const [{ data: conversation }, { data: client }] = await Promise.all([
    ctx.supabase
      .from('conversations')
      .select('id, organization_id')
      .eq('id', validation.data.conversation_id)
      .maybeSingle(),
    ctx.supabase
      .from('clients')
      .select('id, organization_id')
      .eq('id', validation.data.client_id)
      .maybeSingle(),
  ]);

  if (!conversation || conversation.organization_id !== orgId) {
    return { error: 'Conversación no encontrada' };
  }
  if (!client || client.organization_id !== orgId) {
    return { error: 'Cliente no válido para esta organización' };
  }

  const update: ConversationUpdate = {
    client_id: validation.data.client_id,
    client_match_method: 'manual',
  };

  const { error } = await ctx.supabase
    .from('conversations')
    .update(update)
    .eq('id', conversation.id);

  if (error) return { error: `Error al asociar: ${error.message}` };

  revalidatePath(`/conversations/${conversation.id}`);
  return { success: true };
}

export async function dissociateConversationFromClientAction(
  conversationId: string
) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage'))) {
    return { error: 'No tienes permiso para gestionar conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: conversation } = await ctx.supabase
    .from('conversations')
    .select('id, organization_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation || conversation.organization_id !== orgId) {
    return { error: 'Conversación no encontrada' };
  }

  const update: ConversationUpdate = {
    client_id: null,
    client_match_method: null,
  };

  const { error } = await ctx.supabase
    .from('conversations')
    .update(update)
    .eq('id', conversation.id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath(`/conversations/${conversation.id}`);
  return { success: true };
}

// ============================================================
// 12. TOMAR / DEVOLVER CONTROL DEL AGENTE
// ============================================================

export async function toggleAgentHandlesAction(payload: {
  conversation_id: string;
  agent_handles: boolean;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage'))) {
    return { error: 'No tienes permiso para gestionar conversaciones' };
  }

  const validation = toggleSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: conversation } = await ctx.supabase
    .from('conversations')
    .select('id, organization_id')
    .eq('id', validation.data.conversation_id)
    .maybeSingle();

  if (!conversation || conversation.organization_id !== orgId) {
    return { error: 'Conversación no encontrada' };
  }

  const { error } = await ctx.supabase
    .from('conversations')
    .update({ agent_handles: validation.data.agent_handles })
    .eq('id', conversation.id);

  if (error) return { error: `Error: ${error.message}` };

  await logEvent(ctx, {
    conversation_id: conversation.id,
    organization_id: orgId,
    event_type: 'agent_handover',
    description: validation.data.agent_handles
      ? 'Control devuelto al agente IA'
      : 'Un humano tomó el control de la conversación',
    metadata: { agent_handles: validation.data.agent_handles },
  });

  revalidatePath(`/conversations/${conversation.id}`);
  return { success: true };
}

// ============================================================
// 13. CONTADOR DE NO LEÍDAS
// ============================================================

export async function getUnreadCountAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { count: 0 };

  if (!(await checkPermission('conversations.view'))) {
    return { count: 0 };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { count: 0 };

  const { count } = await ctx.supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gt('unread_count', 0)
    .neq('status', 'archived');

  return { count: count ?? 0 };
}

// ============================================================
// 14b. BUSCAR CLIENTES (para el modal de asociación)
// ============================================================

export async function searchClientsForConversationAction(query: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.manage'))) {
    return { error: 'No tienes permiso para gestionar conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  let q = ctx.supabase
    .from('clients')
    .select(
      'id, name, legal_name, contacts(phone, is_primary)'
    )
    .eq('organization_id', orgId);

  const term = query.trim();
  if (term) q = q.ilike('name', `%${term}%`);

  const { data, error } = await q.order('name').limit(10);
  if (error) return { error: `Error al buscar clientes: ${error.message}` };

  const clients = (data || []).map((c) => {
    const contacts = (c.contacts as unknown as
      | { phone: string | null; is_primary: boolean }[]
      | null) ?? [];
    const primary = contacts.find((ct) => ct.is_primary) ?? contacts[0];
    return {
      id: c.id,
      name: c.name,
      legal_name: c.legal_name,
      phone: primary?.phone ?? null,
    };
  });

  return { clients };
}

// ============================================================
// 14. EVENTOS DE LA CONVERSACIÓN
// ============================================================

export async function listConversationEventsAction(conversationId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('conversations.view'))) {
    return { error: 'No tienes permiso para ver conversaciones' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data, error } = await ctx.supabase
    .from('conversation_events')
    .select(
      `
      *,
      actor:users!conversation_events_actor_user_id_fkey(id, first_name, last_name)
    `
    )
    .eq('conversation_id', conversationId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return { error: `Error al cargar eventos: ${error.message}` };

  return { events: data || [] };
}
