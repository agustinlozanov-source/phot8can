'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

const cloneRoleSchema = z.object({
  source_role_id: z.string().uuid(),
  new_name: z.string().min(1, 'Nombre requerido').max(100),
  new_description: z.string().max(500).optional(),
});

const updateRoleSchema = z.object({
  role_id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  permission_ids: z.array(z.string().uuid()).optional(),
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

async function checkAnyPermission(codes: string[]): Promise<boolean> {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return codes.some((c) => hasPermission(authCtx, c));
}

// ============================================================
// LISTAR ROLES (base + custom de la org) con conteo de usuarios
// ============================================================

export async function listRolesAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkAnyPermission(['team.manage', 'team.manage_roles']))) {
    return { error: 'No tienes permiso para ver los roles' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: roles, error } = await ctx.supabase
    .from('roles')
    .select('*')
    .eq('organization_id', orgId)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (error) return { error: `Error al cargar roles: ${error.message}` };

  // Conteo de usuarios activos por rol
  const roleIds = (roles || []).map((r) => r.id);
  const counts: Record<string, number> = {};
  if (roleIds.length > 0) {
    const { data: rows } = await ctx.supabase
      .from('user_roles')
      .select('role_id, user:users!user_roles_user_id_fkey(is_active)')
      .in('role_id', roleIds);
    for (const row of rows || []) {
      const u = row.user as unknown as { is_active: boolean } | null;
      if (u?.is_active) counts[row.role_id] = (counts[row.role_id] || 0) + 1;
    }
  }

  const withCounts = (roles || []).map((r) => ({
    ...r,
    active_user_count: counts[r.id] || 0,
  }));

  return { roles: withCounts };
}

// ============================================================
// PERMISOS DE UN ROL
// ============================================================

export async function listRolePermissionsAction(roleId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkAnyPermission(['team.manage', 'team.manage_roles']))) {
    return { error: 'No tienes permiso para ver los permisos' };
  }

  const { data, error } = await ctx.supabase
    .from('role_permissions')
    .select('permission:permissions(id, code, description, category)')
    .eq('role_id', roleId);

  if (error) return { error: `Error al cargar permisos: ${error.message}` };

  const permissions = (data || [])
    .map((rp) => rp.permission)
    .filter(Boolean);

  return { permissions };
}

// ============================================================
// CLONAR ROL
// ============================================================

