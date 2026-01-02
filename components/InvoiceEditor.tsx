import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Save, Printer, Plus } from 'lucide-react';
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

// 🔑 handoff print desde InvoiceList
const LS_PRINT_INVOICE_ID = 'si_print_invoice_id';
const LS_PRINT_LANG = 'si_print_lang';

/* ================= helpers ================= */

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

const fmtMoney = (n: any) => (Number(n) || 0).toFixed(2);
const fmtDate = (isoOrDate: any) => {
  try {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return String(isoOrDate || '');
    return d.toLocaleDateString();
  } catch {
    return String(isoOrDate || '');
  }
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

  // OJO: en tu lista usas ISSUED/PAID/DRAFT/CANCELLED
  const [status, setStatus] = useState<any>('DRAFT');

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

  // para edición existente
  const [loadedInvoice, setLoadedInvoice] = useState<Invoice | null>(null);

  // impresión
  const [printLang, setPrintLang] = useState<Language>('ES');

  const isExisting = !!invoiceId;

  // evita doble print (StrictMode en dev puede ejecutar efectos 2 veces)
  const [autoPrintDone, setAutoPrintDone] = useState(false);

  /* ================= computed totals ================= */

  const totals = useMemo(() => {
    const subtotal = items.reduce((a, i) => a + (Number((i as any).amount) || 0), 0);
    const vatAmount = (subtotal * (Number(vatRate) || 0)) / 100;
    const irpfAmount = (subtotal * (Number(irpfRate) || 0)) / 100;
    const total = subtotal + vatAmount - irpfAmount;
    return { subtotal, vatAmount, irpfAmount, total };
  }, [items, vatRate, irpfRate]);

  const printLabels = useMemo(() => {
    // etiquetas pro (solo para la factura impresa)
    if (lang === 'EN') {
      return {
        invoice: 'INVOICE',
        invoiceNo: 'Invoice No.',
        date: 'Date',
        dueDate: 'Due date',
        status: 'Status',
        issuer: 'Issuer',
        client: 'Bill To',
        taxId: 'Tax ID',
        email: 'Email',
        address: 'Address',
        description: 'Description',
        qty: 'Qty',
        unit: 'Unit price',
        amount: 'Amount',
        subtotal: 'Subtotal',
        vat: 'VAT',
        irpf: 'Withholding',
        total: 'Total'
      };
    }
    return {
      invoice: 'FACTURA',
      invoiceNo: 'Nº Factura',
      date: 'Fecha',
      dueDate: 'Vencimiento',
      status: 'Estado',
      issuer: 'Emisor',
      client: 'Cliente',
      taxId: 'NIF/CIF',
      email: 'Email',
      address: 'Dirección',
      description: 'Descripción',
      qty: 'Ud.',
      unit: 'Precio',
      amount: 'Importe',
      subtotal: 'Subtotal',
      vat: 'IVA',
      irpf: 'IRPF',
      total: 'Total'
    };
  }, [lang]);

  /* ================= plantilla ================= */

  const applyTemplateToInvoice = (tpl: Template) => {
    if (!tpl) return;

    setLang((tpl as any).lang || 'ES');
    setVatRate((tpl as any).vatRate ?? 21);
    setIrpfRate((tpl as any).irpfRate ?? 15);
    setItems(safeItemsFromTemplate(tpl));

    if ((tpl as any).recipient) setRecipient((tpl as any).recipient);
    if ((tpl as any).clientId) setSelectedClientId((tpl as any).clientId);

    if ((tpl as any).issuer) setIssuer((tpl as any).issuer);
    if ((tpl as any).issuerId) setSelectedIssuerId((tpl as any).issuerId);
  };

  /* ================= load ================= */

  useEffect(() => {
    let alive = true;

    const loadExistingInvoice = async (uid: string) => {
      if (!invoiceId) return;

      try {
        const list = await store.loadInvoicesOnce(uid, { force: false });
        const inv = (list || []).find((x: any) => String(x.id) === String(invoiceId)) as Invoice | undefined;
        if (!inv) return;

        if (!alive) return;
        setLoadedInvoice(inv);

        setLang((inv as any).lang || 'ES');
        setItems((inv as any).items || []);
        setVatRate((inv as any).vatRate ?? 21);
        setIrpfRate((inv as any).irpfRate ?? 15);
        setStatus((inv as any).status || 'DRAFT');

        setInvoiceNumber((inv as any).number || '');
        setInvoiceDate(toDateInputValue((inv as any).date));

        setIssuer((inv as any).issuer || issuer);
        setRecipient((inv as any).recipient || recipient);

        setSelectedClientId((inv as any).clientId || '');
        setSelectedIssuerId((inv as any).issuerId || '');
        setSelectedTemplateId((inv as any).templateId || '');
      } catch (e) {
        console.error('Error cargando factura existente:', e);
      }
    };

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

        // EXISTENTE
        if (invoiceId) {
          await loadExistingInvoice(uid);
          return;
        }

        // NUEVA
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
      } catch (e) {
        console.error('InvoiceEditor load error:', e);
      } finally {
        if (alive) setLoading(false);
      }
    };

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!alive) return;
      if (u?.uid) run(u.uid);
      else setLoading(false);
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [invoiceId]);

  /* ================= auto-print handoff ================= */

  useEffect(() => {
    if (!invoiceId) return;
    if (loading) return;
    if (autoPrintDone) return;

    const targetId = localStorage.getItem(LS_PRINT_INVOICE_ID);
    if (!targetId) return;
    if (String(targetId) !== String(invoiceId)) return;

    const pl = (localStorage.getItem(LS_PRINT_LANG) || 'ES') as Language;

    setAutoPrintDone(true);

    localStorage.removeItem(LS_PRINT_INVOICE_ID);
    localStorage.removeItem(LS_PRINT_LANG);

    const prev = lang;
    setLang(pl);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setLang(prev);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, loading]);

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
    if (!uid) return;

    if (isExisting) {
      if (!loadedInvoice) return;
      await store.saveInvoice(uid, { ...loadedInvoice, status } as Invoice);
      localStorage.setItem('si_invoices_dirty', '1');
      onBack();
      return;
    }

    if (!selectedClientId) return;

    const iso = dateInputToISO(invoiceDate);
    const number = await reserveInvoiceNumber(uid, iso);

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
        subtotal: totals.subtotal,
        vatRate,
        vatAmount: totals.vatAmount,
        irpfRate,
        irpfAmount: totals.irpfAmount,
        total: totals.total,
        isRecurring: false
      } as Invoice
    );

    localStorage.setItem('si_invoices_dirty', '1');
    onBack();
  };

  /* ================= print (manual) ================= */

  const handlePrint = () => {
    const prev = lang;
    setLang(printLang);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setLang(prev);
      });
    });
  };

  /* ================= UI handlers ================= */

  const t = TRANSLATIONS[lang];
  const tAny = t as any;

  const lockedByTemplate = !!selectedTemplateId && !invoiceId;
  const canEditFields = !isExisting && !lockedByTemplate;

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
    setItems((prev) => [...prev, { id: `it_${Date.now()}`, description: '', quantity: 1, unitCost: 0, amount: 0 }]);
  };

  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch } as InvoiceItem;
        const q = Number((next as any).quantity) || 0;
        const u = Number((next as any).unitCost) || 0;
        (next as any).amount = q * u;
        return next;
      })
    );
  };

  /* ================= render ================= */

  if (loading) return <div className="p-6">Cargando…</div>;

  const dueDateISO = addDaysISO(dateInputToISO(invoiceDate), 30);

  return (
    <>
      {/* ✅ PRINT CSS: oculta todo menos el layout profesional */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
          .print-muted { color: #6b7280; }
          .print-table th, .print-table td { padding: 8px 6px; border-bottom: 1px solid #f1f5f9; }
          .print-table thead th { border-bottom: 1px solid #e5e7eb; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      {/* ✅ Layout PROFESIONAL para PDF */}
      <div className="print-only">
        <div className="print-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.4 }}>{printLabels.invoice}</div>
              <div className="print-muted" style={{ marginTop: 6, fontSize: 12 }}>
                {printLabels.invoiceNo}: <span style={{ fontWeight: 700 }}>{invoiceNumber || '—'}</span>
              </div>
              <div className="print-muted" style={{ fontSize: 12 }}>
                {printLabels.date}: <span style={{ fontWeight: 600 }}>{fmtDate(dateInputToISO(invoiceDate))}</span>
              </div>
              <div className="print-muted" style={{ fontSize: 12 }}>
                {printLabels.dueDate}: <span style={{ fontWeight: 600 }}>{fmtDate(dueDateISO)}</span>
              </div>
              <div className="print-muted" style={{ fontSize: 12 }}>
                {printLabels.status}: <span style={{ fontWeight: 700 }}>{String(status || 'DRAFT')}</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800 }}>{issuer?.name || '—'}</div>
              <div className="print-muted" style={{ fontSize: 12 }}>
                {printLabels.taxId}: {issuer?.taxId || '—'}
              </div>
              <div className="print-muted" style={{ fontSize: 12 }}>
                {printLabels.email}: {issuer?.email || '—'}
              </div>
              <div className="print-muted" style={{ fontSize: 12, maxWidth: 280 }}>
                {printLabels.address}:{' '}
                {[
                  issuer?.address?.street,
                  issuer?.address?.zip,
                  issuer?.address?.city,
                  issuer?.address?.country
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
            <div style={{ flex: 1 }} className="print-card">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{printLabels.client}</div>
              <div style={{ fontWeight: 700 }}>{recipient?.name || '—'}</div>
              <div className="print-muted" style={{ fontSize: 12 }}>
                {printLabels.taxId}: {recipient?.taxId || '—'}
              </div>
              <div className="print-muted" style={{ fontSize: 12 }}>
                {printLabels.email}: {recipient?.email || '—'}
              </div>
              <div className="print-muted" style={{ fontSize: 12 }}>
                {printLabels.address}:{' '}
                {[
                  recipient?.address?.street,
                  recipient?.address?.zip,
                  recipient?.address?.city,
                  recipient?.address?.country
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{printLabels.description}</th>
                  <th style={{ textAlign: 'right', width: 70 }}>{printLabels.qty}</th>
                  <th style={{ textAlign: 'right', width: 110 }}>{printLabels.unit}</th>
                  <th style={{ textAlign: 'right', width: 110 }}>{printLabels.amount}</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="print-muted" style={{ padding: 10 }}>
                      —
                    </td>
                  </tr>
                ) : (
                  (items || []).map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.description || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{Number(it.quantity || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(it.unitCost)} €</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(it.amount)} €</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div style={{ width: 320 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                <div className="print-muted">{printLabels.subtotal}</div>
                <div style={{ fontWeight: 700 }}>{fmtMoney(totals.subtotal)} €</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                <div className="print-muted">
                  {printLabels.vat} ({Number(vatRate) || 0}%)
                </div>
                <div style={{ fontWeight: 700 }}>{fmtMoney(totals.vatAmount)} €</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                <div className="print-muted">
                  {printLabels.irpf} ({Number(irpfRate) || 0}%)
                </div>
                <div style={{ fontWeight: 700 }}>- {fmtMoney(totals.irpfAmount)} €</div>
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{printLabels.total}</div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{fmtMoney(totals.total)} €</div>
              </div>
            </div>
          </div>

          <div className="print-muted" style={{ marginTop: 14, fontSize: 11 }}>
            {/* Puedes añadir texto legal / IBAN aquí si lo tienes en settings */}
          </div>
        </div>
      </div>

      {/* ✅ UI NORMAL (pantalla) */}
      <div className="no-print">
        <div className="max-w-4xl mx-auto space-y-6 p-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <button className="flex items-center gap-2 text-sm" onClick={onBack}>
              <ChevronLeft size={18} />
              {tAny.back || 'Volver'}
            </button>

            <div className="flex items-center gap-2">
              {/* Print language */}
              <select
                className="border rounded px-3 py-2"
                value={printLang}
                onChange={(e) => setPrintLang(e.target.value as Language)}
              >
                <option value="ES">ES</option>
                <option value="EN">EN</option>
              </select>

              <button className="flex items-center gap-2 px-3 py-2 border rounded" onClick={handlePrint}>
                <Printer size={18} />
                {tAny.print || 'Imprimir PDF'}
              </button>

              <button
                className="flex items-center gap-2 px-3 py-2 border rounded"
                onClick={handleSave}
                disabled={(!selectedClientId && !isExisting) || (isExisting && !loadedInvoice)}
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
                disabled={!canEditFields}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm opacity-70">Plantilla</div>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedTemplateId}
                onChange={(e) => onSelectTemplate(e.target.value)}
                disabled={isExisting}
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
                disabled={!canEditFields}
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
                disabled={!canEditFields}
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
                disabled={!canEditFields}
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
                      disabled={!canEditFields}
                    />
                    <input
                      className="md:col-span-1 border rounded px-3 py-2"
                      type="number"
                      value={it.quantity}
                      onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })}
                      disabled={!canEditFields}
                    />
                    <input
                      className="md:col-span-1 border rounded px-3 py-2"
                      type="number"
                      value={it.unitCost}
                      onChange={(e) => updateItem(it.id, { unitCost: Number(e.target.value) })}
                      disabled={!canEditFields}
                    />
                    <input className="md:col-span-1 border rounded px-3 py-2" value={fmtMoney(it.amount)} disabled />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals + Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm opacity-70">IVA %</div>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                disabled={!canEditFields}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm opacity-70">IRPF %</div>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                value={irpfRate}
                onChange={(e) => setIrpfRate(Number(e.target.value))}
                disabled={!canEditFields}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm opacity-70">Estado</div>
              <select className="w-full border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="DRAFT">DRAFT</option>
                <option value="ISSUED">ISSUED</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
          </div>

          {!isExisting && !selectedClientId && (
            <div className="text-sm text-red-600">Selecciona un cliente para poder guardar.</div>
          )}
        </div>
      </div>
    </>
  );
};

export default InvoiceEditor;
