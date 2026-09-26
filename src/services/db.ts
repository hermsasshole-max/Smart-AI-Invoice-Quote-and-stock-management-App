import Dexie, { Table } from 'dexie';
import {
  Client,
  Quotation,
  Invoice,
  InventoryItem,
  Expense,
  FinancialRecord,
  BusinessProfile,
  LocalBackupPayload,
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

export interface DbStockItem extends InventoryItem {
  currentStock?: number;
  minStockAlert?: number;
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

export interface DbProfileRecord {
  id: string; // 'main'
  profile: BusinessProfile;
  updatedAt: string;
}

/**
 * Offline-first IndexedDB Database Architecture
 * High capacity, durable, local-only client storage.
 * Completely eliminates 5MB localStorage limits and cloud dependency.
 */
export class FieldAssistantDatabase extends Dexie {
  clients!: Table<DbClient, string>;
  stock!: Table<DbStockItem, string>;
  quotations!: Table<DbQuotation, string>;
  invoices!: Table<DbInvoice, string>;
  financial_records!: Table<FinancialRecord, string>;
  business_profile!: Table<DbProfileRecord, string>;
  expenses!: Table<DbExpense, string>;
  receiptScans!: Table<DbReceiptScan, string>;
  voiceNotes!: Table<DbVoiceNote, string>;
  complianceDocs!: Table<DbComplianceDoc, string>;

  // Legacy table backward-compatibility aliases
  get inventory(): Table<DbStockItem, string> {
    return this.stock;
  }
  get quotes(): Table<DbQuotation, string> {
    return this.quotations;
  }

  constructor() {
    super('CorTechLocalDB');

    // Version 1: Initial schema
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

    // Version 2: Standardized local offline object stores matching exact user requirements
    this.version(2).stores({
      clients: 'id, name, phone, email, address, taxVatNumber',
      stock: 'id, sku, description, unitCost, markupPct, sellingPrice, quantityOnHand, minAlertLevel, category',
      quotations: 'id, quoteNumber, clientId, clientName, status, date, expiryDate',
      invoices: 'id, invoiceNumber, quoteId, clientId, clientName, status, date, dueDate',
      financial_records: 'id, date, type, category, amount, linkedInvoiceRef',
      business_profile: 'id',
      expenses: 'id, date, supplier, category, paymentMethod, relatedJobId',
      receiptScans: 'id, date, supplierName, invoiceNumber, processed',
      voiceNotes: 'id, date, status',
      complianceDocs: 'id, docType, docNumber, clientId, date, status',
    }).upgrade(async (trans) => {
      // Migrate legacy tables if upgrading from v1
      try {
        const legacyQuotes = await trans.table('quotes').toArray();
        if (legacyQuotes.length > 0) {
          await trans.table('quotations').bulkPut(legacyQuotes);
        }
      } catch {
        // Table might not exist yet
      }
      try {
        const legacyInventory = await trans.table('inventory').toArray();
        if (legacyInventory.length > 0) {
          const mapped = legacyInventory.map((item: any) => ({
            ...item,
            description: item.description || item.name || '',
            unitCost: item.unitCost ?? item.costPrice ?? 0,
            markupPct: item.markupPct ?? item.defaultMarkup ?? 30,
            quantityOnHand: item.quantityOnHand ?? item.stockQty ?? item.currentStock ?? 0,
            minAlertLevel: item.minAlertLevel ?? item.minStockLevel ?? item.minStockAlert ?? 5,
          }));
          await trans.table('stock').bulkPut(mapped);
        }
      } catch {
        // Table might not exist yet
      }
    });
  }
}

export const db = new FieldAssistantDatabase();

/**
 * Initialize offline database safely and open IndexedDB
 */
export async function initializeOfflineDatabase(): Promise<void> {
  try {
    // Delete legacy demo IndexedDB databases if present
    Dexie.delete('HarrysFieldAssistantDB').catch(() => {});
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
      db.stock.clear(),
      db.quotations.clear(),
      db.invoices.clear(),
      db.financial_records.clear(),
      db.business_profile.clear(),
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

/**
 * Get record counts for all local IndexedDB object stores
 */
export async function getLocalDatabaseStats(): Promise<{
  clients: number;
  stock: number;
  quotations: number;
  invoices: number;
  financial_records: number;
  expenses: number;
  estimatedBytes?: number;
}> {
  try {
    const [clients, stock, quotations, invoices, financial_records, expenses] = await Promise.all([
      db.clients.count(),
      db.stock.count(),
      db.quotations.count(),
      db.invoices.count(),
      db.financial_records.count(),
      db.expenses.count(),
    ]);

    let estimatedBytes = 0;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      estimatedBytes = estimate.usage || 0;
    }

    return {
      clients,
      stock,
      quotations,
      invoices,
      financial_records,
      expenses,
      estimatedBytes,
    };
  } catch (err) {
    console.warn('[Dexie DB] Error fetching stats:', err);
    return {
      clients: 0,
      stock: 0,
      quotations: 0,
      invoices: 0,
      financial_records: 0,
      expenses: 0,
    };
  }
}

/**
 * Export complete local database to formatted JSON and trigger device download
 */
export async function exportLocalBackup(): Promise<{ filename: string; size: number }> {
  const [clients, stock, quotations, invoices, financial_records, expenses, profileRecord] =
    await Promise.all([
      db.clients.toArray(),
      db.stock.toArray(),
      db.quotations.toArray(),
      db.invoices.toArray(),
      db.financial_records.toArray(),
      db.expenses.toArray(),
      db.business_profile.get('main'),
    ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `cortech_backup_${timestamp.slice(0, 10)}_${timestamp.slice(11, 19)}.json`;

  const payload: LocalBackupPayload = {
    app: 'CorTech AI Business Manager',
    version: '2.0.0',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    recordCounts: {
      clients: clients.length,
      stock: stock.length,
      quotations: quotations.length,
      invoices: invoices.length,
      financial_records: financial_records.length,
      expenses: expenses.length,
    },
    data: {
      profile: profileRecord?.profile,
      clients,
      stock,
      quotations,
      invoices,
      financial_records,
      expenses,
    },
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Trigger browser or Android WebView download directly to device storage
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { filename, size: blob.size };
}

/**
 * Import and restore local backup from JSON file into IndexedDB
 */
export async function importLocalBackup(jsonString: string): Promise<{
  success: boolean;
  message: string;
  recordCounts: LocalBackupPayload['recordCounts'];
}> {
  try {
    const parsed = JSON.parse(jsonString);

    // Support both standardized LocalBackupPayload and raw array dumps
    const data = parsed.data || parsed;
    const clients: Client[] = Array.isArray(data.clients) ? data.clients : [];
    const stock: InventoryItem[] = Array.isArray(data.stock)
      ? data.stock
      : Array.isArray(data.inventory)
      ? data.inventory
      : [];
    const quotations: Quotation[] = Array.isArray(data.quotations)
      ? data.quotations
      : Array.isArray(data.quotes)
      ? data.quotes
      : [];
    const invoices: Invoice[] = Array.isArray(data.invoices) ? data.invoices : [];
    const financial_records: FinancialRecord[] = Array.isArray(data.financial_records)
      ? data.financial_records
      : [];
    const expenses: Expense[] = Array.isArray(data.expenses) ? data.expenses : [];
    const profile: BusinessProfile | undefined = data.profile;

    // Normalize stock items so both naming conventions are supported
    const normalizedStock = stock.map((item: any) => ({
      ...item,
      description: item.description || item.name || '',
      name: item.name || item.description || '',
      unitCost: item.unitCost ?? item.costPrice ?? 0,
      costPrice: item.costPrice ?? item.unitCost ?? 0,
      markupPct: item.markupPct ?? item.defaultMarkup ?? 30,
      defaultMarkup: item.defaultMarkup ?? item.markupPct ?? 30,
      quantityOnHand: item.quantityOnHand ?? item.stockQty ?? item.currentStock ?? 0,
      stockQty: item.stockQty ?? item.quantityOnHand ?? item.currentStock ?? 0,
      minAlertLevel: item.minAlertLevel ?? item.minStockLevel ?? item.minStockAlert ?? 5,
      minStockLevel: item.minStockLevel ?? item.minAlertLevel ?? item.minStockAlert ?? 5,
    }));

    // Perform atomic transaction over all IndexedDB tables
    await db.transaction(
      'rw',
      [
        db.clients,
        db.stock,
        db.quotations,
        db.invoices,
        db.financial_records,
        db.expenses,
        db.business_profile,
      ],
      async () => {
        await Promise.all([
          db.clients.clear(),
          db.stock.clear(),
          db.quotations.clear(),
          db.invoices.clear(),
          db.financial_records.clear(),
          db.expenses.clear(),
        ]);

        if (clients.length > 0) await db.clients.bulkPut(clients);
        if (normalizedStock.length > 0) await db.stock.bulkPut(normalizedStock);
        if (quotations.length > 0) await db.quotations.bulkPut(quotations);
        if (invoices.length > 0) await db.invoices.bulkPut(invoices);
        if (financial_records.length > 0) await db.financial_records.bulkPut(financial_records);
        if (expenses.length > 0) await db.expenses.bulkPut(expenses);

        if (profile) {
          await db.business_profile.put({
            id: 'main',
            profile,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    );

    const counts = {
      clients: clients.length,
      stock: normalizedStock.length,
      quotations: quotations.length,
      invoices: invoices.length,
      financial_records: financial_records.length,
      expenses: expenses.length,
    };

    return {
      success: true,
      message: `Restored ${clients.length} clients, ${normalizedStock.length} stock items, ${quotations.length} quotes, and ${invoices.length} invoices.`,
      recordCounts: counts,
    };
  } catch (err: any) {
    console.error('[Dexie DB] Failed to import backup:', err);
    throw new Error(err.message || 'Invalid backup file format');
  }
}
