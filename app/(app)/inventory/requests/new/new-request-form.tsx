'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
  Search,
  Check,
  Package,
  X,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createAssetRequestAction } from '@/lib/actions/asset-requests';

interface AvailableAsset {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  category: string;
  status: string;
  warehouse: { id: string; name: string } | null;
}

interface Props {
  availableAssets: AvailableAsset[];
  clients: Array<{ id: string; name: string }>;
}

export function NewRequestForm({ availableAssets, clients }: Props) {
  const router = useRouter();

  const [purpose, setPurpose] = useState('');
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );
  const [showSelector, setShowSelector] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAssets = useMemo(
    () => availableAssets.filter((a) => selectedAssetIds.has(a.id)),
    [availableAssets, selectedAssetIds]
  );

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!purpose.trim() || purpose.trim().length < 3) {
      setError('Describe el propósito de la solicitud');
      return;
    }

    if (selectedAssetIds.size === 0) {
      setError('Selecciona al menos un activo');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('La fecha de fin no puede ser anterior al inicio');
      return;
    }

    setIsLoading(true);

    const result = await createAssetRequestAction({
      purpose: purpose.trim(),
      client_id: clientId || null,
      start_date: startDate,
      end_date: endDate,
      asset_ids: Array.from(selectedAssetIds),
    });

    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    if (result && 'requestId' in result && result.requestId) {
      router.push(`/inventory/requests/${result.requestId}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Propósito */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Propósito
        </div>

        <div className="space-y-2">
          <Label htmlFor="purpose">¿Para qué necesitas el equipo? *</Label>
          <textarea
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            disabled={isLoading}
            rows={2}
            placeholder="Sesión fotográfica Café Lavanda - producto y ambiente"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
          />
        </div>

        {clients.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="client_id">Cliente relacionado (opcional)</Label>
            <select
              id="client_id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
            >
              <option value="">Sin cliente específico</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fechas */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Período de uso
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="start_date">Desde *</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              disabled={isLoading}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Hasta *</Label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              disabled={isLoading}
              min={startDate}
            />
          </div>
        </div>
      </div>

      {/* Activos seleccionados */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Activos a solicitar
            </div>
            <div className="text-sm">
              {selectedAssetIds.size}{' '}
              {selectedAssetIds.size === 1 ? 'activo' : 'activos'} seleccionados
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowSelector(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </Button>
        </div>

        {selectedAssets.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-6 text-center">
            <Package className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground mb-3">
              Selecciona los activos que necesitas
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowSelector(true)}
            >
              Buscar en catálogo
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedAssets.map((asset) => (
              <div
                key={asset.id}
                className="border border-border rounded-md p-3 flex items-center justify-between gap-2 bg-secondary/20"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center flex-shrink-0">
                    <Package className="w-3.5 h-3.5 text-photocan-amber-deep" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {asset.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[asset.brand, asset.model].filter(Boolean).join(' · ')}
                      {asset.warehouse && ` · en ${asset.warehouse.name}`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAsset(asset.id)}
                  disabled={isLoading}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 sticky bottom-4 bg-background border border-border rounded-lg p-4 shadow-lg">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/inventory/requests')}
          disabled={isLoading}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading || selectedAssetIds.size === 0}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar solicitud'
          )}
        </Button>
      </div>

      {/* Modal selector de activos */}
      {showSelector && (
        <AssetSelectorModal
          availableAssets={availableAssets}
          selectedIds={selectedAssetIds}
          onToggle={toggleAsset}
          onClose={() => setShowSelector(false)}
        />
      )}
    </form>
  );
}

// ============================================================
// MODAL SELECTOR DE ACTIVOS
// ============================================================

function AssetSelectorModal({
  availableAssets,
  selectedIds,
  onToggle,
  onClose,
}: {
  availableAssets: AvailableAsset[];
  selectedIds: Set<string>;
  onToggle: (assetId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = availableAssets;
    if (categoryFilter !== 'all') {
      result = result.filter((a) => a.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.brand?.toLowerCase().includes(q) ||
          a.model?.toLowerCase().includes(q) ||
          a.serial_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [availableAssets, search, categoryFilter]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-background border border-border rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold">Seleccionar activos</h3>
            <div className="text-xs text-muted-foreground">
              {selectedIds.size} seleccionado(s) de {availableAssets.length}{' '}
              disponibles
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
          >
            <option value="all">Todas las categorías</option>
            <option value="camera">Cámaras</option>
            <option value="lens">Lentes</option>
            <option value="audio">Audio</option>
            <option value="lighting">Iluminación</option>
            <option value="support">Soporte</option>
            <option value="storage">Almacenamiento</option>
            <option value="power">Energía</option>
            <option value="cable">Cables</option>
            <option value="computer">Cómputo</option>
            <option value="drone">Drones</option>
            <option value="accessory">Accesorios</option>
            <option value="other">Otro</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {availableAssets.length === 0
                ? 'No hay activos disponibles para solicitar.'
                : 'Sin resultados en este filtro.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((asset) => {
                const isSelected = selectedIds.has(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onToggle(asset.id)}
                    className={`w-full text-left p-3 border rounded-md transition-colors flex items-center gap-3 ${
                      isSelected
                        ? 'border-photocan-amber bg-photocan-amber/10'
                        : 'border-border bg-card hover:border-photocan-amber/30'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-photocan-amber border-photocan-amber'
                          : 'bg-background border-border'
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-black" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {asset.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[asset.brand, asset.model]
                          .filter(Boolean)
                          .join(' · ')}
                        {asset.warehouse && ` · en ${asset.warehouse.name}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex-shrink-0">
          <Button onClick={onClose} className="w-full">
            Listo ({selectedIds.size} seleccionados)
          </Button>
        </div>
      </div>
    </>
  );
}
