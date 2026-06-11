import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { TemplateEditor } from '../template-editor';
import type { QuoteLayer } from '@/lib/types/database';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
            No tienes permiso para editar plantillas.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: template } = await supabase
    .from('quote_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!template) notFound();

  // Asegurar que layers sea un array válido
  const layers = Array.isArray(template.layers)
    ? (template.layers as unknown as QuoteLayer[])
    : [];

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
          Editar plantilla
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          {template.name}
        </h1>
        {template.description && (
          <p className="text-muted-foreground text-sm">
            {template.description}
          </p>
        )}
      </div>

      <TemplateEditor
        mode="edit"
        templateId={template.id}
        initialData={{
          name: template.name,
          description: template.description,
          folio_prefix: template.folio_prefix,
          valid_days_default: template.valid_days_default,
          currency_default: template.currency_default,
          layers,
          primary_color: template.primary_color,
          is_default: template.is_default,
          is_active: template.is_active,
        }}
      />
    </div>
  );
}
