import React, { useState, useEffect } from 'react';
import { ChevronLeft, Save, CheckCircle, Printer, Plus } from 'lucide-react';
import { Invoice, InvoiceItem, Party, Language, Issuer, AppSettings, InvoiceTemplate } from '../types';
import { TRANSLATIONS } from '../constants';
import { store } from '../lib/store';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';

interface InvoiceEditorProps {
  onBack: () => void;
  invoiceId?: string;
}

// Cliente = Party + id (para selector y listado)
type Client = Party & { id: string };

// Template con id
type Template = InvoiceTemplate & { id: string };

const isFilled = (v: any) => {
  const s = String(v ?? '').trim();
  if (!s) return false;
  if (s === '-' || s === '—') return false;
  return true;
};

const isAddressComplete = (p?: Party | null) => {
  const a = p?.address as any;
  return !!a && isFilled(a.street) && isFilled(a.city) && isFilled(a.zip) && isFilled(a.country);
};

const safeItemsFromTemplate = (tpl: any): InvoiceItem[] => {
  const arr = Array.isArray(tpl?.items) ? tpl.items : [];
  return arr.map((it: any, idx: number) => {
    const id = String(it?.id || `tpl_${idx}_${Date.now().toString()}`);
    const description = String(it?.description ?? '').trim();
    const quantity = Number(it?.quantity ?? 1);
    const unitCost = Number(it?.unitCost ?? 0);
    const amount = Number.isFinite(Number(it?.amount)) ? Number(it.amount) : quantity * unitCost;
    return { id, description, quantity, unitCost, amount } as InvoiceItem;
  });
};

