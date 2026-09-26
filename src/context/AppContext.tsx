import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  BusinessProfile,
  Client,
  InventoryItem,
  Quotation,
  Invoice,
  InvoiceStatus,
  Expense,
  FinancialRecord,
} from '../types';
import {
  initialBusinessProfile,
  initialClients,
  initialInventory,
  initialQuotes,
  initialInvoices,
  initialExpenses,
} from '../data/seedData';
import {
  db,
  initializeOfflineDatabase,
  clearOfflineDatabase,
  exportLocalBackup as dbExportBackup,
  importLocalBackup as dbImportBackup,
  getLocalDatabaseStats,
} from '../services/db';
import { debugLogger } from '../utils/debugLogger';
import { billingService, CachedEntitlements, SubscriptionTier } from '../services/billingService';
import { entitlementManager } from '../services/EntitlementManager';
import {
  calculateNextInvoiceNumber,
  calculateNextQuoteNumber,
  parseDocNumber,
  formatDocNumber,
} from '../utils/numbering';

interface DatabaseStats {
  clients: number;
  stock: number;
  quotations: number;
  invoices: number;
  financial_records: number;
  expenses: number;
  estimatedBytes?: number;
}

interface AppContextType {
  profile: BusinessProfile;
  updateProfile: (updates: Partial<BusinessProfile>) => void;
  clients: Client[];
  addClient: (client: Omit<Client, 'id'>) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => InventoryItem;
  addBulkInventory: (items: Omit<InventoryItem, 'id'>[]) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  deductStock: (items: { id?: string; sku?: string; quantity: number }[]) => void;
  quotes: Quotation[];
  addQuote: (quote: Omit<Quotation, 'id'>) => Quotation;
  updateQuote: (id: string, updates: Partial<Quotation>) => void;
  deleteQuote: (id: string) => void;
  recordQuoteDeposit: (
    quoteId: string,
    depositData: {
      amount: number;
      date?: string;
      method?: 'EFT' | 'Cash' | 'Card' | 'Instant EFT';
      reference?: string;
      autoConvertToInvoice?: boolean;
    }
  ) => { quote: Quotation; invoice?: Invoice | null };
  convertQuoteToInvoice: (quoteId: string) => Invoice | null;
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id'>, deductStockItems?: boolean) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  clearAllExpenses: () => void;
  financialRecords: FinancialRecord[];
  addFinancialRecord: (record: Omit<FinancialRecord, 'id'>) => FinancialRecord;
  deleteFinancialRecord: (id: string) => void;
  recordPayment: (
    invoiceId: string,
    amount: number,
    method: 'EFT' | 'Cash' | 'Card' | 'Instant EFT',
    reference?: string,
    date?: string,
    notes?: string
  ) => void;
  deleteInvoicePayment: (invoiceId: string, paymentId: string) => void;
  addBulkClients: (newClients: Omit<Client, 'id'>[]) => number;
  revertInvoicePayment: (
    invoiceId: string,
    options?: {
      keepDepositOnly?: boolean;
      newAmountPaid?: number;
      newStatus?: InvoiceStatus;
    }
  ) => Invoice | null;
  // Document Sequence & Numbering Controls
  getNextQuoteNumber: () => string;
  getNextInvoiceNumber: () => string;
  setNextQuoteNumber: (num: string) => void;
  setNextInvoiceNumber: (num: string) => void;
  syncSequenceFromDocument: (docNumber: string, docType: 'invoice' | 'quote') => void;
  updateQuoteNumber: (quoteId: string, newQuoteNumber: string) => void;
  updateInvoiceNumber: (invoiceId: string, newInvoiceNumber: string) => void;
  sunlightMode: boolean;
  toggleSunlightMode: () => void;
  resetToSampleData: () => Promise<void>;
  isInstallable: boolean;
  promptInstall: () => Promise<void>;
  // Monetization & Entitlements
  tier: SubscriptionTier;
  entitlements: CachedEntitlements;
  isPaywallOpen: boolean;
  paywallReason?: string;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  refreshEntitlements: () => Promise<void>;
  consumeAiCredit: () => void;
  // Local Offline IndexedDB & Backup Controls
  isDbReady: boolean;
  dbStats: DatabaseStats;
  refreshDbStats: () => Promise<void>;
  exportLocalBackup: () => Promise<{ filename: string; size: number }>;
  importLocalBackup: (jsonString: string) => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);

  // Billing & Paywall State
  const [entitlements, setEntitlements] = useState<CachedEntitlements>(() => billingService.getCachedEntitlements());
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>(undefined);

  // Core Reactive Business State (Directly backed by IndexedDB)
  const [profile, setProfile] = useState<BusinessProfile>(initialBusinessProfile);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [quotes, setQuotes] = useState<Quotation[]>(initialQuotes);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);

  const [dbStats, setDbStats] = useState<DatabaseStats>({
    clients: 0,
    stock: 0,
    quotations: 0,
    invoices: 0,
    financial_records: 0,
    expenses: 0,
  });

  const [sunlightMode, setSunlightMode] = useState<boolean>(false);
  const [customNextQuoteNumber, setCustomNextQuoteNumber] = useState<string>('');
  const [customNextInvoiceNumber, setCustomNextInvoiceNumber] = useState<string>('');

  const refreshDbStats = useCallback(async () => {
    try {
      const stats = await getLocalDatabaseStats();
      setDbStats(stats);
    } catch (e) {
      console.warn('[Dexie DB] Failed to fetch stats:', e);
    }
  }, []);

  // Initial Offline IndexedDB Load
  useEffect(() => {
    let isMounted = true;
    async function initIndexedDB() {
      try {
        await initializeOfflineDatabase();
        const [storedClients, storedStock, storedQuotes, storedInvoices, storedExpenses, storedFinRecords, profileRecord] =
          await Promise.all([
            db.clients.toArray(),
            db.stock.toArray(),
            db.quotations.toArray(),
            db.invoices.toArray(),
            db.expenses.toArray(),
            db.financial_records.toArray(),
            db.business_profile.get('main'),
          ]);

        if (isMounted) {
          if (storedClients.length > 0) setClients(storedClients);
          if (storedStock.length > 0) {
            setInventory(
              storedStock.map((s) => ({
                ...s,
                name: s.name || s.description || '',
                costPrice: s.costPrice ?? s.unitCost ?? 0,
                defaultMarkup: s.defaultMarkup ?? s.markupPct ?? 30,
                stockQty: s.stockQty ?? s.quantityOnHand ?? 0,
                minStockLevel: s.minStockLevel ?? s.minAlertLevel ?? 5,
              }))
            );
          }
          if (storedQuotes.length > 0) setQuotes(storedQuotes);
          if (storedInvoices.length > 0) setInvoices(storedInvoices);
          if (storedExpenses.length > 0) setExpenses(storedExpenses);
          if (storedFinRecords.length > 0) setFinancialRecords(storedFinRecords);

          if (profileRecord?.profile) {
            setProfile(profileRecord.profile);
            if (profileRecord.profile.sunlightMode !== undefined) {
              setSunlightMode(profileRecord.profile.sunlightMode);
            }
            if (profileRecord.profile.nextQuoteNumber) {
              setCustomNextQuoteNumber(profileRecord.profile.nextQuoteNumber);
            }
            if (profileRecord.profile.nextInvoiceNumber) {
              setCustomNextInvoiceNumber(profileRecord.profile.nextInvoiceNumber);
            }
          }

          setIsDbReady(true);
          refreshDbStats();
        }
      } catch (err) {
        console.error('[IndexedDB] Failed during bootstrap load:', err);
        if (isMounted) setIsDbReady(true);
      }
    }

    initIndexedDB();
    return () => {
      isMounted = false;
    };
  }, [refreshDbStats]);

  const refreshEntitlements = useCallback(async () => {
    const updated = await billingService.syncWithServer();
    setEntitlements(updated);
  }, []);

  useEffect(() => {
    refreshEntitlements();
    const unsubscribe = entitlementManager.subscribe(() => {
      setEntitlements(billingService.getCachedEntitlements());
    });
    return () => unsubscribe();
  }, [refreshEntitlements]);

  const openPaywall = (reason?: string) => {
    setPaywallReason(reason);
    setIsPaywallOpen(true);
  };

  const closePaywall = () => {
    setIsPaywallOpen(false);
    setPaywallReason(undefined);
  };

  const consumeAiCredit = () => {
    entitlementManager.consumeAiCreditLocal();
    setEntitlements(billingService.getCachedEntitlements());
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const getNextQuoteNumber = useCallback((): string => {
    return calculateNextQuoteNumber(quotes, customNextQuoteNumber, invoices);
  }, [quotes, customNextQuoteNumber, invoices]);

  const getNextInvoiceNumber = useCallback((): string => {
    return calculateNextInvoiceNumber(invoices, customNextInvoiceNumber, quotes);
  }, [invoices, customNextInvoiceNumber, quotes]);

  const setNextQuoteNumber = useCallback((num: string) => {
    const clean = num.trim();
    setCustomNextQuoteNumber(clean);
  }, []);

  const setNextInvoiceNumber = useCallback((num: string) => {
    const clean = num.trim();
    setCustomNextInvoiceNumber(clean);
  }, []);

  const syncSequenceFromDocument = useCallback(
    (docNumber: string, docType: 'invoice' | 'quote') => {
      if (!docNumber || !docNumber.trim()) return;
      const parsed = parseDocNumber(docNumber);
      const nextNum = parsed.number + 1;
      const currentYear = new Date().getFullYear();

      if (docType === 'invoice') {
        const nextInv = formatDocNumber(parsed.prefix || `INV-${currentYear}-`, nextNum, parsed.padLength || 4);
        setCustomNextInvoiceNumber(nextInv);

        const quotePrefix = profile.quotePrefix || `Q-${currentYear}-`;
        const nextQ = formatDocNumber(quotePrefix, nextNum, parsed.padLength || 4);
        setCustomNextQuoteNumber(nextQ);
      } else {
        const nextQ = formatDocNumber(parsed.prefix || `Q-${currentYear}-`, nextNum, parsed.padLength || 4);
        setCustomNextQuoteNumber(nextQ);

        const invPrefix = profile.invoicePrefix || `INV-${currentYear}-`;
        const nextInv = formatDocNumber(invPrefix, nextNum, parsed.padLength || 4);
        setCustomNextInvoiceNumber(nextInv);
      }
    },
    [profile.quotePrefix, profile.invoicePrefix]
  );

  const updateQuoteNumber = useCallback(
    (quoteId: string, newQuoteNumber: string) => {
      const trimmed = newQuoteNumber.trim();
      if (!trimmed) return;
      setQuotes((prev) =>
        prev.map((q) => {
          if (q.id === quoteId) {
            const updated = { ...q, quoteNumber: trimmed, updatedAt: new Date().toISOString() };
            db.quotations.put(updated).catch((e) => console.warn('[IndexedDB] update quote number err:', e));
            return updated;
          }
          return q;
        })
      );
      syncSequenceFromDocument(trimmed, 'quote');
    },
    [syncSequenceFromDocument]
  );

  const updateInvoiceNumber = useCallback(
    (invoiceId: string, newInvoiceNumber: string) => {
      const trimmed = newInvoiceNumber.trim();
      if (!trimmed) return;
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === invoiceId) {
            const updated = { ...inv, invoiceNumber: trimmed, updatedAt: new Date().toISOString() };
            db.invoices.put(updated).catch((e) => console.warn('[IndexedDB] update invoice number err:', e));
            return updated;
          }
          return inv;
        })
      );
      syncSequenceFromDocument(trimmed, 'invoice');
    },
    [syncSequenceFromDocument]
  );

  const updateProfile = (updates: Partial<BusinessProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      db.business_profile
        .put({
          id: 'main',
          profile: next,
          updatedAt: new Date().toISOString(),
        })
        .catch((e) => console.warn('[IndexedDB] update profile err:', e));
      return next;
    });
  };

  const toggleSunlightMode = () => {
    setSunlightMode((prev) => {
      const next = !prev;
      updateProfile({ sunlightMode: next });
      return next;
    });
  };

  // CLIENTS CRUD -> Wired directly to local IndexedDB
  const addBulkClients = (newClientsData: Omit<Client, 'id'>[]): number => {
    if (!newClientsData.length) return 0;

    const existingPhones = new Set(clients.map((c) => c.phone.replace(/[^0-9]/g, '')));
    const existingNames = new Set(clients.map((c) => c.name.trim().toLowerCase()));

    const now = new Date().toISOString();
    const clientsToAdd: Client[] = [];
    newClientsData.forEach((item, idx) => {
      const cleanPhone = (item.phone || '').replace(/[^0-9]/g, '');
      const cleanName = (item.name || '').trim().toLowerCase();

      if (cleanPhone && existingPhones.has(cleanPhone)) return;
      if (cleanName && existingNames.has(cleanName)) return;

      if (cleanPhone) existingPhones.add(cleanPhone);
      if (cleanName) existingNames.add(cleanName);

      clientsToAdd.push({
        ...item,
        id: 'c_' + (Date.now() + idx) + '_' + Math.random().toString(36).substring(2, 6),
        totalBilled: 0,
        createdAt: now,
        updatedAt: now,
      });
    });

    if (clientsToAdd.length > 0) {
      setClients((prev) => [...clientsToAdd, ...prev]);
      db.clients.bulkPut(clientsToAdd).catch((e) => console.warn('[IndexedDB] bulk clients err:', e));
      refreshDbStats();
    }

    return clientsToAdd.length;
  };

  const addClient = (clientData: Omit<Client, 'id'>): Client => {
    const now = new Date().toISOString();
    const newClient: Client = {
      ...clientData,
      id: 'c_' + Date.now(),
      totalBilled: 0,
      createdAt: now,
      updatedAt: now,
    };
    setClients((prev) => [newClient, ...prev]);
    db.clients.put(newClient).catch((e) => console.warn('[IndexedDB] add client err:', e));
    refreshDbStats();
    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
          db.clients.put(updated).catch((e) => console.warn('[IndexedDB] update client err:', e));
          return updated;
        }
        return c;
      })
    );
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    db.clients.delete(id).catch((e) => console.warn('[IndexedDB] delete client err:', e));
    refreshDbStats();
  };

  // STOCK / INVENTORY CRUD -> Wired directly to local IndexedDB
  const addInventoryItem = (itemData: Omit<InventoryItem, 'id'>): InventoryItem => {
    const now = new Date().toISOString();
    const newItem: InventoryItem = {
      ...itemData,
      id: 'inv_' + Date.now(),
      description: itemData.description || itemData.name,
      unitCost: itemData.unitCost ?? itemData.costPrice,
      markupPct: itemData.markupPct ?? itemData.defaultMarkup,
      quantityOnHand: itemData.quantityOnHand ?? itemData.stockQty,
      minAlertLevel: itemData.minAlertLevel ?? itemData.minStockLevel,
      createdAt: now,
      updatedAt: now,
    };
    setInventory((prev) => [newItem, ...prev]);
    db.stock.put(newItem).catch((e) => console.warn('[IndexedDB] add stock err:', e));
    refreshDbStats();
    return newItem;
  };

  const addBulkInventory = (itemsData: Omit<InventoryItem, 'id'>[]) => {
    const now = new Date().toISOString();
    const newItems = itemsData.map((data, index) => ({
      ...data,
      id: 'inv_bulk_' + Date.now() + '_' + index,
      description: data.description || data.name,
      unitCost: data.unitCost ?? data.costPrice,
      markupPct: data.markupPct ?? data.defaultMarkup,
      quantityOnHand: data.quantityOnHand ?? data.stockQty,
      minAlertLevel: data.minAlertLevel ?? data.minStockLevel,
      createdAt: now,
      updatedAt: now,
    }));
    setInventory((prev) => [...newItems, ...prev]);
    db.stock.bulkPut(newItems).catch((e) => console.warn('[IndexedDB] bulk stock err:', e));
    refreshDbStats();
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated: InventoryItem = {
            ...item,
            ...updates,
            description: updates.description ?? updates.name ?? item.description ?? item.name,
            unitCost: updates.unitCost ?? updates.costPrice ?? item.unitCost ?? item.costPrice,
            markupPct: updates.markupPct ?? updates.defaultMarkup ?? item.markupPct ?? item.defaultMarkup,
            quantityOnHand: updates.quantityOnHand ?? updates.stockQty ?? item.quantityOnHand ?? item.stockQty,
            minAlertLevel: updates.minAlertLevel ?? updates.minStockLevel ?? item.minAlertLevel ?? item.minStockLevel,
            updatedAt: new Date().toISOString(),
          };
          db.stock.put(updated).catch((e) => console.warn('[IndexedDB] update stock err:', e));
          return updated;
        }
        return item;
      })
    );
  };

  const deleteInventoryItem = (id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
    db.stock.delete(id).catch((e) => console.warn('[IndexedDB] delete stock err:', e));
    refreshDbStats();
  };

  const deductStock = (itemsToDeduct: { id?: string; sku?: string; quantity: number }[]) => {
    setInventory((prev) =>
      prev.map((invItem) => {
        const match = itemsToDeduct.find(
          (d) => (d.id && d.id === invItem.id) || (d.sku && d.sku.toLowerCase() === invItem.sku.toLowerCase())
        );
        if (match && match.quantity > 0) {
          const newQty = Math.max(0, invItem.stockQty - match.quantity);
          const updated: InventoryItem = {
            ...invItem,
            stockQty: newQty,
            quantityOnHand: newQty,
            updatedAt: new Date().toISOString(),
          };
          db.stock.put(updated).catch((e) => console.warn('[IndexedDB] deduct stock err:', e));
          return updated;
        }
        return invItem;
      })
    );
  };

  // QUOTATIONS CRUD -> Wired directly to local IndexedDB
  const addQuote = (quoteData: Omit<Quotation, 'id'>): Quotation => {
    const finalQuoteNumber = (quoteData.quoteNumber || '').trim() || getNextQuoteNumber();
    const now = new Date().toISOString();
    const newQuote: Quotation = {
      ...quoteData,
      quoteNumber: finalQuoteNumber,
      id: 'q_' + Date.now(),
    };
    setQuotes((prev) => [newQuote, ...prev]);
    db.quotations.put({ ...newQuote, createdAt: now, updatedAt: now }).catch((e) => console.warn('[IndexedDB] add quote err:', e));
    syncSequenceFromDocument(finalQuoteNumber, 'quote');
    entitlementManager.recordDocumentCreated();
    refreshDbStats();
    return newQuote;
  };

  const updateQuote = (id: string, updates: Partial<Quotation>) => {
    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id === id) {
          const updated = { ...q, ...updates, updatedAt: new Date().toISOString() };
          db.quotations.put(updated).catch((e) => console.warn('[IndexedDB] update quote err:', e));
          return updated;
        }
        return q;
      })
    );
    if (updates.quoteNumber && updates.quoteNumber.trim()) {
      syncSequenceFromDocument(updates.quoteNumber.trim(), 'quote');
    }
  };

  const deleteQuote = (id: string) => {
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    db.quotations.delete(id).catch((e) => console.warn('[IndexedDB] delete quote err:', e));
    refreshDbStats();
  };

  // INVOICES CRUD -> Wired directly to local IndexedDB
  const addInvoice = (invoiceData: Omit<Invoice, 'id'>, deductStockItems: boolean = false): Invoice => {
    const finalInvoiceNumber = (invoiceData.invoiceNumber || '').trim() || getNextInvoiceNumber();
    const now = new Date().toISOString();
    const paid = invoiceData.amountPaid || 0;
    const balance = Number(Math.max(0, invoiceData.totalAmount - paid).toFixed(2));
    const newInvoice: Invoice = {
      ...invoiceData,
      invoiceNumber: finalInvoiceNumber,
      id: 'inv_' + Date.now(),
      balanceDue: balance,
    };
    setInvoices((prev) => [newInvoice, ...prev]);
    db.invoices.put({ ...newInvoice, createdAt: now, updatedAt: now }).catch((e) => console.warn('[IndexedDB] add invoice err:', e));
    syncSequenceFromDocument(finalInvoiceNumber, 'invoice');
    entitlementManager.recordDocumentCreated();
    refreshDbStats();

    if (deductStockItems && invoiceData.items && invoiceData.items.length > 0) {
      const deductionList = invoiceData.items.map((item) => ({
        id: item.inventoryId,
        sku: item.notes,
        quantity: item.quantity,
      }));
      deductStock(deductionList);
    }

    return newInvoice;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === id) {
          const newTotal = updates.totalAmount ?? inv.totalAmount;
          const newPaid = updates.amountPaid ?? inv.amountPaid;
          const balance = Number(Math.max(0, newTotal - newPaid).toFixed(2));
          const updated: Invoice = {
            ...inv,
            ...updates,
            balanceDue: balance,
            updatedAt: new Date().toISOString(),
          };
          db.invoices.put(updated).catch((e) => console.warn('[IndexedDB] update invoice err:', e));
          return updated;
        }
        return inv;
      })
    );
    if (updates.invoiceNumber && updates.invoiceNumber.trim()) {
      syncSequenceFromDocument(updates.invoiceNumber.trim(), 'invoice');
    }
  };

  const deleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    db.invoices.delete(id).catch((e) => console.warn('[IndexedDB] delete invoice err:', e));
    refreshDbStats();
  };

  const convertQuoteToInvoice = (quoteId: string): Invoice | null => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return null;

    const invoiceNumber = getNextInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const depositPaid = quote.isDepositPaid && (quote.depositAmountPaid ?? 0) > 0 ? quote.depositAmountPaid! : 0;
    const initialStatus: InvoiceStatus = depositPaid >= quote.totalAmount ? 'paid' : depositPaid > 0 ? 'partially_paid' : 'issued';

    const payments = depositPaid > 0 ? [
      {
        id: 'pay_dep_' + Date.now(),
        date: quote.depositPaidDate || today,
        amount: depositPaid,
        method: quote.depositPaymentMethod || 'EFT',
        reference: quote.depositReference || `DEP-${quote.quoteNumber}`,
      }
    ] : [];

    const newInvoice: Invoice = {
      id: 'inv_' + Date.now(),
      invoiceNumber,
      quoteId: quote.id,
      date: today,
      dueDate,
      clientId: quote.clientId,
      clientName: quote.clientName,
      clientPhone: quote.clientPhone,
      clientEmail: quote.clientEmail,
      clientAddress: quote.clientAddress,
      serviceType: quote.serviceType,
      scopeOfWork: quote.scopeOfWork,
      items: quote.items,
      calloutFee: quote.calloutFee,
      labourHours: quote.labourHours,
      labourRatePerHour: quote.labourRatePerHour,
      labourTotal: quote.labourTotal,
      additionalLabourTotal: quote.additionalLabourTotal,
      travelDistanceKm: quote.travelDistanceKm,
      travelRatePerKm: quote.travelRatePerKm,
      travelTotal: quote.travelTotal,
      consumablesTier: quote.consumablesTier,
      consumablesFee: quote.consumablesFee,
      consumablesDescription: quote.consumablesDescription,
      miscellaneousDescription: quote.miscellaneousDescription,
      miscellaneousFee: quote.miscellaneousFee,
      subtotal: quote.subtotal,
      discountPct: quote.discountPct,
      discountAmount: quote.discountAmount,
      vatEnabled: quote.vatEnabled,
      vatAmount: quote.vatAmount,
      totalAmount: quote.totalAmount,
      depositPercentage: quote.depositPercentage,
      depositAmountPaid: depositPaid,
      isDepositPaid: quote.isDepositPaid || depositPaid > 0,
      depositPaidDate: quote.depositPaidDate,
      depositPaymentMethod: quote.depositPaymentMethod,
      depositReference: quote.depositReference,
      amountPaid: depositPaid,
      balanceDue: Number(Math.max(0, quote.totalAmount - depositPaid).toFixed(2)),
      status: initialStatus,
      terms: quote.terms,
      payments,
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    db.invoices.put(newInvoice).catch((e) => console.warn('[IndexedDB] invoice conversion err:', e));
    syncSequenceFromDocument(invoiceNumber, 'invoice');
    updateQuote(quoteId, { status: 'invoiced' });
    refreshDbStats();
    return newInvoice;
  };

  const recordQuoteDeposit = (
    quoteId: string,
    depositData: {
      amount: number;
      date?: string;
      method?: 'EFT' | 'Cash' | 'Card' | 'Instant EFT';
      reference?: string;
      autoConvertToInvoice?: boolean;
    }
  ): { quote: Quotation; invoice?: Invoice | null } => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quote not found');

    const today = new Date().toISOString().split('T')[0];
    const updatedQuoteData: Partial<Quotation> = {
      isDepositPaid: true,
      depositAmountPaid: depositData.amount,
      depositPaidDate: depositData.date || today,
      depositPaymentMethod: depositData.method || 'EFT',
      depositReference: depositData.reference || `DEP-${quote.quoteNumber}`,
      status: 'deposit_paid',
    };

    const updatedQuote: Quotation = {
      ...quote,
      ...updatedQuoteData,
    };

    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? updatedQuote : q)));
    db.quotations.put(updatedQuote).catch((e) => console.warn('[IndexedDB] deposit quote err:', e));

    let newInvoice: Invoice | null = null;
    if (depositData.autoConvertToInvoice) {
      const invoiceNumber = getNextInvoiceNumber();
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const initialStatus: InvoiceStatus = depositData.amount >= quote.totalAmount ? 'paid' : 'partially_paid';

      newInvoice = {
        id: 'inv_' + Date.now(),
        invoiceNumber,
        quoteId: quote.id,
        date: today,
        dueDate,
        clientId: quote.clientId,
        clientName: quote.clientName,
        clientPhone: quote.clientPhone,
        clientEmail: quote.clientEmail,
        clientAddress: quote.clientAddress,
        serviceType: quote.serviceType,
        scopeOfWork: quote.scopeOfWork,
        items: quote.items,
        calloutFee: quote.calloutFee,
        labourHours: quote.labourHours,
        labourRatePerHour: quote.labourRatePerHour,
        labourTotal: quote.labourTotal,
        additionalLabourTotal: quote.additionalLabourTotal,
        travelDistanceKm: quote.travelDistanceKm,
        travelRatePerKm: quote.travelRatePerKm,
        travelTotal: quote.travelTotal,
        consumablesTier: quote.consumablesTier,
        consumablesFee: quote.consumablesFee,
        consumablesDescription: quote.consumablesDescription,
        miscellaneousDescription: quote.miscellaneousDescription,
        miscellaneousFee: quote.miscellaneousFee,
        subtotal: quote.subtotal,
        discountPct: quote.discountPct,
        discountAmount: quote.discountAmount,
        vatEnabled: quote.vatEnabled,
        vatAmount: quote.vatAmount,
        totalAmount: quote.totalAmount,
        depositPercentage: quote.depositPercentage,
        depositAmountPaid: depositData.amount,
        isDepositPaid: true,
        depositPaidDate: depositData.date || today,
        depositPaymentMethod: depositData.method || 'EFT',
        depositReference: depositData.reference || `DEP-${quote.quoteNumber}`,
        amountPaid: depositData.amount,
        balanceDue: Number(Math.max(0, quote.totalAmount - depositData.amount).toFixed(2)),
        status: initialStatus,
        terms: quote.terms,
        payments: [
          {
            id: 'pay_dep_' + Date.now(),
            date: depositData.date || today,
            amount: depositData.amount,
            method: depositData.method || 'EFT',
            reference: depositData.reference || `DEP-${quote.quoteNumber}`,
          },
        ],
      };

      setInvoices((prev) => [newInvoice!, ...prev]);
      db.invoices.put(newInvoice!).catch((e) => console.warn('[IndexedDB] auto convert invoice err:', e));
      syncSequenceFromDocument(invoiceNumber, 'invoice');
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: 'invoiced' } : q)));
      refreshDbStats();
    }

    return { quote: updatedQuote, invoice: newInvoice };
  };

  const recordPayment = (
    invoiceId: string,
    amount: number,
    method: 'EFT' | 'Cash' | 'Card' | 'Instant EFT',
    reference?: string,
    date?: string,
    notes?: string
  ) => {
    const paymentDate = date || new Date().toISOString().split('T')[0];
    const newPaymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newPayment = {
      id: newPaymentId,
      date: paymentDate,
      amount,
      method,
      reference: reference || `REF-${Date.now().toString().slice(-4)}`,
      notes: notes || undefined,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        const newPaid = Number(((inv.amountPaid || 0) + amount).toFixed(2));
        const balance = Number(Math.max(0, inv.totalAmount - newPaid).toFixed(2));
        const newStatus: InvoiceStatus = newPaid >= inv.totalAmount && inv.totalAmount > 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'issued';
        const updatedInvoice: Invoice = {
          ...inv,
          amountPaid: newPaid,
          balanceDue: balance,
          status: newStatus,
          payments: [...(inv.payments || []), newPayment],
        };

        db.invoices.put(updatedInvoice).catch((e) => console.warn('[IndexedDB] record payment err:', e));

        // Create synchronized local financial record (Income)
        const finRecord: FinancialRecord = {
          id: 'fin_inc_' + newPaymentId,
          date: paymentDate,
          type: 'Income',
          category: inv.serviceType || 'Client Payment',
          amount,
          linkedInvoiceRef: inv.invoiceNumber,
          description: `Payment received for ${inv.invoiceNumber} (${inv.clientName})`,
          paymentMethod: method,
          notes: notes || reference,
          createdAt: new Date().toISOString(),
        };
        setFinancialRecords((fPrev) => [finRecord, ...fPrev]);
        db.financial_records.put(finRecord).catch((e) => console.warn('[IndexedDB] record income err:', e));
        refreshDbStats();

        return updatedInvoice;
      })
    );
  };

  const deleteInvoicePayment = (invoiceId: string, paymentId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        const updatedPayments = (inv.payments || []).filter((p) => p.id !== paymentId);
        const newPaid = Number(updatedPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
        const balance = Number(Math.max(0, inv.totalAmount - newPaid).toFixed(2));
        const newStatus: InvoiceStatus = newPaid >= inv.totalAmount && inv.totalAmount > 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'issued';

        const updatedInvoice: Invoice = {
          ...inv,
          amountPaid: newPaid,
          balanceDue: balance,
          status: newStatus,
          payments: updatedPayments,
        };

        db.invoices.put(updatedInvoice).catch((e) => console.warn('[IndexedDB] delete payment err:', e));

        // Remove linked financial record
        const finId = 'fin_inc_' + paymentId;
        setFinancialRecords((fPrev) => fPrev.filter((f) => f.id !== finId));
        db.financial_records.delete(finId).catch((e) => console.warn('[IndexedDB] delete fin income err:', e));
        refreshDbStats();

        return updatedInvoice;
      })
    );
  };

  const revertInvoicePayment = (
    invoiceId: string,
    options?: {
      keepDepositOnly?: boolean;
      newAmountPaid?: number;
      newStatus?: InvoiceStatus;
    }
  ): Invoice | null => {
    let resultInv: Invoice | null = null;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;

        let targetAmountPaid = 0;
        let targetStatus: InvoiceStatus = options?.newStatus || 'issued';
        let remainingPayments: NonNullable<Invoice['payments']> = [];

        if (options?.newAmountPaid !== undefined) {
          targetAmountPaid = Math.max(0, options.newAmountPaid);
          targetStatus =
            options?.newStatus ||
            (targetAmountPaid >= inv.totalAmount && inv.totalAmount > 0
              ? 'paid'
              : targetAmountPaid > 0
              ? 'partially_paid'
              : 'issued');
          remainingPayments = (inv.payments || []).filter((p) => p.amount <= targetAmountPaid);
        } else if (options?.keepDepositOnly && inv.depositAmountPaid && inv.depositAmountPaid > 0) {
          targetAmountPaid = inv.depositAmountPaid;
          targetStatus = 'partially_paid';
          remainingPayments = (inv.payments || []).filter(
            (p) =>
              p.reference?.includes('DEP-') ||
              p.id?.includes('dep') ||
              p.amount === inv.depositAmountPaid
          );
          if (remainingPayments.length === 0 && targetAmountPaid > 0) {
            remainingPayments = [
              {
                id: 'pay_dep_' + Date.now(),
                date: inv.depositPaidDate || inv.date,
                amount: targetAmountPaid,
                method: inv.depositPaymentMethod || 'EFT',
                reference: inv.depositReference || `DEP-KEEP`,
              },
            ];
          }
        } else {
          targetAmountPaid = 0;
          targetStatus = options?.newStatus || 'issued';
          remainingPayments = [];
        }

        const balance = Number(Math.max(0, inv.totalAmount - targetAmountPaid).toFixed(2));
        resultInv = {
          ...inv,
          amountPaid: targetAmountPaid,
          balanceDue: balance,
          status: targetStatus,
          payments: remainingPayments,
          isDepositPaid: options?.keepDepositOnly ? inv.isDepositPaid : false,
          depositAmountPaid: options?.keepDepositOnly ? inv.depositAmountPaid : 0,
        };

        db.invoices.put(resultInv).catch((e) => console.warn('[IndexedDB] revert payment err:', e));
        return resultInv;
      })
    );
    return resultInv;
  };

  // EXPENSES CRUD -> Wired directly to local IndexedDB
  const addExpense = (expenseData: Omit<Expense, 'id'>): Expense => {
    const now = new Date().toISOString();
    const newExpense: Expense = {
      ...expenseData,
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    db.expenses.put({ ...newExpense, createdAt: now, updatedAt: now }).catch((e) => console.warn('[IndexedDB] add expense err:', e));

    // Create synchronized local financial record (Expense)
    const finRecord: FinancialRecord = {
      id: 'fin_exp_' + newExpense.id,
      date: newExpense.date,
      type: 'Expense',
      category: newExpense.category,
      amount: newExpense.amount,
      linkedInvoiceRef: newExpense.linkedInvoiceNumber || newExpense.invoiceNumber,
      description: newExpense.description || `${newExpense.category} (${newExpense.supplier || 'Expense'})`,
      paymentMethod: newExpense.paymentMethod,
      notes: newExpense.notes,
      createdAt: now,
    };
    setFinancialRecords((fPrev) => [finRecord, ...fPrev]);
    db.financial_records.put(finRecord).catch((e) => console.warn('[IndexedDB] record expense fin err:', e));
    refreshDbStats();

    return newExpense;
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) =>
      prev.map((exp) => {
        if (exp.id === id) {
          const updated = { ...exp, ...updates, updatedAt: new Date().toISOString() };
          db.expenses.put(updated).catch((e) => console.warn('[IndexedDB] update expense err:', e));

          // Also update linked financial record if amount/date/category changed
          const finId = 'fin_exp_' + id;
          db.financial_records.get(finId).then((existing) => {
            if (existing) {
              const finUpdated: FinancialRecord = {
                ...existing,
                date: updates.date || existing.date,
                category: updates.category || existing.category,
                amount: updates.amount ?? existing.amount,
                description: updates.description || existing.description,
                notes: updates.notes ?? existing.notes,
                updatedAt: new Date().toISOString(),
              };
              db.financial_records.put(finUpdated).catch(() => {});
              setFinancialRecords((fPrev) => fPrev.map((f) => (f.id === finId ? finUpdated : f)));
            }
          }).catch(() => {});

          return updated;
        }
        return exp;
      })
    );
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((exp) => exp.id !== id));
    db.expenses.delete(id).catch((e) => console.warn('[IndexedDB] delete expense err:', e));
    const finId = 'fin_exp_' + id;
    setFinancialRecords((fPrev) => fPrev.filter((f) => f.id !== finId));
    db.financial_records.delete(finId).catch((e) => console.warn('[IndexedDB] delete expense fin err:', e));
    refreshDbStats();
  };

  const clearAllExpenses = () => {
    setExpenses([]);
    db.expenses.clear().catch((e) => console.warn('[IndexedDB] clear expenses err:', e));
    // Clear expense financial records
    db.financial_records.where('type').equals('Expense').delete().catch(() => {});
    setFinancialRecords((prev) => prev.filter((f) => f.type !== 'Expense'));
    refreshDbStats();
  };

  // FINANCIAL RECORDS CRUD
  const addFinancialRecord = (recordData: Omit<FinancialRecord, 'id'>): FinancialRecord => {
    const now = new Date().toISOString();
    const newRecord: FinancialRecord = {
      ...recordData,
      id: 'fin_rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: now,
      updatedAt: now,
    };
    setFinancialRecords((prev) => [newRecord, ...prev]);
    db.financial_records.put(newRecord).catch((e) => console.warn('[IndexedDB] add fin record err:', e));
    refreshDbStats();
    return newRecord;
  };

  const deleteFinancialRecord = (id: string) => {
    setFinancialRecords((prev) => prev.filter((r) => r.id !== id));
    db.financial_records.delete(id).catch((e) => console.warn('[IndexedDB] delete fin record err:', e));
    refreshDbStats();
  };

  // BACKUP & RESTORE -> Directly to/from device storage
  const exportLocalBackup = async (): Promise<{ filename: string; size: number }> => {
    return await dbExportBackup();
  };

  const importLocalBackup = async (
    jsonString: string
  ): Promise<{ success: boolean; message: string }> => {
    const result = await dbImportBackup(jsonString);

    // Refresh reactive state from restored IndexedDB tables
    const [storedClients, storedStock, storedQuotes, storedInvoices, storedExpenses, storedFinRecords, profileRecord] =
      await Promise.all([
        db.clients.toArray(),
        db.stock.toArray(),
        db.quotations.toArray(),
        db.invoices.toArray(),
        db.expenses.toArray(),
        db.financial_records.toArray(),
        db.business_profile.get('main'),
      ]);

    setClients(storedClients);
    setInventory(
      storedStock.map((s) => ({
        ...s,
        name: s.name || s.description || '',
        costPrice: s.costPrice ?? s.unitCost ?? 0,
        defaultMarkup: s.defaultMarkup ?? s.markupPct ?? 30,
        stockQty: s.stockQty ?? s.quantityOnHand ?? 0,
        minStockLevel: s.minStockLevel ?? s.minAlertLevel ?? 5,
      }))
    );
    setQuotes(storedQuotes);
    setInvoices(storedInvoices);
    setExpenses(storedExpenses);
    setFinancialRecords(storedFinRecords);
    if (profileRecord?.profile) {
      setProfile(profileRecord.profile);
    }
    await refreshDbStats();

    return {
      success: true,
      message: result.message,
    };
  };

  const resetToSampleData = async () => {
    setProfile(initialBusinessProfile);
    setClients([]);
    setInventory([]);
    setQuotes([]);
    setInvoices([]);
    setExpenses([]);
    setFinancialRecords([]);
    await clearOfflineDatabase();
    await refreshDbStats();
  };

  return (
    <AppContext.Provider
      value={{
        profile,
        updateProfile,
        clients,
        addClient,
        updateClient,
        deleteClient,
        inventory,
        addInventoryItem,
        addBulkInventory,
        updateInventoryItem,
        deleteInventoryItem,
        deductStock,
        quotes,
        addQuote,
        updateQuote,
        deleteQuote,
        recordQuoteDeposit,
        convertQuoteToInvoice,
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        clearAllExpenses,
        financialRecords,
        addFinancialRecord,
        deleteFinancialRecord,
        recordPayment,
        deleteInvoicePayment,
        addBulkClients,
        revertInvoicePayment,
        // Document Sequence & Numbering Controls
        getNextQuoteNumber,
        getNextInvoiceNumber,
        setNextQuoteNumber,
        setNextInvoiceNumber,
        syncSequenceFromDocument,
        updateQuoteNumber,
        updateInvoiceNumber,
        sunlightMode,
        toggleSunlightMode,
        resetToSampleData,
        isInstallable,
        promptInstall,
        tier: entitlements.tier,
        entitlements,
        isPaywallOpen,
        paywallReason,
        openPaywall,
        closePaywall,
        refreshEntitlements,
        consumeAiCredit,
        // Local Offline IndexedDB & Backup Controls
        isDbReady,
        dbStats,
        refreshDbStats,
        exportLocalBackup,
        importLocalBackup,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
