export type ServiceCategory = 'Electrical' | 'HVAC' | 'Solar' | 'Security' | 'Consumables';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted';
export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue';

export interface BusinessProfile {
  companyName: string;
  regNumber: string;
  vatNumber: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  bankName: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  defaultVatRate: number; // 15% in SA
  rates: {
    calloutDiagnostic: number; // R750 default
    masterLabourRate: number; // R550 / hr default
    assistantLabourRate: number; // R150 / hr default
    travelRatePerKm: number; // R9.50 / km default
    travelIncludedKm: number; // 25 km included in callout
    afterHoursMultiplier: number; // 1.5x
    defaultMaterialMarkupPct: number; // 30%
  };
}

export interface InventoryItem {
  id: string;
  sku: string;
  barcode?: string;
  description: string;
  category: ServiceCategory;
  unit: 'ea' | 'm' | 'roll' | 'kg' | 'box' | 'set' | 'pair' | 'canister';
  costPrice: number; // ZAR cost price from trade supplier
  markupPct: number; // e.g. 30%
  sellingPrice: number; // ZAR selling price
  stockOnHand: number;
  minStockAlert: number;
  supplierRef?: string; // e.g. "Voltex", "Metraclark", "ARB"
  notes?: string;
  lastUpdated: string;
  // HVAC specific: canister tracking
  canisterWeightKg?: number;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  phone: string;
  email: string;
  siteAddress: string;
  serviceType: ServiceCategory;
  notes?: string;
  createdAt: string;
}

export interface QuoteLineItem {
  id: string;
  inventoryId?: string;
  type: 'material' | 'labour' | 'callout' | 'travel' | 'custom';
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  total: number;
  category?: ServiceCategory;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  serviceType: ServiceCategory;
  date: string;
  expiryDate: string;
  items: QuoteLineItem[];
  // Cost breakdown
  calloutFee: number;
  masterLabourHours: number;
  masterLabourRate: number;
  assistantLabourHours: number;
  assistantLabourRate: number;
  travelKm: number;
  travelRate: number;
  isAfterHours: boolean;
  afterHoursMultiplier: number;
  materialsTotal: number;
  labourTotal: number;
  travelTotal: number;
  subtotal: number;
  vatEnabled: boolean;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  status: QuoteStatus;
  notes?: string;
  terms: string;
  createdAt: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  quoteId?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  title: string;
  serviceType: ServiceCategory;
  status: JobStatus;
  scheduledDate: string;
  completedDate?: string;
  allocatedItems: QuoteLineItem[];
  notes?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quoteId?: string;
  jobId?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  serviceType: ServiceCategory;
  date: string;
  dueDate: string;
  items: QuoteLineItem[];
  calloutFee: number;
  labourTotal: number;
  travelTotal: number;
  materialsTotal: number;
  subtotal: number;
  vatEnabled: boolean;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: InvoiceStatus;
  paymentMethod?: 'EFT' | 'Cash' | 'Card' | 'Instant EFT';
  paidDate?: string;
  notes?: string;
  createdAt: string;
}

export interface ScannedSupplierItem {
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitCostPrice: number;
  lineTotal: number;
  vatAmount?: number;
  category?: ServiceCategory;
  // Matching status with existing local inventory
  matchedItemId?: string;
  existingCostPrice?: number;
  existingStock?: number;
  priceChangePct?: number; // e.g. +8.5%
  action: 'update_stock_and_price' | 'update_stock_only' | 'create_new' | 'skip';
  newSellingPrice?: number;
}

export interface ScannedInvoiceResult {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  vatNumber?: string;
  items: ScannedSupplierItem[];
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  notes?: string;
  rawImagePreview?: string;
}
