'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateServiceAction } from '@/lib/actions/catalog';
import type { Service } from '@/lib/types/database';

export function InfoTab({
  service,
  canEdit,
}: {
  service: Service;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(service.is_active);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    formData.set('id', service.id);
    formData.set('service_type', service.service_type);
    if (isActive) {
      formData.set('is_active', 'on');
    }

    const result = await updateServiceAction(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setEditing(false);
    setIsLoading(false);
    router.refresh();
  }

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
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                name="name"
                required
                disabled={isLoading}
                defaultValue={service.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <textarea
                id="description"
                name="description"
                disabled={isLoading}
                defaultValue={service.description || ''}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                name="sku"
                disabled={isLoading}
                defaultValue={service.sku || ''}
              />
            </div>
          </div>

          {/* Precio */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Precio
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="default_price">Precio base *</Label>
                <Input
                  id="default_price"
                  name="default_price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  disabled={isLoading}
                  defaultValue={service.default_price}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <select
                  id="currency"
                  name="currency"
                  disabled={isLoading}
                  defaultValue={service.currency}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="ARS">ARS</option>
                  <option value="COP">COP</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unidad</Label>
              <Input
                id="unit"
                name="unit"
                disabled={isLoading}
                defaultValue={service.unit}
              />
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-4 pt-4 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isLoading}
                className="rounded border-border"
              />
              <span className="text-sm">
                Activo (disponible para cotizar)
              </span>
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
          Información del servicio
        </div>
        {canEdit && !service.archived_at && (
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
            Identidad
          </div>
          <Field label="Nombre" value={service.name} />
          <Field label="SKU" value={service.sku} mono />
          <Field
            label="Descripción"
            value={service.description}
            multiline
          />
        </div>

        {/* Card Precio */}
        <div className="border border-border rounded-lg bg-card p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Precio
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
              Precio base
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              {formatPrice(service.default_price, service.currency)}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">
              por {service.unit}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  multiline = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </div>
      {value ? (
        <div
          className={`text-sm ${mono ? 'font-mono text-xs' : ''} ${
            multiline ? 'whitespace-pre-wrap' : ''
          }`}
        >
          {value}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">—</div>
      )}
    </div>
  );
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
