export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';

// ✅ Añadido 'GENERIC' porque ya lo estás usando en plantillas
export type InvoiceType = 'RENT' | 'CLASS' | 'SERVICE' | 'OTHER' | 'GENERIC';

export type Language = 'ES' | 'EN';

export interface Address {
  street: string;
  city: string;
  zip: string;
  country: string;
}

export interface Party {
  name: string;
  taxId: string;
  address: Address;
  email: string;
}

/** ✅ Recomendado: tipo explícito para clientes */
export interface Client extends Party {
  id: string;
}

export interface Issuer extends Party {
  id: string;        // unique id for selecting/editing
  alias?: string;    // optional display name (e.g. "Empresa Madrid")
}

export interface InvoiceItem {
  id: string;
  description: string;
  unitCost: number;
  quantity: number;
  amount: number;
}

/**
 * ✅ Plantilla “usable” para no repetir:
 * - incluye emisor + receptor + líneas + impuestos
 * - la fecha NO se guarda (se pone al crear la factura)
 *
 * Compatibilidad:
 * - `defaultItems` legacy opcional (antiguo)
 * - `recurring` legacy opcional (tu UI usa tpl.recurring)
 * - `createdAt/updatedAt/lastUsedAt` opcionales (Firestore)
 */
export interface InvoiceTemplate {
  id: string;
  name: string;
  type: InvoiceType;
  lang: Language;

  // ✅ NUEVO: snapshot emisor/receptor (lo que tú quieres repetir)
  issuer?: Party;
  issuerId?: string | null;

  recipient?: Party;
  clientId?: string | null; // ✅ permitir null si alguna plantilla no fija cliente

  // ✅ NUEVO: líneas completas (con id) para aplicarlas tal cual en InvoiceEditor
  items?: InvoiceItem[];

  // Legacy (por si venías usando otro shape)
  defaultItems?: Omit<InvoiceItem, 'id'>[];

  vatRate: number;
  irpfRate: number;

  // ✅ Canon
  isRecurring: boolean;

  // ✅ Compat UI antigua (si existe, es lo mismo)
  recurring?: boolean;

  notes?: string;

  // Firestore/meta (opcionales)
  lastUsedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface Invoice {
  id: string;
  number: string;

  issuer: Party;                 // snapshot stored per invoice (keeps history stable)
  issuerId?: string | null;      // emisor seleccionado

  recipient: Party;              // snapshot (normalmente proviene de Client)
  clientId: string;              // (en tu flujo actual es obligatorio)

  templateId?: string | null;

  date: string;
  dueDate: string;

  status: InvoiceStatus;
  lang: Language;

  items: InvoiceItem[];
  subtotal: number;

  vatRate: number;
  vatAmount: number;

  irpfRate: number;
  irpfAmount: number;

  total: number;
  isRecurring: boolean;
  notes?: string;
}

export interface AppSettings {
  issuers: Issuer[];
  activeIssuerId: string;

  // Legacy single-issuer (kept only for migration)
  issuerDefaults?: Party;

  defaultCurrency: string;
  nextInvoiceNumber: number;
  yearCounter: Record<number, number>;
}
