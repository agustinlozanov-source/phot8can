'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  List,
  CalendarDays,
  ClipboardList,
  Briefcase,
  Repeat,
  X,
  FileText,
  Film,
  Circle,
  Images,
  Video,
  Radio,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  approveScheduleItemAction,
  unapproveScheduleItemAction,
  rejectScheduleItemAction,
  retryFailedScheduleAction,
  deleteScheduleAction,
} from '@/lib/actions/schedules';
import { RegenerateItemModal } from './regenerate-item-modal';
import { EditItemModal } from './edit-item-modal';
import { ConvertToOrdersModal } from './convert-to-orders-modal';
import type {
  Schedule,
  ScheduleStatus,
  ScheduleItem,
  ScheduleItemStatus,
  ScheduleItemType,
} from '@/lib/types/database';

type OrgUser = { id: string; first_name: string; last_name: string };

type ScheduleWithRelations = Schedule & {
  subscription_period: {
    period_number: number;
    start_date: string;
    end_date: string;
    status: string;
    subscription: {
      id: string;
      name: string;
      billing_cycle: string;
      client: { id: string; name: string; legal_name: string | null } | null;
    } | null;
  } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
};

interface Props {
  schedule: ScheduleWithRelations;
  items: ScheduleItem[];
  workOrderItemIds: string[];
  orgUsers: OrgUser[];
  canManage: boolean;
  canRegenerateAI: boolean;
  canManageWorkOrders: boolean;
}

const ITEM_TYPE_META: Record<
  ScheduleItemType,
  { label: string; Icon: React.ElementType; color: string }
> = {
  post: { label: 'POST', Icon: FileText, color: 'text-blue-400' },
  reel: { label: 'REEL', Icon: Film, color: 'text-purple-400' },
  story: { label: 'STORY', Icon: Circle, color: 'text-pink-400' },
  carousel: { label: 'CARRUSEL', Icon: Images, color: 'text-photocan-amber' },
  video: { label: 'VIDEO', Icon: Video, color: 'text-red-400' },
  live: { label: 'LIVE', Icon: Radio, color: 'text-green-400' },
  other: { label: 'OTRO', Icon: Square, color: 'text-muted-foreground' },
};

