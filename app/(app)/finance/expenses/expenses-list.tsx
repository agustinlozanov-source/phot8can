'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Expense, ExpenseStatus } from '@/lib/types/database';
import {
  ExpenseStatusBadge,
  CategoryBadge,
  formatCurrency,
  formatDate,
  dueDateInfo,
  TONE_CLASS,
} from '../finance-ui';
import { CreateExpenseModal } from './create-expense-modal';

type ExpenseRow = Expense & {
  vendor: { id: string; name: string; is_active: boolean } | null;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    is_active: boolean;
  } | null;
};

type VendorOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; color: string; icon: string | null };

type FilterKey = 'all' | ExpenseStatus;

export function ExpensesList({
  expenses,
  vendors,
  categories,
  canManage,
}: {
  expenses: ExpenseRow[];
  vendors: VendorOption[];
  categories: CategoryOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [categoryId, setCategoryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(() => {
    const c = (s: ExpenseStatus) => expenses.filter((e) => e.status === s).length;
    return {
      all: expenses.length,
      pending: c('pending'),
      paid: c('paid'),
      cancelled: c('cancelled'),
    };
  }, [expenses]);

  const filtered = useMemo(() => {
    let result = expenses;
    if (filter !== 'all') result = result.filter((e) => e.status === filter);
    if (categoryId) result = result.filter((e) => e.category_id === categoryId);
    if (vendorId) result = result.filter((e) => e.vendor_id === vendorId);
    if (dateFrom) result = result.filter((e) => e.issue_date >= dateFrom);
    if (dateTo) result = result.filter((e) => e.issue_date <= dateTo);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.folio.toLowerCase().includes(q) ||
          e.concept.toLowerCase().includes(q) ||
          e.vendor_name_snapshot.toLowerCase().includes(q)
      );
    }
    return result;
  }, [expenses, filter, categoryId, vendorId, dateFrom, dateTo, search]);

  return (
    <div>
      {/* Fila 1: buscador + tabs + crear */}
      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, concepto o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto">
          <FilterButton label="Todos" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterButton label="Pendientes" count={counts.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} />
          <FilterButton label="Pagados" count={counts.paid} active={filter === 'paid'} onClick={() => setFilter('paid')} />
          {counts.cancelled > 0 && (
            <FilterButton label="Cancelados" count={counts.cancelled} active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} />
          )}
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Registrar gasto
          </Button>
        )}
      </div>

      {/* Fila 2: filtros extra */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los proveedores</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          title="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          title="Hasta"
        />
        {(categoryId || vendorId || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setCategoryId('');
              setVendorId('');
              setDateFrom('');
              setDateTo('');
            }}
            className="h-9 px-3 text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <div className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            No hay gastos registrados. Los gastos te permiten trackear renta,
            sueldos, software, marketing y todo lo que sale de la empresa.
          </div>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              Registrar mi primer gasto
            </Button>
          )}
        </div>
      ) : filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <Th>Folio</Th>
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th>Proveedor</Th>
                <Th>Categoría</Th>
                <Th className="text-right">Total</Th>
                <Th>Estado</Th>
                <Th>Vencimiento</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const showDue = e.status === 'pending';
                const dd = e.due_date
                  ? dueDateInfo(e.due_date, e.status)
                  : null;
                return (
                  <tr
                    key={e.id}
                    onClick={() => router.push(`/finance/expenses/${e.id}`)}
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {e.folio}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {formatDate(e.issue_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[200px]">
                        {e.concept}
                      </div>
                      {e.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {e.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{e.vendor_name_snapshot}</td>
                    <td className="px-4 py-3">
                      <CategoryBadge
                        name={e.category_name_snapshot}
                        color={e.category?.color}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatCurrency(Number(e.total), e.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <ExpenseStatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3">
                      {showDue ? (
                        dd ? (
                          <span className={`text-xs font-mono ${TONE_CLASS[dd.tone]}`}>
                            {dd.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin vencimiento
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No hay gastos que coincidan con los filtros.
        </div>
      )}

      {createOpen && (
        <CreateExpenseModal
          vendors={vendors}
          categories={categories}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground ${
        className || 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {label}
      <span className={`font-mono tabular-nums ${active ? 'text-black/70' : 'text-muted-foreground'}`}>
        {count}
      </span>
    </button>
  );
}
