export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
export type InvoiceType = 'RENT' | 'CLASS' | 'SERVICE' | 'OTHER';
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

export interface InvoiceTemplate {
  id: string;
  name: string;
  type: InvoiceType;
  lang: Language;
  defaultItems: Omit<InvoiceItem, 'id'>[];
  vatRate: number;
  irpfRate: number; // For withholding (negative)
  isRecurring: boolean;
  notes?: string;
}

export interface Invoice {
  id: string;
  number: string;
  issuer: Party;     // snapshot stored per invoice (keeps history stable)
  recipient: Party;  // normalmente será un Client, pero se guarda como Party (snapshot)
  clientId: string;
  templateId?: string;
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
  // New multi-issuer support
  issuers: Issuer[];
  activeIssuerId: string;

  // Legacy single-issuer (kept only for migration)
  issuerDefaults?: Party;

  defaultCurrency: string;
  nextInvoiceNumber: number;
  yearCounter: Record<number, number>;
}
