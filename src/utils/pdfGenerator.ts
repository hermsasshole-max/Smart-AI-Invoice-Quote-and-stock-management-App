import { jsPDF } from 'jspdf';
import { Quotation, Invoice, BusinessProfile } from '../types';
import { formatZAR } from './calculator';

export function generateQuotePDF(quote: Quotation, profile: BusinessProfile) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [22, 101, 52]; // Dark green accent for electrical/solar
  const darkTextColor = [30, 41, 59];
  const mutedTextColor = [100, 116, 139];

  // Header background bar
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 0, 210, 40, 'F');

  // Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(profile.companyName, 14, 16);

  // Subtitle / Scope
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Electrical Compliance • HVAC+R Air Conditioning • Solar PV & Battery Systems', 14, 22);
  doc.text(`Reg: ${profile.regNumber} | VAT: ${profile.vatNumber} | Email: ${profile.email}`, 14, 27);
  doc.text(`Phone/WhatsApp: ${profile.phone} | ${profile.address}`, 14, 32);

  // Document Title Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('OFFICIAL QUOTATION', 140, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(`Quote #: ${quote.quoteNumber}`, 140, 25);
  doc.text(`Date: ${quote.date}`, 140, 30);
  doc.text(`Valid Until: ${quote.expiryDate}`, 140, 35);

  // Client Details Section
  let y = 50;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 28, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text('CLIENT DETAILS & SITE LOCATION:', 18, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${quote.clientName}`, 18, y + 13);
  doc.text(`Phone: ${quote.clientPhone}`, 18, y + 18);
  doc.text(`Site: ${quote.clientAddress}`, 18, y + 23);

  doc.text(`Service Type: ${quote.serviceType}`, 120, y + 13);
  doc.text(`Status: ${quote.status.toUpperCase()}`, 120, y + 18);

  // Line items table
  y = 86;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(14, y, 182, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('DESCRIPTION / ITEM', 18, y + 5.5);
  doc.text('QTY', 125, y + 5.5);
  doc.text('UNIT PRICE (ZAR)', 142, y + 5.5);
  doc.text('TOTAL (ZAR)', 175, y + 5.5);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);

  // Materials & items
  quote.items.forEach((item) => {
    doc.setFontSize(8.5);
    const desc = doc.splitTextToSize(item.description, 100);
    doc.text(desc, 18, y);
    doc.text(`${item.quantity} ${item.unit}`, 125, y);
    doc.text(formatZAR(item.unitPrice), 142, y);
    doc.text(formatZAR(item.total), 175, y);
    y += desc.length * 5 + 2;
  });

  // Service & Labour line items
  if (quote.calloutFee > 0) {
    doc.text('Standard Call-out / On-Site Diagnostic Fee', 18, y);
    doc.text('1 ea', 125, y);
    doc.text(formatZAR(quote.calloutFee), 142, y);
    doc.text(formatZAR(quote.calloutFee), 175, y);
    y += 6;
  }

  if (quote.masterLabourHours > 0) {
    doc.text(`Master Electrician / HVAC Labour (${quote.masterLabourHours} hrs)`, 18, y);
    doc.text(`${quote.masterLabourHours} hrs`, 125, y);
    doc.text(formatZAR(quote.masterLabourRate), 142, y);
    doc.text(formatZAR(quote.masterLabourHours * quote.masterLabourRate), 175, y);
    y += 6;
  }

  if (quote.assistantLabourHours > 0) {
    doc.text(`Assistant / Semi-Skilled Labour (${quote.assistantLabourHours} hrs)`, 18, y);
    doc.text(`${quote.assistantLabourHours} hrs`, 125, y);
    doc.text(formatZAR(quote.assistantLabourRate), 142, y);
    doc.text(formatZAR(quote.assistantLabourHours * quote.assistantLabourRate), 175, y);
    y += 6;
  }

  if (quote.travelTotal > 0) {
    doc.text(`Travel Surcharge (${quote.travelKm} km)`, 18, y);
    doc.text('1 trip', 125, y);
    doc.text(formatZAR(quote.travelTotal), 142, y);
    doc.text(formatZAR(quote.travelTotal), 175, y);
    y += 6;
  }

  // Divider
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, 196, y);
  y += 6;

  // Summary box
  const summaryBoxY = y;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(120, summaryBoxY, 76, 32, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Materials Total:', 124, summaryBoxY + 6);
  doc.text(formatZAR(quote.materialsTotal), 175, summaryBoxY + 6);

  doc.text('Labour & Services:', 124, summaryBoxY + 12);
  doc.text(formatZAR(quote.labourTotal + quote.calloutFee + quote.travelTotal), 175, summaryBoxY + 12);

  doc.text('Subtotal (Excl VAT):', 124, summaryBoxY + 18);
  doc.text(formatZAR(quote.subtotal), 175, summaryBoxY + 18);

  if (quote.vatEnabled) {
    doc.text(`VAT (15%):`, 124, summaryBoxY + 24);
    doc.text(formatZAR(quote.vatAmount), 175, summaryBoxY + 24);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL AMOUNT:', 124, summaryBoxY + 30);
  doc.text(formatZAR(quote.totalAmount), 175, summaryBoxY + 30);

  // Banking Details on Bottom Left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text('BANKING DETAILS FOR ACCEPTANCE / EFT:', 14, summaryBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Bank: ${profile.bankName}`, 14, summaryBoxY + 12);
  doc.text(`Account Name: ${profile.companyName}`, 14, summaryBoxY + 17);
  doc.text(`Account Number: ${profile.accountNumber}`, 14, summaryBoxY + 22);
  doc.text(`Branch Code: ${profile.branchCode} (${profile.accountType})`, 14, summaryBoxY + 27);
  doc.text(`Reference: ${quote.quoteNumber}`, 14, summaryBoxY + 32);

  // Terms & Notes
  const termsY = summaryBoxY + 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TERMS & CONDITIONS:', 14, termsY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  const termsText = quote.terms || '70% equipment deposit required before work commences. Balance payable immediately upon commissioning and handover. All equipment remains property of contractor until paid in full.';
  const splitTerms = doc.splitTextToSize(termsText, 182);
  doc.text(splitTerms, 14, termsY + 5);

  if (quote.notes) {
    doc.setFont('helvetica', 'italic');
    doc.text(`Job Notes: ${quote.notes}`, 14, termsY + 12);
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Thank you for trusting Harrys Aircon Electrical & Solar Services. Powered by SANS 10142 Compliance.', 14, 285);

  doc.save(`${quote.quoteNumber}_${quote.clientName.replace(/\s+/g, '_')}.pdf`);
}

