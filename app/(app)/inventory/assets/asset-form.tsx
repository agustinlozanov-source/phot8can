'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createAssetAction,
  updateAssetAction,
} from '@/lib/actions/assets';
import type { Asset, AssetCategory } from '@/lib/types/database';

interface Props {
  mode: 'create' | 'edit';
  asset?: Asset;
  warehouses: Array<{ id: string; name: string; type: string }>;
}

export function AssetForm({ mode, asset, warehouses }: Props) {
  const router = useRouter();

  const [name, setName] = useState(asset?.name || '');
  const [brand, setBrand] = useState(asset?.brand || '');
  const [model, setModel] = useState(asset?.model || '');
  const [serialNumber, setSerialNumber] = useState(asset?.serial_number || '');
  const [category, setCategory] = useState<AssetCategory>(
    asset?.category || 'other'
  );
  const [warehouseId, setWarehouseId] = useState(
    asset?.current_warehouse_id || warehouses[0]?.id || ''
  );
  const [estimatedValue, setEstimatedValue] = useState(
    asset?.estimated_value?.toString() || ''
  );
  const [currency, setCurrency] = useState(asset?.currency || 'MXN');
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchase_date || '');
  const [warrantyUntil, setWarrantyUntil] = useState(
    asset?.warranty_until || ''
  );
  const [notes, setNotes] = useState(asset?.notes || '');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (warehouses.length === 0) {
      setError(
        'No hay almacenes disponibles. Crea un almacén primero en /inventory/warehouses'
      );
      return;
    }

    if (mode === 'create' && !warehouseId) {
      setError('Selecciona un almacén para el activo');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.set('name', name);
    formData.set('brand', brand);
    formData.set('model', model);
    formData.set('serial_number', serialNumber);
    formData.set('category', category);
    formData.set('current_warehouse_id', warehouseId);
    formData.set('estimated_value', estimatedValue);
    formData.set('currency', currency);
    formData.set('purchase_date', purchaseDate);
    formData.set('warranty_until', warrantyUntil);
    formData.set('notes', notes);

    if (mode === 'edit' && asset) {
      formData.set('id', asset.id);
    }

    const result =
      mode === 'create'
        ? await createAssetAction(formData)
        : await updateAssetAction(formData);

    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    if (mode === 'create' && result && 'assetId' in result && result.assetId) {
      router.push(`/inventory/assets/${result.assetId}`);
    } else {
      router.refresh();
      router.push('/inventory/assets');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identidad */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Identidad
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
            placeholder="Cámara Sony Alpha 7 IV"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="brand">Marca</Label>
            <Input
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              disabled={isLoading}
              placeholder="Sony"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Modelo</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isLoading}
              placeholder="A7 IV"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serial">N° de serie</Label>
            <Input
              id="serial"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={isLoading}
              className="font-mono"
              placeholder="ABC123XYZ"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoría *</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as AssetCategory)}
            required
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
          >
            <option value="camera">Cámara</option>
            <option value="lens">Lente</option>
            <option value="audio">Audio (micrófono, grabadora)</option>
            <option value="lighting">Iluminación (luces, flash)</option>
            <option value="support">Soporte (trípode, gimbal, slider)</option>
            <option value="storage">Almacenamiento (SD, disco)</option>
            <option value="power">Energía (batería, cargador)</option>
            <option value="cable">Cable</option>
            <option value="computer">Cómputo (laptop, monitor)</option>
            <option value="drone">Drone</option>
            <option value="accessory">Accesorio (filtro, parasol)</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>

      {/* Ubicación */}
      {mode === 'create' && (
        <div className="border border-border rounded-lg bg-card p-6 space-y-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Ubicación inicial
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouse">Almacén *</Label>
            <select
              id="warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
              disabled={isLoading || warehouses.length === 0}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
            >
              {warehouses.length === 0 ? (
                <option value="">No hay almacenes disponibles</option>
              ) : (
                warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-muted-foreground">
              El activo se guardará en este almacén. Puedes transferirlo
              después.
            </p>
          </div>
        </div>
      )}

      {/* Información comercial */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Información comercial (opcional)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="estimated_value">Valor estimado</Label>
            <Input
              id="estimated_value"
              type="number"
              step="0.01"
              min="0"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              disabled={isLoading}
              placeholder="35000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase_date">Fecha de compra</Label>
            <Input
              id="purchase_date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="warranty_until">Garantía hasta</Label>
          <Input
            id="warranty_until"
            type="date"
            value={warrantyUntil}
            onChange={(e) => setWarrantyUntil(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Notas */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Notas
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isLoading}
          rows={3}
          placeholder="Características, accesorios incluidos, observaciones..."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
        />
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
          onClick={() => router.push('/inventory/assets')}
          disabled={isLoading}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === 'create' ? 'Creando...' : 'Guardando...'}
            </>
          ) : mode === 'create' ? (
            'Crear activo'
          ) : (
            'Guardar cambios'
          )}
        </Button>
      </div>
    </form>
  );
}
