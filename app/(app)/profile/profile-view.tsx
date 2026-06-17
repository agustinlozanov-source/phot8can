'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
  Check,
  Save,
  Lock,
  Shield,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updateMyProfileAction,
  updateMyPasswordAction,
} from '@/lib/actions/team-members';
import { Avatar } from '../team/team-ui';

type ProfileUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  color?: string | null;
};

export function ProfileView({
  user,
  roles,
  organizationName,
}: {
  user: ProfileUser;
  roles: Role[];
  organizationName: string;
}) {
  const router = useRouter();

  // Información personal
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Contraseña
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSaved, setPwdSaved] = useState(false);

  async function saveProfile() {
    setProfileError(null);
    setProfileSaved(false);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setProfileError('Nombre y apellido son obligatorios');
      return;
    }
    setSavingProfile(true);
    const result = await updateMyProfileAction({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      avatar_url: avatarUrl.trim() || null,
    });
    setSavingProfile(false);
    if (result?.error) return setProfileError(result.error);
    setProfileSaved(true);
    router.refresh();
  }

  async function savePassword() {
    setPwdError(null);
    setPwdSaved(false);
    if (!currentPwd) return setPwdError('Indica tu contraseña actual');
    if (newPwd.length < 8)
      return setPwdError('La nueva contraseña debe tener al menos 8 caracteres');
    if (newPwd !== confirmPwd)
      return setPwdError('Las contraseñas no coinciden');

    setSavingPwd(true);
    const result = await updateMyPasswordAction({
      current_password: currentPwd,
      new_password: newPwd,
    });
    setSavingPwd(false);
    if (result?.error) return setPwdError(result.error);
    setPwdSaved(true);
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar
          firstName={user.first_name}
          lastName={user.last_name}
          url={avatarUrl || user.avatar_url}
          size="lg"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.first_name} {user.last_name}
          </h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
      </div>

      {/* Información personal */}
      <Section title="Información personal">
        <div className="space-y-2">
          <Label htmlFor="avatar_url">Avatar (URL)</Label>
          <Input
            id="avatar_url"
            value={avatarUrl}
            onChange={(e) => {
              setAvatarUrl(e.target.value);
              setProfileSaved(false);
            }}
            disabled={savingProfile}
            placeholder="https://..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first_name">Nombre</Label>
            <Input
              id="first_name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setProfileSaved(false);
              }}
              disabled={savingProfile}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Apellido</Label>
            <Input
              id="last_name"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setProfileSaved(false);
              }}
              disabled={savingProfile}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled readOnly />
          <div className="text-[11px] text-muted-foreground">
            El email no se puede cambiar desde aquí.
          </div>
        </div>
        {profileError && <ErrorLine error={profileError} />}
        <Button onClick={saveProfile} disabled={savingProfile}>
          {savingProfile ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : profileSaved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {profileSaved ? 'Guardado' : 'Guardar'}
        </Button>
      </Section>

      {/* Mis roles */}
      <Section title="Mis roles">
        {roles.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No tienes roles asignados.
          </div>
        ) : (
          <div className="space-y-2">
            {roles.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-2.5 border border-border rounded-md p-3"
              >
                <Shield className="w-4 h-4 text-photocan-amber mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground">
                      {r.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Cambiar contraseña */}
      <Section title="Cambiar contraseña">
        <div className="space-y-2">
          <Label htmlFor="current_pwd">Contraseña actual</Label>
          <Input
            id="current_pwd"
            type="password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            disabled={savingPwd}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="new_pwd">Nueva contraseña</Label>
            <Input
              id="new_pwd"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              disabled={savingPwd}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_pwd">Confirmar</Label>
            <Input
              id="confirm_pwd"
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              disabled={savingPwd}
            />
          </div>
        </div>
        {pwdError && <ErrorLine error={pwdError} />}
        {pwdSaved && (
          <div className="rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-500 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Contraseña actualizada
          </div>
        )}
        <Button onClick={savePassword} disabled={savingPwd}>
          {savingPwd ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          Cambiar contraseña
        </Button>
      </Section>

      {/* Mis organizaciones */}
      <Section title="Mis organizaciones">
        <div className="flex items-center gap-2.5 border border-border rounded-md p-3">
          <Building2 className="w-4 h-4 text-photocan-amber flex-shrink-0" />
          <div>
            <div className="text-sm font-medium">{organizationName}</div>
            <div className="text-xs text-muted-foreground">
              {roles.map((r) => r.name).join(' · ') || 'Sin rol'}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground mb-3">
        {title}
      </h2>
      <div className="border border-border rounded-lg bg-card p-5 space-y-4">
        {children}
      </div>
    </section>
  );
}

function ErrorLine({ error }: { error: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      {error}
    </div>
  );
}
