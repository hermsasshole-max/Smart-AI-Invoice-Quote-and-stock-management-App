import Dexie, { Table } from 'dexie';
import {
  Client,
  Quotation,
  Invoice,
  InventoryItem,
  Expense,
  ScannedReceiptData,
  ServiceCategory,
} from '../types';

export interface DbClient extends Client {
  createdAt?: string;
  updatedAt?: string;
}

export interface DbQuotation extends Quotation {
  createdAt?: string;
  updatedAt?: string;
}

export interface DbInvoice extends Invoice {
  createdAt?: string;
  updatedAt?: string;
}

export interface DbInventoryItem extends InventoryItem {
  currentStock: number;
  minStockAlert: number;
  lastSuppliedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DbExpense extends Expense {
  relatedJobId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DbReceiptScan {
  id: string;
  date: string;
  supplierName: string;
  invoiceNumber: string;
  totalAmount: number;
  vatAmount?: number;
  items: any[];
  rawOcrJson?: any;
  processed: boolean;
  linkedJobId?: string;
  createdAt: string;
}

export interface DbVoiceNote {
  id: string;
  date: string;
  transcript: string;
  audioDurationSeconds?: number;
  parsedQuoteId?: string;
  status: 'draft' | 'processed' | 'applied';
  createdAt: string;
}

export interface DbComplianceDoc {
  id: string;
  docType: 'COC_ELECTRICAL' | 'COC_SOLAR' | 'COC_HVAC' | 'PRESSURE_TEST';
  docNumber: string;
  clientId: string;
  clientName: string;
  installationAddress: string;
  date: string;
  details: any;
  status: 'draft' | 'certified' | 'issued';
  createdAt: string;
}

export class FieldAssistantDatabase extends Dexie {
  clients!: Table<DbClient, string>;
  quotes!: Table<DbQuotation, string>;
  invoices!: Table<DbInvoice, string>;
  inventory!: Table<DbInventoryItem, string>;
  expenses!: Table<DbExpense, string>;
  receiptScans!: Table<DbReceiptScan, string>;
  voiceNotes!: Table<DbVoiceNote, string>;
  complianceDocs!: Table<DbComplianceDoc, string>;

  constructor() {
    super('CorTechFieldAssistantDB');
    this.version(1).stores({
      clients: 'id, name, phone, email, address',
      quotes: 'id, quoteNumber, clientId, clientName, status, date',
      invoices: 'id, invoiceNumber, quoteId, clientId, clientName, status, date',
      inventory: 'id, sku, name, category, currentStock, minStockAlert, supplier',
      expenses: 'id, date, supplier, category, paymentMethod, relatedJobId',
      receiptScans: 'id, date, supplierName, invoiceNumber, processed',
      voiceNotes: 'id, date, status',
      complianceDocs: 'id, docType, docNumber, clientId, date, status',
    });
  }
}

export const db = new FieldAssistantDatabase();

/**
 * Initialize offline database. With demo data removed, this ensures tables are ready without injecting sample records.
 */
export async function initializeOfflineDatabase(): Promise<void> {
  try {
    // Delete legacy demo IndexedDB if present
    Dexie.delete('HarrysFieldAssistantDB').catch(() => {});
    // Database schema is ready on Dexie open
    await db.open();
  } catch (err) {
    console.warn('[Dexie DB] Failed to open offline database:', err);
  }
}

/**
 * Completely wipe all offline Dexie tables to guarantee clean state
 */
export async function clearOfflineDatabase(): Promise<void> {
  try {
    Dexie.delete('HarrysFieldAssistantDB').catch(() => {});
    await Promise.all([
      db.clients.clear(),
      db.quotes.clear(),
      db.invoices.clear(),
      db.inventory.clear(),
      db.expenses.clear(),
      db.receiptScans.clear(),
      db.voiceNotes.clear(),
      db.complianceDocs.clear(),
    ]);
    console.log('[Dexie DB] All offline tables successfully cleared.');
  } catch (err) {
    console.warn('[Dexie DB] Failed to clear offline tables:', err);
  }
}
