import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BusinessProfile,
  Client,
  InventoryItem,
  Quotation,
  Invoice,
} from '../types';
import {
  initialBusinessProfile,
  initialClients,
  initialInventory,
  initialQuotes,
  initialInvoices,
} from '../data/seedData';

interface AppContextType {
  profile: BusinessProfile;
  updateProfile: (updates: Partial<BusinessProfile>) => void;
  clients: Client[];
  addClient: (client: Omit<Client, 'id'>) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => InventoryItem;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  deductStock: (items: { id?: string; sku?: string; quantity: number }[]) => void;
  quotes: Quotation[];
  addQuote: (quote: Omit<Quotation, 'id'>) => Quotation;
  updateQuote: (id: string, updates: Partial<Quotation>) => void;
  deleteQuote: (id: string) => void;
  convertQuoteToInvoice: (quoteId: string) => Invoice | null;
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id'>, deductStockItems?: boolean) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  recordPayment: (invoiceId: string, amount: number, method: 'EFT' | 'Cash' | 'Card' | 'Instant EFT', reference?: string) => void;
  sunlightMode: boolean;
  toggleSunlightMode: () => void;
  resetToSampleData: () => void;
  isInstallable: boolean;
  promptInstall: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
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
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  const [profile, setProfile] = useState<BusinessProfile>(() => {
    const saved = localStorage.getItem('harrys_profile');
    return saved ? JSON.parse(saved) : initialBusinessProfile;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('harrys_clients');
    return saved ? JSON.parse(saved) : initialClients;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('harrys_inventory');
    return saved ? JSON.parse(saved) : initialInventory;
  });

  const [quotes, setQuotes] = useState<Quotation[]>(() => {
    const saved = localStorage.getItem('harrys_quotes');
    return saved ? JSON.parse(saved) : initialQuotes;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('harrys_invoices');
    return saved ? JSON.parse(saved) : initialInvoices;
  });

  const [sunlightMode, setSunlightMode] = useState<boolean>(() => {
    return profile.sunlightMode || false;
  });

  useEffect(() => {
    localStorage.setItem('harrys_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('harrys_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('harrys_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('harrys_quotes', JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    localStorage.setItem('harrys_invoices', JSON.stringify(invoices));
  }, [invoices]);

  const updateProfile = (updates: Partial<BusinessProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const toggleSunlightMode = () => {
    setSunlightMode((prev) => {
      const next = !prev;
      updateProfile({ sunlightMode: next });
      return next;
    });
  };

  const addClient = (clientData: Omit<Client, 'id'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: 'c_' + Date.now(),
      totalBilled: 0,
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

  const addInventoryItem = (itemData: Omit<InventoryItem, 'id'>): InventoryItem => {
    const newItem: InventoryItem = {
      ...itemData,
      id: 'inv_' + Date.now(),
    };
    setInventory((prev) => [newItem, ...prev]);
    return newItem;
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const deleteInventoryItem = (id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  };

  const deductStock = (itemsToDeduct: { id?: string; sku?: string; quantity: number }[]) => {
    setInventory((prev) =>
      prev.map((invItem) => {
        const match = itemsToDeduct.find(
          (d) => (d.id && d.id === invItem.id) || (d.sku && d.sku.toLowerCase() === invItem.sku.toLowerCase())
        );
        if (match && match.quantity > 0) {
          const newQty = Math.max(0, invItem.stockQty - match.quantity);
          return { ...invItem, stockQty: newQty };
        }
        return invItem;
      })
    );
  };

  const addQuote = (quoteData: Omit<Quotation, 'id'>): Quotation => {
    const newQuote: Quotation = {
      ...quoteData,
      id: 'q_' + Date.now(),
    };
    setQuotes((prev) => [newQuote, ...prev]);
    return newQuote;
  };

  const updateQuote = (id: string, updates: Partial<Quotation>) => {
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const deleteQuote = (id: string) => {
    setQuotes((prev) => prev.filter((q) => q.id !== id));
  };

  const addInvoice = (invoiceData: Omit<Invoice, 'id'>, deductStockItems: boolean = false): Invoice => {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: 'inv_' + Date.now(),
    };
    setInvoices((prev) => [newInvoice, ...prev]);

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
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)));
  };

  const deleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  const convertQuoteToInvoice = (quoteId: string): Invoice | null => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return null;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 101).padStart(4, '0')}`;
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
      amountPaid: 0,
      status: 'issued',
      terms: quote.terms,
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    updateQuote(quoteId, { status: 'invoiced' });
    return newInvoice;
  };

  const recordPayment = (
    invoiceId: string,
    amount: number,
    method: 'EFT' | 'Cash' | 'Card' | 'Instant EFT',
    reference?: string
  ) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        const newPaid = Number((inv.amountPaid + amount).toFixed(2));
        const newStatus = newPaid >= inv.totalAmount ? 'paid' : 'partially_paid';
        const newPayment = {
          id: 'pay_' + Date.now(),
          date: new Date().toISOString().split('T')[0],
          amount,
          method,
          reference: reference || `REF-${Date.now().toString().slice(-4)}`,
        };
        return {
          ...inv,
          amountPaid: newPaid,
          status: newStatus,
          payments: [...(inv.payments || []), newPayment],
        };
      })
    );
  };

  const resetToSampleData = () => {
    setProfile(initialBusinessProfile);
    setClients(initialClients);
    setInventory(initialInventory);
    setQuotes(initialQuotes);
    setInvoices(initialInvoices);
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
        updateInventoryItem,
        deleteInventoryItem,
        deductStock,
        quotes,
        addQuote,
        updateQuote,
        deleteQuote,
        convertQuoteToInvoice,
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        recordPayment,
        sunlightMode,
        toggleSunlightMode,
        resetToSampleData,
        isInstallable,
        promptInstall,
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
