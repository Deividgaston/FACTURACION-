import React, { useState, useEffect } from 'react';
import { ChevronLeft, Save, CheckCircle, Printer, Plus } from 'lucide-react';
import { Invoice, InvoiceItem, Party, Language, Issuer, AppSettings, InvoiceTemplate } from '../types';
import { TRANSLATIONS } from '../constants';
import { store } from '../lib/store';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';

interface InvoiceEditorProps {
  onBack: () => void;
  invoiceId?: string;
}

type Client = Party & { id: string };
type Template = InvoiceTemplate & { id: string };

// 🔑 misma key que App.tsx
const LS_NEW_INVOICE_TEMPLATE_ID = 'si_new_invoice_template_id';

/* ================= helpers ================= */

const isFilled = (v: any) => {
  const s = String(v ?? '').trim();
  return !!s && s !== '-' && s !== '—';
};

const isAddressComplete = (p?: Party | null) => {
  const a = p?.address as any;
  return !!a && isFilled(a.street) && isFilled(a.city) && isFilled(a.zip) && isFilled(a.country);
};

const safeItemsFromTemplate = (tpl: any): InvoiceItem[] =>
  (Array.isArray(tpl?.items) ? tpl.items : []).map((it: any, idx: number) => {
    const q = Number(it?.quantity ?? 1);
    const u = Number(it?.unitCost ?? 0);
    return {
      id: String(it?.id || `tpl_${idx}_${Date.now()}`),
      description: String(it?.description ?? '').trim(),
      quantity: Number.isFinite(q) ? q : 1,
      unitCost: Number.isFinite(u) ? u : 0,
      amount: Number.isFinite(it?.amount)
        ? Number(it.amount)
        : (Number.isFinite(q) ? q : 1) * (Number.isFinite(u) ? u : 0)
    };
  });

const toDateInputValue = (iso?: string) => new Date(iso || Date.now()).toISOString().slice(0, 10);

const dateInputToISO = (d: string) => new Date(`${d}T12:00:00.000Z`).toISOString();

const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

