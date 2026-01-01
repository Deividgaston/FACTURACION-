import { Invoice, Party, AppSettings, InvoiceTemplate, Issuer } from '../types';

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
import { db } from '../firebase';

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
  defaultCurrency: 'EUR',
  nextInvoiceNumber: 1,
  yearCounter: { [new Date().getFullYear()]: 1 }
};

function migrateSettings(raw: any): AppSettings {
  if (raw && Array.isArray(raw.issuers) && typeof raw.activeIssuerId === 'string') {
    if (raw.issuers.length === 0) {
      return { ...raw, issuers: [DEFAULT_ISSUER], activeIssuerId: DEFAULT_ISSUER.id };
    }
    const activeExists = raw.issuers.some((i: any) => i?.id === raw.activeIssuerId);
    if (!activeExists) {
      return { ...raw, activeIssuerId: raw.issuers[0].id };
    }
    return raw as AppSettings;
  }

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
      issuerDefaults: undefined
    };

    return migrated;
  }

  return DEFAULT_SETTINGS;
}

type InvoicesCacheKey = string; // `${uid}::${issuerId||'*'}`

const _invoiceCache = {
  byId: new Map<string, Invoice>(),
  listIdsByKey: new Map<InvoicesCacheKey, string[]>(),
  lastDocByKey: new Map<InvoicesCacheKey, QueryDocumentSnapshot<DocumentData> | null>(),
  loadedByKey: new Set<InvoicesCacheKey>()
};

const invoicesKey = (uid: string, issuerId?: string) => `${uid}::${issuerId || '*'}`;

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
 * Inserta un id al principio de una lista (sin duplicados)
 */
function unshiftUnique(list: string[], id: string) {
  if (!list.includes(id)) return [id, ...list];
  // si ya existe, lo movemos arriba
  return [id, ...list.filter(x => x !== id)];
}

/**
 * Si una lista está cargada, la actualiza (sin forzar lecturas)
 */
function touchLoadedList(key: InvoicesCacheKey, id: string) {
  if (!_invoiceCache.loadedByKey.has(key)) return;
  const current = _invoiceCache.listIdsByKey.get(key) || [];
  _invoiceCache.listIdsByKey.set(key, unshiftUnique(current, id));
}

export const store = {
  // -------- Invoices (Firestore) --------

  loadInvoicesOnce: async (
    uid: string,
    opts?: { issuerId?: string; pageSize?: number; force?: boolean }
  ): Promise<Invoice[]> => {
    const issuerId = opts?.issuerId;
    const pageSize = opts?.pageSize ?? 50;
    const key = invoicesKey(uid, issuerId);

    if (!opts?.force && _invoiceCache.loadedByKey.has(key)) {
      const ids = _invoiceCache.listIdsByKey.get(key) || [];
      return ids.map(id => _invoiceCache.byId.get(id)!).filter(Boolean);
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
    snap.forEach(d => {
      const inv = fromFirestoreInvoice(d.id, d.data());
      _invoiceCache.byId.set(inv.id, inv);
      ids.push(inv.id);
    });

    const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    _invoiceCache.lastDocByKey.set(key, last);
    _invoiceCache.listIdsByKey.set(key, ids);
    _invoiceCache.loadedByKey.add(key);

    return ids.map(id => _invoiceCache.byId.get(id)!).filter(Boolean);
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

    snap.forEach(d => {
      const inv = fromFirestoreInvoice(d.id, d.data());
      _invoiceCache.byId.set(inv.id, inv);
      if (!existing.includes(inv.id)) newIds.push(inv.id);
    });

    const merged = [...existing, ...newIds];
    _invoiceCache.listIdsByKey.set(key, merged);

    const newLast = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    _invoiceCache.lastDocByKey.set(key, newLast);

    return newIds.map(id => _invoiceCache.byId.get(id)!).filter(Boolean);
  },

  getInvoice: async (uid: string, id: string): Promise<Invoice | null> => {
    const cached = _invoiceCache.byId.get(id);
    if (cached) return cached;

    const ref = doc(db, 'invoices', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    if ((snap.data() as any)?.ownerUid && (snap.data() as any).ownerUid !== uid) return null;

    const inv = fromFirestoreInvoice(snap.id, snap.data());
    _invoiceCache.byId.set(inv.id, inv);

    // Si la lista general ya estaba cargada, lo metemos sin lecturas extra
    touchLoadedList(invoicesKey(uid), inv.id);

    return inv;
  },

  // ✅ CAMBIO MÍNIMO AQUÍ
  saveInvoice: async (uid: string, invoice: Invoice, opts?: { issuerId?: string }) => {
    const issuerId = opts?.issuerId || (invoice as any).issuerId || undefined;

    // cache local instantánea
    _invoiceCache.byId.set(invoice.id, invoice);

    // Si ya hay listas cargadas, actualizar UI sin recargar
    touchLoadedList(invoicesKey(uid), invoice.id);
    if (issuerId) touchLoadedList(invoicesKey(uid, issuerId), invoice.id);

    const ref = doc(db, 'invoices', invoice.id);
    await setDoc(ref, toFirestoreInvoice(uid, invoice, issuerId), { merge: true });
  },

  deleteInvoice: async (uid: string, id: string) => {
    _invoiceCache.byId.delete(id);
    for (const [k, ids] of _invoiceCache.listIdsByKey.entries()) {
      if (ids.includes(id)) _invoiceCache.listIdsByKey.set(k, ids.filter(x => x !== id));
    }

    const ref = doc(db, 'invoices', id);
    await deleteDoc(ref);
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

  // -------- Clients (LOCAL por ahora) --------
  getClients: (): Party[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIENTS) || '[]'),

  saveClient: (client: Party & { id: string }) => {
    const clients = store.getClients() as any[];
    const index = clients.findIndex(c => c.id === client.id);
    if (index >= 0) clients[index] = client;
    else clients.push(client);
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
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
      settings.activeIssuerId === issuerId ? (issuers[0]?.id || DEFAULT_ISSUER.id) : settings.activeIssuerId;

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
