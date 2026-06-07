'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createInvitation } from '@/lib/actions/invitations';
import { Loader2, Mail, X, Copy, Check } from 'lucide-react';
import type { Role } from '@/lib/types/database';

interface InviteUserButtonProps {
  organizationId: string;
  roles: Role[];
}

export function InviteUserButton({ organizationId, roles }: InviteUserButtonProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  function toggleRole(roleId: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    formData.set('organizationId', organizationId);
    selectedRoles.forEach((roleId) => {
      formData.append('roleIds', roleId);
    });

    const result = await createInvitation(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    if (result?.success && result.token) {
      const link = `${window.location.origin}/invitation/${result.token}`;
      setInvitationLink(link);
    }

    setIsLoading(false);
  }

  function reset() {
    setOpen(false);
    setInvitationLink(null);
    setError(null);
    setSelectedRoles([]);
    setCopied(false);
  }

  async function copyLink() {
    if (invitationLink) {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Mail className="w-4 h-4" />
        Invitar usuario
      </Button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={reset}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {invitationLink ? 'Invitación creada' : 'Invitar usuario'}
          </h3>
          <button
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {invitationLink ? (
          // ESTADO: Link generado
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Copia este link y compártelo con el invitado. Expira en 7 días.
            </p>

            <div className="bg-secondary/50 border border-border rounded-md p-3 mb-4">
              <div className="text-xs font-mono break-all text-foreground">
                {invitationLink}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={copyLink} className="flex-1">
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar link
                  </>
                )}
              </Button>
              <Button onClick={reset} variant="outline">
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          // ESTADO: Formulario
          <form action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  disabled={isLoading}
                  placeholder="Román"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  required
                  disabled={isLoading}
                  placeholder="Cantú"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                disabled={isLoading}
                placeholder="roman@photocan.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-md p-3">
                {roles.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    No hay roles disponibles
                  </div>
                ) : (
                  roles.map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 px-2 py-1.5 rounded text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="rounded border-border"
                        disabled={isLoading}
                      />
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: role.color || '#999' }}
                      />
                      {role.name}
                    </label>
                  ))
                )}
              </div>
              {selectedRoles.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Selecciona al menos un rol
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={isLoading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || selectedRoles.length === 0}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear invitación'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
