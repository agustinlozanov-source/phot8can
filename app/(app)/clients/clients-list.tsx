'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2, Mail, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Client } from '@/lib/types/database';

type ClientWithContacts = Client & {
  contacts: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    is_primary: boolean;
  }>;
};

type FilterStatus = 'all' | 'active' | 'paused' | 'archived';

export function ClientsList({ clients }: { clients: ClientWithContacts[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = useMemo(() => {
    let result = clients;

    // Filtro por estado
    if (filter === 'archived') {
      result = result.filter((c) => c.archived_at !== null);
    } else if (filter === 'active') {
      result = result.filter(
        (c) => c.status === 'active' && c.archived_at === null
      );
    } else if (filter === 'paused') {
      result = result.filter(
        (c) => c.status === 'paused' && c.archived_at === null
      );
    } else {
      // 'all' = todos los no archivados
      result = result.filter((c) => c.archived_at === null);
    }

    // Filtro por búsqueda
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.legal_name?.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q) ||
          c.tax_id?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [clients, filter, search]);

  return (
    <div>
      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, razón social, industria o RFC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 border border-border rounded-md p-1 bg-card">
          <FilterButton
            label="Todos"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            label="Activos"
            active={filter === 'active'}
            onClick={() => setFilter('active')}
          />
          <FilterButton
            label="En pausa"
            active={filter === 'paused'}
            onClick={() => setFilter('paused')}
          />
          <FilterButton
            label="Archivados"
            active={filter === 'archived'}
            onClick={() => setFilter('archived')}
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
                  Cliente
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Contacto principal
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Industria
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
              {filtered.map((client) => {
                const primaryContact =
                  client.contacts.find((c) => c.is_primary) ||
                  client.contacts[0];

                return (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-secondary border border-border grid place-items-center text-xs font-bold text-muted-foreground flex-shrink-0">
                          {client.logo_url ? (
                            <img
                              src={client.logo_url}
                              alt={client.name}
                              className="w-full h-full rounded object-cover"
                            />
                          ) : (
                            client.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {client.name}
                          </div>
                          {client.legal_name && (
                            <div className="text-xs text-muted-foreground truncate">
                              {client.legal_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {primaryContact ? (
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-3 h-3 text-muted-foreground" />
                          <div>
                            <div className="text-sm">
                              {primaryContact.first_name}{' '}
                              {primaryContact.last_name}
                            </div>
                            <div className="text-xs font-mono text-muted-foreground">
                              {primaryContact.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Sin contactos
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {client.industry || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={client.status}
                        archived={!!client.archived_at}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {new Date(client.created_at).toLocaleDateString('es-MX', {
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
              : 'No hay clientes en este filtro'}
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
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
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
  archived,
}: {
  status: 'active' | 'paused' | 'churned';
  archived: boolean;
}) {
  if (archived) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
        Archivado
      </span>
    );
  }

  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Activo
      </span>
    );
  }

  if (status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-photocan-amber">
        <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
        En pausa
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
      Inactivo
    </span>
  );
}
