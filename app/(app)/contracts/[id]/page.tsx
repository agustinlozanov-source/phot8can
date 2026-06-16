import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { ContractDetail } from './contract-detail';

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'contracts.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select(
      `
      *,
      client:clients(id, name, legal_name, tax_id),
      contact:contacts(id, first_name, last_name, email),
      source_quote:quotes!contracts_source_quote_id_fkey(id, folio, title),
      creator:users!contracts_created_by_fkey(id, first_name, last_name)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!contract) notFound();

  // Cargar firma si existe
  const { data: signature } = await supabase
    .from('contract_signatures')
    .select('*')
    .eq('contract_id', id)
    .maybeSingle();

  // ¿Ya existe una suscripción (no cancelada) para este contrato?
  const { data: existingSubscription } = await supabase
    .from('client_subscriptions')
    .select('id, status')
    .eq('source_contract_id', id)
    .neq('status', 'cancelled')
    .maybeSingle();

  const canManage = hasPermission(ctx, 'contracts.manage');
  const canCancel = hasPermission(ctx, 'contracts.cancel');
  const canManageSubscriptions = hasPermission(ctx, 'subscriptions.manage');

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Contratos
      </Link>

      <ContractDetail
        contract={contract as never}
        signature={signature || null}
        canManage={canManage}
        canCancel={canCancel}
        canManageSubscriptions={canManageSubscriptions}
        existingSubscription={existingSubscription || null}
      />
    </div>
  );
}
