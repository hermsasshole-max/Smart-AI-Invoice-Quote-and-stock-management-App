import { Quotation, Invoice, BusinessProfile } from '../types';
import { exportToPDF, exportToExcel, exportToWord, exportToPlainText } from './multiFormatExport';

export { exportToPDF, exportToExcel, exportToWord, exportToPlainText };

export function generateQuotePDF(quote: Quotation, profile: BusinessProfile) {
  return exportToPDF('quote', quote, profile);
}

export function generateInvoicePDF(invoice: Invoice, profile: BusinessProfile) {
  return exportToPDF('invoice', invoice, profile);
}