/* ================= component ================= */

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ onBack, invoiceId }) => {
  const [loading, setLoading] = useState(true);

  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedIssuerId, setSelectedIssuerId] = useState('');

  const [lang, setLang] = useState<Language>('ES');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [vatRate, setVatRate] = useState(21);
  const [irpfRate, setIrpfRate] = useState(15);
  const [status, setStatus] = useState<Invoice['status']>('DRAFT');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(toDateInputValue());

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

  /* ================= plantilla ================= */

  const applyTemplateToInvoice = (tpl: Template) => {
    if (!tpl) return;

    setLang(tpl.lang || 'ES');
    setVatRate(tpl.vatRate);
    setIrpfRate(tpl.irpfRate);
    setItems(safeItemsFromTemplate(tpl));
    setStatus('DRAFT');

    if (tpl.recipient) setRecipient(tpl.recipient);
    if (tpl.clientId) setSelectedClientId(tpl.clientId);

    if (tpl.issuer) setIssuer(tpl.issuer);
    if (tpl.issuerId) setSelectedIssuerId(tpl.issuerId);
  };

  /* ================= load ================= */

  useEffect(() => {
    let alive = true;

    const run = async (uid: string) => {
      try {
        setLoading(true);

        const settingsSnap = await getDoc(doc(db, 'settings', uid));
        const settings = (settingsSnap.exists() ? settingsSnap.data() : store.getSettings()) as AppSettings;

        setIssuers(settings.issuers || []);

        const cl = await store.loadClientsOnce(uid);
        if (!alive) return;
        setClients(cl as Client[]);

        await store.migrateLocalTemplatesToFirestoreOnce(uid);
        const tpl = await store.loadTemplatesOnce(uid);
        if (!alive) return;
        setTemplates(tpl as Template[]);

        // NUEVA FACTURA
        if (!invoiceId) {
          const storedTplId = localStorage.getItem(LS_NEW_INVOICE_TEMPLATE_ID);
          if (storedTplId) {
            const found = (tpl as any[]).find((t: any) => t.id === storedTplId);
            if (found) {
              setSelectedTemplateId(found.id);
              applyTemplateToInvoice(found as Template);
            }
            localStorage.removeItem(LS_NEW_INVOICE_TEMPLATE_ID);
          }

          const year = new Date().getFullYear();
          const next = (settings.yearCounter?.[year] || 0) + 1;
          setInvoiceNumber(`${year}${String(next).padStart(4, '0')}`);
        }
      } catch (e) {
        // Evita blanco silencioso
        console.error('InvoiceEditor load error:', e);
      } finally {
        if (alive) setLoading(false);
      }
    };

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!alive) return;

      if (u?.uid) {
        run(u.uid);
      } else {
        // ✅ FIX CLAVE: si no hay sesión, no te quedas en blanco
        setLoading(false);
        // opcional si tu app requiere auth: onBack();
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [invoiceId]);

  /* ================= save ================= */

  const reserveInvoiceNumber = async (uid: string, iso: string) => {
    const ref = doc(db, 'settings', uid);
    const year = new Date(iso).getUTCFullYear();

    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const yc = snap.data()?.yearCounter || {};
      const next = (Number(yc[year]) || 0) + 1;

      tx.set(ref, { yearCounter: { ...yc, [year]: next }, updatedAt: serverTimestamp() }, { merge: true });
      return `${year}${String(next).padStart(4, '0')}`;
    });
  };

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !selectedClientId) return;

    const iso = dateInputToISO(invoiceDate);
    const number = await reserveInvoiceNumber(uid, iso);

    const subtotal = items.reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const vatAmount = (subtotal * vatRate) / 100;
    const irpfAmount = (subtotal * irpfRate) / 100;

    await store.saveInvoice(
      uid,
      {
        id: Date.now().toString(),
        number,
        issuer,
        issuerId: selectedIssuerId,
        recipient,
        clientId: selectedClientId,
        templateId: selectedTemplateId || null,
        date: iso,
        dueDate: addDaysISO(iso, 30),
        status,
        lang,
        items,
        subtotal,
        vatRate,
        vatAmount,
        irpfRate,
        irpfAmount,
        total: subtotal + vatAmount - irpfAmount,
        isRecurring: false
      } as Invoice
    );

    localStorage.setItem('si_invoices_dirty', '1');
    onBack();
  };

  /* ================= UI handlers (mínimos) ================= */

  const t = TRANSLATIONS[lang];
  const tAny = t as any; // ✅ FIX build: permite back/save aunque no estén en el type
  const lockedByTemplate = !!selectedTemplateId && !invoiceId;

  const onSelectClient = (id: string) => {
    setSelectedClientId(id);
    const found = clients.find((c) => c.id === id);
    if (found) setRecipient(found);
  };

  const onSelectIssuer = (id: string) => {
    setSelectedIssuerId(id);
    const found = issuers.find((i) => (i as any).id === id);
    if (found) setIssuer((found as any) as Party);
  };

  const onSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const found = templates.find((x) => x.id === id);
    if (found) applyTemplateToInvoice(found);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `it_${Date.now()}`,
        description: '',
        quantity: 1,
        unitCost: 0,
        amount: 0
      }
    ]);
  };

  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch } as InvoiceItem;
        const q = Number(next.quantity) || 0;
        const u = Number(next.unitCost) || 0;
        next.amount = q * u;
        return next;
      })
    );
  };

  /* ================= render ================= */

  if (loading) {
    return <div className="p-6">Cargando…</div>;
  }

  // Si quieres forzar auth:
  // if (!auth.currentUser) return <div className="p-6">Inicia sesión para crear facturas.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button className="flex items-center gap-2 text-sm" onClick={onBack}>
          <ChevronLeft size={18} />
          {tAny.back || 'Volver'}
        </button>

        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-2 border rounded"
            onClick={handleSave}
            disabled={!selectedClientId}
          >
            <Save size={18} />
            {tAny.save || 'Guardar'}
          </button>
        </div>
      </div>

      {/* Basic meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm opacity-70">Número</div>
          <input className="w-full border rounded px-3 py-2" value={invoiceNumber} disabled />
        </div>

        <div className="space-y-2">
          <div className="text-sm opacity-70">Fecha</div>
          <input
            className="w-full border rounded px-3 py-2"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            disabled={lockedByTemplate}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm opacity-70">Plantilla</div>
          <select
            className="w-full border rounded px-3 py-2"
            value={selectedTemplateId}
            onChange={(e) => onSelectTemplate(e.target.value)}
          >
            <option value="">—</option>
            {templates.map((x) => (
              <option key={x.id} value={x.id}>
                {(x as any).name || x.id}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="text-sm opacity-70">Emisor</div>
          <select
            className="w-full border rounded px-3 py-2"
            value={selectedIssuerId}
            onChange={(e) => onSelectIssuer(e.target.value)}
            disabled={lockedByTemplate}
          >
            <option value="">—</option>
            {issuers.map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name || x.taxId || x.id}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <div className="text-sm opacity-70">Cliente</div>
          <select
            className="w-full border rounded px-3 py-2"
            value={selectedClientId}
            onChange={(e) => onSelectClient(e.target.value)}
            disabled={lockedByTemplate}
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.taxId ? `(${c.taxId})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Items */}
      <div className="border rounded">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-medium">Líneas</div>
          <button
            className="flex items-center gap-2 px-3 py-2 border rounded"
            onClick={addItem}
            disabled={lockedByTemplate}
          >
            <Plus size={18} />
            Añadir línea
          </button>
        </div>

        <div className="p-3 space-y-2">
          {items.length === 0 ? (
            <div className="text-sm opacity-70">Sin líneas</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                <input
                  className="md:col-span-3 border rounded px-3 py-2"
                  placeholder="Descripción"
                  value={it.description}
                  onChange={(e) => updateItem(it.id, { description: e.target.value })}
                  disabled={lockedByTemplate}
                />
                <input
                  className="md:col-span-1 border rounded px-3 py-2"
                  type="number"
                  value={it.quantity}
                  onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })}
                  disabled={lockedByTemplate}
                />
                <input
                  className="md:col-span-1 border rounded px-3 py-2"
                  type="number"
                  value={it.unitCost}
                  onChange={(e) => updateItem(it.id, { unitCost: Number(e.target.value) })}
                  disabled={lockedByTemplate}
                />
                <input className="md:col-span-1 border rounded px-3 py-2" value={(Number(it.amount) || 0).toFixed(2)} disabled />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <div className="text-sm opacity-70">IVA %</div>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value))}
            disabled={lockedByTemplate}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm opacity-70">IRPF %</div>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            value={irpfRate}
            onChange={(e) => setIrpfRate(Number(e.target.value))}
            disabled={lockedByTemplate}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm opacity-70">Estado</div>
          <select
            className="w-full border rounded px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            disabled={lockedByTemplate}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="SENT">SENT</option>
            <option value="PAID">PAID</option>
          </select>
        </div>
      </div>

      {/* Debug mínimo por si falta algo clave */}
      {!selectedClientId && <div className="text-sm text-red-600">Selecciona un cliente para poder guardar.</div>}
    </div>
  );
};

export default InvoiceEditor;
