'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Percent, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addTaxToQuoteAction,
  removeTaxFromQuoteAction,
} from '@/lib/actions/quote-items';
import type { QuoteTax } from '@/lib/types/database';

interface AvailableTax {
  id: string;
  name: string;
  code: string | null;
  percentage: number;
}

interface Props {
  quoteId: string;
  taxes: QuoteTax[];
  availableTaxes: AvailableTax[];
  currency: string;
  locked: boolean;
}

export function QuoteTaxesSection({
  quoteId,
  taxes,
  availableTaxes,
  currency,
  locked,
}: Props) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Impuestos del catálogo que aún no están aplicados
  const availableToAdd = useMemo(() => {
    const appliedTaxIds = new Set(taxes.map((t) => t.tax_id).filter(Boolean));
    return availableTaxes.filter((t) => !appliedTaxIds.has(t.id));
  }, [taxes, availableTaxes]);

  async function handleAdd(taxId: string) {
    setActionLoading(taxId);
    await addTaxToQuoteAction({ quote_id: quoteId, tax_id: taxId });
    setActionLoading(null);
    setShowAddModal(false);
    router.refresh();
  }

  async function handleRemove(quoteTaxId: string, name: string) {
    if (!confirm(`¿Quitar el impuesto "${name}" de la cotización?`)) return;
    setActionLoading(quoteTaxId);
    await removeTaxFromQuoteAction(quoteTaxId);
    setActionLoading(null);
    router.refresh();
  }

  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Impuestos aplicados
          </div>
          <div className="text-sm font-medium">
            {taxes.length}{' '}
            {taxes.length === 1 ? 'impuesto' : 'impuestos'} en esta cotización
          </div>
        </div>

        {!locked && availableToAdd.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar impuesto
          </Button>
        )}
      </div>

      {taxes.length === 0 ? (
        <div className="p-6 text-center">
          <Percent className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <div className="text-xs text-muted-foreground">
            Sin impuestos aplicados.
            {!locked && availableToAdd.length === 0 && (
              <span className="block mt-1">
                Configura impuestos en{' '}
                <a
                  href="/catalog/taxes"
                  className="underline hover:text-foreground"
                >
                  Catálogo → Impuestos
                </a>
                .
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {taxes.map((tax) => (
            <div
              key={tax.id}
              className="p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/30 grid place-items-center flex-shrink-0">
                  <Percent className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {tax.name}
                    <span className="font-mono text-xs text-muted-foreground ml-2">
                      ({Number(tax.percentage).toFixed(2)}%)
                    </span>
                  </div>
                  {tax.code && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {tax.code}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="font-mono text-sm font-medium">
                  +{formatPrice(Number(tax.tax_amount), currency)}
                </div>

                {!locked && (
                  <button
                    onClick={() => handleRemove(tax.id, tax.name)}
                    disabled={actionLoading === tax.id}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === tax.id ? (
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

      {/* Modal agregar impuesto */}
      {showAddModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowAddModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Agregar impuesto</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
              {availableToAdd.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Todos los impuestos disponibles ya están aplicados.
                </div>
              ) : (
                availableToAdd.map((tax) => (
                  <button
                    key={tax.id}
                    onClick={() => handleAdd(tax.id)}
                    disabled={actionLoading === tax.id}
                    className="w-full text-left p-3 border border-border rounded-md hover:border-photocan-amber/40 hover:bg-photocan-amber/5 transition-colors disabled:opacity-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">{tax.name}</div>
                      {tax.code && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {tax.code}
                        </div>
                      )}
                    </div>
                    <div className="font-mono text-sm font-medium">
                      {Number(tax.percentage).toFixed(2)}%
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
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
