'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Invoice, InvoiceStatus } from '@/lib/types/database';
import {
  InvoiceStatusBadge,
  formatCurrency,
  formatDate,
  dueDateInfo,
  TONE_CLASS,
} from '../finance-ui';
import { CreateInvoiceModal } from './create-invoice-modal';

type InvoiceRow = Invoice & {
  client: { id: string; name: string; legal_name: string | null } | null;
};

type FilterKey = 'all' | InvoiceStatus;

type ClientOption = { id: string; name: string };

export function InvoicesList({
  invoices,
  clients,
  canManage,
}: {
  invoices: InvoiceRow[];
  clients: ClientOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(() => {
    const c = (s: InvoiceStatus) =>
      invoices.filter((i) => i.status === s).length;
    return {
      all: invoices.length,
      pending: c('pending'),
      overdue: c('overdue'),
      paid: c('paid'),
      cancelled: c('cancelled'),
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    let result = invoices;
    if (filter !== 'all') result = result.filter((i) => i.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.folio.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.client?.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [invoices, filter, search]);

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, concepto o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto">
          <FilterButton label="Todos" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterButton label="Pendientes" count={counts.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} />
          {counts.overdue > 0 && (
            <FilterButton
              label="Vencidos"
              count={counts.overdue}
              active={filter === 'overdue'}
              onClick={() => setFilter('overdue')}
              alert
            />
          )}
          <FilterButton label="Pagados" count={counts.paid} active={filter === 'paid'} onClick={() => setFilter('paid')} />
          {counts.cancelled > 0 && (
            <FilterButton label="Cancelados" count={counts.cancelled} active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} />
          )}
        </div>

        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Crear cobro manual
          </Button>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="text-sm text-muted-foreground max-w-md mx-auto">
            No hay cobros todavía. Se generan automáticamente al iniciar
            períodos de suscripción. También puedes crear cobros manuales desde
            el botón.
          </div>
        </div>
      ) : filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <Th>Folio</Th>
                <Th>Cliente</Th>
                <Th>Concepto</Th>
                <Th className="text-right">Total</Th>
                <Th>Emitido</Th>
                <Th>Vencimiento</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const dd = dueDateInfo(inv.due_date, inv.status);
                return (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/finance/${inv.id}`)}
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {inv.folio}
                    </td>
                    <td className="px-4 py-3">{inv.client?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="truncate inline-block max-w-[260px] align-middle">
                        {inv.title}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatCurrency(Number(inv.total), inv.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {formatDate(inv.issue_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${TONE_CLASS[dd.tone]}`}>
                        {dd.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          {search.trim()
            ? `No hay resultados para "${search}"`
            : 'No hay cobros en este filtro'}
        </div>
      )}

      {createOpen && (
        <CreateInvoiceModal
          clients={clients}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
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
    <th
      className={`px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground ${
        className || 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
  alert,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  alert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? 'bg-photocan-amber text-black'
          : alert
            ? 'text-destructive hover:bg-destructive/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {alert && !active && <AlertCircle className="w-3 h-3" />}
      {label}
      <span
        className={`font-mono tabular-nums ${active ? 'text-black/70' : 'text-muted-foreground'}`}
      >
        {count}
      </span>
    </button>
  );
}
