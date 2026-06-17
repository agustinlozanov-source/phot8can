'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database } from '@/lib/types/database';

type CategoryUpdate =
  Database['public']['Tables']['expense_categories']['Update'];

// ============================================================
// SCHEMAS
// ============================================================

const HEX = /^#[0-9a-fA-F]{6}$/;

const createCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(HEX, 'Color hex inválido').default('#6B7280'),
  icon: z.string().max(50).optional().nullable(),
  parent_category_id: z.string().uuid().optional().nullable(),
  position: z.number().int().min(0).default(0),
});

const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(HEX, 'Color hex inválido').optional(),
  icon: z.string().max(50).optional().nullable(),
  parent_category_id: z.string().uuid().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

const setActiveSchema = z.object({
  category_id: z.string().uuid(),
  is_active: z.boolean(),
});

const reorderSchema = z.object({
  ordered_ids: z.array(z.string().uuid()).min(1),
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

// ============================================================
// LISTAR CATEGORÍAS — permiso: expenses.view
// ============================================================

export async function listCategoriesAction(filters?: { is_active?: boolean }) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.view'))) {
    return { error: 'No tienes permiso para ver gastos' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const isActive = filters?.is_active ?? true;

  const { data: categories, error } = await ctx.supabase
    .from('expense_categories')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', isActive)
    .order('position', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { error: `Error al cargar categorías: ${error.message}` };

  // Stats por categoría
  const ids = (categories || []).map((c) => c.id);
  const stats: Record<string, { total_expenses: number; total_amount: number }> =
    {};

  if (ids.length > 0) {
    const { data: rows } = await ctx.supabase
      .from('expenses')
      .select('category_id, status, total')
      .in('category_id', ids);

    for (const r of rows || []) {
      if (!r.category_id) continue;
      if (!stats[r.category_id])
        stats[r.category_id] = { total_expenses: 0, total_amount: 0 };
      stats[r.category_id].total_expenses++;
      if (r.status === 'paid')
        stats[r.category_id].total_amount += Number(r.total);
    }
  }

  const withStats = (categories || []).map((c) => ({
    ...c,
    total_expenses: stats[c.id]?.total_expenses ?? 0,
    total_amount: stats[c.id]?.total_amount ?? 0,
  }));

  return { categories: withStats };
}

// ============================================================
// CREAR CATEGORÍA — permiso: expenses.manage_vendors
// ============================================================

export async function createCategoryAction(payload: {
  name: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  parent_category_id?: string | null;
  position?: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage_vendors'))) {
    return { error: 'No tienes permiso para gestionar categorías' };
  }

  const validation = createCategorySchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // Si tiene padre, validar que exista y sea de la org
  if (validation.data.parent_category_id) {
    const { data: parent } = await ctx.supabase
      .from('expense_categories')
      .select('id, organization_id')
      .eq('id', validation.data.parent_category_id)
      .maybeSingle();
    if (!parent || parent.organization_id !== orgId) {
      return { error: 'La categoría padre no es válida' };
    }
  }

  const { data: category, error } = await ctx.supabase
    .from('expense_categories')
    .insert({
      organization_id: orgId,
      name: validation.data.name.trim(),
      description: validation.data.description?.trim() || null,
      color: validation.data.color,
      icon: validation.data.icon?.trim() || null,
      parent_category_id: validation.data.parent_category_id ?? null,
      position: validation.data.position,
      is_active: true,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (error || !category) {
    if (error?.code === '23505') {
      return { error: 'Ya existe una categoría con ese nombre' };
    }
    return { error: `Error al crear categoría: ${error?.message}` };
  }

  revalidatePath('/finance/categories');
  return { success: true, categoryId: category.id };
}

// ============================================================
// ACTUALIZAR CATEGORÍA — permiso: expenses.manage_vendors
// ============================================================

export async function updateCategoryAction(payload: {
  id: string;
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  parent_category_id?: string | null;
  position?: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage_vendors'))) {
    return { error: 'No tienes permiso para gestionar categorías' };
  }

  const validation = updateCategorySchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: category } = await ctx.supabase
    .from('expense_categories')
    .select('id, organization_id, name')
    .eq('id', validation.data.id)
    .maybeSingle();

  if (!category || category.organization_id !== orgId) {
    return { error: 'Categoría no encontrada' };
  }

  // Evitar que sea su propio padre
  if (validation.data.parent_category_id === category.id) {
    return { error: 'Una categoría no puede ser su propio padre' };
  }

  const d = validation.data;
  const update: CategoryUpdate = {};
  if (d.name !== undefined) update.name = d.name.trim();
  if (d.description !== undefined)
    update.description = d.description?.trim() || null;
  if (d.color !== undefined) update.color = d.color;
  if (d.icon !== undefined) update.icon = d.icon?.trim() || null;
  if (d.parent_category_id !== undefined)
    update.parent_category_id = d.parent_category_id ?? null;
  if (d.position !== undefined) update.position = d.position;

  if (Object.keys(update).length === 0) {
    return { error: 'No hay cambios que guardar' };
  }

  const { error } = await ctx.supabase
    .from('expense_categories')
    .update(update)
    .eq('id', category.id);

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe una categoría con ese nombre' };
    }
    return { error: `Error al actualizar: ${error.message}` };
  }

  // Si cambió el nombre, actualizar snapshot en gastos pendientes
  if (update.name && update.name !== category.name) {
    await ctx.supabase
      .from('expenses')
      .update({ category_name_snapshot: update.name })
      .eq('category_id', category.id)
      .eq('status', 'pending');
  }

  revalidatePath('/finance/categories');
  revalidatePath('/finance/expenses');
  return { success: true };
}

// ============================================================
// ACTIVAR / DESACTIVAR CATEGORÍA — permiso: expenses.manage_vendors
// ============================================================

export async function setCategoryActiveAction(payload: {
  category_id: string;
  is_active: boolean;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage_vendors'))) {
    return { error: 'No tienes permiso para gestionar categorías' };
  }

  const validation = setActiveSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: category } = await ctx.supabase
    .from('expense_categories')
    .select('id, organization_id')
    .eq('id', validation.data.category_id)
    .maybeSingle();

  if (!category || category.organization_id !== orgId) {
    return { error: 'Categoría no encontrada' };
  }

  const { error } = await ctx.supabase
    .from('expense_categories')
    .update({ is_active: validation.data.is_active })
    .eq('id', category.id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/finance/categories');
  return { success: true };
}

// ============================================================
// SEED DE CATEGORÍAS BASE — permiso: expenses.manage_vendors
// ============================================================

export async function seedDefaultCategoriesAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage_vendors'))) {
    return { error: 'No tienes permiso para gestionar categorías' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data, error } = await ctx.supabase.rpc(
    'seed_default_expense_categories',
    { p_organization_id: orgId }
  );

  if (error) return { error: `Error al crear categorías base: ${error.message}` };

  revalidatePath('/finance/categories');
  return { success: true, categoriasCreadas: (data as number) ?? 0 };
}

// ============================================================
// REORDENAR CATEGORÍAS — permiso: expenses.manage_vendors
// ============================================================

export async function reorderCategoriesAction(payload: {
  ordered_ids: string[];
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage_vendors'))) {
    return { error: 'No tienes permiso para gestionar categorías' };
  }

  const validation = reorderSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // Actualizar la posición de cada categoría según su índice en el array
  for (let i = 0; i < validation.data.ordered_ids.length; i++) {
    const { error } = await ctx.supabase
      .from('expense_categories')
      .update({ position: i })
      .eq('id', validation.data.ordered_ids[i])
      .eq('organization_id', orgId);
    if (error) {
      return { error: `Error al reordenar: ${error.message}` };
    }
  }

  revalidatePath('/finance/categories');
  return { success: true };
}
