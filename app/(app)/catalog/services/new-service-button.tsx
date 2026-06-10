'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, X, Package, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createServiceAction } from '@/lib/actions/catalog';

export function NewServiceButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<'atomic' | 'package' | 'addon'>(
    'atomic'
  );

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    formData.set('service_type', serviceType);

    const result = await createServiceAction(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    if (result?.success && result.serviceId) {
      setOpen(false);
      router.push(`/catalog/services/${result.serviceId}`);
    }
  }

  function reset() {
    setOpen(false);
    setError(null);
    setServiceType('atomic');
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Nuevo servicio
      </Button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={reset} />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xl bg-background border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center">
              <Package className="w-4 h-4 text-photocan-amber" />
            </div>
            <h3 className="text-lg font-semibold">Nuevo elemento del catálogo</h3>
          </div>
          <button
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form action={handleSubmit} className="p-6 space-y-5">
          {/* Selector de tipo */}
          <div className="space-y-2">
            <Label>Tipo de elemento *</Label>
            <div className="grid grid-cols-3 gap-2">
              <TypeOption
                type="atomic"
                label="Servicio"
                description="Unidad individual (post, reel, foto)"
                icon={<Package className="w-4 h-4" />}
                selected={serviceType === 'atomic'}
                onClick={() => setServiceType('atomic')}
              />
              <TypeOption
                type="package"
                label="Paquete"
                description="Colección de servicios"
                icon={<Layers className="w-4 h-4" />}
                selected={serviceType === 'package'}
                onClick={() => setServiceType('package')}
              />
              <TypeOption
                type="addon"
                label="Addon"
                description="Extensión sobre paquete"
                icon={<Plus className="w-4 h-4" />}
                selected={serviceType === 'addon'}
                onClick={() => setServiceType('addon')}
              />
            </div>
          </div>

          {/* Identidad */}
          <div className="space-y-4 pt-4 border-t border-border">
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
                placeholder={
                  serviceType === 'atomic'
                    ? 'Post de Instagram'
                    : serviceType === 'package'
                      ? 'Paquete Gold'
                      : 'Post extra'
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <textarea
                id="description"
                name="description"
                disabled={isLoading}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
                placeholder="Breve descripción para uso interno y cotizaciones..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU (opcional)</Label>
              <Input
                id="sku"
                name="sku"
                disabled={isLoading}
                placeholder="Código interno único"
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
                  defaultValue="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <select
                  id="currency"
                  name="currency"
                  disabled={isLoading}
                  defaultValue="MXN"
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
                defaultValue="pieza"
                placeholder="pieza, mes, hora, día..."
              />
              <p className="text-xs text-muted-foreground">
                Cómo se cuenta este elemento. Ej: "por pieza", "por mes", "por
                hora".
              </p>
            </div>
          </div>

          {serviceType === 'package' && (
            <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 p-3 text-xs text-foreground/80">
              <strong className="text-photocan-amber-deep">Sobre paquetes:</strong>{' '}
              Después de crear el paquete podrás definir qué servicios incluye y
              en qué cantidad desde su pantalla de detalle.
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function TypeOption({
  type,
  label,
  description,
  icon,
  selected,
  onClick,
}: {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-md border text-left transition-colors ${
        selected
          ? 'border-photocan-amber bg-photocan-amber/10'
          : 'border-border hover:border-photocan-amber/30 bg-card'
      }`}
    >
      <div
        className={`mb-2 ${selected ? 'text-photocan-amber' : 'text-muted-foreground'}`}
      >
        {icon}
      </div>
      <div className="font-medium text-sm mb-0.5">{label}</div>
      <div className="text-xs text-muted-foreground leading-tight">
        {description}
      </div>
    </button>
  );
}
