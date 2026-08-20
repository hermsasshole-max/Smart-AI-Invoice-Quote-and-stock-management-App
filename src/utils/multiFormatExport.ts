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
} from 'docx';
import { Quotation, Invoice, BusinessProfile, QuoteLineItem } from '../types';
import { formatZAR } from './calculator';

export type ExportFormat = 'pdf' | 'xlsx' | 'docx' | 'txt';

export interface ExportResult {
  success: boolean;
  method: 'share' | 'download' | 'open' | 'blob' | 'dataUrl';
  filename: string;
  blobUrl?: string;
  dataUrl?: string;
}

/**
 * Convert Blob to Base64 Data URL string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Universal Mobile/Android & Desktop file delivery:
 * 1. Checks for Android/Mobile Web Share API with files support for native "Save to Device / Drive / WhatsApp / Downloads"
 * 2. Falls back to direct browser blob anchor download
 * 3. Falls back to Base64 Data URI anchor download for iframe sandbox bypass
 * 4. Falls back to window.open for direct view/save
 */
export async function saveOrShareFile(options: {
  blob: Blob;
  filename: string;
  mimeType: string;
  title: string;
  text?: string;
  forceDirectDownload?: boolean;
}): Promise<ExportResult> {
  const { blob, filename, mimeType, title, text, forceDirectDownload } = options;

  let dataUrl: string | undefined;
  try {
    dataUrl = await blobToBase64(blob);
  } catch (err) {
    console.warn('Could not generate base64 data url:', err);
  }

  // 1. Check if user is on mobile and Web Share API can share files (Native Android / iOS Share Sheet)
  if (!forceDirectDownload && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || filename,
          text: text || `${title} from Harry's Aircon Electrical & Solar Services`,
        });
        return { success: true, method: 'share', filename, dataUrl };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User closed or dismissed the share sheet
        return { success: true, method: 'share', filename, dataUrl };
      }
      console.warn('Native Web Share failed, falling back to direct download:', err);
    }
  }

  // 2. Direct Blob / DataURI Download Anchor
  try {
    const url = dataUrl || URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      if (!dataUrl && url.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    }, 300);

    return { success: true, method: 'download', filename, blobUrl: url, dataUrl };
  } catch (err) {
    console.error('Direct anchor download failed, attempting window.open:', err);
    const url = dataUrl || URL.createObjectURL(blob);
    try {
      const win = window.open(url, '_blank');
      if (win) {
        return { success: true, method: 'open', filename, blobUrl: url, dataUrl };
      }
    } catch (e) {
      console.warn('window.open blocked:', e);
    }
    return { success: false, method: 'blob', filename, blobUrl: url, dataUrl };
  }
}

/**
 * Generate jsPDF Document Instance
 */
export function buildJsPDFDocument(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): jsPDF {
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

  return doc;
}

/**
 * Generate standalone printable HTML page for Quotation or Invoice
 */
