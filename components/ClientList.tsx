import React, { useEffect, useState } from 'react';
import { Mail, MapPin, UserPlus, Trash2 } from 'lucide-react';
import { store } from '../lib/store';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { Client } from '../types';

const emptyClient = (): Omit<Client, 'id'> => ({
  name: '',
  taxId: '',
  email: '',
  address: { street: '', city: '', zip: '', country: 'España' }
});

const formatFsError = (e: any) => {
  const code = e?.code ? String(e.code) : 'unknown';
  const msg = e?.message ? String(e.message) : String(e);
  return `Firestore: ${code} — ${msg}`;
};

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState<Omit<Client, 'id'>>(emptyClient());
  const [fsError, setFsError] = useState<string>('');

  const loadOnce = async (uid?: string | null) => {
    setFsError('');
    if (!uid) {
      setLoading(false);
      setClients([]);
      return;
    }

    setLoading(true);
    try {
      // Migración legacy (solo la primera vez)
      await store.migrateLocalClientsToFirestoreOnce(uid);

      const list = await store.loadClientsOnce(uid);
      setClients(list as Client[]);
    } catch (e) {
      console.error('Clients load failed:', e);
      setFsError(formatFsError(e));
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // 1 query por pantalla (y si está cacheado, 0 lecturas)
  useEffect(() => {
    // pinta rápido (sin uid)
    loadOnce(null);

    // cuando Auth esté listo, ya podemos leer/escribir en Firestore
    const unsub = onAuthStateChanged(auth, (user) => {
      loadOnce(user?.uid || null);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    if (!newClient.name?.trim()) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // ⚠️ Rules: /clients requiere ownerUid == uid
    const clientToSave: any = {
      ...newClient,
      id: Date.now().toString(),
      ownerUid: uid
    };

    // UI optimista
    setClients((prev) => [clientToSave as Client, ...prev]);

    try {
      await store.saveClient(uid, clientToSave as Client);
      setShowAdd(false);
      setNewClient(emptyClient());

      // refresco "de verdad" por si el store normaliza datos
      const list = await store.loadClientsOnce(uid, { force: true } as any);
      setClients(list as Client[]);
      setFsError('');
    } catch (e) {
      console.error('Client save failed:', e);
      setFsError(formatFsError(e));
      const list = await store.loadClientsOnce(uid, { force: true } as any);
      setClients(list as Client[]);
    }
  };

  const handleDelete = async (id: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // UI optimista
    setClients((prev) => prev.filter((c) => c.id !== id));

    try {
      await store.deleteClient(uid, id);
      setFsError('');
    } catch (e) {
      console.error('Client delete failed:', e);
      setFsError(formatFsError(e));
      const list = await store.loadClientsOnce(uid, { force: true } as any);
      setClients(list as Client[]);
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

      {fsError && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 font-semibold">
          {fsError}
        </div>
      )}

      {showAdd && (
        <div className="bg-white p-8 rounded-3xl border-2 border-indigo-100 shadow-xl space-y-4 animate-in slide-in-from-top-4">
          <h2 className="text-xl font-bold">Nuevo Cliente</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              placeholder="Nombre / Empresa *"
              className="px-4 py-2 border rounded-xl"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            />
            <input
              placeholder="NIF / CIF"
              className="px-4 py-2 border rounded-xl"
              value={newClient.taxId}
              onChange={(e) => setNewClient({ ...newClient, taxId: e.target.value })}
            />
            <input
              placeholder="Email"
              className="px-4 py-2 border rounded-xl"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            />

            <input
              placeholder="Calle"
              className="md:col-span-3 px-4 py-2 border rounded-xl"
              value={newClient.address.street}
              onChange={(e) =>
                setNewClient({
                  ...newClient,
                  address: { ...newClient.address, street: e.target.value }
                })
              }
            />

            <input
              placeholder="Ciudad"
              className="px-4 py-2 border rounded-xl"
              value={newClient.address.city}
              onChange={(e) =>
                setNewClient({
                  ...newClient,
                  address: { ...newClient.address, city: e.target.value }
                })
              }
            />
            <input
              placeholder="CP"
              className="px-4 py-2 border rounded-xl"
              value={newClient.address.zip}
              onChange={(e) =>
                setNewClient({
                  ...newClient,
                  address: { ...newClient.address, zip: e.target.value }
                })
              }
            />
            <input
              placeholder="País"
              className="px-4 py-2 border rounded-xl"
              value={newClient.address.country}
              onChange={(e) =>
                setNewClient({
                  ...newClient,
                  address: { ...newClient.address, country: e.target.value }
                })
              }
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-400">
              Cancelar
            </button>
            <button onClick={handleAdd} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">
              Guardar Cliente
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
            Cargando clientes…
          </div>
        ) : clients.length > 0 ? (
          clients.map((client) => (
            <div
              key={client.id}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all flex items-start gap-4 group"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-indigo-600 uppercase">
                {client.name?.charAt(0) || 'C'}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-800">{client.name}</h3>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail size={14} /> {client.email || '—'}
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPin size={14} />{' '}
                  {[client.address?.street, client.address?.city, client.address?.zip, client.address?.country]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
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
