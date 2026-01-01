
import React, { useState } from 'react';
import { Save, Bell, Shield, Database, Briefcase, Key, LogOut } from 'lucide-react';

interface SettingsViewProps {
  onLogout?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onLogout }) => {
  const [passChanged, setPassChanged] = useState(false);
  const [newPass, setNewPass] = useState('');

  const handleChangePass = () => {
    if (newPass.length < 4) return alert('La contraseña debe tener 4 caracteres');
    localStorage.setItem('si_master_password', btoa(newPass));
    setPassChanged(true);
    setTimeout(() => setPassChanged(false), 3000);
    setNewPass('');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 max-w-3xl pb-20">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Ajustes</h1>
        <p className="text-slate-500">Configura tus datos fiscales y seguridad de acceso.</p>
      </div>

      <div className="grid gap-8">
        {/* Fiscal Section */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-slate-800">
            <Briefcase size={20} className="text-indigo-600" />
            <h2 className="font-bold">Datos del Emisor (Tus Datos)</h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Nombre o Razón Social</label>
                <input type="text" defaultValue="Patricia de Pastor Mendez" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">NIF / CIF / VAT ID</label>
                <input type="text" defaultValue="06010586L" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="col-span-full space-y-2">
                <label className="text-sm font-semibold text-slate-600">Dirección Completa</label>
                <input type="text" defaultValue="Calle Alcalde Sainz de Baranda 55, 6ºD" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
              <Save size={18} /> Guardar Datos Fiscales
            </button>
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-slate-800">
            <Shield size={20} className="text-indigo-600" />
            <h2 className="font-bold">Seguridad y Privacidad</h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Cambiar Contraseña Maestra</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password" 
                      placeholder="Nueva contraseña" 
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      className="w-full px-4 py-3 pl-12 rounded-xl border border-slate-200 outline-none" 
                    />
                  </div>
                </div>
                <button 
                  onClick={handleChangePass}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  Actualizar Clave
                </button>
              </div>
              {passChanged && <p className="text-green-600 font-bold text-xs">✓ Contraseña actualizada correctamente.</p>}
            </div>

            <hr className="border-slate-50" />

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
              <div>
                <p className="font-bold text-red-800">Sesión Actual</p>
                <p className="text-sm text-red-600/70">Cierra la sesión para bloquear el acceso de nuevo.</p>
              </div>
              <button 
                onClick={onLogout}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 transition-all"
              >
                <LogOut size={18} /> Salir
              </button>
            </div>
          </div>
        </section>

        {/* Info Box */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-indigo-700 flex gap-4">
            <Shield className="shrink-0 mt-1" />
            <div className="text-sm">
                <p className="font-bold mb-1">Sobre tu seguridad</p>
                <p>Todos los datos se guardan exclusivamente en el navegador local de este dispositivo. No se envían a ningún servidor externo, asegurando tu total privacidad fiscal.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
