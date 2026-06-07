import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Users } from 'lucide-react';
import { InviteUserButton } from '@/app/(admin)/admin/organizations/[organizationId]/invitations/invite-user-button';
import { InvitationsList } from '@/app/(admin)/admin/organizations/[organizationId]/invitations/invitations-list';

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Usuario actual
  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!appUser) redirect('/login');

  // Verificar permiso config.users
  const { data: hasPermission } = await supabase.rpc(
    'current_user_has_permission',
    { permission_code: 'config.users' }
  );

  if (!hasPermission) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver esta sección.
          </div>
        </div>
      </div>
    );
  }

  const orgId = appUser.organization_id;

  // Cargar todos los datos necesarios
  const [usersResult, rolesResult, invitationsResult] = await Promise.all([
    supabase
      .from('users')
      .select('*, user_roles(role:roles(id, name, color))')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('roles')
      .select('*')
      .eq('organization_id', orgId)
      .order('name'),
    supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ]);

  const users = usersResult.data || [];
  const roles = rolesResult.data || [];
  const invitations = invitationsResult.data || [];

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Administración
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Mi equipo
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los usuarios de tu organización y sus roles.
          </p>
        </div>

        <InviteUserButton organizationId={orgId} roles={roles} />
      </div>

      {/* Stats compactas */}
      <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-8">
        <div className="p-4 border-r border-border">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <Users className="w-3.5 h-3.5" />
            Usuarios activos
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {users.filter((u) => u.is_active).length}
          </div>
        </div>
        <div className="p-4 border-r border-border">
          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            Invitaciones pendientes
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {invitations.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            Roles disponibles
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {roles.length}
          </div>
        </div>
      </div>

      {/* Sección Usuarios */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-0.5 h-4 bg-photocan-amber rounded-sm" />
          Usuarios
        </h2>

        {users.length > 0 ? (
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Nombre
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Correo
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Roles
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Último acceso
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const userRoles = (u.user_roles || [])
                    .map((ur: any) => ur.role)
                    .filter(Boolean);
                  return (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        {u.first_name} {u.last_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.length > 0 ? (
                            userRoles.map((role: any) => (
                              <span
                                key={role.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-secondary border border-border"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: role.color || '#999' }}
                                />
                                {role.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              sin rol
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleDateString(
                              'es-MX'
                            )
                          : 'Nunca'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground">
              Aún no hay usuarios. Invita al primer miembro del equipo.
            </div>
          </div>
        )}
      </div>

      {/* Invitaciones pendientes */}
      {invitations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-photocan-amber rounded-sm" />
            Invitaciones pendientes
          </h2>
          <InvitationsList invitations={invitations} />
        </div>
      )}

      {/* Roles disponibles */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-0.5 h-4 bg-photocan-amber rounded-sm" />
          Roles disponibles
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: role.color || '#999' }}
                />
                <div className="font-medium text-sm">{role.name}</div>
              </div>
              {role.description && (
                <div className="text-xs text-muted-foreground">
                  {role.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
