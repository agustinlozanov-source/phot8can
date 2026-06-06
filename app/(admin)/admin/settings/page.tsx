export default function AdminSettingsPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Plataforma
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Configuración del sistema
        </h1>
        <p className="text-muted-foreground text-sm">
          Configuración global del SaaS, integraciones, billing.
        </p>
      </div>

      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <div className="font-medium mb-1">Próximamente</div>
        <div className="text-sm text-muted-foreground">
          Esta sección se construirá en módulos futuros.
        </div>
      </div>
    </div>
  );
}