export function ScheduleDetail({
  schedule,
  items,
  workOrderItemIds,
  orgUsers,
  canManage,
  canRegenerateAI,
  canManageWorkOrders,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [regenItem, setRegenItem] = useState<ScheduleItem | null>(null);
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null);
  const [rejectItem, setRejectItem] = useState<ScheduleItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewItem, setViewItem] = useState<ScheduleItem | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);

  // Conversión a OTs
  const woItemSet = new Set(workOrderItemIds);
  const approvedItems = items.filter((i) => i.status === 'approved');
  const availableForOT = approvedItems.filter((i) => !woItemSet.has(i.id));
  const showConvert =
    schedule.status === 'ready' &&
    approvedItems.length > 0 &&
    canManageWorkOrders;

  const isGenerating =
    schedule.status === 'pending' || schedule.status === 'generating';
  const isFailed = schedule.status === 'failed';

  // Polling cada 3s mientras está generándose
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [isGenerating, router]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      approved: items.filter((i) => i.status === 'approved').length,
      pending: items.filter((i) => i.status === 'draft').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
    };
  }, [items]);

  const sub = schedule.subscription_period?.subscription;
  const period = schedule.subscription_period;

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

  async function handleApprove(id: string) {
    setViewItem(null);
    await run(`approve-${id}`, () => approveScheduleItemAction(id));
  }

  async function handleUnapprove(id: string) {
    setViewItem(null);
    await run(`unapprove-${id}`, () => unapproveScheduleItemAction(id));
  }

  async function handleReject() {
    if (!rejectItem) return;
    if (rejectReason.trim().length < 5) {
      setError('Indica el motivo (mín. 5 caracteres)');
      return;
    }
    const ok = await run('reject', () =>
      rejectScheduleItemAction({
        item_id: rejectItem.id,
        reason: rejectReason.trim(),
      })
    );
    if (ok) {
      setRejectItem(null);
      setRejectReason('');
      setViewItem(null);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        '¿Borrar todo el cronograma? Se eliminarán todas las piezas. Esta acción no se puede deshacer.'
      )
    )
      return;
    const ok = await run('delete', () => deleteScheduleAction(schedule.id));
    if (ok && period && sub) {
      router.push(`/subscriptions/${sub.id}`);
    } else if (ok) {
      router.push('/schedules');
    }
  }

  function openRegen(item: ScheduleItem) {
    setViewItem(null);
    setRegenItem(item);
  }
  function openEdit(item: ScheduleItem) {
    setViewItem(null);
    setEditItem(item);
  }
  function openReject(item: ScheduleItem) {
    setViewItem(null);
    setError(null);
    setRejectReason('');
    setRejectItem(item);
  }

  const itemHandlers = {
    canManage,
    canRegenerateAI,
    actionLoading,
    onApprove: handleApprove,
    onUnapprove: handleUnapprove,
    onRegen: openRegen,
    onEdit: openEdit,
    onReject: openReject,
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <ScheduleStatusBadge status={schedule.status} />
              {period && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  P{period.period_number}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {sub?.name || 'Cronograma'}
              {period && (
                <span className="text-muted-foreground font-normal">
                  {' · '}P{period.period_number}
                </span>
              )}
            </h1>
            {sub?.client && (
              <div className="text-sm text-muted-foreground">
                Para:{' '}
                <span className="text-foreground font-medium">
                  {sub.client.name}
                </span>
              </div>
            )}
            {!isGenerating && stats.total > 0 && (
              <div className="text-xs text-muted-foreground font-mono mt-2">
                {stats.total} piezas · {stats.approved} aprobadas ·{' '}
                {stats.pending} pendientes
                {stats.rejected > 0 && ` · ${stats.rejected} rechazadas`}
              </div>
            )}
          </div>

          {/* Toggle de vista */}
          {!isGenerating && stats.total > 0 && (
            <div className="flex gap-1 border border-border rounded-md p-1 bg-card">
              <ViewToggle
                active={view === 'list'}
                onClick={() => setView('list')}
                icon={<List className="w-3.5 h-3.5" />}
                label="Lista"
              />
              <ViewToggle
                active={view === 'calendar'}
                onClick={() => setView('calendar')}
                icon={<CalendarDays className="w-3.5 h-3.5" />}
                label="Calendario"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mt-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Conversión a OTs */}
        {showConvert && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              onClick={() => setConvertOpen(true)}
              disabled={availableForOT.length === 0}
            >
              <ClipboardList className="w-4 h-4" />
              Convertir aprobadas en OTs
            </Button>
            <span className="text-xs font-mono text-muted-foreground">
              {approvedItems.length} aprobadas ·{' '}
              {approvedItems.length - availableForOT.length} ya tienen OT ·{' '}
              {availableForOT.length} disponibles
            </span>
          </div>
        )}
      </div>

      {/* Estado: generándose */}
      {isGenerating && (
        <div className="mb-6 border border-photocan-amber/30 bg-photocan-amber/5 rounded-lg p-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 text-photocan-amber animate-spin flex-shrink-0" />
          <div>
            <div className="font-medium">Generando cronograma…</div>
            <p className="text-sm text-muted-foreground">
              La IA está creando las piezas a partir de la estrategia del
              cliente. Esto puede tomar 1-2 minutos. La página se actualiza sola.
            </p>
          </div>
        </div>
      )}

      {/* Estado: fallido */}
      {isFailed && (
        <div className="mb-6 border border-destructive/30 bg-destructive/5 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium mb-1">La generación falló</div>
              {schedule.error_message && (
                <p className="text-xs text-muted-foreground mb-3 font-mono break-words">
                  {schedule.error_message}
                </p>
              )}
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run('retry', () => retryFailedScheduleAction(schedule.id))
                  }
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'retry' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="min-w-0">
          {!isGenerating && stats.total === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <div className="text-sm text-muted-foreground">
                Este cronograma no tiene piezas.
              </div>
            </div>
          ) : !isGenerating && view === 'list' ? (
            <ListView
              items={items}
              expandedId={expandedId}
              onToggle={(id) =>
                setExpandedId((cur) => (cur === id ? null : id))
              }
              handlers={itemHandlers}
            />
          ) : !isGenerating ? (
            <CalendarView
              items={items}
              startDate={schedule.start_date}
              onChipClick={(item) => setViewItem(item)}
            />
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Información
            </div>

            {sub?.client && (
              <Link href={`/clients/${sub.client.id}`} className="block group">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  Cliente
                </div>
                <div className="text-sm font-medium group-hover:text-photocan-amber transition-colors">
                  {sub.client.name}
                </div>
                {sub.client.legal_name && (
                  <div className="text-xs text-muted-foreground truncate">
                    {sub.client.legal_name}
                  </div>
                )}
              </Link>
            )}

            {sub && (
              <Link
                href={`/subscriptions/${sub.id}`}
                className="block group pt-3 border-t border-border"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Repeat className="w-3.5 h-3.5" />
                  Suscripción
                </div>
                <div className="text-sm font-medium group-hover:text-photocan-amber transition-colors">
                  {sub.name}
                </div>
              </Link>
            )}

            {period && (
              <div className="pt-3 border-t border-border">
                <SidebarRow
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Período"
                  value={`P${period.period_number} · ${formatDate(
                    period.start_date
                  )} - ${formatDate(period.end_date)}`}
                />
                <div className="mt-2 flex items-center gap-2">
                  <PeriodStatusBadge status={period.status} />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
              <SidebarRow
                icon={<CalendarDays className="w-3.5 h-3.5" />}
                label="Días planeados"
                value={String(schedule.days_planned)}
              />
              <SidebarRow
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Fecha inicio"
                value={formatDate(schedule.start_date)}
              />
            </div>
          </div>

          {/* Generación IA */}
          {schedule.generated_at && (
            <div className="border border-border rounded-lg bg-card p-4 space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-photocan-amber flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Generación IA
              </div>
              <SidebarRow
                icon={<Sparkles className="w-3.5 h-3.5" />}
                label="Modelo"
                value={schedule.ai_model_used || '—'}
              />
              <div className="grid grid-cols-2 gap-3">
                <SidebarRow
                  icon={<ChevronDown className="w-3.5 h-3.5" />}
                  label="Tokens in"
                  value={
                    schedule.generation_tokens_input?.toLocaleString('es-MX') ||
                    '—'
                  }
                />
                <SidebarRow
                  icon={<ChevronUp className="w-3.5 h-3.5" />}
                  label="Tokens out"
                  value={
                    schedule.generation_tokens_output?.toLocaleString(
                      'es-MX'
                    ) || '—'
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SidebarRow
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Duración"
                  value={
                    schedule.generation_duration_ms
                      ? `${(schedule.generation_duration_ms / 1000).toFixed(1)}s`
                      : '—'
                  }
                />
                <SidebarRow
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Generado"
                  value={relativeTime(schedule.generated_at)}
                />
              </div>
            </div>
          )}

          {canManage && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={!!actionLoading}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              {actionLoading === 'delete' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Borrar cronograma completo
            </Button>
          )}
        </div>
      </div>

      {/* Modal: regenerar */}
      {regenItem && (
        <RegenerateItemModal
          item={regenItem}
          onClose={() => setRegenItem(null)}
          onSuccess={() => setRegenItem(null)}
        />
      )}

      {/* Modal: editar */}
      {editItem && (
        <EditItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => setEditItem(null)}
        />
      )}

      {/* Modal: rechazar */}
      {rejectItem && (
        <Modal title="Rechazar pieza" onClose={() => setRejectItem(null)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Indica por qué rechazas esta pieza. Quedará marcada como rechazada.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reject_reason">Motivo</Label>
              <textarea
                id="reject_reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={actionLoading === 'reject'}
                rows={3}
                maxLength={500}
                placeholder="Ej: no encaja con la campaña de este mes"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-5">
            <Button
              variant="outline"
              onClick={() => setRejectItem(null)}
              disabled={actionLoading === 'reject'}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading === 'reject'}
              className="flex-1"
            >
              {actionLoading === 'reject' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Confirmar rechazo'
              )}
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal: convertir a OTs */}
      {convertOpen && (
        <ConvertToOrdersModal
          scheduleId={schedule.id}
          itemIds={availableForOT.map((i) => i.id)}
          users={orgUsers}
          onClose={() => setConvertOpen(false)}
        />
      )}

      {/* Modal: ver pieza (desde calendario) */}
      {viewItem && (
        <Modal
          title={viewItem.title}
          onClose={() => setViewItem(null)}
          wide
        >
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <ItemTypeBadge type={viewItem.item_type} />
            <span className="text-xs font-mono text-muted-foreground">
              {formatDateLong(viewItem.scheduled_date)}
              {viewItem.scheduled_time ? ` · ${viewItem.scheduled_time}` : ''}
            </span>
            <ItemStatusBadge status={viewItem.status} />
          </div>
          <ItemDetails item={viewItem} />
          <div className="pt-4">
            <ItemActions item={viewItem} handlers={itemHandlers} />
          </div>
        </Modal>
      )}
    </>
  );
}

// ============================================================
// VISTA LISTA
// ============================================================

type ItemHandlers = {
  canManage: boolean;
  canRegenerateAI: boolean;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onUnapprove: (id: string) => void;
  onRegen: (item: ScheduleItem) => void;
  onEdit: (item: ScheduleItem) => void;
  onReject: (item: ScheduleItem) => void;
};

function ListView({
  items,
  expandedId,
  onToggle,
  handlers,
}: {
  items: ScheduleItem[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  handlers: ItemHandlers;
}) {
  const groups = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date)
        return a.scheduled_date < b.scheduled_date ? -1 : 1;
      const at = a.scheduled_time ?? '99:99';
      const bt = b.scheduled_time ?? '99:99';
      if (at !== bt) return at < bt ? -1 : 1;
      return a.position - b.position;
    });

    const map = new Map<string, ScheduleItem[]>();
    for (const item of sorted) {
      if (!map.has(item.scheduled_date)) map.set(item.scheduled_date, []);
      map.get(item.scheduled_date)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-6">
      {groups.map(([date, dayItems]) => (
        <div key={date}>
          <div className="flex items-center justify-between border border-border rounded-md bg-secondary/40 px-4 py-2 mb-2">
            <div className="text-sm font-medium capitalize">
              {formatDateLong(date)}
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {dayItems.length} {dayItems.length === 1 ? 'pieza' : 'piezas'}
            </div>
          </div>
          <div className="space-y-2">
            {dayItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => onToggle(item.id)}
                handlers={handlers}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemCard({
  item,
  expanded,
  onToggle,
  handlers,
}: {
  item: ScheduleItem;
  expanded: boolean;
  onToggle: () => void;
  handlers: ItemHandlers;
}) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden transition-colors hover:border-photocan-amber/40">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          <span className="text-xs font-mono text-muted-foreground w-12">
            {item.scheduled_time || '--:--'}
          </span>
          <ItemTypeBadge type={item.item_type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.title}</div>
          <div className="text-xs text-muted-foreground truncate">
            {item.pillar_name}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ItemStatusBadge status={item.status} />
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4">
          <ItemDetails item={item} />
          <div className="pt-4">
            <ItemActions item={item} handlers={handlers} />
          </div>
        </div>
      )}
    </div>
  );
}

function ItemDetails({ item }: { item: ScheduleItem }) {
  return (
    <div className="space-y-3 text-sm">
      {item.hook && <DetailBlock label="Gancho" value={item.hook} />}
      {item.body_copy_suggestion && (
        <DetailBlock label="Copy sugerido" value={item.body_copy_suggestion} />
      )}
      {item.cta && <DetailBlock label="Llamado a la acción" value={item.cta} />}
      {item.format_notes && (
        <DetailBlock label="Notas de producción" value={item.format_notes} mono />
      )}
      {item.hashtags_suggested && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Hashtags
          </div>
          <div className="font-mono text-xs text-photocan-amber break-words">
            {item.hashtags_suggested}
          </div>
        </div>
      )}
      {item.key_message && (
        <DetailBlock label="Mensaje clave" value={item.key_message} />
      )}

      {item.status === 'rejected' && item.rejection_reason && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-destructive mb-0.5">
            Motivo del rechazo
          </div>
          <div className="text-sm">{item.rejection_reason}</div>
        </div>
      )}

      {item.regenerated_count > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          Regenerada {item.regenerated_count}{' '}
          {item.regenerated_count === 1 ? 'vez' : 'veces'}
          {item.last_regenerated_at &&
            ` · ${relativeTime(item.last_regenerated_at)}`}
        </div>
      )}
    </div>
  );
}

