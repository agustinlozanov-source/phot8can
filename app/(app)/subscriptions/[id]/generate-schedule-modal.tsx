'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createScheduleAction } from '@/lib/actions/schedules';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  subscriptionPeriodId: string;
  periodStartDate: string;
  periodEndDate: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GenerateScheduleModal({
  subscriptionPeriodId,
  periodStartDate,
  onClose,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [daysPlanned, setDaysPlanned] = useState('30');
  const [startDate, setStartDate] = useState(periodStartDate || todayISO());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setError(null);

    const days = parseInt(daysPlanned, 10);
    if (Number.isNaN(days) || days < 1 || days > 90) {
      setError('Los días a planear deben estar entre 1 y 90');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setError('Indica una fecha de inicio válida');
      return;
    }

    setLoading(true);
    const result = await createScheduleAction({
      subscription_period_id: subscriptionPeriodId,
      days_planned: days,
      start_date: startDate,
      generation_notes: notes.trim() || undefined,
    });
    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setSubmitted(true);
  }

  function handleDone() {
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
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-photocan-amber" />
            Generar cronograma con IA
          </h3>
          {!submitted && (
            <button
              onClick={onClose}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {submitted ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div className="font-medium mb-1">Generando cronograma</div>
            <p className="text-sm text-muted-foreground mb-5">
              La IA está trabajando en background. Esto puede tomar 1-2 minutos.
              Refresca el período en un momento para ver el resultado.
            </p>
            <Button onClick={handleDone} className="w-full">
              Entendido
            </Button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="days_planned">Días a planear</Label>
                  <Input
                    id="days_planned"
                    type="number"
                    min={1}
                    max={90}
                    value={daysPlanned}
                    onChange={(e) => setDaysPlanned(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Fecha de inicio</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="generation_notes">
                  Notas para la IA{' '}
                  <span className="text-muted-foreground font-normal">
                    (opcional)
                  </span>
                </Label>
                <textarea
                  id="generation_notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  rows={3}
                  maxLength={1000}
                  placeholder="Ej: cliente lanza producto el día 15, queremos enfatizar ese tema esa semana"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                La IA usará la estrategia aprobada del cliente y los entregables
                planeados de este período para crear un brief ejecutable por
                pieza. Puede tomar 1-2 minutos.
              </p>
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
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generar
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
