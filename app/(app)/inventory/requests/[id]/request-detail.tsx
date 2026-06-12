'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertCircle,
  Package,
  Calendar,
  User as UserIcon,
  Briefcase,
  Loader2,
  X,
  ArrowDown,
  ArrowUp,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  approveAssetRequestAction,
  rejectAssetRequestAction,
  cancelAssetRequestAction,
  checkoutAssetRequestAction,
} from '@/lib/actions/asset-requests';
import { CheckinModal } from './checkin-modal';
import type {
  AssetRequest,
  AssetRequestStatus,
  AssetRequestItem,
} from '@/lib/types/database';

type RequestWithRelations = AssetRequest & {
  requester: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  decider: { id: string; first_name: string; last_name: string } | null;
  client: { id: string; name: string } | null;
};

type ItemWithAsset = AssetRequestItem & {
  asset: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    serial_number: string | null;
    category: string;
    status: string;
    warehouse: { id: string; name: string } | null;
  } | null;
};

interface Props {
  request: RequestWithRelations;
  items: ItemWithAsset[];
  canApprove: boolean;
  canCheckout: boolean;
  isRequester: boolean;
  isSuperAdmin: boolean;
}

export function RequestDetail({
  request,
  items,
  canApprove,
  canCheckout,
  isRequester,
  isSuperAdmin,
}: Props) {
  const router = useRouter();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingItems = items.filter((i) => i.checkout_at && !i.return_at);
  const returnedItems = items.filter((i) => i.return_at);
  const allReturned =
    items.length > 0 && items.every((i) => i.return_at !== null);

  async function handleApprove() {
    if (!confirm('¿Aprobar esta solicitud? El solicitante podrá retirar el equipo.')) return;
    setActionLoading(true);
    setError(null);
    const result = await approveAssetRequestAction({
      request_id: request.id,
    });
    setActionLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleCancel() {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    setActionLoading(true);
    setError(null);
    const result = await cancelAssetRequestAction(request.id);
    setActionLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={request.status} />
              {isRequestOverdue(request) && (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3" />
                  Vencida
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {request.purpose}
            </h1>
            {request.client && (
              <div className="text-sm text-muted-foreground">
                Para cliente:{' '}
                <span className="text-foreground font-medium">
                  {request.client.name}
                </span>
              </div>
            )}
          </div>

          {/* Acciones según estado y rol */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {/* PENDING + canApprove */}
            {request.status === 'pending' && canApprove && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                >
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprobar
                    </>
                  )}
                </Button>
              </>
            )}

            {/* PENDING + es el solicitante (puede cancelar) */}
            {request.status === 'pending' &&
              (isRequester || isSuperAdmin) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancelar
                </Button>
              )}

            {/* APPROVED + canCheckout */}
            {request.status === 'approved' && canCheckout && (
              <Button
                size="sm"
                onClick={() => setShowCheckoutModal(true)}
                disabled={actionLoading}
              >
                <ArrowUp className="w-3.5 h-3.5" />
                Entregar equipo
              </Button>
            )}

            {/* APPROVED + es el solicitante (puede cancelar antes del checkout) */}
            {request.status === 'approved' &&
              (isRequester || isSuperAdmin) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancelar
                </Button>
              )}

            {/* ACTIVE + canCheckout (devolución) */}
            {request.status === 'active' && canCheckout && (
              <Button
                size="sm"
                onClick={() => setShowCheckinModal(true)}
                disabled={actionLoading}
              >
                <ArrowDown className="w-3.5 h-3.5" />
                Recibir devolución
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mt-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Notas de decisión (rechazada o aprobada con notas) */}
        {request.decision_notes && (
          <div className="rounded-md bg-secondary/50 border border-border px-4 py-3 text-sm mt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              {request.status === 'rejected'
                ? 'Motivo del rechazo'
                : 'Notas del aprobador'}
            </div>
            <div>{request.decision_notes}</div>
            {request.decider && (
              <div className="text-xs text-muted-foreground mt-1">
                Por {request.decider.first_name} {request.decider.last_name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Lista de items */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {items.length}{' '}
            {items.length === 1 ? 'activo solicitado' : 'activos solicitados'}
            {request.status === 'active' && (
              <>
                {' '}
                · {returnedItems.length}/{items.length} devueltos
              </>
            )}
          </div>

          {items.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Sin activos en esta solicitud.
            </div>
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                requestStatus={request.status}
              />
            ))
          )}

          {/* Aviso si todo fue devuelto pero la solicitud sigue activa */}
          {allReturned && request.status === 'active' && (
            <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 px-4 py-3 text-sm flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 text-photocan-amber-deep flex-shrink-0" />
              <div>
                Todos los activos fueron devueltos. La solicitud pasará a
                &ldquo;Devuelta&rdquo; en el siguiente refresh.
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Información
            </div>

            <SidebarRow
              icon={<UserIcon className="w-3.5 h-3.5" />}
              label="Solicitante"
              value={
                request.requester
                  ? `${request.requester.first_name} ${request.requester.last_name}`
                  : '—'
              }
              hint={request.requester?.email}
            />

            <SidebarRow
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Desde"
              value={new Date(request.start_date).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            />

            <SidebarRow
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Hasta"
              value={new Date(request.end_date).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            />

            {request.client && (
              <SidebarRow
                icon={<Briefcase className="w-3.5 h-3.5" />}
                label="Cliente"
                value={request.client.name}
              />
            )}

            <div className="pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1">
                Creada el
              </div>
              <div className="text-xs font-mono">
                {new Date(request.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>

            {request.decided_at && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {request.status === 'rejected' ? 'Rechazada' : 'Decidida'} el
                </div>
                <div className="text-xs font-mono">
                  {new Date(request.decided_at).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Rechazar */}
      {showRejectModal && (
        <RejectModal
          requestId={request.id}
          onClose={() => setShowRejectModal(false)}
          onDone={() => {
            setShowRejectModal(false);
            router.refresh();
          }}
        />
      )}

      {/* Modal: Checkout */}
      {showCheckoutModal && (
        <CheckoutModal
          requestId={request.id}
          items={items.filter((i) => !i.checkout_at)}
          onClose={() => setShowCheckoutModal(false)}
          onDone={() => {
            setShowCheckoutModal(false);
            router.refresh();
          }}
        />
      )}

      {/* Modal: Checkin */}
      {showCheckinModal && (
        <CheckinModal
          requestId={request.id}
          items={pendingItems}
          onClose={() => setShowCheckinModal(false)}
          onDone={() => {
            setShowCheckinModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ============================================================
// ITEM CARD
// ============================================================

function ItemCard({
  item,
  requestStatus,
}: {
  item: ItemWithAsset;
  requestStatus: AssetRequestStatus;
}) {
  if (!item.asset) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card opacity-50">
        <div className="text-sm text-muted-foreground italic">
          Activo eliminado
        </div>
      </div>
    );
  }

  const wasCheckedOut = !!item.checkout_at;
  const wasReturned = !!item.return_at;

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center flex-shrink-0">
          <Package className="w-4 h-4 text-photocan-amber-deep" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="font-medium truncate">{item.asset.name}</div>
            <ItemStatusBadge
              checkedOut={wasCheckedOut}
              returned={wasReturned}
              condition={item.return_condition}
            />
          </div>

          <div className="text-xs text-muted-foreground space-y-0.5">
            {(item.asset.brand || item.asset.model) && (
              <div>
                {[item.asset.brand, item.asset.model]
                  .filter(Boolean)
                  .join(' · ')}
                {item.asset.serial_number && (
                  <span className="font-mono"> · {item.asset.serial_number}</span>
                )}
              </div>
            )}

            {item.asset.warehouse && !wasCheckedOut && (
              <div>En: {item.asset.warehouse.name}</div>
            )}

            {wasCheckedOut && (
              <div className="text-photocan-amber-deep">
                Entregado el{' '}
                {new Date(item.checkout_at!).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}

            {wasReturned && (
              <div className="text-green-500">
                Devuelto el{' '}
                {new Date(item.return_at!).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}

            {item.return_notes && (
              <div className="italic text-foreground/80 mt-1 pt-1 border-t border-border/40">
                &ldquo;{item.return_notes}&rdquo;
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL RECHAZAR
// ============================================================

function RejectModal({
  requestId,
  onClose,
  onDone,
}: {
  requestId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!notes || notes.trim().length < 3) {
      setError('Indica el motivo del rechazo');
      return;
    }

    setIsLoading(true);
    const result = await rejectAssetRequestAction({
      request_id: requestId,
      notes: notes.trim(),
    });
    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      onDone();
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isLoading ? undefined : onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">Rechazar solicitud</h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            El solicitante verá esta razón. Sé claro y respetuoso.
          </p>

          <div className="space-y-2">
            <Label htmlFor="notes">Motivo del rechazo *</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={3}
              placeholder="Ej: equipo asignado a otro proyecto en esas fechas, falta más info..."
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
                'Rechazar solicitud'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

// ============================================================
// MODAL CHECKOUT (entrega)
// ============================================================

function CheckoutModal({
  requestId,
  items,
  onClose,
  onDone,
}: {
  requestId: string;
  items: ItemWithAsset[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await checkoutAssetRequestAction({
      request_id: requestId,
      checkout_notes: notes.trim() || undefined,
    });

    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      onDone();
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isLoading ? undefined : onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background border border-border rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold">Entregar equipo</h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Vas a entregar {items.length}{' '}
              {items.length === 1 ? 'activo' : 'activos'} al solicitante. Cada
              activo cambiará a estado &ldquo;En mano&rdquo; y quedará en su historial.
            </p>

            <div className="border border-border rounded-md divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="p-3 flex items-center gap-3">
                  <Package className="w-4 h-4 text-photocan-amber-deep flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {item.asset?.name}
                    </div>
                    {item.asset?.warehouse && (
                      <div className="text-xs text-muted-foreground">
                        De: {item.asset.warehouse.name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkout_notes">Notas de entrega (opcional)</Label>
              <textarea
                id="checkout_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLoading}
                rows={2}
                placeholder="Estado en que se entrega el equipo, accesorios incluidos..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-border flex gap-2 flex-shrink-0">
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
                <>
                  <ArrowUp className="w-4 h-4" />
                  Confirmar entrega
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

// ============================================================
// COMPONENTES PEQUEÑOS
// ============================================================

function StatusBadge({ status }: { status: AssetRequestStatus }) {
  const config = {
    pending: {
      label: 'Pendiente de aprobación',
      Icon: Clock,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    approved: {
      label: 'Aprobada · esperando checkout',
      Icon: CheckCircle2,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    active: {
      label: 'Activa · equipo en mano',
      Icon: Send,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    returned: {
      label: 'Devuelta',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    rejected: {
      label: 'Rechazada',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
    cancelled: {
      label: 'Cancelada',
      Icon: XCircle,
      bg: 'bg-muted text-muted-foreground',
    },
  };
  const { label, Icon, bg } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function ItemStatusBadge({
  checkedOut,
  returned,
  condition,
}: {
  checkedOut: boolean;
  returned: boolean;
  condition: string | null;
}) {
  if (returned) {
    const config: Record<string, { label: string; bg: string }> = {
      ok: { label: 'Devuelto OK', bg: 'bg-green-500/10 text-green-500' },
      minor_damage: {
        label: 'Daño menor',
        bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
      },
      major_damage: {
        label: 'Daño mayor',
        bg: 'bg-destructive/10 text-destructive',
      },
      lost: {
        label: 'Perdido',
        bg: 'bg-destructive/10 text-destructive',
      },
    };
    const c = condition ? config[condition] : config.ok;
    return (
      <span
        className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${c.bg}`}
      >
        {c.label}
      </span>
    );
  }

  if (checkedOut) {
    return (
      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-photocan-amber/10 text-photocan-amber-deep">
        En mano
      </span>
    );
  }

  return (
    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
      Pendiente
    </span>
  );
}

function SidebarRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
      {hint && (
        <div className="text-xs text-muted-foreground truncate">{hint}</div>
      )}
    </div>
  );
}

function isRequestOverdue(req: AssetRequest): boolean {
  if (req.status !== 'active') return false;
  const endDate = new Date(req.end_date);
  return endDate < new Date();
}