function DetailBlock({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div
        className={`${
          mono ? 'font-mono text-xs' : 'text-sm'
        } text-foreground/90 whitespace-pre-wrap break-words`}
      >
        {value}
      </div>
    </div>
  );
}

function ItemActions({
  item,
  handlers,
}: {
  item: ScheduleItem;
  handlers: ItemHandlers;
}) {
  const {
    canManage,
    canRegenerateAI,
    actionLoading,
    onApprove,
    onUnapprove,
    onRegen,
    onEdit,
    onReject,
  } = handlers;

  if (item.status === 'rejected') {
    return (
      <div className="text-xs text-muted-foreground font-mono">
        Pieza rechazada · solo lectura
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.status === 'draft' && canManage && (
        <>
          <Button
            size="sm"
            onClick={() => onApprove(item.id)}
            disabled={!!actionLoading}
          >
            {actionLoading === `approve-${item.id}` ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Aprobar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(item)}
            disabled={!!actionLoading}
          >
            <Edit2 className="w-3.5 h-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(item)}
            disabled={!!actionLoading}
          >
            <XCircle className="w-3.5 h-3.5" />
            Rechazar
          </Button>
        </>
      )}

      {item.status === 'draft' && canRegenerateAI && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRegen(item)}
          disabled={!!actionLoading}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Regenerar con IA
        </Button>
      )}

      {item.status === 'approved' && canManage && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onUnapprove(item.id)}
          disabled={!!actionLoading}
        >
          {actionLoading === `unapprove-${item.id}` ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          Desaprobar
        </Button>
      )}
    </div>
  );
}

