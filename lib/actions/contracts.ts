'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ContractBody } from '@/lib/types/database';

// ============================================================
// SCHEMAS
// ============================================================

const generateFromQuoteSchema = z.object({
  quote_id: z.string().uuid(),
  billing_cycle: z.enum(['monthly', 'quarterly', 'annual', 'one_time']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  client_legal_name: z.string().min(1).max(200).optional(),
  client_rfc: z.string().max(20).optional(),
  client_address: z.string().max(500).optional(),
  client_representative_name: z.string().max(200).optional(),
  client_representative_title: z.string().max(200).optional(),
});

const signContractSchema = z.object({
  token: z.string().min(10),
  signer_name: z.string().min(3).max(200),
  signer_title: z.string().max(200).optional(),
  signer_rfc: z.string().max(20).optional(),
  signer_email: z.string().email().optional(),
});

// ============================================================
// HELPER DE CONTEXTO
// ============================================================

async function getContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' as const };

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    const { getImpersonatedOrganizationId } = await import(
      '@/lib/actions/impersonation'
    );
    const impersonatingOrgId = await getImpersonatedOrganizationId();

    return {
      isSuperAdmin: true as const,
      supabase,
      impersonatingOrgId,
    };
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!appUser) return { error: 'Usuario no encontrado' as const };

  return {
    isSuperAdmin: false as const,
    supabase,
    userId: appUser.id,
    organizationId: appUser.organization_id,
  };
}

function resolveOrgId(
  ctx: Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>
): string | null {
  if (!ctx.isSuperAdmin) return ctx.organizationId;
  if (ctx.impersonatingOrgId) return ctx.impersonatingOrgId;
  return null;
}

// ============================================================
// GENERAR CONTRATO DESDE COTIZACIÓN
// ============================================================

