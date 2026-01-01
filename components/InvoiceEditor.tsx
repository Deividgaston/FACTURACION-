import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Save, CheckCircle, Printer, Plus } from 'lucide-react';
import { Invoice, InvoiceItem, Party, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { store } from '../lib/store';

interface InvoiceEditorProps {
  onBack: () => void;
  invoiceId?: string;
}

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ onBack, invoiceId }) => {
  const settings = useMemo(() => store.getSettings(), []);
  const clients = useMemo(() => store.getClients(), []);
  const issuers = useMemo(() => store.getIssuers(), []);
  const activeIssuer = useMemo(() => store.getActiveIssuer(), []);

  const [step, setStep] = useState(1);
  const [lang, setLang] = useState<Language>('ES');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [vatRate, setVatRate] = useState(21);
  const [irpfRate, setIrpfRate] = useState(15);
  const [status, setStatus] = useState<any>('DRAFT');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Multi-issuer selection
  const [selectedIssuerId, setSelectedIssuerId] = useState<string>(settings.activeIssuerId || activeIssuer.id);

  // Snapshot used for invoice save & print
  const [issuer, setIssuer] = useState<Party>({
    name: activeIssuer.name,
    taxId: activeIssuer.taxId,
    address: activeIssuer.address,
    email: activeIssuer.email
  });

  const [recipient, setRecipient] = useState<Party>({
    name: 'Selecciona un cliente',
    taxId: '-',
    address: { street: '-', city: '-', zip: '-', country: '-' },
    email: '-'
  });

  useEffect(() => {
    if (invoiceId && invoiceId !== 'new') {
      const inv = store.getInvoices().find(i => i.id === invoiceId);
      if (inv) {
        setItems(inv.items);
        setVatRate(inv.vatRate);
        setIrpfRate(inv.irpfRate);
        setStatus(inv.status);
        setRecipient(inv.recipient);
        setLang(inv.lang);
        setInvoiceNumber(inv.number);
        setSelectedClientId(inv.clientId || '');

        // Keep historical issuer snapshot
        setIssuer(inv.issuer);
        // Best-effort: try to map to a current issuer id (optional)
        const match = issuers.find(i => i.taxId === inv.issuer.taxId && i.name === inv.issuer.name);
        if (match) setSelectedIssuerId(match.id);
      }
    } else {
      const year = new Date().getFullYear();
      const count = (settings.yearCounter[year] || 0) + 1;
      setInvoiceNumber(`${year}${count.toString().padStart(4, '0')}`);
      setItems([{ id: '1', description: 'Servicios Profesionales', quantity: 1, unitCost: 0, amount: 0 }]);

      // Default issuer = active issuer
      const active = store.getActiveIssuer();
      setSelectedIssuerId(active.id);
      setIssuer({
        name: active.name,
        taxId: active.taxId,
        address: active.address,
        email: active.email
      });
    }
  }, [invoiceId, settings, issuers]);

  // When user changes issuer in UI, update snapshot (only for new invoices or when they explicitly change it)
  const handleIssuerChange = (issuerId: string) => {
    setSelectedIssuerId(issuerId);
    const iss = issuers.find(i => i.id === issuerId);
    if (iss) {
      setIssuer({
        name: iss.name,
        taxId: iss.taxId,
        address: iss.address,
        email: iss.email
      });
    }
  };

  const subtotal = items.reduce((acc, item) => acc + item.amount, 0);
  const vatAmount = (subtotal * vatRate) / 100;
  const irpfAmount = (subtotal * irpfRate) / 100;
  const total = subtotal + vatAmount - irpfAmount;

  const handleSave = () => {
    if (!selectedClientId) {
      alert('Selecciona un cliente');
      return;
    }

    const newInvoice: Invoice = {
      id: invoiceId && invoiceId !== 'new' ? invoiceId : Date.now().toString(),
      number: invoiceNumber,
      issuer, // snapshot
      recipient,
      clientId: selectedClientId,
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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

    store.saveInvoice(newInvoice);

    if (invoiceId === 'new') {
      const year = new Date().getFullYear();
      store.saveSettings({
        ...settings,
        yearCounter: { ...settings.yearCounter, [year]: (settings.yearCounter[year] || 0) + 1 }
      });
    }

    onBack();
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, unitCost: 0, amount: 0 }]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated: any = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
          updated.amount = Number(updated.quantity) * Number(updated.unitCost);
        }
        return updated;
      }
      return item;
    }));
  };

  const t = TRANSLATIONS[lang];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Estilos de Impresión */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
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
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-all">
            <Save size={18} /> Guardar
          </button>
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-between px-8 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm no-print">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              step === s ? 'bg-indigo-600 text-white' : step > s ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
            }`}>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Cliente</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                    value={selectedClientId}
                    onChange={(e) => {
                      const c = clients.find(cl => (cl as any).id === e.target.value);
                      if (c) {
                        setRecipient(c);
                        setSelectedClientId(e.target.value);
                      } else {
                        setSelectedClientId('');
                      }
                    }}
                  >
                    <option value="">Seleccionar de la lista...</option>
                    {clients.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Invoice number */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Nº Factura</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 font-mono outline-none"
                  />
                </div>

                {/* Issuer */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-600">Emisor</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                    value={selectedIssuerId}
                    onChange={(e) => handleIssuerChange(e.target.value)}
                  >
                    {issuers.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.alias ? `${i.alias} — ${i.name}` : i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <h3 className="font-bold text-slate-800">{recipient.name}</h3>
                <p className="text-sm text-slate-500">{recipient.taxId} | {recipient.email}</p>
                <p className="text-sm text-slate-500">{recipient.address.street}, {recipient.address.city}</p>

                <hr className="my-4 border-slate-200" />

                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Emisor</p>
                <p className="font-bold text-slate-800">{issuer.name}</p>
                <p className="text-sm text-slate-500">{issuer.taxId} | {issuer.email}</p>
                <p className="text-sm text-slate-500">{issuer.address.street}, {issuer.address.city}</p>
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
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Descripción del servicio..."
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        value={item.unitCost}
                        onChange={e => updateItem(item.id, 'unitCost', e.target.value)}
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2 font-bold text-right text-slate-800">
                      {item.amount.toFixed(2)}€
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
                    onChange={e => setVatRate(Number(e.target.value))}
                    className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-right outline-none font-bold"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">IRPF (%)</span>
                  <input
                    type="number"
                    value={irpfRate}
                    onChange={e => setIrpfRate(Number(e.target.value))}
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
              <div className="flex gap-4">
                <button
                  onClick={() => setStatus('PAID')}
                  className={`flex-1 py-3 rounded-xl border font-bold transition-all ${
                    status === 'PAID' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white text-slate-400'
                  }`}
                >
                  PAGADA
                </button>
                <button
                  onClick={() => setStatus('ISSUED')}
                  className={`flex-1 py-3 rounded-xl border font-bold transition-all ${
                    status === 'ISSUED' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-slate-400'
                  }`}
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
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t.date}</p>
            <p className="font-bold">{new Date().toLocaleDateString()}</p>
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
            {items.map(item => (
              <tr key={item.id} className="text-sm">
                <td className="py-4 font-medium">{item.description}</td>
                <td className="py-4 text-right">{item.unitCost.toFixed(2)} €</td>
                <td className="py-4 text-right">{item.quantity}</td>
                <td className="py-4 text-right font-bold">{item.amount.toFixed(2)} €</td>
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
              <span>{t.vat} ({vatRate}%)</span>
              <span>{vatAmount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500 uppercase">
              <span>{t.irpf} (-{irpfRate}%)</span>
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
