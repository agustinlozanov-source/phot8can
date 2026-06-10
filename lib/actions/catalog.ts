'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS DE VALIDACIÓN
// ============================================================

const createServiceSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  description: z.string().max(1000).optional().nullable(),
  sku: z.string().max(50).optional().nullable(),
  service_type: z.enum(['atomic', 'package', 'addon']),
  default_price: z
    .number()
    .min(0, 'El precio no puede ser negativo')
    .max(99999999.99),
  currency: z.string().length(3).default('MXN'),
  unit: z.string().min(1).max(50).default('pieza'),
  color: z.string().max(20).optional().nullable(),
});

const updateServiceSchema = createServiceSchema.extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
});

const compositionItemSchema = z.object({
  included_service_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(9999),
  notes: z.string().max(500).optional().nullable(),
});

const updatePackageCompositionSchema = z.object({
  package_service_id: z.string().uuid(),
  items: z.array(compositionItemSchema),
});

const createTaxSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  code: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  percentage: z
    .number()
    .min(0, 'El porcentaje no puede ser negativo')
    .max(100, 'El porcentaje no puede ser mayor a 100'),
  is_enabled: z.boolean().default(true),
  apply_by_default: z.boolean().default(true),
});

const updateTaxSchema = createTaxSchema.extend({
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

  if (!user) {
    return { error: 'No autenticado' as const };
  }

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    // Super admin necesita organization_id pasado explícito o impersonando
    const impersonatingCookie = await import('@/lib/actions/impersonation').then(
      (m) => m.getImpersonatedOrganizationId()
    );

    return {
      isSuperAdmin: true as const,
      supabase,
      impersonatingOrgId: impersonatingCookie,
    };
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!appUser) {
    return { error: 'Usuario no encontrado' as const };
  }

  return {
    isSuperAdmin: false as const,
    supabase,
    userId: appUser.id,
    organizationId: appUser.organization_id,
  };
}

// Helper: obtener organization_id efectivo
function resolveOrgId(
  ctx: Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>,
  formOrgId?: string | null
): string | null {
  if (!ctx.isSuperAdmin) return ctx.organizationId;
  if (ctx.impersonatingOrgId) return ctx.impersonatingOrgId;
  if (formOrgId) return formOrgId;
  return null;
}

// ============================================================
// SERVICES — CREAR
// ============================================================

export async function createServiceAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const rawData = {
    name: ((formData.get('name') as string) || '').trim(),
    description:
      ((formData.get('description') as string) || '').trim() || null,
    sku: ((formData.get('sku') as string) || '').trim() || null,
    service_type: formData.get('service_type') as
      | 'atomic'
      | 'package'
      | 'addon',
    default_price: parseFloat((formData.get('default_price') as string) || '0'),
    currency: ((formData.get('currency') as string) || 'MXN').toUpperCase(),
    unit: ((formData.get('unit') as string) || 'pieza').trim(),
    color: ((formData.get('color') as string) || '').trim() || null,
  };

  const validation = createServiceSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx, formData.get('organization_id') as string);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  const { data: newService, error } = await ctx.supabase
    .from('services')
    .insert({
      ...validation.data,
      organization_id: orgId,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (error) {
    if (error.message.includes('duplicate key')) {
      return { error: 'Ya existe un servicio con ese SKU en esta organización' };
    }
    return { error: `Error al crear servicio: ${error.message}` };
  }

  revalidatePath('/catalog');
  revalidatePath('/catalog/services');
  return { success: true, serviceId: newService.id };
}

// ============================================================
// SERVICES — EDITAR
// ============================================================

export async function updateServiceAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID requerido' };

  const rawData = {
    id,
    name: ((formData.get('name') as string) || '').trim(),
    description:
      ((formData.get('description') as string) || '').trim() || null,
    sku: ((formData.get('sku') as string) || '').trim() || null,
    service_type: formData.get('service_type') as
      | 'atomic'
      | 'package'
      | 'addon',
    default_price: parseFloat((formData.get('default_price') as string) || '0'),
    currency: ((formData.get('currency') as string) || 'MXN').toUpperCase(),
    unit: ((formData.get('unit') as string) || 'pieza').trim(),
    color: ((formData.get('color') as string) || '').trim() || null,
    is_active: formData.get('is_active') === 'on',
  };

  const validation = updateServiceSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { id: _, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('services')
    .update(updateData)
    .eq('id', id);

  if (error) {
    if (error.message.includes('duplicate key')) {
      return { error: 'Ya existe un servicio con ese SKU' };
    }
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath('/catalog');
  revalidatePath(`/catalog/services/${id}`);
  return { success: true };
}

// ============================================================
// SERVICES — ARCHIVAR / RESTAURAR / ELIMINAR
// ============================================================

export async function archiveServiceAction(serviceId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('services')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: ctx.isSuperAdmin ? null : ctx.userId,
      is_active: false,
    })
    .eq('id', serviceId);

  if (error) {
    return { error: `Error al archivar: ${error.message}` };
  }

  revalidatePath('/catalog');
  return { success: true };
}

