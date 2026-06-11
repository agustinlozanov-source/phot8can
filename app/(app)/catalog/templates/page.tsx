import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { Package, Percent, FileText, Plus } from 'lucide-react';
import { TemplatesList } from './templates-list';

export default async function TemplatesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  const canManage = hasPermission(ctx, 'quote.template_manage');

  const supabase = await createClient();

  const { data: templates, error } = await supabase
    .from('quote_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-destructive/30 bg-destructive/10 rounded-lg p-6">
          <div className="font-medium text-destructive mb-1">
            Error al cargar plantillas
          </div>
          <div className="text-sm text-muted-foreground">{error.message}</div>
        </div>
      </div>
    );
  }

  const all = templates || [];
  const activeCount = all.filter((t) => t.is_active && !t.archived_at).length;
  const archivedCount = all.filter((t) => t.archived_at).length;
  const defaultTemplate = all.find((t) => t.is_default);

  return (
    <div className="p-8 max-w-7xl">
      <CatalogTabs current="templates" />

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Catálogo
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Plantillas de cotización
          </h1>
          <p className="text-muted-foreground text-sm">
            Estructura visual y contenido base para tus cotizaciones.{' '}
            {activeCount} activas.
          </p>
        </div>

        {canManage && (
          <Link
            href="/catalog/templates/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:bg-photocan-amber-deep transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva plantilla
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-8">
        <div className="p-4 border-r border-border">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <FileText className="w-3.5 h-3.5" />
            Plantillas activas
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {activeCount}
          </div>
        </div>
        <div className="p-4 border-r border-border">
          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            Plantilla por defecto
          </div>
          <div className="text-sm font-medium truncate">
            {defaultTemplate ? defaultTemplate.name : 'Sin asignar'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            Archivadas
          </div>
          <div className="text-2xl font-semibold tracking-tight text-muted-foreground">
            {archivedCount}
          </div>
        </div>
      </div>

      <TemplatesList templates={all} canManage={canManage} />
    </div>
  );
}

function CatalogTabs({
  current,
}: {
  current: 'services' | 'taxes' | 'templates';
}) {
  return (
    <div className="flex gap-1 border-b border-border mb-8">
      <a
        href="/catalog/services"
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          (current as string) === 'services'
            ? 'border-photocan-amber text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <Package className="w-3.5 h-3.5" />
        Servicios y paquetes
      </a>
      <a
        href="/catalog/taxes"
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          (current as string) === 'taxes'
            ? 'border-photocan-amber text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <Percent className="w-3.5 h-3.5" />
        Impuestos
      </a>
      <a
        href="/catalog/templates"
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          current === 'templates'
            ? 'border-photocan-amber text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <FileText className="w-3.5 h-3.5" />
        Plantillas
      </a>
    </div>
  );
}
