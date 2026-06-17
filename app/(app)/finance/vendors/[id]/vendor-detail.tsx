'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Edit2,
  Power,
  Loader2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  Calendar,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setVendorActiveAction } from '@/lib/actions/vendors';
import type { Vendor, VendorAddress } from '@/lib/types/database';
import {
  ExpenseStatusBadge,
  formatCurrency,
  formatDate,
  formatDateTime,
} from '../../finance-ui';
import { VendorModal } from '../vendor-modal';

type VendorExpense = {
  id: string;
  folio: string;
  concept: string;
  total: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled';
  issue_date: string;
};

export function VendorDetail({
  vendor,
  expenses,
  canManage,
}: {
  vendor: Vendor;
  expenses: VendorExpense[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addr = (vendor.address as VendorAddress | null) || {};
  const hasAddr = !!(addr.street || addr.city || addr.state || addr.postal_code);

  const paidTotal = expenses
    .filter((e) => e.status === 'paid')
    .reduce((s, e) => s + Number(e.total), 0);
  const currency = expenses[0]?.currency || 'MXN';

  async function toggleActive() {
    if (!confirm(`¿${vendor.is_active ? 'Desactivar' : 'Reactivar'} a ${vendor.name}?`))
      return;
    setError(null);
    setLoading(true);
    const result = await setVendorActiveAction({
      vendor_id: vendor.id,
      is_active: !vendor.is_active,
    });
    setLoading(false);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary border border-border grid place-items-center">
            <Building2 className="w-6 h-6 text-photocan-amber" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{vendor.name}</h1>
              <StatusBadge active={vendor.is_active} />
            </div>
            {vendor.legal_name && (
              <div className="text-sm text-muted-foreground">{vendor.legal_name}</div>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={loading}>
              <Edit2 className="w-3.5 h-3.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleActive}
              disabled={loading}
              className={vendor.is_active ? 'text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30' : ''}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
              {vendor.is_active ? 'Desactivar' : 'Reactivar'}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Histórico de gastos */}
        <div className="min-w-0">
          <section className="border border-border rounded-lg bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-photocan-amber" />
                <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
                  Histórico de gastos
                </h2>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {expenses.length} recientes ·{' '}
                <span className="text-green-500">{formatCurrency(paidTotal, currency)}</span> pagado
              </div>
            </div>

            {expenses.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Este proveedor no tiene gastos registrados.
              </div>
            ) : (
              <>
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        <Th>Folio</Th>
                        <Th>Concepto</Th>
                        <Th>Fecha</Th>
                        <Th className="text-right">Total</Th>
                        <Th>Estado</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => router.push(`/finance/expenses/${e.id}`)}
                          className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 font-mono text-xs font-medium">{e.folio}</td>
                          <td className="px-3 py-2 truncate max-w-[180px]">{e.concept}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                            {formatDate(e.issue_date)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatCurrency(Number(e.total), e.currency)}
                          </td>
                          <td className="px-3 py-2">
                            <ExpenseStatusBadge status={e.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {expenses.length >= 10 && (
                  <a
                    href={`/finance/expenses?vendor=${vendor.id}`}
                    className="inline-block text-xs font-mono text-photocan-amber-deep hover:underline mt-3"
                  >
                    Ver todos los gastos de este proveedor
                  </a>
                )}
              </>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Información
            </div>
            {vendor.tax_id && <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="RFC" value={vendor.tax_id} mono />}
            {vendor.email && <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={vendor.email} />}
            {vendor.phone && <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Teléfono" value={vendor.phone} />}
            {vendor.website && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Globe className="w-3.5 h-3.5" />
                  Website
                </div>
                <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-photocan-amber-deep hover:underline break-all">
                  {vendor.website}
                </a>
              </div>
            )}
            {hasAddr && (
              <div className="pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Dirección
                </div>
                <div className="text-sm">
                  {[addr.street, addr.city, addr.state, addr.postal_code, addr.country]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              </div>
            )}
            {vendor.notes && (
              <div className="pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground mb-0.5">Notas</div>
                <div className="text-sm whitespace-pre-wrap">{vendor.notes}</div>
              </div>
            )}
          </div>

          <div className="border border-border rounded-lg bg-card p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Auditoría
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Creado:</span>
              <span className="font-mono">{formatDateTime(vendor.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {editOpen && (
        <VendorModal mode="edit" vendor={vendor} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground ${className || 'text-left'}`}>
      {children}
    </th>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <div className={`text-sm ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
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