export async function restoreServiceAction(serviceId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('services')
    .update({
      archived_at: null,
      archived_by: null,
      is_active: true,
    })
    .eq('id', serviceId);

  if (error) {
    return { error: `Error al restaurar: ${error.message}` };
  }

  revalidatePath('/catalog');
  return { success: true };
}

export async function deleteServiceAction(serviceId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!ctx.isSuperAdmin) {
    return {
      error: 'Solo super admin puede eliminar servicios permanentemente',
    };
  }

  const { error } = await ctx.supabase
    .from('services')
    .delete()
    .eq('id', serviceId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath('/catalog');
  return { success: true };
}

// ============================================================
// PACKAGE COMPOSITION — REEMPLAZAR COMPOSICIÓN COMPLETA
// ============================================================

/**
 * Reemplaza la composición completa de un paquete.
 * Más simple que mantener un diff fino: borramos todo y reinsertamos.
 * Como el paquete se edita en UI completa, esto es lo más predecible.
 */
export async function updatePackageCompositionAction(payload: {
  package_service_id: string;
  items: Array<{
    included_service_id: string;
    quantity: number;
    notes?: string | null;
  }>;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = updatePackageCompositionSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { package_service_id, items } = validation.data;

  // Verificar que el servicio sea de tipo 'package'
  const { data: parentService } = await ctx.supabase
    .from('services')
    .select('id, service_type')
    .eq('id', package_service_id)
    .maybeSingle();

  if (!parentService) {
    return { error: 'Paquete no encontrado' };
  }

  if (parentService.service_type !== 'package') {
    return { error: 'Solo los servicios tipo "package" pueden tener composición' };
  }

  // Validar que no haya duplicados de included_service_id
  const ids = items.map((i) => i.included_service_id);
  if (new Set(ids).size !== ids.length) {
    return { error: 'No puedes incluir el mismo servicio dos veces' };
  }

  // Validar que no se incluya a sí mismo
  if (ids.includes(package_service_id)) {
    return { error: 'Un paquete no puede incluirse a sí mismo' };
  }

  // Borrar composición actual
  const { error: deleteError } = await ctx.supabase
    .from('package_composition')
    .delete()
    .eq('package_service_id', package_service_id);

  if (deleteError) {
    return { error: `Error al actualizar composición: ${deleteError.message}` };
  }

  // Insertar nueva composición (si hay items)
  if (items.length > 0) {
    const rows = items.map((item, index) => ({
      package_service_id,
      included_service_id: item.included_service_id,
      quantity: item.quantity,
      position: index,
      notes: item.notes || null,
    }));

    const { error: insertError } = await ctx.supabase
      .from('package_composition')
      .insert(rows);

    if (insertError) {
      return { error: `Error al guardar composición: ${insertError.message}` };
    }
  }

  revalidatePath('/catalog');
  revalidatePath(`/catalog/services/${package_service_id}`);
  return { success: true };
}

// ============================================================
// TAXES — CREAR
// ============================================================

export async function createTaxAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const rawData = {
    name: ((formData.get('name') as string) || '').trim(),
    code: ((formData.get('code') as string) || '').trim() || null,
    description:
      ((formData.get('description') as string) || '').trim() || null,
    percentage: parseFloat((formData.get('percentage') as string) || '0'),
    is_enabled: formData.get('is_enabled') === 'on',
    apply_by_default: formData.get('apply_by_default') === 'on',
  };

  const validation = createTaxSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx, formData.get('organization_id') as string);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  const { error } = await ctx.supabase.from('taxes').insert({
    ...validation.data,
    organization_id: orgId,
  });

  if (error) {
    if (error.message.includes('duplicate key')) {
      return { error: 'Ya existe un impuesto con ese nombre' };
    }
    return { error: `Error al crear impuesto: ${error.message}` };
  }

  revalidatePath('/catalog/taxes');
  return { success: true };
}

// ============================================================
// TAXES — EDITAR
// ============================================================

export async function updateTaxAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID requerido' };

  const rawData = {
    id,
    name: ((formData.get('name') as string) || '').trim(),
    code: ((formData.get('code') as string) || '').trim() || null,
    description:
      ((formData.get('description') as string) || '').trim() || null,
    percentage: parseFloat((formData.get('percentage') as string) || '0'),
    is_enabled: formData.get('is_enabled') === 'on',
    apply_by_default: formData.get('apply_by_default') === 'on',
  };

  const validation = updateTaxSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { id: _, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('taxes')
    .update(updateData)
    .eq('id', id);

  if (error) {
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath('/catalog/taxes');
  return { success: true };
}

// ============================================================
// TAXES — ELIMINAR
// ============================================================

export async function deleteTaxAction(taxId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase.from('taxes').delete().eq('id', taxId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath('/catalog/taxes');
  return { success: true };
}

// ============================================================
// TAXES — TOGGLE ENABLED
// ============================================================

export async function toggleTaxEnabledAction(taxId: string, enabled: boolean) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('taxes')
    .update({ is_enabled: enabled })
    .eq('id', taxId);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/catalog/taxes');
  return { success: true };
}
