'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { AssetCategory } from '@/lib/types/database';

// ============================================================
// SCHEMAS
// ============================================================

const ASSET_CATEGORIES: [AssetCategory, ...AssetCategory[]] = [
  'camera',
  'lens',
  'audio',
  'lighting',
  'support',
  'storage',
  'power',
  'cable',
  'computer',
  'drone',
  'accessory',
  'other',
];

const createAssetSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  category: z.enum(ASSET_CATEGORIES),
  current_warehouse_id: z.string().uuid('Almacén inválido'),
  photo_url: z.string().url().optional().nullable().or(z.literal('')),
  estimated_value: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_invoice_number: z.string().max(100).optional().nullable(),
  warranty_until: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const updateAssetSchema = createAssetSchema
  .omit({ current_warehouse_id: true })
  .extend({
    id: z.string().uuid(),
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
// PARSE FORM DATA
// ============================================================

function parseAssetFormData(formData: FormData) {
  const valueRaw = (formData.get('estimated_value') as string) || '';
  const estimatedValue =
    valueRaw.trim() === '' ? null : parseFloat(valueRaw);

  return {
    name: ((formData.get('name') as string) || '').trim(),
    brand: ((formData.get('brand') as string) || '').trim() || null,
    model: ((formData.get('model') as string) || '').trim() || null,
    serial_number:
      ((formData.get('serial_number') as string) || '').trim() || null,
    category: (formData.get('category') as AssetCategory) || 'other',
    current_warehouse_id:
      ((formData.get('current_warehouse_id') as string) || '').trim(),
    photo_url: ((formData.get('photo_url') as string) || '').trim() || null,
    estimated_value:
      estimatedValue === null || isNaN(estimatedValue)
        ? null
        : estimatedValue,
    currency:
      ((formData.get('currency') as string) || 'MXN').trim().toUpperCase() ||
      'MXN',
    purchase_date:
      ((formData.get('purchase_date') as string) || '').trim() || null,
    purchase_invoice_number:
      ((formData.get('purchase_invoice_number') as string) || '').trim() ||
      null,
    warranty_until:
      ((formData.get('warranty_until') as string) || '').trim() || null,
    notes: ((formData.get('notes') as string) || '').trim() || null,
  };
}

// ============================================================
// CREAR ACTIVO
// ============================================================

export async function createAssetAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const data = parseAssetFormData(formData);

  const validation = createAssetSchema.safeParse(data);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  // Verificar que el almacén pertenezca a la org
  const { data: warehouse } = await ctx.supabase
    .from('warehouses')
    .select('id, organization_id')
    .eq('id', validation.data.current_warehouse_id)
    .maybeSingle();

  if (!warehouse || warehouse.organization_id !== orgId) {
    return { error: 'El almacén seleccionado no es válido' };
  }

  // Insertar activo
  const { data: newAsset, error: insertError } = await ctx.supabase
    .from('assets')
    .insert({
      ...validation.data,
      organization_id: orgId,
      status: 'available',
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.message.includes('duplicate key')) {
      return {
        error: 'Ya existe un activo con ese número de serie en la organización',
      };
    }
    return { error: `Error al crear activo: ${insertError.message}` };
  }

  // Registrar el movimiento inicial "acquired" via función SQL
  const { error: movementError } = await ctx.supabase.rpc(
    'register_asset_movement',
    {
      p_asset_id: newAsset.id,
      p_movement_type: 'acquired',
      p_new_status: 'available',
      p_to_warehouse_id: validation.data.current_warehouse_id,
      p_notes: 'Activo dado de alta en el sistema',
      p_performed_by: ctx.isSuperAdmin ? undefined : ctx.userId,
    }
  );

  if (movementError) {
    // No bloqueamos al usuario, pero loggeamos: el activo ya se creó
    console.error(
      '[assets] Error registrando movimiento inicial:',
      movementError
    );
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  return { success: true, assetId: newAsset.id };
}

// ============================================================
// EDITAR ACTIVO (campos de identidad, no movimiento)
// ============================================================

export async function updateAssetAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID requerido' };

  // No editamos current_warehouse_id aquí — eso usa transferAssetAction
  const data = parseAssetFormData(formData);

  const validation = updateAssetSchema.safeParse({
    id,
    name: data.name,
    brand: data.brand,
    model: data.model,
    serial_number: data.serial_number,
    category: data.category,
    photo_url: data.photo_url,
    estimated_value: data.estimated_value,
    currency: data.currency,
    purchase_date: data.purchase_date,
    purchase_invoice_number: data.purchase_invoice_number,
    warranty_until: data.warranty_until,
    notes: data.notes,
  });

  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { id: _, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('assets')
    .update(updateData)
    .eq('id', id);

  if (error) {
    if (error.message.includes('duplicate key')) {
      return { error: 'Ya existe un activo con ese número de serie' };
    }
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  revalidatePath(`/inventory/assets/${id}`);
  return { success: true };
}

// ============================================================
// TRANSFERIR ACTIVO (cambiar de almacén sin checkout)
// ============================================================

export async function transferAssetAction(payload: {
  asset_id: string;
  to_warehouse_id: string;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!payload.asset_id || !payload.to_warehouse_id) {
    return { error: 'Faltan datos requeridos' };
  }

  // Validar que el activo y el almacén existan y pertenezcan a la org
  const { data: asset } = await ctx.supabase
    .from('assets')
    .select('id, organization_id, status, current_warehouse_id')
    .eq('id', payload.asset_id)
    .maybeSingle();

  if (!asset) return { error: 'Activo no encontrado' };

  if (asset.status === 'checked_out') {
    return {
      error:
        'Este activo está en mano de alguien. Debe devolverse primero antes de transferirlo.',
    };
  }

  if (asset.status === 'retired' || asset.status === 'lost') {
    return { error: `No se puede transferir un activo ${asset.status}` };
  }

  if (asset.current_warehouse_id === payload.to_warehouse_id) {
    return { error: 'El activo ya está en ese almacén' };
  }

  const { data: warehouse } = await ctx.supabase
    .from('warehouses')
    .select('id, organization_id, is_active, archived_at')
    .eq('id', payload.to_warehouse_id)
    .maybeSingle();

  if (
    !warehouse ||
    warehouse.organization_id !== asset.organization_id ||
    !warehouse.is_active ||
    warehouse.archived_at
  ) {
    return { error: 'El almacén destino no es válido o está inactivo' };
  }

  // Registrar movimiento (actualiza activo + log atómicamente)
  const { error } = await ctx.supabase.rpc('register_asset_movement', {
    p_asset_id: payload.asset_id,
    p_movement_type: 'transfer',
    p_new_status: 'available',
    p_to_warehouse_id: payload.to_warehouse_id,
    p_notes: payload.notes || 'Transferencia entre almacenes',
    p_performed_by: ctx.isSuperAdmin ? undefined : ctx.userId,
  });

  if (error) {
    return { error: `Error al transferir: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  revalidatePath(`/inventory/assets/${payload.asset_id}`);
  return { success: true };
}

// ============================================================
// ENVIAR A MANTENIMIENTO
// ============================================================

export async function sendToMaintenanceAction(payload: {
  asset_id: string;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: asset } = await ctx.supabase
    .from('assets')
    .select('status')
    .eq('id', payload.asset_id)
    .maybeSingle();

  if (!asset) return { error: 'Activo no encontrado' };

  if (asset.status === 'in_maintenance') {
    return { error: 'Este activo ya está en mantenimiento' };
  }

  if (asset.status === 'retired' || asset.status === 'lost') {
    return {
      error: `No se puede mandar a mantenimiento un activo ${asset.status}`,
    };
  }

  if (asset.status === 'checked_out') {
    return {
      error:
        'Este activo está en mano de alguien. Debe devolverse antes de enviarlo a mantenimiento.',
    };
  }

  const { error } = await ctx.supabase.rpc('register_asset_movement', {
    p_asset_id: payload.asset_id,
    p_movement_type: 'maintenance_out',
    p_new_status: 'in_maintenance',
    p_notes: payload.notes || 'Enviado a mantenimiento',
    p_performed_by: ctx.isSuperAdmin ? undefined : ctx.userId,
  });

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  revalidatePath(`/inventory/assets/${payload.asset_id}`);
  return { success: true };
}

// ============================================================
// REGRESAR DE MANTENIMIENTO
// ============================================================

export async function returnFromMaintenanceAction(payload: {
  asset_id: string;
  to_warehouse_id: string;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: asset } = await ctx.supabase
    .from('assets')
    .select('status, organization_id')
    .eq('id', payload.asset_id)
    .maybeSingle();

  if (!asset) return { error: 'Activo no encontrado' };

  if (asset.status !== 'in_maintenance') {
    return {
      error: 'Este activo no está en mantenimiento',
    };
  }

  const { data: warehouse } = await ctx.supabase
    .from('warehouses')
    .select('id, organization_id, is_active, archived_at')
    .eq('id', payload.to_warehouse_id)
    .maybeSingle();

  if (
    !warehouse ||
    warehouse.organization_id !== asset.organization_id ||
    !warehouse.is_active ||
    warehouse.archived_at
  ) {
    return { error: 'El almacén destino no es válido' };
  }

  const { error } = await ctx.supabase.rpc('register_asset_movement', {
    p_asset_id: payload.asset_id,
    p_movement_type: 'maintenance_in',
    p_new_status: 'available',
    p_to_warehouse_id: payload.to_warehouse_id,
    p_notes: payload.notes || 'Regresó de mantenimiento',
    p_performed_by: ctx.isSuperAdmin ? undefined : ctx.userId,
  });

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  revalidatePath(`/inventory/assets/${payload.asset_id}`);
  return { success: true };
}

// ============================================================
// MARCAR COMO PERDIDO
// ============================================================

export async function markAssetAsLostAction(payload: {
  asset_id: string;
  notes: string; // razón requerida
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!payload.notes || payload.notes.trim().length < 5) {
    return {
      error: 'Debes describir las circunstancias del extravío (mínimo 5 caracteres)',
    };
  }

  const { data: asset } = await ctx.supabase
    .from('assets')
    .select('status')
    .eq('id', payload.asset_id)
    .maybeSingle();

  if (!asset) return { error: 'Activo no encontrado' };

  if (asset.status === 'lost') {
    return { error: 'Este activo ya está marcado como perdido' };
  }

  if (asset.status === 'retired') {
    return { error: 'Este activo ya está dado de baja' };
  }

  const { error } = await ctx.supabase.rpc('register_asset_movement', {
    p_asset_id: payload.asset_id,
    p_movement_type: 'marked_lost',
    p_new_status: 'lost',
    p_notes: payload.notes.trim(),
    p_performed_by: ctx.isSuperAdmin ? undefined : ctx.userId,
  });

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  revalidatePath(`/inventory/assets/${payload.asset_id}`);
  return { success: true };
}

// ============================================================
// RECUPERAR ACTIVO PERDIDO
// ============================================================

export async function recoverLostAssetAction(payload: {
  asset_id: string;
  to_warehouse_id: string;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: asset } = await ctx.supabase
    .from('assets')
    .select('status, organization_id')
    .eq('id', payload.asset_id)
    .maybeSingle();

  if (!asset) return { error: 'Activo no encontrado' };

  if (asset.status !== 'lost') {
    return { error: 'Este activo no está marcado como perdido' };
  }

  const { data: warehouse } = await ctx.supabase
    .from('warehouses')
    .select('id, organization_id, is_active, archived_at')
    .eq('id', payload.to_warehouse_id)
    .maybeSingle();

  if (
    !warehouse ||
    warehouse.organization_id !== asset.organization_id ||
    !warehouse.is_active ||
    warehouse.archived_at
  ) {
    return { error: 'El almacén destino no es válido' };
  }

  const { error } = await ctx.supabase.rpc('register_asset_movement', {
    p_asset_id: payload.asset_id,
    p_movement_type: 'transfer',
    p_new_status: 'available',
    p_to_warehouse_id: payload.to_warehouse_id,
    p_notes: payload.notes || 'Recuperado y reingresado al inventario',
    p_performed_by: ctx.isSuperAdmin ? undefined : ctx.userId,
  });

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  revalidatePath(`/inventory/assets/${payload.asset_id}`);
  return { success: true };
}

// ============================================================
// DAR DE BAJA (RETIRE)
// ============================================================

export async function retireAssetAction(payload: {
  asset_id: string;
  notes: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!payload.notes || payload.notes.trim().length < 5) {
    return {
      error: 'Debes indicar el motivo de la baja (mínimo 5 caracteres)',
    };
  }

  const { data: asset } = await ctx.supabase
    .from('assets')
    .select('status')
    .eq('id', payload.asset_id)
    .maybeSingle();

  if (!asset) return { error: 'Activo no encontrado' };

  if (asset.status === 'retired') {
    return { error: 'Este activo ya está dado de baja' };
  }

  if (asset.status === 'checked_out') {
    return {
      error:
        'No se puede dar de baja un activo en mano de alguien. Debe devolverse primero.',
    };
  }

  const { error } = await ctx.supabase.rpc('register_asset_movement', {
    p_asset_id: payload.asset_id,
    p_movement_type: 'retired',
    p_new_status: 'retired',
    p_notes: payload.notes.trim(),
    p_performed_by: ctx.isSuperAdmin ? undefined : ctx.userId,
  });

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  revalidatePath(`/inventory/assets/${payload.asset_id}`);
  return { success: true };
}

// ============================================================
// ARCHIVAR ACTIVO (soft delete)
// ============================================================

export async function archiveAssetAction(assetId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: asset } = await ctx.supabase
    .from('assets')
    .select('status')
    .eq('id', assetId)
    .maybeSingle();

  if (!asset) return { error: 'Activo no encontrado' };

  if (asset.status === 'checked_out') {
    return {
      error: 'No se puede archivar un activo en mano de alguien',
    };
  }

  const { error } = await ctx.supabase
    .from('assets')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .eq('id', assetId);

  if (error) {
    return { error: `Error al archivar: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  return { success: true };
}

// ============================================================
// RESTAURAR ACTIVO ARCHIVADO
// ============================================================

export async function restoreAssetAction(assetId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('assets')
    .update({
      archived_at: null,
      archived_by: null,
    })
    .eq('id', assetId);

  if (error) {
    return { error: `Error al restaurar: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/assets');
  return { success: true };
}

// ============================================================
// ELIMINAR PERMANENTEMENTE (solo super admin)
// ============================================================

export async function deleteAssetAction(assetId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!ctx.isSuperAdmin) {
    return {
      error: 'Solo super admin puede eliminar activos permanentemente',
    };
  }

  // Verificar que no esté en una solicitud activa
  const { count } = await ctx.supabase
    .from('asset_request_items')
    .select('*', { count: 'exact', head: true })
    .eq('asset_id', assetId);

  if (count && count > 0) {
    return {
      error: `No se puede eliminar: el activo aparece en ${count} solicitud(es) históricas. Archívalo en su lugar para preservar el historial.`,
    };
  }

  const { error } = await ctx.supabase
    .from('assets')
    .delete()
    .eq('id', assetId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath('/inventory/assets');
  return { success: true };
}
