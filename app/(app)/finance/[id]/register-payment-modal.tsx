'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerPaymentAction } from '@/lib/actions/invoices';
import type { PaymentMethod } from '@/lib/types/database';
import { formatCurrency, PAYMENT_METHOD_LABEL } from '../finance-ui';

const METHODS: PaymentMethod[] = ['transfer', 'cash', 'card', 'check', 'other'];

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function RegisterPaymentModal({
  invoiceId,
  folio,
  total,
  currency,
  onClose,
}: {
  invoiceId: string;
  folio: string;
  total: number;
  currency: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [paymentDate, setPaymentDate] = useState(today());
  const [reference, setReference] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const result = await registerPaymentAction({
      invoice_id: invoiceId,
      amount: total,
      payment_method: method,
      payment_date: paymentDate,
      reference: reference.trim() || undefined,
      receipt_url: receiptUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setLoading(false);
    if (result?.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !loading && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-photocan-amber" />
            Registrar pago de {folio}
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
          {/* Monto destacado, no editable */}
          <div className="flex items-center justify-between rounded-md bg-secondary/50 border border-border px-4 py-3">
            <span className="text-sm font-medium">Monto a registrar</span>
            <span className="font-mono text-lg font-semibold">
              {formatCurrency(total, currency)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Solo se permiten pagos completos por ahora.
          </p>

          <div className="space-y-2">
            <Label htmlFor="method">Método de pago *</Label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdate">Fecha de pago *</Label>
            <Input
              id="pdate"
              type="date"
              max={today()}
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ref">Referencia</Label>
            <Input
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={loading}
              placeholder="Ej: Transferencia BBVA 123456"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt">URL de comprobante</Label>
            <Input
              id="receipt"
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              disabled={loading}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pnotes">Notas</Label>
            <textarea
              id="pnotes"
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

        <div className="p-5 border-t border-border flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar pago'}
          </Button>
        </div>
      </div>
    </>
  );
}
