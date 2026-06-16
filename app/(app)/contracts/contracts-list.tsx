'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  FileSignature,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Contract, ContractStatus } from '@/lib/types/database';

type ContractWithRelations = Contract & {
  client: { id: string; name: string } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
};

type FilterStatus = 'all' | ContractStatus;

export function ContractsList({
  contracts,
}: {
  contracts: ContractWithRelations[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = useMemo(() => {
    let result = contracts;

    if (filter !== 'all') {
      result = result.filter((c) => c.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.folio.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.client?.name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [contracts, filter, search]);

  const counts = useMemo(() => {
    return {
      all: contracts.length,
      draft: contracts.filter((c) => c.status === 'draft').length,
      sent: contracts.filter((c) =>
        ['sent', 'viewed'].includes(c.status)
      ).length,
      signed: contracts.filter((c) => c.status === 'signed').length,
      cancelled: contracts.filter((c) => c.status === 'cancelled').length,
      expired: contracts.filter((c) => c.status === 'expired').length,
    };
  }, [contracts]);

  return (
    <div>
      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, título o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto">
          <FilterButton
            label="Todos"
            count={counts.all}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            label="Borrador"
            count={counts.draft}
            active={filter === 'draft'}
            onClick={() => setFilter('draft')}
          />
          <FilterButton
            label="Enviados"
            count={counts.sent}
            active={filter === 'sent'}
            onClick={() => setFilter('sent')}
          />
          <FilterButton
            label="Firmados"
            count={counts.signed}
            active={filter === 'signed'}
            onClick={() => setFilter('signed')}
          />
          {counts.expired > 0 && (
            <FilterButton
              label="Vencidos"
              count={counts.expired}
              active={filter === 'expired'}
              onClick={() => setFilter('expired')}
            />
          )}
          {counts.cancelled > 0 && (
            <FilterButton
              label="Cancelados"
              count={counts.cancelled}
              active={filter === 'cancelled'}
              onClick={() => setFilter('cancelled')}
            />
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Folio
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Plan
                </th>
                <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Importe
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Creado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contract) => (
                <tr
                  key={contract.id}
                  onClick={() => router.push(`/contracts/${contract.id}`)}
                  className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-medium">
                      {contract.folio}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {contract.title}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {contract.client?.name || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <BillingCycleBadge cycle={contract.billing_cycle} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                    {formatCurrency(contract.total_amount, contract.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={contract.status}
                      expiresAt={contract.expires_at}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {new Date(contract.created_at).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <div className="text-sm text-muted-foreground">
            {search.trim()
              ? `No hay resultados para "${search}"`
              : 'No hay contratos en este filtro'}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {label}
      <span
        className={`font-mono tabular-nums ${
          active ? 'text-black/70' : 'text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({
  status,
  expiresAt,
}: {
  status: ContractStatus;
  expiresAt: string;
}) {
  const isNearExpiry =
    ['sent', 'viewed'].includes(status) &&
    new Date(expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 &&
    new Date(expiresAt).getTime() > Date.now();

  const isExpired =
    ['sent', 'viewed'].includes(status) &&
    new Date(expiresAt).getTime() < Date.now();

  const config: Record<
    ContractStatus,
    { label: string; icon: React.ReactNode; color: string; dot: string }
  > = {
    draft: {
      label: 'Borrador',
      icon: <FileSignature className="w-3 h-3" />,
      color: 'text-muted-foreground',
      dot: 'bg-muted-foreground',
    },
    sent: {
      label: 'Enviado',
      icon: <Send className="w-3 h-3" />,
      color: 'text-photocan-amber',
      dot: 'bg-photocan-amber',
    },
    viewed: {
      label: 'Visto',
      icon: <Eye className="w-3 h-3" />,
      color: 'text-blue-500',
      dot: 'bg-blue-500',
    },
    signed: {
      label: 'Firmado',
      icon: <CheckCircle2 className="w-3 h-3" />,
      color: 'text-green-500',
      dot: 'bg-green-500',
    },
    cancelled: {
      label: 'Cancelado',
      icon: <XCircle className="w-3 h-3" />,
      color: 'text-destructive',
      dot: 'bg-destructive',
    },
    expired: {
      label: 'Vencido',
      icon: <Clock className="w-3 h-3" />,
      color: 'text-destructive',
      dot: 'bg-destructive',
    },
  };

  const effectiveStatus = isExpired && status !== 'signed' ? 'expired' : status;
  const { label, icon, color } = config[effectiveStatus] ?? config[status];

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-mono ${color}`}
      >
        {icon}
        {label}
      </span>
      {isNearExpiry && (
        <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-mono">
          <AlertCircle className="w-3 h-3" />
          Próx. a vencer
        </span>
      )}
    </div>
  );
}

function BillingCycleBadge({ cycle }: { cycle: string }) {
  const labels: Record<string, string> = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    annual: 'Anual',
    one_time: 'Único',
  };
  return (
    <span className="text-xs font-mono text-muted-foreground">
      {labels[cycle] || cycle}
    </span>
  );
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
