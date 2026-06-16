'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSignature,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateContractFromQuoteAction } from '@/lib/actions/contracts';

interface Props {
  quoteId: string;
  clientName: string;
  clientLegalName: string | null;
  clientRfc: string | null;
  clientAddress: string | null;
  hasExistingContract: boolean;
}

type BillingCycle = 'monthly' | 'quarterly' | 'annual' | 'one_time';

export function GenerateContractButton({
  quoteId,
  clientName,
  clientLegalName,
  clientRfc,
  hasExistingContract,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [legalName, setLegalName] = useState(clientLegalName || clientName);
  const [rfc, setRfc] = useState(clientRfc || '');
  const [address, setAddress] = useState('');
  const [repName, setRepName] = useState('');
  const [repTitle, setRepTitle] = useState('');

  // Post-creación
  const [createdData, setCreatedData] = useState<{
    contractId: string;
    folio: string;
    token: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (hasExistingContract) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground border border-border rounded-md px-3 py-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        Esta cotización ya tiene un contrato generado
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (legalName.trim().length < 2) {
      setError('La razón social es requerida');
      return;
    }

    setIsLoading(true);
    const result = await generateContractFromQuoteAction({
      quote_id: quoteId,
      billing_cycle: billingCycle,
      start_date: startDate,
      client_legal_name: legalName.trim(),
      client_rfc: rfc.trim() || undefined,
      client_address: address.trim() || undefined,
      client_representative_name: repName.trim() || undefined,
      client_representative_title: repTitle.trim() || undefined,
    });
    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
    } else if (result?.contractId) {
      setCreatedData({
        contractId: result.contractId,
        folio: result.folio ?? '',
        token: result.token ?? null,
      });
    }
  }

  async function copyContractLink() {
    if (!createdData?.token) return;
    const url = `${window.location.origin}/c/${createdData.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        <FileSignature className="w-3.5 h-3.5" />
        Generar contrato
      </Button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !isLoading && setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background border border-border rounded-lg shadow-xl overflow-y-auto max-h-[90vh]">
        {createdData ? (
          // POST-CREACIÓN
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 grid place-items-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Contrato generado
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  Folio: {createdData.folio}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              El contrato está en estado <strong>borrador</strong>. Revísalo
              antes de enviarlo al cliente.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  router.refresh();
                }}
              >
                Cerrar
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  router.push(`/contracts/${createdData.contractId}`)
                }
              >
                <ExternalLink className="w-4 h-4" />
                Ver contrato
              </Button>
            </div>
          </div>
        ) : (
          // FORMULARIO
          <>
            <div className="p-6 border-b border-border flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Generar contrato</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Para {clientName}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={isLoading}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Plan */}
              <div className="space-y-2">
                <Label>Tipo de plan *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: 'monthly', label: 'Mensual' },
                      { value: 'quarterly', label: 'Trimestral' },
                      { value: 'annual', label: 'Anual' },
                      { value: 'one_time', label: 'Único' },
                    ] as { value: BillingCycle; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBillingCycle(opt.value)}
                      disabled={isLoading}
                      className={`p-3 rounded-md border text-sm font-medium transition-colors ${
                        billingCycle === opt.value
                          ? 'border-photocan-amber bg-photocan-amber/10 text-photocan-amber'
                          : 'border-border hover:border-photocan-amber/30 bg-card'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha inicio */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de inicio *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={isLoading}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Datos legales del cliente */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Datos legales del cliente
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legalName">Razón social *</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    required
                    disabled={isLoading}
                    placeholder="Ej: Café Lavanda SA de CV"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="rfc">RFC</Label>
                    <Input
                      id="rfc"
                      value={rfc}
                      onChange={(e) => setRfc(e.target.value.toUpperCase())}
                      disabled={isLoading}
                      placeholder="XAXX010101000"
                      maxLength={13}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repName">Representante legal</Label>
                    <Input
                      id="repName"
                      value={repName}
                      onChange={(e) => setRepName(e.target.value)}
                      disabled={isLoading}
                      placeholder="Nombre completo"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repTitle">Cargo del representante</Label>
                  <Input
                    id="repTitle"
                    value={repTitle}
                    onChange={(e) => setRepTitle(e.target.value)}
                    disabled={isLoading}
                    placeholder="Ej: Director General"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Domicilio fiscal</Label>
                  <textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isLoading}
                    rows={2}
                    placeholder="Calle, número, colonia, ciudad, estado, CP"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none disabled:opacity-50"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileSignature className="w-4 h-4" />
                      Generar contrato
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