export function generateInvoicePDF(invoice: Invoice, profile: BusinessProfile) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [15, 23, 42]; // Slate navy for tax invoice
  const accentColor = [22, 101, 52];
  const darkTextColor = [30, 41, 59];
  const mutedTextColor = [100, 116, 139];

  // Header background
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 0, 210, 40, 'F');

  // Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(profile.companyName, 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Electrical Compliance • HVAC+R Air Conditioning • Solar PV & Battery Systems', 14, 21);
  doc.text(`Reg: ${profile.regNumber} | VAT Reg No: ${profile.vatNumber}`, 14, 26);
  doc.text(`Email: ${profile.email} | Phone: ${profile.phone}`, 14, 31);
  doc.text(profile.address, 14, 36);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TAX INVOICE', 140, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 140, 25);
  doc.text(`Date: ${invoice.date}`, 140, 30);
  doc.text(`Due Date: ${invoice.dueDate}`, 140, 35);

  // Client Section
  let y = 48;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 26, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('BILLED TO / SITE LOCATION:', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Client: ${invoice.clientName}`, 18, y + 12);
  doc.text(`Phone: ${invoice.clientPhone}`, 18, y + 17);
  doc.text(`Site: ${invoice.clientAddress}`, 18, y + 22);

  doc.text(`Service: ${invoice.serviceType}`, 120, y + 12);
  doc.text(`Payment Status: ${invoice.status.toUpperCase()}`, 120, y + 17);

  // Items table
  y = 80;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(14, y, 182, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM DESCRIPTION', 18, y + 5.5);
  doc.text('QTY', 125, y + 5.5);
  doc.text('UNIT (ZAR)', 145, y + 5.5);
  doc.text('LINE TOTAL', 172, y + 5.5);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);

  invoice.items.forEach((item) => {
    doc.setFontSize(8.5);
    const desc = doc.splitTextToSize(item.description, 100);
    doc.text(desc, 18, y);
    doc.text(`${item.quantity} ${item.unit}`, 125, y);
    doc.text(formatZAR(item.unitPrice), 145, y);
    doc.text(formatZAR(item.total), 172, y);
    y += desc.length * 5 + 2;
  });

  if (invoice.calloutFee > 0) {
    doc.text('Standard Callout & Diagnostic Baseline', 18, y);
    doc.text('1 ea', 125, y);
    doc.text(formatZAR(invoice.calloutFee), 145, y);
    doc.text(formatZAR(invoice.calloutFee), 172, y);
    y += 6;
  }

  if (invoice.labourTotal > 0) {
    doc.text('Technical Labour & Installation Execution', 18, y);
    doc.text('1 lot', 125, y);
    doc.text(formatZAR(invoice.labourTotal), 145, y);
    doc.text(formatZAR(invoice.labourTotal), 172, y);
    y += 6;
  }

  if (invoice.travelTotal > 0) {
    doc.text('Travel Surcharge (Beyond 25km radius)', 18, y);
    doc.text('1 trip', 125, y);
    doc.text(formatZAR(invoice.travelTotal), 145, y);
    doc.text(formatZAR(invoice.travelTotal), 172, y);
    y += 6;
  }

  // Totals Box
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, 196, y);
  y += 6;

  const summaryBoxY = y;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(120, summaryBoxY, 76, 32, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Subtotal (Excl VAT):', 124, summaryBoxY + 7);
  doc.text(formatZAR(invoice.subtotal), 172, summaryBoxY + 7);

  if (invoice.vatEnabled) {
    doc.text('VAT @ 15%:', 124, summaryBoxY + 14);
    doc.text(formatZAR(invoice.vatAmount), 172, summaryBoxY + 14);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('TOTAL DUE:', 124, summaryBoxY + 22);
  doc.text(formatZAR(invoice.totalAmount), 172, summaryBoxY + 22);

  if (invoice.amountPaid > 0) {
    doc.setFontSize(8.5);
    doc.setTextColor(22, 101, 52);
    doc.text(`Amount Paid: ${formatZAR(invoice.amountPaid)} (${invoice.status.toUpperCase()})`, 124, summaryBoxY + 28);
  }

  // Banking details on bottom left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text('PAYMENT INSTRUCTIONS (EFT / BANK DETAILS):', 14, summaryBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Bank: ${profile.bankName}`, 14, summaryBoxY + 12);
  doc.text(`Account Name: ${profile.companyName}`, 14, summaryBoxY + 17);
  doc.text(`Account Number: ${profile.accountNumber}`, 14, summaryBoxY + 22);
  doc.text(`Branch Code: ${profile.branchCode}`, 14, summaryBoxY + 27);
  doc.text(`Payment Reference: ${invoice.invoiceNumber}`, 14, summaryBoxY + 32);

  // Notes
  if (invoice.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(`Notes: ${invoice.notes}`, 14, summaryBoxY + 40);
  }

  doc.save(`${invoice.invoiceNumber}_${invoice.clientName.replace(/\s+/g, '_')}.pdf`);
}
