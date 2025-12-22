
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Save, Send, Eye, Plus, Trash2, CheckCircle, Download } from 'lucide-react';
import { Invoice, InvoiceItem, Party, Language } from '../types';
// Import TRANSLATIONS from constants instead of types
import { TRANSLATIONS } from '../constants';

interface InvoiceEditorProps {
  onBack: () => void;
  invoiceId?: string;
}

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ onBack, invoiceId }) => {
  const [step, setStep] = useState(1);
  const [lang, setLang] = useState<Language>('ES');
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: 'Servicios Profesionales', quantity: 1, unitCost: 1000, amount: 1000 }
  ]);
  const [vatRate, setVatRate] = useState(21);
  const [irpfRate, setIrpfRate] = useState(15);
  const [status, setStatus] = useState<'DRAFT' | 'ISSUED' | 'PAID'>('DRAFT');

  // Dummy party data
  const [issuer] = useState<Party>({
    name: 'Patricia de Pastor Mendez',
    taxId: '06010586L',
    address: { street: 'Alcalde Sainz de Baranda 55', city: 'Madrid', zip: '28009', country: 'Spain' },
    email: 'patricia@example.com'
  });

  const [recipient, setRecipient] = useState<Party>({
    name: '2N Telekomunikace a.s.',
    taxId: 'CZ 26 18 39 60',
    address: { street: 'Modranska 621/72', city: 'Praha 4', zip: '14301', country: 'Czech Republic' },
    email: 'client@2n.cz'
  });

  const subtotal = items.reduce((acc, item) => acc + item.amount, 0);
  const vatAmount = (subtotal * vatRate) / 100;
  const irpfAmount = (subtotal * irpfRate) / 100;
  const total = subtotal + vatAmount - irpfAmount;

  const addItem = () => {
    const newItem = { id: Date.now().toString(), description: '', quantity: 1, unitCost: 0, amount: 0 };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
          updated.amount = updated.quantity * updated.unitCost;
        }
        return updated;
      }
      return item;
    }));
  };

  const t = TRANSLATIONS[lang];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
          <ChevronLeft size={20} />
          Volver
        </button>
        <div className="flex gap-3">
           <button className="hidden sm:flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <Eye size={18} />
            Previsualizar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
            <Save size={18} />
            Guardar
          </button>
        </div>
      </div>

      {/* Steps indicator - Desktop only */}
      <div className="hidden sm:flex items-center justify-between px-8 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
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

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
        {/* Mobile-first Wizard steps */}
        <div className="p-8 flex-1">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-slate-800">Seleccionar Cliente</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Idioma de la factura</label>
                  <div className="flex gap-2">
                    <button onClick={() => setLang('ES')} className={`flex-1 py-3 rounded-xl border font-bold transition-all ${lang === 'ES' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}>Español</button>
                    <button onClick={() => setLang('EN')} className={`flex-1 py-3 rounded-xl border font-bold transition-all ${lang === 'EN' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}>English</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Fecha de Emisión</label>
                  <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-sm font-semibold text-slate-600">Datos del Cliente</label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <h3 className="font-bold text-slate-800">{recipient.name}</h3>
                  <p className="text-sm text-slate-500">{recipient.taxId}</p>
                  <p className="text-sm text-slate-500">{recipient.address.street}, {recipient.address.city}</p>
                </div>
                <button className="text-indigo-600 font-bold text-sm hover:underline">+ Cambiar cliente</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Líneas de Factura</h2>
                <button onClick={addItem} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-200">
                  <Plus size={16} /> Añadir Línea
                </button>
              </div>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-end p-4 bg-slate-50 rounded-2xl">
                    <div className="col-span-12 md:col-span-6 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción</label>
                      <input 
                        value={item.description} 
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Ej: Alquiler Local Calle Mayor" 
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" 
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Cantidad</label>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" 
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Precio</label>
                      <input 
                        type="number" 
                        value={item.unitCost} 
                        onChange={e => updateItem(item.id, 'unitCost', Number(e.target.value))}
                        className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" 
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1 text-right mb-2 font-bold text-slate-800">
                      {item.amount.toFixed(2)}€
                    </div>
                    <div className="col-span-1 flex justify-end mb-2">
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-slate-800">Impuestos y Retención</h2>
              <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">IVA (%)</span>
                  <input type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))} className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-right outline-none font-bold" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">IRPF / Retención (%)</span>
                  <input type="number" value={irpfRate} onChange={e => setIrpfRate(Number(e.target.value))} className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-right outline-none font-bold" />
                </div>
                <hr className="border-slate-200" />
                <div className="flex justify-between items-center text-slate-500">
                  <span>{t.subtotal}</span>
                  <span>{subtotal.toLocaleString()} €</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>{t.vat} ({vatRate}%)</span>
                  <span>+ {vatAmount.toLocaleString()} €</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>{t.irpf} ({irpfRate}%)</span>
                  <span>- {irpfAmount.toLocaleString()} €</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                  <span className="text-lg font-bold text-slate-800">{t.total}</span>
                  <span className="text-2xl font-black text-indigo-700">{total.toLocaleString()} €</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Revisión Final</h2>
                <div className={`px-4 py-1.5 rounded-full border font-bold text-xs ${
                  status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  ESTADO: {status === 'PAID' ? t.paid : 'PENDIENTE'}
                </div>
              </div>

              {/* PDF Preview Mockup */}
              <div className="border border-slate-200 rounded-lg p-10 bg-white shadow-sm space-y-10 max-w-[210mm] mx-auto min-h-[400px]">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{t.date}</p>
                    <p className="font-bold">01/11/2025</p>
                  </div>
                   <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{t.number}</p>
                    <p className="font-bold text-xl">20251202001</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-20">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase border-b pb-1">{t.issuer}</p>
                    <p className="font-bold text-sm">{issuer.name}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                      {issuer.address.street}, {issuer.address.zip}<br/>{issuer.address.city}, {issuer.address.country}<br/>{issuer.taxId}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase border-b pb-1">{t.recipient}</p>
                    <p className="font-bold text-sm">{recipient.name}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                      {recipient.address.street}, {recipient.address.zip}<br/>{recipient.address.city}, {recipient.address.country}<br/>{recipient.taxId}
                    </p>
                  </div>
                </div>

                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="py-2 px-2 text-left">{t.description}</th>
                      <th className="py-2 px-2 text-right">{t.unitCost}</th>
                      <th className="py-2 px-2 text-right">{t.quantity}</th>
                      <th className="py-2 px-2 text-right">{t.amount}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="py-4 px-2 font-medium">{item.description}</td>
                        <td className="py-4 px-2 text-right">{item.unitCost.toFixed(2)} €</td>
                        <td className="py-4 px-2 text-right">{item.quantity}</td>
                        <td className="py-4 px-2 text-right font-bold">{item.amount.toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={3} className="py-2 px-2 text-right font-semibold text-slate-400 uppercase">{t.subtotal}</td>
                      <td className="py-2 px-2 text-right font-bold">{subtotal.toLocaleString()} €</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 px-2 text-right font-semibold text-slate-400 uppercase">{t.vat} ({vatRate}%)</td>
                      <td className="py-1 px-2 text-right font-bold">{vatAmount.toLocaleString()} €</td>
                    </tr>
                    {irpfRate > 0 && (
                      <tr>
                        <td colSpan={3} className="py-1 px-2 text-right font-semibold text-slate-400 uppercase">{t.irpf} (-{irpfRate}%)</td>
                        <td className="py-1 px-2 text-right font-bold">- {irpfAmount.toLocaleString()} €</td>
                      </tr>
                    )}
                    <tr className="bg-slate-900 text-white">
                      <td colSpan={3} className="py-3 px-2 text-right font-bold uppercase tracking-wider">{t.total}</td>
                      <td className="py-3 px-2 text-right font-black text-lg">{total.toLocaleString()} €</td>
                    </tr>
                  </tfoot>
                </table>

                {status === 'PAID' && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-red-500 text-red-500 font-black text-6xl uppercase px-8 py-4 opacity-20 rotate-[-30deg] pointer-events-none">
                    {t.paid}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button 
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            Anterior
          </button>
          <div className="flex gap-2">
            {step === 4 && (
              <button 
                onClick={() => setStatus(status === 'PAID' ? 'DRAFT' : 'PAID')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all border ${
                  status === 'PAID' ? 'bg-white border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {status === 'PAID' ? 'Marcar Borrador' : 'Marcar Pagado'}
              </button>
            )}
            <button 
              onClick={() => step < 4 ? setStep(step + 1) : null}
              className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              {step < 4 ? 'Siguiente' : 'Finalizar y Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceEditor;
