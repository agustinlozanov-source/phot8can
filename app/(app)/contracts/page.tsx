import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileSignature, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { ContractsList } from './contracts-list';

export default async function ContractsPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'contracts.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver contratos.
          </div>
        </div>
      </div>
    );
  }

  const canManageTemplate = hasPermission(ctx, 'contracts.manage_templates');

  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from('contracts')
    .select(
      `
      *,
      client:clients(id, name),
      creator:users!contracts_created_by_fkey(id, first_name, last_name)
    `
    )
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Comercial
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
            <FileSignature className="w-7 h-7 text-photocan-amber" />
            Contratos
          </h1>
          <p className="text-muted-foreground text-sm">Acuerdos con clientes</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(contracts || []).length} contratos en total. Firma digital
            in-app con validez legal.
          </p>
        </div>

        {canManageTemplate && (
          <Link
            href="/contracts/template"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Settings className="w-4 h-4" />
            Plantilla legal
          </Link>
        )}
      </div>

      {(contracts || []).length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
            <FileSignature className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="font-medium mb-2">Sin contratos todavía</div>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Los contratos se generan desde cotizaciones aprobadas. Ve a una
            cotización en estado <strong>Aprobada</strong> y haz click en{' '}
            <strong>&ldquo;Generar contrato&rdquo;</strong>.
          </p>
          <Link
            href="/quotes"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Ver cotizaciones
          </Link>
        </div>
      ) : (
        <ContractsList contracts={contracts as never} />
      )}
    </div>
  );
}
