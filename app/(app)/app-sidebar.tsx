'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Briefcase,
  Sparkles,
  Calendar,
  Wallet,
  Package,
  MessagesSquare,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Organization } from '@/lib/types/database';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  requiredPermission?: string;
  comingSoon?: boolean;
}

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        label: 'Clientes',
        href: '/clients',
        icon: Building2,
        requiredPermission: 'client.view',
        comingSoon: true,
      },
      {
        label: 'Conversaciones',
        href: '/conversations',
        icon: MessagesSquare,
        requiredPermission: 'conversation.view',
        comingSoon: true,
      },
    ],
  },
  {
    label: 'Comercial',
    items: [
      {
        label: 'Cotizaciones',
        href: '/quotes',
        icon: FileText,
        requiredPermission: 'quote.view',
        comingSoon: true,
      },
      {
        label: 'Contratos',
        href: '/contracts',
        icon: Briefcase,
        requiredPermission: 'contract.view',
        comingSoon: true,
      },
    ],
  },
  {
    label: 'Producción',
    items: [
      {
        label: 'Estrategias',
        href: '/strategies',
        icon: Sparkles,
        requiredPermission: 'strategy.view',
        comingSoon: true,
      },
      {
        label: 'Órdenes de trabajo',
        href: '/work-orders',
        icon: Package,
        requiredPermission: 'work_order.view',
        comingSoon: true,
      },
      {
        label: 'Cronograma',
        href: '/schedule',
        icon: Calendar,
        requiredPermission: 'schedule.view',
        comingSoon: true,
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      {
        label: 'Finanzas',
        href: '/finance',
        icon: Wallet,
        requiredPermission: 'finance.view',
        comingSoon: true,
      },
      {
        label: 'Equipo',
        href: '/team',
        icon: Users,
        requiredPermission: 'config.users',
      },
      {
        label: 'Configuración',
        href: '/settings',
        icon: Settings,
        requiredPermission: 'config.organization',
        comingSoon: true,
      },
    ],
  },
];

export function AppSidebar({
  organization,
  permissions,
}: {
  organization: Organization;
  permissions: string[];
}) {
  const pathname = usePathname();
  const permSet = new Set(permissions);

  function hasPermission(perm?: string): boolean {
    if (!perm) return true;
    return permSet.has(perm);
  }

  return (
    <aside className="bg-card border-r border-border h-screen sticky top-0 flex flex-col">
      {/* Brand de la organización */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-md grid place-items-center font-bold text-sm flex-shrink-0"
          style={{
            background: organization.primary_color
              ? `${organization.primary_color}25`
              : 'hsl(var(--secondary))',
            color: organization.primary_color || undefined,
          }}
        >
          {organization.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm leading-none truncate">
            {organization.name}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-1">
            Photocan OS
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {navSections.map((section) => {
          // Filtrar items que el usuario puede ver
          const visibleItems = section.items.filter((item) =>
            hasPermission(item.requiredPermission)
          );

          // No mostrar sección vacía
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-5">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 mb-2">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.comingSoon ? '#' : item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                        item.comingSoon && 'cursor-not-allowed opacity-50',
                        isActive && !item.comingSoon
                          ? 'bg-secondary text-foreground font-medium'
                          : !item.comingSoon &&
                              'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      )}
                      onClick={(e) => {
                        if (item.comingSoon) e.preventDefault();
                      }}
                    >
                      <Icon
                        className={cn(
                          'w-4 h-4',
                          isActive && !item.comingSoon
                            ? 'text-photocan-amber'
                            : ''
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.comingSoon && (
                        <span className="text-[9px] font-mono uppercase text-muted-foreground/50 tracking-wider">
                          pronto
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3">
          v0.1 · build 001
        </div>
      </div>
    </aside>
  );
}