export async function generateContractFromQuoteAction(payload: {
  quote_id: string;
  billing_cycle: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  start_date: string;
  client_legal_name?: string;
  client_rfc?: string;
  client_address?: string;
  client_representative_name?: string;
  client_representative_title?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = generateFromQuoteSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // 1. Cargar cotización con sus items
  const { data: quote } = await ctx.supabase
    .from('quotes')
    .select(
      `
      id, organization_id, client_id, contact_id, status,
      subtotal, tax_total, total, currency,
      title,
      client:clients(id, name, legal_name, address, tax_id)
    `
    )
    .eq('id', validation.data.quote_id)
    .maybeSingle();

  if (!quote) return { error: 'Cotización no encontrada' };
  if (quote.organization_id !== orgId) {
    return { error: 'Cotización no pertenece a tu organización' };
  }
  if (quote.status !== 'approved') {
    return {
      error: `La cotización debe estar aprobada (estado actual: ${quote.status})`,
    };
  }

  // 2. Verificar que no exista contrato previo (excepto cancelled/expired)
  const { data: existingContract } = await ctx.supabase
    .from('contracts')
    .select('id, status')
    .eq('source_quote_id', quote.id)
    .not('status', 'in', '(cancelled,expired)')
    .maybeSingle();

  if (existingContract) {
    return {
      error: `Ya existe un contrato para esta cotización (estado: ${existingContract.status}). Cancélalo primero si quieres generar uno nuevo.`,
    };
  }

  // 3. Cargar items de la cotización
  const { data: items } = await ctx.supabase
    .from('quote_items')
    .select(
      `
      name, description, quantity, unit_price, subtotal,
      service_id,
      service:services(service_type, unit)
    `
    )
    .eq('quote_id', quote.id)
    .order('position');

  if (!items || items.length === 0) {
    return { error: 'La cotización no tiene servicios' };
  }

  // 4. Cargar plantilla de la organización (o crearla si no existe)
  let { data: template } = await ctx.supabase
    .from('contract_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle();

  if (!template) {
    // Auto-crear plantilla base si no existe
    const { ensureContractTemplateAction } = await import(
      './contract-templates'
    );
    const ensureResult = await ensureContractTemplateAction();
    if (ensureResult?.error) {
      return { error: `No hay plantilla y no se pudo crear: ${ensureResult.error}` };
    }

    // Recargar
    const { data: newTemplate } = await ctx.supabase
      .from('contract_templates')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .maybeSingle();

    if (!newTemplate) return { error: 'No se pudo cargar la plantilla' };
    template = newTemplate;
  }

  // 5. Cargar datos de la organización
  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('name, legal_name')
    .eq('id', orgId)
    .maybeSingle();

  void org;

  // 6. Generar folio
  const { data: folio } = await ctx.supabase.rpc('generate_contract_folio', {
    p_organization_id: orgId,
  });

  if (!folio) return { error: 'Error al generar folio' };

  // 7. Calcular fecha de expiración
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (template.expiration_days || 15));

  // 8. Generar token público
  const { data: token } = await ctx.supabase.rpc('generate_share_token');
  if (!token) return { error: 'Error al generar token' };

  // 9. Construir contract_body (snapshot completo)
  const client = quote.client as unknown as {
    id: string;
    name: string;
    legal_name: string | null;
    address: unknown | null;
    tax_id: string | null;
  };

  const contractBody: ContractBody = {
    declarations: template.declarations,
    object_clause: template.object_clause,
    validity_clause: template.validity_clause,
    payment_clause: template.payment_clause,
    provider_obligations: template.provider_obligations,
    client_obligations: template.client_obligations,
    ip_clause: template.ip_clause,
    confidentiality_clause: template.confidentiality_clause,
    cancellation_clause: template.cancellation_clause,
    jurisdiction_clause: template.jurisdiction_clause,
    electronic_signature_clause: template.electronic_signature_clause,
    jurisdiction_city: template.jurisdiction_city,
    provider: {
      legal_name: template.provider_legal_name,
      rfc: template.provider_rfc,
      address: template.provider_address,
      representative_name: template.provider_representative_name,
      representative_title: template.provider_representative_title,
    },
    client: {
      legal_name:
        validation.data.client_legal_name ||
        client.legal_name ||
        client.name,
      rfc: validation.data.client_rfc || client.tax_id || null,
      address: validation.data.client_address || null,
      // El address de la BD es JSON estructurado, no string.
      // El usuario llena el address del contrato en el formulario.
      representative_name:
        validation.data.client_representative_name || null,
      representative_title:
        validation.data.client_representative_title || null,
    },
    services: items.map((item) => {
      const svc = item.service as unknown as {
        service_type: string | null;
        unit: string | null;
      } | null;
      return {
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.subtotal,
        service_id: item.service_id,
        service_type: svc?.service_type || null,
        unit: svc?.unit || null,
      };
    }),
    pricing: {
      subtotal: quote.subtotal,
      taxes: quote.tax_total,
      total: quote.total,
      currency: quote.currency,
    },
    billing_cycle: validation.data.billing_cycle,
    start_date: validation.data.start_date,
  };

  // 10. Insertar contrato
  const { data: newContract, error: insertError } = await ctx.supabase
    .from('contracts')
    .insert({
      organization_id: orgId,
      client_id: quote.client_id,
      contact_id: quote.contact_id,
      source_quote_id: quote.id,
      template_id: template.id,
      folio,
      title: `Contrato de servicios — ${client.name}`,
      status: 'draft',
      public_access_token: token,
      contract_body: contractBody as never,
      billing_cycle: validation.data.billing_cycle,
      total_amount: quote.total,
      currency: quote.currency,
      start_date: validation.data.start_date,
      expires_at: expiresAt.toISOString(),
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id, folio, public_access_token')
    .single();

  if (insertError || !newContract) {
    return { error: `Error al crear contrato: ${insertError?.message}` };
  }

  revalidatePath('/contracts');
  revalidatePath(`/quotes/${quote.id}`);

  return {
    success: true,
    contractId: newContract.id,
    folio: newContract.folio,
    token: newContract.public_access_token,
  };
}

// ============================================================
// ENVIAR CONTRATO AL CLIENTE (cambia status a 'sent')
// ============================================================

export async function sendContractAction(contractId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: contract } = await ctx.supabase
    .from('contracts')
    .select('id, status, public_access_token')
    .eq('id', contractId)
    .maybeSingle();

  if (!contract) return { error: 'Contrato no encontrado' };

  if (!['draft'].includes(contract.status)) {
    return {
      error: `Solo se pueden enviar contratos en estado draft (actual: ${contract.status})`,
    };
  }

  if (!contract.public_access_token) {
    return { error: 'El contrato no tiene token público' };
  }

  const { error } = await ctx.supabase
    .from('contracts')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', contractId);

  if (error) {
    return { error: `Error al enviar: ${error.message}` };
  }

  revalidatePath('/contracts');
  revalidatePath(`/contracts/${contractId}`);
  return { success: true };
}

// ============================================================
// CANCELAR CONTRATO
// ============================================================

export async function cancelContractAction(payload: {
  contract_id: string;
  reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!payload.reason || payload.reason.trim().length < 5) {
    return { error: 'Indica el motivo de cancelación (mín. 5 caracteres)' };
  }

  const { data: contract } = await ctx.supabase
    .from('contracts')
    .select('id, status')
    .eq('id', payload.contract_id)
    .maybeSingle();

  if (!contract) return { error: 'Contrato no encontrado' };

  if (['cancelled', 'signed'].includes(contract.status)) {
    return {
      error: `No se puede cancelar un contrato ${contract.status === 'signed' ? 'ya firmado' : 'ya cancelado'}`,
    };
  }

  const { error } = await ctx.supabase
    .from('contracts')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: payload.reason.trim(),
      cancelled_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .eq('id', payload.contract_id);

  if (error) {
    return { error: `Error al cancelar: ${error.message}` };
  }

  revalidatePath('/contracts');
  revalidatePath(`/contracts/${payload.contract_id}`);
  return { success: true };
}

// ============================================================
// REGENERAR TOKEN PÚBLICO
// ============================================================

export async function regenerateContractTokenAction(contractId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: contract } = await ctx.supabase
    .from('contracts')
    .select('id, status')
    .eq('id', contractId)
    .maybeSingle();

  if (!contract) return { error: 'Contrato no encontrado' };

  if (contract.status === 'signed') {
    return { error: 'No se puede regenerar el token de un contrato firmado' };
  }

  const { data: newToken } = await ctx.supabase.rpc('generate_share_token');

  if (!newToken) return { error: 'Error al generar token' };

  const { error } = await ctx.supabase
    .from('contracts')
    .update({ public_access_token: newToken })
    .eq('id', contractId);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath(`/contracts/${contractId}`);
  return { success: true, token: newToken };
}

// ============================================================
// PÚBLICO: MARCAR COMO VISTO
// ============================================================

export async function markContractAsViewedPublicAction(token: string) {
  const supabase = await createServiceClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, expires_at')
    .eq('public_access_token', token)
    .maybeSingle();

  if (!contract) return { error: 'Contrato no encontrado' };

  // Si está sent y no expiró, marcar como viewed
  if (contract.status === 'sent') {
    const expiresAt = new Date(contract.expires_at);
    if (expiresAt < new Date()) {
      // Marcar como expired
      await supabase
        .from('contracts')
        .update({ status: 'expired' })
        .eq('id', contract.id);
      return { error: 'Este contrato expiró' };
    }

    await supabase
      .from('contracts')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      })
      .eq('id', contract.id);
  }

  return { success: true };
}

