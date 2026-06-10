'use client';

import { useState } from 'react';
import { X, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createContactAction,
  updateContactAction,
} from '@/lib/actions/clients';
import type { Contact } from '@/lib/types/database';

interface Props {
  clientId: string;
  contact: Contact | null; // null = crear, objeto = editar
  onClose: () => void;
  onSaved: () => void;
}

export function ContactModal({ clientId, contact, onClose, onSaved }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(contact?.is_primary || false);

  const isEditing = !!contact;

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    formData.set('client_id', clientId);
    if (isPrimary) {
      formData.set('is_primary', 'on');
    }

    if (isEditing) {
      formData.set('id', contact!.id);
    }

    const result = isEditing
      ? await updateContactAction(formData)
      : await createContactAction(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    onSaved();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isLoading ? undefined : onClose}
      />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center">
              <User className="w-4 h-4 text-photocan-amber" />
            </div>
            <h3 className="text-lg font-semibold">
              {isEditing ? 'Editar contacto' : 'Nuevo contacto'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form action={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <Input
                id="first_name"
                name="first_name"
                required
                disabled={isLoading}
                defaultValue={contact?.first_name || ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido *</Label>
              <Input
                id="last_name"
                name="last_name"
                required
                disabled={isLoading}
                defaultValue={contact?.last_name || ''}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              disabled={isLoading}
              defaultValue={contact?.email || ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                name="phone"
                disabled={isLoading}
                defaultValue={contact?.phone || ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Cargo</Label>
              <Input
                id="position"
                name="position"
                disabled={isLoading}
                defaultValue={contact?.position || ''}
                placeholder="Director General"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              name="notes"
              disabled={isLoading}
              defaultValue={contact?.notes || ''}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={isLoading}
              className="rounded border-border"
            />
            <span className="text-sm">
              Marcar como contacto principal del cliente
            </span>
          </label>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
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
              ) : isEditing ? (
                'Guardar cambios'
              ) : (
                'Crear contacto'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
