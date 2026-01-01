import React, { useEffect, useState } from 'react';
import { Save, Shield, Briefcase, LogOut, Plus, Trash2, Check, Mail } from 'lucide-react';
import { store } from '../lib/store';
import { Issuer } from '../types';
import { auth } from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

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
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [editing, setEditing] = useState<Issuer | null>(null);
  const [newIssuer, setNewIssuer] = useState<Omit<Issuer, 'id'>>(emptyIssuer());

  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string>('');

  // ---- Load once
  useEffect(() => {
    const settings = store.getSettings();
    setIssuers(settings.issuers);
    setActiveId(settings.activeIssuerId);
  }, []);

  // ---- Issuers
  const refreshIssuers = () => {
    const s = store.getSettings();
    setIssuers(s.issuers);
    setActiveId(s.activeIssuerId);
  };

  const saveIssuer = () => {
    if (!editing) return;
    store.updateIssuer(editing);
    setEditing(null);
    refreshIssuers();
  };

  const addIssuer = () => {
    if (!newIssuer.name || !newIssuer.taxId) {
      alert('Nombre y NIF son obligatorios');
      return;
    }
    store.addIssuer(newIssuer);
    setNewIssuer(emptyIssuer());
    refreshIssuers();
  };

  const deleteIssuer = (id: string) => {
    if (!confirm('¿Eliminar este emisor?')) return;
    store.deleteIssuer(id);
    refreshIssuers();
  };

  const setActive = (id: string) => {
    store.setActiveIssuer(id);
    refreshIssuers();
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
    } catch (e: any) {
      setResetError('No se pudo enviar el email de cambio de contraseña.');
    }
  };

  return (
    <div className="space-y-10 max-w-4xl pb-20 animate-in fade-in">
      <header>
        <h1 className="text-3xl font-bold text-slate-800">Ajustes del sistema</h1>
        <p className="text-slate-500">Gestiona emisores, seguridad y sesión.</p>
      </header>

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
