import React, { useEffect, useState } from 'react';
import { Save, Shield, Briefcase, LogOut, Plus, Trash2, Check, Mail } from 'lucide-react';
import { store } from '../lib/store';
import { Issuer, AppSettings } from '../types';
import { auth, db } from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface SettingsViewProps {
  onLogout?: () => void;
}

const emptyIssuer = (): Omit<Issuer, 'id'> => ({
  alias: '',
  name: '',
  taxId: '',
  email: '',
  address: { street: '', city: '', zip: '', country: 'España' }
});

const settingsRef = (uid: string) => doc(db, 'settings', uid);

const isAddressComplete = (a: any) =>
  !!a?.street?.trim() && !!a?.city?.trim() && !!a?.zip?.trim() && !!a?.country?.trim();

const SettingsView: React.FC<SettingsViewProps> = ({ onLogout }) => {
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [editing, setEditing] = useState<Issuer | null>(null);
  const [newIssuer, setNewIssuer] = useState<Omit<Issuer, 'id'>>(emptyIssuer());

  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string>('');

  const [fsError, setFsError] = useState<string>('');

  const applySettingsToState = (s: AppSettings) => {
    setIssuers(s.issuers || []);
    setActiveId(s.activeIssuerId || (s.issuers?.[0]?.id || ''));
  };

  const loadSettingsOnce = async () => {
    setFsError('');
    const uid = auth.currentUser?.uid;
    if (!uid) {
      applySettingsToState(store.getSettings());
      return;
    }

    // 1 lectura (source of truth Firestore) + fallback local
    try {
      const snap = await getDoc(settingsRef(uid));
      if (snap.exists()) {
        const data = snap.data() as any;
        const remote: AppSettings = {
          issuers: Array.isArray(data.issuers) ? data.issuers : [],
          activeIssuerId: typeof data.activeIssuerId === 'string' ? data.activeIssuerId : '',
          defaultCurrency: data.defaultCurrency || 'EUR',
          nextInvoiceNumber: data.nextInvoiceNumber || 1,
          yearCounter: data.yearCounter || { [new Date().getFullYear()]: 1 }
        };
        // cache local
        store.saveSettings(remote);
        applySettingsToState(remote);
        return;
      }

      // Si no existe doc en FS, usar local y crear doc (1 write)
      const local = store.getSettings();
      applySettingsToState(local);
      await setDoc(settingsRef(uid), { ...local, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      // fallback local sin romper
      setFsError('No se pudieron cargar los ajustes (Firestore).');
      applySettingsToState(store.getSettings());
    }
  };

  const saveSettingsEverywhere = async (next: AppSettings) => {
    // local cache siempre
    store.saveSettings(next);
    applySettingsToState(next);

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      await setDoc(settingsRef(uid), { ...next, updatedAt: serverTimestamp() }, { merge: true });
      setFsError('');
    } catch {
      setFsError('No se pudieron guardar los ajustes en Firestore (se guardaron en local).');
    }
  };

  useEffect(() => {
    loadSettingsOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Issuers CRUD (con Firestore)
  const addIssuer = async () => {
    if (!newIssuer.name?.trim() || !newIssuer.taxId?.trim()) {
      alert('Nombre y NIF son obligatorios');
      return;
    }
    if (!isAddressComplete(newIssuer.address)) {
      alert('La dirección del emisor debe estar completa (calle, ciudad, CP, país).');
      return;
    }

    const created = store.addIssuer(newIssuer);
    const next = store.getSettings(); // ya incluye el nuevo emisor
    // forzar active si no había
    if (!next.activeIssuerId) next.activeIssuerId = created.id;

    await saveSettingsEverywhere(next);
    setNewIssuer(emptyIssuer());
  };

  const saveIssuer = async () => {
    if (!editing) return;

    if (!editing.name?.trim() || !editing.taxId?.trim()) {
      alert('Nombre y NIF son obligatorios');
      return;
    }
    if (!isAddressComplete(editing.address)) {
      alert('La dirección del emisor debe estar completa (calle, ciudad, CP, país).');
      return;
    }

    store.updateIssuer(editing);
    const next = store.getSettings();
    await saveSettingsEverywhere(next);
    setEditing(null);
  };

  const deleteIssuer = async (id: string) => {
    if (!confirm('¿Eliminar este emisor?')) return;
    store.deleteIssuer(id);
    const next = store.getSettings();
    await saveSettingsEverywhere(next);
  };

  const setActive = async (id: string) => {
    store.setActiveIssuer(id);
    const next = store.getSettings();
    await saveSettingsEverywhere(next);
  };

  // ---- Firebase password reset (real)
  const handlePasswordReset = async () => {
    setResetSent(false);
    setResetError('');

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      setResetError('No hay email en la sesión actual.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, userEmail);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 4000);
    } catch {
      setResetError('No se pudo enviar el email de cambio de contraseña.');
    }
  };

  return (
    <div className="space-y-10 max-w-4xl pb-20 animate-in fade-in">
      <header>
        <h1 className="text-3xl font-bold text-slate-800">Ajustes del sistema</h1>
        <p className="text-slate-500">Gestiona emisores, seguridad y sesión.</p>
      </header>

      {fsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 font-semibold">
          {fsError}
        </div>
      )}

      {/* ISSUERS */}
      <section className="bg-white rounded-3xl border shadow-sm">
        <div className="p-6 border-b flex items-center gap-3">
          <Briefcase className="text-indigo-600" />
          <h2 className="font-bold">Emisores</h2>
        </div>

        <div className="p-6 space-y-6">
          {issuers.map((iss) => (
            <div
              key={iss.id}
              className="border rounded-2xl p-4 flex flex-col md:flex-row gap-4 md:items-center justify-between"
            >
              <div>
                <p className="font-bold">{iss.alias || iss.name}</p>
                <p className="text-sm text-slate-500">{iss.taxId}</p>
                <p className="text-sm text-slate-500">
                  {iss.address?.street} · {iss.address?.city} · {iss.address?.zip} · {iss.address?.country}
                </p>
                {activeId === iss.id && (
                  <span className="text-xs text-green-600 font-bold">Emisor activo</span>
                )}
              </div>

              <div className="flex gap-2">
                {activeId !== iss.id && (
                  <button
                    onClick={() => setActive(iss.id)}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded-xl flex gap-1 items-center"
                  >
                    <Check size={14} /> Activar
                  </button>
                )}
                <button
                  onClick={() => setEditing({ ...iss })}
                  className="px-3 py-2 text-sm bg-slate-200 rounded-xl"
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteIssuer(iss.id)}
                  className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-xl"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* NEW ISSUER */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="font-bold">Nuevo emisor</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                placeholder="Alias (opcional)"
                className="input"
                value={newIssuer.alias}
                onChange={(e) => setNewIssuer({ ...newIssuer, alias: e.target.value })}
              />
              <input
                placeholder="Email"
                className="input"
                value={newIssuer.email}
                onChange={(e) => setNewIssuer({ ...newIssuer, email: e.target.value })}
              />
              <input
                placeholder="Nombre / Razón social *"
                className="input md:col-span-2"
                value={newIssuer.name}
                onChange={(e) => setNewIssuer({ ...newIssuer, name: e.target.value })}
              />
              <input
                placeholder="NIF / CIF *"
                className="input"
                value={newIssuer.taxId}
                onChange={(e) => setNewIssuer({ ...newIssuer, taxId: e.target.value })}
              />

              <input
                placeholder="Calle *"
                className="input md:col-span-2"
                value={newIssuer.address.street}
                onChange={(e) =>
                  setNewIssuer({ ...newIssuer, address: { ...newIssuer.address, street: e.target.value } })
                }
              />
              <input
                placeholder="Ciudad *"
                className="input"
                value={newIssuer.address.city}
                onChange={(e) =>
                  setNewIssuer({ ...newIssuer, address: { ...newIssuer.address, city: e.target.value } })
                }
              />
              <input
                placeholder="CP *"
                className="input"
                value={newIssuer.address.zip}
                onChange={(e) =>
                  setNewIssuer({ ...newIssuer, address: { ...newIssuer.address, zip: e.target.value } })
                }
              />
              <input
                placeholder="País *"
                className="input md:col-span-2"
                value={newIssuer.address.country}
                onChange={(e) =>
                  setNewIssuer({ ...newIssuer, address: { ...newIssuer.address, country: e.target.value } })
                }
              />
            </div>

            <button
              onClick={addIssuer}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
            >
              <Plus size={16} /> Añadir emisor
            </button>
          </div>
        </div>
      </section>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">Editar emisor</h3>

            <input
              placeholder="Alias (opcional)"
              className="input"
              value={editing.alias || ''}
              onChange={(e) => setEditing({ ...editing, alias: e.target.value })}
            />
            <input
              placeholder="Nombre / Razón social *"
              className="input"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <input
              placeholder="NIF / CIF *"
              className="input"
              value={editing.taxId}
              onChange={(e) => setEditing({ ...editing, taxId: e.target.value })}
            />
            <input
              placeholder="Email"
              className="input"
              value={editing.email}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                placeholder="Calle *"
                className="input md:col-span-2"
                value={editing.address.street}
                onChange={(e) => setEditing({ ...editing, address: { ...editing.address, street: e.target.value } })}
              />
              <input
                placeholder="Ciudad *"
                className="input"
                value={editing.address.city}
                onChange={(e) => setEditing({ ...editing, address: { ...editing.address, city: e.target.value } })}
              />
              <input
                placeholder="CP *"
                className="input"
                value={editing.address.zip}
                onChange={(e) => setEditing({ ...editing, address: { ...editing.address, zip: e.target.value } })}
              />
              <input
                placeholder="País *"
                className="input md:col-span-2"
                value={editing.address.country}
                onChange={(e) =>
                  setEditing({ ...editing, address: { ...editing.address, country: e.target.value } })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-slate-200">
                Cancelar
              </button>
              <button
                onClick={saveIssuer}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white flex gap-1 items-center"
              >
                <Save size={16} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY */}
      <section className="bg-white rounded-3xl border shadow-sm p-6 space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <Shield className="text-indigo-600" /> Seguridad
        </h2>

        <div className="text-sm text-slate-500">
          Sesión actual: <span className="font-semibold text-slate-700">{auth.currentUser?.email || '-'}</span>
        </div>

        <button
          onClick={handlePasswordReset}
          className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
        >
          <Mail size={16} /> Enviar email para cambiar contraseña
        </button>

        {resetSent && <p className="text-green-600 text-sm font-bold">✓ Email enviado.</p>}
        {resetError && <p className="text-red-600 text-sm font-bold">{resetError}</p>}

        <button
          onClick={onLogout}
          className="mt-4 bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
      </section>
    </div>
  );
};

export default SettingsView;
