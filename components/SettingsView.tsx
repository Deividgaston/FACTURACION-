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
  address: { street: '', city: '', zip: '', country: '' }
});

const SettingsView: React.FC<SettingsViewProps> = ({ onLogout }) => {
  const [loading, setLoading] = useState(true);

  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [editing, setEditing] = useState<Issuer | null>(null);
  const [newIssuer, setNewIssuer] = useState<Omit<Issuer, 'id'>>(emptyIssuer());

  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string>('');
  const [settingsError, setSettingsError] = useState<string>('');

  // --- helpers firestore
  const settingsRef = (uid: string) => doc(db, 'settings', uid);

  const applySettingsToUI = (s: AppSettings) => {
    setIssuers(s.issuers || []);
    setActiveId(s.activeIssuerId || (s.issuers?.[0]?.id ?? ''));
  };

  const buildSettingsPayload = (s: AppSettings) => ({
    issuers: s.issuers || [],
    activeIssuerId: s.activeIssuerId || (s.issuers?.[0]?.id ?? ''),
    defaultCurrency: s.defaultCurrency,
    nextInvoiceNumber: s.nextInvoiceNumber,
    yearCounter: s.yearCounter,
    updatedAt: serverTimestamp()
  });

  // ---- Load once (1 getDoc)
  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);
      setSettingsError('');

      const uid = auth.currentUser?.uid;
      if (!uid) {
        if (alive) setLoading(false);
        return;
      }

      try {
        const ref = settingsRef(uid);
        const snap = await getDoc(ref);

        // Si existe en Firestore: usamos eso
        if (snap.exists()) {
          const data = snap.data() as any;
          const remote: AppSettings = {
            issuers: Array.isArray(data.issuers) ? data.issuers : [],
            activeIssuerId: typeof data.activeIssuerId === 'string' ? data.activeIssuerId : '',
            defaultCurrency: data.defaultCurrency || 'EUR',
            nextInvoiceNumber: data.nextInvoiceNumber || 1,
            yearCounter: data.yearCounter || { [new Date().getFullYear()]: 1 }
          };

          if (alive) applySettingsToUI(remote);
          return;
        }

        // Si NO existe: migramos desde local (tu store ya migra issuerDefaults -> issuers)
        const local = store.getSettings();

        // aseguramos mínimo 1 issuer
        const safeLocal: AppSettings = {
          ...local,
          issuers: local.issuers && local.issuers.length ? local.issuers : local.issuers,
          activeIssuerId:
            local.activeIssuerId ||
            (local.issuers && local.issuers.length ? local.issuers[0].id : '')
        };

        await setDoc(ref, { ...buildSettingsPayload(safeLocal), createdAt: serverTimestamp() }, { merge: true });

        // limpiamos legacy para que no haya doble fuente de verdad
        try {
          localStorage.removeItem('si_settings');
        } catch {}

        if (alive) applySettingsToUI(safeLocal);
      } catch (e) {
        if (alive) setSettingsError('No se pudieron cargar los ajustes (Firestore).');
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, []);

  const persistSettings = async (uid: string, s: AppSettings) => {
    await setDoc(settingsRef(uid), buildSettingsPayload(s), { merge: true });
  };

  const currentSettingsFromUI = (): AppSettings => {
    // mantenemos el resto de campos desde el local (por compatibilidad)
    const base = store.getSettings();
    return {
      ...base,
      issuers,
      activeIssuerId: activeId || (issuers[0]?.id ?? '')
    };
  };

  // ---- Issuers (Firestore)
  const saveIssuer = async () => {
    if (!editing) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const updatedIssuers = issuers.map(i => (i.id === editing.id ? editing : i));

    // UI optimista
    setIssuers(updatedIssuers);
    setEditing(null);

    try {
      const s = { ...currentSettingsFromUI(), issuers: updatedIssuers };
      await persistSettings(uid, s);
    } catch {
      setSettingsError('No se pudo guardar el emisor.');
    }
  };

  const addIssuer = async () => {
    if (!newIssuer.name || !newIssuer.taxId) {
      alert('Nombre y NIF son obligatorios');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const id = `iss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const issuerToAdd: Issuer = { id, ...newIssuer };

    const updatedIssuers = [issuerToAdd, ...issuers];
    const nextActiveId = activeId || issuerToAdd.id;

    // UI optimista
    setIssuers(updatedIssuers);
    setActiveId(nextActiveId);
    setNewIssuer(emptyIssuer());

    try {
      const s = { ...currentSettingsFromUI(), issuers: updatedIssuers, activeIssuerId: nextActiveId };
      await persistSettings(uid, s);
    } catch {
      setSettingsError('No se pudo añadir el emisor.');
    }
  };

  const deleteIssuer = async (id: string) => {
    if (!confirm('¿Eliminar este emisor?')) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const updatedIssuers = issuers.filter(i => i.id !== id);
    const safeIssuers = updatedIssuers.length ? updatedIssuers : issuers; // evitamos quedarnos sin ninguno
    const nextActive =
      activeId === id ? (safeIssuers[0]?.id || '') : activeId;

    // UI optimista
    setIssuers(safeIssuers);
    setActiveId(nextActive);

    try {
      const s = { ...currentSettingsFromUI(), issuers: safeIssuers, activeIssuerId: nextActive };
      await persistSettings(uid, s);
    } catch {
      setSettingsError('No se pudo eliminar el emisor.');
    }
  };

  const setActive = async (id: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // UI optimista
    setActiveId(id);

    try {
      const s = { ...currentSettingsFromUI(), activeIssuerId: id };
      await persistSettings(uid, s);
    } catch {
      setSettingsError('No se pudo activar el emisor.');
    }
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

      {settingsError && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4 font-semibold text-sm">
          {settingsError}
        </div>
      )}

      {/* ISSUERS */}
      <section className="bg-white rounded-3xl border shadow-sm">
        <div className="p-6 border-b flex items-center gap-3">
          <Briefcase className="text-indigo-600" />
          <h2 className="font-bold">Emisores</h2>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="py-10 text-center text-slate-400">Cargando emisores…</div>
          ) : (
            issuers.map((iss) => (
              <div
                key={iss.id}
                className="border rounded-2xl p-4 flex flex-col md:flex-row gap-4 md:items-center justify-between"
              >
                <div>
                  <p className="font-bold">{iss.alias || iss.name}</p>
                  <p className="text-sm text-slate-500">{iss.taxId}</p>
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
            ))
          )}

          {/* NEW ISSUER */}
          {!loading && (
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-bold">Nuevo emisor</h3>
              <input
                placeholder="Alias (opcional)"
                className="input"
                value={newIssuer.alias}
                onChange={(e) => setNewIssuer({ ...newIssuer, alias: e.target.value })}
              />
              <input
                placeholder="Nombre / Razón social"
                className="input"
                value={newIssuer.name}
                onChange={(e) => setNewIssuer({ ...newIssuer, name: e.target.value })}
              />
              <input
                placeholder="NIF / CIF"
                className="input"
                value={newIssuer.taxId}
                onChange={(e) => setNewIssuer({ ...newIssuer, taxId: e.target.value })}
              />
              <input
                placeholder="Email"
                className="input"
                value={newIssuer.email}
                onChange={(e) => setNewIssuer({ ...newIssuer, email: e.target.value })}
              />

              <button
                onClick={addIssuer}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
              >
                <Plus size={16} /> Añadir emisor
              </button>
            </div>
          )}
        </div>
      </section>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">Editar emisor</h3>

            <input
              className="input"
              value={editing.alias || ''}
              onChange={(e) => setEditing({ ...editing, alias: e.target.value })}
            />
            <input
              className="input"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <input
              className="input"
              value={editing.taxId}
              onChange={(e) => setEditing({ ...editing, taxId: e.target.value })}
            />
            <input
              className="input"
              value={editing.email}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })}
            />

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
          Sesión actual:{' '}
          <span className="font-semibold text-slate-700">{auth.currentUser?.email || '-'}</span>
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
