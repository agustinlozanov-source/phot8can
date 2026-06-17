'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptInvitationPublicAction } from '@/lib/actions/team-invitations';

interface Props {
  token: string;
  invitation: {
    email: string;
    intended_first_name: string | null;
    intended_last_name: string | null;
    message: string | null;
    roles: Array<{ id: string; name: string }>;
  };
  organization: {
    name: string;
    logoUrl: string | null;
  };
}

export function InviteView({ token, invitation, organization }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(
    invitation.intended_first_name ?? ''
  );
  const [lastName, setLastName] = useState(invitation.intended_last_name ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pwdOk = password.length >= 8;
  const matchOk = password.length > 0 && password === confirm;

  async function handleSubmit() {
    setError(null);
    if (firstName.trim().length < 2 || lastName.trim().length < 2)
      return setError('Escribe tu nombre y apellido');
    if (!pwdOk) return setError('La contraseña debe tener al menos 8 caracteres');
    if (!matchOk) return setError('Las contraseñas no coinciden');

    setLoading(true);
    const result = await acceptInvitationPublicAction({
      token,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      password,
    });
    setLoading(false);
    if (result?.error) return setError(result.error);
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            ¡Bienvenida! Tu cuenta está lista
          </h1>
          <p className="text-muted-foreground mb-6">
            Ya formas parte de {organization.name}. Inicia sesión para empezar.
          </p>
          <Button onClick={() => router.push('/login')} size="lg">
            Ir a iniciar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Header con branding */}
        <div className="flex items-center gap-3 mb-8">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="w-10 h-10 rounded-md object-cover border border-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center font-bold text-black">
              {organization.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="font-semibold">{organization.name}</div>
        </div>

        {/* Hero */}
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          ¡Bienvenida!
        </h1>
        <p className="text-muted-foreground mb-6">
          <span className="text-foreground font-medium">
            {organization.name}
          </span>{' '}
          te invita a unirte
          {invitation.roles.length > 0 && (
            <>
              {' '}
              como{' '}
              {invitation.roles.map((r, i) => (
                <span key={r.id}>
                  <span className="text-foreground font-medium">{r.name}</span>
                  {i < invitation.roles.length - 1 ? ', ' : ''}
                </span>
              ))}
            </>
          )}
          .
        </p>

        {/* Mensaje del director */}
        {invitation.message && (
          <blockquote className="border-l-2 border-photocan-amber pl-4 py-1 mb-6 text-sm text-muted-foreground italic">
            {invitation.message}
          </blockquote>
        )}

        {/* Detalles */}
        <div className="border border-border rounded-lg bg-card p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Invitación para:</span>
            <span className="font-medium">{invitation.email}</span>
          </div>
          {invitation.roles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-muted-foreground">
                Roles que tendrás:
              </span>
              {invitation.roles.map((r) => (
                <span
                  key={r.id}
                  className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                >
                  {r.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <Input
                id="first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido *</Label>
              <Input
                id="last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <div
              className={`text-[11px] font-mono ${pwdOk ? 'text-green-500' : 'text-muted-foreground'}`}
            >
              {pwdOk ? '✓' : '·'} Mínimo 8 caracteres
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar contraseña *</Label>
            <Input
              id="confirm"
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
            />
            {confirm.length > 0 && (
              <div
                className={`text-[11px] font-mono ${matchOk ? 'text-green-500' : 'text-destructive'}`}
              >
                {matchOk ? '✓ Coinciden' : '× No coinciden'}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              'Aceptar invitación y crear cuenta'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
