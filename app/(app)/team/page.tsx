import { redirect } from 'next/navigation';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listTeamMembersAction } from '@/lib/actions/team-members';
import { listInvitationsAction } from '@/lib/actions/team-invitations';
import { listRolesAction } from '@/lib/actions/roles';
import { TeamDashboard } from './team-dashboard';

export default async function TeamPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'team.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver el equipo.
          </div>
        </div>
      </div>
    );
  }

  const canManage = hasPermission(ctx, 'team.manage');
  const canManageRoles = hasPermission(ctx, 'team.manage_roles');

  const [membersRes, invitationsRes, rolesRes] = await Promise.all([
    listTeamMembersAction(),
    listInvitationsAction(),
    listRolesAction(),
  ]);

  const members = 'members' in membersRes ? membersRes.members : [];
  const invitations =
    'invitations' in invitationsRes ? invitationsRes.invitations : [];
  const roles = 'roles' in rolesRes ? rolesRes.roles : [];

  return (
    <TeamDashboard
      members={(members || []) as never}
      invitations={(invitations || []) as never}
      roles={(roles || []) as never}
      currentUserId={ctx.user?.id ?? null}
      canManage={canManage}
      canManageRoles={canManageRoles}
    />
  );
}
