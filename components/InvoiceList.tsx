import React, { useState, useMemo, useEffect } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { STATUS_COLORS } from '../constants';
import { InvoiceStatus, Invoice } from '../types';
import { store } from '../lib/store';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface InvoiceListProps {
  onEdit: (id: string) => void;
  onNew: () => void;
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const parseInvDate = (inv: any): Date | null => {
  const v = inv?.date;
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
};

const fmtDate = (inv: any) => {
  const d = parseInvDate(inv);
  return d ? d.toLocaleDateString() : '—';
};

const InvoiceList: React.FC<InvoiceListProps> = ({ onEdit, onNew }) => {
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ NUEVO: filtros de fecha
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL'); // "1".."12" o ALL

  useEffect(() => {
    let alive = true;
    let unsubStore: (() => void) | null = null;

    const runForUid = async (uid: string) => {
      setLoading(true);
      try {
        const list = await store.loadInvoicesOnce(uid);
        if (!alive) return;
        setInvoices(list);

        // ✅ escucha cambios locales (sin Firestore listeners)
        unsubStore?.();
        unsubStore = store.onInvoicesChanged(({ uid: changedUid }) => {
          if (!alive) return;
          if (changedUid !== uid) return;
          setInvoices(store.getCachedInvoices(uid));
        });
      } finally {
        if (alive) setLoading(false);
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!alive) return;
      if (!user?.uid) {
        setInvoices([]);
        setLoading(false);
        unsubStore?.();
        unsubStore = null;
        return;
      }
      runForUid(user.uid);
    });

    return () => {
      alive = false;
      unsubAuth();
      unsubStore?.();
    };
  }, []);

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    invoices.forEach((inv: any) => {
      const d = parseInvDate(inv);
      if (d) ys.add(d.getFullYear());
    });
    const arr = Array.from(ys).sort((a, b) => b - a);
    // añade el actual por si aún no hay facturas
    const nowY = new Date().getFullYear();
    if (!arr.includes(nowY)) arr.unshift(nowY);
    return arr;
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    const yf = yearFilter === 'ALL' ? null : Number(yearFilter);
    const mf = monthFilter === 'ALL' ? null : Number(monthFilter); // 1..12

    return invoices.filter((inv: any) => {
      const matchesStatus = filter === 'ALL' || inv.status === filter;

      const matchesSearch =
        !s ||
        String(inv?.recipient?.name || '').toLowerCase().includes(s) ||
        String(inv?.number || '').toLowerCase().includes(s);

      let matchesDate = true;
      if (yf || mf) {
        const d = parseInvDate(inv);
        if (!d) matchesDate = false;
        else {
          if (yf && d.getFullYear() !== yf) matchesDate = false;
          if (mf && d.getMonth() + 1 !== mf) matchesDate = false;
        }
      }

      return matchesStatus && matchesSearch && matchesDate;
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
    } catch {
      setInvoices(prev);
      const list = await store.loadInvoicesOnce(uid, { force: true });
      setInvoices(list);
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
                onClick={() => setFilter(s)}
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

        {/* ✅ Filtros mes/año */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            <div className="flex-1 md:flex-none">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Año</label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full md:w-36 px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none"
              >
                <option value="ALL">Todos</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 md:flex-none">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Mes</label>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-full md:w-36 px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none"
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

          <div className="flex-1" />
          <button
            onClick={() => {
              setYearFilter('ALL');
              setMonthFilter('ALL');
              setSearchTerm('');
              setFilter('ALL');
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 w-full md:w-auto"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              <th className="py-4 px-6">Número</th>
              <th className="py-4 px-6">Fecha</th>
              <th className="py-4 px-6">Cliente</th>
              <th className="py-4 px-6 text-right">Importe</th>
              <th className="py-4 px-6 text-center">Estado</th>
              <th className="py-4 px-6"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400">
                  Cargando facturas…
                </td>
              </tr>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv: any) => (
                <tr
                  key={inv.id}
                  onClick={() => onEdit(inv.id)}
                  className="group hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="py-5 px-6 font-mono text-sm font-bold text-slate-400">{inv.number}</td>
                  <td className="py-5 px-6 text-sm text-slate-600">{fmtDate(inv)}</td>
                  <td className="py-5 px-6 font-bold text-slate-800">{inv.recipient.name}</td>
                  <td className="py-5 px-6 text-right font-black text-slate-900">{Number(inv.total || 0).toFixed(2)} €</td>
                  <td className="py-5 px-6">
                    <div className="flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${STATUS_COLORS[inv.status]}`}>
                        {inv.status}
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
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400">
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
