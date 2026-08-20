import { BusinessProfile, Quotation, Invoice, QuoteLineItem, ConsumablesTier } from '../types';

export interface ConsumablePreset {
  tier: ConsumablesTier;
  label: string;
  price: number;
  description: string;
}

export const CONSUMABLE_PRESETS: ConsumablePreset[] = [
  {
    tier: 'none',
    label: 'No Consumables',
    price: 0,
    description: 'No miscellaneous consumables billed',
  },
  {
    tier: 'light',
    label: 'Light Tier (R150)',
    price: 150,
    description: 'Screws, Rawl Plugs, PVC Tape, Connectors & Terminals',
  },
  {
    tier: 'standard',
    label: 'Standard Tier (R350)',
    price: 350,
    description: 'Fasteners, Sealant, Saddles, UV Ties, Lugs, Glands & Fixings',
  },
  {
    tier: 'heavy',
    label: 'Heavy / Installation (R650)',
    price: 650,
    description: 'Unistrut Brackets, Chemical Anchors, Trunking, Nitrogen/Flux/Solder',
  },
  {
    tier: 'custom',
    label: 'Custom Amount',
    price: 0,
    description: 'Manual custom consumables charge',
  },
];

/**
 * Format numbers as South African Rand (ZAR)
 */
export function formatZAR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'R 0.00';
  }
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate selling price from cost price and markup percentage
 */
export function calculateSellingPrice(costPrice: number, markupPct: number): number {
  const cost = Number(costPrice) || 0;
  const markup = Number(markupPct) || 0;
  return Number((cost * (1 + markup / 100)).toFixed(2));
}

/**
 * Calculate line item total
 */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  return Number((qty * price).toFixed(2));
}

/**
 * Calculate complete quotation / invoice financial breakdown
 * Structured Labor Formula: Total Labor Amount = Call-Out Fee (includes 1st hour) + (Additional Hours * Hourly Rate)
 */
export function calculateDocumentTotals(
  items: QuoteLineItem[],
  calloutFee: number = 0,
  additionalLabourHours: number = 0,
  labourRatePerHour: number = 0,
  travelDistanceKm: number = 0,
  travelRatePerKm: number = 0,
  consumablesFee: number = 0,
  miscellaneousFee: number = 0,
  discountPct: number = 0,
  vatEnabled: boolean = true,
  vatPercentage: number = 15
) {
  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const callout = Number(calloutFee) || 0;
  const additionalHours = Number(additionalLabourHours) || 0;
  const hourlyRate = Number(labourRatePerHour) || 0;
  const additionalLabourAmount = Number((additionalHours * hourlyRate).toFixed(2));
  const totalLabourAmount = Number((callout + additionalLabourAmount).toFixed(2));

  const travelTotal = Number(((Number(travelDistanceKm) || 0) * (Number(travelRatePerKm) || 0)).toFixed(2));
  const consumables = Number(consumablesFee) || 0;
  const misc = Number(miscellaneousFee) || 0;

  // Subtotal = Materials + Total Labor (Call-Out + Addl Hours) + Travel + Consumables + Miscellaneous
  const rawSubtotal = Number((itemsTotal + totalLabourAmount + travelTotal + consumables + misc).toFixed(2));
  const discountRate = Number(discountPct) || 0;
  const discountAmount = Number(((rawSubtotal * discountRate) / 100).toFixed(2));
  const subtotalAfterDiscount = Number((rawSubtotal - discountAmount).toFixed(2));

  const vatRate = vatEnabled ? (Number(vatPercentage) || 15) / 100 : 0;
  const vatAmount = vatEnabled ? Number((subtotalAfterDiscount * vatRate).toFixed(2)) : 0;
  const totalAmount = Number((subtotalAfterDiscount + vatAmount).toFixed(2));

  return {
    itemsTotal,
    calloutFee: callout,
    labourHours: additionalHours,
    additionalLabourHours: additionalHours,
    labourRatePerHour: hourlyRate,
    additionalLabourAmount,
    totalLabourAmount,
    labourTotal: totalLabourAmount, // Total labor = Call-Out + (Additional Hours * Rate)
    travelTotal,
    consumablesFee: consumables,
    miscellaneousFee: misc,
    subtotal: rawSubtotal,
    discountPct: discountRate,
    discountAmount,
    subtotalAfterDiscount,
    vatEnabled,
    vatAmount,
    totalAmount,
  };
}

