'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, AlertCircle, Wrench, CheckCircle2, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Asset, AssetCategory, AssetStatus } from '@/lib/types/database';

type AssetWithRelations = Asset & {
  warehouse: { id: string; name: string; type: string } | null;
  holder: { id: string; first_name: string; last_name: string } | null;
};

type FilterStatus = 'all' | AssetStatus;
type FilterCategory = 'all' | AssetCategory;

export function AssetsList({ assets }: { assets: AssetWithRelations[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  const filtered = useMemo(() => {
    let result = assets;

    if (filterStatus !== 'all') {
      result = result.filter((a) => a.status === filterStatus);
    }

    if (filterCategory !== 'all') {
      result = result.filter((a) => a.category === filterCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.brand?.toLowerCase().includes(q) ||
          item.model?.toLowerCase().includes(q) ||
          item.serial_number?.toLowerCase().includes(q) ||
          item.warehouse?.name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [assets, filterStatus, filterCategory, search]);

  // Conteos para los filtros
  const statusCounts = useMemo(() => {
    return {
      all: assets.length,
      available: assets.filter((a) => a.status === 'available').length,
      checked_out: assets.filter((a) => a.status === 'checked_out').length,
      in_maintenance: assets.filter((a) => a.status === 'in_maintenance').length,
      lost: assets.filter((a) => a.status === 'lost').length,
      retired: assets.filter((a) => a.status === 'retired').length,
    };
  }, [assets]);

  return (
    <div>
      {/* Búsqueda */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, marca, modelo, serie o almacén..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto">
          <FilterButton
            label="Todos"
            count={statusCounts.all}
            active={filterStatus === 'all'}
            onClick={() => setFilterStatus('all')}
          />
          <FilterButton
            label="Disponibles"
            count={statusCounts.available}
            active={filterStatus === 'available'}
            onClick={() => setFilterStatus('available')}
          />
          <FilterButton
            label="En mano"
            count={statusCounts.checked_out}
            active={filterStatus === 'checked_out'}
            onClick={() => setFilterStatus('checked_out')}
          />
          <FilterButton
            label="Mantenimiento"
            count={statusCounts.in_maintenance}
            active={filterStatus === 'in_maintenance'}
            onClick={() => setFilterStatus('in_maintenance')}
          />
          {statusCounts.lost > 0 && (
            <FilterButton
              label="Perdidos"
              count={statusCounts.lost}
              active={filterStatus === 'lost'}
              onClick={() => setFilterStatus('lost')}
            />
          )}
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
          className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
        >
          <option value="all">Todas las categorías</option>
          <option value="camera">Cámaras</option>
          <option value="lens">Lentes</option>
          <option value="audio">Audio</option>
          <option value="lighting">Iluminación</option>
          <option value="support">Soporte (trípodes, gimbals)</option>
          <option value="storage">Almacenamiento</option>
          <option value="power">Baterías y cargadores</option>
          <option value="cable">Cables</option>
          <option value="computer">Cómputo</option>
          <option value="drone">Drones</option>
          <option value="accessory">Accesorios</option>
          <option value="other">Otro</option>
        </select>
      </div>

      {/* Tabla */}
      {filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Activo
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Categoría
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ubicación
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Serie
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset) => (
                <tr
                  key={asset.id}
                  onClick={() => router.push(`/inventory/assets/${asset.id}`)}
                  className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{asset.name}</div>
                    {(asset.brand || asset.model) && (
                      <div className="text-xs text-muted-foreground">
                        {[asset.brand, asset.model].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      {getCategoryLabel(asset.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {asset.status === 'checked_out' && asset.holder ? (
                      <div>
                        <div className="text-photocan-amber-deep font-medium">
                          {asset.holder.first_name} {asset.holder.last_name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          (desde {asset.warehouse?.name || '—'})
                        </div>
                      </div>
                    ) : asset.warehouse ? (
                      asset.warehouse.name
                    ) : (
                      <span className="text-muted-foreground italic">
                        Sin almacén
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={asset.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      {asset.serial_number || '—'}
                    </span>
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
              : 'No hay activos en este filtro'}
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
        className={`font-mono text-[10px] ${
          active ? 'text-black/70' : 'text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: AssetStatus }) {
  const config = {
    available: {
      label: 'Disponible',
      color: 'text-green-500',
      Icon: CheckCircle2,
    },
    checked_out: {
      label: 'En mano',
      color: 'text-photocan-amber-deep',
      Icon: Send,
    },
    in_maintenance: {
      label: 'Mantenimiento',
      color: 'text-blue-500',
      Icon: Wrench,
    },
    lost: {
      label: 'Perdido',
      color: 'text-destructive',
      Icon: AlertCircle,
    },
    retired: {
      label: 'Baja',
      color: 'text-muted-foreground',
      Icon: Package,
    },
  };
  const { label, color, Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function getCategoryLabel(category: AssetCategory): string {
  const labels: Record<AssetCategory, string> = {
    camera: 'Cámara',
    lens: 'Lente',
    audio: 'Audio',
    lighting: 'Iluminación',
    support: 'Soporte',
    storage: 'Almacenamiento',
    power: 'Energía',
    cable: 'Cable',
    computer: 'Cómputo',
    drone: 'Drone',
    accessory: 'Accesorio',
    other: 'Otro',
  };
  return labels[category];
}
