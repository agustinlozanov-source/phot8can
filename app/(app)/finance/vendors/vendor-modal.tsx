'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createVendorAction, updateVendorAction } from '@/lib/actions/vendors';
import type { Vendor, VendorAddress } from '@/lib/types/database';

interface Props {
  mode: 'create' | 'edit';
  vendor?: Vendor;
  onClose: () => void;
}

export function VendorModal({ mode, vendor, onClose }: Props) {
  const router = useRouter();
  const addr = (vendor?.address as VendorAddress | null) || {};

  const [name, setName] = useState(vendor?.name ?? '');
  const [legalName, setLegalName] = useState(vendor?.legal_name ?? '');
  const [taxId, setTaxId] = useState(vendor?.tax_id ?? '');
  const [email, setEmail] = useState(vendor?.email ?? '');
  const [phone, setPhone] = useState(vendor?.phone ?? '');
  const [website, setWebsite] = useState(vendor?.website ?? '');
  const [street, setStreet] = useState(addr.street ?? '');
  const [city, setCity] = useState(addr.city ?? '');
  const [state, setState] = useState(addr.state ?? '');
  const [country, setCountry] = useState(addr.country ?? 'México');
  const [postalCode, setPostalCode] = useState(addr.postal_code ?? '');
  const [notes, setNotes] = useState(vendor?.notes ?? '');
  const [addrOpen, setAddrOpen] = useState(
    !!(addr.street || addr.city || addr.state)
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (name.trim().length < 1) return setError('El nombre es obligatorio');

    const hasAddress = street || city || state || postalCode;
    const address: VendorAddress | null = hasAddress
      ? {
          street: street.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          country: country.trim() || undefined,
          postal_code: postalCode.trim() || undefined,
        }
      : null;

    const payload = {
      name: name.trim(),
      legal_name: legalName.trim() || null,
      tax_id: taxId.trim() || null,
      email: email.trim(),
      phone: phone.trim() || null,
      website: website.trim(),
      address,
      notes: notes.trim() || null,
    };

    setLoading(true);
    const result =
      mode === 'create'
        ? await createVendorAction(payload)
        : await updateVendorAction({ id: vendor!.id, ...payload });
    setLoading(false);

    if (result?.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => !loading && onClose()} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-photocan-amber" />
            {mode === 'create' ? 'Agregar proveedor' : 'Editar proveedor'}
          </h3>
          <button onClick={onClose} disabled={loading} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Identidad */}
          <SectionTitle>Identidad</SectionTitle>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} placeholder="Ej: Adobe, Renta oficina..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="legal">Razón social</Label>
                <Input id="legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfc">RFC</Label>
                <Input id="rfc" value={taxId} onChange={(e) => setTaxId(e.target.value)} disabled={loading} />
              </div>
            </div>
          </div>

          {/* Contacto */}
          <SectionTitle>Contacto</SectionTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="web">Website</Label>
              <Input id="web" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={loading} placeholder="https://..." />
            </div>
          </div>

          {/* Dirección (colapsable) */}
          <div>
            <button
              onClick={() => setAddrOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-photocan-amber"
            >
              {addrOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Dirección
            </button>
            {addrOpen && (
              <div className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="street">Calle</Label>
                  <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} disabled={loading} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">Ciudad</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input id="state" value={state} onChange={(e) => setState(e.target.value)} disabled={loading} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="country">País</Label>
                    <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp">Código postal</Label>
                    <Input id="cp" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} disabled={loading} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <SectionTitle>Notas</SectionTitle>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
          />

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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
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
