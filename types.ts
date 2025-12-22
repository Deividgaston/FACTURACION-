
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
  issuer: Party;
  recipient: Party;
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
  issuerDefaults: Party;
  defaultCurrency: string;
  nextInvoiceNumber: number;
  yearCounter: Record<number, number>;
}
