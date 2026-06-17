import { redirect } from 'next/navigation';
import { getActiveContext } from '@/lib/auth/context';
import { getCurrentProfileAction } from '@/lib/actions/team-members';
import { ProfileView } from './profile-view';

export default async function ProfilePage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none') redirect('/login');

  const result = await getCurrentProfileAction();

  // Super admin (sin registro en users) → no tiene perfil editable
  if ('error' in result || !result.user) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Perfil no disponible</div>
          <div className="text-sm text-muted-foreground">
            Estás en una sesión de Super Admin; tu perfil no es editable desde
            aquí.
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProfileView
      user={result.user as never}
      roles={(result.roles || []) as never}
      organizationName={ctx.organization?.name ?? '—'}
    />
  );
}
