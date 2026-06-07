import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Si es super admin, mandarlo a su panel
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    redirect('/admin');
  }

  // Obtener usuario con su organización
  const { data: appUser } = await supabase
    .from('users')
    .select('*, organization:organizations(*)')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!appUser || !appUser.organization) {
    redirect('/login');
  }

  // Obtener roles del usuario y sus permisos
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role:roles(id, name, color)')
    .eq('user_id', appUser.id);

  const roles = (userRoles || [])
    .map((ur) => ur.role)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Obtener todos los permisos del usuario
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

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-background">
      <AppSidebar
        organization={appUser.organization}
        permissions={Array.from(permissions)}
      />
      <div className="flex flex-col min-w-0">
        <AppTopbar user={appUser} roles={roles} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
