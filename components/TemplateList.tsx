import React, { useEffect, useMemo, useState } from 'react';
import { Plus, LayoutTemplate, RotateCw, Globe, Trash2 } from 'lucide-react';
import { store } from '../lib/store';
import { auth } from '../lib/firebase';
import type { InvoiceTemplate } from '../types';

type Template = InvoiceTemplate & { id: string };

const fmtLastUsed = (tpl: any) => {
  const v = tpl?.lastUsedAt || tpl?.updatedAt || tpl?.createdAt;
  if (!v) return '—';
  try {
    // Firestore Timestamp -> Date
    if (typeof v?.toDate === 'function') return v.toDate().toLocaleDateString();
    // ISO/string/number
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
};

const TemplateList: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [fsError, setFsError] = useState<string>('');

  const uid = auth.currentUser?.uid || '';

  const reload = async (force = false) => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFsError('');
    try {
      // 1) migración legacy local -> Firestore (solo 1 vez)
      await store.migrateLocalTemplatesToFirestoreOnce(uid);

      // 2) 1 query por pantalla (cacheable)
      const list = (await store.loadTemplatesOnce(uid, { force })) as any[];
      setTemplates((Array.isArray(list) ? list : []) as Template[]);
    } catch (e: any) {
      console.error('Templates load failed:', e);
      setFsError(e?.message ? String(e.message) : 'No se pudieron cargar las plantillas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const handleCreate = async () => {
    if (!uid) return;

    const name = window.prompt('Nombre de la plantilla:');
    if (!name?.trim()) return;

    // ✅ cambios mínimos: plantilla “base” (completa campos con defaults, sin asumir demasiado el type)
    const tpl: any = {
      id: Date.now().toString(),
      name: name.trim(),
      type: 'GENERIC',
      recurring: false,
      lang: 'ES',
      items: [],
      vatRate: 21,
      irpfRate: 15,
      lastUsedAt: null
    };

    // UI optimista
    setTemplates(prev => [tpl as Template, ...prev]);

    try {
      await store.saveTemplate(uid, tpl as InvoiceTemplate);
      setFsError('');
    } catch (e: any) {
      console.error('Template save failed:', e);
      setFsError(e?.message ? String(e.message) : 'No se pudo guardar la plantilla.');
      await reload(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!uid) return;
    if (!confirm('¿Eliminar esta plantilla?')) return;

    // UI optimista
    setTemplates(prev => prev.filter(t => t.id !== id));

    try {
      await store.deleteTemplate(uid, id);
      setFsError('');
    } catch (e: any) {
      console.error('Template delete failed:', e);
      setFsError(e?.message ? String(e.message) : 'No se pudo eliminar la plantilla.');
      await reload(true);
    }
  };

  const handleUseNow = async (tpl: Template) => {
    if (!uid) return;

    // “Usar ahora” aquí solo marca lastUsedAt (la selección en factura la haremos en InvoiceEditor)
    const next: any = { ...tpl, lastUsedAt: new Date().toISOString() };

    // UI optimista
    setTemplates(prev => prev.map(t => (t.id === tpl.id ? (next as Template) : t)));

    try {
      await store.saveTemplate(uid, next as InvoiceTemplate);
      setFsError('');
    } catch (e: any) {
      console.error('Template update failed:', e);
      setFsError(e?.message ? String(e.message) : 'No se pudo actualizar la plantilla.');
      await reload(true);
    }
  };

  const cards = useMemo(() => {
    if (loading) {
      return (
        <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
          Cargando plantillas…
        </div>
      );
    }

    if (!templates.length) {
      return (
        <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
          No hay plantillas aún.
        </div>
      );
    }

    return templates.map((tpl: any) => (
      <div
        key={tpl.id}
        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <LayoutTemplate size={24} />
          </div>
          <div className="flex gap-2 items-center">
            {tpl.recurring && (
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg" title="Recurrente">
                <RotateCw size={16} />
              </div>
            )}
            <div className="p-2 bg-slate-50 text-slate-400 rounded-lg flex items-center gap-1 text-[10px] font-bold">
              <Globe size={14} /> {tpl.lang || 'ES'}
            </div>

            <button
              onClick={() => handleDelete(tpl.id)}
              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              title="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-1">{tpl.name || 'Sin nombre'}</h3>
        <p className="text-slate-400 text-sm mb-4">
          {(tpl.type || 'TEMPLATE')} • Usada por última vez: {fmtLastUsed(tpl)}
        </p>

        <div className="pt-4 border-t border-slate-50 flex gap-2">
          <button
            onClick={() => handleUseNow(tpl as Template)}
            className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-800"
          >
            Usar ahora
          </button>
          <button
            onClick={() => alert('Edición de plantilla: siguiente paso cuando conectemos su uso en factura.')}
            className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-200"
          >
            Editar
          </button>
        </div>
      </div>
    ));
  }, [loading, templates]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Plantillas</h1>
          <p className="text-slate-500">Configura facturas base para usarlas en un click.</p>
        </div>

        <button
          onClick={handleCreate}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          + Nueva Plantilla
        </button>
      </div>

      {fsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 font-semibold">
          {fsError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards}

        <button
          onClick={handleCreate}
          className="border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-400 transition-all bg-white/50"
        >
          <Plus size={48} strokeWidth={1} className="mb-2" />
          <span className="font-bold">Crear nueva plantilla</span>
        </button>
      </div>
    </div>
  );
};

export default TemplateList;