const toDateInputValue = (iso?: string) => {
  try {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const dateInputToISO = (yyyyMmDd: string) => {
  // fija al mediodía UTC para evitar saltos de zona horaria al parsear
  return new Date(`${yyyyMmDd}T12:00:00.000Z`).toISOString();
};

const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ onBack, invoiceId }) => {
  const [loading, setLoading] = useState(true);

  // Firestore settings (source of truth)
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [activeIssuerId, setActiveIssuerId] = useState<string>('');

  // Clients Firestore
  const [clients, setClients] = useState<Client[]>([]);

  // Templates Firestore
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(''); // solo para NEW

  const [step, setStep] = useState(1);
  const [lang, setLang] = useState<Language>('ES');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [vatRate, setVatRate] = useState(21);
  const [irpfRate, setIrpfRate] = useState(15);
  const [status, setStatus] = useState<Invoice['status']>('DRAFT');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // ✅ NUEVO: fecha editable (YYYY-MM-DD)
  const [invoiceDate, setInvoiceDate] = useState<string>(toDateInputValue());

  // Multi-issuer selection
  const [selectedIssuerId, setSelectedIssuerId] = useState<string>('');

  // Snapshot used for invoice save & print
  const [issuer, setIssuer] = useState<Party>({
    name: '—',
    taxId: '—',
    address: { street: '—', city: '—', zip: '—', country: '—' },
    email: '—'
  });

  const [recipient, setRecipient] = useState<Party>({
    name: 'Selecciona un cliente',
    taxId: '-',
    address: { street: '-', city: '-', zip: '-', country: '-' },
    email: '-'
  });

  const settingsRef = (uid: string) => doc(db, 'settings', uid);

  const applySettings = (s: AppSettings) => {
    const list = Array.isArray((s as any).issuers) ? ((s as any).issuers as Issuer[]) : [];
    const active =
      typeof (s as any).activeIssuerId === 'string'
        ? ((s as any).activeIssuerId as string)
        : (list[0]?.id || '');

    setSettings(s);
    setIssuers(list);
    setActiveIssuerId(active);

    setSelectedIssuerId((prev) => prev || active || (list[0]?.id || ''));

    const activeIssuer = list.find((i) => i.id === active) || list[0];
    if (activeIssuer) {
      setIssuer({
        name: activeIssuer.name,
        taxId: activeIssuer.taxId,
        address: activeIssuer.address,
        email: activeIssuer.email
      });
    }

    return { list, active };
  };

  const loadAllOnce = async (
    uid: string
  ): Promise<{ s: AppSettings; issuersList: Issuer[]; active: string }> => {
    // 1) settings (1 lectura)
    const sSnap = await getDoc(settingsRef(uid));

    let s: AppSettings;
    if (sSnap.exists()) {
      const data = sSnap.data() as any;
      s = {
        issuers: Array.isArray(data.issuers) ? (data.issuers as Issuer[]) : [],
        activeIssuerId: typeof data.activeIssuerId === 'string' ? (data.activeIssuerId as string) : '',
        defaultCurrency: data.defaultCurrency || 'EUR',
        nextInvoiceNumber: data.nextInvoiceNumber || 1,
        yearCounter: data.yearCounter || { [new Date().getFullYear()]: 1 }
      };
    } else {
      s = store.getSettings();
    }

    const { list: issuersList, active } = applySettings(s);

    // 2) clients (1 query por pantalla, cacheable)
    const cl = await store.loadClientsOnce(uid);
    setClients(cl as Client[]);

    // 3) templates (1 query por pantalla, cacheable)
    await store.migrateLocalTemplatesToFirestoreOnce(uid);
    const tpl = await store.loadTemplatesOnce(uid);
    setTemplates((Array.isArray(tpl) ? (tpl as any[]) : []) as Template[]);

    return { s, issuersList, active };
  };

  const subtotal = items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  const vatAmount = (subtotal * (Number(vatRate) || 0)) / 100;
  const irpfAmount = (subtotal * (Number(irpfRate) || 0)) / 100;
  const total = subtotal + vatAmount - irpfAmount;

  const canIssue = isAddressComplete(issuer) && isAddressComplete(recipient);
  const issueBlockedMsg = !isAddressComplete(issuer)
    ? 'Falta la dirección completa del EMISOR (calle, ciudad, CP, país).'
    : !isAddressComplete(recipient)
      ? 'Falta la dirección completa del CLIENTE (calle, ciudad, CP, país).'
      : '';

  useEffect(() => {
    if (!canIssue && status !== 'DRAFT') setStatus('DRAFT');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canIssue]);

  const applyTemplateToInvoice = (tpl: Template | null) => {
    if (!tpl) return;

    if (tpl.lang === 'EN' || tpl.lang === 'ES') setLang(tpl.lang as Language);

    const tplItems = safeItemsFromTemplate(tpl as any);
    if (tplItems.length) {
      setItems(tplItems);
    } else {
      setItems([{ id: '1', description: 'Servicios Profesionales', quantity: 1, unitCost: 0, amount: 0 }]);
    }

    const vr = Number((tpl as any).vatRate);
    const ir = Number((tpl as any).irpfRate);
    if (Number.isFinite(vr)) setVatRate(vr);
    if (Number.isFinite(ir)) setIrpfRate(ir);

    setStatus('DRAFT');
  };

  useEffect(() => {
    let alive = true;
    let ranForUid: string | null = null;

    const runWithUid = async (uid: string) => {
      if (!alive) return;
      if (ranForUid === uid) return;
      ranForUid = uid;

      setLoading(true);
      try {
        const { s, issuersList, active } = await loadAllOnce(uid);
        if (!alive) return;

        // EDIT existing
        if (invoiceId && invoiceId !== 'new') {
          const inv = await store.getInvoice(uid, invoiceId);
          if (!alive || !inv) return;

          setItems(inv.items || []);
          setVatRate(inv.vatRate || 21);
          setIrpfRate(inv.irpfRate || 15);
          setStatus(inv.status || 'DRAFT');
          setRecipient(inv.recipient);
          setLang(inv.lang || 'ES');
          setInvoiceNumber(inv.number || '');
          setSelectedClientId((inv as any).clientId || '');

          setIssuer((inv as any).issuer);

          setSelectedTemplateId((inv as any).templateId || '');

          // ✅ fecha desde factura
          setInvoiceDate(toDateInputValue((inv as any).date));

          const invIssuerId = (inv as any).issuerId as string | undefined;
          if (invIssuerId) {
            setSelectedIssuerId(invIssuerId);
          } else {
            const match = issuersList.find(
              (i) => i.taxId === (inv as any).issuer.taxId && i.name === (inv as any).issuer.name
            );
            if (match) setSelectedIssuerId(match.id);
          }

          return;
        }

        // NEW defaults
        setInvoiceDate(toDateInputValue(new Date().toISOString()));
        setItems([{ id: '1', description: 'Servicios Profesionales', quantity: 1, unitCost: 0, amount: 0 }]);
        setVatRate(21);
        setIrpfRate(15);
        setLang('ES');
        setStatus('DRAFT');

        const activeId = s.activeIssuerId || active || issuersList[0]?.id || '';
        const activeIssuer = issuersList.find((x) => x.id === activeId) || issuersList[0];

        if (activeIssuer) {
          setSelectedIssuerId(activeIssuer.id);
          setIssuer({
            name: activeIssuer.name,
            taxId: activeIssuer.taxId,
            address: activeIssuer.address,
            email: activeIssuer.email
          });
        }

        setSelectedTemplateId('');

        // número provisional (se reservará el definitivo en save con transaction)
        const year = new Date().getFullYear();
        const current = ((s.yearCounter?.[year] || 0) + 1);
        setInvoiceNumber(`${year}${current.toString().padStart(4, '0')}`);
      } finally {
        if (alive) setLoading(false);
      }
    };

    setLoading(true);

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!alive) return;
      if (!user?.uid) {
        setClients([]);
        setTemplates([]);
        setLoading(false);
        return;
      }
      runWithUid(user.uid);
    });

    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const handleIssuerChange = (issuerId: string) => {
    setSelectedIssuerId(issuerId);
    const iss = issuers.find((i) => i.id === issuerId);
    if (iss) {
      setIssuer({
        name: iss.name,
        taxId: iss.taxId,
        address: iss.address,
        email: iss.email
      });
    }
  };

  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplateId(tplId);

    if (!tplId) {
      setItems([{ id: '1', description: 'Servicios Profesionales', quantity: 1, unitCost: 0, amount: 0 }]);
      setVatRate(21);
      setIrpfRate(15);
      setLang('ES');
      setStatus('DRAFT');
      return;
    }

    const tpl = templates.find((t) => t.id === tplId) || null;
    applyTemplateToInvoice(tpl);
  };

  const reserveInvoiceNumber = async (uid: string, targetISODate: string) => {
    const ref = settingsRef(uid);
    const year = new Date(targetISODate).getUTCFullYear();

    const number = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? (snap.data() as any) : {};
      const yc = data.yearCounter || {};
      const next = (Number(yc[year]) || 0) + 1;

      tx.set(
        ref,
        {
          yearCounter: { ...yc, [year]: next },
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      return `${year}${String(next).padStart(4, '0')}`;
    });

    return number;
  };

  const handleSave = async () => {
    if (!selectedClientId) {
      alert('Selecciona un cliente');
      setStep(1);
      return;
    }

    if (status !== 'DRAFT' && !canIssue) {
      alert(issueBlockedMsg || 'No se puede emitir sin dirección completa.');
      setStep(1);
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert('No hay sesión activa.');
      return;
    }

    const isNew = !invoiceId || invoiceId === 'new';
    const id = invoiceId && invoiceId !== 'new' ? invoiceId : Date.now().toString();

    // ✅ fecha elegida por el usuario
    const dateISO = dateInputToISO(invoiceDate);
    const dueISO = addDaysISO(dateISO, 30);

    // ✅ número único (solo para nuevas) via transaction
    let numberToUse = invoiceNumber;
    if (isNew) {
      try {
        numberToUse = await reserveInvoiceNumber(uid, dateISO);
        setInvoiceNumber(numberToUse);
      } catch {
        // ✅ fallback seguro: garantiza no repetir aunque falle Firestore
        const y = new Date(dateISO).getUTCFullYear();
        numberToUse = `${y}${String(Date.now()).slice(-6)}`; // p.ej. 2026 + 6 últimos dígitos
        setInvoiceNumber(numberToUse);
      }
    }

    const newInvoice: any = {
      id,
      number: numberToUse,
      issuer, // snapshot
      issuerId: selectedIssuerId || null,
      recipient,
      clientId: selectedClientId,

      // ✅ FIX BUILD: nada de "always nullish"
      templateId: selectedTemplateId || null,

      date: dateISO,
      dueDate: dueISO,
      status,
      lang,
      items,
      subtotal,
      vatRate,
      vatAmount,
      irpfRate,
      irpfAmount,
      total,
      isRecurring: false
    };

    await store.saveInvoice(uid, newInvoice as Invoice, { issuerId: selectedIssuerId });

    // ✅ avisar a la lista para que recargue al volver (sin tocar parent)
    localStorage.setItem('si_invoices_dirty', '1');

    onBack();
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: '', quantity: 1, unitCost: 0, amount: 0 }
    ]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated: InvoiceItem = { ...item, [field]: value as any } as InvoiceItem;
          if (field === 'quantity' || field === 'unitCost') {
            const q = Number(field === 'quantity' ? value : updated.quantity);
            const u = Number(field === 'unitCost' ? value : updated.unitCost);
            updated.amount = (Number.isFinite(q) ? q : 0) * (Number.isFinite(u) ? u : 0);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const t = TRANSLATIONS[lang];
  const isNewUI = !invoiceId || invoiceId === 'new';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={20} /> Volver
        </button>
        <div className="flex gap-3">
          {step === 4 && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Printer size={18} /> Imprimir / PDF
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-all"
            disabled={loading}
          >
            <Save size={18} /> Guardar
          </button>
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-between px-8 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm no-print">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                step === s
                  ? 'bg-indigo-600 text-white'
                  : step > s
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step > s ? <CheckCircle size={16} /> : s}
            </div>
            <span className={`text-sm font-semibold ${step === s ? 'text-slate-800' : 'text-slate-400'}`}>
              {s === 1 ? 'Cliente' : s === 2 ? 'Líneas' : s === 3 ? 'Impuestos' : 'Revisión'}
            </span>
            {s < 4 && <div className="w-12 h-px bg-slate-100 mx-2"></div>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden min-h-[500px] flex flex-col no-print">
        <div className="p-8 flex-1">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-slate-800">Seleccionar Cliente</h2>

              {!loading && !canIssue && (
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold">
                  {issueBlockedMsg} No podrás marcarla como <b>EMITIDA</b> o <b>PAGADA</b> hasta completarla.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Cliente</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                    value={selectedClientId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const c = clients.find((cl) => cl.id === id);
                      if (c) {
                        setRecipient(c);
                        setSelectedClientId(id);
                      } else {
                        setSelectedClientId('');
                      }
                    }}
                    disabled={loading}
                  >
                    <option value="">Seleccionar de la lista...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {!loading && clients.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No hay clientes cargados (o aún no se han leído de Firestore).
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Nº Factura</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 font-mono outline-none"
                  />
                </div>

                {/* ✅ NUEVO: fecha */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Fecha</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-600">Emisor</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                    value={selectedIssuerId}
                    onChange={(e) => handleIssuerChange(e.target.value)}
                    disabled={loading || issuers.length === 0}
                  >
                    {issuers.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.alias ? `${i.alias} — ${i.name}` : i.name}
                      </option>
                    ))}
                  </select>
                </div>

                {isNewUI && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-600">Plantilla (opcional)</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Sin plantilla</option>
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {(tpl as any).name || `Plantilla ${tpl.id}`}
                        </option>
                      ))}
                    </select>

                    {!loading && templates.length === 0 && (
                      <p className="text-xs text-slate-400">No hay plantillas aún.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <h3 className="font-bold text-slate-800">{recipient.name}</h3>
                <p className="text-sm text-slate-500">
                  {recipient.taxId} | {recipient.email}
                </p>
                <p className="text-sm text-slate-500">
                  {recipient.address.street}, {recipient.address.city} ({recipient.address.zip}), {recipient.address.country}
                </p>

                <hr className="my-4 border-slate-200" />

                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Emisor</p>
                <p className="font-bold text-slate-800">{issuer.name}</p>
                <p className="text-sm text-slate-500">
                  {issuer.taxId} | {issuer.email}
                </p>
                <p className="text-sm text-slate-500">
                  {issuer.address.street}, {issuer.address.city} ({issuer.address.zip}), {issuer.address.country}
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Líneas de Factura</h2>
                <button
                  onClick={addItem}
                  className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-200"
                >
                  <Plus size={16} /> Añadir Línea
                </button>
              </div>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-end p-4 bg-slate-50 rounded-2xl">
                    <div className="col-span-12 md:col-span-6 space-y-1">
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Descripción del servicio..."
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        value={item.unitCost}
                        onChange={(e) => updateItem(item.id, 'unitCost', e.target.value)}
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2 font-bold text-right text-slate-800">
                      {(Number(item.amount) || 0).toFixed(2)}€
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-slate-800">Impuestos</h2>
              <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">IVA (%)</span>
                  <input
                    type="number"
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-right outline-none font-bold"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">IRPF (%)</span>
                  <input
                    type="number"
                    value={irpfRate}
                    onChange={(e) => setIrpfRate(Number(e.target.value))}
                    className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-right outline-none font-bold"
                  />
                </div>
                <hr className="border-slate-200" />
                <div className="flex justify-between items-center text-slate-800 font-black pt-4 border-t border-slate-200">
                  <span className="text-lg uppercase">Total Factura</span>
                  <span className="text-2xl text-indigo-700">{total.toLocaleString()} €</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-slate-800">Revisión Final</h2>

              {!canIssue && (
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold">
                  {issueBlockedMsg} Solo podrás guardar como <b>DRAFT</b>.
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStatus('PAID')}
                  disabled={!canIssue}
                  className={`flex-1 py-3 rounded-xl border font-bold transition-all ${
                    status === 'PAID'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-white text-slate-400'
                  } ${!canIssue ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  PAGADA
                </button>
                <button
                  onClick={() => setStatus('ISSUED')}
                  disabled={!canIssue}
                  className={`flex-1 py-3 rounded-xl border font-bold transition-all ${
                    status === 'ISSUED'
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white text-slate-400'
                  } ${!canIssue ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  EMITIDA
                </button>
              </div>

              <p className="text-center text-slate-400 text-sm">
                Previsualización debajo. Dale a Imprimir para generar el PDF.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
              step === 1 ? 'opacity-0' : 'text-slate-500 hover:bg-slate-200'
            }`}
          >
            Anterior
          </button>
          <button
            onClick={() => (step < 4 ? setStep(step + 1) : handleSave())}
            className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            disabled={loading}
          >
            {step < 4 ? 'Siguiente' : 'Finalizar y Guardar'}
          </button>
        </div>
      </div>

      {/* Area Imprimible */}
      <div className={`printable-area bg-white p-12 border rounded shadow-sm ${step === 4 ? 'block' : 'hidden'}`}>
        <div className="flex justify-between mb-12">
          <div>
            <h1 className="text-2xl font-black text-slate-900 mb-2 uppercase">{t.invoice}</h1>
            <p className="font-mono text-slate-500">{invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{issuer.name}</p>
            <p className="text-sm text-slate-500">{issuer.taxId}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12 border-t border-b py-8 border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t.recipient}</p>
            <p className="font-bold">{recipient.name}</p>
            <p className="text-sm text-slate-500">{recipient.taxId}</p>
            <p className="text-sm text-slate-500">{recipient.address.street}</p>
            <p className="text-sm text-slate-500">
              {recipient.address.zip} {recipient.address.city}, {recipient.address.country}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t.date}</p>
            <p className="font-bold">{new Date(dateInputToISO(invoiceDate)).toLocaleDateString()}</p>
          </div>
        </div>

        <table className="w-full mb-12">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left text-xs uppercase font-black">
              <th className="py-2">{t.description}</th>
              <th className="py-2 text-right">{t.unitCost}</th>
              <th className="py-2 text-right">{t.quantity}</th>
              <th className="py-2 text-right">{t.amount}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="text-sm">
                <td className="py-4 font-medium">{item.description}</td>
                <td className="py-4 text-right">{(Number(item.unitCost) || 0).toFixed(2)} €</td>
                <td className="py-4 text-right">{Number(item.quantity) || 0}</td>
                <td className="py-4 text-right font-bold">{(Number(item.amount) || 0).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-slate-500 uppercase">
              <span>{t.subtotal}</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500 uppercase">
              <span>
                {t.vat} ({vatRate}%)
              </span>
              <span>{vatAmount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500 uppercase">
              <span>
                {t.irpf} (-{irpfRate}%)
              </span>
              <span>- {irpfAmount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between pt-4 border-t-2 border-slate-900 font-black text-lg">
              <span>TOTAL</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {status === 'PAID' && (
          <div className="mt-20 border-4 border-emerald-500 text-emerald-500 font-black text-4xl p-4 inline-block transform -rotate-12 opacity-30">
            PAGADO
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceEditor;
