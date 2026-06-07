import { getInvitationByToken } from '@/app/(admin)/admin/organizations/[organizationId]/invitations/actions';
import { AcceptInvitationForm } from './accept-form';
import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getInvitationByToken(token);

  if (result.error || !result.success || !result.invitation) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-8">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 grid place-items-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">
            Invitación no válida
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {result.error || 'Esta invitación no existe o ya fue procesada.'}
          </p>
          <Link
            href="/login"
            className="text-sm text-photocan-amber hover:underline font-mono"
          >
            Ir al login
          </Link>
        </div>
      </div>
    );
  }

  const invitation = result.invitation;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Lado izquierdo */}
      <div className="hidden lg:flex relative bg-black overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 30% 40%, rgba(232,154,31,0.15), transparent 60%)',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center font-bold text-xl text-black">
              P
            </div>
            <div>
              <div className="text-white font-semibold text-lg leading-none">
                Photocan OS
              </div>
              <div className="text-white/50 text-xs font-mono uppercase tracking-wider mt-1">
                Bienvenido al equipo
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-6 h-px bg-photocan-amber" />
              Activa tu cuenta
            </div>
            <h1 className="text-white text-5xl font-semibold leading-tight tracking-tight mb-6">
              Hola, {invitation.first_name}.
            </h1>
            <p className="text-white/60 text-base leading-relaxed">
              {invitation.organizationName} te ha invitado a unirte a su equipo
              en Photocan OS. Crea tu contraseña para activar tu cuenta.
            </p>
          </div>

          <div className="font-mono text-xs text-white/30 uppercase tracking-wider">
            v0.1 · Mayo 2026
          </div>
        </div>
      </div>

      {/* Lado derecho */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center font-bold text-xl text-black">
              P
            </div>
            <div>
              <div className="font-semibold text-lg leading-none">
                Photocan OS
              </div>
              <div className="text-muted-foreground text-xs font-mono uppercase tracking-wider mt-1">
                Activar cuenta
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-3">
              · Crea tu contraseña
            </div>
            <h2 className="text-3xl font-semibold tracking-tight mb-2">
              Activa tu cuenta
            </h2>
            <p className="text-muted-foreground text-sm">
              {invitation.email}
            </p>
          </div>

          <AcceptInvitationForm token={token} />
        </div>
      </div>
    </div>
  );
}
