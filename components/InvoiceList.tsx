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

const InvoiceList: React.FC<InvoiceListProps> = ({ onEdit, onNew }) => {
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // 1 query por pantalla (sin listeners)
  useEffect(() => {
    let alive = true;

    const run = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const list = await store.loadInvoicesOnce(uid);
        if (alive) setInvoices(list);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, []);

  const filteredInvoices = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return invoices.filter(inv => {
      const matchesFilter = filter === 'ALL' || inv.status === filter;
      const matchesSearch =
        !s ||
        inv.recipient.name.toLowerCase().includes(s) ||
        inv.number.toLowerCase().includes(s);

      return matchesFilter && matchesSearch;
    });
  }, [invoices, filter, searchTerm]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de que quieres eliminar esta factura?')) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // UI optimista
    const prev = invoices;
    setInvoices(prev => prev.filter(i => i.id !== id));

    try {
      await store.deleteInvoice(uid, id);
    } catch {
      // rollback + recarga “source of truth”
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

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
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
          {(['ALL', 'DRAFT', 'ISSUED', 'PAID', 'CANCELLED'] as const).map(s => (
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
              filteredInvoices.map((inv) => {
                // ✅ FIX: evita indexar STATUS_COLORS con any/string
                const statusKey = ((inv as any)?.status || 'DRAFT') as keyof typeof STATUS_COLORS;
                const statusClass = STATUS_COLORS[statusKey] || STATUS_COLORS.DRAFT;

                return (
                  <tr
                    key={inv.id}
                    onClick={() => onEdit(inv.id)}
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-5 px-6 font-mono text-sm font-bold text-slate-400">{inv.number}</td>
                    <td className="py-5 px-6 font-bold text-slate-800">{inv.recipient.name}</td>
                    <td className="py-5 px-6 text-right font-black text-slate-900">{inv.total.toFixed(2)} €</td>
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
