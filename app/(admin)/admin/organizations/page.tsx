import { createClient } from '@/lib/supabase/server';
import { Building2 } from 'lucide-react';
import Link from 'next/link';

export default async function OrganizationsPage() {
  const supabase = await createClient();

  const { data: organizations } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Plataforma
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Organizaciones
          </h1>
          <p className="text-muted-foreground text-sm">
            Todas las agencias que usan Photocan OS.
          </p>
        </div>
      </div>

      {organizations && organizations.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Slug
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  País
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Creada
                </th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr
                  key={org.id}
                  className="border-t border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded grid place-items-center text-xs font-bold"
                        style={{
                          background: org.primary_color
                            ? `${org.primary_color}20`
                            : 'hsl(var(--secondary))',
                          color: org.primary_color || undefined,
                        }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{org.name}</div>
                        {org.legal_name && (
                          <div className="text-xs text-muted-foreground">
                            {org.legal_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {org.slug}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {org.country_code}
                  </td>
                  <td className="px-4 py-3">
                    {org.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {new Date(org.created_at).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">No hay organizaciones todavía</div>
          <div className="text-sm text-muted-foreground">
            Las organizaciones aparecerán aquí cuando se creen.
          </div>
        </div>
      )}
    </div>
  );
}
