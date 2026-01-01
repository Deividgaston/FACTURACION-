
import React, { useMemo } from 'react';
import { TrendingUp, Clock, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { store } from '../lib/store';

interface DashboardProps {
  onNewInvoice: () => void;
  onEditInvoice: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNewInvoice, onEditInvoice }) => {
  const invoices = useMemo(() => store.getInvoices(), []);

  const stats = useMemo(() => {
    const totalInvoiced = invoices.filter(i => i.status !== 'CANCELLED').reduce((acc, i) => acc + i.total, 0);
    const pending = invoices.filter(i => i.status === 'ISSUED').reduce((acc, i) => acc + i.total, 0);
    const paid = invoices.filter(i => i.status === 'PAID').reduce((acc, i) => acc + i.total, 0);
    const overdue = invoices.filter(i => i.status === 'ISSUED' && new Date(i.dueDate) < new Date()).reduce((acc, i) => acc + i.total, 0);

    return [
      { label: 'Facturado Total', value: `${totalInvoiced.toLocaleString()} €`, icon: <TrendingUp className="text-emerald-500" />, change: '+8%', color: 'bg-emerald-50' },
      { label: 'Pendiente Cobro', value: `${pending.toLocaleString()} €`, icon: <Clock className="text-amber-500" />, change: '-2%', color: 'bg-amber-50' },
      { label: 'Total Cobrado', value: `${paid.toLocaleString()} €`, icon: <CheckCircle className="text-blue-500" />, change: '+15%', color: 'bg-blue-50' },
      { label: 'Vencido', value: `${overdue.toLocaleString()} €`, icon: <AlertCircle className="text-red-500" />, change: '0%', color: 'bg-red-50' },
    ];
  }, [invoices]);

  const recentInvoices = invoices.slice(-5).reverse();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500">Bienvenido a SwiftInvoice. Tienes {invoices.length} facturas registradas.</p>
        </div>
        <button 
          onClick={onNewInvoice}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
        >
          Nueva Factura <ArrowUpRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Actividad Reciente</h2>
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
                {recentInvoices.length > 0 ? recentInvoices.map((inv) => (
                  <tr key={inv.id} onClick={() => onEditInvoice(inv.id)} className="group hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="py-4 px-2 font-medium text-slate-700">{inv.recipient.name}</td>
                    <td className="py-4 px-2 text-slate-500 font-mono text-sm">{inv.number}</td>
                    <td className="py-4 px-2 text-right font-bold text-slate-800">{inv.total.toFixed(2)}€</td>
                    <td className="py-4 px-2">
                      <div className="flex justify-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          inv.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">No hay facturas recientes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-center">
          <h3 className="text-2xl font-bold mb-4 leading-tight">Proyecto para GitHub</h3>
          <p className="text-indigo-200 mb-6">Esta aplicación usa LocalStorage para que puedas probarla sin necesidad de servidor.</p>
          <div className="bg-indigo-800/50 p-4 rounded-2xl border border-indigo-700">
            <p className="text-xs font-mono text-indigo-300">Stack: React 19 + Tailwind + Lucide + LocalStorage</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
