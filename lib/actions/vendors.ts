'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database } from '@/lib/types/database';

type VendorUpdate = Database['public']['Tables']['vendors']['Update'];

// ============================================================
// SCHEMAS
// ============================================================

const vendorBaseSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(200),
  legal_name: z.string().max(200).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postal_code: z.string().optional(),
    })
    .optional()
    .nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const createVendorSchema = vendorBaseSchema;
const updateVendorSchema = vendorBaseSchema.partial().extend({
  id: z.string().uuid(),
});

const setActiveSchema = z.object({
  vendor_id: z.string().uuid(),
  is_active: z.boolean(),
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

// Normaliza strings opcionales: '' → null
function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

// ============================================================
// LISTAR PROVEEDORES — permiso: expenses.view
// ============================================================

export async function listVendorsAction(filters?: {
  is_active?: boolean;
  search?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.view'))) {
    return { error: 'No tienes permiso para ver gastos' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const isActive = filters?.is_active ?? true;

  let query = ctx.supabase
    .from('vendors')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', isActive);

  if (filters?.search?.trim()) {
    query = query.ilike('name', `%${filters.search.trim()}%`);
  }

  const { data: vendors, error } = await query
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (error) return { error: `Error al cargar proveedores: ${error.message}` };

  // Stats por proveedor
  const vendorIds = (vendors || []).map((v) => v.id);
  const stats: Record<string, { total_expenses: number; total_paid: number }> =
    {};

  if (vendorIds.length > 0) {
    const { data: rows } = await ctx.supabase
      .from('expenses')
      .select('vendor_id, status, total')
      .in('vendor_id', vendorIds);

    for (const r of rows || []) {
      if (!r.vendor_id) continue;
      if (!stats[r.vendor_id])
        stats[r.vendor_id] = { total_expenses: 0, total_paid: 0 };
      stats[r.vendor_id].total_expenses++;
      if (r.status === 'paid') stats[r.vendor_id].total_paid += Number(r.total);
    }
  }

  const withStats = (vendors || []).map((v) => ({
    ...v,
    total_expenses: stats[v.id]?.total_expenses ?? 0,
    total_paid: stats[v.id]?.total_paid ?? 0,
  }));

  return { vendors: withStats };
}

// ============================================================
// OBTENER PROVEEDOR + últimos 10 gastos — permiso: expenses.view
// ============================================================

export async function getVendorByIdAction(id: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.view'))) {
    return { error: 'No tienes permiso para ver gastos' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: vendor } = await ctx.supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!vendor) return { error: 'Proveedor no encontrado' };

  const { data: expenses } = await ctx.supabase
    .from('expenses')
    .select('id, folio, concept, total, currency, status, issue_date')
    .eq('vendor_id', id)
    .order('issue_date', { ascending: false })
    .limit(10);

  return { vendor, expenses: expenses || [] };
}

// ============================================================
// CREAR PROVEEDOR — permiso: expenses.manage_vendors
// ============================================================

export async function createVendorAction(payload: {
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  email?: string;
  phone?: string | null;
  website?: string;
  address?: Record<string, string | undefined> | null;
  notes?: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage_vendors'))) {
    return { error: 'No tienes permiso para gestionar proveedores' };
  }

  const validation = createVendorSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const name = validation.data.name.trim();

  // No duplicar nombre en la org
  const { data: existing } = await ctx.supabase
    .from('vendors')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('name', name)
    .maybeSingle();

  if (existing) {
    return { error: 'Ya existe un proveedor con ese nombre' };
  }

  const { data: vendor, error } = await ctx.supabase
    .from('vendors')
    .insert({
      organization_id: orgId,
      name,
      legal_name: clean(validation.data.legal_name),
      tax_id: clean(validation.data.tax_id),
      email: clean(validation.data.email),
      phone: clean(validation.data.phone),
      website: clean(validation.data.website),
      address: validation.data.address ?? null,
      notes: clean(validation.data.notes),
      is_active: true,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (error || !vendor) {
    return { error: `Error al crear proveedor: ${error?.message}` };
  }

  revalidatePath('/finance/vendors');
  return { success: true, vendorId: vendor.id };
}

// ============================================================
// ACTUALIZAR PROVEEDOR — permiso: expenses.manage_vendors
// ============================================================

export async function updateVendorAction(payload: {
  id: string;
  name?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  email?: string;
  phone?: string | null;
  website?: string;
  address?: Record<string, string | undefined> | null;
  notes?: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage_vendors'))) {
    return { error: 'No tienes permiso para gestionar proveedores' };
  }

  const validation = updateVendorSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: vendor } = await ctx.supabase
    .from('vendors')
    .select('id, organization_id, name, is_active')
    .eq('id', validation.data.id)
    .maybeSingle();

  if (!vendor || vendor.organization_id !== orgId) {
    return { error: 'Proveedor no encontrado' };
  }

  const d = validation.data;
  const update: VendorUpdate = {};
  if (d.name !== undefined) update.name = d.name.trim();
  if (d.legal_name !== undefined) update.legal_name = clean(d.legal_name);
  if (d.tax_id !== undefined) update.tax_id = clean(d.tax_id);
  if (d.email !== undefined) update.email = clean(d.email);
  if (d.phone !== undefined) update.phone = clean(d.phone);
  if (d.website !== undefined) update.website = clean(d.website);
  if (d.address !== undefined) update.address = d.address ?? null;
  if (d.notes !== undefined) update.notes = clean(d.notes);

  if (Object.keys(update).length === 0) {
    return { error: 'No hay cambios que guardar' };
  }

  const { error } = await ctx.supabase
    .from('vendors')
    .update(update)
    .eq('id', vendor.id);

  if (error) return { error: `Error al actualizar: ${error.message}` };

  // Si cambió el nombre y el proveedor sigue activo, actualizar el snapshot
  // de los gastos pendientes (los paid/cancelled son históricos).
  if (update.name && update.name !== vendor.name && vendor.is_active) {
    await ctx.supabase
      .from('expenses')
      .update({ vendor_name_snapshot: update.name })
      .eq('vendor_id', vendor.id)
      .eq('status', 'pending');
  }

  revalidatePath('/finance/vendors');
  revalidatePath('/finance/expenses');
  return { success: true };
}

// ============================================================
// ACTIVAR / DESACTIVAR PROVEEDOR — permiso: expenses.manage_vendors
// ============================================================

export async function setVendorActiveAction(payload: {
  vendor_id: string;
  is_active: boolean;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage_vendors'))) {
    return { error: 'No tienes permiso para gestionar proveedores' };
  }

  const validation = setActiveSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: vendor } = await ctx.supabase
    .from('vendors')
    .select('id, organization_id')
    .eq('id', validation.data.vendor_id)
    .maybeSingle();

  if (!vendor || vendor.organization_id !== orgId) {
    return { error: 'Proveedor no encontrado' };
  }

  const { error } = await ctx.supabase
    .from('vendors')
    .update({ is_active: validation.data.is_active })
    .eq('id', vendor.id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/finance/vendors');
  return { success: true };
}

// ============================================================
// BORRAR PROVEEDOR — solo Super Admin
// ============================================================

export async function deleteVendorAction(vendorId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!ctx.isSuperAdmin) {
    return { error: 'Solo un Super Admin puede borrar proveedores' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // Los expenses conservan vendor_name_snapshot, así que es seguro borrar.
  const { error } = await ctx.supabase
    .from('vendors')
    .delete()
    .eq('id', vendorId)
    .eq('organization_id', orgId);

  if (error) return { error: `Error al borrar: ${error.message}` };

  revalidatePath('/finance/vendors');
  return { success: true };
}
