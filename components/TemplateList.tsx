import React, { useEffect, useMemo, useState } from 'react';
import { Plus, LayoutTemplate, RotateCw, Globe, Trash2 } from 'lucide-react';
import { store } from '../lib/store';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { InvoiceTemplate, Client, Issuer, InvoiceItem, Party, AppSettings } from '../types';

type Template = InvoiceTemplate & { id: string };

const fmtLastUsed = (tpl: any) => {
  const v = tpl?.lastUsedAt || tpl?.updatedAt || tpl?.createdAt;
  if (!v) return '—';
  try {
    if (typeof v?.toDate === 'function') return v.toDate().toLocaleDateString();
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
};

const toNum = (v: any, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const pickIndex = (title: string, options: string[], defaultIndex = 0): number | null => {
  if (!options.length) return null;
  const lines = options.map((o, i) => `${i + 1}) ${o}`).join('\n');
  const raw = window.prompt(`${title}\n\n${lines}\n\nEscribe un número:`, String(defaultIndex + 1));
  if (!raw) return null;
  const idx = Number(raw) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx >= options.length) return null;
  return idx;
};

const TemplateList: React.FC = () => {
  const [uid, setUid] = useState<string>('');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fsError, setFsError] = useState<string>('');

  // ✅ FIX: uid reactivo (auth.currentUser no dispara rerender)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || '');
    });
    return () => unsub();
  }, []);

  const loadIssuers = async (uid: string) => {
    // 1) intenta Firestore settings
    try {
      const sRef = doc(db, 'settings', uid);
      const sSnap = await getDoc(sRef);
      if (sSnap.exists()) {
        const data = sSnap.data() as any as AppSettings;
        const list = Array.isArray((data as any)?.issuers) ? ((data as any).issuers as Issuer[]) : [];
        if (list.length) return list;
      }
    } catch {
      // ignore -> fallback
    }

    // 2) fallback local
    try {
      const local = store.getIssuers?.() || [];
      return Array.isArray(local) ? (local as Issuer[]) : [];
    } catch {
      return [];
    }
  };

  const reload = async (force = false) => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFsError('');

    try {
      // 0) issuers
      const iss = await loadIssuers(uid);
      setIssuers(iss);

      // 1) clients (1 query por pantalla)
      try {
        const cl = await store.loadClientsOnce(uid, { force });
        setClients((Array.isArray(cl) ? (cl as Client[]) : []) as Client[]);
      } catch {
        setClients([]);
      }

      // 2) migración legacy local -> Firestore (solo 1 vez)
      await store.migrateLocalTemplatesToFirestoreOnce(uid);

      // 3) templates (1 query por pantalla, cacheable)
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

  const buildTemplateViaPrompts = (base?: Partial<Template>): Template | null => {
    // nombre
    const name = window.prompt('Nombre de la plantilla:', String(base?.name || '').trim());
    if (!name?.trim()) return null;

    // emisor
    if (!issuers.length) {
      alert('No hay emisores configurados en Ajustes.');
      return null;
    }
    const issuerLabels = issuers.map((i) => (i.alias ? `${i.alias} — ${i.name}` : i.name));
    const issuerDefaultIdx = Math.max(0, issuers.findIndex((i) => i.id === (base as any)?.issuerId));
    const issuerIdx = pickIndex('Selecciona EMISOR', issuerLabels, issuerDefaultIdx);
    if (issuerIdx === null) return null;
    const issuer = issuers[issuerIdx];

    // receptor (cliente)
    if (!clients.length) {
      alert('No hay clientes. Crea primero un cliente.');
      return null;
    }
    const clientLabels = clients.map((c) => `${c.name} (${c.taxId || '—'})`);
    const clientDefaultIdx = Math.max(0, clients.findIndex((c) => c.id === (base as any)?.clientId));
    const clientIdx = pickIndex('Selecciona RECEPTOR (cliente)', clientLabels, clientDefaultIdx);
    if (clientIdx === null) return null;
    const client = clients[clientIdx];

    // 1 línea (concepto + qty + precio)
    const desc = window.prompt(
      'Concepto / descripción:',
      String((base as any)?.items?.[0]?.description || '')
    ) ?? '';

    const quantity = toNum(
      window.prompt('Cantidad:', String((base as any)?.items?.[0]?.quantity ?? 1)),
      1
    );

    const unitCost = toNum(
      window.prompt('Precio unitario (€):', String((base as any)?.items?.[0]?.unitCost ?? 0)),
      0
    );

    const item: InvoiceItem = {
      id: (base as any)?.items?.[0]?.id || Date.now().toString(),
      description: String(desc || '').trim(),
      quantity,
      unitCost,
      amount: (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitCost) ? unitCost : 0)
    };

    const vatRate = toNum(window.prompt('IVA (%):', String(base?.vatRate ?? 21)), 21);
    const irpfRate = toNum(window.prompt('IRPF (%):', String(base?.irpfRate ?? 15)), 15);

    const tpl: Template = {
      id: String(base?.id || Date.now().toString()),
      name: name.trim(),
      type: (base?.type as any) || 'GENERIC',
      lang: (base?.lang as any) || 'ES',

      issuerId: issuer.id,
      issuer: {
        name: issuer.name,
        taxId: issuer.taxId,
        address: issuer.address,
        email: issuer.email
      } as Party,

      clientId: client.id,
      recipient: {
        name: client.name,
        taxId: client.taxId,
        address: client.address,
        email: client.email
      } as Party,

      items: [item],

      vatRate,
      irpfRate,

      isRecurring: false,
      recurring: false,

      lastUsedAt: (base as any)?.lastUsedAt || null
    } as any;

    return tpl;
  };

  const handleCreate = async () => {
    if (!uid) return;

    const tpl = buildTemplateViaPrompts();
    if (!tpl) return;

    // UI optimista
    setTemplates((prev) => [tpl, ...prev]);

    try {
      await store.saveTemplate(uid, tpl as InvoiceTemplate);
      setFsError('');
    } catch (e: any) {
      console.error('Template save failed:', e);
      setFsError(e?.message ? String(e.message) : 'No se pudo guardar la plantilla.');
      await reload(true);
    }
  };

  const handleEdit = async (tpl: Template) => {
    if (!uid) return;

    const next = buildTemplateViaPrompts(tpl);
    if (!next) return;

    // UI optimista
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? next : t)));

    try {
      await store.saveTemplate(uid, next as InvoiceTemplate);
      setFsError('');
    } catch (e: any) {
      console.error('Template update failed:', e);
      setFsError(e?.message ? String(e.message) : 'No se pudo actualizar la plantilla.');
      await reload(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!uid) return;
    if (!confirm('¿Eliminar esta plantilla?')) return;

    setTemplates((prev) => prev.filter((t) => t.id !== id));

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

    const next: any = { ...tpl, lastUsedAt: new Date().toISOString() };

    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? (next as Template) : t)));

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
            {(tpl.isRecurring || tpl.recurring) && (
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

        <p className="text-slate-400 text-sm mb-2">
          {(tpl.type || 'TEMPLATE')} • Usada por última vez: {fmtLastUsed(tpl)}
        </p>

        <p className="text-slate-500 text-xs mb-4">
          <b>Emisor:</b> {tpl?.issuer?.name || '—'} <br />
          <b>Cliente:</b> {tpl?.recipient?.name || '—'} <br />
          <b>Concepto:</b> {tpl?.items?.[0]?.description || '—'}
        </p>

        <div className="pt-4 border-t border-slate-50 flex gap-2">
          <button
            onClick={() => handleUseNow(tpl as Template)}
            className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-800"
          >
            Usar ahora
          </button>
          <button
            onClick={() => handleEdit(tpl as Template)}
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
          disabled={!uid}
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
          disabled={!uid}
        >
          <Plus size={48} strokeWidth={1} className="mb-2" />
          <span className="font-bold">Crear nueva plantilla</span>
        </button>
      </div>
    </div>
  );
};

export default TemplateList;
