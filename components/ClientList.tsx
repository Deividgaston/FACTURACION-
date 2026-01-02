import React, { useState, useEffect } from 'react';
import { Mail, MapPin, UserPlus, Trash2 } from 'lucide-react';
import { store } from '../lib/store';
import { auth } from '../lib/firebase';
import { Party } from '../types';

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState<any>({
    name: '',
    taxId: '',
    email: '',
    address: { street: '', city: '', zip: '', country: 'España' }
  });

  // 1 query por pantalla (y si está cacheado, 0 lecturas)
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
        const list = await store.loadClientsOnce(uid);
        if (alive) setClients(list as any[]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => { alive = false; };
  }, []);

  const handleAdd = async () => {
    if (!newClient.name) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const clientToSave = { ...newClient, id: Date.now().toString() };

    // UI optimista
    setClients(prev => [clientToSave, ...prev]);

    try {
      await store.saveClient(uid, clientToSave);
      setShowAdd(false);
      setNewClient({ name: '', taxId: '', email: '', address: { street: '', city: '', zip: '', country: 'España' } });
    } catch {
      const list = await store.loadClientsOnce(uid, { force: true });
      setClients(list as any[]);
    }
  };

  const handleDelete = async (id: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // UI optimista
    setClients(prev => prev.filter(c => c.id !== id));

    try {
      await store.deleteClient(uid, id);
    } catch {
      const list = await store.loadClientsOnce(uid, { force: true });
      setClients(list as any[]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500">Gestiona tus contactos. Aparecerán en el selector de facturas.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <UserPlus size={18} /> Añadir Cliente
        </button>
      </div>

      {showAdd && (
        <div className="bg-white p-8 rounded-3xl border-2 border-indigo-100 shadow-xl space-y-4 animate-in slide-in-from-top-4">
          <h2 className="text-xl font-bold">Nuevo Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input placeholder="Nombre / Empresa" className="px-4 py-2 border rounded-xl" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
            <input placeholder="NIF / CIF" className="px-4 py-2 border rounded-xl" value={newClient.taxId} onChange={e => setNewClient({ ...newClient, taxId: e.target.value })} />
            <input placeholder="Email" className="px-4 py-2 border rounded-xl" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
            <input placeholder="Dirección" className="col-span-full px-4 py-2 border rounded-xl" value={newClient.address.street} onChange={e => setNewClient({ ...newClient, address: { ...newClient.address, street: e.target.value } })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-400">Cancelar</button>
            <button onClick={handleAdd} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Guardar Cliente</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
            Cargando clientes…
          </div>
        ) : clients.length > 0 ? (
          clients.map(client => (
            <div key={client.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all flex items-start gap-4 group">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-indigo-600 uppercase">
                {client.name.charAt(0)}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-800">{client.name}</h3>
                  <button onClick={() => handleDelete(client.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500"><Mail size={14} /> {client.email}</div>
                <div className="flex items-center gap-2 text-sm text-slate-500"><MapPin size={14} /> {client.address.street}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
            No hay clientes registrados aún.
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientList;
