'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  upsertAssignmentRuleAction,
  deleteAssignmentRuleAction,
  seedDefaultAssignmentRulesAction,
} from '@/lib/actions/assignment-rules';
import type { AssignmentRule } from '@/lib/types/database';
import { ITEM_TYPE_META, STAGE_TYPE_META } from '../wo-ui';

type OrgUser = { id: string; first_name: string; last_name: string };
type RuleRow = AssignmentRule & { default_user: OrgUser | null };

const ITEM_TYPES = ['post', 'reel', 'story', 'carousel', 'video', 'live', 'other'] as const;
const STAGE_TYPES = ['design', 'edit', 'copy', 'review', 'shoot', 'other'] as const;

export function RulesConfig({
  rules,
  users,
}: {
  rules: RuleRow[];
  users: OrgUser[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [modalRule, setModalRule] = useState<RuleRow | 'new' | null>(null);

  async function handleSeed() {
    setError(null);
    setLoading('seed');
    const result = await seedDefaultAssignmentRulesAction();
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Borrar esta regla?')) return;
    setError(null);
    setLoading(`del-${id}`);
    const result = await deleteAssignmentRuleAction(id);
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  // Edición inline de un campo
  async function patchRule(rule: RuleRow, patch: Partial<RuleRow>) {
    setError(null);
    setLoading(`save-${rule.id}`);
    const result = await upsertAssignmentRuleAction({
      id: rule.id,
      item_type: (patch.item_type ?? rule.item_type) as never,
      stage_type: (patch.stage_type ?? rule.stage_type) as never,
      default_user_id:
        patch.default_user_id !== undefined
          ? patch.default_user_id
          : rule.default_user_id,
      stage_name_template: patch.stage_name_template ?? rule.stage_name_template,
      default_days_before_publish:
        patch.default_days_before_publish ?? rule.default_days_before_publish,
      default_estimated_hours:
        patch.default_estimated_hours !== undefined
          ? patch.default_estimated_hours
          : rule.default_estimated_hours,
      position: patch.position ?? rule.position,
      is_active: patch.is_active ?? rule.is_active,
    });
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  // Agrupar por item_type
  const grouped = ITEM_TYPES.map((it) => ({
    item_type: it,
    rules: rules
      .filter((r) => r.item_type === it)
      .sort((a, b) => a.position - b.position),
  })).filter((g) => g.rules.length > 0);

  if (rules.length === 0) {
    return (
      <>
        {error && <ErrorBanner error={error} />}
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
            <Sparkles className="w-5 h-5 text-photocan-amber" />
          </div>
          <div className="font-medium mb-2">Sin reglas configuradas</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Crea el set de reglas base de Photocan (post, reel, story, carrusel,
            video con sus etapas típicas) y ajústalas después. También puedes
            agregar reglas manualmente.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={handleSeed} disabled={loading === 'seed'}>
              {loading === 'seed' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Crear reglas base
            </Button>
            <Button variant="outline" onClick={() => setModalRule('new')}>
              <Plus className="w-4 h-4" />
              Agregar regla
            </Button>
          </div>
        </div>
        {modalRule && (
          <RuleModal
            rule={modalRule === 'new' ? null : modalRule}
            users={users}
            onClose={() => setModalRule(null)}
          />
        )}
      </>
    );
  }

  return (
    <div>
      {error && <ErrorBanner error={error} />}

      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalRule('new')}>
          <Plus className="w-4 h-4" />
          Agregar regla
        </Button>
      </div>

      <div className="space-y-6">
        {grouped.map((group) => {
          const meta = ITEM_TYPE_META[group.item_type] ?? ITEM_TYPE_META.other;
          const Icon = meta.Icon;
          return (
            <div key={group.item_type}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${meta.color}`} />
                <h2 className="text-sm font-medium font-mono uppercase tracking-wider">
                  {meta.label}
                </h2>
                <span className="text-xs text-muted-foreground font-mono">
                  {group.rules.length}{' '}
                  {group.rules.length === 1 ? 'regla' : 'reglas'}
                </span>
              </div>

              <div className="border border-border rounded-lg bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <Th>Etapa</Th>
                      <Th>Responsable</Th>
                      <Th>Días antes</Th>
                      <Th>Horas est.</Th>
                      <Th>Activa</Th>
                      <Th> </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rules.map((rule) => (
                      <tr key={rule.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                              {STAGE_TYPE_META[rule.stage_type]?.label ??
                                rule.stage_type}
                            </span>
                          </div>
                          <InlineText
                            value={rule.stage_name_template}
                            disabled={loading === `save-${rule.id}`}
                            onSave={(v) =>
                              patchRule(rule, { stage_name_template: v })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={rule.default_user_id ?? ''}
                            disabled={loading === `save-${rule.id}`}
                            onChange={(e) =>
                              patchRule(rule, {
                                default_user_id: e.target.value || null,
                              })
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm max-w-[160px]"
                          >
                            <option value="">Sin asignar</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.first_name} {u.last_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <InlineNumber
                            value={rule.default_days_before_publish}
                            min={1}
                            max={30}
                            disabled={loading === `save-${rule.id}`}
                            onSave={(v) =>
                              v != null &&
                              patchRule(rule, { default_days_before_publish: v })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <InlineNumber
                            value={rule.default_estimated_hours}
                            min={0}
                            max={100}
                            step={0.5}
                            nullable
                            disabled={loading === `save-${rule.id}`}
                            onSave={(v) =>
                              patchRule(rule, { default_estimated_hours: v })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() =>
                              patchRule(rule, { is_active: !rule.is_active })
                            }
                            disabled={loading === `save-${rule.id}`}
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              rule.is_active ? 'bg-photocan-amber' : 'bg-secondary'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                rule.is_active ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={loading === `del-${rule.id}`}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            {loading === `del-${rule.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {modalRule && (
        <RuleModal
          rule={modalRule === 'new' ? null : modalRule}
          users={users}
          onClose={() => setModalRule(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// MODAL CREAR / EDITAR
// ============================================================

function RuleModal({
  rule,
  users,
  onClose,
}: {
  rule: RuleRow | null;
  users: OrgUser[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    item_type: rule?.item_type ?? 'post',
    stage_type: rule?.stage_type ?? 'design',
    stage_name_template: rule?.stage_name_template ?? '',
    default_days_before_publish: String(rule?.default_days_before_publish ?? 3),
    default_estimated_hours:
      rule?.default_estimated_hours != null
        ? String(rule.default_estimated_hours)
        : '',
    default_user_id: rule?.default_user_id ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!form.stage_name_template.trim()) {
      setError('El nombre de la etapa es obligatorio');
      return;
    }
    const days = parseInt(form.default_days_before_publish, 10);
    if (Number.isNaN(days) || days < 1 || days > 30) {
      setError('Los días antes deben estar entre 1 y 30');
      return;
    }
    const hours = form.default_estimated_hours
      ? parseFloat(form.default_estimated_hours)
      : null;

    setLoading(true);
    const result = await upsertAssignmentRuleAction({
      id: rule?.id,
      item_type: form.item_type as never,
      stage_type: form.stage_type as never,
      stage_name_template: form.stage_name_template.trim(),
      default_days_before_publish: days,
      default_estimated_hours: hours,
      default_user_id: form.default_user_id || null,
    });
    setLoading(false);
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
        onClick={() => !loading && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {rule ? 'Editar regla' : 'Nueva regla'}
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item_type">Tipo de pieza</Label>
              <select
                id="item_type"
                value={form.item_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, item_type: e.target.value as never }))
                }
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ITEM_TYPE_META[t]?.label ?? t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage_type">Etapa</Label>
              <select
                id="stage_type"
                value={form.stage_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stage_type: e.target.value as never }))
                }
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {STAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {STAGE_TYPE_META[t]?.label ?? t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage_name">Nombre de la etapa</Label>
            <Input
              id="stage_name"
              value={form.stage_name_template}
              onChange={(e) =>
                setForm((f) => ({ ...f, stage_name_template: e.target.value }))
              }
              disabled={loading}
              placeholder="Ej: Diseño visual del reel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="days">Días antes de publicar</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={30}
                value={form.default_days_before_publish}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    default_days_before_publish: e.target.value,
                  }))
                }
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Horas estimadas</Label>
              <Input
                id="hours"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={form.default_estimated_hours}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    default_estimated_hours: e.target.value,
                  }))
                }
                disabled={loading}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user">Responsable por defecto</Label>
            <select
              id="user"
              value={form.default_user_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, default_user_id: e.target.value }))
              }
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar
          </Button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// AUXILIARES
// ============================================================

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-4">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      {error}
    </div>
  );
}

function InlineText({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled?: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <input
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value && onSave(v.trim())}
      className="w-full bg-transparent text-sm font-medium focus:outline-none focus:bg-secondary/40 rounded px-1 -mx-1"
    />
  );
}

function InlineNumber({
  value,
  min,
  max,
  step,
  nullable,
  disabled,
  onSave,
}: {
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
  disabled?: boolean;
  onSave: (v: number | null) => void;
}) {
  const [v, setV] = useState(value != null ? String(value) : '');
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v === '') {
          if (nullable && value != null) onSave(null);
          return;
        }
        const n = parseFloat(v);
        if (!Number.isNaN(n) && n !== value) onSave(n);
      }}
      className="w-16 bg-transparent text-sm font-mono focus:outline-none focus:bg-secondary/40 rounded px-1"
    />
  );
}
