'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, Layers, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updatePackageCompositionAction } from '@/lib/actions/catalog';

interface CompositionItem {
  id: string;
  included_service_id: string;
  quantity: number;
  position: number;
  notes: string | null;
  included_service: {
    id: string;
    name: string;
    service_type: 'atomic' | 'package' | 'addon';
    default_price: number;
    currency: string;
    unit: string;
  };
}

interface AvailableService {
  id: string;
  name: string;
  service_type: 'atomic' | 'package' | 'addon';
  default_price: number;
  currency: string;
  unit: string;
}

interface DraftItem {
  included_service_id: string;
  quantity: number;
  notes: string | null;
  // Datos del servicio incluido (para mostrar en UI)
  service_name: string;
  service_price: number;
  service_currency: string;
  service_unit: string;
}

export function CompositionTab({
  packageServiceId,
  composition,
  availableServices,
  canManage,
}: {
  packageServiceId: string;
  composition: CompositionItem[];
  availableServices: AvailableService[];
  canManage: boolean;
}) {
  const router = useRouter();

  // Estado local: la composición editable
  const [items, setItems] = useState<DraftItem[]>(() =>
    composition.map((c) => ({
      included_service_id: c.included_service_id,
      quantity: c.quantity,
      notes: c.notes,
      service_name: c.included_service.name,
      service_price: c.included_service.default_price,
      service_currency: c.included_service.currency,
      service_unit: c.included_service.unit,
    }))
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Servicios disponibles que aún no están en la composición
  const availableToAdd = useMemo(() => {
    const usedIds = new Set(items.map((i) => i.included_service_id));
    return availableServices.filter((s) => !usedIds.has(s.id));
  }, [items, availableServices]);

  // Valor estimado del paquete (precio base × cantidad de cada item)
  const estimatedValue = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + item.service_price * item.quantity,
      0
    );
  }, [items]);

  const currency = items[0]?.service_currency || 'MXN';

  function addItem(serviceId: string) {
    const service = availableServices.find((s) => s.id === serviceId);
    if (!service) return;

    setItems([
      ...items,
      {
        included_service_id: serviceId,
        quantity: 1,
        notes: null,
        service_name: service.name,
        service_price: service.default_price,
        service_currency: service.currency,
        service_unit: service.unit,
      },
    ]);
    setHasChanges(true);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
    setHasChanges(true);
  }

  function updateQuantity(index: number, quantity: number) {
    if (quantity < 1) return;
    const newItems = [...items];
    newItems[index].quantity = quantity;
    setItems(newItems);
    setHasChanges(true);
  }

  function updateNotes(index: number, notes: string) {
    const newItems = [...items];
    newItems[index].notes = notes || null;
    setItems(newItems);
    setHasChanges(true);
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    const result = await updatePackageCompositionAction({
      package_service_id: packageServiceId,
      items: items.map((item) => ({
        included_service_id: item.included_service_id,
        quantity: item.quantity,
        notes: item.notes,
      })),
    });

    if (result?.error) {
      setError(result.error);
      setIsSaving(false);
      return;
    }

    setHasChanges(false);
    setIsSaving(false);
    router.refresh();
  }

  function handleReset() {
    setItems(
      composition.map((c) => ({
        included_service_id: c.included_service_id,
        quantity: c.quantity,
        notes: c.notes,
        service_name: c.included_service.name,
        service_price: c.included_service.default_price,
        service_currency: c.included_service.currency,
        service_unit: c.included_service.unit,
      }))
    );
    setHasChanges(false);
    setError(null);
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-card">
        <div className="p-4 border-r border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Elementos incluidos
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {items.length}
          </div>
        </div>
        <div className="p-4 border-r border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Unidades totales
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {items.reduce((sum, item) => sum + item.quantity, 0)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Valor estimado (suma)
          </div>
          <div className="text-2xl font-semibold tracking-tight text-photocan-amber-deep">
            {formatPrice(estimatedValue, currency)}
          </div>
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Layers className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Paquete sin composición</div>
          <div className="text-sm text-muted-foreground mb-4">
            Agrega los servicios que incluye este paquete y en qué cantidad.
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Servicio incluido
                </th>
                <th className="text-center px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-32">
                  Cantidad
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Notas
                </th>
                <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Subtotal
                </th>
                {canManage && <th className="w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.included_service_id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.service_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {formatPrice(item.service_price, item.service_currency)}{' '}
                      por {item.service_unit}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(index, parseInt(e.target.value) || 1)
                        }
                        disabled={isSaving}
                        className="w-20 h-9 rounded-md border border-input bg-background px-2 text-sm text-center font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
                      />
                    ) : (
                      <div className="text-center font-mono">
                        {item.quantity}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <Input
                        value={item.notes || ''}
                        onChange={(e) => updateNotes(index, e.target.value)}
                        disabled={isSaving}
                        placeholder="Opcional..."
                        className="h-9 text-xs"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {item.notes || '—'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                    {formatPrice(
                      item.service_price * item.quantity,
                      item.service_currency
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeItem(index)}
                        disabled={isSaving}
                        className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selector para agregar */}
      {canManage && availableToAdd.length > 0 && (
        <div className="border border-border rounded-lg bg-card p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Plus className="w-3 h-3" />
            Agregar servicio al paquete
          </div>
          <div className="flex flex-wrap gap-2">
            {availableToAdd.map((service) => (
              <button
                key={service.id}
                onClick={() => addItem(service.id)}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:border-photocan-amber/30 hover:bg-photocan-amber/5 text-sm transition-colors disabled:opacity-50"
              >
                <Plus className="w-3 h-3 text-photocan-amber" />
                <span className="font-medium">{service.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatPrice(service.default_price, service.currency)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Si no hay servicios atómicos disponibles */}
      {canManage && availableServices.length === 0 && (
        <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 p-4 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-photocan-amber-deep flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-photocan-amber-deep">
              No hay servicios disponibles para agregar.
            </strong>
            <p className="text-muted-foreground text-xs mt-1">
              Primero crea servicios atómicos (tipo &quot;Servicio&quot;) desde el
              catálogo principal. Después podrás incluirlos en este paquete.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Botones de acción */}
      {canManage && hasChanges && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-xs text-photocan-amber-deep font-mono">
            ● Cambios sin guardar
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              Descartar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar composición'
              )}
            </Button>
          </div>
        </div>
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
