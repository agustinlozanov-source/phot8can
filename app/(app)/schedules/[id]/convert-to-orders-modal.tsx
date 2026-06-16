'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  AlertCircle,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  previewWorkOrdersFromScheduleAction,
  createWorkOrdersFromScheduleAction,
} from '@/lib/actions/work-orders';
import type { TaskStageType } from '@/lib/types/database';
import { ItemTypeBadge, STAGE_TYPE_META, formatDate } from '../../work-orders/wo-ui';

type OrgUser = { id: string; first_name: string; last_name: string };

type PreviewItem = {
  schedule_item: {
    id: string;
    title: string;
    scheduled_publish_date: string;
    item_type: string;
    pillar_name: string | null;
  };
  suggested_deadline: string;
  tasks: Array<{
    stage_type: TaskStageType;
    stage_name: string;
    default_days_before_publish: number;
    suggested_user: OrgUser | null;
    estimated_hours: number | null;
  }>;
};

type TaskState = {
  assigned_to_user_id: string | null;
  estimated_hours: string;
  skip: boolean;
};

interface Props {
  scheduleId: string;
  itemIds: string[];
  users: OrgUser[];
  onClose: () => void;
}

export function ConvertToOrdersModal({
  scheduleId,
  itemIds,
  users,
  onClose,
}: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // estado por item → por stage_type
  const [taskState, setTaskState] = useState<
    Record<string, Record<string, TaskState>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; failed: number } | null>(
    null
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await previewWorkOrdersFromScheduleAction({
        schedule_id: scheduleId,
        item_ids: itemIds,
      });
      if (!active) return;
      if ('error' in res) {
        setError(res.error ?? 'Error al generar la vista previa');
        setLoadingPreview(false);
        return;
      }
      const items = res.preview ?? [];
      setPreview(items as PreviewItem[]);
      setIncluded(new Set(items.map((p) => p.schedule_item.id)));
      const initial: Record<string, Record<string, TaskState>> = {};
      for (const p of items as PreviewItem[]) {
        initial[p.schedule_item.id] = {};
        for (const t of p.tasks) {
          initial[p.schedule_item.id][t.stage_type] = {
            assigned_to_user_id: t.suggested_user?.id ?? null,
            estimated_hours: t.estimated_hours != null ? String(t.estimated_hours) : '',
            skip: false,
          };
        }
      }
      setTaskState(initial);
      setLoadingPreview(false);
    })();
    return () => {
      active = false;
    };
  }, [scheduleId, itemIds]);

  function toggleItem(id: string) {
    setIncluded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleExpand(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function patchTask(
    itemId: string,
    stage: string,
    patch: Partial<TaskState>
  ) {
    setTaskState((s) => ({
      ...s,
      [itemId]: {
        ...s[itemId],
        [stage]: { ...s[itemId][stage], ...patch },
      },
    }));
  }

  const includedPreview = (preview ?? []).filter((p) =>
    included.has(p.schedule_item.id)
  );
  const totalOTs = includedPreview.length;
  const totalTasks = includedPreview.reduce((sum, p) => {
    const st = taskState[p.schedule_item.id] || {};
    return sum + p.tasks.filter((t) => !st[t.stage_type]?.skip).length;
  }, 0);

  async function handleSubmit() {
    setError(null);
    if (includedPreview.length === 0) {
      setError('Selecciona al menos una pieza');
      return;
    }

    const assignments = includedPreview.map((p) => ({
      schedule_item_id: p.schedule_item.id,
      task_overrides: p.tasks.map((t) => {
        const st = taskState[p.schedule_item.id]?.[t.stage_type];
        return {
          stage_type: t.stage_type,
          assigned_to_user_id: st?.assigned_to_user_id ?? null,
          estimated_hours:
            st?.estimated_hours && st.estimated_hours !== ''
              ? parseFloat(st.estimated_hours)
              : null,
          skip: st?.skip ?? false,
        };
      }),
    }));

    setSubmitting(true);
    const res = await createWorkOrdersFromScheduleAction({
      schedule_id: scheduleId,
      item_ids: includedPreview.map((p) => p.schedule_item.id),
      assignments,
    });
    setSubmitting(false);

    if ('error' in res && res.error) {
      setError(res.error);
      return;
    }

    const created = 'created' in res ? res.created?.length ?? 0 : 0;
    const failed = 'failed' in res ? res.failed?.length ?? 0 : 0;
    setResult({ created, failed });
    router.refresh();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !submitting && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-photocan-amber" />
            Convertir aprobadas en OTs
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resultado final */}
        {result ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div className="font-medium mb-1">
              {result.created} {result.created === 1 ? 'OT creada' : 'OTs creadas'}
            </div>
            {result.failed > 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                {result.failed}{' '}
                {result.failed === 1 ? 'pieza falló' : 'piezas fallaron'} (ya
                tenían OT o no estaban disponibles).
              </p>
            )}
            <Button onClick={() => router.push('/work-orders')} className="w-full mt-2">
              Ver órdenes de trabajo
            </Button>
          </div>
        ) : loadingPreview ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-photocan-amber mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">
              Calculando tareas y responsables...
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-3">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {(preview ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No hay piezas aprobadas disponibles para convertir.
                </div>
              ) : (
                (preview ?? []).map((p) => {
                  const id = p.schedule_item.id;
                  const isIncluded = included.has(id);
                  const isOpen = expanded.has(id);
                  const st = taskState[id] || {};
                  return (
                    <div
                      key={id}
                      className={`border rounded-lg overflow-hidden ${
                        isIncluded ? 'border-border' : 'border-border/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-card">
                        <input
                          type="checkbox"
                          checked={isIncluded}
                          onChange={() => toggleItem(id)}
                          className="w-4 h-4 accent-photocan-amber"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ItemTypeBadge type={p.schedule_item.item_type} />
                            <span className="font-medium text-sm truncate">
                              {p.schedule_item.title}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            Publica {formatDate(p.schedule_item.scheduled_publish_date)} ·
                            deadline {formatDate(p.suggested_deadline)} ·{' '}
                            {p.tasks.length} tareas
                          </div>
                        </div>
                        <button
                          onClick={() => toggleExpand(id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            Deadline sugerido: {formatDate(p.suggested_deadline)}{' '}
                            (ajustable luego en cada OT)
                          </div>
                          {p.tasks.map((t) => {
                            const ts = st[t.stage_type];
                            const skip = ts?.skip ?? false;
                            return (
                              <div
                                key={t.stage_type}
                                className={`grid grid-cols-[1fr_auto] gap-2 items-center rounded-md border border-border p-2 ${
                                  skip ? 'opacity-50' : ''
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-medium flex items-center gap-1.5">
                                    {STAGE_TYPE_META[t.stage_type]?.label ??
                                      t.stage_type}
                                    <span className="text-muted-foreground font-normal truncate">
                                      · {t.stage_name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <select
                                      value={ts?.assigned_to_user_id ?? ''}
                                      disabled={skip}
                                      onChange={(e) =>
                                        patchTask(id, t.stage_type, {
                                          assigned_to_user_id:
                                            e.target.value || null,
                                        })
                                      }
                                      className="h-7 rounded border border-input bg-background px-2 text-xs max-w-[150px]"
                                    >
                                      <option value="">Sin asignar</option>
                                      {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.first_name} {u.last_name}
                                        </option>
                                      ))}
                                    </select>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.5"
                                      value={ts?.estimated_hours ?? ''}
                                      disabled={skip}
                                      onChange={(e) =>
                                        patchTask(id, t.stage_type, {
                                          estimated_hours: e.target.value,
                                        })
                                      }
                                      placeholder="hs"
                                      className="h-7 w-16 text-xs"
                                    />
                                  </div>
                                </div>
                                <label className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={skip}
                                    onChange={(e) =>
                                      patchTask(id, t.stage_type, {
                                        skip: e.target.checked,
                                      })
                                    }
                                    className="w-3.5 h-3.5 accent-destructive"
                                  />
                                  Saltar
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-5 border-t border-border sticky bottom-0 bg-background">
              <div className="text-sm text-muted-foreground mb-3">
                Se crearán{' '}
                <span className="font-medium text-foreground">{totalOTs}</span>{' '}
                {totalOTs === 1 ? 'OT' : 'OTs'} con{' '}
                <span className="font-medium text-foreground">{totalTasks}</span>{' '}
                tareas en total.
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || totalOTs === 0}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <ClipboardList className="w-4 h-4" />
                      Crear OTs
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
