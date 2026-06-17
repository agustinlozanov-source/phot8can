'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
import type { Invoice } from '@/lib/types/database';
import {
  InvoiceStatusBadge,
  formatCurrency,
  formatDate,
  dueDateInfo,
  TONE_CLASS,
} from '../../finance/finance-ui';

type InvoiceRow = Pick<
  Invoice,
  | 'id'
  | 'folio'
  | 'title'
  | 'total'
  | 'currency'
  | 'status'
  | 'issue_date'
  | 'due_date'
>;

export function InvoicesTab({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();

  const stats = useMemo(() => {
    const currency = invoices[0]?.currency || 'MXN';
    const facturado = invoices
      .filter((i) => i.status !== 'cancelled')
      .reduce((s, i) => s + Number(i.total), 0);
    const pagado = invoices
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + Number(i.total), 0);
    const pendiente = invoices
      .filter((i) => i.status === 'pending' || i.status === 'overdue')
      .reduce((s, i) => s + Number(i.total), 0);
    return { currency, facturado, pagado, pendiente };
  }, [invoices]);

  if (invoices.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <Receipt className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
        <div className="text-sm text-muted-foreground">
          Este cliente no tiene cobros registrados.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Facturado" value={formatCurrency(stats.facturado, stats.currency)} />
        <MiniStat label="Pagado" value={formatCurrency(stats.pagado, stats.currency)} tone="green" />
        <MiniStat label="Pendiente" value={formatCurrency(stats.pendiente, stats.currency)} tone="amber" />
      </div>

      {/* Tabla */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Folio</th>
              <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Concepto</th>
              <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Vencimiento</th>
              <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const dd = dueDateInfo(inv.due_date, inv.status);
              return (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/finance/${inv.id}`)}
                  className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium">{inv.folio}</td>
                  <td className="px-4 py-3">
                    <span className="truncate inline-block max-w-[220px] align-middle">
                      {inv.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {formatCurrency(Number(inv.total), inv.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono ${TONE_CLASS[dd.tone]}`}>
                      {dd.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'amber';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-green-500'
      : tone === 'amber'
        ? 'text-photocan-amber'
        : 'text-muted-foreground';
  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${toneClass}`}>
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums font-mono">{value}</div>
    </div>
  );
}
