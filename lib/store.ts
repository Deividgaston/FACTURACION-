import { Invoice, Party, AppSettings, InvoiceTemplate, Issuer } from '../types';

const STORAGE_KEYS = {
  INVOICES: 'si_invoices',
  CLIENTS: 'si_clients',
  SETTINGS: 'si_settings',
  TEMPLATES: 'si_templates'
};

const createId = () => `iss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_ISSUER: Issuer = {
  id: 'issuer_default',
  alias: 'Principal',
  name: 'Tu Nombre / Empresa',
  taxId: '00000000X',
  address: { street: 'Calle Principal 123', city: 'Madrid', zip: '28001', country: 'España' },
  email: 'hola@tuempresa.com'
};

const DEFAULT_SETTINGS: AppSettings = {
  issuers: [DEFAULT_ISSUER],
  activeIssuerId: DEFAULT_ISSUER.id,

  // legacy field intentionally omitted in defaults
  defaultCurrency: 'EUR',
  nextInvoiceNumber: 1,
  yearCounter: { [new Date().getFullYear()]: 1 }
};

function migrateSettings(raw: any): AppSettings {
  // If already new format, just return
  if (raw && Array.isArray(raw.issuers) && typeof raw.activeIssuerId === 'string') {
    // Ensure at least one issuer
    if (raw.issuers.length === 0) {
      return { ...raw, issuers: [DEFAULT_ISSUER], activeIssuerId: DEFAULT_ISSUER.id };
    }
    // Ensure activeIssuerId exists
    const activeExists = raw.issuers.some((i: any) => i?.id === raw.activeIssuerId);
    if (!activeExists) {
      return { ...raw, activeIssuerId: raw.issuers[0].id };
    }
    return raw as AppSettings;
  }

  // Legacy format: issuerDefaults exists
  if (raw && raw.issuerDefaults) {
    const legacy: Party = raw.issuerDefaults;
    const migratedIssuer: Issuer = {
      id: 'issuer_legacy',
      alias: 'Principal',
      ...legacy
    };

    const migrated: AppSettings = {
      issuers: [migratedIssuer],
      activeIssuerId: migratedIssuer.id,
      defaultCurrency: raw.defaultCurrency || DEFAULT_SETTINGS.defaultCurrency,
      nextInvoiceNumber: raw.nextInvoiceNumber || DEFAULT_SETTINGS.nextInvoiceNumber,
      yearCounter: raw.yearCounter || DEFAULT_SETTINGS.yearCounter,
      issuerDefaults: undefined // keep empty; field exists only for migration compatibility
    };

    return migrated;
  }

  // Empty / unknown -> default
  return DEFAULT_SETTINGS;
}

export const store = {
  // -------- Invoices --------
  getInvoices: (): Invoice[] =>
    JSON.parse(localStorage.getItem(STORAGE_KEYS.INVOICES) || '[]'),

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

  // -------- Clients --------
  getClients: (): Party[] =>
    JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIENTS) || '[]'),

  saveClient: (client: Party & { id: string }) => {
    const clients = store.getClients() as any[];
    const index = clients.findIndex(c => c.id === client.id);
    if (index >= 0) clients[index] = client;
    else clients.push(client);
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  },

  // -------- Settings --------
  getSettings: (): AppSettings => {
    const rawStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!rawStr) return DEFAULT_SETTINGS;

    try {
      const raw = JSON.parse(rawStr);
      const migrated = migrateSettings(raw);

      // Persist migration once to avoid repeated work
      if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(migrated));
      }

      return migrated;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: (settings: AppSettings) =>
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)),

  // -------- Issuers (CRUD) --------
  getIssuers: (): Issuer[] => store.getSettings().issuers,

  getActiveIssuerId: (): string => store.getSettings().activeIssuerId,

  getActiveIssuer: (): Issuer => {
    const s = store.getSettings();
    return s.issuers.find(i => i.id === s.activeIssuerId) || s.issuers[0] || DEFAULT_ISSUER;
  },

  addIssuer: (issuer: Omit<Issuer, 'id'> & { id?: string }): Issuer => {
    const settings = store.getSettings();
    const newIssuer: Issuer = {
      id: issuer.id || createId(),
      alias: issuer.alias,
      name: issuer.name,
      taxId: issuer.taxId,
      address: issuer.address,
      email: issuer.email
    };

    const updated: AppSettings = {
      ...settings,
      issuers: [...settings.issuers, newIssuer],
      activeIssuerId: settings.activeIssuerId || newIssuer.id
    };

    store.saveSettings(updated);
    return newIssuer;
  },

  updateIssuer: (issuer: Issuer) => {
    const settings = store.getSettings();
    const issuers = settings.issuers.map(i => (i.id === issuer.id ? issuer : i));
    store.saveSettings({ ...settings, issuers });
  },

  deleteIssuer: (issuerId: string) => {
    const settings = store.getSettings();
    const issuers = settings.issuers.filter(i => i.id !== issuerId);

    const nextActive =
      settings.activeIssuerId === issuerId
        ? (issuers[0]?.id || DEFAULT_ISSUER.id)
        : settings.activeIssuerId;

    // Don't allow empty issuers list (keep at least one)
    const safeIssuers = issuers.length > 0 ? issuers : [DEFAULT_ISSUER];

    store.saveSettings({
      ...settings,
      issuers: safeIssuers,
      activeIssuerId: safeIssuers.some(i => i.id === nextActive) ? nextActive : safeIssuers[0].id
    });
  },

  setActiveIssuer: (issuerId: string) => {
    const settings = store.getSettings();
    const exists = settings.issuers.some(i => i.id === issuerId);
    if (!exists) return;
    store.saveSettings({ ...settings, activeIssuerId: issuerId });
  }
};
