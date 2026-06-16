'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  AlertCircle,
  X,
  Clock,
  PlayCircle,
  PauseCircle,
  XCircle,
  CheckCircle2,
  Play,
  Pause,
  Ban,
  RefreshCw,
  Repeat,
  Calendar,
  Briefcase,
  Receipt,
  Layers,
  SlidersHorizontal,
  Plus,
  Minus,
  FileSignature,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  startFirstPeriodAction,
  renewPeriodAction,
  completePeriodAction,
  adjustPeriodDeliverableAction,
  updateDeliveredQuantityAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  cancelSubscriptionAction,
} from '@/lib/actions/subscriptions';
import type {
  ClientSubscription,
  SubscriptionStatus,
  SubscriptionDeliverable,
  SubscriptionPeriod,
  PeriodDeliverable,
} from '@/lib/types/database';

type PeriodWithDeliverables = SubscriptionPeriod & {
  period_deliverables: PeriodDeliverable[];
};

type SubscriptionWithRelations = ClientSubscription & {
  client: { id: string; name: string } | null;
  source_contract: { id: string; folio: string; title: string } | null;
};

interface Props {
  subscription: SubscriptionWithRelations;
  deliverables: SubscriptionDeliverable[];
  periods: PeriodWithDeliverables[];
  canManage: boolean;
  canCancel: boolean;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function SubscriptionDetail({
  subscription,
  deliverables,
  periods,
  canManage,
  canCancel,
}: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [periodModal, setPeriodModal] = useState<null | 'start' | 'renew'>(null);
  const [periodDate, setPeriodDate] = useState(todayISO());
  const [reasonModal, setReasonModal] = useState<null | 'pause' | 'cancel'>(null);
  const [reason, setReason] = useState('');

  const status = subscription.status;
  const isPending = status === 'pending_start';
  const isActive = status === 'active';
  const isPaused = status === 'paused';
  const isCancelled = status === 'cancelled';

  // El período más reciente (los períodos vienen ordenados desc por número)
  const currentPeriod = periods[0] ?? null;
  const currentPeriodActive = currentPeriod?.status === 'active';

  // ¿Se puede renovar? Suscripción activa y último período completado
  const canRenew =
    isActive && currentPeriod !== null && currentPeriod.status !== 'active';

  async function run(key: string, fn: () => Promise<{ error?: string }>) {
    setError(null);
    setActionLoading(key);
    const result = await fn();
    setActionLoading(null);
    if (result?.error) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleStartPeriod() {
    const action = periodModal;
    if (!action) return;
    const ok = await run(action, () =>
      action === 'start'
        ? startFirstPeriodAction({
            subscription_id: subscription.id,
            start_date: periodDate,
          })
        : renewPeriodAction({
            subscription_id: subscription.id,
            start_date: periodDate,
          })
    );
    if (ok) {
      setPeriodModal(null);
      setPeriodDate(todayISO());
    }
  }

  async function handleReasonAction() {
    const action = reasonModal;
    if (!action) return;
    if (reason.trim().length < 5) {
      setError('Indica un motivo (mín. 5 caracteres)');
      return;
    }
    const ok = await run(action, () =>
      action === 'pause'
        ? pauseSubscriptionAction({
            subscription_id: subscription.id,
            reason: reason.trim(),
          })
        : cancelSubscriptionAction({
            subscription_id: subscription.id,
            reason: reason.trim(),
          })
    );
    if (ok) {
      setReasonModal(null);
      setReason('');
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={status} />
              <BillingCycleBadge cycle={subscription.billing_cycle} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {subscription.name}
            </h1>
            {subscription.client && (
              <div className="text-sm text-muted-foreground">
                Para{' '}
                <span className="text-foreground font-medium">
                  {subscription.client.name}
                </span>
              </div>
            )}
          </div>

          {/* Acciones según estado */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isPending && canManage && (
              <Button
                onClick={() => {
                  setError(null);
                  setPeriodDate(todayISO());
                  setPeriodModal('start');
                }}
                disabled={!!actionLoading}
              >
                <Play className="w-4 h-4" />
                Iniciar primer período
              </Button>
            )}

            {canRenew && canManage && (
              <Button
                onClick={() => {
                  setError(null);
                  setPeriodDate(todayISO());
                  setPeriodModal('renew');
                }}
                disabled={!!actionLoading}
              >
                <RefreshCw className="w-4 h-4" />
                Iniciar nuevo período
              </Button>
            )}

            {isActive && canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setReason('');
                  setReasonModal('pause');
                }}
                disabled={!!actionLoading}
              >
                <Pause className="w-3.5 h-3.5" />
                Pausar
              </Button>
            )}

            {isPaused && canManage && (
              <Button
                onClick={() =>
                  run('resume', () => resumeSubscriptionAction(subscription.id))
                }
                disabled={!!actionLoading}
              >
                {actionLoading === 'resume' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Reactivar
              </Button>
            )}

            {(isActive || isPaused) && canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setReason('');
                  setReasonModal('cancel');
                }}
                disabled={!!actionLoading}
              >
                <Ban className="w-3.5 h-3.5" />
                Cancelar
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

        {/* Banner: pausada */}
        {isPaused && subscription.pause_reason && (
          <div className="rounded-md bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-sm mt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-blue-500 mb-1">
              Suscripción pausada
            </div>
            <div>{subscription.pause_reason}</div>
          </div>
        )}

        {/* Banner: cancelada */}
        {isCancelled && subscription.cancellation_reason && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm mt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-destructive mb-1">
              Suscripción cancelada
            </div>
            <div>{subscription.cancellation_reason}</div>
          </div>
        )}
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="min-w-0 space-y-6">
          {/* Período actual */}
          {currentPeriod ? (
            <Section
              title={`Período ${currentPeriod.period_number} · actual`}
              icon={Repeat}
              action={
                currentPeriodActive && canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run('complete', () =>
                        completePeriodAction(currentPeriod.id)
                      )
                    }
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'complete' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Completar período
                  </Button>
                ) : undefined
              }
            >
              <PeriodMeta period={currentPeriod} />
              <DeliverablesTable
                period={currentPeriod}
                editable={currentPeriodActive && canManage}
                onError={setError}
                onRefresh={() => router.refresh()}
              />
            </Section>
          ) : (
            <Section title="Períodos" icon={Repeat}>
              <div className="text-sm text-muted-foreground py-2">
                {isPending
                  ? 'Esta suscripción aún no tiene períodos. Inicia el primer período para empezar a gestionar entregables.'
                  : 'Sin períodos registrados.'}
              </div>
            </Section>
          )}

          {/* Historial de períodos anteriores */}
          {periods.length > 1 && (
            <Section title="Períodos anteriores" icon={Layers}>
              <div className="space-y-3">
                {periods.slice(1).map((period) => (
                  <details
                    key={period.id}
                    className="border border-border rounded-md bg-background/50 group"
                  >
                    <summary className="px-3 py-2 flex items-center justify-between gap-2 cursor-pointer list-none">
                      <div className="flex items-center gap-2">
                        <PeriodStatusBadge status={period.status} />
                        <span className="text-sm font-medium">
                          Período {period.period_number}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatDate(period.start_date)} —{' '}
                          {formatDate(period.end_date)}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground group-open:rotate-90 transition-transform">
                        ▶
                      </span>
                    </summary>
                    <div className="px-3 pb-3">
                      <DeliverablesTable
                        period={period}
                        editable={false}
                        onError={setError}
                        onRefresh={() => router.refresh()}
                      />
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          )}

          {/* Entregables base (plantilla) */}
          <Section title="Entregables base" icon={SlidersHorizontal}>
            <p className="text-xs text-muted-foreground mb-3">
              Plantilla que se copia a cada período nuevo. Los ajustes por
              período no modifican esta plantilla.
            </p>
            {deliverables.length > 0 ? (
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Servicio
                      </th>
                      <th className="text-right px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Cant. / período
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliverables.map((d) => (
                      <tr key={d.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="font-medium">{d.service_name}</div>
                          {d.notes && (
                            <div className="text-xs text-muted-foreground">
                              {d.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {d.quantity_per_period}
                          {d.unit ? ` ${d.unit}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-2">
                Sin entregables base.
              </div>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Información
            </div>

            <SidebarRow
              icon={<Briefcase className="w-3.5 h-3.5" />}
              label="Cliente"
              value={subscription.client?.name || '—'}
            />

            <div className="pt-3 border-t border-border">
              <SidebarRow
                icon={<Receipt className="w-3.5 h-3.5" />}
                label="Precio por período"
                value={formatCurrency(
                  subscription.price_per_period,
                  subscription.currency
                )}
                hint={getBillingCycleLabel(subscription.billing_cycle)}
              />
            </div>

            <div className="pt-3 border-t border-border">
              <SidebarRow
                icon={<Repeat className="w-3.5 h-3.5" />}
                label="Períodos facturados"
                value={String(subscription.total_periods_billed)}
              />
            </div>

            {subscription.current_period_end && (
              <div className="pt-3 border-t border-border">
                <SidebarRow
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Período actual termina"
                  value={formatDate(subscription.current_period_end)}
                />
              </div>
            )}

            {subscription.next_renewal_date && !isCancelled && (
              <div className="pt-3 border-t border-border">
                <SidebarRow
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  label="Próxima renovación"
                  value={formatDate(subscription.next_renewal_date)}
                />
              </div>
            )}

            {subscription.source_contract && (
              <div className="pt-3 border-t border-border">
                <Link
                  href={`/contracts/${subscription.source_contract.id}`}
                  className="block group"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                    <FileSignature className="w-3.5 h-3.5" />
                    Contrato origen
                  </div>
                  <div className="text-sm font-medium group-hover:text-photocan-amber transition-colors">
                    {subscription.source_contract.folio}
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: iniciar / renovar período */}
      {periodModal && (
        <Modal
          title={
            periodModal === 'start'
              ? 'Iniciar primer período'
              : 'Iniciar nuevo período'
          }
          onClose={() => setPeriodModal(null)}
          disabled={!!actionLoading}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se copiarán los entregables base a este período y se calculará la
              fecha de fin según el ciclo{' '}
              <strong className="text-foreground">
                {getBillingCycleLabel(subscription.billing_cycle).toLowerCase()}
              </strong>
              .
            </p>
            <div className="space-y-2">
              <Label htmlFor="period_date">Fecha de inicio *</Label>
              <input
                id="period_date"
                type="date"
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
                disabled={!!actionLoading}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setPeriodModal(null)}
              disabled={!!actionLoading}
              className="flex-1"
            >
              Volver
            </Button>
            <Button
              onClick={handleStartPeriod}
              disabled={!!actionLoading}
              className="flex-1"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Modal: pausar / cancelar */}
      {reasonModal && (
        <Modal
          title={
            reasonModal === 'pause'
              ? 'Pausar suscripción'
              : 'Cancelar suscripción'
          }
          onClose={() => setReasonModal(null)}
          disabled={!!actionLoading}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reasonModal === 'pause'
                ? 'La suscripción quedará pausada. Podrás reactivarla más adelante; los períodos ya creados no se modifican.'
                : 'Esta acción no se puede deshacer. La suscripción quedará cancelada de forma permanente.'}
            </p>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo *</Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={!!actionLoading}
                rows={3}
                placeholder={
                  reasonModal === 'pause'
                    ? 'Ej: cliente solicitó pausa temporal...'
                    : 'Ej: fin de la relación comercial...'
                }
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setReasonModal(null)}
              disabled={!!actionLoading}
              className="flex-1"
            >
              Volver
            </Button>
            <Button
              onClick={handleReasonAction}
              disabled={!!actionLoading}
              className="flex-1"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando...
                </>
              ) : reasonModal === 'pause' ? (
                'Pausar'
              ) : (
                'Confirmar cancelación'
              )}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}

// ============================================================
// TABLA DE ENTREGABLES DE UN PERÍODO
// ============================================================

function DeliverablesTable({
  period,
  editable,
  onError,
  onRefresh,
}: {
  period: PeriodWithDeliverables;
  editable: boolean;
  onError: (msg: string | null) => void;
  onRefresh: () => void;
}) {
  const deliverables = [...period.period_deliverables].sort(
    (a, b) => a.position - b.position
  );

  if (deliverables.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Este período no tiene entregables.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md overflow-hidden mt-3">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50">
          <tr>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Servicio
            </th>
            <th className="text-center px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Planeado
            </th>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-[40%]">
              Entregado
            </th>
          </tr>
        </thead>
        <tbody>
          {deliverables.map((d) => (
            <DeliverableRow
              key={d.id}
              deliverable={d}
              editable={editable}
              onError={onError}
              onRefresh={onRefresh}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliverableRow({
  deliverable,
  editable,
  onError,
  onRefresh,
}: {
  deliverable: PeriodDeliverable;
  editable: boolean;
  onError: (msg: string | null) => void;
  onRefresh: () => void;
}) {
  const [delivered, setDelivered] = useState(deliverable.quantity_delivered);
  const [savingDelivered, setSavingDelivered] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [newQty, setNewQty] = useState(String(deliverable.quantity_planned));
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const planned = deliverable.quantity_planned;
  const pct = planned > 0 ? Math.min(100, (delivered / planned) * 100) : 0;
  const complete = delivered >= planned && planned > 0;

  async function setDeliveredQty(next: number) {
    if (next < 0 || next > 10000) return;
    const previous = delivered;
    setDelivered(next); // optimista
    setSavingDelivered(true);
    onError(null);
    const result = await updateDeliveredQuantityAction({
      period_deliverable_id: deliverable.id,
      new_delivered: next,
    });
    setSavingDelivered(false);
    if (result?.error) {
      setDelivered(previous); // revertir
      onError(result.error);
    }
  }

  async function handleAdjust() {
    const qty = parseInt(newQty, 10);
    if (Number.isNaN(qty) || qty < 0) {
      onError('Cantidad inválida');
      return;
    }
    if (adjustReason.trim().length < 5) {
      onError('Indica el motivo del ajuste (mín. 5 caracteres)');
      return;
    }
    setAdjustLoading(true);
    onError(null);
    const result = await adjustPeriodDeliverableAction({
      period_deliverable_id: deliverable.id,
      new_quantity: qty,
      reason: adjustReason.trim(),
    });
    setAdjustLoading(false);
    if (result?.error) {
      onError(result.error);
      return;
    }
    setShowAdjust(false);
    setAdjustReason('');
    onRefresh();
  }

  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="px-3 py-2">
          <div className="font-medium">{deliverable.service_name}</div>
          {deliverable.notes && (
            <div className="text-xs text-muted-foreground">
              {deliverable.notes}
            </div>
          )}
          {deliverable.adjustment_reason && (
            <div className="text-[11px] text-photocan-amber-deep mt-0.5 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Ajustado: {deliverable.adjustment_reason}
            </div>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          <div className="font-mono">
            {planned}
            {deliverable.unit ? ` ${deliverable.unit}` : ''}
          </div>
          {editable && (
            <button
              onClick={() => {
                onError(null);
                setNewQty(String(planned));
                setShowAdjust((v) => !v);
              }}
              className="text-[10px] font-mono text-muted-foreground hover:text-photocan-amber transition-colors"
            >
              Ajustar
            </button>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {editable && (
              <button
                onClick={() => setDeliveredQty(delivered - 1)}
                disabled={savingDelivered || delivered <= 0}
                className="w-6 h-6 grid place-items-center rounded border border-input hover:bg-secondary disabled:opacity-40 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}
            <span className="font-mono text-sm tabular-nums">
              {delivered}/{planned}
            </span>
            {editable && (
              <button
                onClick={() => setDeliveredQty(delivered + 1)}
                disabled={savingDelivered}
                className="w-6 h-6 grid place-items-center rounded border border-input hover:bg-secondary disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
            {complete ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : (
              savingDelivered && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              )
            )}
          </div>
          <div className="h-1.5 rounded-full bg-secondary mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all ${
                complete ? 'bg-green-500' : 'bg-photocan-amber'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </td>
      </tr>

      {/* Fila de ajuste inline */}
      {showAdjust && editable && (
        <tr className="bg-background/60">
          <td colSpan={3} className="px-3 py-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="space-y-1">
                <Label htmlFor={`qty-${deliverable.id}`} className="text-xs">
                  Nueva cantidad
                </Label>
                <input
                  id={`qty-${deliverable.id}`}
                  type="number"
                  min={0}
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  disabled={adjustLoading}
                  className="flex w-28 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label htmlFor={`reason-${deliverable.id}`} className="text-xs">
                  Motivo del ajuste
                </Label>
                <input
                  id={`reason-${deliverable.id}`}
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  disabled={adjustLoading}
                  placeholder="Ej: el cliente pidió 2 reels extra este mes"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAdjust(false)}
                  disabled={adjustLoading}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAdjust} disabled={adjustLoading}>
                  {adjustLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof Repeat;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-photocan-amber" />
          <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PeriodMeta({ period }: { period: PeriodWithDeliverables }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
      <PeriodStatusBadge status={period.status} />
      <span className="inline-flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {formatDate(period.start_date)} — {formatDate(period.end_date)}
      </span>
    </div>
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

function Modal({
  title,
  onClose,
  disabled,
  children,
}: {
  title: string;
  onClose: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !disabled && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 pt-5">{children}</div>;
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const config: Record<
    SubscriptionStatus,
    { label: string; Icon: typeof Clock; bg: string }
  > = {
    pending_start: {
      label: 'Por iniciar',
      Icon: Clock,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    active: {
      label: 'Activa',
      Icon: PlayCircle,
      bg: 'bg-green-500/10 text-green-500',
    },
    paused: {
      label: 'Pausada',
      Icon: PauseCircle,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    cancelled: {
      label: 'Cancelada',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
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

function PeriodStatusBadge({
  status,
}: {
  status: SubscriptionPeriod['status'];
}) {
  const config: Record<
    SubscriptionPeriod['status'],
    { label: string; bg: string }
  > = {
    active: { label: 'Activo', bg: 'bg-green-500/10 text-green-500' },
    completed: { label: 'Completado', bg: 'bg-secondary text-muted-foreground' },
    skipped: { label: 'Omitido', bg: 'bg-destructive/10 text-destructive' },
  };
  const { label, bg } = config[status];
  return (
    <span
      className={`inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${bg}`}
    >
      {label}
    </span>
  );
}

function BillingCycleBadge({ cycle }: { cycle: string }) {
  return (
    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
      {getBillingCycleLabel(cycle)}
    </span>
  );
}

function getBillingCycleLabel(cycle: string): string {
  const labels: Record<string, string> = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    annual: 'Anual',
    one_time: 'Pago único',
  };
  return labels[cycle] || cycle;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
