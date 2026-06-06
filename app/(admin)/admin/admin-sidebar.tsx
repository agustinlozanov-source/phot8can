'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard, Settings, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Organizaciones',
    href: '/admin/organizations',
    icon: Building2,
  },
  {
    label: 'Super Admins',
    href: '/admin/super-admins',
    icon: Shield,
  },
  {
    label: 'Configuración',
    href: '/admin/settings',
    icon: Settings,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-card border-r border-border h-screen sticky top-0 flex flex-col">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center font-bold text-sm text-black">
          P
        </div>
        <div>
          <div className="font-semibold text-sm leading-none">Photocan OS</div>
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-1">
            Super Admin
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 mb-2">
          Plataforma
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4',
                  isActive ? 'text-photocan-amber' : ''
                )}
              />
              {item.label}
            </Link>
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
