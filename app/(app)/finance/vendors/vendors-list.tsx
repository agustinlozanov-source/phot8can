'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Eye,
  Edit2,
  Power,
  Loader2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Vendor } from '@/lib/types/database';
import { setVendorActiveAction } from '@/lib/actions/vendors';
import { formatCurrency } from '../finance-ui';
import { VendorModal } from './vendor-modal';

type VendorRow = Vendor & { total_expenses: number; total_paid: number };

export function VendorsList({
  vendors,
  canManage,
}: {
  vendors: VendorRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { mode: 'create' | 'edit'; vendor?: Vendor }>(
    null
  );

  const filtered = useMemo(() => {
    let result = vendors;
    if (!showInactive) result = result.filter((v) => v.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((v) => v.name.toLowerCase().includes(q));
    }
    return result;
  }, [vendors, showInactive, search]);

  async function toggleActive(v: VendorRow) {
    if (!confirm(`¿${v.is_active ? 'Desactivar' : 'Reactivar'} a ${v.name}?`))
      return;
    setError(null);
    setLoading(`active-${v.id}`);
    const result = await setVendorActiveAction({
      vendor_id: v.id,
      is_active: !v.is_active,
    });
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  if (vendors.length === 0) {
    return (
      <>
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
            <Building2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="font-medium mb-2">Sin proveedores todavía</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Agrega proveedores para trackear quién recibe pagos del negocio.
          </p>
          {canManage && (
            <Button onClick={() => setModal({ mode: 'create' })}>
              <Plus className="w-4 h-4" />
              Agregar mi primer proveedor
            </Button>
          )}
        </div>
        {modal && (
          <VendorModal mode={modal.mode} vendor={modal.vendor} onClose={() => setModal(null)} />
        )}
      </>
    );
  }

  return (
    <div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap px-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 accent-photocan-amber"
          />
          Mostrar inactivos
        </label>
        {canManage && (
          <Button onClick={() => setModal({ mode: 'create' })}>
            <Plus className="w-4 h-4" />
            Agregar proveedor
          </Button>
        )}
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <Th>Proveedor</Th>
              <Th>RFC</Th>
              <Th>Contacto</Th>
              <Th>Gastos</Th>
              <Th>Estado</Th>
              {canManage && <Th> </Th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3">
                  <button
                    onClick={() => router.push(`/finance/vendors/${v.id}`)}
                    className="text-left hover:text-photocan-amber transition-colors"
                  >
                    <div className="font-medium">{v.name}</div>
                    {v.legal_name && (
                      <div className="text-xs text-muted-foreground">{v.legal_name}</div>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{v.tax_id || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {v.email && <div>{v.email}</div>}
                  {v.phone && <div>{v.phone}</div>}
                  {!v.email && !v.phone && '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <span className="font-medium">{v.total_expenses}</span>{' '}
                  <span className="text-muted-foreground">gastos · </span>
                  <span className="text-green-500">
                    {formatCurrency(v.total_paid, 'MXN')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge active={v.is_active} />
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Ver detalles" onClick={() => router.push(`/finance/vendors/${v.id}`)}>
                        <Eye className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn title="Editar" onClick={() => { setError(null); setModal({ mode: 'edit', vendor: v }); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn
                        title={v.is_active ? 'Desactivar' : 'Reactivar'}
                        onClick={() => toggleActive(v)}
                        disabled={loading === `active-${v.id}`}
                        danger={v.is_active}
                      >
                        {loading === `active-${v.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                      </IconBtn>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground mt-3">
          No hay proveedores que coincidan.
        </div>
      )}

      {modal && (
        <VendorModal mode={modal.mode} vendor={modal.vendor} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded ${
        active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 grid place-items-center rounded-md border border-border hover:bg-secondary transition-colors disabled:opacity-40 ${
        danger ? 'hover:text-destructive' : ''
      }`}
    >
      {children}
    </button>
  );
}
