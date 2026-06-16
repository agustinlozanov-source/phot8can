'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { regenerateScheduleItemAction } from '@/lib/actions/schedules';
import type { ScheduleItem } from '@/lib/types/database';

interface Props {
  item: ScheduleItem;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RegenerateItemModal({ item, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (feedback.trim().length < 5) {
      setError('El feedback debe ser específico (mín. 5 caracteres)');
      return;
    }

    setLoading(true);
    const result = await regenerateScheduleItemAction({
      item_id: item.id,
      feedback: feedback.trim(),
    });
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
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-photocan-amber" />
            Regenerar pieza con IA
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
          <p className="text-sm text-muted-foreground">
            La IA va a mantener la fecha, hora, pilar y tipo. Va a regenerar el
            brief (hook, copy, CTA, formato) según tu feedback.
          </p>

          {/* Vista previa de la pieza actual */}
          <div className="border border-border rounded-md bg-card p-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Pieza actual
            </div>
            <div className="text-sm font-medium">{item.title}</div>
            {item.hook && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {item.hook}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">¿Qué quieres ajustar?</Label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={loading}
              rows={4}
              maxLength={500}
              placeholder="Ej: el hook se siente muy técnico, quiero algo más emocional. El CTA es genérico, sugiero algo más específico al cliente ideal."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
            <div className="text-[10px] font-mono text-muted-foreground text-right">
              {feedback.length}/500
            </div>
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
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Regenerar
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
