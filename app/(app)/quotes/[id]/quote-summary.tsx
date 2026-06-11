'use client';

import type {
  Quote,
  QuoteAdjustment,
  QuoteTax,
} from '@/lib/types/database';

interface Props {
  quote: Quote;
  itemsCount: number;
  adjustments: QuoteAdjustment[];
  taxes: QuoteTax[];
}

export function QuoteSummary({ quote, itemsCount, adjustments, taxes }: Props) {
  const subtotal = Number(quote.subtotal);
  const discountTotal = Number(quote.discount_total);
  const taxTotal = Number(quote.tax_total);
  const total = Number(quote.total);

  const baseAfterDiscount = subtotal - discountTotal;

  // Separar descuentos de bonificaciones
  const discounts = adjustments.filter(
    (a) => a.adjustment_type !== 'bonus'
  );
  const bonuses = adjustments.filter(
    (a) => a.adjustment_type === 'bonus'
  );

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
          Resumen
        </div>
        <div className="text-xs text-muted-foreground">
          {itemsCount} {itemsCount === 1 ? 'servicio' : 'servicios'} ·{' '}
          {quote.currency}
        </div>
      </div>

      <div className="p-4 space-y-2 text-sm">
        {/* Subtotal */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{formatPrice(subtotal, quote.currency)}</span>
        </div>

        {/* Descuentos */}
        {discounts.length > 0 && (
          <>
            {discounts.map((d) => (
              <div
                key={d.id}
                className="flex justify-between text-xs text-muted-foreground"
              >
                <span className="truncate pr-2">
                  {d.label}
                  {d.adjustment_type === 'discount_percent' && (
                    <span className="font-mono ml-1">
                      ({Number(d.amount).toFixed(0)}%)
                    </span>
                  )}
                </span>
                <span className="font-mono whitespace-nowrap">
                  −{formatPrice(Number(d.calculated_amount), quote.currency)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-1 border-t border-border/50">
              <span className="text-muted-foreground">
                Subtotal con descuentos
              </span>
              <span className="font-mono">
                {formatPrice(baseAfterDiscount, quote.currency)}
              </span>
            </div>
          </>
        )}

        {/* Impuestos */}
        {taxes.length > 0 && (
          <>
            {taxes.map((t) => (
              <div
                key={t.id}
                className="flex justify-between text-xs text-muted-foreground"
              >
                <span>
                  {t.name}{' '}
                  <span className="font-mono">
                    ({Number(t.percentage).toFixed(0)}%)
                  </span>
                </span>
                <span className="font-mono">
                  +{formatPrice(Number(t.tax_amount), quote.currency)}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Total */}
        <div className="flex justify-between pt-3 mt-2 border-t border-border">
          <span className="text-sm font-medium">Total</span>
          <span className="text-xl font-semibold font-mono text-photocan-amber-deep">
            {formatPrice(total, quote.currency)}
          </span>
        </div>

        {/* Bonificaciones */}
        {bonuses.length > 0 && (
          <div className="pt-3 mt-2 border-t border-border space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Bonificaciones incluidas
            </div>
            {bonuses.map((b) => (
              <div
                key={b.id}
                className="flex justify-between text-xs text-photocan-amber-deep"
              >
                <span className="truncate pr-2">{b.label}</span>
                <span className="font-mono whitespace-nowrap">
                  {formatPrice(Number(b.amount), quote.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer con vigencia */}
      <div className="p-4 border-t border-border bg-secondary/30 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Emisión</span>
          <span className="font-mono">
            {new Date(quote.issue_date).toLocaleDateString('es-MX')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Vigencia</span>
          <span className="font-mono">
            {new Date(quote.valid_until).toLocaleDateString('es-MX')}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
