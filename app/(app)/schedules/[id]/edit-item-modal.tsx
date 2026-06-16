'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateScheduleItemAction } from '@/lib/actions/schedules';
import type { ScheduleItem, ScheduleItemType } from '@/lib/types/database';

const ITEM_TYPES: { value: ScheduleItemType; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'carousel', label: 'Carrusel' },
  { value: 'video', label: 'Video' },
  { value: 'live', label: 'Live' },
  { value: 'other', label: 'Otro' },
];

interface Props {
  item: ScheduleItem;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditItemModal({ item, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    scheduled_date: item.scheduled_date,
    scheduled_time: item.scheduled_time ?? '',
    item_type: item.item_type,
    title: item.title,
    hook: item.hook ?? '',
    body_copy_suggestion: item.body_copy_suggestion ?? '',
    cta: item.cta ?? '',
    format_notes: item.format_notes ?? '',
    hashtags_suggested: item.hashtags_suggested ?? '',
    key_message: item.key_message ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    if (!form.title.trim()) {
      setError('El título es obligatorio');
      return;
    }

    // Solo enviar los campos que cambiaron
    const payload: Parameters<typeof updateScheduleItemAction>[0] = {
      item_id: item.id,
    };
    if (form.scheduled_date !== item.scheduled_date)
      payload.scheduled_date = form.scheduled_date;
    if (form.scheduled_time !== (item.scheduled_time ?? ''))
      payload.scheduled_time = form.scheduled_time || null;
    if (form.item_type !== item.item_type) payload.item_type = form.item_type;
    if (form.title !== item.title) payload.title = form.title;
    if (form.hook !== (item.hook ?? '')) payload.hook = form.hook || null;
    if (form.body_copy_suggestion !== (item.body_copy_suggestion ?? ''))
      payload.body_copy_suggestion = form.body_copy_suggestion || null;
    if (form.cta !== (item.cta ?? '')) payload.cta = form.cta || null;
    if (form.format_notes !== (item.format_notes ?? ''))
      payload.format_notes = form.format_notes || null;
    if (form.hashtags_suggested !== (item.hashtags_suggested ?? ''))
      payload.hashtags_suggested = form.hashtags_suggested || null;
    if (form.key_message !== (item.key_message ?? ''))
      payload.key_message = form.key_message || null;

    if (Object.keys(payload).length === 1) {
      // Solo item_id → nada cambió
      onClose();
      return;
    }

    setLoading(true);
    const result = await updateScheduleItemAction(payload);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    onClose();
    onSuccess?.();
    router.refresh();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !loading && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h3 className="text-lg font-semibold">Editar pieza</h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Fecha</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={form.scheduled_date}
                onChange={(e) => set('scheduled_date', e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_time">Hora</Label>
              <Input
                id="scheduled_time"
                type="time"
                value={form.scheduled_time}
                onChange={(e) => set('scheduled_time', e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item_type">Tipo</Label>
              <select
                id="item_type"
                value={form.item_type}
                onChange={(e) =>
                  set('item_type', e.target.value as ScheduleItemType)
                }
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Pilar{' '}
              <span className="text-muted-foreground font-normal">
                (definido por la estrategia)
              </span>
            </Label>
            <div className="text-sm px-3 py-2 rounded-md bg-secondary/50 border border-border text-muted-foreground">
              {item.pillar_name}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              disabled={loading}
            />
          </div>

          <Field
            label="Gancho (hook)"
            value={form.hook}
            onChange={(v) => set('hook', v)}
            disabled={loading}
            rows={2}
          />
          <Field
            label="Copy sugerido"
            value={form.body_copy_suggestion}
            onChange={(v) => set('body_copy_suggestion', v)}
            disabled={loading}
            rows={4}
          />
          <Field
            label="Llamado a la acción (CTA)"
            value={form.cta}
            onChange={(v) => set('cta', v)}
            disabled={loading}
            rows={2}
          />
          <Field
            label="Notas de producción"
            value={form.format_notes}
            onChange={(v) => set('format_notes', v)}
            disabled={loading}
            rows={2}
          />
          <Field
            label="Hashtags sugeridos"
            value={form.hashtags_suggested}
            onChange={(v) => set('hashtags_suggested', v)}
            disabled={loading}
            rows={2}
          />
          <Field
            label="Mensaje clave"
            value={form.key_message}
            onChange={(v) => set('key_message', v)}
            disabled={loading}
            rows={2}
          />

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-background">
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
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
      />
    </div>
  );
}
