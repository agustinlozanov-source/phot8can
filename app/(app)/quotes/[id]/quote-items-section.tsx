'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Package,
  Layers,
  Loader2,
  Search,
  X,
  Pencil,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addItemAction,
  updateItemAction,
  removeItemAction,
} from '@/lib/actions/quote-items';
import type { QuoteItem } from '@/lib/types/database';

interface AvailableService {
  id: string;
  name: string;
  description: string | null;
  service_type: 'atomic' | 'package' | 'addon';
  default_price: number;
  currency: string;
  unit: string;
}

interface Props {
  quoteId: string;
  items: QuoteItem[];
  availableServices: AvailableService[];
  currency: string;
  locked: boolean;
}

export function QuoteItemsSection({
  quoteId,
  items,
  availableServices,
  currency,
  locked,
}: Props) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');

  function startEditing(item: QuoteItem) {
    setEditingId(item.id);
    setEditQuantity(String(item.quantity));
    setEditPrice(String(item.unit_price));
  }

  function cancelEditing() {
    setEditingId(null);
    setEditQuantity('');
    setEditPrice('');
  }

  async function saveEdit(itemId: string) {
    const qty = parseFloat(editQuantity);
    const price = parseFloat(editPrice);

    if (isNaN(qty) || qty <= 0) {
      alert('La cantidad debe ser un número positivo');
      return;
    }
    if (isNaN(price) || price < 0) {
      alert('El precio debe ser un número válido');
      return;
    }

    setActionLoading(itemId);
    await updateItemAction({
      id: itemId,
      quantity: qty,
      unit_price: price,
    });
    setActionLoading(null);
    setEditingId(null);
    router.refresh();
  }

  async function handleRemove(itemId: string, name: string) {
    if (!confirm(`¿Quitar "${name}" de la cotización?`)) return;
    setActionLoading(itemId);
    await removeItemAction(itemId);
    setActionLoading(null);
    router.refresh();
  }

  async function handleAdd(serviceId: string) {
    setActionLoading(serviceId);
    await addItemAction({ quote_id: quoteId, service_id: serviceId });
    setActionLoading(null);
    setShowAddModal(false);
    router.refresh();
  }

  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Servicios cotizados
          </div>
          <div className="text-sm font-medium">
            {items.length}{' '}
            {items.length === 1 ? 'elemento' : 'elementos'} en la cotización
          </div>
        </div>

        {!locked && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-3.5 h-3.5" />
            Agregar servicio
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center">
          <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground mb-3">
            Sin servicios. {locked ? '' : 'Agrega el primero del catálogo.'}
          </div>
          {!locked && (
            <Button onClick={() => setShowAddModal(true)} size="sm">
              <Plus className="w-3.5 h-3.5" />
              Agregar primer servicio
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const composition = item.composition_snapshot as
              | Array<{ name: string; quantity: number; unit: string }>
              | null;

            return (
              <div key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ServiceTypeBadge type={item.service_type} />
                      <div className="font-medium text-sm">{item.name}</div>
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {item.description}
                      </div>
                    )}

                    {/* Composición del paquete (snapshot) */}
                    {item.service_type === 'package' &&
                      composition &&
                      composition.length > 0 && (
                        <div className="mt-2 ml-1 pl-3 border-l-2 border-photocan-amber/30 space-y-0.5">
                          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                            Incluye
                          </div>
                          {composition.map((c, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-muted-foreground flex items-center gap-1.5"
                            >
                              <span className="font-mono text-photocan-amber-deep">
                                {c.quantity}×
                              </span>
                              <span>{c.name}</span>
                              <span className="text-muted-foreground/60">
                                ({c.unit})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Cantidad, precio, subtotal */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <div className="flex flex-col gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="w-20 h-8 text-xs text-center font-mono"
                            placeholder="Cant."
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-24 h-8 text-xs text-right font-mono"
                            placeholder="Precio"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => saveEdit(item.id)}
                            disabled={actionLoading === item.id}
                            className="p-1.5 rounded bg-green-500/10 hover:bg-green-500/20 text-green-500 disabled:opacity-50 transition-colors"
                            title="Guardar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={actionLoading === item.id}
                            className="p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground disabled:opacity-50 transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground font-mono">
                            {Number(item.quantity)} × {formatPrice(Number(item.unit_price), currency)}
                          </div>
                          <div className="font-mono font-semibold text-sm">
                            {formatPrice(Number(item.subtotal), currency)}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            por {item.unit}
                          </div>
                        </div>

                        {!locked && (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => startEditing(item)}
                              disabled={!!actionLoading}
                              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemove(item.id, item.name)}
                              disabled={actionLoading === item.id}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
                              title="Quitar"
                            >
                              {actionLoading === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para agregar servicio */}
      {showAddModal && (
        <AddServiceModal
          availableServices={availableServices}
          currency={currency}
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

function AddServiceModal({
  availableServices,
  currency,
  onAdd,
  onClose,
  actionLoading,
}: {
  availableServices: AvailableService[];
  currency: string;
  onAdd: (serviceId: string) => void;
  onClose: () => void;
  actionLoading: string | null;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'atomic' | 'package' | 'addon'>('all');

  const filtered = useMemo(() => {
    let result = availableServices;
    if (typeFilter !== 'all') {
      result = result.filter((s) => s.service_type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [availableServices, search, typeFilter]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-background border border-border rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold">Agregar servicio del catálogo</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 border border-border rounded-md p-1 bg-card">
            <FilterBtn
              label="Todos"
              active={typeFilter === 'all'}
              onClick={() => setTypeFilter('all')}
            />
            <FilterBtn
              label="Servicios"
              active={typeFilter === 'atomic'}
              onClick={() => setTypeFilter('atomic')}
            />
            <FilterBtn
              label="Paquetes"
              active={typeFilter === 'package'}
              onClick={() => setTypeFilter('package')}
            />
            <FilterBtn
              label="Addons"
              active={typeFilter === 'addon'}
              onClick={() => setTypeFilter('addon')}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {availableServices.length === 0
                ? 'No hay servicios disponibles. Crea servicios en el catálogo primero.'
                : 'Sin resultados en este filtro.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((service) => (
                <button
                  key={service.id}
                  onClick={() => onAdd(service.id)}
                  disabled={actionLoading === service.id}
                  className="w-full text-left p-3 border border-border rounded-md bg-card hover:border-photocan-amber/40 hover:bg-photocan-amber/5 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <ServiceTypeBadge type={service.service_type} />
                        <span className="font-medium text-sm truncate">
                          {service.name}
                        </span>
                      </div>
                      {service.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {service.description}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-sm font-medium">
                        {formatPrice(service.default_price, currency)}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        por {service.unit}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FilterBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function ServiceTypeBadge({
  type,
}: {
  type: 'atomic' | 'package' | 'addon';
}) {
  const config = {
    atomic: { Icon: Package, color: 'text-blue-500' },
    package: { Icon: Layers, color: 'text-photocan-amber-deep' },
    addon: { Icon: Plus, color: 'text-purple-500' },
  };
  const { Icon, color } = config[type];
  return <Icon className={`w-3 h-3 ${color}`} />;
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
