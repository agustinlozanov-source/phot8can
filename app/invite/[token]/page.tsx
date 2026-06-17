import { createServiceClient } from '@/lib/supabase/server';
import { getInvitationByTokenPublicAction } from '@/lib/actions/team-invitations';
import { InviteView } from './invite-view';

export default async function InvitePublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await getInvitationByTokenPublicAction(token);

  if ('error' in result || !result.invitation) {
    return <InvitationNotAvailable message={result.error} />;
  }

  const inv = result.invitation;

  // Cargar todos los roles (junction) + color de la org para branding
  const supabase = await createServiceClient();

  const { data: roleRows } = await supabase
    .from('team_invitation_roles')
    .select('role:roles(id, name)')
    .eq('invitation_id', inv.id);

  let roles = (roleRows || [])
    .map((r) => r.role as unknown as { id: string; name: string } | null)
    .filter(Boolean) as Array<{ id: string; name: string }>;

  // Fallback al rol legacy si la junction está vacía
  if (roles.length === 0 && inv.role_name) {
    roles = [{ id: 'legacy', name: inv.role_name }];
  }

  return (
    <InviteView
      token={token}
      invitation={{
        email: inv.email,
        intended_first_name: inv.intended_first_name,
        intended_last_name: inv.intended_last_name,
        message: inv.message,
        roles,
      }}
      organization={{
        name: inv.organization_name,
        logoUrl: inv.organization_logo_url,
      }}
    />
  );
}

function InvitationNotAvailable({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
          <div className="text-2xl text-muted-foreground">×</div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Invitación no válida
        </h1>
        <p className="text-muted-foreground">
          {message ||
            'Este link no está activo. Contacta a quien te invitó si crees que es un error.'}
        </p>
      </div>
    </div>
  );
}
