'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  AlertCircle,
  Mail,
  UserPlus,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createInvitationAction } from '@/lib/actions/team-invitations';
import { createMemberDirectAction } from '@/lib/actions/team-members';
import { generatePassword } from './team-ui';

type Role = { id: string; name: string };
type Mode = 'link' | 'direct';

const EXPIRY_OPTIONS = [3, 7, 14, 30];

export function InviteMemberModal({
  roles,
  onClose,
}: {
  roles: Role[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('link');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [expiresIn, setExpiresIn] = useState(7);
  const [password, setPassword] = useState('');

  // Resultado de éxito
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleRole(id: string) {
    setRoleIds((s) =>
      s.includes(id) ? s.filter((r) => r !== id) : [...s, id]
    );
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmitLink() {
    setError(null);
    if (!email.trim()) return setError('El email es obligatorio');
    if (roleIds.length === 0) return setError('Selecciona al menos un rol');

    setLoading(true);
    const result = await createInvitationAction({
      email: email.trim(),
      intended_role_ids: roleIds,
      intended_first_name: firstName.trim() || undefined,
      intended_last_name: lastName.trim() || undefined,
      message: message.trim() || undefined,
      expires_in_days: expiresIn,
    });
    setLoading(false);

    if (result?.error) return setError(result.error);
    if ('token' in result && result.token) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setInviteLink(`${origin}/invite/${result.token}`);
      router.refresh();
    }
  }

  async function handleSubmitDirect() {
    setError(null);
    if (!email.trim()) return setError('El email es obligatorio');
    if (!firstName.trim() || !lastName.trim())
      return setError('Nombre y apellido son obligatorios');
    if (roleIds.length === 0) return setError('Selecciona al menos un rol');
    if (password.length < 8)
      return setError('La contraseña debe tener al menos 8 caracteres');

    setLoading(true);
    const result = await createMemberDirectAction({
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role_ids: roleIds,
      temporary_password: password,
    });
    setLoading(false);

    if (result?.error) return setError(result.error);
    setCreatedCreds({ email: email.trim(), password });
    router.refresh();
  }

  const showResult = inviteLink || createdCreds;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !loading && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h3 className="text-lg font-semibold">Invitar miembro</h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* RESULTADO: link */}
        {inviteLink ? (
          <div className="p-5 space-y-4">
            <div className="rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm">
              Invitación creada. Comparte este link con{' '}
              <strong>{email}</strong> por WhatsApp, email o el medio que
              prefieras.
            </div>
            <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md border border-border">
              <code className="text-xs font-mono truncate flex-1">
                {inviteLink}
              </code>
            </div>
            <Button onClick={() => copy(inviteLink)} className="w-full">
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar link
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              Cerrar
            </Button>
          </div>
        ) : createdCreds ? (
          /* RESULTADO: cuenta directa */
          <div className="p-5 space-y-4">
            <div className="rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm">
              Cuenta creada. Comparte estas credenciales y recuérdale cambiar la
              contraseña en su primer inicio de sesión.
            </div>
            <div className="rounded-md border border-border bg-secondary/50 p-3 font-mono text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Email: </span>
                {createdCreds.email}
              </div>
              <div>
                <span className="text-muted-foreground">Password: </span>
                {createdCreds.password}
              </div>
            </div>
            <Button
              onClick={() =>
                copy(
                  `Email: ${createdCreds.email}\nPassword temporal: ${createdCreds.password}`
                )
              }
              className="w-full"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar credenciales
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              {/* Toggle modo */}
              <div className="flex gap-1 border border-border rounded-md p-1 bg-card">
                <ModeBtn
                  active={mode === 'link'}
                  onClick={() => setMode('link')}
                  icon={<Mail className="w-3.5 h-3.5" />}
                  label="Enviar invitación por link"
                />
                <ModeBtn
                  active={mode === 'direct'}
                  onClick={() => setMode('direct')}
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                  label="Crear cuenta directa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="colaborador@ejemplo.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first_name">
                    Nombre {mode === 'direct' && '*'}
                  </Label>
                  <Input
                    id="first_name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">
                    Apellido {mode === 'direct' && '*'}
                  </Label>
                  <Input
                    id="last_name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Multi-select roles */}
              <div className="space-y-2">
                <Label>Roles *</Label>
                <div className="border border-border rounded-md max-h-40 overflow-y-auto divide-y divide-border">
                  {roles.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No hay roles disponibles.
                    </div>
                  ) : (
                    roles.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary/40"
                      >
                        <input
                          type="checkbox"
                          checked={roleIds.includes(r.id)}
                          onChange={() => toggleRole(r.id)}
                          disabled={loading}
                          className="w-4 h-4 accent-photocan-amber"
                        />
                        <span className="text-sm">{r.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {mode === 'link' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="message">Mensaje (opcional)</Label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={loading}
                      rows={2}
                      maxLength={500}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires">Expira en</Label>
                    <select
                      id="expires"
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(Number(e.target.value))}
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {EXPIRY_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d} días
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="password">Password temporal *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Mínimo 8 caracteres"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPassword(generatePassword())}
                      disabled={loading}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Generar
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-background">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={mode === 'link' ? handleSubmitLink : handleSubmitDirect}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === 'link' ? (
                  <Mail className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {mode === 'link' ? 'Enviar invitación' : 'Crear cuenta'}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ModeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