export function generatePrintableHtml(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): string {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const docSecondaryDate = isInvoice
    ? (data as Invoice).dueDate || 'Upon Presentation'
    : (data as Quotation).expiryDate || '30 Days from issue';

  const rowsHtml = (data.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500; color: #0F172A;">${item.description}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">${item.quantity} ${item.unit || 'ea'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(item.unitPrice)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">${formatZAR(item.total)}</td>
      </tr>`
    )
    .join('');

  const calloutRow =
    data.calloutFee > 0
      ? `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500;">Standard Callout & Technical Diagnostics</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">1 ea</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(data.calloutFee)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700;">${formatZAR(data.calloutFee)}</td>
        </tr>`
      : '';

  const labourRow =
    data.labourTotal > 0
      ? `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500;">Technical Labour & Installation Execution</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">1 lot</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(data.labourTotal)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700;">${formatZAR(data.labourTotal)}</td>
        </tr>`
      : '';

  const travelRow =
    data.travelTotal > 0
      ? `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500;">Travel & Logistics Surcharge</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">1 trip</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(data.travelTotal)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700;">${formatZAR(data.travelTotal)}</td>
        </tr>`
      : '';

  const discountHtml =
    data.discountAmount && data.discountAmount > 0
      ? `<div style="display: flex; justify-content: space-between; color: #DC2626; margin-bottom: 4px; font-weight: 600;">
          <span>Discount (${data.discountPct}%):</span>
          <span>-${formatZAR(data.discountAmount)}</span>
        </div>`
      : '';

  const vatHtml = data.vatEnabled
    ? `<div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 4px;">
        <span>South African VAT (15%):</span>
        <span style="font-weight: 700; color: #0F172A;">${formatZAR(data.vatAmount)}</span>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} ${docNumber} - ${data.clientName}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      background: #F8FAFC;
      margin: 0;
      padding: 16px;
    }
    .print-actions {
      max-width: 800px;
      margin: 0 auto 16px auto;
      display: flex;
      gap: 12px;
      align-items: center;
      background: #1B1E28;
      padding: 12px 16px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn-print {
      background: #0284C7;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print:hover { background: #0369A1; }
    .print-sheet {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .print-actions { display: none !important; }
      .print-sheet { border: none !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn-print" onclick="window.print()">
      🖨️ Tap to Print / Save as PDF
    </button>
    <span style="color: #94A3B8; font-size: 13px; font-family: monospace;">
      On Android: In the print dialog, select <strong>"Save as PDF"</strong> to save to phone.
    </span>
  </div>

  <div class="print-sheet">
    <!-- Header -->
    <div style="background: #1B1E28; color: #ffffff; padding: 24px; border-bottom: 4px solid #38BDF8;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
            ${profile.companyName}
          </h1>
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #38BDF8; font-weight: 500;">
            ${profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"}
          </p>
          <div style="font-size: 11px; color: #CBD5E1; line-height: 1.5; font-family: monospace;">
            <div>Reg: ${profile.regNumber} | VAT: ${profile.vatNumber}</div>
            <div>Tel: ${profile.phone} | Email: ${profile.email}</div>
            <div>Address: ${profile.address} | Web: ${profile.website || 'https://harryselectrical.co.za'}</div>
          </div>
        </div>

        <div style="text-align: right; font-family: monospace;">
          <div style="display: inline-block; padding: 6px 12px; background: rgba(245, 158, 11, 0.2); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 6px; font-size: 14px; font-weight: 900; margin-bottom: 8px;">
            ${docTitle}
          </div>
          <div style="font-size: 12px; color: #CBD5E1; line-height: 1.5;">
            <div><span style="color: #94A3B8;">Ref #:</span> <strong style="color: #ffffff;">${docNumber}</strong></div>
            <div><span style="color: #94A3B8;">Date:</span> ${data.date}</div>
            <div><span style="color: #94A3B8;">${isInvoice ? 'Due Date:' : 'Valid Until:'}</span> ${docSecondaryDate}</div>
            <div style="color: #38BDF8; font-weight: 700; text-transform: uppercase; margin-top: 4px;">Status: ${data.status}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Client & Site -->
    <div style="padding: 20px 24px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #0284C7; font-family: monospace;">
            ${isInvoice ? 'Billed To / Site Location' : 'Client & Site Details'}
          </h4>
          <div style="font-size: 13px; line-height: 1.5; color: #334155;">
            <div style="font-weight: 700; color: #0F172A; font-size: 14px;">${data.clientName}</div>
            <div>📞 ${data.clientPhone}</div>
            ${data.clientEmail ? `<div>✉️ ${data.clientEmail}</div>` : ''}
            <div>📍 ${data.clientAddress}</div>
          </div>
        </div>

        <div>
          <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #0284C7; font-family: monospace;">
            Job Specifications
          </h4>
          <div style="font-size: 13px; line-height: 1.5; color: #334155;">
            <div><span style="color: #64748B;">Category:</span> <strong>${data.serviceType}</strong></div>
            ${
              data.scopeOfWork
                ? `<div style="margin-top: 8px; padding: 10px; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 6px; color: #92400E; font-size: 12px;">
                    <strong style="display: block; font-size: 10px; text-transform: uppercase; font-family: monospace; color: #B45309; margin-bottom: 2px;">Scope of Work</strong>
                    ${data.scopeOfWork}
                  </div>`
                : ''
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #0284C7; color: #ffffff; font-family: monospace; text-transform: uppercase; font-size: 11px;">
            <th style="padding: 10px 12px; text-align: left; border-radius: 4px 0 0 4px;">Item / Description</th>
            <th style="padding: 10px 12px; text-align: center;">Qty</th>
            <th style="padding: 10px 12px; text-align: right;">Rate (ZAR)</th>
            <th style="padding: 10px 12px; text-align: right; border-radius: 0 4px 4px 0;">Total (ZAR)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          ${calloutRow}
          ${labourRow}
          ${travelRow}
        </tbody>
      </table>

      <!-- Totals & Banking -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; padding-top: 16px; border-top: 2px solid #E2E8F0;">
        <div style="background: #F1F5F9; padding: 14px; border-radius: 8px; border: 1px solid #E2E8F0; font-family: monospace; font-size: 11px;">
          <div style="font-weight: 700; color: #0284C7; text-transform: uppercase; margin-bottom: 8px;">
            🏦 Banking Details (EFT Settlement)
          </div>
          <div style="line-height: 1.6; color: #334155;">
            <div>Bank: <strong>${profile.bankName || 'Tyme Bank Business'}</strong></div>
            <div>Account Name: <strong>${profile.accountName || 'Harrys Aircon and Electrical'}</strong></div>
            <div>Account Number: <strong>${profile.accountNumber || '53002734919'}</strong></div>
            <div>Branch Code: <strong>${profile.branchCode || '678910'}</strong> (${profile.accountType || 'Current'})</div>
            <div>Reference: <strong style="color: #0284C7;">${docNumber}</strong></div>
          </div>
        </div>

        <div style="font-family: monospace; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 4px;">
            <span>Subtotal (Excl VAT):</span>
            <span style="font-weight: 700; color: #0F172A;">${formatZAR(data.subtotal)}</span>
          </div>
          ${discountHtml}
          ${vatHtml}
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: #0F172A; padding-top: 8px; border-top: 2px solid #CBD5E1; margin-top: 4px;">
            <span>TOTAL:</span>
            <span style="color: #0284C7;">${formatZAR(data.totalAmount)}</span>
          </div>
        </div>
      </div>

      <!-- Footer Terms -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #64748B; font-style: italic; line-height: 1.5;">
        <div><strong>Terms:</strong> ${(data as Quotation).terms || '80% Deposit on acceptance, balance on completion. All materials remain property of contractor until paid in full.'}</div>
        <div style="margin-top: 4px;">Certified SANS 10142 compliance & workmanship warranty from Harry's Aircon Electrical & Solar Services.</div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      // Auto trigger print when loaded
      setTimeout(() => {
        try { window.print(); } catch(e) {}
      }, 500);
    });
  </script>
</body>
</html>`;
}

/**
 * Open Standalone Print Dialog Window (Bypasses iframe sandboxes)
 */
export function printHtmlDocument(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): void {
  const html = generatePrintableHtml(docType, data, profile);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    // If popup blocked, create invisible iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      try {
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print error:', err);
      }
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 60000);
    }
  }
}

/**
 * Open PDF Directly in a New Browser Tab (Data URI / Blob)
 */
export async function openPdfInNewTab(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): Promise<void> {
  const doc = buildJsPDFDocument(docType, data, profile);
  const blob = doc.output('blob');
  const dataUrl = await blobToBase64(blob);
  
  const win = window.open(dataUrl, '_blank');
  if (!win) {
    // If popup blocked, create link and click
    const a = document.createElement('a');
    a.href = dataUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 500);
  }
}

/**
 * Generate PDF for Quotation or Invoice with Harry's Brand Identity and save/share
 */
export async function exportToPDF(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDirectDownload = false
): Promise<ExportResult> {
  const doc = buildJsPDFDocument(docType, data, profile);
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'Tax Invoice' : 'Quotation';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const filename = `${docNumber}_${data.clientName.replace(/\s+/g, '_')}.pdf`;

  const blob = doc.output('blob');
  return await saveOrShareFile({
    blob,
    filename,
    mimeType: 'application/pdf',
    title: `${docTitle} ${docNumber} - ${data.clientName}`,
    text: `Here is your official ${docTitle} ${docNumber} from Harry's Aircon Electrical and Solar Services for ${formatZAR(data.totalAmount)}.`,
    forceDirectDownload,
  });
}

/**
 * Generate Excel (.xlsx) spreadsheet with Official Brand Headers
 */
export async function exportToExcel(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDirectDownload = false
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const filename = `${docNumber}_${data.clientName.replace(/\s+/g, '_')}.xlsx`;

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

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return await saveOrShareFile({
    blob,
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    title: `${docTitle} ${docNumber} Spreadsheet`,
    text: `Spreadsheet export for ${docTitle} ${docNumber}`,
    forceDirectDownload,
  });
}

/**
 * Generate Word (.docx) formatted document with Harry's Brand Theme
 */
export async function exportToWord(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDirectDownload = false
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const filename = `${docNumber}_${data.clientName.replace(/\s+/g, '_')}.docx`;
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
  return await saveOrShareFile({
    blob,
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title: `${docTitle} ${docNumber} Word Document`,
    text: `Word Doc export for ${docTitle} ${docNumber}`,
    forceDirectDownload,
  });
}

/**
 * Generate Plain Text (.txt) summary
 */
export async function exportToPlainText(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDirectDownload = false
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const filename = `${docNumber}_${data.clientName.replace(/\s+/g, '_')}.txt`;

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
  return await saveOrShareFile({
    blob,
    filename,
    mimeType: 'text/plain',
    title: `${docTitle} ${docNumber} Plain Text`,
    text: `Plain text summary for ${docTitle} ${docNumber}`,
    forceDirectDownload,
  });
}

