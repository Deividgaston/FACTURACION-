
import React from 'react';
import { Mail, MapPin, UserPlus, Search } from 'lucide-react';

const ClientList: React.FC = () => {
  const clients = [
    { id: '1', name: '2N Telekomunikace a.s.', taxId: 'CZ 26 18 39 60', email: 'admin@2n.cz', location: 'Praga, República Checa' },
    { id: '2', name: 'Iñaki Gambra', taxId: '44638629E', email: 'inaki@example.com', location: 'Navarra, España' },
    { id: '3', name: 'David Gastón Ortigosa', taxId: '06010586L', email: 'david@example.com', location: 'Madrid, España' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500">Gestiona tus contactos y empresas para facturar rápido.</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
          <UserPlus size={18} /> Añadir Cliente
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
         <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, NIF o email..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clients.map(client => (
          <div key={client.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all flex items-start gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400">
              {client.name.charAt(0)}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-800">{client.name}</h3>
                <span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded uppercase">{client.taxId}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Mail size={14} />
                {client.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <MapPin size={14} />
                {client.location}
              </div>
              <div className="pt-2 flex gap-2">
                <button className="text-indigo-600 text-xs font-bold hover:underline">Historial</button>
                <span className="text-slate-200">|</span>
                <button className="text-slate-600 text-xs font-bold hover:underline">Editar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientList;
