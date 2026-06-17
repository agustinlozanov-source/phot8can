'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Receipt, TrendingDown } from 'lucide-react';

interface Props {
  canViewCobros: boolean;
  canViewExpenses: boolean;
}

export function FinanceNav({ canViewCobros, canViewExpenses }: Props) {
  const pathname = usePathname();

  const tabs = [
    {
      label: 'Cobros',
      href: '/finance',
      icon: Receipt,
      show: canViewCobros,
      active:
        pathname === '/finance' ||
        (pathname.startsWith('/finance/') &&
          !pathname.startsWith('/finance/expenses')),
    },
    {
      label: 'Gastos',
      href: '/finance/expenses',
      icon: TrendingDown,
      show: canViewExpenses,
      active: pathname.startsWith('/finance/expenses'),
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
