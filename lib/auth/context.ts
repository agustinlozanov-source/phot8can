import { createClient } from '@/lib/supabase/server';
import { getImpersonatedOrganizationId } from '@/lib/actions/impersonation';
import type { Organization, User } from '@/lib/types/database';

/**
 * Representa el contexto activo del usuario que está navegando.
 *
 * - 'admin': Super Admin sin impersonation activa (panel /admin)
 * - 'impersonating': Super Admin viendo una organización específica
 * - 'user': Usuario regular de una organización
 * - 'none': No autenticado o usuario inválido
 */
export type ActiveContext =
  | {
      mode: 'admin';
      isSuperAdmin: true;
      superAdminId: string;
      authUserId: string;
      organization: null;
      user: null;
      permissions: Set<string>;
    }
  | {
      mode: 'impersonating';
      isSuperAdmin: true;
      superAdminId: string;
      authUserId: string;
      organization: Organization;
      user: null; // Super Admin no tiene registro en users
      permissions: Set<string>; // Set vacío (super admin no necesita permisos)
    }
  | {
      mode: 'user';
      isSuperAdmin: false;
      superAdminId: null;
      authUserId: string;
      organization: Organization;
      user: User;
      permissions: Set<string>;
    }
  | {
      mode: 'none';
      isSuperAdmin: false;
      superAdminId: null;
      authUserId: null;
      organization: null;
      user: null;
      permissions: Set<string>;
    };

/**
 * Obtiene el contexto activo del usuario actual.
 * Lee la sesión, detecta si es Super Admin, y si lo es,
 * verifica si tiene una organización impersonada.
 *
 * Esta función es la fuente de verdad para todas las páginas
 * que necesiten saber "qué está pasando".
 */
export async function getActiveContext(): Promise<ActiveContext> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return {
      mode: 'none',
      isSuperAdmin: false,
      superAdminId: null,
      authUserId: null,
      organization: null,
      user: null,
      permissions: new Set(),
    };
  }

  // ¿Es Super Admin?
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    // ¿Tiene organización impersonada?
    const impersonatedOrgId = await getImpersonatedOrganizationId();

    if (impersonatedOrgId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', impersonatedOrgId)
        .maybeSingle();

      if (org) {
        return {
          mode: 'impersonating',
          isSuperAdmin: true,
          superAdminId: superAdmin.id,
          authUserId: authUser.id,
          organization: org,
          user: null,
          permissions: new Set(), // Super admin no usa permisos atómicos
        };
      }
      // Si la cookie apunta a una org que no existe, ignoramos
    }

    return {
      mode: 'admin',
      isSuperAdmin: true,
      superAdminId: superAdmin.id,
      authUserId: authUser.id,
      organization: null,
      user: null,
      permissions: new Set(),
    };
  }

  // Usuario regular: cargar su organización + permisos
  const { data: appUser } = await supabase
    .from('users')
    .select('*, organization:organizations(*)')
    .eq('auth_user_id', authUser.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!appUser || !appUser.organization) {
    return {
      mode: 'none',
      isSuperAdmin: false,
      superAdminId: null,
      authUserId: null,
      organization: null,
      user: null,
      permissions: new Set(),
    };
  }

  // Cargar permisos del usuario
  const { data: rolePermissions } = await supabase
    .from('user_roles')
    .select('role:roles(role_permissions(permission:permissions(code)))')
    .eq('user_id', appUser.id);

  const permissions = new Set<string>();
  rolePermissions?.forEach((ur) => {
    const role = ur.role as any;
    role?.role_permissions?.forEach((rp: any) => {
      if (rp.permission?.code) {
        permissions.add(rp.permission.code);
      }
    });
  });

  // Separar organization del user
  const { organization, ...userWithoutOrg } = appUser as any;

  return {
    mode: 'user',
    isSuperAdmin: false,
    superAdminId: null,
    authUserId: authUser.id,
    organization,
    user: userWithoutOrg,
    permissions,
  };
}

/**
 * Helper para verificar permisos.
 * Super Admin SIEMPRE tiene permiso (devuelve true sin importar el código).
 */
export function hasPermission(ctx: ActiveContext, code: string): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.permissions.has(code);
}

/**
 * Obtiene los roles del usuario actual (para mostrar badges, etc.).
 * Si es Super Admin, devuelve un rol sintético.
 * Si es usuario regular, devuelve los roles reales de la BD.
 */
export async function getActiveRoles(ctx: ActiveContext): Promise<
  Array<{ id: string; name: string; color: string | null }>
> {
  if (ctx.mode === 'admin' || ctx.mode === 'impersonating') {
    return [
      {
        id: 'super-admin',
        name: 'Super Admin',
        color: '#E89A1F',
      },
    ];
  }

  if (ctx.mode === 'user' && ctx.user) {
    const supabase = await createClient();
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role:roles(id, name, color)')
      .eq('user_id', ctx.user.id);

    return (userRoles || [])
      .map((ur) => ur.role)
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }

  return [];
}
