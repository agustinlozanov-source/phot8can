'use client';

import { useState } from 'react';
import { X, Loader2, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTaxAction, updateTaxAction } from '@/lib/actions/catalog';
import type { Tax } from '@/lib/types/database';

interface Props {
  tax: Tax | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TaxModal({ tax, onClose, onSaved }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(tax?.is_enabled ?? true);
  const [applyByDefault, setApplyByDefault] = useState(
    tax?.apply_by_default ?? true
  );

  const isEditing = !!tax;

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    if (isEnabled) formData.set('is_enabled', 'on');
    if (applyByDefault) formData.set('apply_by_default', 'on');

    if (isEditing) {
      formData.set('id', tax!.id);
    }

    const result = isEditing
      ? await updateTaxAction(formData)
      : await createTaxAction(formData);

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
              <Percent className="w-4 h-4 text-photocan-amber" />
            </div>
            <h3 className="text-lg font-semibold">
              {isEditing ? 'Editar impuesto' : 'Nuevo impuesto'}
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
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              name="name"
              required
              disabled={isLoading}
              defaultValue={tax?.name || ''}
              placeholder="IVA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Código (opcional)</Label>
            <Input
              id="code"
              name="code"
              disabled={isLoading}
              defaultValue={tax?.code || ''}
              placeholder="IVA-16"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="percentage">Porcentaje *</Label>
            <div className="relative">
              <Input
                id="percentage"
                name="percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                disabled={isLoading}
                defaultValue={tax?.percentage ?? ''}
                placeholder="16.00"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
                %
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              name="description"
              disabled={isLoading}
              defaultValue={tax?.description || ''}
              rows={2}
              placeholder="Breve descripción..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>

          <div className="pt-2 space-y-3 border-t border-border">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5 rounded border-border"
              />
              <div>
                <div className="text-sm font-medium">Habilitado</div>
                <div className="text-xs text-muted-foreground">
                  Disponible como opción al crear cotizaciones nuevas.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyByDefault}
                onChange={(e) => setApplyByDefault(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5 rounded border-border"
              />
              <div>
                <div className="text-sm font-medium">
                  Aplicar por defecto
                </div>
                <div className="text-xs text-muted-foreground">
                  Se marca automáticamente al crear una cotización nueva.
                </div>
              </div>
            </label>
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
                'Crear impuesto'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
