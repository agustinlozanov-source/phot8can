'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Eye,
  CheckCircle2,
  Send,
  Ban,
  RotateCcw,
  Hammer,
  Calendar,
  Clock,
  Briefcase,
  ExternalLink,
  Trash2,
  Save,
  SkipForward,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  transitionWorkOrderStatusAction,
  cancelWorkOrderAction,
  updateWorkOrderAction,
  deleteWorkOrderAction,
} from '@/lib/actions/work-orders';
import {
  updateTaskStatusAction,
  updateTaskAssignmentAction,
  updateTaskNotesAction,
  updateTaskHoursAction,
  setTaskBlockedAction,
  unblockTaskAction,
} from '@/lib/actions/work-order-tasks';
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderTask,
  WorkOrderBriefSnapshot,
} from '@/lib/types/database';
import {
  WorkOrderStatusBadge,
  TaskStatusBadge,
  ItemTypeBadge,
  StageTypeBadge,
  UserChip,
  deadlineInfo,
  DEADLINE_TONE_CLASS,
  formatDate,
  formatDateTime,
} from '../wo-ui';

type OrgUser = { id: string; first_name: string; last_name: string };

type TaskWithUser = WorkOrderTask & {
  assigned_to: OrgUser | null;
};

type WorkOrderWithRelations = WorkOrder & {
  client: { id: string; name: string; legal_name: string | null } | null;
  source_schedule_item: {
    id: string;
    title: string;
    item_type: string;
    pillar_name: string | null;
    schedule_id: string;
  } | null;
  owner: OrgUser | null;
  creator: OrgUser | null;
  tasks: TaskWithUser[];
};

interface Props {
  workOrder: WorkOrderWithRelations;
  users: OrgUser[];
  currentUserId: string | null;
  canManage: boolean;
  canCancel: boolean;
  canExecute: boolean;
}

const WO_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  pending: ['in_production'],
  in_production: ['review', 'ready'],
  review: ['in_production', 'ready'],
  ready: ['published'],
  published: ['ready'],
  cancelled: [],
};

const TRANSITION_LABEL: Record<string, { label: string; Icon: React.ElementType }> = {
  in_production: { label: 'Iniciar producción', Icon: Play },
  review: { label: 'Enviar a revisión', Icon: Eye },
  ready: { label: 'Marcar como lista', Icon: CheckCircle2 },
  published: { label: 'Marcar como publicada', Icon: Send },
};

