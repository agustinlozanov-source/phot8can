'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Loader2, Globe, MapPin, User, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateClientAction } from '@/lib/actions/clients';
import type { Client, Contact } from '@/lib/types/database';

interface Props {
  client: Client;
  users: Array<{ id: string; first_name: string; last_name: string }>;
  accountManager: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  primaryContact: Contact | null;
  canEdit: boolean;
}

export function InfoTab({
  client,
  users,
  accountManager,
  primaryContact,
  canEdit,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    formData.set('id', client.id);

    const result = await updateClientAction(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setEditing(false);
    setIsLoading(false);
    router.refresh();
  }

  const address = client.address as any;

  if (editing) {
    return (
      <form action={handleSubmit} className="space-y-6">
        <div className="border border-border rounded-lg bg-card p-6 space-y-5">
          {/* Identidad */}
          <div className="space-y-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Identidad
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre comercial *</Label>
              <Input
                id="name"
                name="name"
                required
                disabled={isLoading}
                defaultValue={client.name}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="legal_name">Razón social</Label>
                <Input
                  id="legal_name"
                  name="legal_name"
                  disabled={isLoading}
                  defaultValue={client.legal_name || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id">RFC</Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  disabled={isLoading}
                  defaultValue={client.tax_id || ''}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="industry">Industria</Label>
                <Input
                  id="industry"
                  name="industry"
                  disabled={isLoading}
                  defaultValue={client.industry || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Sitio web</Label>
                <Input
                  id="website"
                  name="website"
                  type="text"
                  disabled={isLoading}
                  defaultValue={client.website || ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                name="status"
                disabled={isLoading}
                defaultValue={client.status}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              >
                <option value="active">Activo</option>
                <option value="paused">En pausa</option>
                <option value="churned">Dado de baja</option>
              </select>
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Dirección
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_street">Calle y número</Label>
              <Input
                id="address_street"
                name="address_street"
                disabled={isLoading}
                defaultValue={address?.street || ''}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="address_city">Ciudad</Label>
                <Input
                  id="address_city"
                  name="address_city"
                  disabled={isLoading}
                  defaultValue={address?.city || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_state">Estado</Label>
                <Input
                  id="address_state"
                  name="address_state"
                  disabled={isLoading}
                  defaultValue={address?.state || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_zip">CP</Label>
                <Input
                  id="address_zip"
                  name="address_zip"
                  disabled={isLoading}
                  defaultValue={address?.zip || ''}
                />
              </div>
            </div>
          </div>

          {/* Operación */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Operación
            </div>

            <div className="space-y-2">
              <Label htmlFor="acquisition_source">Cómo nos conoció</Label>
              <Input
                id="acquisition_source"
                name="acquisition_source"
                disabled={isLoading}
                defaultValue={client.acquisition_source || ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_manager_id">Responsable de la cuenta</Label>
              <select
                id="account_manager_id"
                name="account_manager_id"
                disabled={isLoading}
                defaultValue={client.account_manager_id || ''}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              >
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas</Label>
              <textarea
                id="notes"
                name="notes"
                disabled={isLoading}
                defaultValue={client.notes || ''}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </div>
        </div>
      </form>
    );
  }

  // Vista de lectura
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Información general
        </div>
        {canEdit && !client.archived_at && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Identidad */}
        <div className="border border-border rounded-lg bg-card p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Identidad fiscal
          </div>
          <Field label="Razón social" value={client.legal_name} />
          <Field label="RFC" value={client.tax_id} mono />
          <Field label="Régimen fiscal" value={client.tax_regime} />
        </div>

        {/* Card Web/Industria */}
        <div className="border border-border rounded-lg bg-card p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Negocio
          </div>
          <Field label="Industria" value={client.industry} />
          <Field
            label="Sitio web"
            value={client.website}
            icon={<Globe className="w-3 h-3" />}
            isLink
          />
        </div>

        {/* Card Dirección */}
        <div className="border border-border rounded-lg bg-card p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            Dirección
          </div>
          {address?.street || address?.city ? (
            <div className="text-sm">
              {address.street && <div>{address.street}</div>}
              <div className="text-muted-foreground">
                {[address.city, address.state, address.zip]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              Sin dirección registrada
            </div>
          )}
        </div>

        {/* Card Responsable + Adquisición */}
        <div className="border border-border rounded-lg bg-card p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Operación
          </div>
          {accountManager ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center text-[10px] font-bold text-black">
                {accountManager.first_name.charAt(0)}
                {accountManager.last_name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-medium">
                  {accountManager.first_name} {accountManager.last_name}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  responsable de cuenta
                </div>
              </div>
            </div>
          ) : (
            <Field label="Responsable" value={null} />
          )}
          <Field
            label="Cómo nos conoció"
            value={client.acquisition_source}
          />
        </div>

        {/* Card Contacto principal */}
        {primaryContact && (
          <div className="border border-border rounded-lg bg-card p-5 space-y-3 md:col-span-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Contacto principal
            </div>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium mb-0.5">
                  {primaryContact.first_name} {primaryContact.last_name}
                </div>
                {primaryContact.position && (
                  <div className="text-xs text-muted-foreground">
                    {primaryContact.position}
                  </div>
                )}
              </div>
              <div className="text-right space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground justify-end">
                  <Mail className="w-3 h-3" />
                  {primaryContact.email}
                </div>
                {primaryContact.phone && (
                  <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground justify-end">
                    <Phone className="w-3 h-3" />
                    {primaryContact.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  icon,
  isLink = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  icon?: React.ReactNode;
  isLink?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1">
        {icon}
        {label}
      </div>
      {value ? (
        isLink ? (
          <a
            href={value.startsWith('http') ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm text-photocan-amber hover:underline ${
              mono ? 'font-mono' : ''
            }`}
          >
            {value}
          </a>
        ) : (
          <div className={`text-sm ${mono ? 'font-mono text-xs' : ''}`}>
            {value}
          </div>
        )
      ) : (
        <div className="text-sm text-muted-foreground italic">—</div>
      )}
    </div>
  );
}