/**
 * Generate formatted WhatsApp message for quotes & invoices
 */
export function generateWhatsAppQuoteSummary(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): string {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'Tax Invoice' : 'Official Quotation';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const dueDateStr = isInvoice
    ? `*Due Date:* ${(data as Invoice).dueDate || 'Upon Presentation'}`
    : `*Valid Until:* ${(data as Quotation).expiryDate || '30 Days'}`;

  let msg = `⚡ *${profile.companyName.toUpperCase()}*\n`;
  msg += `_${profile.tagline || "Electrical • Air Conditioning • Solar • Security"}_\n\n`;
  msg += `📋 *${docTitle}:* ${docNumber}\n`;
  msg += `👤 *Client:* ${data.clientName}\n`;
  msg += `📍 *Site:* ${data.clientAddress}\n`;
  msg += `📅 *Date:* ${data.date}\n`;
  msg += `${dueDateStr}\n`;
  msg += `🔧 *Scope:* ${data.serviceType} - ${data.scopeOfWork || 'On-site technical work'}\n\n`;

  msg += `*Itemized Materials & Equipment:*\n`;
  (data.items || []).forEach((item, index) => {
    msg += `${index + 1}. ${item.description} (${item.quantity} ${item.unit || 'ea'}) - ${formatZAR(item.total)}\n`;
  });

  msg += `\n*Labor & Site Charges:*\n`;
  if (data.calloutFee > 0) {
    msg += `• Call-Out Fee (Includes 1st Hour Labor): ${formatZAR(data.calloutFee)}\n`;
  }
  if (data.labourHours > 0) {
    const addlTotal = data.additionalLabourTotal !== undefined 
      ? data.additionalLabourTotal 
      : Number((data.labourHours * data.labourRatePerHour).toFixed(2));
    msg += `• Additional Labor: ${data.labourHours} hrs @ ${formatZAR(data.labourRatePerHour)}/hr = ${formatZAR(addlTotal)}\n`;
  }
  if (data.consumablesFee && data.consumablesFee > 0) {
    msg += `• Consumables & Fasteners (${data.consumablesDescription || 'Site consumables'}): ${formatZAR(data.consumablesFee)}\n`;
  }
  if (data.miscellaneousFee && data.miscellaneousFee > 0) {
    msg += `• Other Charges (${data.miscellaneousDescription || 'Specialist fee'}): ${formatZAR(data.miscellaneousFee)}\n`;
  }
  if (data.travelTotal > 0) {
    msg += `• Logistics & Travel (${data.travelDistanceKm} km): ${formatZAR(data.travelTotal)}\n`;
  }

  msg += `\n--------------------------------\n`;
  msg += `*Subtotal:* ${formatZAR(data.subtotal)}\n`;
  if (data.discountAmount && data.discountAmount > 0) {
    msg += `*Discount (${data.discountPct}%):* -${formatZAR(data.discountAmount)}\n`;
  }
  if (data.vatEnabled) {
    msg += `*VAT (15%):* ${formatZAR(data.vatAmount)}\n`;
  }
  msg += `💰 *TOTAL AMOUNT: ${formatZAR(data.totalAmount)}*\n`;

  if (isInvoice) {
    const inv = data as Invoice;
    if (inv.amountPaid > 0) {
      msg += `*Amount Paid:* ${formatZAR(inv.amountPaid)}\n`;
      msg += `*Balance Outstanding:* ${formatZAR(inv.totalAmount - inv.amountPaid)}\n`;
    }
  }

  msg += `--------------------------------\n\n`;
  msg += `🏦 *Banking Details (EFT Settlement):*\n`;
  msg += `• Bank: *${profile.bankName || 'Tyme Bank Business'}*\n`;
  msg += `• Account Name: *${profile.accountName || 'Harrys Aircon and Electrical'}*\n`;
  msg += `• Account Number: *${profile.accountNumber || '53002734919'}*\n`;
  msg += `• Branch Code: *${profile.branchCode || '678910'}*\n`;
  msg += `• Reference: *${docNumber}*\n\n`;
  msg += `📞 Contact: ${profile.phone} | ${profile.email}\n`;
  msg += `_${profile.sansComplianceNotice}_`;

  return msg;
}

/**
 * Format phone number for WhatsApp URL
 */
export function getWhatsAppShareLink(phone: string, text: string): string {
  // Format clean international SA number: replace leading 0 with 27
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0') && clean.length === 10) {
    clean = '27' + clean.slice(1);
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}
