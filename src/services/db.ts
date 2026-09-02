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
import {
  initialBusinessProfile,
  initialClients,
  initialInventory,
  initialQuotes,
  initialInvoices,
  initialExpenses,
} from '../data/seedData';

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
    super('HarrysFieldAssistantDB');
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
 * Initialize and seed IndexedDB if tables are empty
 */
export async function initializeOfflineDatabase(): Promise<void> {
  try {
    const clientCount = await db.clients.count();
    if (clientCount === 0) {
      console.log('[Dexie DB] Seeding initial offline data...');
      
      // Seed Clients
      const dbClients: DbClient[] = initialClients.map((c) => ({
        ...c,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      await db.clients.bulkAdd(dbClients);

      // Seed Inventory
      const dbInventory: DbInventoryItem[] = initialInventory.map((item) => ({
        ...item,
        currentStock: item.stockQty,
        minStockAlert: item.minStockLevel,
        lastSuppliedDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      await db.inventory.bulkAdd(dbInventory);

      // Seed Quotes
      const dbQuotes: DbQuotation[] = initialQuotes.map((q) => ({
        ...q,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      await db.quotes.bulkAdd(dbQuotes);

      // Seed Invoices
      const dbInvoices: DbInvoice[] = initialInvoices.map((inv) => ({
        ...inv,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      await db.invoices.bulkAdd(dbInvoices);

      // Seed Expenses
      const dbExpenses: DbExpense[] = initialExpenses.map((exp) => ({
        ...exp,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      await db.expenses.bulkAdd(dbExpenses);

      console.log('[Dexie DB] Database successfully populated with initial offline tables.');
    }
  } catch (err) {
    console.warn('[Dexie DB] Failed to initialize offline database:', err);
  }
}
