import React, { useMemo, useEffect, useState } from 'react';
import { TrendingUp, Clock, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { store } from '../lib/store';
import { auth } from '../lib/firebase';
import { Invoice } from '../types';

interface DashboardProps {
  onNewInvoice: () => void;
  onEditInvoice: (id: string) => void;
}

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

const Dashboard: React.FC<DashboardProps> = ({ onNewInvoice, onEditInvoice }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ filtro por años
  const [yearFilter, setYearFilter] = useState<string>('ALL');

  // 1 query por pantalla (y si ya está cacheado, 0 lecturas)
  useEffect(() => {
    let alive = true;

    const run = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        if (alive) setLoading(false);
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

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    invoices.forEach((inv: any) => {
      const d = getInvDate(inv);
      if (d) ys.add(d.getFullYear());
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (yearFilter === 'ALL') return invoices;
    return invoices.filter((inv: any) => {
      const d = getInvDate(inv);
      return d ? String(d.getFullYear()) === yearFilter : false;
    });
  }, [invoices, yearFilter]);

  const stats = useMemo(() => {
    const totalInvoiced = filteredInvoices
      .filter((i: any) => i.status !== 'CANCELLED')
      .reduce((acc: number, i: any) => acc + (Number(i.total) || 0), 0);

    const pending = filteredInvoices
      .filter((i: any) => i.status === 'ISSUED')
      .reduce((acc: number, i: any) => acc + (Number(i.total) || 0), 0);

    const paid = filteredInvoices
      .filter((i: any) => i.status === 'PAID')
      .reduce((acc: number, i: any) => acc + (Number(i.total) || 0), 0);

    const overdue = filteredInvoices
      .filter((i: any) => i.status === 'ISSUED' && new Date(i.dueDate) < new Date())
      .reduce((acc: number, i: any) => acc + (Number(i.total) || 0), 0);

    return [
      {
        label: 'Facturado Total',
        value: `${totalInvoiced.toLocaleString()} €`,
        icon: <TrendingUp className="text-emerald-500" />,
        color: 'bg-emerald-50'
      },
      {
        label: 'Pendiente Cobro',
        value: `${pending.toLocaleString()} €`,
        icon: <Clock className="text-amber-500" />,
        color: 'bg-amber-50'
      },
      {
        label: 'Total Cobrado',
        value: `${paid.toLocaleString()} €`,
        icon: <CheckCircle className="text-blue-500" />,
        color: 'bg-blue-50'
      },
      {
        label: 'Vencido',
        value: `${overdue.toLocaleString()} €`,
        icon: <AlertCircle className="text-red-500" />,
        color: 'bg-red-50'
      }
    ];
  }, [filteredInvoices]);

  // Firestore ya viene orderBy(updatedAt,'desc') => los más recientes están al principio
  const recentInvoices = useMemo(() => filteredInvoices.slice(0, 5), [filteredInvoices]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500">
            Bienvenido a SwiftInvoice. {loading ? 'Cargando…' : `Tienes ${invoices.length} facturas registradas.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* ✅ filtro años */}
          <select
            className="px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white font-semibold text-slate-700"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="ALL">Todos los años</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={onNewInvoice}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            Nueva Factura <ArrowUpRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Actividad Reciente</h2>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {yearFilter === 'ALL' ? 'Todos los años' : `Año ${yearFilter}`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold border-b border-slate-50 uppercase tracking-wider">
                  <th className="pb-4 px-2">Cliente</th>
                  <th className="pb-4 px-2">Nº Factura</th>
                  <th className="pb-4 px-2 text-right">Importe</th>
                  <th className="pb-4 px-2 text-center">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                ) : recentInvoices.length > 0 ? (
                  recentInvoices.map((inv: any) => (
                    <tr
                      key={inv.id}
                      onClick={() => onEditInvoice(inv.id)}
                      className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-2 font-medium text-slate-700">{inv.recipient?.name || '—'}</td>
                      <td className="py-4 px-2 text-slate-500 font-mono text-sm">{inv.number}</td>
                      <td className="py-4 px-2 text-right font-bold text-slate-800">
                        {(Number(inv.total) || 0).toFixed(2)}€
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex justify-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              inv.status === 'PAID'
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : inv.status === 'ISSUED'
                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                : 'bg-slate-50 text-slate-700 border-slate-100'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      No hay facturas recientes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
