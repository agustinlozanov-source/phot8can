'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  TrendingDown,
  Building2,
  Tag,
  BarChart3,
} from 'lucide-react';

interface Props {
  canViewCobros: boolean;
  canViewExpenses: boolean;
  canViewReports?: boolean;
}

export function FinanceNav({
  canViewCobros,
  canViewExpenses,
  canViewReports = false,
}: Props) {
  const pathname = usePathname();

  const isResumen = pathname === '/finance';
  const isExpensesSection =
    pathname === '/finance/expenses' ||
    pathname.startsWith('/finance/expenses/');
  const isVendors = pathname.startsWith('/finance/vendors');
  const isCategories = pathname.startsWith('/finance/categories');
  const isReports = pathname.startsWith('/finance/reports');
  // Cobros: la lista /finance/invoices y el detalle /finance/[id]
  const isInvoices =
    pathname.startsWith('/finance/invoices') ||
    (pathname.startsWith('/finance/') &&
      !isExpensesSection &&
      !isVendors &&
      !isCategories &&
      !isReports);

  const tabs = [
    {
      label: 'Resumen',
      href: '/finance',
      icon: LayoutDashboard,
      show: canViewCobros,
      active: isResumen,
    },
    {
      label: 'Cobros',
      href: '/finance/invoices',
      icon: Receipt,
      show: canViewCobros,
      active: isInvoices,
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
    {
      label: 'Reportes',
      href: '/finance/reports',
      icon: BarChart3,
      show: canViewReports,
      active: isReports,
    },
  ].filter((t) => t.show);

  if (tabs.length <= 1) return null;

  return (
    <div className="border-b border-border mb-6">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
