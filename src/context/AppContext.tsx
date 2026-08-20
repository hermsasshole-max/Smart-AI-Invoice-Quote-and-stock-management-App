import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BusinessProfile,
  InventoryItem,
  Client,
  Quotation,
  Invoice,
  Job,
  ScannedInvoiceResult,
  ScannedSupplierItem,
  ServiceCategory,
} from '../types';
import {
  defaultBusinessProfile,
  initialInventory,
  initialClients,
  initialQuotations,
  initialInvoices,
  initialJobs,
} from '../data/seedData';
import { calculateSellingPrice, calculateMarkupPct } from '../utils/calculator';

interface AppContextType {
  // Navigation & UI
  activeTab: 'dashboard' | 'quotes' | 'invoices' | 'scanner' | 'inventory' | 'clients' | 'schema' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'quotes' | 'invoices' | 'scanner' | 'inventory' | 'clients' | 'schema' | 'settings') => void;
  sunlightMode: boolean;
  setSunlightMode: (val: boolean | ((prev: boolean) => boolean)) => void;

  // Profile & Rates
  profile: BusinessProfile;
  updateProfile: (updated: Partial<BusinessProfile>) => void;
  updateRates: (updatedRates: Partial<BusinessProfile['rates']>) => void;

  // Inventory
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => InventoryItem;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  adjustStockOnHand: (id: string, deltaQty: number) => void;
  updateCanisterWeight: (id: string, weightKg: number) => void;
  lowStockItems: InventoryItem[];

  // Clients
  clients: Client[];
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Client;
  updateClient: (id: string, client: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Quotations
  quotations: Quotation[];
  createQuotation: (quote: Omit<Quotation, 'id' | 'createdAt'>) => Quotation;
  updateQuotation: (id: string, quote: Partial<Quotation>) => void;
  deleteQuotation: (id: string) => void;
  convertQuoteToJob: (quoteId: string) => Job;
  convertQuoteToInvoice: (quoteId: string) => Invoice;

  // Jobs
  jobs: Job[];
  createJob: (job: Omit<Job, 'id' | 'createdAt'>) => Job;
  updateJob: (id: string, job: Partial<Job>) => void;
  completeJobAndDeductStock: (jobId: string) => void;

  // Invoices
  invoices: Invoice[];
  createInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>, deductStock?: boolean) => Invoice;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  markInvoicePaid: (id: string, paymentMethod?: 'EFT' | 'Cash' | 'Card' | 'Instant EFT') => void;
  deleteInvoice: (id: string) => void;

  // AI OCR Scanner & Auto-Inventory
  applyScannedInvoiceToInventory: (scannedResult: ScannedInvoiceResult) => { updatedCount: number; createdCount: number };

  // Data management / Backup
  exportDataJSON: () => string;
  importDataJSON: (jsonStr: string) => boolean;
  resetToFactoryDefaults: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PROFILE: 'harrys_profile_v1',
  INVENTORY: 'harrys_inventory_v1',
  CLIENTS: 'harrys_clients_v1',
  QUOTES: 'harrys_quotes_v1',
  INVOICES: 'harrys_invoices_v1',
  JOBS: 'harrys_jobs_v1',
  SUNLIGHT: 'harrys_sunlight_mode',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'quotes' | 'invoices' | 'scanner' | 'inventory' | 'clients' | 'schema' | 'settings'>('dashboard');

  const [sunlightMode, setSunlightMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUNLIGHT);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [profile, setProfile] = useState<BusinessProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return saved ? JSON.parse(saved) : defaultBusinessProfile;
    } catch {
      return defaultBusinessProfile;
    }
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      return saved ? JSON.parse(saved) : initialInventory;
    } catch {
      return initialInventory;
    }
  });

  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      return saved ? JSON.parse(saved) : initialClients;
    } catch {
      return initialClients;
    }
  });

  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QUOTES);
      return saved ? JSON.parse(saved) : initialQuotations;
    } catch {
      return initialQuotations;
    }
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INVOICES);
      return saved ? JSON.parse(saved) : initialInvoices;
    } catch {
      return initialInvoices;
    }
  });

  const [jobs, setJobs] = useState<Job[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.JOBS);
      return saved ? JSON.parse(saved) : initialJobs;
    } catch {
      return initialJobs;
    }
  });

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUNLIGHT, JSON.stringify(sunlightMode));
  }, [sunlightMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(quotations));
  }, [quotations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  }, [jobs]);

  // Profile methods
  const updateProfile = (updated: Partial<BusinessProfile>) => {
    setProfile((prev) => ({ ...prev, ...updated }));
  };

  const updateRates = (updatedRates: Partial<BusinessProfile['rates']>) => {
    setProfile((prev) => ({
      ...prev,
      rates: { ...prev.rates, ...updatedRates },
    }));
  };

  // Inventory methods
  const addInventoryItem = (itemData: Omit<InventoryItem, 'id' | 'lastUpdated'>): InventoryItem => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    setInventory((prev) => [newItem, ...prev]);
    return newItem;
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const costPrice = updates.costPrice ?? item.costPrice;
          const markupPct = updates.markupPct ?? item.markupPct;
          const sellingPrice =
            updates.sellingPrice !== undefined
              ? updates.sellingPrice
              : calculateSellingPrice(costPrice, markupPct);

          return {
            ...item,
            ...updates,
            costPrice,
            markupPct,
            sellingPrice,
            lastUpdated: new Date().toISOString().split('T')[0],
          };
        }
        return item;
      })
    );
  };

  const deleteInventoryItem = (id: string) => {
    setInventory((prev) => prev.filter((i) => i.id !== id));
  };

  const adjustStockOnHand = (id: string, deltaQty: number) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, Number((item.stockOnHand + deltaQty).toFixed(2)));
          return { ...item, stockOnHand: newQty, lastUpdated: new Date().toISOString().split('T')[0] };
        }
        return item;
      })
    );
  };

  const updateCanisterWeight = (id: string, weightKg: number) => {
    setInventory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, canisterWeightKg: weightKg } : item))
    );
  };

  const lowStockItems = inventory.filter((item) => item.stockOnHand <= item.minStockAlert);

  // Clients methods
  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setClients((prev) => [newClient, ...prev]);
    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  // Quotations methods
  const createQuotation = (quoteData: Omit<Quotation, 'id' | 'createdAt'>): Quotation => {
    const newQuote: Quotation = {
      ...quoteData,
      id: `q-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setQuotations((prev) => [newQuote, ...prev]);
    return newQuote;
  };

  const updateQuotation = (id: string, updates: Partial<Quotation>) => {
    setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const deleteQuotation = (id: string) => {
    setQuotations((prev) => prev.filter((q) => q.id !== id));
  };

  const convertQuoteToJob = (quoteId: string): Job => {
    const quote = quotations.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quote not found');

    const newJob: Job = {
      id: `job-${Date.now()}`,
      jobNumber: `JOB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      quoteId: quote.id,
      clientId: quote.clientId,
      clientName: quote.clientName,
      clientPhone: quote.clientPhone,
      clientAddress: quote.clientAddress,
      title: `${quote.serviceType} Execution - ${quote.clientName}`,
      serviceType: quote.serviceType,
      status: 'in_progress',
      scheduledDate: new Date().toISOString().split('T')[0],
      allocatedItems: quote.items,
      notes: quote.notes,
      createdAt: new Date().toISOString().split('T')[0],
    };

    // Update quote status to accepted
    updateQuotation(quoteId, { status: 'accepted' });
    setJobs((prev) => [newJob, ...prev]);
    return newJob;
  };

  const convertQuoteToInvoice = (quoteId: string): Invoice => {
    const quote = quotations.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quote not found');

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      quoteId: quote.id,
      clientId: quote.clientId,
      clientName: quote.clientName,
      clientPhone: quote.clientPhone,
      clientEmail: quote.clientEmail,
      clientAddress: quote.clientAddress,
      serviceType: quote.serviceType,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: quote.items,
      calloutFee: quote.calloutFee,
      labourTotal: quote.labourTotal,
      travelTotal: quote.travelTotal,
      materialsTotal: quote.materialsTotal,
      subtotal: quote.subtotal,
      vatEnabled: quote.vatEnabled,
      vatRate: quote.vatRate,
      vatAmount: quote.vatAmount,
      totalAmount: quote.totalAmount,
      amountPaid: 0,
      status: 'issued',
      notes: quote.notes,
      createdAt: new Date().toISOString().split('T')[0],
    };

    // Auto-deduct materials from inventory
    quote.items.forEach((lineItem) => {
      if (lineItem.inventoryId && lineItem.quantity > 0) {
        adjustStockOnHand(lineItem.inventoryId, -lineItem.quantity);
      }
    });

    updateQuotation(quoteId, { status: 'converted' });
    setInvoices((prev) => [newInvoice, ...prev]);
    return newInvoice;
  };

  // Jobs methods
  const createJob = (jobData: Omit<Job, 'id' | 'createdAt'>): Job => {
    const newJob: Job = {
      ...jobData,
      id: `job-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setJobs((prev) => [newJob, ...prev]);
    return newJob;
  };

  const updateJob = (id: string, updates: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  };

  const completeJobAndDeductStock = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    // Deduct stock for all items
    job.allocatedItems.forEach((item) => {
      if (item.inventoryId && item.quantity > 0) {
        adjustStockOnHand(item.inventoryId, -item.quantity);
      }
    });

    updateJob(jobId, {
      status: 'completed',
      completedDate: new Date().toISOString().split('T')[0],
    });
  };

  // Invoices methods
  const createInvoice = (invoiceData: Omit<Invoice, 'id' | 'createdAt'>, deductStock = true): Invoice => {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (deductStock) {
      invoiceData.items.forEach((item) => {
        if (item.inventoryId && item.quantity > 0) {
          adjustStockOnHand(item.inventoryId, -item.quantity);
        }
      });
    }

    setInvoices((prev) => [newInvoice, ...prev]);
    return newInvoice;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)));
  };

  const markInvoicePaid = (id: string, paymentMethod: 'EFT' | 'Cash' | 'Card' | 'Instant EFT' = 'EFT') => {
    const invoice = invoices.find((inv) => inv.id === id);
    if (!invoice) return;

    updateInvoice(id, {
      status: 'paid',
      amountPaid: invoice.totalAmount,
      paymentMethod,
      paidDate: new Date().toISOString().split('T')[0],
    });
  };

  const deleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  // Auto Inventory Logic from Scanned Supplier Invoices
  const applyScannedInvoiceToInventory = (scannedResult: ScannedInvoiceResult) => {
    let updatedCount = 0;
    let createdCount = 0;

    scannedResult.items.forEach((scannedItem) => {
      if (scannedItem.action === 'skip') return;

      if (scannedItem.matchedItemId) {
        // Item exists in inventory -> update stock on hand and cost price
        const existing = inventory.find((i) => i.id === scannedItem.matchedItemId);
        if (existing) {
          const newCostPrice = scannedItem.unitCostPrice || existing.costPrice;
          const newSellingPrice = calculateSellingPrice(newCostPrice, existing.markupPct);
          const newStock = existing.stockOnHand + (scannedItem.quantity || 0);

          updateInventoryItem(existing.id, {
            costPrice: newCostPrice,
            sellingPrice: newSellingPrice,
            stockOnHand: newStock,
            supplierRef: scannedResult.supplierName || existing.supplierRef,
          });
          updatedCount++;
        }
      } else if (scannedItem.action === 'create_new') {
        // Item does not exist -> create new item in inventory catalog
        const markup = profile.rates.defaultMaterialMarkupPct || 30;
        const sellingPrice = scannedItem.newSellingPrice || calculateSellingPrice(scannedItem.unitCostPrice, markup);

        addInventoryItem({
          sku: scannedItem.sku || `SKU-${Math.floor(10000 + Math.random() * 90000)}`,
          description: scannedItem.description,
          category: scannedItem.category || 'Electrical',
          unit: (scannedItem.unit as any) || 'ea',
          costPrice: scannedItem.unitCostPrice,
          markupPct: markup,
          sellingPrice: sellingPrice,
          stockOnHand: scannedItem.quantity || 1,
          minStockAlert: 2,
          supplierRef: scannedResult.supplierName,
        });
        createdCount++;
      }
    });

    return { updatedCount, createdCount };
  };

  // Backup & Import
  const exportDataJSON = (): string => {
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      profile,
      inventory,
      clients,
      quotations,
      invoices,
      jobs,
    };
    return JSON.stringify(backup, null, 2);
  };

  const importDataJSON = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.profile) setProfile(data.profile);
      if (data.inventory) setInventory(data.inventory);
      if (data.clients) setClients(data.clients);
      if (data.quotations) setQuotations(data.quotations);
      if (data.invoices) setInvoices(data.invoices);
      if (data.jobs) setJobs(data.jobs);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  };

  const resetToFactoryDefaults = () => {
    setProfile(defaultBusinessProfile);
    setInventory(initialInventory);
    setClients(initialClients);
    setQuotations(initialQuotations);
    setInvoices(initialInvoices);
    setJobs(initialJobs);
    localStorage.clear();
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        sunlightMode,
        setSunlightMode,
        profile,
        updateProfile,
        updateRates,
        inventory,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        adjustStockOnHand,
        updateCanisterWeight,
        lowStockItems,
        clients,
        addClient,
        updateClient,
        deleteClient,
        quotations,
        createQuotation,
        updateQuotation,
        deleteQuotation,
        convertQuoteToJob,
        convertQuoteToInvoice,
        jobs,
        createJob,
        updateJob,
        completeJobAndDeductStock,
        invoices,
        createInvoice,
        updateInvoice,
        markInvoicePaid,
        deleteInvoice,
        applyScannedInvoiceToInventory,
        exportDataJSON,
        importDataJSON,
        resetToFactoryDefaults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
