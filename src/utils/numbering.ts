import { Invoice, Quotation } from '../types';

export interface ParsedDocNumber {
  prefix: string;
  number: number;
  padLength: number;
  original: string;
}

/**
 * Parses any document number into prefix, number, and digit padding length.
 * Examples:
 * - "INV-2026-0089" => { prefix: "INV-2026-", number: 89, padLength: 4, original: "INV-2026-0089" }
 * - "Q-2026-0142"   => { prefix: "Q-2026-", number: 142, padLength: 4, original: "Q-2026-0142" }
 * - "INV-105"       => { prefix: "INV-", number: 105, padLength: 3, original: "INV-105" }
 * - "500"           => { prefix: "", number: 500, padLength: 3, original: "500" }
 */
export function parseDocNumber(docNum: string): ParsedDocNumber {
  const trimmed = (docNum || '').trim();
  if (!trimmed) {
    const currentYear = new Date().getFullYear();
    return {
      prefix: `INV-${currentYear}-`,
      number: 1,
      padLength: 4,
      original: `INV-${currentYear}-0001`,
    };
  }

  // Look for the trailing integer sequence
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const numStr = match[2];
    const number = parseInt(numStr, 10) || 1;
    const padLength = numStr.length;
    return {
      prefix,
      number,
      padLength,
      original: trimmed,
    };
  }

  // If there are numbers inside but trailing letters (e.g. INV-2026-001-A)
  const innerMatch = trimmed.match(/^(.*?)(\d+)([^\d]*)$/);
  if (innerMatch) {
    const prefix = innerMatch[1];
    const numStr = innerMatch[2];
    const number = parseInt(numStr, 10) || 1;
    const padLength = numStr.length;
    return {
      prefix,
      number,
      padLength,
      original: trimmed,
    };
  }

  // Fallback if no digits found
  const currentYear = new Date().getFullYear();
  return {
    prefix: `${trimmed}-`,
    number: 1,
    padLength: 4,
    original: trimmed,
  };
}

/**
 * Formats prefix + number + padding into document number string
 */
export function formatDocNumber(prefix: string, num: number, padLength: number = 4): string {
  const padded = String(num).padStart(padLength, '0');
  return `${prefix}${padded}`;
}

/**
 * Returns the incremented document number string (+1) from any given document number.
 */
export function getNextDocumentNumber(docNum: string): string {
  const parsed = parseDocNumber(docNum);
  const nextNum = parsed.number + 1;
  return formatDocNumber(parsed.prefix, nextNum, parsed.padLength);
}

/**
 * Calculates the next default Quotation Number given existing quotes, invoices, and any custom override.
 */
export function calculateNextQuoteNumber(
  existingQuotes: Quotation[] = [],
  customNext?: string,
  existingInvoices: Invoice[] = []
): string {
  const currentYear = new Date().getFullYear();
  const defaultPrefix = `Q-${currentYear}-`;

  if (customNext && customNext.trim().length > 0) {
    return customNext.trim();
  }

  // Check highest number among quotes with matching prefix
  let maxNum = 0;
  let detectedPad = 4;
  let detectedPrefix = defaultPrefix;

  for (const q of existingQuotes) {
    if (!q.quoteNumber) continue;
    const parsed = parseDocNumber(q.quoteNumber);
    if (parsed.number > maxNum) {
      maxNum = parsed.number;
      detectedPad = parsed.padLength || 4;
      if (parsed.prefix) detectedPrefix = parsed.prefix;
    }
  }

  if (maxNum > 0) {
    return formatDocNumber(detectedPrefix, maxNum + 1, detectedPad);
  }

  // Check invoices if quotes are empty
  for (const inv of existingInvoices) {
    if (!inv.invoiceNumber) continue;
    const parsed = parseDocNumber(inv.invoiceNumber);
    if (parsed.number > maxNum) {
      maxNum = parsed.number;
      detectedPad = parsed.padLength || 4;
    }
  }

  if (maxNum > 0) {
    return formatDocNumber(defaultPrefix, maxNum + 1, detectedPad);
  }

  // Base fallback
  return `${defaultPrefix}0101`;
}

/**
 * Calculates the next default Invoice Number given existing invoices, quotes, and any custom override.
 */
export function calculateNextInvoiceNumber(
  existingInvoices: Invoice[] = [],
  customNext?: string,
  existingQuotes: Quotation[] = []
): string {
  const currentYear = new Date().getFullYear();
  const defaultPrefix = `INV-${currentYear}-`;

  if (customNext && customNext.trim().length > 0) {
    return customNext.trim();
  }

  // Check highest number among invoices
  let maxNum = 0;
  let detectedPad = 4;
  let detectedPrefix = defaultPrefix;

  for (const inv of existingInvoices) {
    if (!inv.invoiceNumber) continue;
    const parsed = parseDocNumber(inv.invoiceNumber);
    if (parsed.number > maxNum) {
      maxNum = parsed.number;
      detectedPad = parsed.padLength || 4;
      if (parsed.prefix) detectedPrefix = parsed.prefix;
    }
  }

  if (maxNum > 0) {
    return formatDocNumber(detectedPrefix, maxNum + 1, detectedPad);
  }

  // Check quotes if invoices are empty
  for (const q of existingQuotes) {
    if (!q.quoteNumber) continue;
    const parsed = parseDocNumber(q.quoteNumber);
    if (parsed.number > maxNum) {
      maxNum = parsed.number;
      detectedPad = parsed.padLength || 4;
    }
  }

  if (maxNum > 0) {
    return formatDocNumber(defaultPrefix, maxNum + 1, detectedPad);
  }

  // Base fallback
  return `${defaultPrefix}0101`;
}
