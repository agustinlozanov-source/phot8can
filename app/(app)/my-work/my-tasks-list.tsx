'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Play,
  CheckCircle2,
  Ban,
  RotateCcw,
  Loader2,
  AlertCircle,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updateTaskStatusAction,
  setTaskBlockedAction,
  unblockTaskAction,
  updateTaskNotesAction,
  updateTaskHoursAction,
} from '@/lib/actions/work-order-tasks';
import type { WorkOrderTask, WorkOrderTaskStatus } from '@/lib/types/database';
import {
  TaskStatusBadge,
  StageTypeBadge,
  deadlineInfo,
  DEADLINE_TONE_CLASS,
} from '../work-orders/wo-ui';

type TaskRow = WorkOrderTask & {
  work_order: {
    id: string;
    folio: string;
    title: string;
    deadline: string;
    status: string;
    client: { id: string; name: string } | null;
  } | null;
};

type FilterKey = 'active' | 'pending' | 'in_progress' | 'blocked' | 'done_week';

export function MyTasksList({
  tasks,
  weekStart,
}: {
  tasks: TaskRow[];
  weekStart: number;
}) {
  const [filter, setFilter] = useState<FilterKey>('active');
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const doneWeek = tasks.filter(
      (t) =>
        t.status === 'done' &&
        t.completed_at &&
        new Date(t.completed_at).getTime() >= weekStart
    ).length;
    return {
      active: tasks.filter((t) =>
        ['pending', 'in_progress', 'blocked'].includes(t.status)
      ).length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
      done_week: doneWeek,
    };
  }, [tasks, weekStart]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'active':
        return tasks.filter((t) =>
          ['pending', 'in_progress', 'blocked'].includes(t.status)
        );
      case 'pending':
        return tasks.filter((t) => t.status === 'pending');
      case 'in_progress':
        return tasks.filter((t) => t.status === 'in_progress');
      case 'blocked':
        return tasks.filter((t) => t.status === 'blocked');
      case 'done_week':
        return tasks.filter(
          (t) =>
            t.status === 'done' &&
            t.completed_at &&
            new Date(t.completed_at).getTime() >= weekStart
        );
    }
  }, [tasks, filter, weekStart]);

  return (
    <div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto mb-4 w-fit max-w-full">
        <Tab label="Todas activas" count={counts.active} active={filter === 'active'} onClick={() => setFilter('active')} />
        <Tab label="Pendientes" count={counts.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} />
        <Tab label="En curso" count={counts.in_progress} active={filter === 'in_progress'} onClick={() => setFilter('in_progress')} />
        <Tab label="Bloqueadas" count={counts.blocked} active={filter === 'blocked'} onClick={() => setFilter('blocked')} />
        <Tab label="Listas (semana)" count={counts.done_week} active={filter === 'done_week'} onClick={() => setFilter('done_week')} />
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="text-sm text-muted-foreground">
            No tienes tareas en este filtro.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onError={setError} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onError,
}: {
  task: TaskRow;
  onError: (m: string | null) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [notes, setNotes] = useState(task.notes ?? '');
  const [hours, setHours] = useState(
    task.actual_hours != null ? String(task.actual_hours) : ''
  );

  const wo = task.work_order;
  const dl = wo ? deadlineInfo(wo.deadline) : null;

  async function run(key: string, fn: () => Promise<{ error?: string }>) {
    onError(null);
    setLoading(key);
    const result = await fn();
    setLoading(null);
    if (result?.error) {
      onError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleBlock() {
    if (blockReason.trim().length < 5) {
      onError('Indica el motivo del bloqueo (mín. 5 caracteres)');
      return;
    }
    const ok = await run('block', () =>
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

  async function saveNotes() {
    await run('notes', () =>
      updateTaskNotesAction({ task_id: task.id, notes: notes.trim() || null })
    );
  }

  async function saveHours() {
    const h = parseFloat(hours);
    if (Number.isNaN(h) || h < 0) {
      onError('Horas inválidas');
      return;
    }
    await run('hours', () =>
      updateTaskHoursAction({ task_id: task.id, actual_hours: h })
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium">{task.stage_name}</span>
              <StageTypeBadge type={task.stage_type} />
              <TaskStatusBadge status={task.status} />
            </div>
            {wo && (
              <div className="text-xs text-muted-foreground">
                <Link
                  href={`/work-orders/${wo.id}`}
                  className="font-mono hover:text-photocan-amber transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {wo.folio}
                </Link>{' '}
                · {wo.title}
                {wo.client && ` · ${wo.client.name}`}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {dl && !['published', 'cancelled'].includes(wo!.status) && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-mono ${DEADLINE_TONE_CLASS[dl.tone]}`}
              >
                <Clock className="w-3 h-3" />
                {dl.label}
              </span>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {task.status === 'pending' && (
            <ActBtn
              loading={loading === 'start'}
              Icon={Play}
              label="Iniciar"
              onClick={() =>
                run('start', () =>
                  updateTaskStatusAction({
                    task_id: task.id,
                    new_status: 'in_progress',
                  })
                )
              }
            />
          )}
          {task.status === 'in_progress' && (
            <>
              <ActBtn
                loading={loading === 'done'}
                Icon={CheckCircle2}
                label="Marcar lista"
                onClick={() =>
                  run('done', () =>
                    updateTaskStatusAction({
                      task_id: task.id,
                      new_status: 'done',
                    })
                  )
                }
              />
              <ActBtn
                Icon={Ban}
                label="Reportar bloqueo"
                onClick={() => {
                  onError(null);
                  setBlockReason('');
                  setBlockOpen(true);
                }}
              />
            </>
          )}
          {task.status === 'blocked' && (
            <ActBtn
              loading={loading === 'unblock'}
              Icon={RotateCcw}
              label="Desbloquear"
              onClick={() => run('unblock', () => unblockTaskAction(task.id))}
            />
          )}
        </div>

        {task.status === 'blocked' && task.blocked_reason && (
          <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/20 px-2.5 py-1.5 text-xs text-destructive">
            <span className="font-mono uppercase text-[9px] tracking-wider">
              Bloqueada:
            </span>{' '}
            {task.blocked_reason}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!!loading}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={saveNotes}
              disabled={!!loading || notes === (task.notes ?? '')}
            >
              {loading === 'notes' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Guardar notas
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Horas reales
              {task.estimated_hours != null && (
                <span className="text-muted-foreground font-normal">
                  {' '}
                  (estimadas: {task.estimated_hours}h)
                </span>
              )}
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={0}
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                disabled={!!loading}
                className="w-28"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={saveHours}
                disabled={!!loading}
              >
                {loading === 'hours' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal bloqueo */}
      {blockOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setBlockOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Reportar bloqueo</h3>
              <button
                onClick={() => setBlockOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-2">
              <Label htmlFor={`blk-${task.id}`}>¿Qué te está bloqueando?</Label>
              <textarea
                id={`blk-${task.id}`}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                disabled={loading === 'block'}
                rows={3}
                placeholder="Ej: falta material gráfico del cliente"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>
            <div className="p-5 border-t border-border flex gap-2">
              <Button
                variant="outline"
                onClick={() => setBlockOpen(false)}
                disabled={loading === 'block'}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                onClick={handleBlock}
                disabled={loading === 'block'}
                className="flex-1"
              >
                {loading === 'block' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Reportar bloqueo'
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ActBtn({
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
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {label}
    </Button>
  );
}

function Tab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {label}
      <span
        className={`font-mono tabular-nums ${active ? 'text-black/70' : 'text-muted-foreground'}`}
      >
        {count}
      </span>
    </button>
  );
}
