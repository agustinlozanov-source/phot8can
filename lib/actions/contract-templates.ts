'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

const updateTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  declarations: z.string().min(10).optional(),
  object_clause: z.string().min(10).optional(),
  validity_clause: z.string().min(10).optional(),
  payment_clause: z.string().min(10).optional(),
  provider_obligations: z.string().min(10).optional(),
  client_obligations: z.string().min(10).optional(),
  ip_clause: z.string().min(10).optional(),
  confidentiality_clause: z.string().min(10).optional(),
  cancellation_clause: z.string().min(10).optional(),
  jurisdiction_clause: z.string().min(10).optional(),
  electronic_signature_clause: z.string().min(10).optional(),
  provider_legal_name: z.string().min(1).max(200).optional(),
  provider_rfc: z.string().max(20).nullable().optional(),
  provider_address: z.string().max(500).nullable().optional(),
  provider_representative_name: z.string().max(200).nullable().optional(),
  provider_representative_title: z.string().max(200).nullable().optional(),
  expiration_days: z.number().int().min(1).max(90).optional(),
  jurisdiction_city: z.string().min(1).max(200).optional(),
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
// ACTUALIZAR PLANTILLA
// ============================================================

export async function updateContractTemplateAction(payload: {
  id: string;
  name?: string;
  declarations?: string;
  object_clause?: string;
  validity_clause?: string;
  payment_clause?: string;
  provider_obligations?: string;
  client_obligations?: string;
  ip_clause?: string;
  confidentiality_clause?: string;
  cancellation_clause?: string;
  jurisdiction_clause?: string;
  electronic_signature_clause?: string;
  provider_legal_name?: string;
  provider_rfc?: string | null;
  provider_address?: string | null;
  provider_representative_name?: string | null;
  provider_representative_title?: string | null;
  expiration_days?: number;
  jurisdiction_city?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = updateTemplateSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { id, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('contract_templates')
    .update({
      ...updateData,
      updated_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .eq('id', id);

  if (error) {
    return { error: `Error al actualizar plantilla: ${error.message}` };
  }

  revalidatePath('/contracts/template');
  return { success: true };
}

// ============================================================
// CREAR PLANTILLA DEFAULT (si no existe para una org)
// ============================================================

export async function ensureContractTemplateAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  // Verificar si ya existe
  const { data: existing } = await ctx.supabase
    .from('contract_templates')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle();

  if (existing) {
    return { success: true, templateId: existing.id, created: false };
  }

  // Cargar nombre de la organización para usar como base
  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('name, legal_name')
    .eq('id', orgId)
    .maybeSingle();

  const orgName = org?.name || 'la agencia';
  const orgLegalName = org?.legal_name || orgName;

  // Crear plantilla base con texto genérico
  // (El usuario después la edita en /contracts/template)
  const { data: newTemplate, error } = await ctx.supabase
    .from('contract_templates')
    .insert({
      organization_id: orgId,
      name: 'Plantilla base',
      is_default: true,
      provider_legal_name: orgLegalName,

      declarations: `**DECLARA EL PROVEEDOR:**

- Ser una empresa legalmente constituida bajo las leyes mexicanas.
- Contar con la capacidad técnica, los recursos humanos y la infraestructura necesarios para prestar los servicios objeto del presente contrato.
- Estar al corriente en sus obligaciones fiscales.

**DECLARA EL CLIENTE:**

- Tener la capacidad legal para celebrar el presente contrato y contar con los recursos económicos para cubrir las obligaciones aquí establecidas.
- Tener interés en contratar los servicios profesionales del PROVEEDOR conforme a los términos del presente instrumento.

`,

      object_clause: `El presente contrato tiene por objeto la prestación de los servicios profesionales de marketing digital, estrategia de marca y producción audiovisual descritos en el anexo de servicios, conforme a las especificaciones, alcances y entregables acordados entre las partes.

Los servicios contratados se desglosan en la sección "Servicios contratados" del presente contrato.

`,

      validity_clause: `El presente contrato entrará en vigor a partir de la fecha de firma electrónica indicada al final del documento y permanecerá vigente durante el período acordado por las partes (mensual, trimestral o anual, según el plan contratado).

El contrato se considera renovado automáticamente al inicio de cada nuevo período de servicio cubierto, salvo notificación contraria por escrito con al menos 15 (quince) días naturales de anticipación a la fecha de vencimiento del período en curso.

`,

      payment_clause: `EL CLIENTE pagará al PROVEEDOR la cantidad pactada en la sección "Importes" del presente contrato, conforme a la periodicidad acordada (mensual, trimestral o anual).

Los pagos deberán realizarse en los primeros 5 (cinco) días naturales del inicio de cada período de servicio, mediante transferencia electrónica a la cuenta bancaria que EL PROVEEDOR proporcione por escrito.

En caso de retraso en los pagos superior a 10 (diez) días naturales, EL PROVEEDOR podrá suspender la prestación de servicios sin responsabilidad alguna, hasta que se regularicen los pagos.

`,

      provider_obligations: `EL PROVEEDOR se obliga a:

- Prestar los servicios contratados con la calidad profesional acordada, conforme a los estándares de la industria.
- Asignar al personal calificado necesario para la correcta ejecución de los servicios.
- Cumplir con los plazos de entrega establecidos en cada orden de trabajo o cronograma.
- Mantener comunicación constante con EL CLIENTE a través de los canales acordados.
- Entregar los reportes y materiales convenidos en tiempo y forma.
- Guardar absoluta confidencialidad sobre la información y datos del CLIENTE.

`,

      client_obligations: `EL CLIENTE se obliga a:

- Proporcionar oportunamente la información, materiales y aprobaciones necesarias para que EL PROVEEDOR pueda ejecutar los servicios contratados.
- Realizar los pagos en tiempo y forma conforme a lo establecido en la cláusula de Forma de Pago.
- Respetar los procesos de revisión, aprobación y entregables establecidos por EL PROVEEDOR.
- No incurrir en prácticas que comprometan la reputación o la marca del PROVEEDOR.
- Notificar oportunamente cualquier cambio en sus datos de contacto o estructura legal.

`,

      ip_clause: `Los entregables creados por EL PROVEEDOR en el marco del presente contrato (piezas gráficas, contenido audiovisual, copies, estrategia documentada, etc.) serán propiedad de EL CLIENTE una vez efectuado el pago correspondiente al período en el que fueron producidos.

EL PROVEEDOR conservará el derecho de usar los trabajos producidos como parte de su portafolio comercial, identificando al CLIENTE como cliente, salvo solicitud expresa contraria por escrito.

El know-how, metodologías, plantillas y herramientas propias del PROVEEDOR seguirán siendo propiedad exclusiva del mismo.

`,

      confidentiality_clause: `Ambas partes se obligan a mantener bajo estricta confidencialidad toda información comercial, financiera, técnica, operativa, estratégica o de cualquier otra naturaleza que les sea proporcionada o de la que tengan conocimiento con motivo del presente contrato.

Esta obligación de confidencialidad subsistirá durante la vigencia del contrato y por un período de 2 (dos) años posteriores a su terminación por cualquier causa.

El incumplimiento de esta obligación dará lugar a la reparación de daños y perjuicios que correspondan conforme a la legislación aplicable.

`,

      cancellation_clause: `Cualquiera de las partes podrá dar por terminado el presente contrato mediante notificación por escrito con al menos 15 (quince) días naturales de anticipación a la fecha de terminación del período en curso.

En caso de cancelación anticipada por parte del CLIENTE durante un período ya pagado, no habrá lugar a reembolso de los montos ya cubiertos, pero EL PROVEEDOR concluirá los entregables comprometidos para dicho período.

El incumplimiento grave de las obligaciones por cualquiera de las partes facultará a la otra para dar por terminado el contrato de forma inmediata, sin necesidad de aviso previo y sin responsabilidad alguna.

`,

      jurisdiction_clause: `Para la interpretación, cumplimiento y ejecución del presente contrato, así como para cualquier controversia que se derive del mismo, las partes se someten expresamente a las leyes y tribunales competentes de la jurisdicción establecida, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios actuales o futuros.

`,

      electronic_signature_clause: `Las partes reconocen expresamente la validez legal de la firma electrónica como manifestación de su consentimiento, conforme a lo establecido en el Código de Comercio mexicano, la Ley de Firma Electrónica Avanzada y demás disposiciones aplicables.

Al firmar electrónicamente el presente contrato, EL CLIENTE manifiesta haber leído, entendido y aceptado en su totalidad los términos y condiciones aquí establecidos, otorgando su consentimiento expreso y vinculante.

La captura de la dirección IP, fecha, hora y datos identificatorios del firmante constituyen evidencia suficiente de la manifestación de la voluntad.

`,

      expiration_days: 15,
      jurisdiction_city: 'Matamoros, Tamaulipas, México',
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (error || !newTemplate) {
    return { error: `Error al crear plantilla: ${error?.message}` };
  }

  revalidatePath('/contracts/template');
  return { success: true, templateId: newTemplate.id, created: true };
}

// ============================================================
// PREVIEW DE LA PLANTILLA (genera HTML de muestra)
// ============================================================

export async function previewTemplateAction(templateId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: template } = await ctx.supabase
    .from('contract_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) return { error: 'Plantilla no encontrada' };

  return { success: true, template };
}
