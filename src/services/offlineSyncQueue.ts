import { fetchWithRetry } from '../utils/apiClient';

export interface OfflineScannedReceipt {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  issueDate: string;
  monthKey: string;
  totalAmount: number;
  items: Array<{
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    code_barcode?: string;
    category?: string;
    unit?: string;
  }>;
  synced: boolean;
  createdAt: number;
  rawPayload?: any;
}

const STORAGE_KEY = 'harrys_offline_receipt_queue_v1';

class OfflineSyncQueue {
  private queue: OfflineScannedReceipt[] = [];
  private isSyncing = false;

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
    }
  }

  private loadQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[Offline Queue] Error reading queue from storage:', e);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('[Offline Queue] Error saving queue to storage:', e);
    }
  }

  /**
   * Save scanned invoice items directly to local storage failsafe queue
   */
  public enqueueScannedReceipt(receipt: {
    supplierName?: string;
    invoiceNumber?: string;
    issueDate?: string;
    monthKey?: string;
    totalAmount?: number;
    items?: Array<{
      item_name?: string;
      description?: string;
      quantity?: number;
      unit_price?: number;
      unitCost?: number;
      total_price?: number;
      total?: number;
      code_barcode?: string;
      category?: string;
      unit?: string;
    }>;
    rawPayload?: any;
  }): OfflineScannedReceipt {
    const issueDate = receipt.issueDate || new Date().toISOString().split('T')[0];
    const monthKey = receipt.monthKey || issueDate.substring(0, 7);

    const record: OfflineScannedReceipt = {
      id: 'rcpt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      supplierName: receipt.supplierName || 'Supplier Invoice',
      invoiceNumber: receipt.invoiceNumber || 'INV-' + Math.floor(100000 + Math.random() * 900000),
      issueDate,
      monthKey,
      totalAmount: receipt.totalAmount || 0,
      items: (receipt.items || []).map((it) => ({
        item_name: it.item_name || it.description || 'Materials Item',
        quantity: it.quantity || 1,
        unit_price: it.unit_price ?? it.unitCost ?? 0,
        total_price: it.total_price ?? it.total ?? ((it.quantity || 1) * (it.unit_price ?? it.unitCost ?? 0)),
        code_barcode: it.code_barcode,
        category: it.category,
        unit: it.unit,
      })),
      synced: false,
      createdAt: Date.now(),
      rawPayload: receipt.rawPayload,
    };

    this.queue.push(record);
    this.saveQueue();

    // Trigger non-blocking background sync
    this.processQueue().catch(() => {});

    return record;
  }

  /**
   * Get all cached scanned receipts (both synced and offline pending)
   */
  public getStoredReceipts(): OfflineScannedReceipt[] {
    this.loadQueue();
    return [...this.queue];
  }

  /**
   * Process and sync pending items to the database backend
   */
  public async processQueue(): Promise<void> {
    if (this.isSyncing) return;
    this.loadQueue();

    const pending = this.queue.filter((r) => !r.synced);
    if (pending.length === 0) return;

    this.isSyncing = true;
    try {
      for (const item of pending) {
        try {
          const res = await fetchWithRetry('/api/receipt-scans', {
            method: 'POST',
            body: JSON.stringify({
              supplier_name: item.supplierName,
              invoice_number: item.invoiceNumber,
              scan_date: item.issueDate,
              month_key: item.monthKey,
              total_amount: item.totalAmount,
              raw_ocr_json: item.rawPayload || item,
              processed: true,
            }),
            timeoutMs: 30000,
            retries: 2,
            silent: true,
          });

          if (res.ok) {
            item.synced = true;
            this.saveQueue();
          }
        } catch (itemErr) {
          console.warn('[Offline Queue] Background sync for item delayed:', itemErr);
          break; // Stop loop and try again later if connection drops
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

export const offlineSyncQueue = new OfflineSyncQueue();