export async function cloneRoleAction(payload: {
  source_role_id: string;
  new_name: string;
  new_description?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkAnyPermission(['team.manage_roles']))) {
    return { error: 'No tienes permiso para gestionar roles' };
  }

  const validation = cloneRoleSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // El rol fuente debe ser base o custom de la org
  const { data: source } = await ctx.supabase
    .from('roles')
    .select('id, organization_id, is_system')
    .eq('id', validation.data.source_role_id)
    .maybeSingle();

  if (!source || (source.organization_id !== orgId && !source.is_system)) {
    return { error: 'El rol fuente no es válido para esta organización' };
  }

  // Crear el nuevo rol
  const { data: newRole, error: insertError } = await ctx.supabase
    .from('roles')
    .insert({
      organization_id: orgId,
      name: validation.data.new_name.trim(),
      description: validation.data.new_description?.trim() || null,
      is_system: false,
      is_custom: true,
      cloned_from_role_id: source.id,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (insertError || !newRole) {
    return { error: `Error al clonar el rol: ${insertError?.message}` };
  }

  // Copiar permisos del rol fuente
  const { data: sourcePerms } = await ctx.supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', source.id);

  if (sourcePerms && sourcePerms.length > 0) {
    const rows = sourcePerms.map((p) => ({
      role_id: newRole.id,
      permission_id: p.permission_id,
    }));
    const { error: permError } = await ctx.supabase
      .from('role_permissions')
      .insert(rows);
    if (permError) {
      // Rollback del rol si fallan los permisos
      await ctx.supabase.from('roles').delete().eq('id', newRole.id);
      return { error: `Error al copiar permisos: ${permError.message}` };
    }
  }

  revalidatePath('/team/roles');
  return { success: true, roleId: newRole.id };
}

// ============================================================
// ACTUALIZAR ROL CUSTOM
// ============================================================

export async function updateCustomRoleAction(payload: {
  role_id: string;
  name?: string;
  description?: string | null;
  permission_ids?: string[];
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkAnyPermission(['team.manage_roles']))) {
    return { error: 'No tienes permiso para gestionar roles' };
  }

  const validation = updateRoleSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: role } = await ctx.supabase
    .from('roles')
    .select('id, organization_id, is_custom')
    .eq('id', validation.data.role_id)
    .maybeSingle();

  if (!role || role.organization_id !== orgId) {
    return { error: 'Rol no encontrado' };
  }
  if (!role.is_custom) {
    return { error: 'Solo se pueden editar roles personalizados' };
  }

  // Actualizar nombre / descripción
  const update: { name?: string; description?: string | null } = {};
  if (validation.data.name) update.name = validation.data.name.trim();
  if (validation.data.description !== undefined)
    update.description = validation.data.description?.trim() || null;

  if (Object.keys(update).length > 0) {
    const { error } = await ctx.supabase
      .from('roles')
      .update(update)
      .eq('id', role.id);
    if (error) return { error: `Error al actualizar el rol: ${error.message}` };
  }

  // Reemplazar permisos si vienen
  if (validation.data.permission_ids) {
    const { error: delError } = await ctx.supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', role.id);
    if (delError) {
      return { error: `Error al limpiar permisos: ${delError.message}` };
    }

    if (validation.data.permission_ids.length > 0) {
      const rows = validation.data.permission_ids.map((pid) => ({
        role_id: role.id,
        permission_id: pid,
      }));
      const { error: insError } = await ctx.supabase
        .from('role_permissions')
        .insert(rows);
      if (insError) {
        return { error: `Error al asignar permisos: ${insError.message}` };
      }
    }
  }

  revalidatePath('/team/roles');
  return { success: true };
}

// ============================================================
// BORRAR ROL CUSTOM
// ============================================================

export async function deleteCustomRoleAction(roleId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkAnyPermission(['team.manage_roles']))) {
    return { error: 'No tienes permiso para gestionar roles' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: role } = await ctx.supabase
    .from('roles')
    .select('id, organization_id, is_custom')
    .eq('id', roleId)
    .maybeSingle();

  if (!role || role.organization_id !== orgId) {
    return { error: 'Rol no encontrado' };
  }
  if (!role.is_custom) {
    return { error: 'Solo se pueden borrar roles personalizados' };
  }

  // No borrar si tiene usuarios activos asignados
  const { data: assignments } = await ctx.supabase
    .from('user_roles')
    .select('user_id, user:users!user_roles_user_id_fkey(is_active)')
    .eq('role_id', role.id);

  const activeAssigned = (assignments || []).filter((a) => {
    const u = a.user as unknown as { is_active: boolean } | null;
    return u?.is_active;
  }).length;

  if (activeAssigned > 0) {
    return {
      error: `No puedes borrar este rol: ${activeAssigned} ${
        activeAssigned === 1 ? 'usuario lo tiene' : 'usuarios lo tienen'
      } asignado. Reasígnalos primero.`,
    };
  }

  const { error } = await ctx.supabase
    .from('roles')
    .delete()
    .eq('id', role.id);

  if (error) return { error: `Error al borrar el rol: ${error.message}` };

  revalidatePath('/team/roles');
  return { success: true };
}

// ============================================================
// TODOS LOS PERMISOS AGRUPADOS POR CATEGORÍA
// ============================================================

export async function listAllPermissionsAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkAnyPermission(['team.manage_roles']))) {
    return { error: 'No tienes permiso para ver los permisos' };
  }

  const { data, error } = await ctx.supabase
    .from('permissions')
    .select('id, code, description, category')
    .order('category')
    .order('code');

  if (error) return { error: `Error al cargar permisos: ${error.message}` };

  const grouped: Record<
    string,
    Array<{ id: string; code: string; description: string }>
  > = {};
  for (const p of data || []) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push({
      id: p.id,
      code: p.code,
      description: p.description,
    });
  }

  return { permissions: grouped };
}
