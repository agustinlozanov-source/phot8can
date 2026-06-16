'use client';

import { useState } from 'react';
import {
  FileSignature,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Receipt,
  ScrollText,
  ArrowDown,
} from 'lucide-react';
import type { ContractBody, ContractStatus } from '@/lib/types/database';

type ContractData = {
  id: string;
  folio: string;
  title: string;
  status: ContractStatus;
  public_access_token: string | null;
  expires_at: string;
  contract_body: ContractBody;
  billing_cycle: string;
  total_amount: number;
  currency: string;
  start_date: string;
  signed_at: string | null;
  client: { id: string; name: string; legal_name: string | null } | null;
};

interface Props {
  contract: ContractData;
  signature: {
    signer_name: string;
    signer_title: string | null;
    signer_rfc: string | null;
    signed_at: string;
    ip_address: string | null;
  } | null;
  organization: {
    name: string;
    primaryColor: string;
    logoUrl: string | null;
  };
}

const ACCEPTANCE_TEXT = `He leído, entendido y acepto íntegramente los términos y condiciones del presente contrato. Esta firma electrónica constituye mi manifestación expresa de voluntad y tiene plena validez legal conforme a la legislación mexicana aplicable.`;

export function SignView({ contract, signature, organization }: Props) {
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [signerRfc, setSignerRfc] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const body = contract.contract_body;
  const orgColor = organization.primaryColor;
  const isSigned = contract.status === 'signed';
  const isCancelled = contract.status === 'cancelled';
  const isExpired = contract.status === 'expired';
  const canSign = ['sent', 'viewed'].includes(contract.status);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (signerName.trim().length < 3) {
      setError('Por favor escribe tu nombre completo');
      return;
    }

    if (!accepted) {
      setError('Debes marcar la casilla de aceptación para firmar');
      return;
    }

    setIsLoading(true);
    const response = await fetch('/api/contracts/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: contract.public_access_token,
        signer_name: signerName.trim(),
        signer_title: signerTitle.trim() || undefined,
        signer_rfc: signerRfc.trim() || undefined,
        signer_email: signerEmail.trim() || undefined,
      }),
    });

    const result = await response.json();
    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setDone(true);
    }
  }

  // Pantalla post-firma
  if (done) {
    return <PostSignScreen organization={organization} />;
  }

  // Si ya está firmado de antes
  if (isSigned && signature) {
    return (
      <AlreadySignedScreen
        contract={contract}
        signature={signature}
        organization={organization}
      />
    );
  }

  // Si está cancelado o expirado
  if (isCancelled || isExpired) {
    return (
      <NotAvailableScreen
        type={isCancelled ? 'cancelled' : 'expired'}
        organization={organization}
      />
    );
  }

  if (!canSign) {
    return (
      <NotAvailableScreen type="unavailable" organization={organization} />
    );
  }

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {organization.logoUrl ? (
              <img
                src={organization.logoUrl}
                alt={organization.name}
                className="w-8 h-8 rounded object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded grid place-items-center font-mono font-bold text-xs"
                style={{ background: orgColor, color: '#000' }}
              >
                {organization.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div
                className="text-[10px] font-mono uppercase tracking-widest"
                style={{ color: orgColor }}
              >
                {organization.name}
              </div>
              <div className="text-sm font-medium truncate">
                Contrato {contract.folio}
              </div>
            </div>
          </div>

          <a
            href="#sign"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-xs font-medium text-black hover:opacity-90 transition-opacity"
            style={{ background: orgColor }}
          >
            Ir a firmar
            <ArrowDown className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-8">
        <div
          className="text-xs font-mono uppercase tracking-widest mb-3 flex items-center gap-2"
          style={{ color: orgColor }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: orgColor }}
          />
          Contrato de servicios
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 leading-tight">
          {contract.title}
        </h1>
        {contract.client && (
          <p className="text-lg text-muted-foreground">
            Para{' '}
            <strong className="text-foreground">
              {contract.client.name}
            </strong>
          </p>
        )}

        <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground font-mono flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Inicio:{' '}
            {new Date(body.start_date).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <div>·</div>
          <div>{getBillingCycleLabel(body.billing_cycle)}</div>
          <div>·</div>
          <div>Vigencia: hasta {new Date(contract.expires_at).toLocaleDateString('es-MX')}</div>
        </div>
      </section>

      {/* RESUMEN ECONÓMICO */}
      <section className="max-w-3xl mx-auto px-6 pb-8">
        <div className="border border-border rounded-lg bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4" style={{ color: orgColor }} />
            <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
              Servicios contratados
            </h2>
          </div>

          <div className="space-y-3">
            {body.services.map((service, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{service.name}</div>
                  {service.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {service.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground font-mono mt-1">
                    {service.quantity} ×{' '}
                    {formatCurrency(service.unit_price, body.pricing.currency)}
                  </div>
                </div>
                <div className="font-mono text-sm font-medium flex-shrink-0">
                  {formatCurrency(service.total, body.pricing.currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t-2 border-border flex justify-between items-center">
            <div className="text-sm font-medium">
              Total {getBillingCycleLabel(body.billing_cycle).toLowerCase()}
            </div>
            <div
              className="text-2xl font-semibold font-mono"
              style={{ color: orgColor }}
            >
              {formatCurrency(body.pricing.total, body.pricing.currency)}
            </div>
          </div>
        </div>
      </section>

      {/* CLÁUSULAS */}
      <section className="max-w-3xl mx-auto px-6 pb-8 space-y-6">
        <ClauseSection title="Declaraciones" html={body.declarations} orgColor={orgColor} />
        <ClauseSection title="Objeto del contrato" html={body.object_clause} orgColor={orgColor} />
        <ClauseSection title="Vigencia y renovación" html={body.validity_clause} orgColor={orgColor} />
        <ClauseSection title="Forma de pago" html={body.payment_clause} orgColor={orgColor} />
        <ClauseSection title="Obligaciones del proveedor" html={body.provider_obligations} orgColor={orgColor} />
        <ClauseSection title="Obligaciones del cliente" html={body.client_obligations} orgColor={orgColor} />
        <ClauseSection title="Propiedad intelectual" html={body.ip_clause} orgColor={orgColor} />
        <ClauseSection title="Confidencialidad" html={body.confidentiality_clause} orgColor={orgColor} />
        <ClauseSection title="Cancelación y avisos" html={body.cancellation_clause} orgColor={orgColor} />
        <ClauseSection title="Jurisdicción" html={body.jurisdiction_clause} orgColor={orgColor} />
        <ClauseSection title="Firma electrónica" html={body.electronic_signature_clause} orgColor={orgColor} />
      </section>

      {/* FORMULARIO DE FIRMA */}
      <section id="sign" className="border-t border-border bg-card/30 py-16 scroll-mt-20">
        <div className="max-w-xl mx-auto px-6">
          <div className="text-center mb-8">
            <div
              className="text-xs font-mono uppercase tracking-widest mb-3"
              style={{ color: orgColor }}
            >
              Firma electrónica
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">
              Firmar este contrato
            </h2>
            <p className="text-sm text-muted-foreground">
              Tu firma electrónica tiene plena validez legal conforme al
              Código de Comercio y la Ley de Firma Electrónica Avanzada.
            </p>
          </div>

          <form
            onSubmit={handleSign}
            className="border border-border rounded-lg bg-card p-6 space-y-4"
          >
            {/* Nombre */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Nombre completo *
              </label>
              <input
                id="name"
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled={isLoading}
                placeholder="Ej: Agustín Lozano García"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              />
            </div>

            {/* Cargo */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="title">
                Cargo (opcional)
              </label>
              <input
                id="title"
                type="text"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                disabled={isLoading}
                placeholder="Ej: Director General"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              />
            </div>

            {/* RFC y Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rfc">
                  RFC (opcional)
                </label>
                <input
                  id="rfc"
                  type="text"
                  value={signerRfc}
                  onChange={(e) => setSignerRfc(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  placeholder="XAXX010101000"
                  maxLength={13}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email (opcional)
                </label>
                <input
                  id="email"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  disabled={isLoading}
                  placeholder="tu@email.com"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
                />
              </div>
            </div>

            {/* Checkbox de aceptación */}
            <div className="pt-3 border-t border-border">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  disabled={isLoading}
                  className="mt-1 w-4 h-4 rounded border-input"
                />
                <span className="text-sm text-foreground/90 leading-relaxed">
                  {ACCEPTANCE_TEXT}
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !accepted || signerName.trim().length < 3}
              className="w-full h-11 rounded-md text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-opacity"
              style={{ background: orgColor }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando firma...
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" />
                  Firmar electrónicamente
                </>
              )}
            </button>

            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Al firmar quedarán registrados tu IP, navegador y fecha exacta
              como evidencia de validez legal.
            </p>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-muted-foreground font-mono">
          Contrato preparado por {organization.name}
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function ClauseSection({
  title,
  html,
  orgColor,
}: {
  title: string;
  html: string;
  orgColor: string;
}) {
  return (
    <article className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="w-4 h-4" style={{ color: orgColor }} />
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
          {title}
        </h2>
      </div>
      <div
        className="prose prose-sm max-w-none prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-p:text-foreground/90"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}

// ============================================================
// PANTALLAS DE ESTADO
// ============================================================

function PostSignScreen({
  organization,
}: {
  organization: { name: string; primaryColor: string };
}) {
  const orgColor = organization.primaryColor;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div
          className="w-20 h-20 rounded-full grid place-items-center mx-auto mb-6"
          style={{
            background: `${orgColor}20`,
            border: `2px solid ${orgColor}40`,
          }}
        >
          <CheckCircle2 className="w-10 h-10" style={{ color: orgColor }} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          ¡Contrato firmado!
        </h1>
        <p className="text-muted-foreground mb-2">
          Tu firma electrónica fue registrada exitosamente.
          {organization.name} recibirá una copia en breve y se pondrá en
          contacto contigo para arrancar.
        </p>
        <p className="text-sm text-muted-foreground">
          Bienvenid@ a la familia.
        </p>
      </div>
    </div>
  );
}

function AlreadySignedScreen({
  contract,
  signature,
  organization,
}: {
  contract: ContractData;
  signature: NonNullable<Props['signature']>;
  organization: { name: string; primaryColor: string };
}) {
  const orgColor = organization.primaryColor;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div
          className="w-20 h-20 rounded-full grid place-items-center mx-auto mb-6"
          style={{
            background: `${orgColor}20`,
            border: `2px solid ${orgColor}40`,
          }}
        >
          <CheckCircle2 className="w-10 h-10" style={{ color: orgColor }} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          Contrato firmado
        </h1>
        <p className="text-muted-foreground mb-4">
          Este contrato ya fue firmado por{' '}
          <strong className="text-foreground">{signature.signer_name}</strong>
          {signature.signer_title && `, ${signature.signer_title}`}.
        </p>
        <div className="text-xs text-muted-foreground font-mono">
          Firmado el{' '}
          {new Date(signature.signed_at).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
        <div className="text-xs font-mono mt-2 text-muted-foreground">
          Folio: {contract.folio}
        </div>
      </div>
    </div>
  );
}

function NotAvailableScreen({
  type,
  organization,
}: {
  type: 'cancelled' | 'expired' | 'unavailable';
  organization: { name: string; primaryColor: string };
}) {
  const messages = {
    cancelled: {
      title: 'Contrato cancelado',
      msg: 'Este contrato fue cancelado por la agencia. Contáctanos si crees que es un error.',
    },
    expired: {
      title: 'Contrato expirado',
      msg: 'El plazo para firmar este contrato venció. Contacta a la agencia para generar uno nuevo.',
    },
    unavailable: {
      title: 'Contrato no disponible',
      msg: 'Este link no está activo en este momento.',
    },
  };

  const { title, msg } = messages[type];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-secondary border-2 border-border grid place-items-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">{title}</h1>
        <p className="text-muted-foreground">{msg}</p>
        <p className="text-xs text-muted-foreground mt-4">
          Contacta a {organization.name} si tienes dudas.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getBillingCycleLabel(cycle: string): string {
  const labels: Record<string, string> = {
    monthly: 'Plan mensual',
    quarterly: 'Plan trimestral',
    annual: 'Plan anual',
    one_time: 'Pago único',
  };
  return labels[cycle] || cycle;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
