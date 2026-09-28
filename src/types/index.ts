export type ServiceCategory =
  | 'Electrical'
  | 'Air Conditioning'
  | 'Refridgeration, Motors and Fans'
  | 'Solar & Backup'
  | 'Security & CCTV'
  | 'Automation & Gate Motors'
  | 'Maintenance & Repairs';

export type InventoryCategory =
  | ServiceCategory
  | 'Hardware & Site Materials'
  | 'Hardware & Fasteners'
  | 'Refridgeration, Motors and Fans'
  | 'Refrigeration, Motors and Fans'
  | 'Consumables'
  | 'Cabling'
  | 'Switchgear'
  | 'Hardware'
  | 'General'
  | (string & {});

export type ConsumablesTier = 'none' | 'light' | 'standard' | 'heavy' | 'custom';

export type ExpenseCategory =
  | 'Materials & Stock'
  | 'Vehicle Fuel & Fleet'
  | 'Labor & Contractor Wages'
  | 'Tools & Equipment'
  | 'Overheads & Compliance'
  | 'Marketing & Software'
  | 'Other & Miscellaneous';

export type ExpenseLinkType = 'standalone' | 'quote' | 'invoice';

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: ExpenseCategory;
  amount: number; // ZAR Total (incl. VAT where applicable)
  vatAmount?: number;
  supplier?: string;
  invoiceNumber?: string; // Receipt / Supplier Invoice reference
  paymentMethod?: 'EFT' | 'Card' | 'Cash' | 'Account' | 'Debit Order';
  relatedClientOrJob?: string;
  notes?: string;
  receiptImageUrl?: string;
  linkType?: ExpenseLinkType;
  linkedQuoteId?: string;
  linkedQuoteNumber?: string;
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
}

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
  createdAt?: string;
  updatedAt?: string;
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
  balanceDue?: number;
  status: InvoiceStatus;
  notes?: string;
  terms?: string;
  payments?: InvoicePayment[];
  createdAt?: string;
  updatedAt?: string;
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
  name: string; // Business or contact name
  company?: string;
  phone: string;
  email?: string;
  address: string;
  taxVatNumber?: string; // Tax/VAT number
  vatNumber?: string;
  notes?: string;
  suburb?: string;
  city?: string;
  tags?: string[];
  totalBilled?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  sku: string; // Item code / SKU
  name: string; // Description / Item Name
  description?: string; // Item Description
  category: InventoryCategory;
  costPrice: number; // Unit Cost
  unitCost?: number; // Alias for unit cost
  defaultMarkup: number; // Markup %
  markupPct?: number; // Alias for markup %
  sellingPrice: number; // Selling Price
  unit: string; // e.g. 'ea', 'box', 'pack', 'roll', 'm', 'length', 'set'
  stockQty: number; // Quantity on hand
  quantityOnHand?: number; // Alias for quantity on hand
  minStockLevel: number; // Minimum alert level
  minAlertLevel?: number; // Alias for minimum alert level
  supplier?: string;
  location?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StockItem = InventoryItem;

export interface FinancialRecord {
  id: string; // Transaction ID
  date: string; // YYYY-MM-DD
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  linkedInvoiceRef?: string;
  description?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocalBackupPayload {
  app: string;
  version: string;
  schemaVersion: number;
  exportedAt: string;
  checksum?: string;
  recordCounts: {
    clients: number;
    stock: number;
    quotations: number;
    invoices: number;
    financial_records: number;
    expenses: number;
  };
  data: {
    profile?: BusinessProfile;
    clients: Client[];
    stock: InventoryItem[];
    quotations: Quotation[];
    invoices: Invoice[];
    financial_records: FinancialRecord[];
    expenses: Expense[];
  };
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
  saveFile?: (base64Data: string, filename: string, mimeType: string) => boolean | void;
  openFile?: (base64Data: string, filename: string, mimeType: string) => boolean | void;
  printDocument?: () => boolean | void;
  printPdf?: (base64Data: string, filename: string) => boolean | void;
  shareFile?: (base64Data: string, filename: string, mimeType: string, title?: string) => boolean | void;
  showToast?: (message: string) => void;
  openUrl?: (url: string) => boolean | void;
  isAndroidApp?: () => boolean;
}

declare global {
  interface Window {
    AndroidInterface?: AndroidBridge;
  }
}
