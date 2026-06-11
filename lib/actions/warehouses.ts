'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  type: z.enum(['fixed', 'mobile', 'personal']),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  location_notes: z.string().max(500).optional().nullable(),
});

const updateWarehouseSchema = createWarehouseSchema.extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
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

function parseWarehouseFormData(formData: FormData) {
  return {
    name: ((formData.get('name') as string) || '').trim(),
    type: (formData.get('type') as 'fixed' | 'mobile' | 'personal') || 'fixed',
    assigned_to_user_id:
      ((formData.get('assigned_to_user_id') as string) || '').trim() || null,
    description:
      ((formData.get('description') as string) || '').trim() || null,
    location_notes:
      ((formData.get('location_notes') as string) || '').trim() || null,
  };
}

// ============================================================
// CREAR ALMACÉN
// ============================================================

export async function createWarehouseAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const data = parseWarehouseFormData(formData);

  const validation = createWarehouseSchema.safeParse(data);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  // Si es personal, debe tener usuario asignado
  if (validation.data.type === 'personal' && !validation.data.assigned_to_user_id) {
    return {
      error: 'Los almacenes personales deben tener un usuario asignado',
    };
  }

  const { data: newWarehouse, error } = await ctx.supabase
    .from('warehouses')
    .insert({
      ...validation.data,
      organization_id: orgId,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (error) {
    if (error.message.includes('duplicate key')) {
      return {
        error: 'Ya existe un almacén con ese nombre en esta organización',
      };
    }
    return { error: `Error al crear almacén: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/warehouses');
  return { success: true, warehouseId: newWarehouse.id };
}

// ============================================================
// EDITAR ALMACÉN
// ============================================================

export async function updateWarehouseAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID requerido' };

  const data = parseWarehouseFormData(formData);

  const validation = updateWarehouseSchema.safeParse({ ...data, id });
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  if (validation.data.type === 'personal' && !validation.data.assigned_to_user_id) {
    return {
      error: 'Los almacenes personales deben tener un usuario asignado',
    };
  }

  const { id: _, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('warehouses')
    .update(updateData)
    .eq('id', id);

  if (error) {
    if (error.message.includes('duplicate key')) {
      return { error: 'Ya existe un almacén con ese nombre' };
    }
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/warehouses');
  revalidatePath(`/inventory/warehouses/${id}`);
  return { success: true };
}

// ============================================================
// ARCHIVAR ALMACÉN
// ============================================================

export async function archiveWarehouseAction(warehouseId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // Verificar que no haya activos en este almacén
  const { count } = await ctx.supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('current_warehouse_id', warehouseId)
    .is('archived_at', null);

  if (count && count > 0) {
    return {
      error: `No se puede archivar: hay ${count} activo(s) en este almacén. Muévelos primero.`,
    };
  }

  const { error } = await ctx.supabase
    .from('warehouses')
    .update({
      archived_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('id', warehouseId);

  if (error) {
    return { error: `Error al archivar: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/warehouses');
  return { success: true };
}

// ============================================================
// RESTAURAR ALMACÉN
// ============================================================

export async function restoreWarehouseAction(warehouseId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('warehouses')
    .update({
      archived_at: null,
      is_active: true,
    })
    .eq('id', warehouseId);

  if (error) {
    return { error: `Error al restaurar: ${error.message}` };
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/warehouses');
  return { success: true };
}

// ============================================================
// ELIMINAR ALMACÉN (solo super admin, sin activos)
// ============================================================

export async function deleteWarehouseAction(warehouseId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!ctx.isSuperAdmin) {
    return {
      error: 'Solo super admin puede eliminar almacenes permanentemente',
    };
  }

  // Verificar que no haya activos (incluso archivados que aún apunten aquí)
  const { count } = await ctx.supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('current_warehouse_id', warehouseId);

  if (count && count > 0) {
    return {
      error: `No se puede eliminar: hay ${count} activo(s) asociados al almacén.`,
    };
  }

  const { error } = await ctx.supabase
    .from('warehouses')
    .delete()
    .eq('id', warehouseId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath('/inventory/warehouses');
  return { success: true };
}
