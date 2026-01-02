import { Invoice, Party, AppSettings, InvoiceTemplate, Issuer, Client } from '../types';

// 🔥 Firestore (modular SDK)
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData
} from 'firebase/firestore';

// ✅ FIX: store.ts está en src/lib -> firebase está en el mismo directorio
import { db } from './firebase';

const STORAGE_KEYS = {
  INVOICES: 'si_invoices', // legacy local cache / migration
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

/**
 * -----------------------------
 *  FASE 2: cache en memoria
 * -----------------------------
 * - 1 query por pantalla (listado): loadInvoicesOnce()
 * - editor: getInvoice() -> 0 lecturas si está; si no, 1 getDoc
 */
type InvoicesCacheKey = string; // `${uid}::${issuerId||'*'}`

const _invoiceCache = {
  byId: new Map<string, Invoice>(),
  listIdsByKey: new Map<InvoicesCacheKey, string[]>(),
  lastDocByKey: new Map<InvoicesCacheKey, QueryDocumentSnapshot<DocumentData> | null>(),
  loadedByKey: new Set<InvoicesCacheKey>()
};

const invoicesKey = (uid: string, issuerId?: string) => `${uid}::${issuerId || '*'}`;

/**
 * 🔔 listeners locales (NO Firestore listeners)
 * Para refrescar listas en UI sin lecturas extra.
 */
type InvoicesChangedCb = (payload: { uid: string }) => void;
const _invoiceListeners = new Set<InvoicesChangedCb>();

function emitInvoicesChanged(uid: string) {
  _invoiceListeners.forEach((cb) => {
    try {
      cb({ uid });
    } catch {
      // noop
    }
  });
}

function touchLoadedInvoicesList(key: InvoicesCacheKey, id: string) {
  if (!_invoiceCache.loadedByKey.has(key)) return;
  const current = _invoiceCache.listIdsByKey.get(key) || [];
  if (!current.includes(id)) {
    _invoiceCache.listIdsByKey.set(key, [id, ...current]);
  } else {
    // mover arriba (como “más reciente”)
    _invoiceCache.listIdsByKey.set(key, [id, ...current.filter((x) => x !== id)]);
  }
}

/**
 * Normaliza la factura para Firestore.
 * Añade metadatos mínimos para reglas de seguridad y ordenación.
 */
function toFirestoreInvoice(uid: string, invoice: Invoice, issuerId?: string) {
  return {
    ...invoice,
    ownerUid: uid,
    issuerId: (invoice as any).issuerId || issuerId || null,
    updatedAt: serverTimestamp(),
    createdAt: (invoice as any).createdAt || serverTimestamp()
  };
}

function fromFirestoreInvoice(id: string, data: any): Invoice {
  const { ownerUid, updatedAt, createdAt, ...rest } = data || {};
  return { id, ...rest } as Invoice;
}

/**
 * -----------------------------
 *  CLIENTS: cache en memoria
 * -----------------------------
 */
type ClientsCacheKey = string; // `${uid}`

const _clientCache = {
  byId: new Map<string, Client>(),
  listIdsByKey: new Map<ClientsCacheKey, string[]>(),
  lastDocByKey: new Map<ClientsCacheKey, QueryDocumentSnapshot<DocumentData> | null>(),
  loadedByKey: new Set<ClientsCacheKey>()
};

const clientsKey = (uid: string) => `${uid}`;

function toFirestoreClient(uid: string, client: Client) {
  return {
    ...client,
    ownerUid: uid,
    updatedAt: serverTimestamp(),
    createdAt: (client as any).createdAt || serverTimestamp()
  };
}

function fromFirestoreClient(id: string, data: any): Client {
  const { ownerUid, updatedAt, createdAt, ...rest } = data || {};
  return { id, ...rest } as Client;
}

function touchLoadedClientsList(key: ClientsCacheKey, id: string) {
  if (!_clientCache.loadedByKey.has(key)) return;
  const current = _clientCache.listIdsByKey.get(key) || [];
  if (!current.includes(id)) {
    _clientCache.listIdsByKey.set(key, [id, ...current]);
  } else {
    _clientCache.listIdsByKey.set(key, [id, ...current.filter((x) => x !== id)]);
  }
}

/**
 * -----------------------------
 *  TEMPLATES: Firestore + cache
 * -----------------------------
 */
type TemplatesCacheKey = string; // `${uid}`

const _templateCache = {
  byId: new Map<string, InvoiceTemplate>(),
  listIdsByKey: new Map<TemplatesCacheKey, string[]>(),
  lastDocByKey: new Map<TemplatesCacheKey, QueryDocumentSnapshot<DocumentData> | null>(),
  loadedByKey: new Set<TemplatesCacheKey>()
};

const templatesKey = (uid: string) => `${uid}`;

function toFirestoreTemplate(uid: string, t: InvoiceTemplate) {
  return {
    ...t,
    ownerUid: uid,
    updatedAt: serverTimestamp(),
    createdAt: (t as any).createdAt || serverTimestamp()
  };
}

function fromFirestoreTemplate(id: string, data: any): InvoiceTemplate {
  const { ownerUid, updatedAt, createdAt, ...rest } = data || {};
  return { id, ...rest } as InvoiceTemplate;
}

function touchLoadedTemplatesList(key: TemplatesCacheKey, id: string) {
  if (!_templateCache.loadedByKey.has(key)) return;
  const current = _templateCache.listIdsByKey.get(key) || [];
  if (!current.includes(id)) {
    _templateCache.listIdsByKey.set(key, [id, ...current]);
  } else {
    _templateCache.listIdsByKey.set(key, [id, ...current.filter((x) => x !== id)]);
  }
}

export const store = {
  // -------- Invoices (Firestore) --------

  /**
   * Hook local: la UI puede escuchar cambios SIN Firestore listeners.
   */
  onInvoicesChanged: (cb: InvoicesChangedCb) => {
    _invoiceListeners.add(cb);
    return () => _invoiceListeners.delete(cb);
  },

  /**
   * Devuelve la lista cacheada (0 lecturas). Si no hay cache, [].
   */
  getCachedInvoices: (uid: string, opts?: { issuerId?: string }): Invoice[] => {
    const key = invoicesKey(uid, opts?.issuerId);
    if (!_invoiceCache.loadedByKey.has(key)) return [];
    const ids = _invoiceCache.listIdsByKey.get(key) || [];
    return ids.map((id) => _invoiceCache.byId.get(id)!).filter(Boolean);
  },

  loadInvoicesOnce: async (
    uid: string,
    opts?: { issuerId?: string; pageSize?: number; force?: boolean }
  ): Promise<Invoice[]> => {
    const issuerId = opts?.issuerId;
    const pageSize = opts?.pageSize ?? 50;
    const key = invoicesKey(uid, issuerId);

    if (!opts?.force && _invoiceCache.loadedByKey.has(key)) {
      const ids = _invoiceCache.listIdsByKey.get(key) || [];
      return ids.map((id) => _invoiceCache.byId.get(id)!).filter(Boolean);
    }

    const col = collection(db, 'invoices');
    const clauses: any[] = [
      where('ownerUid', '==', uid),
      orderBy('updatedAt', 'desc'),
      limit(pageSize)
    ];

    if (issuerId) clauses.unshift(where('issuerId', '==', issuerId));

    const q = query(col, ...clauses);
    const snap = await getDocs(q);

    const ids: string[] = [];
    snap.forEach((d) => {
      const inv = fromFirestoreInvoice(d.id, d.data());
      _invoiceCache.byId.set(inv.id, inv);
      ids.push(inv.id);
    });

    const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    _invoiceCache.lastDocByKey.set(key, last);
    _invoiceCache.listIdsByKey.set(key, ids);
    _invoiceCache.loadedByKey.add(key);

    return ids.map((id) => _invoiceCache.byId.get(id)!).filter(Boolean);
  },

  loadMoreInvoices: async (
    uid: string,
    opts?: { issuerId?: string; pageSize?: number }
  ): Promise<Invoice[]> => {
    const issuerId = opts?.issuerId;
    const pageSize = opts?.pageSize ?? 50;
    const key = invoicesKey(uid, issuerId);

    const last = _invoiceCache.lastDocByKey.get(key);
    if (!last) return [];

    const col = collection(db, 'invoices');
    const clauses: any[] = [
      where('ownerUid', '==', uid),
      orderBy('updatedAt', 'desc'),
      startAfter(last),
      limit(pageSize)
    ];
    if (issuerId) clauses.unshift(where('issuerId', '==', issuerId));

    const q = query(col, ...clauses);
    const snap = await getDocs(q);

    const existing = _invoiceCache.listIdsByKey.get(key) || [];
    const newIds: string[] = [];

    snap.forEach((d) => {
      const inv = fromFirestoreInvoice(d.id, d.data());
      _invoiceCache.byId.set(inv.id, inv);
      if (!existing.includes(inv.id)) newIds.push(inv.id);
    });

    const merged = [...existing, ...newIds];
    _invoiceCache.listIdsByKey.set(key, merged);

    const newLast = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    _invoiceCache.lastDocByKey.set(key, newLast);

    return newIds.map((id) => _invoiceCache.byId.get(id)!).filter(Boolean);
  },

  getInvoice: async (uid: string, id: string): Promise<Invoice | null> => {
    const cached = _invoiceCache.byId.get(id);
    if (cached) return cached;

    const ref = doc(db, 'invoices', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const inv = fromFirestoreInvoice(snap.id, snap.data());
    if ((snap.data() as any)?.ownerUid && (snap.data() as any).ownerUid !== uid) return null;

    _invoiceCache.byId.set(inv.id, inv);
    return inv;
  },

  saveInvoice: async (uid: string, invoice: Invoice, opts?: { issuerId?: string }) => {
    // cache local instantánea
    _invoiceCache.byId.set(invoice.id, invoice);

    // ✅ actualizar listas cacheadas (sin lecturas extra)
    const effIssuerId = (invoice as any)?.issuerId || opts?.issuerId || undefined;

    // lista por emisor (si existe)
    if (effIssuerId) touchLoadedInvoicesList(invoicesKey(uid, String(effIssuerId)), invoice.id);

    // lista global
    touchLoadedInvoicesList(invoicesKey(uid, undefined), invoice.id);

    // persist
    const ref = doc(db, 'invoices', invoice.id);
    await setDoc(ref, toFirestoreInvoice(uid, invoice, opts?.issuerId), { merge: true });

    emitInvoicesChanged(uid);
  },

  deleteInvoice: async (uid: string, id: string) => {
    _invoiceCache.byId.delete(id);
    for (const [k, ids] of _invoiceCache.listIdsByKey.entries()) {
      if (ids.includes(id)) _invoiceCache.listIdsByKey.set(k, ids.filter((x) => x !== id));
    }

    const ref = doc(db, 'invoices', id);
    await deleteDoc(ref);

    emitInvoicesChanged(uid);
  },

  migrateLocalInvoicesToFirestoreOnce: async (uid: string, opts?: { issuerId?: string }) => {
    const raw = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (!raw) return;

    let invoices: Invoice[] = [];
    try {
      invoices = JSON.parse(raw) || [];
    } catch {
      return;
    }
    if (!Array.isArray(invoices) || invoices.length === 0) return;

    for (const inv of invoices) {
      if (!inv?.id) continue;
      await store.saveInvoice(uid, inv, { issuerId: opts?.issuerId });
    }

    localStorage.removeItem(STORAGE_KEYS.INVOICES);
  },

  // -------- Clients (Firestore) --------

  getClients: (): Client[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIENTS) || '[]'),

  loadClientsOnce: async (uid: string, opts?: { pageSize?: number; force?: boolean }): Promise<Client[]> => {
    const pageSize = opts?.pageSize ?? 200;
    const key = clientsKey(uid);

    if (!opts?.force && _clientCache.loadedByKey.has(key)) {
      const ids = _clientCache.listIdsByKey.get(key) || [];
      return ids.map((id) => _clientCache.byId.get(id)!).filter(Boolean);
    }

    const col = collection(db, 'clients');
    const q = query(col, where('ownerUid', '==', uid), orderBy('updatedAt', 'desc'), limit(pageSize));

    const snap = await getDocs(q);
    const ids: string[] = [];

    snap.forEach((d) => {
      const c = fromFirestoreClient(d.id, d.data());
      _clientCache.byId.set(c.id, c);
      ids.push(c.id);
    });

    const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    _clientCache.lastDocByKey.set(key, last);
    _clientCache.listIdsByKey.set(key, ids);
    _clientCache.loadedByKey.add(key);

    return ids.map((id) => _clientCache.byId.get(id)!).filter(Boolean);
  },

  saveClient: async (uid: string, client: Client) => {
    _clientCache.byId.set(client.id, client);
    touchLoadedClientsList(clientsKey(uid), client.id);

    const ref = doc(db, 'clients', client.id);
    await setDoc(ref, toFirestoreClient(uid, client), { merge: true });
  },

  deleteClient: async (uid: string, id: string) => {
    _clientCache.byId.delete(id);
    const key = clientsKey(uid);
    const ids = _clientCache.listIdsByKey.get(key) || [];
    if (ids.includes(id)) _clientCache.listIdsByKey.set(key, ids.filter((x) => x !== id));

    const ref = doc(db, 'clients', id);
    await deleteDoc(ref);
  },

  migrateLocalClientsToFirestoreOnce: async (uid: string) => {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (!raw) return;

    let clients: Client[] = [];
    try {
      clients = JSON.parse(raw) || [];
    } catch {
      return;
    }
    if (!Array.isArray(clients) || clients.length === 0) return;

    for (const c of clients) {
      if (!c?.id) continue;
      await store.saveClient(uid, c);
    }

    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
  },

  // -------- Templates (Firestore) --------

  getTemplates: (): InvoiceTemplate[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.TEMPLATES) || '[]'),

  loadTemplatesOnce: async (
    uid: string,
    opts?: { pageSize?: number; force?: boolean }
  ): Promise<InvoiceTemplate[]> => {
    const pageSize = opts?.pageSize ?? 200;
    const key = templatesKey(uid);

    if (!opts?.force && _templateCache.loadedByKey.has(key)) {
      const ids = _templateCache.listIdsByKey.get(key) || [];
      return ids.map((id) => _templateCache.byId.get(id)!).filter(Boolean);
    }

    const col = collection(db, 'templates');
    const q = query(col, where('ownerUid', '==', uid), orderBy('updatedAt', 'desc'), limit(pageSize));

    const snap = await getDocs(q);
    const ids: string[] = [];

    snap.forEach((d) => {
      const t = fromFirestoreTemplate(d.id, d.data());
      _templateCache.byId.set(t.id, t);
      ids.push(t.id);
    });

    const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    _templateCache.lastDocByKey.set(key, last);
    _templateCache.listIdsByKey.set(key, ids);
    _templateCache.loadedByKey.add(key);

    return ids.map((id) => _templateCache.byId.get(id)!).filter(Boolean);
  },

  saveTemplate: async (uid: string, tpl: InvoiceTemplate) => {
    _templateCache.byId.set(tpl.id, tpl);
    touchLoadedTemplatesList(templatesKey(uid), tpl.id);

    const ref = doc(db, 'templates', tpl.id);
    await setDoc(ref, toFirestoreTemplate(uid, tpl), { merge: true });
  },

  deleteTemplate: async (uid: string, id: string) => {
    _templateCache.byId.delete(id);
    const key = templatesKey(uid);
    const ids = _templateCache.listIdsByKey.get(key) || [];
    if (ids.includes(id)) _templateCache.listIdsByKey.set(key, ids.filter((x) => x !== id));

    const ref = doc(db, 'templates', id);
    await deleteDoc(ref);
  },

  migrateLocalTemplatesToFirestoreOnce: async (uid: string) => {
    const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!raw) return;

    let templates: InvoiceTemplate[] = [];
    try {
      templates = JSON.parse(raw) || [];
    } catch {
      return;
    }
    if (!Array.isArray(templates) || templates.length === 0) return;

    for (const t of templates) {
      if (!t?.id) continue;
      await store.saveTemplate(uid, t);
    }

    localStorage.removeItem(STORAGE_KEYS.TEMPLATES);
  },

  // -------- Settings (LOCAL por ahora) --------
  getSettings: (): AppSettings => {
    const rawStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!rawStr) return DEFAULT_SETTINGS;

    try {
      const raw = JSON.parse(rawStr);
      const migrated = migrateSettings(raw);

      if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(migrated));
      }

      return migrated;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: (settings: AppSettings) => localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)),

  // -------- Issuers (CRUD) --------
  getIssuers: (): Issuer[] => store.getSettings().issuers,

  getActiveIssuerId: (): string => store.getSettings().activeIssuerId,

  getActiveIssuer: (): Issuer => {
    const s = store.getSettings();
    return s.issuers.find((i) => i.id === s.activeIssuerId) || s.issuers[0] || DEFAULT_ISSUER;
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
    const issuers = settings.issuers.map((i) => (i.id === issuer.id ? issuer : i));
    store.saveSettings({ ...settings, issuers });
  },

  deleteIssuer: (issuerId: string) => {
    const settings = store.getSettings();
    const issuers = settings.issuers.filter((i) => i.id !== issuerId);

    const nextActive =
      settings.activeIssuerId === issuerId ? issuers[0]?.id || DEFAULT_ISSUER.id : settings.activeIssuerId;

    const safeIssuers = issuers.length > 0 ? issuers : [DEFAULT_ISSUER];

    store.saveSettings({
      ...settings,
      issuers: safeIssuers,
      activeIssuerId: safeIssuers.some((i) => i.id === nextActive) ? nextActive : safeIssuers[0].id
    });
  },

  setActiveIssuer: (issuerId: string) => {
    const settings = store.getSettings();
    const exists = settings.issuers.some((i) => i.id === issuerId);
    if (!exists) return;
    store.saveSettings({ ...settings, activeIssuerId: issuerId });
  }
};