// ============================================================
// PÚBLICO: FIRMAR CONTRATO
// ============================================================

export async function signContractPublicAction(
  payload: {
    token: string;
    signer_name: string;
    signer_title?: string;
    signer_rfc?: string;
    signer_email?: string;
  },
  meta: {
    ip_address: string | null;
    user_agent: string | null;
  }
) {
  const validation = signContractSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const supabase = await createServiceClient();

  // 1. Cargar contrato
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, expires_at, public_access_token')
    .eq('public_access_token', validation.data.token)
    .maybeSingle();

  if (!contract) return { error: 'Contrato no encontrado' };

  // 2. Validar estado
  if (contract.status === 'signed') {
    return { error: 'Este contrato ya fue firmado' };
  }
  if (contract.status === 'cancelled') {
    return { error: 'Este contrato fue cancelado por la agencia' };
  }
  if (!['sent', 'viewed'].includes(contract.status)) {
    return { error: 'Este contrato no está disponible para firma' };
  }

  // 3. Verificar expiración
  const expiresAt = new Date(contract.expires_at);
  if (expiresAt < new Date()) {
    await supabase
      .from('contracts')
      .update({ status: 'expired' })
      .eq('id', contract.id);
    return { error: 'Este contrato expiró. Contacta a tu agencia.' };
  }

  // 4. Texto de aceptación legal
  const acceptanceText = `He leído, entendido y acepto íntegramente los términos y condiciones del presente contrato. Esta firma electrónica constituye mi manifestación expresa de voluntad y tiene plena validez legal conforme a la legislación mexicana aplicable.`;

  // 5. Registrar firma
  const { error: signatureError } = await supabase
    .from('contract_signatures')
    .insert({
      contract_id: contract.id,
      signer_name: validation.data.signer_name.trim(),
      signer_title: validation.data.signer_title?.trim() || null,
      signer_rfc: validation.data.signer_rfc?.trim() || null,
      signer_email: validation.data.signer_email?.trim() || null,
      ip_address: meta.ip_address,
      user_agent: meta.user_agent,
      acceptance_text: acceptanceText,
    });

  if (signatureError) {
    return { error: `Error al registrar firma: ${signatureError.message}` };
  }

  // 6. Actualizar contrato a signed
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
    })
    .eq('id', contract.id);

  if (updateError) {
    return { error: `Error al actualizar contrato: ${updateError.message}` };
  }

  return { success: true, contractId: contract.id };
}

// ============================================================
// GUARDAR PDF FIRMADO EN STORAGE
// ============================================================

export async function saveSignedPdfPathAction(payload: {
  contract_id: string;
  storage_path: string;
}) {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('contracts')
    .update({ signed_pdf_path: payload.storage_path })
    .eq('id', payload.contract_id);

  if (error) {
    return { error: `Error al guardar path del PDF: ${error.message}` };
  }

  return { success: true };
}
