'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Receipt, TrendingDown, Building2, Tag } from 'lucide-react';

interface Props {
  canViewCobros: boolean;
  canViewExpenses: boolean;
}

export function FinanceNav({ canViewCobros, canViewExpenses }: Props) {
  const pathname = usePathname();

  // Rutas de gastos que NO son la lista principal (para resaltar bien cada tab)
  const isExpensesSection =
    pathname === '/finance/expenses' ||
    pathname.startsWith('/finance/expenses/');
  const isVendors = pathname.startsWith('/finance/vendors');
  const isCategories = pathname.startsWith('/finance/categories');

  const tabs = [
    {
      label: 'Cobros',
      href: '/finance',
      icon: Receipt,
      show: canViewCobros,
      active:
        pathname === '/finance' ||
        (pathname.startsWith('/finance/') &&
          !isExpensesSection &&
          !isVendors &&
          !isCategories),
    },
    {
      label: 'Gastos',
      href: '/finance/expenses',
      icon: TrendingDown,
      show: canViewExpenses,
      active: isExpensesSection,
    },
    {
      label: 'Proveedores',
      href: '/finance/vendors',
      icon: Building2,
      show: canViewExpenses,
      active: isVendors,
    },
    {
      label: 'Categorías',
      href: '/finance/categories',
      icon: Tag,
      show: canViewExpenses,
      active: isCategories,
    },
  ].filter((t) => t.show);

  if (tabs.length <= 1) return null;

  return (
    <div className="border-b border-border mb-6">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                t.active
                  ? 'border-photocan-amber text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
