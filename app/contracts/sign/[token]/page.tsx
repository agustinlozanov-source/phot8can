import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { markContractAsViewedPublicAction } from '@/lib/actions/contracts';
import { SignView } from './sign-view';
import type { ContractBody } from '@/lib/types/database';

export default async function ContractSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createServiceClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select(
      `
      id, folio, title, status, public_access_token, expires_at,
      contract_body, billing_cycle, total_amount, currency, start_date,
      organization_id, client_id, signed_at,
      client:clients(id, name, legal_name)
    `
    )
    .eq('public_access_token', token)
    .maybeSingle();

  if (!contract) notFound();

  // Cargar info de la organización para branding
  const { data: organization } = await supabase
    .from('organizations')
    .select('name, primary_color, logo_url')
    .eq('id', contract.organization_id)
    .maybeSingle();

  // Si el contrato está en sent → marcar como viewed
  // (esto también valida si expiró y lo marca como expired)
  if (contract.status === 'sent') {
    await markContractAsViewedPublicAction(token);
  }

  // Re-cargar el contrato porque el status pudo haber cambiado
  const { data: contractRefreshed } = await supabase
    .from('contracts')
    .select(
      `
      id, folio, title, status, public_access_token, expires_at,
      contract_body, billing_cycle, total_amount, currency, start_date,
      organization_id, client_id, signed_at,
      client:clients(id, name, legal_name)
    `
    )
    .eq('public_access_token', token)
    .maybeSingle();

  const finalContract = contractRefreshed || contract;

  // Cargar firma si ya está firmado
  let signature = null;
  if (finalContract.status === 'signed') {
    const { data: sig } = await supabase
      .from('contract_signatures')
      .select('signer_name, signer_title, signer_rfc, signed_at, ip_address')
      .eq('contract_id', finalContract.id)
      .maybeSingle();
    signature = sig;
  }

  return (
    <SignView
      contract={
        {
          ...finalContract,
          contract_body: finalContract.contract_body as unknown as ContractBody,
        } as never
      }
      signature={signature}
      organization={{
        name: organization?.name || 'la agencia',
        primaryColor: organization?.primary_color || '#E89A1F',
        logoUrl: organization?.logo_url || null,
      }}
    />
  );
}