export function WorkOrderDetail({
  workOrder,
  users,
  currentUserId,
  canManage,
  canCancel,
  canExecute,
}: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const brief = workOrder.brief_snapshot as unknown as WorkOrderBriefSnapshot;
  const tasks = [...workOrder.tasks].sort((a, b) => a.position - b.position);
  const dl = deadlineInfo(workOrder.deadline);
  const showDeadline = !['published', 'cancelled'].includes(workOrder.status);

  const taskStats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
  };

  const nextStatuses = WO_TRANSITIONS[workOrder.status];
  const canCancelNow =
    canCancel &&
    !['published', 'cancelled'].includes(workOrder.status);

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

  async function handleTransition(next: WorkOrderStatus) {
    if (next === 'published' && !confirm('¿Marcar esta OT como publicada?'))
      return;
    await run(`wo-${next}`, () =>
      transitionWorkOrderStatusAction({ id: workOrder.id, new_status: next })
    );
  }

  async function handleCancel() {
    if (cancelReason.trim().length < 5) {
      setError('Indica el motivo (mín. 5 caracteres)');
      return;
    }
    const ok = await run('cancel', () =>
      cancelWorkOrderAction({ id: workOrder.id, reason: cancelReason.trim() })
    );
    if (ok) {
      setCancelOpen(false);
      setCancelReason('');
    }
  }

  async function handleDelete() {
    if (!confirm('¿Borrar esta OT y todas sus tareas? No se puede deshacer.'))
      return;
    const ok = await run('delete', () => deleteWorkOrderAction(workOrder.id));
    if (ok) router.push('/work-orders');
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-sm font-medium">
                {workOrder.folio}
              </span>
              <WorkOrderStatusBadge status={workOrder.status} />
              {workOrder.source_schedule_item && (
                <ItemTypeBadge type={workOrder.source_schedule_item.item_type} />
              )}
              {brief?.pillar_name && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  {brief.pillar_name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {workOrder.title}
            </h1>
            <div className="text-xs text-muted-foreground font-mono">
              {taskStats.total} tareas · {taskStats.done} done
              {taskStats.blocked > 0 && ` · ${taskStats.blocked} bloqueadas`}
            </div>
          </div>

          {/* Acciones de estado */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {canManage &&
              nextStatuses.map((next) => {
                const meta = TRANSITION_LABEL[next];
                if (!meta) return null;
                const Icon = meta.Icon;
                return (
                  <Button
                    key={next}
                    size="sm"
                    variant={next === 'published' ? 'default' : 'outline'}
                    onClick={() => handleTransition(next)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === `wo-${next}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    {meta.label}
                  </Button>
                );
              })}
            {canCancelNow && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setCancelReason('');
                  setCancelOpen(true);
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

        {workOrder.status === 'cancelled' && workOrder.cancellation_reason && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm mt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-destructive mb-1">
              OT cancelada
            </div>
            <div>{workOrder.cancellation_reason}</div>
          </div>
        )}

        {showDeadline && (
          <div
            className={`mt-3 inline-flex items-center gap-2 text-sm font-mono ${DEADLINE_TONE_CLASS[dl.tone]}`}
          >
            <Clock className="w-4 h-4" />
            Deadline: {formatDate(workOrder.deadline)} · {dl.label}
          </div>
        )}
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="min-w-0 space-y-6">
          {/* Brief */}
          <section className="border border-border rounded-lg bg-card">
            <button
              onClick={() => setBriefOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3"
            >
              <div className="flex items-center gap-2">
                <Hammer className="w-4 h-4 text-photocan-amber" />
                <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
                  Brief de la pieza
                </h2>
              </div>
              {briefOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {briefOpen && (
              <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
                {brief?.hook && <BriefBlock label="Gancho" value={brief.hook} />}
                {brief?.body_copy_suggestion && (
                  <BriefBlock label="Copy sugerido" value={brief.body_copy_suggestion} />
                )}
                {brief?.cta && <BriefBlock label="Llamado a la acción" value={brief.cta} />}
                {brief?.format_notes && (
                  <BriefBlock label="Notas de producción" value={brief.format_notes} mono />
                )}
                {brief?.hashtags_suggested && (
                  <div>
                    <BlockLabel>Hashtags</BlockLabel>
                    <div className="font-mono text-xs text-photocan-amber break-words">
                      {brief.hashtags_suggested}
                    </div>
                  </div>
                )}
                {brief?.key_message && (
                  <BriefBlock label="Mensaje clave" value={brief.key_message} />
                )}

                {workOrder.source_schedule_item && (
                  <Link
                    href={`/schedules/${workOrder.source_schedule_item.schedule_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-photocan-amber-deep hover:underline pt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver pieza original en cronograma
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Tareas */}
          <section>
            <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-photocan-amber" />
              Tareas ({tasks.length})
            </h2>
            {tasks.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
                Esta OT no tiene tareas.
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    users={users}
                    canManage={canManage}
                    canActOwn={
                      canExecute &&
                      !!currentUserId &&
                      task.assigned_to_user_id === currentUserId
                    }
                    actionLoading={actionLoading}
                    onError={setError}
                    run={run}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Información
            </div>

            {workOrder.client && (
              <Link href={`/clients/${workOrder.client.id}`} className="block group">
                <SbLabel icon={<Briefcase className="w-3.5 h-3.5" />}>Cliente</SbLabel>
                <div className="text-sm font-medium group-hover:text-photocan-amber transition-colors">
                  {workOrder.client.name}
                </div>
              </Link>
            )}

            {workOrder.source_schedule_item && (
              <div className="pt-3 border-t border-border">
                <SbLabel icon={<Link2 className="w-3.5 h-3.5" />}>Origen</SbLabel>
                <Link
                  href={`/schedules/${workOrder.source_schedule_item.schedule_id}`}
                  className="text-sm font-medium hover:text-photocan-amber transition-colors"
                >
                  Cronograma de origen
                </Link>
              </div>
            )}

            {/* Owner */}
            <div className="pt-3 border-t border-border">
              <SbLabel icon={<Briefcase className="w-3.5 h-3.5" />}>Owner</SbLabel>
              {canManage ? (
                <UserSelect
                  value={workOrder.owner_user_id}
                  users={users}
                  disabled={!!actionLoading}
                  onChange={(uid) =>
                    run('owner', () =>
                      updateWorkOrderAction({
                        id: workOrder.id,
                        owner_user_id: uid,
                      })
                    )
                  }
                />
              ) : (
                <div className="text-sm font-medium">
                  <UserChip user={workOrder.owner} />
                </div>
              )}
            </div>

            {/* Publicación */}
            <div className="pt-3 border-t border-border">
              <SbLabel icon={<Calendar className="w-3.5 h-3.5" />}>
                Publicación programada
              </SbLabel>
              <div className="text-sm font-medium">
                {formatDate(workOrder.scheduled_publish_date)}
                {workOrder.scheduled_publish_time
                  ? ` · ${workOrder.scheduled_publish_time}`
                  : ''}
              </div>
            </div>

            {/* Deadline editable */}
            <div className="pt-3 border-t border-border">
              <SbLabel icon={<Clock className="w-3.5 h-3.5" />}>Deadline</SbLabel>
              {canManage ? (
                <DateEditor
                  value={workOrder.deadline}
                  disabled={!!actionLoading}
                  onSave={(d) =>
                    run('deadline', () =>
                      updateWorkOrderAction({ id: workOrder.id, deadline: d })
                    )
                  }
                />
              ) : (
                <div className="text-sm font-medium">
                  {formatDate(workOrder.deadline)}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border">
              <SbLabel icon={<Calendar className="w-3.5 h-3.5" />}>Creada</SbLabel>
              <div className="text-sm font-medium">
                {formatDateTime(workOrder.created_at)}
              </div>
              {workOrder.creator && (
                <div className="text-xs text-muted-foreground">
                  por {workOrder.creator.first_name} {workOrder.creator.last_name}
                </div>
              )}
            </div>
          </div>

          {/* Notas del Director */}
          <div className="border border-border rounded-lg bg-card p-4">
            <SbLabel>Notas del Director</SbLabel>
            {canManage ? (
              <NotesEditor
                value={workOrder.notes ?? ''}
                disabled={!!actionLoading}
                onSave={(n) =>
                  run('notes', () =>
                    updateWorkOrderAction({ id: workOrder.id, notes: n || null })
                  )
                }
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap">
                {workOrder.notes || (
                  <span className="text-muted-foreground italic">Sin notas</span>
                )}
              </div>
            )}
          </div>

          {canManage && workOrder.status === 'cancelled' && (
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
              Borrar OT
            </Button>
          )}
        </div>
      </div>

      {/* Modal cancelar */}
      {cancelOpen && (
        <Modal title="Cancelar OT" onClose={() => setCancelOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La OT quedará cancelada. Indica el motivo.
            </p>
            <div className="space-y-2">
              <Label htmlFor="cancel_reason">Motivo</Label>
              <textarea
                id="cancel_reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={actionLoading === 'cancel'}
                rows={3}
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
              onClick={() => setCancelOpen(false)}
              disabled={actionLoading === 'cancel'}
              className="flex-1"
            >
              Volver
            </Button>
            <Button
              onClick={handleCancel}
              disabled={actionLoading === 'cancel'}
              className="flex-1"
            >
              {actionLoading === 'cancel' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Confirmar cancelación'
              )}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ============================================================
// TARJETA DE TAREA
// ============================================================

function TaskCard({
  task,
  users,
  canManage,
  canActOwn,
  actionLoading,
  onError,
  run,
}: {
  task: TaskWithUser;
  users: OrgUser[];
  canManage: boolean;
  canActOwn: boolean;
  actionLoading: string | null;
  onError: (m: string | null) => void;
  run: (key: string, fn: () => Promise<{ error?: string }>) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [hours, setHours] = useState(
    task.actual_hours != null ? String(task.actual_hours) : ''
  );
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const canAct = canManage || canActOwn;
  const k = (s: string) => `task-${task.id}-${s}`;

  async function saveNotes() {
    await run(k('notes'), () =>
      updateTaskNotesAction({ task_id: task.id, notes: notes.trim() || null })
    );
  }

  async function saveHours() {
    const h = parseFloat(hours);
    if (Number.isNaN(h) || h < 0) {
      onError('Horas inválidas');
      return;
    }
    await run(k('hours'), () =>
      updateTaskHoursAction({ task_id: task.id, actual_hours: h })
    );
  }

  async function handleBlock() {
    if (blockReason.trim().length < 5) {
      onError('Indica el motivo del bloqueo (mín. 5 caracteres)');
      return;
    }
    const ok = await run(k('block'), () =>
      setTaskBlockedAction({
        task_id: task.id,
        blocked_reason: blockReason.trim(),
      })
    );
    if (ok) {
      setBlockOpen(false);
      setBlockReason('');
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium">{task.stage_name}</span>
              <StageTypeBadge type={task.stage_type} />
              <TaskStatusBadge status={task.status} />
              {task.depends_on_task_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                  <Link2 className="w-3 h-3" />
                  depende de otra tarea
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <UserChip user={task.assigned_to} />
              {(task.estimated_hours != null || task.actual_hours != null) && (
                <span className="font-mono">
                  {task.actual_hours ?? '—'}h / {task.estimated_hours ?? '—'}h
                </span>
              )}
            </div>
            {task.status === 'blocked' && task.blocked_reason && (
              <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-2.5 py-1.5 text-xs text-destructive">
                <span className="font-mono uppercase text-[9px] tracking-wider">
                  Bloqueada:
                </span>{' '}
                {task.blocked_reason}
              </div>
            )}
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Acciones rápidas de estado */}
        {canAct && task.status !== 'skipped' && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {task.status === 'pending' && (
              <TaskBtn
                loading={actionLoading === k('start')}
                onClick={() =>
                  run(k('start'), () =>
                    updateTaskStatusAction({
                      task_id: task.id,
                      new_status: 'in_progress',
                    })
                  )
                }
                Icon={Play}
                label="Iniciar"
              />
            )}
            {task.status === 'in_progress' && (
              <>
                <TaskBtn
                  loading={actionLoading === k('done')}
                  onClick={() =>
                    run(k('done'), () =>
                      updateTaskStatusAction({
                        task_id: task.id,
                        new_status: 'done',
                      })
                    )
                  }
                  Icon={CheckCircle2}
                  label="Marcar lista"
                />
                <TaskBtn
                  onClick={() => {
                    onError(null);
                    setBlockReason('');
                    setBlockOpen(true);
                  }}
                  Icon={Ban}
                  label="Bloquear"
                />
              </>
            )}
            {task.status === 'blocked' && (
              <TaskBtn
                loading={actionLoading === k('unblock')}
                onClick={() => run(k('unblock'), () => unblockTaskAction(task.id))}
                Icon={RotateCcw}
                label="Desbloquear"
              />
            )}
            {task.status === 'done' && (
              <TaskBtn
                loading={actionLoading === k('reopen')}
                onClick={() =>
                  run(k('reopen'), () =>
                    updateTaskStatusAction({
                      task_id: task.id,
                      new_status: 'in_progress',
                    })
                  )
                }
                Icon={RotateCcw}
                label="Reabrir"
              />
            )}
            {canManage && (
              <TaskBtn
                loading={actionLoading === k('skip')}
                onClick={() =>
                  run(k('skip'), () =>
                    updateTaskStatusAction({
                      task_id: task.id,
                      new_status: 'skipped',
                    })
                  )
                }
                Icon={SkipForward}
                label="Omitir"
              />
            )}
          </div>
        )}
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
          {canManage && (
            <div className="space-y-1.5">
              <Label className="text-xs">Asignar a</Label>
              <UserSelect
                value={task.assigned_to_user_id}
                users={users}
                disabled={!!actionLoading}
                onChange={(uid) =>
                  run(k('assign'), () =>
                    updateTaskAssignmentAction({
                      task_id: task.id,
                      assigned_to_user_id: uid,
                    })
                  )
                }
              />
            </div>
          )}

          {canAct && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Notas</Label>
                <div className="flex gap-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!!actionLoading}
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveNotes}
                  disabled={!!actionLoading || notes === (task.notes ?? '')}
                >
                  {actionLoading === k('notes') ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Guardar notas
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Horas reales</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    disabled={!!actionLoading}
                    className="w-28"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveHours}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === k('hours') ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Guardar'
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {!canAct && (
            <div className="text-xs text-muted-foreground">
              {task.notes || 'Sin notas.'}
            </div>
          )}
        </div>
      )}

      {/* Modal bloquear */}
      {blockOpen && (
        <Modal title="Reportar bloqueo" onClose={() => setBlockOpen(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`block-${task.id}`}>¿Qué está bloqueando?</Label>
              <textarea
                id={`block-${task.id}`}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                disabled={actionLoading === k('block')}
                rows={3}
                placeholder="Ej: falta material gráfico del cliente"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-5">
            <Button
              variant="outline"
              onClick={() => setBlockOpen(false)}
              disabled={actionLoading === k('block')}
              className="flex-1"
            >
              Volver
            </Button>
            <Button
              onClick={handleBlock}
              disabled={actionLoading === k('block')}
              className="flex-1"
            >
              {actionLoading === k('block') ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Reportar bloqueo'
              )}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// AUXILIARES
// ============================================================

function TaskBtn({
  onClick,
  Icon,
  label,
  loading,
}: {
  onClick: () => void;
  Icon: React.ElementType;
  label: string;
  loading?: boolean;
}) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={loading}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </Button>
  );
}

function UserSelect({
  value,
  users,
  disabled,
  onChange,
}: {
  value: string | null;
  users: OrgUser[];
  disabled?: boolean;
  onChange: (uid: string | null) => void;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
    >
      <option value="">Sin asignar</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.first_name} {u.last_name}
        </option>
      ))}
    </select>
  );
}

function DateEditor({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled?: boolean;
  onSave: (d: string) => void;
}) {
  const [date, setDate] = useState(value);
  return (
    <div className="flex gap-2 items-center">
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={disabled}
        className="h-9"
      />
      {date !== value && (
        <Button size="sm" variant="outline" onClick={() => onSave(date)} disabled={disabled}>
          <Save className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

function NotesEditor({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled?: boolean;
  onSave: (n: string) => void;
}) {
  const [notes, setNotes] = useState(value);
  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={disabled}
        rows={3}
        placeholder="Agrega notas para el equipo..."
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
      />
      {notes !== value && (
        <Button size="sm" variant="outline" onClick={() => onSave(notes)} disabled={disabled}>
          <Save className="w-3.5 h-3.5" />
          Guardar
        </Button>
      )}
    </div>
  );
}

function BriefBlock({
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
      <BlockLabel>{label}</BlockLabel>
      <div
        className={`${mono ? 'font-mono text-xs' : 'text-sm'} text-foreground/90 whitespace-pre-wrap break-words`}
      >
        {value}
      </div>
    </div>
  );
}

function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}

function SbLabel({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
      {icon}
      {children}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </>
  );
}
