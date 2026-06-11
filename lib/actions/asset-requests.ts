'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

const createRequestSchema = z.object({
  purpose: z.string().min(3, 'Descripción muy corta').max(500),
  client_id: z.string().uuid().optional().nullable(),
  start_date: z.string().min(1, 'Fecha de inicio requerida'),
  end_date: z.string().min(1, 'Fecha de fin requerida'),
  asset_ids: z
    .array(z.string().uuid())
    .min(1, 'Selecciona al menos un activo'),
});

const checkinItemSchema = z.object({
  item_id: z.string().uuid(),
  return_condition: z
    .enum(['ok', 'minor_damage', 'major_damage', 'lost'])
    .default('ok'),
  return_notes: z.string().max(1000).optional().nullable(),
});

// ============================================================
// HELPER DE CONTEXTO
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

    return {
      isSuperAdmin: true as const,
      supabase,
      impersonatingOrgId,
    };
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

// ============================================================
// CREAR SOLICITUD
// ============================================================

export async function createAssetRequestAction(payload: {
  purpose: string;
  client_id?: string | null;
  start_date: string;
  end_date: string;
  asset_ids: string[];
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = createRequestSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  // Validar fechas
  const startDate = new Date(validation.data.start_date);
  const endDate = new Date(validation.data.end_date);
  if (endDate < startDate) {
    return { error: 'La fecha de fin debe ser igual o posterior al inicio' };
  }

  // Super admin no debería crear solicitudes (no es operador)
  if (ctx.isSuperAdmin) {
    return {
      error:
        'Super Admin no puede crear solicitudes. Impersona a un usuario.',
    };
  }

  // Validar que todos los assets existan y pertenezcan a la org
  const { data: assets } = await ctx.supabase
    .from('assets')
    .select('id, organization_id, status, archived_at')
    .in('id', validation.data.asset_ids);

  if (!assets || assets.length !== validation.data.asset_ids.length) {
    return { error: 'Uno o más activos no existen' };
  }

  const invalidAssets = assets.filter(
    (a) =>
      a.organization_id !== orgId ||
      a.archived_at !== null ||
      a.status === 'retired' ||
      a.status === 'lost'
  );

  if (invalidAssets.length > 0) {
    return {
      error: `${invalidAssets.length} activo(s) no están disponibles para solicitud`,
    };
  }

  // Crear la solicitud
  const { data: newRequest, error: requestError } = await ctx.supabase
    .from('asset_requests')
    .insert({
      organization_id: orgId,
      requested_by: ctx.userId,
      purpose: validation.data.purpose,
      client_id: validation.data.client_id || null,
      start_date: validation.data.start_date,
      end_date: validation.data.end_date,
      status: 'pending',
    })
    .select('id')
    .single();

  if (requestError || !newRequest) {
    return { error: `Error al crear solicitud: ${requestError?.message}` };
  }

  // Crear los items
  const items = validation.data.asset_ids.map((asset_id) => ({
    request_id: newRequest.id,
    asset_id,
  }));

  const { error: itemsError } = await ctx.supabase
    .from('asset_request_items')
    .insert(items);

  if (itemsError) {
    // Si fallan los items, borrar la solicitud para no dejar huérfana
    await ctx.supabase
      .from('asset_requests')
      .delete()
      .eq('id', newRequest.id);
    return { error: `Error al agregar activos: ${itemsError.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/requests');
  return { success: true, requestId: newRequest.id };
}

// ============================================================
// CANCELAR SOLICITUD (solo el solicitante, pending o approved)
// ============================================================

export async function cancelAssetRequestAction(requestId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: request } = await ctx.supabase
    .from('asset_requests')
    .select('id, status, requested_by')
    .eq('id', requestId)
    .maybeSingle();

  if (!request) return { error: 'Solicitud no encontrada' };

  if (!['pending', 'approved'].includes(request.status)) {
    return {
      error: `No se puede cancelar una solicitud en estado ${request.status}`,
    };
  }

  // Solo el solicitante o super admin puede cancelar
  if (!ctx.isSuperAdmin && request.requested_by !== ctx.userId) {
    return { error: 'Solo el solicitante puede cancelar su solicitud' };
  }

  const { error } = await ctx.supabase
    .from('asset_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/inventory');
  revalidatePath('/inventory/requests');
  revalidatePath(`/inventory/requests/${requestId}`);
  return { success: true };
}

// ============================================================
// APROBAR SOLICITUD
// ============================================================

export async function approveAssetRequestAction(payload: {
  request_id: string;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (ctx.isSuperAdmin && !ctx.impersonatingOrgId) {
    return { error: 'Super Admin debe impersonar para aprobar solicitudes' };
  }

  const { data: request } = await ctx.supabase
    .from('asset_requests')
    .select('id, status')
    .eq('id', payload.request_id)
    .maybeSingle();

  if (!request) return { error: 'Solicitud no encontrada' };

  if (request.status !== 'pending') {
    return {
      error: `Solo se pueden aprobar solicitudes pendientes (actual: ${request.status})`,
    };
  }

  const { error } = await ctx.supabase
    .from('asset_requests')
    .update({
      status: 'approved',
      decided_by: ctx.isSuperAdmin ? null : ctx.userId,
      decided_at: new Date().toISOString(),
      decision_notes: payload.notes || null,
    })
    .eq('id', payload.request_id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/inventory');
  revalidatePath('/inventory/requests');
  revalidatePath(`/inventory/requests/${payload.request_id}`);
  return { success: true };
}

// ============================================================
// RECHAZAR SOLICITUD
// ============================================================

export async function rejectAssetRequestAction(payload: {
  request_id: string;
  notes: string; // razón obligatoria
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!payload.notes || payload.notes.trim().length < 3) {
    return {
      error: 'Debes indicar el motivo del rechazo',
    };
  }

  const { data: request } = await ctx.supabase
    .from('asset_requests')
    .select('id, status')
    .eq('id', payload.request_id)
    .maybeSingle();

  if (!request) return { error: 'Solicitud no encontrada' };

  if (request.status !== 'pending') {
    return {
      error: `Solo se pueden rechazar solicitudes pendientes (actual: ${request.status})`,
    };
  }

  const { error } = await ctx.supabase
    .from('asset_requests')
    .update({
      status: 'rejected',
      decided_by: ctx.isSuperAdmin ? null : ctx.userId,
      decided_at: new Date().toISOString(),
      decision_notes: payload.notes.trim(),
    })
    .eq('id', payload.request_id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/inventory');
  revalidatePath('/inventory/requests');
  revalidatePath(`/inventory/requests/${payload.request_id}`);
  return { success: true };
}

// ============================================================
// CHECKOUT (entregar todos los activos de la solicitud)
// ============================================================

export async function checkoutAssetRequestAction(payload: {
  request_id: string;
  checkout_notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // Cargar la solicitud y sus items
  const { data: request } = await ctx.supabase
    .from('asset_requests')
    .select('id, status, requested_by, organization_id')
    .eq('id', payload.request_id)
    .maybeSingle();

  if (!request) return { error: 'Solicitud no encontrada' };

  if (request.status !== 'approved') {
    return {
      error: `Solo se puede hacer checkout de solicitudes aprobadas (actual: ${request.status})`,
    };
  }

  // Cargar items
  const { data: items } = await ctx.supabase
    .from('asset_request_items')
    .select('id, asset_id, checkout_at')
    .eq('request_id', payload.request_id);

  if (!items || items.length === 0) {
    return { error: 'La solicitud no tiene items' };
  }

  // Filtrar items que aún no han sido entregados
  const pendingItems = items.filter((i) => !i.checkout_at);
  if (pendingItems.length === 0) {
    return { error: 'Todos los items ya fueron entregados' };
  }

  // Validar disponibilidad de cada activo
  const assetIds = pendingItems.map((i) => i.asset_id);
  const { data: assets } = await ctx.supabase
    .from('assets')
    .select('id, status, name')
    .in('id', assetIds);

  if (!assets || assets.length !== assetIds.length) {
    return { error: 'Uno o más activos ya no existen' };
  }

  const unavailable = assets.filter((a) => a.status !== 'available');
  if (unavailable.length > 0) {
    const names = unavailable.map((a) => a.name).join(', ');
    return {
      error: `Activos no disponibles: ${names}. Verifica su estado.`,
    };
  }

  // Para cada item: registrar movimiento de checkout
  const performedBy = ctx.isSuperAdmin ? undefined : ctx.userId;
  const checkoutTime = new Date().toISOString();

  for (const item of pendingItems) {
    const { error: movementError } = await ctx.supabase.rpc(
      'register_asset_movement',
      {
        p_asset_id: item.asset_id,
        p_movement_type: 'checkout',
        p_new_status: 'checked_out',
        p_to_user_id: request.requested_by,
        p_related_request_id: request.id,
        p_notes: payload.checkout_notes || 'Checkout por solicitud aprobada',
        p_performed_by: performedBy,
      }
    );

    if (movementError) {
      return {
        error: `Error al entregar activo: ${movementError.message}`,
      };
    }

    // Marcar checkout_at en el item
    await ctx.supabase
      .from('asset_request_items')
      .update({
        checkout_at: checkoutTime,
        checkout_notes: payload.checkout_notes || null,
      })
      .eq('id', item.id);
  }

  // Actualizar estado de la solicitud a 'active'
  await ctx.supabase
    .from('asset_requests')
    .update({ status: 'active' })
    .eq('id', request.id);

  revalidatePath('/inventory');
  revalidatePath('/inventory/requests');
  revalidatePath(`/inventory/requests/${request.id}`);
  revalidatePath('/inventory/assets');
  return { success: true };
}

// ============================================================
// CHECKIN — Devolución parcial o total
// ============================================================

export async function checkinAssetRequestItemsAction(payload: {
  request_id: string;
  items: Array<{
    item_id: string;
    return_condition: 'ok' | 'minor_damage' | 'major_damage' | 'lost';
    return_notes?: string | null;
  }>;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!payload.items || payload.items.length === 0) {
    return { error: 'Selecciona al menos un item para devolver' };
  }

  // Validar schema de cada item
  for (const item of payload.items) {
    const validation = checkinItemSchema.safeParse(item);
    if (!validation.success) {
      return { error: validation.error.errors[0].message };
    }
  }

  // Cargar la solicitud
  const { data: request } = await ctx.supabase
    .from('asset_requests')
    .select('id, status, organization_id, requested_by')
    .eq('id', payload.request_id)
    .maybeSingle();

  if (!request) return { error: 'Solicitud no encontrada' };

  if (request.status !== 'active') {
    return {
      error: `Solo se puede recibir devolución de solicitudes activas (actual: ${request.status})`,
    };
  }

  // Cargar items con su asset asociado
  const itemIds = payload.items.map((i) => i.item_id);
  const { data: items } = await ctx.supabase
    .from('asset_request_items')
    .select('id, asset_id, request_id, checkout_at, return_at')
    .in('id', itemIds);

  if (!items || items.length !== itemIds.length) {
    return { error: 'Uno o más items no existen' };
  }

  // Validar que todos pertenezcan a esta solicitud y no se hayan devuelto
  const invalidItems = items.filter(
    (i) =>
      i.request_id !== request.id ||
      !i.checkout_at ||
      i.return_at !== null
  );
  if (invalidItems.length > 0) {
    return {
      error:
        'Algunos items no pertenecen a esta solicitud o ya fueron devueltos',
    };
  }

  // Cargar warehouses originales de cada asset (donde devolverlos)
  // Estrategia: devolverlos al último warehouse conocido antes del checkout
  const assetIds = items.map((i) => i.asset_id);
  const { data: lastMovements } = await ctx.supabase
    .from('asset_movements')
    .select('asset_id, from_warehouse_id, created_at')
    .in('asset_id', assetIds)
    .eq('movement_type', 'checkout')
    .order('created_at', { ascending: false });

  // Mapear cada asset a su warehouse de origen (el primer checkout que aparece es el más reciente)
  const assetToWarehouse: Record<string, string | null> = {};
  for (const movement of lastMovements || []) {
    if (!assetToWarehouse[movement.asset_id]) {
      assetToWarehouse[movement.asset_id] = movement.from_warehouse_id;
    }
  }

  const performedBy = ctx.isSuperAdmin ? undefined : ctx.userId;
  const returnTime = new Date().toISOString();

  // Para cada item: registrar checkin
  for (const itemPayload of payload.items) {
    const item = items.find((i) => i.id === itemPayload.item_id);
    if (!item) continue;

    const returnWarehouseId = assetToWarehouse[item.asset_id];

    // Si la condición de retorno es 'lost', el activo se marca como perdido
    const newStatus =
      itemPayload.return_condition === 'lost'
        ? 'lost'
        : itemPayload.return_condition === 'major_damage'
          ? 'in_maintenance'
          : 'available';

    const movementType =
      itemPayload.return_condition === 'lost' ? 'marked_lost' : 'checkin';

    const { error: movementError } = await ctx.supabase.rpc(
      'register_asset_movement',
      {
        p_asset_id: item.asset_id,
        p_movement_type: movementType,
        p_new_status: newStatus,
        p_to_warehouse_id:
          newStatus === 'available' || newStatus === 'in_maintenance'
            ? returnWarehouseId || undefined
            : undefined,
        p_to_user_id: undefined, // se libera de manos
        p_related_request_id: request.id,
        p_notes:
          itemPayload.return_notes ||
          `Checkin (${itemPayload.return_condition})`,
        p_performed_by: performedBy,
      }
    );

    if (movementError) {
      return {
        error: `Error al recibir activo: ${movementError.message}`,
      };
    }

    // Marcar return_at en el item
    await ctx.supabase
      .from('asset_request_items')
      .update({
        return_at: returnTime,
        return_condition: itemPayload.return_condition,
        return_notes: itemPayload.return_notes || null,
      })
      .eq('id', itemPayload.item_id);
  }

  // Verificar si TODOS los items de la solicitud ya fueron devueltos
  const { data: allItems } = await ctx.supabase
    .from('asset_request_items')
    .select('id, return_at')
    .eq('request_id', request.id);

  const allReturned = (allItems || []).every((i) => i.return_at !== null);

  if (allReturned) {
    await ctx.supabase
      .from('asset_requests')
      .update({ status: 'returned' })
      .eq('id', request.id);
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/requests');
  revalidatePath(`/inventory/requests/${request.id}`);
  revalidatePath('/inventory/assets');
  return { success: true, allReturned };
}

// ============================================================
// AGREGAR ACTIVO A SOLICITUD EXISTENTE (solo pending)
// ============================================================

export async function addAssetToRequestAction(payload: {
  request_id: string;
  asset_id: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: request } = await ctx.supabase
    .from('asset_requests')
    .select('id, status, requested_by, organization_id')
    .eq('id', payload.request_id)
    .maybeSingle();

  if (!request) return { error: 'Solicitud no encontrada' };

  if (request.status !== 'pending') {
    return {
      error: 'Solo se pueden modificar items de solicitudes pendientes',
    };
  }

  // Solo el solicitante puede modificar (o super admin)
  if (!ctx.isSuperAdmin && request.requested_by !== ctx.userId) {
    return {
      error: 'Solo el solicitante puede modificar su solicitud',
    };
  }

  // Validar asset
  const { data: asset } = await ctx.supabase
    .from('assets')
    .select('id, organization_id, status, archived_at')
    .eq('id', payload.asset_id)
    .maybeSingle();

  if (!asset || asset.organization_id !== request.organization_id) {
    return { error: 'El activo no es válido' };
  }

  if (asset.archived_at || ['retired', 'lost'].includes(asset.status)) {
    return { error: 'El activo no está disponible para solicitud' };
  }

  const { error } = await ctx.supabase
    .from('asset_request_items')
    .insert({
      request_id: payload.request_id,
      asset_id: payload.asset_id,
    });

  if (error) {
    if (error.message.includes('duplicate key')) {
      return { error: 'Este activo ya está en la solicitud' };
    }
    return { error: `Error: ${error.message}` };
  }

  revalidatePath(`/inventory/requests/${payload.request_id}`);
  return { success: true };
}

// ============================================================
// QUITAR ACTIVO DE SOLICITUD (solo pending)
// ============================================================

export async function removeAssetFromRequestAction(payload: {
  request_id: string;
  item_id: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: request } = await ctx.supabase
    .from('asset_requests')
    .select('id, status, requested_by')
    .eq('id', payload.request_id)
    .maybeSingle();

  if (!request) return { error: 'Solicitud no encontrada' };

  if (request.status !== 'pending') {
    return {
      error: 'Solo se pueden modificar items de solicitudes pendientes',
    };
  }

  if (!ctx.isSuperAdmin && request.requested_by !== ctx.userId) {
    return { error: 'Solo el solicitante puede modificar su solicitud' };
  }

  // Verificar que quede al menos 1 item después de quitar
  const { count } = await ctx.supabase
    .from('asset_request_items')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', payload.request_id);

  if ((count || 0) <= 1) {
    return {
      error:
        'Una solicitud debe tener al menos 1 activo. Si no quieres pedir nada, cancela la solicitud.',
    };
  }

  const { error } = await ctx.supabase
    .from('asset_request_items')
    .delete()
    .eq('id', payload.item_id)
    .eq('request_id', payload.request_id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath(`/inventory/requests/${payload.request_id}`);
  return { success: true };
}
