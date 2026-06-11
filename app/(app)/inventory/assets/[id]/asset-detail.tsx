'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Send,
  Wrench,
  AlertCircle,
  CheckCircle2,
  ArrowRightLeft,
  X,
  Loader2,
  MoreVertical,
  Pencil,
  Archive,
  History,
  MapPin,
  Calendar,
  DollarSign,
  Shield,
  ArrowDown,
  ArrowUp,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  transferAssetAction,
  sendToMaintenanceAction,
  returnFromMaintenanceAction,
  markAssetAsLostAction,
  recoverLostAssetAction,
  retireAssetAction,
  archiveAssetAction,
} from '@/lib/actions/assets';
import type {
  Asset,
  AssetMovement,
  AssetStatus,
  AssetMovementType,
} from '@/lib/types/database';

type AssetWithRelations = Asset & {
  warehouse: { id: string; name: string; type: string } | null;
  holder: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
};

type MovementWithRelations = AssetMovement & {
  from_warehouse: { id: string; name: string } | null;
  to_warehouse: { id: string; name: string } | null;
  from_user: { id: string; first_name: string; last_name: string } | null;
  to_user: { id: string; first_name: string; last_name: string } | null;
  performer: { id: string; first_name: string; last_name: string } | null;
};

interface Props {
  asset: AssetWithRelations;
  movements: MovementWithRelations[];
  warehouses: Array<{ id: string; name: string; type: string }>;
  canManage: boolean;
}

type ModalType =
  | null
  | 'transfer'
  | 'maintenance_out'
  | 'maintenance_in'
  | 'lost'
  | 'recover'
  | 'retire';

