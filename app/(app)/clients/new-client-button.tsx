'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClientAction } from '@/lib/actions/clients';

interface NewClientButtonProps {
  users: Array<{ id: string; first_name: string; last_name: string }>;
}

export function NewClientButton({ users }: NewClientButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    const result = await createClientAction(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    if (result?.success && result.clientId) {
      setOpen(false);
      router.push(`/clients/${result.clientId}`);
    }
  }

  function reset() {
    setOpen(false);
    setError(null);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Nuevo cliente
      </Button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={reset} />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-background border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center">
              <Building2 className="w-4 h-4 text-photocan-amber" />
            </div>
            <h3 className="text-lg font-semibold">Nuevo cliente</h3>
          </div>
          <button
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form action={handleSubmit} className="p-6 space-y-5">
          {/* Sección: Identidad */}
          <div className="space-y-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Identidad
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre comercial *</Label>
              <Input
                id="name"
                name="name"
                required
                disabled={isLoading}
                placeholder="Café Lavanda"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="legal_name">Razón social</Label>
                <Input
                  id="legal_name"
                  name="legal_name"
                  disabled={isLoading}
                  placeholder="Café Lavanda SA de CV"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id">RFC</Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  disabled={isLoading}
                  placeholder="XAXX010101000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="industry">Industria</Label>
                <Input
                  id="industry"
                  name="industry"
                  disabled={isLoading}
                  placeholder="Gastronomía"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Sitio web</Label>
                <Input
                  id="website"
                  name="website"
                  type="text"
                  disabled={isLoading}
                  placeholder="https://"
                />
              </div>
            </div>
          </div>

          {/* Sección: Dirección */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Dirección (opcional)
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_street">Calle y número</Label>
              <Input
                id="address_street"
                name="address_street"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="address_city">Ciudad</Label>
                <Input
                  id="address_city"
                  name="address_city"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_state">Estado</Label>
                <Input
                  id="address_state"
                  name="address_state"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_zip">CP</Label>
                <Input
                  id="address_zip"
                  name="address_zip"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Sección: Operación */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Operación
            </div>

            <div className="space-y-2">
              <Label htmlFor="acquisition_source">
                Cómo nos conoció (opcional)
              </Label>
              <Input
                id="acquisition_source"
                name="acquisition_source"
                disabled={isLoading}
                placeholder="Referido por..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_manager_id">
                Responsable de la cuenta (opcional)
              </Label>
              <select
                id="account_manager_id"
                name="account_manager_id"
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              >
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas (opcional)</Label>
              <textarea
                id="notes"
                name="notes"
                disabled={isLoading}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
                placeholder="Cualquier detalle relevante para el equipo..."
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear cliente'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
