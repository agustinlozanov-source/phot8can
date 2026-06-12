'use client';

import { useState } from 'react';
import {
  Loader2,
  X,
  Package,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkinAssetRequestItemsAction } from '@/lib/actions/asset-requests';

type ItemForCheckin = {
  id: string;
  asset: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
  } | null;
};

type ReturnCondition = 'ok' | 'minor_damage' | 'major_damage' | 'lost';

interface ItemState {
  selected: boolean;
  condition: ReturnCondition;
  notes: string;
}

export function CheckinModal({
  requestId,
  items,
  onClose,
  onDone,
}: {
  requestId: string;
  items: ItemForCheckin[];
  onClose: () => void;
  onDone: () => void;
}) {
  // Inicializamos el estado de cada item: todos seleccionados, condición OK
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(
    () => {
      const initial: Record<string, ItemState> = {};
      for (const item of items) {
        initial[item.id] = {
          selected: true,
          condition: 'ok',
          notes: '',
        };
      }
      return initial;
    }
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSelected(itemId: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selected: !prev[itemId].selected,
      },
    }));
  }

  function setCondition(itemId: string, condition: ReturnCondition) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        condition,
      },
    }));
  }

  function setNotes(itemId: string, notes: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        notes,
      },
    }));
  }

  function selectAll(select: boolean) {
    setItemStates((prev) => {
      const next: Record<string, ItemState> = {};
      for (const id of Object.keys(prev)) {
        next[id] = { ...prev[id], selected: select };
      }
      return next;
    });
  }

  const selectedCount = Object.values(itemStates).filter(
    (s) => s.selected
  ).length;
  const damagedCount = Object.values(itemStates).filter(
    (s) =>
      s.selected &&
      (s.condition === 'minor_damage' ||
        s.condition === 'major_damage' ||
        s.condition === 'lost')
  ).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selectedItems = Object.entries(itemStates).filter(
      ([, s]) => s.selected
    );

    if (selectedItems.length === 0) {
      setError('Selecciona al menos un activo para devolver');
      return;
    }

    // Validar que items con daño/pérdida tengan notas
    for (const [itemId, state] of selectedItems) {
      if (state.condition !== 'ok' && state.notes.trim().length < 5) {
        const item = items.find((i) => i.id === itemId);
        setError(
          `${item?.asset?.name || 'Un activo'} con condición "${getConditionLabel(state.condition)}" requiere notas (mín. 5 caracteres)`
        );
        return;
      }
    }

    setIsLoading(true);

    const result = await checkinAssetRequestItemsAction({
      request_id: requestId,
      items: selectedItems.map(([item_id, state]) => ({
        item_id,
        return_condition: state.condition,
        return_notes: state.notes.trim() || null,
      })),
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
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-background border border-border rounded-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold">Recibir devolución</h3>
            <div className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? 'activo' : 'activos'} en
              mano · {selectedCount} a devolver ahora
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 border-b border-border flex items-center justify-between gap-2 flex-shrink-0 bg-secondary/30">
          <p className="text-xs text-muted-foreground">
            Marca los activos que el solicitante está devolviendo. Puedes hacer
            devoluciones parciales.
          </p>
          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => selectAll(true)}
              className="text-xs font-mono text-photocan-amber-deep hover:underline"
            >
              Todos
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => selectAll(false)}
              className="text-xs font-mono text-muted-foreground hover:underline"
            >
              Ninguno
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 space-y-2 flex-1 overflow-y-auto">
            {items.map((item) => {
              const state = itemStates[item.id];
              if (!state) return null;

              return (
                <ItemCheckinRow
                  key={item.id}
                  item={item}
                  state={state}
                  onToggle={() => toggleSelected(item.id)}
                  onCondition={(c) => setCondition(item.id, c)}
                  onNotes={(n) => setNotes(item.id, n)}
                />
              );
            })}
          </div>

          {/* Resumen + acciones */}
          <div className="p-4 border-t border-border flex-shrink-0 space-y-3">
            {damagedCount > 0 && (
              <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 px-3 py-2 text-xs flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-photocan-amber-deep mt-0.5 flex-shrink-0" />
                <div>
                  {damagedCount}{' '}
                  {damagedCount === 1
                    ? 'activo regresa con incidencia'
                    : 'activos regresan con incidencia'}
                  . Se registrarán en el historial y los con &ldquo;daño mayor&rdquo;
                  irán a mantenimiento.
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || selectedCount === 0}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-4 h-4" />
                    Confirmar devolución ({selectedCount})
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

// ============================================================
// FILA INDIVIDUAL DE CHECKIN
// ============================================================

function ItemCheckinRow({
  item,
  state,
  onToggle,
  onCondition,
  onNotes,
}: {
  item: ItemForCheckin;
  state: ItemState;
  onToggle: () => void;
  onCondition: (c: ReturnCondition) => void;
  onNotes: (n: string) => void;
}) {
  if (!item.asset) return null;

  return (
    <div
      className={`border rounded-md p-3 transition-colors ${
        state.selected
          ? 'border-photocan-amber/40 bg-photocan-amber/5'
          : 'border-border bg-card opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
            state.selected
              ? 'bg-photocan-amber border-photocan-amber'
              : 'bg-background border-border'
          }`}
        >
          {state.selected && (
            <CheckCircle2 className="w-3.5 h-3.5 text-black" />
          )}
        </button>

        <Package className="w-4 h-4 text-photocan-amber-deep flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {item.asset.name}
          </div>
          {(item.asset.brand || item.asset.model) && (
            <div className="text-xs text-muted-foreground truncate">
              {[item.asset.brand, item.asset.model]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>
      </div>

      {state.selected && (
        <div className="mt-3 ml-8 space-y-2">
          {/* Selector de condición */}
          <div className="grid grid-cols-4 gap-1.5">
            <ConditionButton
              condition="ok"
              label="OK"
              icon={<CheckCircle2 className="w-3 h-3" />}
              selected={state.condition === 'ok'}
              onClick={() => onCondition('ok')}
            />
            <ConditionButton
              condition="minor_damage"
              label="Daño menor"
              icon={<AlertCircle className="w-3 h-3" />}
              selected={state.condition === 'minor_damage'}
              onClick={() => onCondition('minor_damage')}
            />
            <ConditionButton
              condition="major_damage"
              label="Daño mayor"
              icon={<AlertTriangle className="w-3 h-3" />}
              selected={state.condition === 'major_damage'}
              onClick={() => onCondition('major_damage')}
            />
            <ConditionButton
              condition="lost"
              label="Perdido"
              icon={<XCircle className="w-3 h-3" />}
              selected={state.condition === 'lost'}
              onClick={() => onCondition('lost')}
            />
          </div>

          {/* Notas (requeridas si no es OK) */}
          {state.condition !== 'ok' && (
            <div>
              <textarea
                value={state.notes}
                onChange={(e) => onNotes(e.target.value)}
                rows={2}
                placeholder={
                  state.condition === 'lost'
                    ? 'Circunstancias del extravío (requerido)'
                    : 'Descripción del daño (requerido)'
                }
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConditionButton({
  label,
  icon,
  selected,
  onClick,
}: {
  condition: ReturnCondition;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded text-[10px] font-medium border transition-colors flex items-center justify-center gap-1 ${
        selected
          ? 'bg-photocan-amber border-photocan-amber text-black'
          : 'border-border text-muted-foreground hover:border-photocan-amber/30'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function getConditionLabel(c: ReturnCondition): string {
  const labels = {
    ok: 'OK',
    minor_damage: 'Daño menor',
    major_damage: 'Daño mayor',
    lost: 'Perdido',
  };
  return labels[c];
}