export function AssetDetail({
  asset,
  movements,
  warehouses,
  canManage,
}: Props) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function handleArchive() {
    if (!confirm('¿Archivar este activo? Quedará oculto pero conservará su historial.')) return;
    setActionLoading(true);
    const result = await archiveAssetAction(asset.id);
    setActionLoading(false);
    if (result?.error) alert(result.error);
    else router.push('/inventory/assets');
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={asset.status} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {getCategoryLabel(asset.category)}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">
              {asset.name}
            </h1>
            <div className="text-sm text-muted-foreground">
              {[asset.brand, asset.model].filter(Boolean).join(' · ')}
              {asset.serial_number && (
                <>
                  {' · '}
                  <span className="font-mono">{asset.serial_number}</span>
                </>
              )}
            </div>
          </div>

          {canManage && asset.status !== 'retired' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Acciones rápidas según estado */}
              {asset.status === 'available' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveModal('transfer')}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Transferir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveModal('maintenance_out')}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Mantenimiento
                  </Button>
                </>
              )}

              {asset.status === 'in_maintenance' && (
                <Button
                  size="sm"
                  onClick={() => setActiveModal('maintenance_in')}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Regresar de mantenimiento
                </Button>
              )}

              {asset.status === 'lost' && (
                <Button
                  size="sm"
                  onClick={() => setActiveModal('recover')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Recuperar
                </Button>
              )}

              {/* Menú con más acciones */}
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-md shadow-lg min-w-[200px] py-1">
                      <Link
                        href={`/inventory/assets/${asset.id}/edit`}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        Editar información
                      </Link>

                      {asset.status === 'available' && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setActiveModal('lost');
                          }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                          Marcar como perdido
                        </button>
                      )}

                      {asset.status !== 'checked_out' && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setActiveModal('retire');
                          }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                        >
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          Dar de baja
                        </button>
                      )}

                      <div className="border-t border-border my-1" />

                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          handleArchive();
                        }}
                        disabled={actionLoading}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                      >
                        <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                        Archivar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Columna izquierda: info + historial */}
        <div className="space-y-6 min-w-0">
          {/* Estado actual destacado */}
          <CurrentLocation asset={asset} />

          {/* Información comercial */}
          {(asset.estimated_value ||
            asset.purchase_date ||
            asset.warranty_until ||
            asset.notes) && (
            <div className="border border-border rounded-lg bg-card p-5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Información
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {asset.estimated_value && (
                  <InfoRow
                    icon={<DollarSign className="w-3.5 h-3.5" />}
                    label="Valor estimado"
                    value={formatPrice(
                      Number(asset.estimated_value),
                      asset.currency || 'MXN'
                    )}
                  />
                )}
                {asset.purchase_date && (
                  <InfoRow
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    label="Comprado el"
                    value={new Date(asset.purchase_date).toLocaleDateString(
                      'es-MX',
                      {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }
                    )}
                  />
                )}
                {asset.warranty_until && (
                  <InfoRow
                    icon={<Shield className="w-3.5 h-3.5" />}
                    label="Garantía hasta"
                    value={new Date(asset.warranty_until).toLocaleDateString(
                      'es-MX',
                      {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }
                    )}
                  />
                )}
              </div>
              {asset.notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                    Notas
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Historial */}
          <div className="border border-border rounded-lg bg-card">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm font-medium">
                Historial ({movements.length}{' '}
                {movements.length === 1 ? 'evento' : 'eventos'})
              </div>
            </div>

            {movements.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Sin movimientos registrados.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {movements.map((m) => (
                  <MovementRow key={m.id} movement={m} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Estado actual
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Ubicación
              </div>
              <div className="text-sm font-medium">
                {asset.warehouse ? (
                  asset.warehouse.name
                ) : (
                  <span className="text-muted-foreground italic">
                    Sin almacén
                  </span>
                )}
              </div>
            </div>

            {asset.holder && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  En mano de
                </div>
                <div className="text-sm font-medium text-photocan-amber-deep">
                  {asset.holder.first_name} {asset.holder.last_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {asset.holder.email}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1">
                Registrado el
              </div>
              <div className="text-xs font-mono">
                {new Date(asset.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modales de acción */}
      {activeModal === 'transfer' && (
        <ActionModal
          title="Transferir a otro almacén"
          icon={<ArrowRightLeft className="w-4 h-4" />}
          assetId={asset.id}
          warehouses={warehouses.filter(
            (w) => w.id !== asset.current_warehouse_id
          )}
          showWarehouse
          onClose={() => setActiveModal(null)}
          onConfirm={async (data) => {
            return transferAssetAction({
              asset_id: asset.id,
              to_warehouse_id: data.warehouse_id!,
              notes: data.notes,
            });
          }}
        />
      )}

      {activeModal === 'maintenance_out' && (
        <ActionModal
          title="Enviar a mantenimiento"
          icon={<Wrench className="w-4 h-4" />}
          assetId={asset.id}
          warehouses={warehouses}
          onClose={() => setActiveModal(null)}
          onConfirm={async (data) => {
            return sendToMaintenanceAction({
              asset_id: asset.id,
              notes: data.notes,
            });
          }}
        />
      )}

      {activeModal === 'maintenance_in' && (
        <ActionModal
          title="Regresar de mantenimiento"
          icon={<CheckCircle2 className="w-4 h-4" />}
          assetId={asset.id}
          warehouses={warehouses}
          showWarehouse
          onClose={() => setActiveModal(null)}
          onConfirm={async (data) => {
            return returnFromMaintenanceAction({
              asset_id: asset.id,
              to_warehouse_id: data.warehouse_id!,
              notes: data.notes,
            });
          }}
        />
      )}

      {activeModal === 'lost' && (
        <ActionModal
          title="Marcar como perdido"
          icon={<AlertCircle className="w-4 h-4" />}
          assetId={asset.id}
          warehouses={warehouses}
          requireNotes
          notesPlaceholder="Describe las circunstancias del extravío..."
          onClose={() => setActiveModal(null)}
          onConfirm={async (data) => {
            return markAssetAsLostAction({
              asset_id: asset.id,
              notes: data.notes || '',
            });
          }}
        />
      )}

      {activeModal === 'recover' && (
        <ActionModal
          title="Recuperar activo perdido"
          icon={<RotateCcw className="w-4 h-4" />}
          assetId={asset.id}
          warehouses={warehouses}
          showWarehouse
          onClose={() => setActiveModal(null)}
          onConfirm={async (data) => {
            return recoverLostAssetAction({
              asset_id: asset.id,
              to_warehouse_id: data.warehouse_id!,
              notes: data.notes,
            });
          }}
        />
      )}

      {activeModal === 'retire' && (
        <ActionModal
          title="Dar de baja permanentemente"
          icon={<Package className="w-4 h-4" />}
          assetId={asset.id}
          warehouses={warehouses}
          requireNotes
          notesPlaceholder="Motivo de la baja (vendido, donado, irreparable...)"
          onClose={() => setActiveModal(null)}
          onConfirm={async (data) => {
            return retireAssetAction({
              asset_id: asset.id,
              notes: data.notes || '',
            });
          }}
        />
      )}
    </>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function CurrentLocation({ asset }: { asset: AssetWithRelations }) {
  if (asset.status === 'retired') {
    return (
      <div className="border border-border rounded-lg bg-muted/30 p-5 flex items-center gap-3">
        <Package className="w-5 h-5 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">Dado de baja</div>
          <div className="text-xs text-muted-foreground">
            Este activo ya no forma parte del inventario activo.
          </div>
        </div>
      </div>
    );
  }

  if (asset.status === 'lost') {
    return (
      <div className="border border-destructive/30 rounded-lg bg-destructive/5 p-5 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-destructive" />
        <div>
          <div className="text-sm font-medium text-destructive">
            Marcado como perdido
          </div>
          <div className="text-xs text-muted-foreground">
            Última ubicación conocida: {asset.warehouse?.name || '—'}
          </div>
        </div>
      </div>
    );
  }

  if (asset.status === 'checked_out' && asset.holder) {
    return (
      <div className="border border-photocan-amber/30 rounded-lg bg-photocan-amber/5 p-5">
        <div className="flex items-center gap-3 mb-2">
          <Send className="w-5 h-5 text-photocan-amber-deep" />
          <div>
            <div className="text-sm font-medium">
              En manos de {asset.holder.first_name} {asset.holder.last_name}
            </div>
            <div className="text-xs text-muted-foreground">
              {asset.holder.email}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground pl-8">
          Almacén de origen: {asset.warehouse?.name || '—'}
        </div>
      </div>
    );
  }

  if (asset.status === 'in_maintenance') {
    return (
      <div className="border border-blue-500/30 rounded-lg bg-blue-500/5 p-5 flex items-center gap-3">
        <Wrench className="w-5 h-5 text-blue-500" />
        <div>
          <div className="text-sm font-medium">En mantenimiento</div>
          <div className="text-xs text-muted-foreground">
            Esperando reparación o limpieza para volver a circulación.
          </div>
        </div>
      </div>
    );
  }

  // available
  return (
    <div className="border border-green-500/30 rounded-lg bg-green-500/5 p-5 flex items-center gap-3">
      <CheckCircle2 className="w-5 h-5 text-green-500" />
      <div>
        <div className="text-sm font-medium">Disponible</div>
        <div className="text-xs text-muted-foreground">
          En {asset.warehouse?.name || 'almacén sin asignar'}
        </div>
      </div>
    </div>
  );
}

function MovementRow({ movement }: { movement: MovementWithRelations }) {
  const { Icon, color, label } = getMovementMeta(movement.movement_type);

  return (
    <div className="p-4 flex items-start gap-3">
      <div
        className={`w-7 h-7 rounded-md grid place-items-center border flex-shrink-0 ${color}`}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground font-mono">
            {new Date(movement.created_at).toLocaleString('es-MX', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-0.5">
          {/* Origen y destino warehouse */}
          {(movement.from_warehouse || movement.to_warehouse) && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              <span>
                {movement.from_warehouse?.name || '—'}
                {movement.to_warehouse && (
                  <>
                    {' → '}
                    <span className="text-foreground">
                      {movement.to_warehouse.name}
                    </span>
                  </>
                )}
              </span>
            </div>
          )}

          {/* Usuario destino (checkout) */}
          {movement.to_user && (
            <div>
              Entregado a{' '}
              <span className="text-foreground">
                {movement.to_user.first_name} {movement.to_user.last_name}
              </span>
            </div>
          )}

          {/* Usuario origen (checkin) */}
          {movement.from_user && !movement.to_user && (
            <div>
              Devuelto por{' '}
              <span className="text-foreground">
                {movement.from_user.first_name} {movement.from_user.last_name}
              </span>
            </div>
          )}

          {/* Quién registró */}
          {movement.performer && (
            <div className="text-[10px] font-mono">
              Registrado por {movement.performer.first_name}{' '}
              {movement.performer.last_name}
            </div>
          )}

          {movement.notes && (
            <div className="mt-1.5 pt-1.5 border-t border-border/40 text-foreground/80 italic">
              &ldquo;{movement.notes}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL GENÉRICO PARA ACCIONES
// ============================================================

function ActionModal({
  title,
  icon,
  warehouses,
  showWarehouse = false,
  requireNotes = false,
  notesPlaceholder = 'Notas opcionales',
  onClose,
  onConfirm,
}: {
  title: string;
  icon: React.ReactNode;
  assetId: string;
  warehouses: Array<{ id: string; name: string; type: string }>;
  showWarehouse?: boolean;
  requireNotes?: boolean;
  notesPlaceholder?: string;
  onClose: () => void;
  onConfirm: (data: {
    warehouse_id?: string;
    notes?: string;
  }) => Promise<{ success?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (showWarehouse && !warehouseId) {
      setError('Selecciona un almacén');
      return;
    }

    if (requireNotes && (!notes || notes.trim().length < 5)) {
      setError('Las notas son requeridas (mínimo 5 caracteres)');
      return;
    }

    setIsLoading(true);
    const result = await onConfirm({
      warehouse_id: showWarehouse ? warehouseId : undefined,
      notes: notes.trim() || undefined,
    });
    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isLoading ? undefined : onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {showWarehouse && (
            <div className="space-y-2">
              <Label htmlFor="warehouse">Almacén destino *</Label>
              <select
                id="warehouse"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              >
                {warehouses.length === 0 ? (
                  <option value="">No hay almacenes disponibles</option>
                ) : (
                  warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">
              Notas{requireNotes ? ' *' : ' (opcional)'}
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={3}
              placeholder={notesPlaceholder}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
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
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: AssetStatus }) {
  const config = {
    available: {
      label: 'Disponible',
      bg: 'bg-green-500/10 text-green-500',
    },
    checked_out: {
      label: 'En mano',
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    in_maintenance: {
      label: 'Mantenimiento',
      bg: 'bg-blue-500/10 text-blue-500',
    },
    lost: {
      label: 'Perdido',
      bg: 'bg-destructive/10 text-destructive',
    },
    retired: {
      label: 'Baja',
      bg: 'bg-muted text-muted-foreground',
    },
  };
  const { label, bg } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded ${bg}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function getMovementMeta(type: AssetMovementType) {
  const config = {
    acquired: {
      Icon: Package,
      color: 'bg-green-500/10 border-green-500/30 text-green-500',
      label: 'Alta en inventario',
    },
    checkout: {
      Icon: ArrowUp,
      color:
        'bg-photocan-amber/10 border-photocan-amber/30 text-photocan-amber-deep',
      label: 'Salida (checkout)',
    },
    checkin: {
      Icon: ArrowDown,
      color: 'bg-green-500/10 border-green-500/30 text-green-500',
      label: 'Entrada (checkin)',
    },
    transfer: {
      Icon: ArrowRightLeft,
      color: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
      label: 'Transferencia',
    },
    maintenance_out: {
      Icon: Wrench,
      color: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
      label: 'Salida a mantenimiento',
    },
    maintenance_in: {
      Icon: CheckCircle2,
      color: 'bg-green-500/10 border-green-500/30 text-green-500',
      label: 'Regreso de mantenimiento',
    },
    marked_lost: {
      Icon: AlertCircle,
      color: 'bg-destructive/10 border-destructive/30 text-destructive',
      label: 'Marcado como perdido',
    },
    retired: {
      Icon: Package,
      color: 'bg-muted border-border text-muted-foreground',
      label: 'Dado de baja',
    },
  };
  return config[type];
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    camera: 'CÁMARA',
    lens: 'LENTE',
    audio: 'AUDIO',
    lighting: 'ILUMINACIÓN',
    support: 'SOPORTE',
    storage: 'ALMACENAMIENTO',
    power: 'ENERGÍA',
    cable: 'CABLE',
    computer: 'CÓMPUTO',
    drone: 'DRONE',
    accessory: 'ACCESORIO',
    other: 'OTRO',
  };
  return labels[category] || category.toUpperCase();
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 0,
  }).format(amount);
}
