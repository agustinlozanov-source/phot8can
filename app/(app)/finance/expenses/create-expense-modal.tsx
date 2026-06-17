'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  AlertCircle,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createExpenseAction } from '@/lib/actions/expenses';
import type { PaymentMethod } from '@/lib/types/database';
import { formatCurrency, PAYMENT_METHOD_LABEL } from '../finance-ui';

type VendorOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; color: string; icon: string | null };

const CURRENCIES = ['MXN', 'USD', 'EUR'];
const METHODS: PaymentMethod[] = ['transfer', 'cash', 'card', 'check', 'other'];
type TaxMode = 'auto' | 'manual' | 'none';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function CreateExpenseModal({
  vendors,
  categories,
  onClose,
}: {
  vendors: VendorOption[];
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  // Sección 1
  const [freeVendor, setFreeVendor] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [concept, setConcept] = useState('');
  const [description, setDescription] = useState('');
  // Sección 2
  const [subtotal, setSubtotal] = useState('');
  const [taxMode, setTaxMode] = useState<TaxMode>('auto');
  const [manualTax, setManualTax] = useState('');
  const [currency, setCurrency] = useState('MXN');
  // Sección 3
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [paidDate, setPaidDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  // Sección 4
  const [refOpen, setRefOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotalNum = parseFloat(subtotal) || 0;
  const taxes =
    taxMode === 'auto'
      ? Math.round(subtotalNum * 0.16 * 100) / 100
      : taxMode === 'none'
        ? 0
        : parseFloat(manualTax) || 0;
  const total = Math.round((subtotalNum + taxes) * 100) / 100;

  async function handleSubmit() {
    setError(null);
    if (!freeVendor && !vendorId) return setError('Selecciona un proveedor');
    if (freeVendor && !vendorName.trim())
      return setError('Escribe el nombre del proveedor');
    if (!categoryId) return setError('Selecciona una categoría');
    if (concept.trim().length < 3) return setError('El concepto es muy corto');
    if (subtotalNum <= 0) return setError('El subtotal debe ser mayor a 0');
    if (alreadyPaid && !method) return setError('Indica el método de pago');

    setLoading(true);
    const result = await createExpenseAction({
      vendor_id: freeVendor ? null : vendorId,
      vendor_name: freeVendor ? vendorName.trim() : undefined,
      category_id: categoryId,
      concept: concept.trim(),
      description: description.trim() || undefined,
      subtotal: subtotalNum,
      taxes,
      currency,
      issue_date: issueDate,
      due_date: dueDate || undefined,
      reference: reference.trim() || undefined,
      receipt_url: receiptUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      status: alreadyPaid ? 'paid' : 'pending',
      payment_method: alreadyPaid ? method : undefined,
      paid_at: alreadyPaid ? new Date(paidDate).toISOString() : undefined,
    });
    setLoading(false);

    if (result?.error) return setError(result.error);
    if ('expenseId' in result && result.expenseId) {
      router.push(`/finance/expenses/${result.expenseId}`);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => !loading && onClose()} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-photocan-amber" />
            Registrar gasto
          </h3>
          <button onClick={onClose} disabled={loading} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* SECCIÓN 1 */}
          <SectionTitle>Información básica</SectionTitle>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Proveedor *</Label>
                <label className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freeVendor}
                    onChange={(e) => setFreeVendor(e.target.checked)}
                    disabled={loading}
                    className="w-3.5 h-3.5 accent-photocan-amber"
                  />
                  Otro (texto libre)
                </label>
              </div>
              {freeVendor ? (
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  disabled={loading}
                  placeholder="Nombre del proveedor"
                />
              ) : (
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecciona un proveedor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría *</Label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecciona una categoría...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="concept">Concepto *</Label>
              <Input
                id="concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                disabled={loading}
                placeholder="Ej: Renta oficina marzo"
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
          </div>

          {/* SECCIÓN 2 */}
          <SectionTitle>Montos</SectionTitle>
          <div className="space-y-4">
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

            <div className="space-y-2">
              <Label>IVA</Label>
              <div className="flex gap-1 border border-border rounded-md p-1 bg-card">
                <TaxBtn active={taxMode === 'auto'} onClick={() => setTaxMode('auto')} label="16% automático" />
                <TaxBtn active={taxMode === 'manual'} onClick={() => setTaxMode('manual')} label="Manual" />
                <TaxBtn active={taxMode === 'none'} onClick={() => setTaxMode('none')} label="Sin IVA" />
              </div>
              {taxMode === 'manual' ? (
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualTax}
                  onChange={(e) => setManualTax(e.target.value)}
                  disabled={loading}
                  placeholder="Monto de IVA"
                />
              ) : (
                <div className="text-xs font-mono text-muted-foreground">
                  IVA: {formatCurrency(taxes, currency)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md bg-secondary/50 border border-border px-4 py-3">
              <span className="text-sm font-medium">Total</span>
              <span className="font-mono text-lg font-semibold">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </div>

          {/* SECCIÓN 3 */}
          <SectionTitle>Fechas y pago</SectionTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="issue">Fecha de emisión *</Label>
                <Input
                  id="issue"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due">Vencimiento</Label>
                <Input
                  id="due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={alreadyPaid}
                onChange={(e) => setAlreadyPaid(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 accent-photocan-amber"
              />
              Ya está pagado
            </label>

            {alreadyPaid && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="paid_date">Fecha de pago</Label>
                  <Input
                    id="paid_date"
                    type="date"
                    max={today()}
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method">Método *</Label>
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
              </div>
            )}
          </div>

          {/* SECCIÓN 4 (colapsable) */}
          <div>
            <button
              onClick={() => setRefOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {refOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Referencias (opcional)
            </button>
            {refOpen && (
              <div className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="ref">Referencia / folio del proveedor</Label>
                  <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receipt">URL de comprobante</Label>
                  <Input id="receipt" type="url" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} disabled={loading} placeholder="https://..." />
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
              </div>
            )}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
          </Button>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-wider text-photocan-amber border-b border-border pb-1">
      {children}
    </div>
  );
}

function TaxBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {label}
    </button>
  );
}
