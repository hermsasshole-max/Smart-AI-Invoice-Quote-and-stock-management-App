import { BusinessProfile, Client, InventoryItem, Quotation, Invoice, Expense } from '../types';

export const initialBusinessProfile: BusinessProfile = {
  companyName: "HARRY'S AIRCON ELECTRICAL & SOLAR SERVICES",
  tagline: "From Electrical to Aircons, security to automation, we've got you covered",
  regNumber: '2021/849201/07',
  vatNumber: '4820391823',
  phone: '+27 82 456 7890',
  email: 'info@harryselectrical.co.za',
  address: '14 Electron Avenue, Kya Sand Industrial, Johannesburg, 2163',
  website: 'https://harryselectrical.co.za',
  bankName: 'Tyme Bank Business',
  accountName: 'Harrys Aircon and Electrical',
  accountNumber: '53002734919',
  branchCode: '678910',
  accountType: 'Business Current Account',
  defaultLabourRate: 420,
  defaultCalloutFee: 480,
  defaultTravelRate: 6.5,
  defaultMarkup: 30,
  vatEnabled: true,
  vatPercentage: 15,
  sansComplianceNotice: "Certified SANS 10142 compliance & workmanship warranty from Harry's Aircon Electrical & Solar Services.",
  sunlightMode: false,
};

export const initialClients: Client[] = [];
export const initialInventory: InventoryItem[] = [];
export const initialQuotes: Quotation[] = [];
export const initialInvoices: Invoice[] = [];
export const initialExpenses: Expense[] = [];
