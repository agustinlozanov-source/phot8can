import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { TemplateEditor } from '../template-editor';
import type { QuoteLayer } from '@/lib/types/database';

// Plantilla base con las 7 capas pre-llenadas
const DEFAULT_LAYERS: QuoteLayer[] = [
  {
    kind: 'cover',
    order: 0,
    enabled: true,
    title: 'Propuesta comercial',
    subtitle: 'Diseño, contenido y estrategia digital',
  },
  {
    kind: 'introduction',
    order: 1,
    enabled: true,
    title: 'Quiénes somos',
    content_html:
      '<p>Somos una agencia digital especializada en construir marcas que conectan, generan recordación y venden.</p>',
  },
  {
    kind: 'scope',
    order: 2,
    enabled: true,
    title: 'Alcance del proyecto',
    content_html:
      '<p>El presente proyecto contempla la entrega de los siguientes elementos:</p>',
  },
  {
    kind: 'deliverables',
    order: 3,
    enabled: true,
    title: 'Entregables',
    auto_generated: true,
  },
  {
    kind: 'investment',
    order: 4,
    enabled: true,
    title: 'Inversión',
    auto_generated: true,
  },
  {
    kind: 'terms',
    order: 5,
    enabled: true,
    title: 'Términos y condiciones',
    content_html:
      '<ul><li>Vigencia: 15 días naturales a partir de la emisión.</li><li>Forma de pago: 50% al inicio del proyecto y 50% contra entrega final.</li><li>Los precios no incluyen materiales externos, viáticos ni licencias de software o tipografías.</li></ul>',
  },
  {
    kind: 'closing',
    order: 6,
    enabled: true,
    title: 'Listos para empezar',
    content_html:
      '<p>Si tienes preguntas o quieres ajustar algo de esta propuesta, escríbenos. Estamos listos para empezar.</p>',
  },
];

export default async function NewTemplatePage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'quote.template_manage')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para crear plantillas.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/catalog/templates"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Plantillas
      </Link>

      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Nueva plantilla
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Crear plantilla de cotización
        </h1>
        <p className="text-muted-foreground text-sm">
          Define la estructura visual y el contenido base que reutilizarás en
          cotizaciones nuevas.
        </p>
      </div>

      <TemplateEditor
        mode="create"
        initialData={{
          name: '',
          description: null,
          folio_prefix: 'COT',
          valid_days_default: 15,
          currency_default: 'MXN',
          layers: DEFAULT_LAYERS,
          primary_color: null,
          is_default: false,
          is_active: true,
        }}
      />
    </div>
  );
}
