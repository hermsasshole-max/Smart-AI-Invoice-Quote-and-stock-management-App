import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
} from 'docx';
import { Quotation, Invoice, BusinessProfile, QuoteLineItem } from '../types';
import { formatZAR } from './calculator';

export type ExportFormat = 'pdf' | 'xlsx' | 'docx' | 'txt';

/**
 * Generate PDF for Quotation or Invoice with Harry's Aircon Electrical & Solar Brand Identity
 */
export function exportToPDF(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
) {
  const isInvoice = docType === 'invoice';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Official Brand Colors
  const headerBgColor = [27, 30, 40]; // Deep Slate #1B1E28
  const cyanBrandColor = [56, 189, 248]; // Vibrant Cyan #38BDF8
  const tableHeaderBg = isInvoice ? [2, 132, 199] : [14, 116, 144]; // Deep Cyan / Teal #0284C7
  const goldAccentColor = [245, 158, 11]; // Electric Amber / Gold #F59E0B
  const darkTextColor = [30, 41, 59];
  const mutedTextColor = [100, 116, 139];

  // Top Deep Navy Header Banner
  doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.rect(0, 0, 210, 44, 'F');

  // Accent Cyan Horizontal Stripe
  doc.setFillColor(cyanBrandColor[0], cyanBrandColor[1], cyanBrandColor[2]);
  doc.rect(0, 44, 210, 1.5, 'F');

  // Custom Logo or Fallback Text
  let textStartX = 14;
  if (profile.logoUrl && profile.logoUrl.startsWith('data:image/')) {
    try {
      const format = profile.logoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(profile.logoUrl, format, 14, 8, 28, 28);
      textStartX = 46;
    } catch {
      textStartX = 14;
    }
  }

  // Company Name & Subheader
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(profile.companyName || "HARRY'S AIRCON ELECTRICAL AND SOLAR SERVICES PTY. LTD.", textStartX, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(cyanBrandColor[0], cyanBrandColor[1], cyanBrandColor[2]);
  doc.text(profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered", textStartX, 18);

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // #CBD5E1
  doc.text(`Reg: ${profile.regNumber || '2021/849201/07'} | VAT: ${profile.vatNumber || '4790284912'}`, textStartX, 23);
  doc.text(`Email: ${profile.email || 'amicovolt@outlook.com'} | Tel: ${profile.phone || '071 689 6139 / 078 797 6058'}`, textStartX, 28);
  doc.text(`Address: ${profile.address || '69A North Street, Rayton'} | ${profile.website || 'https://harryselectrical.co.za'}`, textStartX, 33);

  // Document Title & Reference on Right Header
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const docDate = data.date;
  const docSecondaryDate = isInvoice
    ? `Due: ${(data as Invoice).dueDate || 'Immediate'}`
    : `Valid: ${(data as Quotation).expiryDate || '30 Days'}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(goldAccentColor[0], goldAccentColor[1], goldAccentColor[2]);
  doc.text(docTitle, 140, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Ref #: ${docNumber}`, 140, 21);
  doc.text(`Date: ${docDate}`, 140, 26);
  doc.text(docSecondaryDate, 140, 31);

  // Status Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  if (isInvoice && data.status === 'paid') {
    doc.setTextColor(34, 197, 94); // Green
  } else {
    doc.setTextColor(cyanBrandColor[0], cyanBrandColor[1], cyanBrandColor[2]);
  }
  doc.text(`STATUS: ${data.status.toUpperCase()}`, 140, 37);

  // Client Details Section
  let y = 51;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 26, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y, 182, 26, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
  doc.text(isInvoice ? 'BILLED TO / SITE LOCATION:' : 'CLIENT & SITE DETAILS:', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(`Client: ${data.clientName}`, 18, y + 12);
  doc.text(`Phone: ${data.clientPhone}`, 18, y + 17);
  doc.text(`Site: ${data.clientAddress}`, 18, y + 22);

  doc.text(`Service Category: ${data.serviceType}`, 115, y + 12);
  if (data.clientEmail) {
    doc.text(`Email: ${data.clientEmail}`, 115, y + 17);
  }

  // Scope of Work / Notes Section (if provided)
  y = 81;
  if (data.scopeOfWork || data.notes) {
    const scopeText = data.scopeOfWork || data.notes || '';
    doc.setFillColor(254, 243, 199); // light amber tint
    const splitScope = doc.splitTextToSize(scopeText, 174);
    const boxHeight = Math.max(15, splitScope.length * 4.2 + 8);

    doc.roundedRect(14, y, 182, boxHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(14, y, 182, boxHeight, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text('SCOPE OF WORK / SERVICE SPECIFICATIONS:', 18, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81);
    doc.text(splitScope, 18, y + 9.5);

    y += boxHeight + 4;
  }

  // Items Table Header
  doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
  doc.rect(14, y, 182, 7.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM / SERVICE DESCRIPTION', 18, y + 5);
  doc.text('QTY', 122, y + 5);
  doc.text('RATE (ZAR)', 142, y + 5);
  doc.text('TOTAL (ZAR)', 172, y + 5);

  y += 9.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);

  // Line items
  (data.items || []).forEach((item: QuoteLineItem) => {
    if (y > 255) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(8);
    const desc = doc.splitTextToSize(item.description, 98);
    doc.text(desc, 18, y);
    doc.text(`${item.quantity} ${item.unit || 'ea'}`, 122, y);
    doc.text(formatZAR(item.unitPrice), 142, y);
    doc.text(formatZAR(item.total), 172, y);
    y += Math.max(5, desc.length * 4.2 + 2);
  });

  // Callout, Labour, Travel Breakdown
  if (data.calloutFee > 0) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.text('Standard Callout & Technical Diagnostics', 18, y);
    doc.text('1 ea', 122, y);
    doc.text(formatZAR(data.calloutFee), 142, y);
    doc.text(formatZAR(data.calloutFee), 172, y);
    y += 5.5;
  }

  if (data.labourTotal > 0) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.text('Technical Labour & Installation Execution', 18, y);
    doc.text('1 lot', 122, y);
    doc.text(formatZAR(data.labourTotal), 142, y);
    doc.text(formatZAR(data.labourTotal), 172, y);
    y += 5.5;
  }

  if (data.travelTotal > 0) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.text('Travel & Logistics Surcharge', 18, y);
    doc.text('1 trip', 122, y);
    doc.text(formatZAR(data.travelTotal), 142, y);
    doc.text(formatZAR(data.travelTotal), 172, y);
    y += 5.5;
  }

  // Divider
  y += 2;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, 196, y);
  y += 4;

  if (y > 235) {
    doc.addPage();
    y = 20;
  }

  // Totals Box on Right
  const summaryBoxY = y;
  doc.setFillColor(248, 250, 252);
  const boxH = data.discountAmount && data.discountAmount > 0 ? 38 : 32;
  doc.roundedRect(116, summaryBoxY, 80, boxH, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(116, summaryBoxY, 80, boxH, 2, 2, 'D');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text('Subtotal (Excl VAT):', 120, summaryBoxY + 6);
  doc.text(formatZAR(data.subtotal), 170, summaryBoxY + 6);

  let currentSummaryOffset = 11;
  if (data.discountAmount && data.discountAmount > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text(`Discount (${data.discountPct || 0}%):`, 120, summaryBoxY + currentSummaryOffset);
    doc.text(`-${formatZAR(data.discountAmount)}`, 170, summaryBoxY + currentSummaryOffset);
    currentSummaryOffset += 5;
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  }

  if (data.vatEnabled) {
    doc.text('VAT @ 15%:', 120, summaryBoxY + currentSummaryOffset);
    doc.text(formatZAR(data.vatAmount), 170, summaryBoxY + currentSummaryOffset);
    currentSummaryOffset += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.text('TOTAL AMOUNT:', 120, summaryBoxY + currentSummaryOffset);
  doc.setTextColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
  doc.text(formatZAR(data.totalAmount), 170, summaryBoxY + currentSummaryOffset);

  // Banking Details on Left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
  doc.text('BANKING DETAILS (EFT SETTLEMENT):', 14, summaryBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(`Bank: ${profile.bankName || 'Tyme Bank Business'}`, 14, summaryBoxY + 11);
  doc.text(`Account Name: ${profile.accountName || 'Harrys Aircon and Electrical'}`, 14, summaryBoxY + 16);
  doc.text(`Account Number: ${profile.accountNumber || '53002734919'}`, 14, summaryBoxY + 21);
  doc.text(`Branch Code: ${profile.branchCode || '678910'} (${profile.accountType || 'Current'})`, 14, summaryBoxY + 26);
  doc.text(`Payment Reference: ${docNumber}`, 14, summaryBoxY + 31);

  // Terms & Conditions (if present or default)
  const quoteTerms = (data as Quotation).terms || '80% Deposit on acceptance, balance on completion. All materials remain property of contractor until paid in full.';
  y = summaryBoxY + boxH + 4;
  if (y <= 270) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(`Terms & Conditions: ${quoteTerms}`, 14, y);
  }

  // Footer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text(
    "Thank you for choosing Harry's Aircon Electrical & Solar Services. Certified SANS 10142 compliance & workmanship warranty.",
    14,
    285
  );

  doc.save(`${docNumber}_${data.clientName.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generate Excel (.xlsx) spreadsheet with Official Brand Headers
 */
export function exportToExcel(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
) {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;

  const rows: any[][] = [
    [profile.companyName.toUpperCase()],
    [profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"],
    [`Reg: ${profile.regNumber || '2021/849201/07'} | VAT: ${profile.vatNumber || '4790284912'} | Email: ${profile.email || 'amicovolt@outlook.com'} | Tel: ${profile.phone || '071 689 6139 / 078 797 6058'}`],
    [`Address: ${profile.address || '69A North Street, Rayton'} | Web: ${profile.website || 'https://harryselectrical.co.za'}`],
    [],
    [docTitle, '', '', `Ref Number:`, docNumber],
    [`Date:`, data.date, '', isInvoice ? `Due Date:` : `Valid Until:`, isInvoice ? (data as Invoice).dueDate : (data as Quotation).expiryDate],
    [`Status:`, data.status.toUpperCase(), '', `Service Category:`, data.serviceType],
    [],
    [`CLIENT & SITE INFORMATION:`],
    [`Name:`, data.clientName, '', `Contact:`, data.clientPhone],
    [`Email:`, data.clientEmail || 'N/A', '', `Site Address:`, data.clientAddress],
    [],
  ];

  if (data.scopeOfWork || data.notes) {
    rows.push([`SCOPE OF WORK / SERVICE SPECIFICATIONS:`]);
    rows.push([data.scopeOfWork || data.notes || '']);
    rows.push([]);
  }

  // Line items header
  rows.push([`#`, `Item / Description`, `Type`, `Quantity`, `Unit`, `Unit Price (ZAR)`, `Line Total (ZAR)`]);

  let idx = 1;
  (data.items || []).forEach((item: QuoteLineItem) => {
    rows.push([
      idx++,
      item.description,
      item.type.toUpperCase(),
      item.quantity,
      item.unit || 'ea',
      item.unitPrice,
      item.total,
    ]);
  });

  if (data.calloutFee > 0) {
    rows.push([idx++, 'Standard Callout & Diagnostics', 'CALLOUT', 1, 'ea', data.calloutFee, data.calloutFee]);
  }
  if (data.labourTotal > 0) {
    rows.push([idx++, 'Technical Labour & Installation', 'LABOUR', 1, 'lot', data.labourTotal, data.labourTotal]);
  }
  if (data.travelTotal > 0) {
    rows.push([idx++, 'Travel & Transport Surcharge', 'TRAVEL', 1, 'trip', data.travelTotal, data.travelTotal]);
  }

  rows.push([]);
  rows.push(['', '', '', '', '', 'Subtotal (Excl VAT):', data.subtotal]);

  if (data.discountAmount && data.discountAmount > 0) {
    rows.push(['', '', '', '', '', `Discount (${data.discountPct}%):`, -data.discountAmount]);
  }

  if (data.vatEnabled) {
    rows.push(['', '', '', '', '', 'VAT @ 15%:', data.vatAmount]);
  }

  rows.push(['', '', '', '', '', 'GRAND TOTAL (ZAR):', data.totalAmount]);
  rows.push([]);
  rows.push(['BANKING DETAILS (EFT SETTLEMENT):']);
  rows.push(['Bank Name:', profile.bankName || 'Tyme Bank Business']);
  rows.push(['Account Name:', profile.accountName || 'Harrys Aircon and Electrical']);
  rows.push(['Account Number:', profile.accountNumber || '53002734919']);
  rows.push(['Branch Code:', profile.branchCode || '678910']);
  rows.push(['Account Type:', profile.accountType || 'Current']);
  rows.push(['Reference:', docNumber]);
  rows.push([]);
  rows.push(['TERMS & CONDITIONS:']);
  rows.push([(data as Quotation).terms || '80% Deposit on acceptance, balance on completion. All materials remain property of contractor until paid in full.']);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, isInvoice ? 'Invoice' : 'Quotation');

  // Auto-fit column widths
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 45 },
    { wch: 14 },
    { wch: 10 },
    { wch: 8 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.writeFile(workbook, `${docNumber}_${data.clientName.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Generate Word (.docx) formatted document with Harry's Brand Theme
 */
export async function exportToWord(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
) {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const headerFill = '1B1E28'; // Deep Slate
  const tableFill = isInvoice ? '0284C7' : '0E7490'; // Cyan / Teal

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, color: 'FFFFFF' })] })],
          shading: { fill: tableFill },
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Qty', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
          shading: { fill: tableFill },
          width: { size: 15, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Rate (ZAR)', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.RIGHT })],
          shading: { fill: tableFill },
          width: { size: 17, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Total (ZAR)', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.RIGHT })],
          shading: { fill: tableFill },
          width: { size: 18, type: WidthType.PERCENTAGE },
        }),
      ],
    }),
  ];

  (data.items || []).forEach((item: QuoteLineItem) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: item.description })] }),
          new TableCell({ children: [new Paragraph({ text: `${item.quantity} ${item.unit || 'ea'}`, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: formatZAR(item.unitPrice), alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ text: formatZAR(item.total), alignment: AlignmentType.RIGHT })] }),
        ],
      })
    );
  });

  if (data.calloutFee > 0) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Standard Callout & Technical Diagnostics' })] }),
          new TableCell({ children: [new Paragraph({ text: '1 ea', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: formatZAR(data.calloutFee), alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ text: formatZAR(data.calloutFee), alignment: AlignmentType.RIGHT })] }),
        ],
      })
    );
  }

  if (data.labourTotal > 0) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Technical Labour & Installation Execution' })] }),
          new TableCell({ children: [new Paragraph({ text: '1 lot', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: formatZAR(data.labourTotal), alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ text: formatZAR(data.labourTotal), alignment: AlignmentType.RIGHT })] }),
        ],
      })
    );
  }

  if (data.travelTotal > 0) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Travel & Transport Surcharge' })] }),
          new TableCell({ children: [new Paragraph({ text: '1 trip', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: formatZAR(data.travelTotal), alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ text: formatZAR(data.travelTotal), alignment: AlignmentType.RIGHT })] }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: profile.companyName,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"}\n`,
                italics: true,
                color: '0284C7',
                size: 20,
              }),
              new TextRun({
                text: `Address: ${profile.address} | Tel: ${profile.phone} | Email: ${profile.email} | Web: ${profile.website || 'https://harryselectrical.co.za'}`,
                color: '64748B',
                size: 18,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: docTitle, bold: true, size: 28, color: tableFill }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Document Number: `, bold: true }),
              new TextRun({ text: `${docNumber}    ` }),
              new TextRun({ text: `Date: `, bold: true }),
              new TextRun({ text: `${data.date}    ` }),
              new TextRun({ text: isInvoice ? `Due: ` : `Valid: `, bold: true }),
              new TextRun({ text: isInvoice ? (data as Invoice).dueDate : (data as Quotation).expiryDate }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: 'Client & Site Location Details:',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Client Name: ${data.clientName}\n` }),
              new TextRun({ text: `Contact Number: ${data.clientPhone}\n` }),
              new TextRun({ text: `Email: ${data.clientEmail || 'N/A'}\n` }),
              new TextRun({ text: `Site Location: ${data.clientAddress}\n` }),
              new TextRun({ text: `Service Category: ${data.serviceType}\n` }),
            ],
            spacing: { after: 200 },
          }),
          ...(data.scopeOfWork || data.notes
            ? [
                new Paragraph({
                  text: 'Scope of Work / Service Specifications:',
                  heading: HeadingLevel.HEADING_2,
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  text: data.scopeOfWork || data.notes || '',
                  spacing: { after: 200 },
                }),
              ]
            : []),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({ text: `Subtotal (Excl VAT): ${formatZAR(data.subtotal)}\n` }),
              ...(data.discountAmount && data.discountAmount > 0
                ? [new TextRun({ text: `Discount (${data.discountPct}%): -${formatZAR(data.discountAmount)}\n`, color: 'DC2626' })]
                : []),
              ...(data.vatEnabled ? [new TextRun({ text: `VAT (15%): ${formatZAR(data.vatAmount)}\n` })] : []),
              new TextRun({ text: `TOTAL AMOUNT: ${formatZAR(data.totalAmount)}\n`, bold: true, size: 24, color: tableFill }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: 'Banking Details (EFT Settlement):',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Bank: ${profile.bankName || 'Tyme Bank Business'}\n` }),
              new TextRun({ text: `Account Name: ${profile.accountName || 'Harrys Aircon and Electrical'}\n` }),
              new TextRun({ text: `Account Number: ${profile.accountNumber || '53002734919'}\n` }),
              new TextRun({ text: `Branch Code: ${profile.branchCode || '678910'} (${profile.accountType || 'Current'})\n` }),
              new TextRun({ text: `Payment Reference: ${docNumber}\n` }),
            ],
            spacing: { after: 150 },
          }),
          new Paragraph({
            text: 'Terms & Conditions:',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: (data as Quotation).terms || '80% Deposit on acceptance, balance on completion. All materials remain property of contractor until paid in full.',
                italics: true,
                color: '64748B',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${docNumber}_${data.clientName.replace(/\s+/g, '_')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate Plain Text (.txt) summary
 */
export function exportToPlainText(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
) {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;

  const lines = [
    '======================================================================',
    ` ${profile.companyName.toUpperCase()}`,
    ` ${profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"}`,
    ` Reg: ${profile.regNumber || '2021/849201/07'} | VAT: ${profile.vatNumber || '4790284912'}`,
    ` Phone: ${profile.phone || '071 689 6139 / 078 797 6058'} | Email: ${profile.email || 'amicovolt@outlook.com'}`,
    ` Address: ${profile.address || '69A North Street, Rayton'} | ${profile.website || 'https://harryselectrical.co.za'}`,
    '======================================================================',
    '',
    ` DOCUMENT: ${docTitle}`,
    ` NUMBER:   ${docNumber}`,
    ` DATE:     ${data.date}`,
    ` ${isInvoice ? 'DUE DATE:' : 'VALID UNTIL:'} ${isInvoice ? (data as Invoice).dueDate : (data as Quotation).expiryDate}`,
    ` STATUS:   ${data.status.toUpperCase()}`,
    '',
    '----------------------------------------------------------------------',
    ' CLIENT & SITE LOCATION',
    '----------------------------------------------------------------------',
    ` Client Name:      ${data.clientName}`,
    ` Phone Number:     ${data.clientPhone}`,
    ` Email:            ${data.clientEmail || 'N/A'}`,
    ` Site Address:     ${data.clientAddress}`,
    ` Service Category: ${data.serviceType}`,
    '',
  ];

  if (data.scopeOfWork || data.notes) {
    lines.push('----------------------------------------------------------------------');
    lines.push(' SCOPE OF WORK / SERVICE SPECIFICATIONS');
    lines.push('----------------------------------------------------------------------');
    lines.push(data.scopeOfWork || data.notes || '');
    lines.push('');
  }

  lines.push('----------------------------------------------------------------------');
  lines.push(' ITEMIZED BREAKDOWN');
  lines.push('----------------------------------------------------------------------');
  lines.push(' Description                                    Qty    Rate     Total');
  lines.push('----------------------------------------------------------------------');

  (data.items || []).forEach((item: QuoteLineItem) => {
    const desc = item.description.padEnd(45).substring(0, 45);
    const qty = `${item.quantity} ${item.unit || 'ea'}`.padEnd(7);
    const rate = formatZAR(item.unitPrice).padStart(8);
    const total = formatZAR(item.total).padStart(10);
    lines.push(` ${desc} ${qty} ${rate} ${total}`);
  });

  if (data.calloutFee > 0) {
    lines.push(` Callout & Diagnostic Baseline               1 ea    ${formatZAR(data.calloutFee).padStart(8)} ${formatZAR(data.calloutFee).padStart(10)}`);
  }
  if (data.labourTotal > 0) {
    lines.push(` Technical Labour & Installation Execution   1 lot   ${formatZAR(data.labourTotal).padStart(8)} ${formatZAR(data.labourTotal).padStart(10)}`);
  }
  if (data.travelTotal > 0) {
    lines.push(` Travel & Transport Surcharge                1 trip  ${formatZAR(data.travelTotal).padStart(8)} ${formatZAR(data.travelTotal).padStart(10)}`);
  }

  lines.push('----------------------------------------------------------------------');
  lines.push(` Subtotal (Excl VAT):                                ${formatZAR(data.subtotal).padStart(14)}`);

  if (data.discountAmount && data.discountAmount > 0) {
    lines.push(` Discount (${data.discountPct}%):                                 -${formatZAR(data.discountAmount).padStart(13)}`);
  }

  if (data.vatEnabled) {
    lines.push(` VAT (15%):                                          ${formatZAR(data.vatAmount).padStart(14)}`);
  }

  lines.push(` TOTAL AMOUNT:                                       ${formatZAR(data.totalAmount).padStart(14)}`);
  lines.push('======================================================================');
  lines.push('');
  lines.push(' BANKING DETAILS FOR EFT:');
  lines.push(` Bank:           ${profile.bankName || 'Tyme Bank Business'}`);
  lines.push(` Account Name:   ${profile.accountName || 'Harrys Aircon and Electrical'}`);
  lines.push(` Account Number: ${profile.accountNumber || '53002734919'}`);
  lines.push(` Branch Code:    ${profile.branchCode || '678910'} (${profile.accountType || 'Current'})`);
  lines.push(` Reference:      ${docNumber}`);
  lines.push('');
  lines.push(' TERMS & CONDITIONS:');
  lines.push(` ${(data as Quotation).terms || '80% Deposit on acceptance, balance on completion. All materials remain property of contractor until paid in full.'}`);
  lines.push('======================================================================');

  const textContent = lines.join('\n');
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${docNumber}_${data.clientName.replace(/\s+/g, '_')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

