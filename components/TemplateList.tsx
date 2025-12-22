
import React from 'react';
import { Plus, LayoutTemplate, RotateCw, Globe } from 'lucide-react';

const TemplateList: React.FC = () => {
  const templates = [
    { id: '1', name: 'Alquiler Mensual Local', type: 'RENT', recurring: true, lang: 'ES', lastUsed: '01 Nov' },
    { id: '2', name: 'Servicios Consultoría EN', type: 'SERVICE', recurring: false, lang: 'EN', lastUsed: 'Hoy' },
    { id: '3', name: 'Clases Particulares', type: 'CLASS', recurring: true, lang: 'ES', lastUsed: 'Hace 5 días' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Plantillas</h1>
          <p className="text-slate-500">Configura facturas base para usarlas en un click.</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all">+ Nueva Plantilla</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(tpl => (
          <div key={tpl.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <LayoutTemplate size={24} />
              </div>
              <div className="flex gap-2">
                {tpl.recurring && (
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg" title="Recurrente">
                    <RotateCw size={16} />
                  </div>
                )}
                <div className="p-2 bg-slate-50 text-slate-400 rounded-lg flex items-center gap-1 text-[10px] font-bold">
                  <Globe size={14} /> {tpl.lang}
                </div>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">{tpl.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{tpl.type} • Usada por última vez: {tpl.lastUsed}</p>
            <div className="pt-4 border-t border-slate-50 flex gap-2">
              <button className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-800">Usar ahora</button>
              <button className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-200">Editar</button>
            </div>
          </div>
        ))}
        
        <button className="border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-400 transition-all bg-white/50">
          <Plus size={48} strokeWidth={1} className="mb-2" />
          <span className="font-bold">Crear nueva plantilla</span>
        </button>
      </div>
    </div>
  );
};

export default TemplateList;
