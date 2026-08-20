import { BusinessProfile, Quotation, Invoice, QuoteLineItem } from '../types';

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
 */
export function calculateDocumentTotals(
  items: QuoteLineItem[],
  calloutFee: number = 0,
  labourHours: number = 0,
  labourRatePerHour: number = 0,
  travelDistanceKm: number = 0,
  travelRatePerKm: number = 0,
  discountPct: number = 0,
  vatEnabled: boolean = true,
  vatPercentage: number = 15
) {
  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const labourTotal = Number(((Number(labourHours) || 0) * (Number(labourRatePerHour) || 0)).toFixed(2));
  const travelTotal = Number(((Number(travelDistanceKm) || 0) * (Number(travelRatePerKm) || 0)).toFixed(2));
  const callout = Number(calloutFee) || 0;

  const rawSubtotal = Number((itemsTotal + labourTotal + travelTotal + callout).toFixed(2));
  const discountRate = Number(discountPct) || 0;
  const discountAmount = Number(((rawSubtotal * discountRate) / 100).toFixed(2));
  const subtotalAfterDiscount = Number((rawSubtotal - discountAmount).toFixed(2));

  const vatRate = vatEnabled ? (Number(vatPercentage) || 15) / 100 : 0;
  const vatAmount = vatEnabled ? Number((subtotalAfterDiscount * vatRate).toFixed(2)) : 0;
  const totalAmount = Number((subtotalAfterDiscount + vatAmount).toFixed(2));

  return {
    itemsTotal,
    labourTotal,
    travelTotal,
    calloutFee: callout,
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

  msg += `*Itemized Summary:*\n`;
  (data.items || []).forEach((item, index) => {
    msg += `${index + 1}. ${item.description} (${item.quantity} ${item.unit || 'ea'}) - ${formatZAR(item.total)}\n`;
  });

  if (data.calloutFee > 0) {
    msg += `• Standard Callout & Diagnostics: ${formatZAR(data.calloutFee)}\n`;
  }
  if (data.labourTotal > 0) {
    msg += `• Technical Labour (${data.labourHours} hrs @ ${formatZAR(data.labourRatePerHour)}/hr): ${formatZAR(data.labourTotal)}\n`;
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
