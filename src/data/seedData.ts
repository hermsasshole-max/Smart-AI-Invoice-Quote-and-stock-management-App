import { BusinessProfile, Client, InventoryItem, Quotation, Invoice, Expense } from '../types';

export const initialBusinessProfile: BusinessProfile = {
  companyName: '',
  tagline: '',
  regNumber: '',
  vatNumber: '',
  phone: '',
  email: '',
  address: '',
  website: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  branchCode: '',
  accountType: 'Business Current Account',
  defaultLabourRate: 0,
  defaultCalloutFee: 0,
  defaultTravelRate: 0,
  defaultMarkup: 30,
  vatEnabled: false,
  vatPercentage: 15,
  sansComplianceNotice: '',
  sunlightMode: false,
};

export const initialClients: Client[] = [];
export const initialInventory: InventoryItem[] = [];
export const initialQuotes: Quotation[] = [];
export const initialInvoices: Invoice[] = [];
export const initialExpenses: Expense[] = [];
