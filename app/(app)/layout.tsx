import { redirect } from 'next/navigation';
import { getActiveContext, getActiveRoles } from '@/lib/auth/context';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { ImpersonationBanner } from './impersonation-banner';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getActiveContext();

  // No autenticado → login
  if (ctx.mode === 'none') {
    redirect('/login');
  }

  // Super Admin sin impersonation → su panel
  if (ctx.mode === 'admin') {
    redirect('/admin');
  }

  // Aquí solo entran:
  //   - mode 'user' (usuario regular)
  //   - mode 'impersonating' (Super Admin viendo una org)
  // Ambos tienen ctx.organization disponible.

  if (!ctx.organization) {
    redirect('/login');
  }

  const roles = await getActiveRoles(ctx);

  // Para Super Admin: cargar TODOS los permisos del catálogo
  // (evita mantener lista hardcodeada que se desactualiza)
  let permissions: string[];

  if (ctx.isSuperAdmin) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: allPerms } = await supabase
      .from('permissions')
      .select('code');
    permissions = (allPerms || []).map((p) => p.code);
  } else {
    permissions = Array.from(ctx.permissions);
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-background">
      <AppSidebar
        organization={ctx.organization}
        permissions={permissions}
      />
      <div className="flex flex-col min-w-0">
        {ctx.mode === 'impersonating' && (
          <ImpersonationBanner
            organizationName={ctx.organization.name}
          />
        )}
        <AppTopbar
          displayName={
            ctx.mode === 'user' && ctx.user
              ? `${ctx.user.first_name} ${ctx.user.last_name}`
              : 'Super Admin'
          }
          initials={
            ctx.mode === 'user' && ctx.user
              ? `${ctx.user.first_name.charAt(0)}${ctx.user.last_name.charAt(0)}`.toUpperCase()
              : 'SA'
          }
          roles={roles}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
