
import React from 'react';
import { TrendingUp, Clock, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';

interface DashboardProps {
  onNewInvoice: () => void;
  onEditInvoice: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNewInvoice, onEditInvoice }) => {
  const stats = [
    { label: 'Facturado Mes', value: '4.250 €', icon: <TrendingUp className="text-emerald-500" />, change: '+12%', color: 'bg-emerald-50' },
    { label: 'Pendiente', value: '1.120 €', icon: <Clock className="text-amber-500" />, change: '-2%', color: 'bg-amber-50' },
    { label: 'Pagado', value: '3.130 €', icon: <CheckCircle className="text-blue-500" />, change: '+5%', color: 'bg-blue-50' },
    { label: 'Vencido', value: '150 €', icon: <AlertCircle className="text-red-500" />, change: '0%', color: 'bg-red-50' },
  ];

  const recentInvoices = [
    { id: '1', client: '2N Telekomunikace', number: '20251201', amount: '189,02 €', status: 'PAID', date: '01 Nov' },
    { id: '2', client: 'Iñaki Gambra', number: '20250101', amount: '302,50 €', status: 'PAID', date: '01 Ene' },
    { id: '3', client: 'Empresa Demo SL', number: '20250204', amount: '1.200,00 €', status: 'ISSUED', date: '10 Feb' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500">Resumen de tu facturación y actividad recurrente.</p>
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
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {stat.change}
              </span>
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
            <button className="text-indigo-600 text-sm font-semibold hover:underline">Ver todas</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold border-b border-slate-50 uppercase tracking-wider">
                  <th className="pb-4 px-2">Cliente</th>
                  <th className="pb-4 px-2">Factura</th>
                  <th className="pb-4 px-2 text-right">Importe</th>
                  <th className="pb-4 px-2 text-center">Estado</th>
                  <th className="pb-4 px-2 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} onClick={() => onEditInvoice(inv.id)} className="group hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="py-4 px-2 font-medium text-slate-700">{inv.client}</td>
                    <td className="py-4 px-2 text-slate-500 font-mono text-sm">{inv.number}</td>
                    <td className="py-4 px-2 text-right font-bold text-slate-800">{inv.amount}</td>
                    <td className="py-4 px-2">
                      <div className="flex justify-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          inv.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-right text-slate-400 text-sm">{inv.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-4 leading-tight">Automatiza tus rentas mensuales</h3>
            <p className="text-indigo-200 mb-8">Programa tus facturas para que se generen y envíen solas el día 1 de cada mes.</p>
            <button className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors">
              Configurar Recurrencia
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-700 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-400 rounded-full blur-3xl opacity-20"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
