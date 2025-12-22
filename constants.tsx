
import React from 'react';
import { FileText, Users, LayoutTemplate, Settings, CreditCard, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const NAVIGATION = [
  { name: 'Dashboard', icon: <FileText size={20} />, path: 'dashboard' },
  { name: 'Facturas', icon: <CreditCard size={20} />, path: 'invoices' },
  { name: 'Clientes', icon: <Users size={20} />, path: 'clients' },
  { name: 'Plantillas', icon: <LayoutTemplate size={20} />, path: 'templates' },
  { name: 'Ajustes', icon: <Settings size={20} />, path: 'settings' },
];

export const STATUS_COLORS = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  ISSUED: 'bg-blue-50 text-blue-700 border-blue-200',
  PAID: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

export const TRANSLATIONS = {
  ES: {
    invoice: 'Factura',
    date: 'Fecha',
    dueDate: 'Vencimiento',
    number: 'Nº Factura',
    issuer: 'Emisor',
    recipient: 'Receptor',
    description: 'Descripción',
    unitCost: 'Precio/Unid.',
    quantity: 'Unidad',
    amount: 'Total',
    subtotal: 'SubTotal',
    vat: 'IVA',
    irpf: 'IRPF',
    total: 'Total Factura',
    paid: 'PAGADO',
  },
  EN: {
    invoice: 'Invoice',
    date: 'Date of Issue',
    dueDate: 'Due Date',
    number: 'Invoice Number',
    issuer: 'Payable to',
    recipient: 'Billed to',
    description: 'Description',
    unitCost: 'Unit Cost',
    quantity: 'Quantity',
    amount: 'Amount',
    subtotal: 'SubTotal',
    vat: 'VAT',
    irpf: 'IRPF/Withholding',
    total: 'Invoice Total',
    paid: 'PAID',
  }
};
