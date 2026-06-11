'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Quote, QuoteStatus } from '@/lib/types/database';

type QuoteWithClient = Quote & {
  client: {
    id: string;
    name: string;
    legal_name: string | null;
  } | null;
};

type FilterStatus = 'all' | QuoteStatus | 'pipeline';

export function QuotesList({ quotes }: { quotes: QuoteWithClient[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = useMemo(() => {
    let result = quotes;

    // Filtro por estado
    if (filter === 'pipeline') {
      result = result.filter((q) => ['sent', 'viewed'].includes(q.status));
    } else if (filter !== 'all') {
      result = result.filter((q) => q.status === filter);
    }

    // Filtro por búsqueda
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.folio.toLowerCase().includes(q) ||
          item.title?.toLowerCase().includes(q) ||
          item.client?.name.toLowerCase().includes(q) ||
          item.client?.legal_name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [quotes, filter, search]);

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
            label="Todas"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            label="Borradores"
            active={filter === 'draft'}
            onClick={() => setFilter('draft')}
          />
          <FilterButton
            label="Pipeline"
            active={filter === 'pipeline'}
            onClick={() => setFilter('pipeline')}
          />
          <FilterButton
            label="Aprobadas"
            active={filter === 'approved'}
            onClick={() => setFilter('approved')}
          />
          <FilterButton
            label="Rechazadas"
            active={filter === 'rejected'}
            onClick={() => setFilter('rejected')}
          />
        </div>
      </div>

      {/* Lista */}
      {filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Folio
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cliente / Título
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Vigencia
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Emisión
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quote) => {
                const expired = isExpired(quote.valid_until, quote.status);

                return (
                  <tr
                    key={quote.id}
                    onClick={() => router.push(`/quotes/${quote.id}`)}
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {quote.folio}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {quote.client?.name || 'Cliente eliminado'}
                      </div>
                      {quote.title && (
                        <div className="text-xs text-muted-foreground truncate max-w-md">
                          {quote.title}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={quote.status} expired={expired} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-mono text-sm font-medium">
                        {formatPrice(Number(quote.total), quote.currency)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      <div className="flex items-center gap-1.5">
                        {expired && (
                          <AlertCircle className="w-3 h-3 text-destructive" />
                        )}
                        {new Date(quote.valid_until).toLocaleDateString(
                          'es-MX',
                          {
                            day: '2-digit',
                            month: 'short',
                          }
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {new Date(quote.issue_date).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <div className="text-sm text-muted-foreground">
            {search.trim()
              ? `No hay resultados para "${search}"`
              : 'No hay cotizaciones en este filtro'}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({
  status,
  expired,
}: {
  status: QuoteStatus;
  expired: boolean;
}) {
  // Si está vencida y no decidida, mostrar "Vencida"
  if (expired && ['sent', 'viewed'].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-destructive">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
        Vencida
      </span>
    );
  }

  const config: Record<
    QuoteStatus,
    { label: string; color: string; bg: string }
  > = {
    draft: {
      label: 'Borrador',
      color: 'text-muted-foreground',
      bg: 'bg-muted-foreground',
    },
    sent: {
      label: 'Enviada',
      color: 'text-photocan-amber',
      bg: 'bg-photocan-amber',
    },
    viewed: {
      label: 'Vista',
      color: 'text-blue-500',
      bg: 'bg-blue-500',
    },
    approved: {
      label: 'Aprobada',
      color: 'text-green-500',
      bg: 'bg-green-500',
    },
    rejected: {
      label: 'Rechazada',
      color: 'text-destructive',
      bg: 'bg-destructive',
    },
    expired: {
      label: 'Vencida',
      color: 'text-destructive',
      bg: 'bg-destructive',
    },
  };

  const { label, color, bg } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono ${color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${bg}`} />
      {label}
    </span>
  );
}

function isExpired(validUntil: string, status: QuoteStatus): boolean {
  if (status === 'approved' || status === 'rejected') return false;
  return new Date(validUntil) < new Date();
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
