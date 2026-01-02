import React, { useState, useMemo, useEffect } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { STATUS_COLORS } from '../constants';
import { InvoiceStatus, Invoice } from '../types';
import { store } from '../lib/store';
import { auth } from '../lib/firebase';

interface InvoiceListProps {
  onEdit: (id: string) => void;
  onNew: () => void;
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const getInvDate = (inv: any): Date | null => {
  const v = inv?.date || inv?.createdAt;
  if (!v) return null;
  try {
    if (typeof v?.toDate === 'function') return v.toDate();
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
};

const InvoiceList: React.FC<InvoiceListProps> = ({ onEdit, onNew }) => {
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ filtros mes/año
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL'); // 1..12

  const reload = async (force = false, alive?: { current: boolean }) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      if (!alive || alive.current) setLoading(false);
      return;
    }

    if (!alive || alive.current) setLoading(true);
    try {
      const list = await store.loadInvoicesOnce(uid, { force });
      if (!alive || alive.current) setInvoices(list);
    } finally {
      if (!alive || alive.current) setLoading(false);
    }
  };

  // 1 query por pantalla + refresh al volver del editor
  useEffect(() => {
    const alive = { current: true };

    reload(false, alive);

    const onMaybeRefresh = async () => {
      // visibilitychange dispara también al ocultar; solo recargamos al volver a visible
      if (document.visibilityState && document.visibilityState !== 'visible') return;

      if (localStorage.getItem('si_invoices_dirty') === '1') {
        localStorage.removeItem('si_invoices_dirty');
        await reload(true, alive);
      }
    };

    window.addEventListener('focus', onMaybeRefresh);
    document.addEventListener('visibilitychange', onMaybeRefresh);

    return () => {
      alive.current = false;
      window.removeEventListener('focus', onMaybeRefresh);
      document.removeEventListener('visibilitychange', onMaybeRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    invoices.forEach((inv: any) => {
      const d = getInvDate(inv);
      if (d) ys.add(d.getFullYear());
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return invoices.filter((inv: any) => {
      const matchesFilter = filter === 'ALL' || inv.status === filter;

      const matchesSearch =
        !s ||
        String(inv?.recipient?.name || '').toLowerCase().includes(s) ||
        String(inv?.number || '').toLowerCase().includes(s);

      const d = getInvDate(inv);
      const matchesYear = yearFilter === 'ALL' ? true : d ? String(d.getFullYear()) === yearFilter : false;
      const matchesMonth =
        monthFilter === 'ALL' ? true : d ? String(d.getMonth() + 1) === monthFilter : false;

      return matchesFilter && matchesSearch && matchesYear && matchesMonth;
    });
  }, [invoices, filter, searchTerm, yearFilter, monthFilter]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de que quieres eliminar esta factura?')) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const prev = invoices;
    setInvoices((p) => p.filter((i) => i.id !== id));

    try {
      await store.deleteInvoice(uid, id);
      // coherencia si hay otras pantallas abiertas
      localStorage.setItem('si_invoices_dirty', '1');
    } catch {
      setInvoices(prev);
      await reload(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-800">Facturas</h1>
        <button
          onClick={onNew}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          + Nueva Factura
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por cliente o número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {(['ALL', 'DRAFT', 'ISSUED', 'PAID', 'CANCELLED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
                  filter === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                }`}
              >
                {s === 'ALL' ? 'Todas' : s}
              </button>
            ))}
          </div>
        </div>

        {/* filtros mes/año */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Año</label>
            <select
              className="w-full mt-1 px-4 py-2 rounded-xl border border-slate-200 outline-none bg-white"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="ALL">Todos</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Mes</label>
            <select
              className="w-full mt-1 px-4 py-2 rounded-xl border border-slate-200 outline-none bg-white"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            >
              <option value="ALL">Todos</option>
              {monthNames.map((m, idx) => (
                <option key={m} value={String(idx + 1)}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              <th className="py-4 px-6">Número</th>
              <th className="py-4 px-6">Cliente</th>
              <th className="py-4 px-6 text-right">Importe</th>
              <th className="py-4 px-6 text-center">Estado</th>
              <th className="py-4 px-6"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center text-slate-400">
                  Cargando facturas…
                </td>
              </tr>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv: any) => {
                const statusKey = ((inv as any)?.status || 'DRAFT') as keyof typeof STATUS_COLORS;
                const statusClass = STATUS_COLORS[statusKey] || STATUS_COLORS.DRAFT;

                return (
                  <tr
                    key={inv.id}
                    onClick={() => onEdit(inv.id)}
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-5 px-6 font-mono text-sm font-bold text-slate-400">{inv.number}</td>
                    <td className="py-5 px-6 font-bold text-slate-800">{inv.recipient?.name || '—'}</td>
                    <td className="py-5 px-6 text-right font-black text-slate-900">
                      {(Number(inv.total) || 0).toFixed(2)} €
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex justify-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${statusClass}`}>
                          {statusKey}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleDelete(inv.id, e)}
                          className="p-2 text-slate-300 hover:text-red-600 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-20 text-center text-slate-400">
                  No se encontraron facturas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceList;
