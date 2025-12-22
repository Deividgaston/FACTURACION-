
import React from 'react';
import { Save, Bell, Shield, Database, Briefcase } from 'lucide-react';

const SettingsView: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Ajustes</h1>
        <p className="text-slate-500">Configura tus datos fiscales y preferencias de la aplicación.</p>
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
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Email de contacto</label>
                <input type="email" defaultValue="patricia@example.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Prefijo Facturación</label>
                <input type="text" defaultValue="2025-" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden opacity-50 cursor-not-allowed">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-slate-800">
            <Bell size={20} className="text-indigo-600" />
            <h2 className="font-bold">Notificaciones y Automatización</h2>
          </div>
          <div className="p-8 space-y-4">
             <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Generación Automática</p>
                <p className="text-sm text-slate-500">Generar facturas recurrentes el día 1 de cada mes.</p>
              </div>
              <div className="w-12 h-6 bg-indigo-600 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
             <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Envío Directo</p>
                <p className="text-sm text-slate-500">Enviar PDF por email automáticamente al generarse.</p>
              </div>
              <div className="w-12 h-6 bg-slate-200 rounded-full relative">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Save size={18} /> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
