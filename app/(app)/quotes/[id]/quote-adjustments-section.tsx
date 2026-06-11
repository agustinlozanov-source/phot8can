'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Loader2,
  X,
  TrendingDown,
  Gift,
  Percent,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addAdjustmentAction,
  removeAdjustmentAction,
} from '@/lib/actions/quote-items';
import type {
  QuoteAdjustment,
  QuoteAdjustmentType,
} from '@/lib/types/database';

interface Props {
  quoteId: string;
  adjustments: QuoteAdjustment[];
  currency: string;
  locked: boolean;
}

export function QuoteAdjustmentsSection({
  quoteId,
  adjustments,
  currency,
  locked,
}: Props) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleRemove(id: string, label: string) {
    if (!confirm(`¿Quitar "${label}"?`)) return;
    setActionLoading(id);
    await removeAdjustmentAction(id);
    setActionLoading(null);
    router.refresh();
  }

  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Descuentos y bonificaciones
          </div>
          <div className="text-sm font-medium">
            {adjustments.length}{' '}
            {adjustments.length === 1 ? 'ajuste' : 'ajustes'} aplicados
          </div>
        </div>

        {!locked && (
          <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)}>
            <Plus className="w-3.5 h-3.5" />
            Agregar ajuste
          </Button>
        )}
      </div>

      {adjustments.length === 0 ? (
        <div className="p-6 text-center">
          <TrendingDown className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <div className="text-xs text-muted-foreground">
            Sin descuentos ni bonificaciones aplicados.
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {adjustments.map((adj) => (
            <div
              key={adj.id}
              className="p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <AdjustmentIcon type={adj.adjustment_type} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{adj.label}</div>
                  {adj.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {adj.description}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div
                    className={`font-mono text-sm font-medium ${getAdjColor(adj.adjustment_type)}`}
                  >
                    {formatAdjustmentValue(adj, currency)}
                  </div>
                  {adj.adjustment_type === 'discount_percent' && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {formatPrice(Number(adj.calculated_amount), currency)}
                    </div>
                  )}
                </div>

                {!locked && (
                  <button
                    onClick={() => handleRemove(adj.id, adj.label)}
                    disabled={actionLoading === adj.id}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === adj.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddAdjustmentModal
          quoteId={quoteId}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddAdjustmentModal({
  quoteId,
  onClose,
  onAdded,
}: {
  quoteId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [type, setType] = useState<QuoteAdjustmentType>('discount_percent');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError('El monto debe ser un número válido');
      return;
    }

    if (!label.trim()) {
      setError('La etiqueta es requerida');
      return;
    }

    setIsLoading(true);
    const result = await addAdjustmentAction({
      quote_id: quoteId,
      adjustment_type: type,
      label: label.trim(),
      amount: amountNum,
      description: description.trim() || null,
    });

    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      onAdded();
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isLoading ? undefined : onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">Agregar ajuste</h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo de ajuste */}
          <div className="space-y-2">
            <Label>Tipo de ajuste</Label>
            <div className="grid grid-cols-3 gap-2">
              <TypeOption
                type="discount_percent"
                label="% Descuento"
                icon={<Percent className="w-4 h-4" />}
                selected={type === 'discount_percent'}
                onClick={() => setType('discount_percent')}
              />
              <TypeOption
                type="discount_amount"
                label="$ Descuento"
                icon={<DollarSign className="w-4 h-4" />}
                selected={type === 'discount_amount'}
                onClick={() => setType('discount_amount')}
              />
              <TypeOption
                type="bonus"
                label="Bono"
                icon={<Gift className="w-4 h-4" />}
                selected={type === 'bonus'}
                onClick={() => setType('bonus')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Etiqueta *</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isLoading}
              placeholder={
                type === 'bonus'
                  ? 'Ej: Diseño de logo cortesía'
                  : 'Ej: Descuento por pronto pago'
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              {type === 'discount_percent'
                ? 'Porcentaje *'
                : type === 'discount_amount'
                  ? 'Monto del descuento *'
                  : 'Valor del bono *'}
            </Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={type === 'discount_percent' ? '100' : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isLoading}
                placeholder={type === 'discount_percent' ? '10' : '500'}
                required
                className={type === 'discount_percent' ? 'pr-8' : ''}
              />
              {type === 'discount_percent' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
                  %
                </span>
              )}
            </div>
            {type === 'bonus' && (
              <p className="text-xs text-muted-foreground">
                Los bonos son informativos: aparecen en la cotización pero no
                afectan el total.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              placeholder="Detalle adicional visible al cliente"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Agregando...
                </>
              ) : (
                'Agregar'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function TypeOption({
  type,
  label,
  icon,
  selected,
  onClick,
}: {
  type: string;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-md border text-left transition-colors ${
        selected
          ? 'border-photocan-amber bg-photocan-amber/10'
          : 'border-border hover:border-photocan-amber/30 bg-card'
      }`}
    >
      <div
        className={`mb-1 ${selected ? 'text-photocan-amber' : 'text-muted-foreground'}`}
      >
        {icon}
      </div>
      <div className="text-xs font-medium">{label}</div>
    </button>
  );
}

function AdjustmentIcon({ type }: { type: QuoteAdjustmentType }) {
  if (type === 'bonus') {
    return (
      <div className="w-7 h-7 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center flex-shrink-0">
        <Gift className="w-3.5 h-3.5 text-photocan-amber-deep" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-md bg-green-500/10 border border-green-500/30 grid place-items-center flex-shrink-0">
      <TrendingDown className="w-3.5 h-3.5 text-green-500" />
    </div>
  );
}

function getAdjColor(type: QuoteAdjustmentType): string {
  if (type === 'bonus') return 'text-photocan-amber-deep';
  return 'text-green-500';
}

function formatAdjustmentValue(
  adj: QuoteAdjustment,
  currency: string
): string {
  const amount = Number(adj.amount);
  if (adj.adjustment_type === 'discount_percent') {
    return `−${amount.toFixed(0)}%`;
  }
  if (adj.adjustment_type === 'discount_amount') {
    return `−${formatPrice(amount, currency)}`;
  }
  // bonus
  return formatPrice(amount, currency);
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
