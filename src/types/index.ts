export type ServiceCategory =
  | 'Electrical'
  | 'Air Conditioning'
  | 'Solar & Backup'
  | 'Security & CCTV'
  | 'Automation & Gate Motors'
  | 'Maintenance & Repairs';

export type InventoryCategory =
  | ServiceCategory
  | 'Hardware & Site Materials'
  | 'Hardware & Fasteners'
  | 'Consumables'
  | 'Cabling'
  | 'Switchgear'
  | 'Hardware'
  | 'General'
  | (string & {});

export type ConsumablesTier = 'none' | 'light' | 'standard' | 'heavy' | 'custom';

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'deposit_paid' | 'invoiced' | 'declined';
export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue';

export interface QuoteLineItem {
  id: string;
  description: string;
  category: ServiceCategory | InventoryCategory | 'General';
  costPrice: number;
  markupPct: number;
  unitPrice: number;
  quantity: number;
  unit: string;
  total: number;
  notes?: string;
  inventoryId?: string;
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
  calloutFee: number; // Flat Call-Out Fee (Includes 1st Hour Labor)
  labourHours: number; // Additional Labor Hours (worked after 1st hour)
  labourRatePerHour: number; // Hourly Rate per additional hour
  labourTotal: number; // Automatically computed: Call-Out Fee + (Additional Hours * Hourly Rate)
  additionalLabourTotal?: number; // (Additional Hours * Hourly Rate)
  travelDistanceKm: number;
  travelRatePerKm: number;
  travelTotal: number;
  consumablesTier?: ConsumablesTier;
  consumablesFee?: number;
  consumablesDescription?: string;
  miscellaneousDescription?: string;
  miscellaneousFee?: number;
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  vatEnabled: boolean;
  vatAmount: number;
  totalAmount: number;
  // Deposit fields
  depositPercentage?: number; // e.g. 50, 70, 80
  depositAmount?: number; // Deposit amount required
  depositAmountPaid?: number; // Actual deposit paid
  isDepositPaid?: boolean; // Whether deposit is paid
  depositPaidDate?: string; // Date deposit was paid
  depositPaymentMethod?: 'EFT' | 'Cash' | 'Card' | 'Instant EFT';
  depositReference?: string;
  status: QuoteStatus;
  notes?: string;
  terms?: string;
}

export interface InvoicePayment {
  id: string;
  date: string;
  amount: number;
  method: 'EFT' | 'Cash' | 'Card' | 'Instant EFT';
  reference?: string;
  notes?: string;
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
  calloutFee: number; // Flat Call-Out Fee (Includes 1st Hour Labor)
  labourHours: number; // Additional Labor Hours (worked after 1st hour)
  labourRatePerHour: number; // Hourly Rate per additional hour
  labourTotal: number; // Automatically computed: Call-Out Fee + (Additional Hours * Hourly Rate)
  additionalLabourTotal?: number; // (Additional Hours * Hourly Rate)
  travelDistanceKm: number;
  travelRatePerKm: number;
  travelTotal: number;
  consumablesTier?: ConsumablesTier;
  consumablesFee?: number;
  consumablesDescription?: string;
  miscellaneousDescription?: string;
  miscellaneousFee?: number;
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  vatEnabled: boolean;
  vatAmount: number;
  totalAmount: number;
  // Deposit & Payment fields
  depositPercentage?: number;
  depositAmount?: number;
  depositAmountPaid?: number;
  isDepositPaid?: boolean;
  depositPaidDate?: string;
  depositPaymentMethod?: 'EFT' | 'Cash' | 'Card' | 'Instant EFT';
  depositReference?: string;
  amountPaid: number;
  status: InvoiceStatus;
  notes?: string;
  terms?: string;
  payments?: InvoicePayment[];
}

export interface ScannedLineItem {
  id?: string;
  code_barcode?: string;
  codeBarcode?: string;
  item_name?: string;
  description: string;
  quantity: number;
  unitCost: number;
  unit_price?: number;
  unitPrice?: number;
  total_price?: number;
  totalPrice?: number;
  category?: string;
  unit?: string;
  markupPct?: number;
  total?: number;
}

export interface ScannedReceiptData {
  supplier_name?: string;
  supplierName: string;
  address?: string;
  vat_number?: string;
  vatNumber?: string;
  invoice_number?: string;
  receipt_number?: string;
  receiptNumber?: string;
  invoiceNumber: string;
  issue_date?: string;
  date: string;
  month_key?: string;
  monthKey?: string;
  time?: string;
  cashier?: string;
  subtotal?: number;
  vat_amount?: number;
  vatAmount?: number;
  grand_total?: number;
  total_amount?: number;
  totalAmount: number;
  line_items?: ScannedLineItem[];
  items: ScannedLineItem[];
  notes?: string;
  rawText?: string;
  isPartial?: boolean;
  isFallback?: boolean;
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
  category: InventoryCategory;
  costPrice: number;
  defaultMarkup: number;
  sellingPrice: number;
  unit: string; // e.g. 'ea', 'box', 'pack', 'roll', 'm', 'length', 'set'
  stockQty: number;
  minStockLevel: number;
  supplier?: string;
  location?: string;
  notes?: string;
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
  nextQuoteNumber?: string;
  nextInvoiceNumber?: string;
  quotePrefix?: string;
  invoicePrefix?: string;
}

export interface AndroidBridge {
  saveFile?: (base64Data: string, filename: string, mimeType: string) => void;
  openFile?: (base64Data: string, filename: string, mimeType: string) => void;
  printDocument?: () => void;
  printPdf?: (base64Data: string, filename: string) => void;
  shareFile?: (base64Data: string, filename: string, mimeType: string, title?: string) => void;
  showToast?: (message: string) => void;
  isAndroidApp?: () => boolean;
}

declare global {
  interface Window {
    AndroidInterface?: AndroidBridge;
  }
}
