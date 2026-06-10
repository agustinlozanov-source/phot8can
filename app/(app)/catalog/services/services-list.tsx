'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, Layers, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Service } from '@/lib/types/database';

type FilterType = 'all' | 'atomic' | 'package' | 'addon' | 'archived';

export function ServicesList({
  services,
  canManage,
}: {
  services: Service[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    let result = services;

    // Filtro por tipo
    if (filter === 'archived') {
      result = result.filter((s) => s.archived_at !== null);
    } else if (filter === 'atomic') {
      result = result.filter(
        (s) => s.service_type === 'atomic' && !s.archived_at
      );
    } else if (filter === 'package') {
      result = result.filter(
        (s) => s.service_type === 'package' && !s.archived_at
      );
    } else if (filter === 'addon') {
      result = result.filter(
        (s) => s.service_type === 'addon' && !s.archived_at
      );
    } else {
      // 'all' = todos los no archivados
      result = result.filter((s) => !s.archived_at);
    }

    // Filtro por búsqueda
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.sku?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [services, filter, search]);

  return (
    <div>
      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, descripción o SKU..."
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
            label="Servicios"
            active={filter === 'atomic'}
            onClick={() => setFilter('atomic')}
          />
          <FilterButton
            label="Paquetes"
            active={filter === 'package'}
            onClick={() => setFilter('package')}
          />
          <FilterButton
            label="Addons"
            active={filter === 'addon'}
            onClick={() => setFilter('addon')}
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
                  Tipo
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  SKU
                </th>
                <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Precio
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((service) => (
                <tr
                  key={service.id}
                  onClick={() =>
                    router.push(`/catalog/services/${service.id}`)
                  }
                  className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <ServiceTypeBadge type={service.service_type} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{service.name}</div>
                    {service.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-md">
                        {service.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {service.sku || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono text-sm font-medium">
                      {formatPrice(service.default_price, service.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      por {service.unit}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {service.archived_at ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Archivado
                      </span>
                    ) : service.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Inactivo
                      </span>
                    )}
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
              : 'No hay elementos en este filtro'}
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

function ServiceTypeBadge({ type }: { type: 'atomic' | 'package' | 'addon' }) {
  const config = {
    atomic: {
      icon: Package,
      label: 'Servicio',
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      border: 'border-blue-500/30',
    },
    package: {
      icon: Layers,
      label: 'Paquete',
      bg: 'bg-photocan-amber/10',
      text: 'text-photocan-amber-deep',
      border: 'border-photocan-amber/30',
    },
    addon: {
      icon: Plus,
      label: 'Addon',
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      border: 'border-purple-500/30',
    },
  };

  const { icon: Icon, label, bg, text, border } = config[type];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-mono uppercase tracking-wider ${bg} ${text} ${border}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
