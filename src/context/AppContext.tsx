import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  BusinessProfile,
  Client,
  InventoryItem,
  Quotation,
  Invoice,
  InvoiceStatus,
} from '../types';
import {
  initialBusinessProfile,
  initialClients,
  initialInventory,
  initialQuotes,
  initialInvoices,
} from '../data/seedData';
import { debugLogger } from '../utils/debugLogger';
import { billingService, CachedEntitlements, SubscriptionTier } from '../services/billingService';
import { entitlementManager } from '../services/EntitlementManager';

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
  recordPayment: (invoiceId: string, amount: number, method: 'EFT' | 'Cash' | 'Card' | 'Instant EFT', reference?: string) => void;
  revertInvoicePayment: (
    invoiceId: string,
    options?: {
      keepDepositOnly?: boolean;
      newAmountPaid?: number;
      newStatus?: InvoiceStatus;
    }
  ) => Invoice | null;
  sunlightMode: boolean;
  toggleSunlightMode: () => void;
  resetToSampleData: () => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Billing & Paywall State
  const [entitlements, setEntitlements] = useState<CachedEntitlements>(() => billingService.getCachedEntitlements());
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>(undefined);

  const refreshEntitlements = useCallback(async () => {
    const updated = await billingService.syncWithServer();
    setEntitlements(updated);
  }, []);

  useEffect(() => {
    // Initial online sync
    refreshEntitlements();

    // Subscribe to EntitlementManager client updates
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
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      debugLogger.log({
        level: 'state',
        category: 'STATE_PROFILE_UPDATE',
        message: `Business Profile updated: ${Object.keys(updates).join(', ')}`,
        data: updates,
      });
      return next;
    });
  };

  const toggleSunlightMode = () => {
    setSunlightMode((prev) => {
      const next = !prev;
      updateProfile({ sunlightMode: next });
      debugLogger.log({
        level: 'state',
        category: 'STATE_THEME_TOGGLE',
        message: `Sunlight mode toggled to: ${next ? 'HIGH-CONTRAST (Outdoor)' : 'STANDARD (Dark)'}`,
      });
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
    debugLogger.log({
      level: 'state',
      category: 'STATE_CLIENT_ADD',
      message: `New client added: "${newClient.name}" (${newClient.phone || 'No phone'})`,
      data: newClient,
    });
    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    debugLogger.log({
      level: 'state',
      category: 'STATE_CLIENT_UPDATE',
      message: `Client ${id} updated`,
      data: updates,
    });
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    debugLogger.log({
      level: 'state',
      category: 'STATE_CLIENT_DELETE',
      message: `Client ${id} deleted`,
    });
  };

  const addInventoryItem = (itemData: Omit<InventoryItem, 'id'>): InventoryItem => {
    const newItem: InventoryItem = {
      ...itemData,
      id: 'inv_' + Date.now(),
    };
    setInventory((prev) => [newItem, ...prev]);
    debugLogger.log({
      level: 'state',
      category: 'STATE_INVENTORY_ADD',
      message: `New stock item added: "${newItem.name}" (Qty: ${newItem.stockQty} ${newItem.unit})`,
      data: newItem,
    });
    return newItem;
  };

  const addBulkInventory = (itemsData: Omit<InventoryItem, 'id'>[]) => {
    const newItems = itemsData.map((data, index) => ({
      ...data,
      id: 'inv_bulk_' + Date.now() + '_' + index,
    }));
    setInventory((prev) => [...newItems, ...prev]);
    debugLogger.log({
      level: 'state',
      category: 'STATE_INVENTORY_BULK_ADD',
      message: `Bulk imported ${newItems.length} inventory items into local catalog`,
    });
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
    debugLogger.log({
      level: 'state',
      category: 'STATE_STOCK_DEDUCTION',
      message: `Deducted stock for ${itemsToDeduct.length} line items`,
      data: itemsToDeduct,
    });
  };

  const addQuote = (quoteData: Omit<Quotation, 'id'>): Quotation => {
    const newQuote: Quotation = {
      ...quoteData,
      id: 'q_' + Date.now(),
    };
    setQuotes((prev) => [newQuote, ...prev]);
    entitlementManager.recordDocumentCreated();
    debugLogger.log({
      level: 'state',
      category: 'STATE_QUOTE_CREATED',
      message: `Quotation created: ${newQuote.quoteNumber} (R${newQuote.totalAmount.toLocaleString()}) for "${newQuote.clientName}"`,
      data: {
        quoteNumber: newQuote.quoteNumber,
        clientName: newQuote.clientName,
        total: newQuote.totalAmount,
        itemsCount: newQuote.items?.length,
      },
    });
    return newQuote;
  };

  const updateQuote = (id: string, updates: Partial<Quotation>) => {
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    debugLogger.log({
      level: 'state',
      category: 'STATE_QUOTE_UPDATED',
      message: `Quotation ${id} updated`,
      data: updates,
    });
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
    entitlementManager.recordDocumentCreated();
    debugLogger.log({
      level: 'state',
      category: 'STATE_INVOICE_CREATED',
      message: `Invoice created: ${newInvoice.invoiceNumber} (R${newInvoice.totalAmount.toLocaleString()}) for "${newInvoice.clientName}"`,
      data: {
        invoiceNumber: newInvoice.invoiceNumber,
        total: newInvoice.totalAmount,
        status: newInvoice.status,
      },
    });

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
      status: initialStatus,
      terms: quote.terms,
      payments,
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    updateQuote(quoteId, { status: 'invoiced' });
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

    let newInvoice: Invoice | null = null;
    if (depositData.autoConvertToInvoice) {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 101).padStart(4, '0')}`;
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
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: 'invoiced' } : q)));
    }

    return { quote: updatedQuote, invoice: newInvoice };
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

        resultInv = {
          ...inv,
          amountPaid: targetAmountPaid,
          status: targetStatus,
          payments: remainingPayments,
          isDepositPaid: options?.keepDepositOnly ? inv.isDepositPaid : false,
          depositAmountPaid: options?.keepDepositOnly ? inv.depositAmountPaid : 0,
        };

        debugLogger.log({
          level: 'state',
          category: 'STATE_INVOICE_PAYMENT_REVERTED',
          message: `Invoice ${inv.invoiceNumber} payment reverted from R${inv.amountPaid} to R${targetAmountPaid} (Status: ${targetStatus})`,
          data: {
            invoiceNumber: inv.invoiceNumber,
            oldAmountPaid: inv.amountPaid,
            newAmountPaid: targetAmountPaid,
            newStatus: targetStatus,
          },
        });

        return resultInv;
      })
    );
    return resultInv;
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
        recordPayment,
        revertInvoicePayment,
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
