
import { Invoice, Party, AppSettings, InvoiceTemplate } from '../types';

const STORAGE_KEYS = {
  INVOICES: 'si_invoices',
  CLIENTS: 'si_clients',
  SETTINGS: 'si_settings',
  TEMPLATES: 'si_templates'
};

const DEFAULT_SETTINGS: AppSettings = {
  issuerDefaults: {
    name: 'Tu Nombre / Empresa',
    taxId: '00000000X',
    address: { street: 'Calle Principal 123', city: 'Madrid', zip: '28001', country: 'España' },
    email: 'hola@tuempresa.com'
  },
  defaultCurrency: 'EUR',
  nextInvoiceNumber: 1,
  yearCounter: { [new Date().getFullYear()]: 1 }
};

export const store = {
  getInvoices: (): Invoice[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.INVOICES) || '[]'),
  saveInvoice: (invoice: Invoice) => {
    const invoices = store.getInvoices();
    const index = invoices.findIndex(i => i.id === invoice.id);
    if (index >= 0) invoices[index] = invoice;
    else invoices.push(invoice);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },
  deleteInvoice: (id: string) => {
    const invoices = store.getInvoices().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },
  
  getClients: (): Party[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIENTS) || '[]'),
  saveClient: (client: Party & { id: string }) => {
    const clients = store.getClients() as any[];
    const index = clients.findIndex(c => c.id === client.id);
    if (index >= 0) clients[index] = client;
    else clients.push(client);
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  },

  getSettings: (): AppSettings => JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || JSON.stringify(DEFAULT_SETTINGS)),
  saveSettings: (settings: AppSettings) => localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
};
