import { QuoteLineItem, BusinessProfile } from '../types';

/**
 * Format number as South African Rand (ZAR)
 * Example: R 1,450.00
 */
export function formatZAR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'R 0.00';
  }
  return `R ${Number(amount).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Clean South African phone number for WhatsApp international format
 * Example: '082 456 7890' -> '27824567890'
 */
export function formatWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return `27${digits.substring(1)}`;
  }
  if (digits.startsWith('27')) {
    return digits;
  }
  return digits;
}

/**
 * Generate a direct WhatsApp link with pre-composed professional message
 */
export function getWhatsAppShareLink(phone: string, message: string): string {
  const cleanPhone = formatWhatsAppNumber(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Calculate selling price from cost price and markup percentage
 */
export function calculateSellingPrice(costPrice: number, markupPct: number): number {
  return Number((costPrice * (1 + markupPct / 100)).toFixed(2));
}

/**
 * Calculate markup percentage from cost price and selling price
 */
export function calculateMarkupPct(costPrice: number, sellingPrice: number): number {
  if (costPrice <= 0) return 0;
  return Number((((sellingPrice - costPrice) / costPrice) * 100).toFixed(1));
}

/**
 * Calculate quote or invoice totals based on South African technical contracting standards
 */
export interface CalculationResult {
  materialsTotal: number;
  labourTotal: number;
  travelTotal: number;
  calloutFee: number;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
}

export function calculateTotals(params: {
  items: QuoteLineItem[];
  calloutFee: number;
  masterLabourHours: number;
  masterLabourRate: number;
  assistantLabourHours: number;
  assistantLabourRate: number;
  travelKm: number;
  travelRate: number;
  travelIncludedKm?: number;
  isAfterHours: boolean;
  afterHoursMultiplier: number;
  vatEnabled: boolean;
  vatRate: number;
}): CalculationResult {
  const {
    items = [],
    calloutFee = 0,
    masterLabourHours = 0,
    masterLabourRate = 0,
    assistantLabourHours = 0,
    assistantLabourRate = 0,
    travelKm = 0,
    travelRate = 0,
    travelIncludedKm = 25,
    isAfterHours = false,
    afterHoursMultiplier = 1.5,
    vatEnabled = true,
    vatRate = 15,
  } = params;

  // 1. Materials Total from line items
  const materialsTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  // 2. Base Labour Total
  const multiplier = isAfterHours ? afterHoursMultiplier : 1.0;
  const masterLabour = masterLabourHours * masterLabourRate * multiplier;
  const assistantLabour = assistantLabourHours * assistantLabourRate * multiplier;
  const labourTotal = masterLabour + assistantLabour;

  // 3. Travel Total: km beyond included radius
  const billableKm = Math.max(0, travelKm - travelIncludedKm);
  const travelTotal = billableKm * travelRate;

  // 4. Callout fee (subject to multiplier if emergency/after-hours)
  const finalCalloutFee = isAfterHours ? calloutFee * multiplier : calloutFee;

  // 5. Subtotal before VAT
  const subtotal = materialsTotal + labourTotal + travelTotal + finalCalloutFee;

  // 6. 15% South African VAT
  const vatAmount = vatEnabled ? Number((subtotal * (vatRate / 100)).toFixed(2)) : 0;

  // 7. Grand Total
  const totalAmount = Number((subtotal + vatAmount).toFixed(2));

  return {
    materialsTotal: Number(materialsTotal.toFixed(2)),
    labourTotal: Number(labourTotal.toFixed(2)),
    travelTotal: Number(travelTotal.toFixed(2)),
    calloutFee: Number(finalCalloutFee.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}

/**
 * Generate formatted text summary for WhatsApp sharing
 */
export function generateWhatsAppQuoteSummary(
  profile: BusinessProfile,
  quoteNumber: string,
  clientName: string,
  serviceType: string,
  totals: CalculationResult,
  vatEnabled: boolean
): string {
  return `*${profile.companyName}*
*QUOTATION: ${quoteNumber}*
----------------------------------------
*Client:* ${clientName}
*Service:* ${serviceType}
*Date:* ${new Date().toISOString().split('T')[0]}

*Cost Breakdown:*
• Call-out / Diagnostic: ${formatZAR(totals.calloutFee)}
• Labour: ${formatZAR(totals.labourTotal)}
• Materials & Consumables: ${formatZAR(totals.materialsTotal)}
• Travel: ${formatZAR(totals.travelTotal)}
----------------------------------------
*Subtotal:* ${formatZAR(totals.subtotal)}
${vatEnabled ? `*VAT (15%):* ${formatZAR(totals.vatAmount)}\n` : ''}*TOTAL:* ${formatZAR(totals.totalAmount)}
----------------------------------------
*Banking Details for Acceptance:*
Bank: ${profile.bankName}
Account: ${profile.accountNumber}
Branch Code: ${profile.branchCode}
Reference: ${quoteNumber}

Please reply with "ACCEPTED" to schedule on-site execution.`;
}
