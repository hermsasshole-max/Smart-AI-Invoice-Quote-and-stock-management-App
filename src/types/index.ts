export type ServiceCategory =
  | 'Electrical'
  | 'Air Conditioning'
  | 'Solar & Backup'
  | 'Security & CCTV'
  | 'Automation & Gate Motors'
  | 'Maintenance & Repairs';

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'invoiced' | 'declined';
export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue';

export interface QuoteLineItem {
  id: string;
  description: string;
  category: ServiceCategory | 'General';
  costPrice: number;
  markupPct: number;
  unitPrice: number;
  quantity: number;
  unit: string;
  total: number;
  notes?: string;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  date: string;
  expiryDate: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientAddress: string;
  serviceType: ServiceCategory;
  scopeOfWork: string;
  items: QuoteLineItem[];
  calloutFee: number;
  labourHours: number;
  labourRatePerHour: number;
  labourTotal: number;
  travelDistanceKm: number;
  travelRatePerKm: number;
  travelTotal: number;
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  vatEnabled: boolean;
  vatAmount: number;
  totalAmount: number;
  status: QuoteStatus;
  notes?: string;
  terms?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quoteId?: string;
  date: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientAddress: string;
  serviceType: ServiceCategory;
  scopeOfWork: string;
  items: QuoteLineItem[];
  calloutFee: number;
  labourHours: number;
  labourRatePerHour: number;
  labourTotal: number;
  travelDistanceKm: number;
  travelRatePerKm: number;
  travelTotal: number;
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  vatEnabled: boolean;
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: InvoiceStatus;
  notes?: string;
  terms?: string;
  payments?: {
    id: string;
    date: string;
    amount: number;
    method: 'EFT' | 'Cash' | 'Card' | 'Instant EFT';
    reference?: string;
  }[];
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  address: string;
  suburb?: string;
  city?: string;
  notes?: string;
  tags?: string[];
  totalBilled?: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: ServiceCategory | 'Consumables' | 'Cabling' | 'Switchgear' | 'Hardware' | 'General';
  costPrice: number;
  defaultMarkup: number;
  sellingPrice: number;
  unit: string;
  stockQty: number;
  minStockLevel: number;
  supplier?: string;
  location?: string;
}

export interface BusinessProfile {
  companyName: string;
  tagline: string;
  regNumber: string;
  vatNumber: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  defaultLabourRate: number;
  defaultCalloutFee: number;
  defaultTravelRate: number;
  defaultMarkup: number;
  vatEnabled: boolean;
  vatPercentage: number;
  sansComplianceNotice: string;
  sunlightMode: boolean;
}

export interface AndroidBridge {
  saveFile?: (base64Data: string, filename: string, mimeType: string) => void;
  printDocument?: () => void;
  shareFile?: (base64Data: string, filename: string, mimeType: string, title?: string) => void;
  showToast?: (message: string) => void;
}

declare global {
  interface Window {
    AndroidInterface?: AndroidBridge;
  }
}
