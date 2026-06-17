'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, AlertCircle, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createManualInvoiceAction } from '@/lib/actions/invoices';
import { formatCurrency } from './finance-ui';

type ClientOption = { id: string; name: string };

const CURRENCIES = ['MXN', 'USD', 'EUR'];

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function CreateInvoiceModal({
  clients,
  onClose,
}: {
  clients: ClientOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [autoTax, setAutoTax] = useState(true);
  const [taxes, setTaxes] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [dueDate, setDueDate] = useState(plusDays(7));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotalNum = parseFloat(subtotal) || 0;
  const computedTax = autoTax
    ? Math.round(subtotalNum * 0.16 * 100) / 100
    : parseFloat(taxes) || 0;
  const total = Math.round((subtotalNum + computedTax) * 100) / 100;

  async function handleSubmit() {
    setError(null);
    if (!clientId) return setError('Selecciona un cliente');
    if (title.trim().length < 3) return setError('El concepto es muy corto');
    if (subtotalNum <= 0) return setError('El subtotal debe ser mayor a 0');

    setLoading(true);
    const result = await createManualInvoiceAction({
      client_id: clientId,
      title: title.trim(),
      description: description.trim() || undefined,
      subtotal: subtotalNum,
      taxes: computedTax,
      currency,
      due_date: dueDate,
      notes: notes.trim() || undefined,
    });
    setLoading(false);

    if (result?.error) return setError(result.error);
    if ('invoiceId' in result && result.invoiceId) {
      router.push(`/finance/${result.invoiceId}`);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !loading && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-photocan-amber" />
            Crear cobro manual
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
          <div className="space-y-2">
            <Label htmlFor="client">Cliente *</Label>
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecciona un cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Concepto *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              placeholder="Ej: Servicio de fotografía de producto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Descripción</Label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal *</Label>
              <Input
                id="subtotal"
                type="number"
                min={0}
                step="0.01"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* IVA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="taxes">IVA</Label>
              <label className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTax}
                  onChange={(e) => setAutoTax(e.target.checked)}
                  disabled={loading}
                  className="w-3.5 h-3.5 accent-photocan-amber"
                />
                Calcular 16% automático
              </label>
            </div>
            <Input
              id="taxes"
              type="number"
              min={0}
              step="0.01"
              value={autoTax ? computedTax : taxes}
              onChange={(e) => setTaxes(e.target.value)}
              disabled={loading || autoTax}
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-md bg-secondary/50 border border-border px-4 py-3">
            <span className="text-sm font-medium">Total</span>
            <span className="font-mono text-lg font-semibold">
              {formatCurrency(total, currency)}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due">Fecha de vencimiento *</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-background">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear cobro'}
          </Button>
        </div>
      </div>
    </>
  );
}
