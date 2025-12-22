
import React, { useState } from 'react';
import { Search, Filter, Download, MoreVertical, ExternalLink } from 'lucide-react';
import { STATUS_COLORS } from '../constants';
import { InvoiceStatus } from '../types';

interface InvoiceListProps {
  onEdit: (id: string) => void;
  onNew: () => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ onEdit, onNew }) => {
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  
  const invoices = [
    { id: '1', number: '20251202001', client: '2N Telekomunikace', date: '01 Nov 2025', total: '189,02 €', status: 'PAID' as const },
    { id: '2', number: '20250101', client: 'Iñaki Gambra', date: '01 Ene 2025', total: '302,50 €', status: 'PAID' as const },
    { id: '3', number: '20250204', client: 'Empresa Demo SL', date: '10 Feb 2025', total: '1.200,00 €', status: 'ISSUED' as const },
    { id: '4', number: '20250205', client: 'Juan Perez', date: '11 Feb 2025', total: '500,00 €', status: 'DRAFT' as const },
  ];

  const filteredInvoices = filter === 'ALL' ? invoices : invoices.filter(i => i.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-800">Facturas</h1>
        <button onClick={onNew} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all">+ Nueva Factura</button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por cliente o número..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {(['ALL', 'DRAFT', 'ISSUED', 'PAID', 'CANCELLED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
                filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
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
              <th className="py-4 px-6">Fecha</th>
              <th className="py-4 px-6 text-right">Importe</th>
              <th className="py-4 px-6 text-center">Estado</th>
              <th className="py-4 px-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredInvoices.map((inv) => (
              <tr key={inv.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="py-5 px-6 font-mono text-sm font-bold text-slate-400">{inv.number}</td>
                <td className="py-5 px-6 font-bold text-slate-800">{inv.client}</td>
                <td className="py-5 px-6 text-slate-500 text-sm">{inv.date}</td>
                <td className="py-5 px-6 text-right font-black text-slate-900">{inv.total}</td>
                <td className="py-5 px-6">
                   <div className="flex justify-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${STATUS_COLORS[inv.status]}`}>
                      {inv.status}
                    </span>
                  </div>
                </td>
                <td className="py-5 px-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onEdit(inv.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                      <ExternalLink size={18} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-600">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceList;
