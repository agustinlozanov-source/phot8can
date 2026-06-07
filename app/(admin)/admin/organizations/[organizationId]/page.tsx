import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Users, Shield } from 'lucide-react';
import { InvitationsList } from './invitations/invitations-list';
import { InviteUserButton } from './invitations/invite-user-button';

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const supabase = await createClient();

  // Obtener organización
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle();

  if (!org) notFound();

  // Obtener usuarios
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  // Obtener roles
  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  // Obtener invitaciones pendientes
  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-6xl">
      {/* Breadcrumb */}
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Organizaciones
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-lg grid place-items-center font-bold text-xl"
            style={{
              background: org.primary_color
                ? `${org.primary_color}20`
                : 'hsl(var(--secondary))',
              color: org.primary_color || undefined,
            }}
          >
            {org.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">
              {org.name}
            </h1>
            <div className="text-sm text-muted-foreground font-mono">
              {org.slug} · {org.country_code} · {org.currency}
            </div>
          </div>
        </div>

        <div>
          {org.is_active ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500 bg-green-500/10 px-3 py-1.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-secondary px-3 py-1.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              Inactiva
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-8">
        <div className="p-4 border-r border-border">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <Users className="w-3.5 h-3.5" />
            Usuarios
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {users?.length ?? 0}
          </div>
        </div>
        <div className="p-4 border-r border-border">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <Shield className="w-3.5 h-3.5" />
            Roles
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {roles?.length ?? 0}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            Invitaciones pendientes
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {invitations?.length ?? 0}
          </div>
        </div>
      </div>

      {/* Sección Usuarios */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-0.5 h-4 bg-photocan-amber rounded-sm" />
            Usuarios activos
          </h2>
          <InviteUserButton
            organizationId={organizationId}
            roles={roles || []}
          />
        </div>

        {users && users.length > 0 ? (
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
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Último acceso
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {u.first_name} {u.last_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {u.email}
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
                        ? new Date(u.last_login_at).toLocaleDateString('es-MX')
                        : 'Nunca'}
                    </td>
                  </tr>
                ))}
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

      {/* Sección Invitaciones */}
      {invitations && invitations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-photocan-amber rounded-sm" />
            Invitaciones pendientes
          </h2>
          <InvitationsList invitations={invitations} />
        </div>
      )}

      {/* Sección Roles */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-0.5 h-4 bg-photocan-amber rounded-sm" />
          Roles
        </h2>

        {roles && roles.length > 0 ? (
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
        ) : (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            Sin roles configurados.
          </div>
        )}
      </div>
    </div>
  );
}