// ============================================================
// VISTA CALENDARIO
// ============================================================

function CalendarView({
  items,
  startDate,
  onChipClick,
}: {
  items: ScheduleItem[];
  startDate: string;
  onChipClick: (item: ScheduleItem) => void;
}) {
  const [year, month] = startDate.split('-').map(Number);
  const [cur, setCur] = useState({ y: year, m: month - 1 }); // m: 0-based

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      if (!map.has(item.scheduled_date)) map.set(item.scheduled_date, []);
      map.get(item.scheduled_date)!.push(item);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));
    }
    return map;
  }, [items]);

  const firstDay = new Date(cur.y, cur.m, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Date(cur.y, cur.m, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });

  function pad(n: number) {
    return String(n).padStart(2, '0');
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() =>
            setCur((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))
          }
          className="w-8 h-8 grid place-items-center rounded-md border border-border hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-medium capitalize">{monthLabel}</div>
        <button
          onClick={() =>
            setCur((c) =>
              c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }
            )
          }
          className="w-8 h-8 grid place-items-center rounded-md border border-border hover:bg-secondary transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-mono uppercase tracking-wider text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null)
                return <div key={`empty-${idx}`} className="min-h-[88px]" />;
              const dateStr = `${cur.y}-${pad(cur.m + 1)}-${pad(day)}`;
              const dayItems = itemsByDate.get(dateStr) || [];
              return (
                <div
                  key={dateStr}
                  className="min-h-[88px] rounded-md border border-border bg-background/50 p-1.5"
                >
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayItems.map((item) => {
                      const meta = ITEM_TYPE_META[item.item_type];
                      const Icon = meta.Icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => onChipClick(item)}
                          title={`${item.scheduled_time || ''} ${item.title}`}
                          className="w-full flex items-center gap-1 px-1.5 py-1 rounded bg-secondary/60 hover:bg-secondary text-left transition-colors"
                        >
                          <Icon className={`w-3 h-3 flex-shrink-0 ${meta.color}`} />
                          <span className="text-[10px] truncate">
                            {item.scheduled_time
                              ? `${item.scheduled_time} `
                              : ''}
                            {item.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Modal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full ${
          wide ? 'max-w-lg' : 'max-w-md'
        } max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl`}
      >
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background">
          <h3 className="text-lg font-semibold pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </>
  );
}

function ItemTypeBadge({ type }: { type: ScheduleItemType }) {
  const meta = ITEM_TYPE_META[type];
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary ${meta.color}`}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function ItemStatusBadge({ status }: { status: ScheduleItemStatus }) {
  const config: Record<
    ScheduleItemStatus,
    { label: string; Icon: React.ElementType; bg: string }
  > = {
    draft: {
      label: 'Borrador',
      Icon: FileText,
      bg: 'bg-secondary text-muted-foreground',
    },
    approved: {
      label: 'Aprobada',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    rejected: {
      label: 'Rechazada',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
  };
  const { label, Icon, bg } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const config: Record<
    ScheduleStatus,
    { label: string; Icon: React.ElementType; bg: string }
  > = {
    pending: {
      label: 'Pendiente',
      Icon: Clock,
      bg: 'bg-secondary text-muted-foreground',
    },
    generating: {
      label: 'Generando...',
      Icon: Loader2,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    ready: {
      label: 'Listo',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    partial: {
      label: 'Parcial',
      Icon: AlertCircle,
      bg: 'bg-yellow-500/10 text-yellow-500',
    },
    failed: {
      label: 'Fallido',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
  };
  const { label, Icon, bg } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded ${bg}`}
    >
      <Icon className={`w-3 h-3 ${status === 'generating' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

function PeriodStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string }> = {
    active: { label: 'Activo', bg: 'bg-green-500/10 text-green-500' },
    completed: {
      label: 'Completado',
      bg: 'bg-secondary text-muted-foreground',
    },
    skipped: { label: 'Omitido', bg: 'bg-destructive/10 text-destructive' },
  };
  const { label, bg } = config[status] ?? {
    label: status,
    bg: 'bg-secondary text-muted-foreground',
  };
  return (
    <span
      className={`inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${bg}`}
    >
      {label}
    </span>
  );
}

function SidebarRow({
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

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateLong(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function relativeTime(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `hace ${diffD} ${diffD === 1 ? 'día' : 'días'}`;
  return new Date(date).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
