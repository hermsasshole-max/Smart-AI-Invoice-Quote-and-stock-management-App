import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
} from 'docx';
import { BusinessProfile, Quotation, Invoice } from '../types';
import { formatZAR } from './calculator';

export interface ExportResult {
  filename: string;
  method: 'share' | 'download' | 'open';
}

/**
 * Convert Blob to Base64 data URL
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
 * Universal Mobile-Safe & Android WebView File Saver:
 * 1. Native Android Bridge (window.AndroidInterface.saveFile) if running in Android app
 * 2. Web Share API (navigator.canShare with files) for native Android share sheet
 * 3. Standard <a> download stream via Object URL
 * 4. Fallback Data URI window.open
 */
export async function saveOrShareFile(
  blob: Blob,
  filename: string,
  mimeType: string,
  title: string,
  forceDownloadOnly: boolean = false
): Promise<ExportResult> {
  // 1. Check for dedicated Android JavascriptInterface bridge (save directly to public Downloads)
  if (typeof window !== 'undefined' && window.AndroidInterface?.saveFile) {
    try {
      const base64Data = await blobToBase64(blob);
      window.AndroidInterface.saveFile(base64Data, filename, mimeType);
      return { filename, method: 'download' };
    } catch (bridgeErr) {
      console.warn('AndroidInterface.saveFile failed, falling back:', bridgeErr);
    }
  }

  // 2. Try Web Share API on mobile/WebView devices if available & not forced to download
  if (!forceDownloadOnly && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: `${title} - ${filename}`,
        });
        return { filename, method: 'share' };
      }
    } catch (shareErr: any) {
      if (shareErr.name !== 'AbortError') {
        console.warn('Navigator share error, falling back to download:', shareErr);
      } else {
        return { filename, method: 'share' };
      }
    }
  }

  // 3. Browser download via object URL
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1000);
    return { filename, method: 'download' };
  } catch (downloadErr) {
    // 4. Fallback: Open in new tab via Data URL
    const dataUrl = await blobToBase64(blob);
    const win = window.open(dataUrl, '_blank');
    if (!win) {
      window.location.href = dataUrl;
    }
    return { filename, method: 'open' };
  }
}

/**
 * Build jsPDF Document Instance with Smart Auto-Scaling:
 * Calculates total vertical points. If the document height overflows Page 1 by 25% or less
 * (<= 1.25 standard page height), it dynamically scales and condenses font sizes, line heights,
 * table cell padding, and margin spacing onto a single pristine page.
 * If overflow > 25%, standard multi-page flow is used.
 */
export function buildJsPDFDocument(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const docSecondaryDate = isInvoice
    ? (data as Invoice).dueDate || 'Upon Presentation'
    : (data as Quotation).expiryDate || '30 Days from issue';

  // Table items preparation
  const tableRows: any[] = [];
  (data.items || []).forEach((item) => {
    tableRows.push([
      item.description,
      `${item.quantity} ${item.unit || 'ea'}`,
      formatZAR(item.unitPrice),
      formatZAR(item.total),
    ]);
  });

  if (data.calloutFee > 0) {
    tableRows.push(['Standard Callout & Technical Diagnostics', '1 ea', formatZAR(data.calloutFee), formatZAR(data.calloutFee)]);
  }
  if (data.labourTotal > 0) {
    tableRows.push([`Technical Labour & Installation Execution (${data.labourHours} hrs)`, '1 lot', formatZAR(data.labourTotal), formatZAR(data.labourTotal)]);
  }
  if (data.travelTotal > 0) {
    tableRows.push([`Logistics & Travel Surcharge (${data.travelDistanceKm} km)`, '1 trip', formatZAR(data.travelTotal), formatZAR(data.travelTotal)]);
  }

  // Smart Auto-Scaling Calculation:
  // Standard A4 height is 297mm.
  // Standard unscaled height estimation:
  // Header: 42mm + Client Box: 36mm + Table (rows * 8.5mm + 12mm) + Banking/Totals: 42mm + Footer: 22mm = 154 + (rows * 8.5)
  const estimatedUnscaledHeight = 154 + (tableRows.length * 8.5);
  const overflowRatio = estimatedUnscaledHeight / 297;
  const shouldCondenseSinglePage = overflowRatio > 0.95 && overflowRatio <= 1.25;

  // Scale parameters based on single-page condensing calculation
  const headerHeight = shouldCondenseSinglePage ? 36 : 42;
  const clientBoxY = shouldCondenseSinglePage ? 41 : 48;
  const clientBoxHeight = shouldCondenseSinglePage ? 26 : 34;
  const tableStartY = shouldCondenseSinglePage ? 70 : 86;
  const tableFontSize = shouldCondenseSinglePage ? 7.5 : 8.5;
  const tableHeadFontSize = shouldCondenseSinglePage ? 8 : 9;
  const tableCellPadding = shouldCondenseSinglePage ? 1.8 : 3;
  const bankingBoxHeight = shouldCondenseSinglePage ? 28 : 36;
  const lineSpacing = shouldCondenseSinglePage ? 4.5 : 5.5;

  // Primary Header Banner (#1B1E28)
  doc.setFillColor(27, 30, 40);
  doc.rect(0, 0, 210, headerHeight, 'F');

  // Accent Line (#38BDF8)
  doc.setFillColor(56, 189, 248);
  doc.rect(0, headerHeight, 210, 2, 'F');

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 14 : 16);
  doc.text(profile.companyName.toUpperCase(), 14, shouldCondenseSinglePage ? 12 : 15);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(shouldCondenseSinglePage ? 8 : 9);
  doc.setTextColor(56, 189, 248);
  doc.text(profile.tagline || 'Electrical • Air Conditioning • Solar • Security', 14, shouldCondenseSinglePage ? 17 : 21);

  // Contact Info
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Reg: ${profile.regNumber} | VAT: ${profile.vatNumber}`, 14, shouldCondenseSinglePage ? 22 : 27);
  doc.text(`Tel: ${profile.phone} | Email: ${profile.email}`, 14, shouldCondenseSinglePage ? 27 : 32);
  if (!shouldCondenseSinglePage) {
    doc.text(`Address: ${profile.address}`, 14, 37);
  }

  // Document Title Badge (Right Side)
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(140, shouldCondenseSinglePage ? 8 : 10, 56, shouldCondenseSinglePage ? 8.5 : 10, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 9.5 : 11);
  doc.text(docTitle, 168, shouldCondenseSinglePage ? 13.5 : 16.5, { align: 'center' });

  // Metadata Details
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Ref #: ${docNumber}`, 140, shouldCondenseSinglePage ? 21 : 26);
  doc.text(`Date: ${data.date}`, 140, shouldCondenseSinglePage ? 26 : 31);
  doc.text(`${isInvoice ? 'Due Date' : 'Valid Until'}: ${docSecondaryDate}`, 140, shouldCondenseSinglePage ? 31 : 36);

  // Client Details & Scope Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, clientBoxY, 182, clientBoxHeight, 2, 2, 'FD');

  doc.setTextColor(2, 132, 199);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 8 : 9);
  doc.text(isInvoice ? 'BILLED TO & SITE LOCATION' : 'CLIENT & SITE DETAILS', 18, clientBoxY + (shouldCondenseSinglePage ? 5 : 7));

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(shouldCondenseSinglePage ? 9 : 10);
  doc.text(data.clientName, 18, clientBoxY + (shouldCondenseSinglePage ? 11 : 14));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${data.clientPhone} ${data.clientEmail ? '| Email: ' + data.clientEmail : ''}`, 18, clientBoxY + (shouldCondenseSinglePage ? 16 : 20));
  doc.text(`Site Address: ${data.clientAddress}`, 18, clientBoxY + (shouldCondenseSinglePage ? 21 : 26));

  // Scope info (Right column inside box)
  doc.setTextColor(2, 132, 199);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB SPECIFICATION', 110, clientBoxY + (shouldCondenseSinglePage ? 5 : 7));
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Category: ${data.serviceType}`, 110, clientBoxY + (shouldCondenseSinglePage ? 11 : 14));
  
  const splitScope = doc.splitTextToSize(data.scopeOfWork || 'On-site technical scope', 80);
  doc.text(splitScope.slice(0, 2), 110, clientBoxY + (shouldCondenseSinglePage ? 16 : 20));

  // Draw autoTable
  autoTable(doc, {
    startY: tableStartY,
    head: [['Item / Description', 'Qty', 'Unit Rate (ZAR)', 'Total (ZAR)']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [2, 132, 199],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: tableHeadFontSize,
    },
    styles: {
      fontSize: tableFontSize,
      textColor: [15, 23, 42],
      cellPadding: tableCellPadding,
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + (shouldCondenseSinglePage ? 4 : 6);

  // Banking Details Box (Left)
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY, 105, bankingBoxHeight, 2, 2, 'FD');

  doc.setTextColor(2, 132, 199);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.text('BANKING DETAILS (EFT SETTLEMENT)', 18, finalY + (shouldCondenseSinglePage ? 5 : 6));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(shouldCondenseSinglePage ? 7 : 8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Bank: ${profile.bankName || 'Tyme Bank Business'}`, 18, finalY + (shouldCondenseSinglePage ? 10 : 12));
  doc.text(`Account Name: ${profile.accountName || 'Harrys Aircon and Electrical'}`, 18, finalY + (shouldCondenseSinglePage ? 14 : 17));
  doc.text(`Account Number: ${profile.accountNumber || '53002734919'}`, 18, finalY + (shouldCondenseSinglePage ? 18 : 22));
  doc.text(`Branch Code: ${profile.branchCode || '678910'} (${profile.accountType || 'Current'})`, 18, finalY + (shouldCondenseSinglePage ? 22 : 27));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(`Reference: ${docNumber}`, 18, finalY + (shouldCondenseSinglePage ? 26 : 32));

  // Financial Totals (Right)
  let totalsY = finalY + (shouldCondenseSinglePage ? 3 : 4);
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');

  doc.text('Subtotal (Excl VAT):', 130, totalsY);
  doc.text(formatZAR(data.subtotal), 196, totalsY, { align: 'right' });

  if (data.discountAmount && data.discountAmount > 0) {
    totalsY += lineSpacing;
    doc.setTextColor(220, 38, 38);
    doc.text(`Discount (${data.discountPct}%):`, 130, totalsY);
    doc.text(`-${formatZAR(data.discountAmount)}`, 196, totalsY, { align: 'right' });
  }

  if (data.vatEnabled) {
    totalsY += lineSpacing;
    doc.setTextColor(71, 85, 105);
    doc.text('South African VAT (15%):', 130, totalsY);
    doc.text(formatZAR(data.vatAmount), 196, totalsY, { align: 'right' });
  }

  // Total Line
  totalsY += lineSpacing + 2;
  doc.setDrawColor(203, 213, 225);
  doc.line(130, totalsY - 2, 196, totalsY - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 9.5 : 11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL AMOUNT:', 130, totalsY + 2);
  doc.setTextColor(2, 132, 199);
  doc.text(formatZAR(data.totalAmount), 196, totalsY + 2, { align: 'right' });

  // Footer Terms & SANS Notice
  const footerY = shouldCondenseSinglePage ? 280 : 272;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY, 196, footerY);

  doc.setFontSize(shouldCondenseSinglePage ? 6.8 : 7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Terms: ${(data as Quotation).terms || '80% Deposit on acceptance, balance on completion. Materials remain property of contractor until settled.'}`,
    14,
    footerY + 4
  );
  doc.text(
    `${profile.sansComplianceNotice} | Registered SANS 10142 Electrical & SAQCC HVAC Contractor`,
    14,
    footerY + (shouldCondenseSinglePage ? 7.5 : 9)
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
        <div style="margin-top: 4px;">Certified SANS 10142 compliance & workmanship warranty from Harry\'s Aircon Electrical & Solar Services.</div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        try { window.print(); } catch(e) {}
      }, 500);
    });
  </script>
</body>
</html>`;
}

/**
 * Open Standalone Print Dialog Window or Android Native Print Adapter
 */
export function printHtmlDocument(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): void {
  // 1. Android Native Print Adapter (PrintManager & WebKit PrintDocumentAdapter)
  if (typeof window !== 'undefined' && window.AndroidInterface?.printDocument) {
    try {
      window.AndroidInterface.printDocument();
      return;
    } catch (printErr) {
      console.warn('AndroidInterface.printDocument error, using web print:', printErr);
    }
  }

  // 2. Standard Web print fallback
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
 * Direct Native Share (triggers Android Share Sheet / Web Share)
 */
export async function shareDocumentDirectly(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  format: 'pdf' | 'excel' | 'word' | 'txt' = 'pdf'
): Promise<ExportResult> {
  let blob: Blob;
  let filename: string;
  let mimeType: string;
  const docNumber = docType === 'invoice' ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const sanitizedClient = data.clientName.replace(/[^a-zA-Z0-9]/g, '_');
  const title = `${docType === 'invoice' ? 'Tax Invoice' : 'Quotation'} ${docNumber}`;

  if (format === 'pdf') {
    const doc = buildJsPDFDocument(docType, data, profile);
    blob = doc.output('blob');
    filename = `${docType.toUpperCase()}_${docNumber}_${sanitizedClient}.pdf`;
    mimeType = 'application/pdf';
  } else if (format === 'excel') {
    return await exportToExcel(docType, data, profile, false);
  } else if (format === 'word') {
    return await exportToWord(docType, data, profile, false);
  } else {
    return await exportToPlainText(docType, data, profile, false);
  }

  // Check Android bridge share
  if (typeof window !== 'undefined' && window.AndroidInterface?.shareFile) {
    try {
      const base64Data = await blobToBase64(blob);
      window.AndroidInterface.shareFile(base64Data, filename, mimeType, title);
      return { filename, method: 'share' };
    } catch (err) {
      console.warn('AndroidInterface.shareFile failed:', err);
    }
  }

  // Web Share API fallback
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: `${title} for ${data.clientName}`,
        });
        return { filename, method: 'share' };
      }
    } catch (shareErr: any) {
      if (shareErr.name !== 'AbortError') {
        console.warn('Web Share failed:', shareErr);
      }
    }
  }

  // Fallback to standard save
  return await saveOrShareFile(blob, filename, mimeType, title, true);
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
  forceDownloadOnly: boolean = false
): Promise<ExportResult> {
  const doc = buildJsPDFDocument(docType, data, profile);
  const blob = doc.output('blob');
  const docNumber = docType === 'invoice' ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const title = `${docType === 'invoice' ? 'Tax Invoice' : 'Quotation'} ${docNumber}`;

  return await saveOrShareFile(blob, filename, 'application/pdf', title, forceDownloadOnly);
}

/**
 * Export Quotation or Invoice as Microsoft Excel (.xlsx) Spreadsheet
 */
export async function exportToExcel(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDownloadOnly: boolean = false
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;

  const headerRows = [
    [profile.companyName.toUpperCase()],
    [profile.tagline],
    [`Reg: ${profile.regNumber}`, `VAT: ${profile.vatNumber}`, `Tel: ${profile.phone}`, `Email: ${profile.email}`],
    [`Address: ${profile.address}`],
    [],
    [`DOCUMENT: ${docTitle}`, `REF NUMBER: ${docNumber}`, `DATE: ${data.date}`],
    [`CLIENT: ${data.clientName}`, `PHONE: ${data.clientPhone}`, `SITE: ${data.clientAddress}`],
    [`SERVICE CATEGORY: ${data.serviceType}`],
    [`SCOPE: ${data.scopeOfWork || 'On-site technical work'}`],
    [],
    ['Item / Description', 'Category', 'Quantity', 'Unit', 'Unit Price (ZAR)', 'Total (ZAR)'],
  ];

  const itemRows = (data.items || []).map((item) => [
    item.description,
    item.category,
    item.quantity,
    item.unit || 'ea',
    item.unitPrice,
    item.total,
  ]);

  if (data.calloutFee > 0) {
    itemRows.push(['Standard Callout & Technical Diagnostics', 'Callout', 1, 'ea', data.calloutFee, data.calloutFee]);
  }
  if (data.labourTotal > 0) {
    itemRows.push([`Technical Labour (${data.labourHours} hrs)`, 'Labour', 1, 'lot', data.labourTotal, data.labourTotal]);
  }
  if (data.travelTotal > 0) {
    itemRows.push([`Logistics & Travel Surcharge (${data.travelDistanceKm} km)`, 'Travel', 1, 'trip', data.travelTotal, data.travelTotal]);
  }

  const totalsRows = [
    [],
    ['', '', '', '', 'Subtotal (Excl VAT):', data.subtotal],
    ...(data.discountAmount && data.discountAmount > 0
      ? [['', '', '', '', `Discount (${data.discountPct}%):`, -data.discountAmount]]
      : []),
    ...(data.vatEnabled ? [['', '', '', '', 'VAT (15%):', data.vatAmount]] : []),
    ['', '', '', '', 'TOTAL AMOUNT (ZAR):', data.totalAmount],
    [],
    ['BANKING DETAILS (EFT SETTLEMENT):'],
    [`Bank: ${profile.bankName || 'Tyme Bank Business'}`],
    [`Account Name: ${profile.accountName || 'Harrys Aircon and Electrical'}`],
    [`Account Number: ${profile.accountNumber || '53002734919'}`],
    [`Branch Code: ${profile.branchCode || '678910'}`],
    [`Reference: ${docNumber}`],
  ];

  const wsData = [...headerRows, ...itemRows, ...totalsRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 45 },
    { wch: 20 },
    { wch: 10 },
    { wch: 8 },
    { wch: 18 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, docType === 'invoice' ? 'Tax Invoice' : 'Quotation');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  const title = `${docType === 'invoice' ? 'Tax Invoice Spreadsheet' : 'Quotation Spreadsheet'} ${docNumber}`;

  return await saveOrShareFile(
    blob,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    title,
    forceDownloadOnly
  );
}

/**
 * Export Quotation or Invoice as Microsoft Word (.docx) Document
 */
export async function exportToWord(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDownloadOnly: boolean = false
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const docSecondaryDate = isInvoice
    ? (data as Invoice).dueDate || 'Upon Presentation'
    : (data as Quotation).expiryDate || '30 Days from issue';

  const tableHeader = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Item / Description', bold: true, color: 'FFFFFF' })] })],
        shading: { fill: '0284C7' },
        width: { size: 50, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Qty', bold: true, color: 'FFFFFF' })] })],
        shading: { fill: '0284C7' },
        width: { size: 15, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Unit Rate (ZAR)', bold: true, color: 'FFFFFF' })] })],
        shading: { fill: '0284C7' },
        width: { size: 17, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Total (ZAR)', bold: true, color: 'FFFFFF' })] })],
        shading: { fill: '0284C7' },
        width: { size: 18, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  const tableRows: TableRow[] = [tableHeader];

  (data.items || []).forEach((item) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(item.description)] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: `${item.quantity} ${item.unit || 'ea'}` })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: formatZAR(item.unitPrice) })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatZAR(item.total), bold: true })] })] }),
        ],
      })
    );
  });

  if (data.calloutFee > 0) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Standard Callout & Technical Diagnostics')] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: '1 ea' })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: formatZAR(data.calloutFee) })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatZAR(data.calloutFee), bold: true })] })] }),
        ],
      })
    );
  }

  if (data.labourTotal > 0) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(`Technical Labour & Execution (${data.labourHours} hrs)`)] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: '1 lot' })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: formatZAR(data.labourTotal) })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatZAR(data.labourTotal), bold: true })] })] }),
        ],
      })
    );
  }

  if (data.travelTotal > 0) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(`Logistics & Travel Surcharge (${data.travelDistanceKm} km)`)] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: '1 trip' })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: formatZAR(data.travelTotal) })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatZAR(data.travelTotal), bold: true })] })] }),
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
            text: profile.companyName.toUpperCase(),
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: profile.tagline || 'From Electrical to Aircons, security to automation, we\'ve got you covered',
                italics: true,
                color: '0284C7',
              }),
            ],
          }),
          new Paragraph({
            text: `Reg: ${profile.regNumber} | VAT: ${profile.vatNumber} | Tel: ${profile.phone} | Email: ${profile.email}`,
          }),
          new Paragraph({ text: `Address: ${profile.address}` }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: `${docTitle}: `, bold: true, size: 28, color: '0284C7' }),
              new TextRun({ text: docNumber, bold: true, size: 28 }),
            ],
          }),
          new Paragraph({
            text: `Date: ${data.date} | ${isInvoice ? 'Due Date' : 'Valid Until'}: ${docSecondaryDate} | Status: ${data.status.toUpperCase()}`,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Client: ', bold: true }),
              new TextRun(data.clientName),
              new TextRun({ text: ' | Phone: ', bold: true }),
              new TextRun(data.clientPhone),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Site Address: ', bold: true }),
              new TextRun(data.clientAddress),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Scope: ', bold: true }),
              new TextRun(`${data.serviceType} - ${data.scopeOfWork || 'On-site technical scope'}`),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `Subtotal (Excl VAT): ${formatZAR(data.subtotal)}`, bold: true }),
            ],
          }),
          ...(data.discountAmount && data.discountAmount > 0
            ? [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `Discount (${data.discountPct}%): -${formatZAR(data.discountAmount)}`,
                      color: 'DC2626',
                    }),
                  ],
                }),
              ]
            : []),
          ...(data.vatEnabled
            ? [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: `VAT (15%): ${formatZAR(data.vatAmount)}` }),
                  ],
                }),
              ]
            : []),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `TOTAL AMOUNT: ${formatZAR(data.totalAmount)}`,
                bold: true,
                size: 28,
                color: '0284C7',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: 'BANKING DETAILS (EFT SETTLEMENT):', bold: true, color: '0284C7' })],
          }),
          new Paragraph({ text: `Bank: ${profile.bankName || 'Tyme Bank Business'}` }),
          new Paragraph({ text: `Account Name: ${profile.accountName || 'Harrys Aircon and Electrical'}` }),
          new Paragraph({ text: `Account Number: ${profile.accountNumber || '53002734919'}` }),
          new Paragraph({ text: `Branch Code: ${profile.branchCode || '678910'}` }),
          new Paragraph({ text: `Reference: ${docNumber}` }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Terms: ${(data as Quotation).terms || '80% Deposit on acceptance, balance on completion.'}`,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  const title = `${docType === 'invoice' ? 'Tax Invoice Word Document' : 'Quotation Word Document'} ${docNumber}`;

  return await saveOrShareFile(
    blob,
    filename,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title,
    forceDownloadOnly
  );
}

/**
 * Export Quotation or Invoice as Clean Plain Text (.txt) Document
 */
export async function exportToPlainText(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDownloadOnly: boolean = false
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const docSecondaryDate = isInvoice
    ? (data as Invoice).dueDate || 'Upon Presentation'
    : (data as Quotation).expiryDate || '30 Days from issue';

  let text = `================================================================================\n`;
  text += `${profile.companyName.toUpperCase()}\n`;
  text += `${profile.tagline}\n`;
  text += `Reg: ${profile.regNumber} | VAT: ${profile.vatNumber}\n`;
  text += `Tel: ${profile.phone} | Email: ${profile.email}\n`;
  text += `Address: ${profile.address}\n`;
  text += `================================================================================\n\n`;
  text += `DOCUMENT:       ${docTitle}\n`;
  text += `REFERENCE NO:   ${docNumber}\n`;
  text += `DATE ISSUED:    ${data.date}\n`;
  text += `${isInvoice ? 'DUE DATE:' : 'VALID UNTIL:'}   ${docSecondaryDate}\n`;
  text += `STATUS:         ${data.status.toUpperCase()}\n\n`;
  text += `CLIENT DETAILS:\n`;
  text += `Name:           ${data.clientName}\n`;
  text += `Phone:          ${data.clientPhone}\n`;
  if (data.clientEmail) text += `Email:          ${data.clientEmail}\n`;
  text += `Site Address:   ${data.clientAddress}\n`;
  text += `Category:       ${data.serviceType}\n`;
  text += `Scope of Work:  ${data.scopeOfWork || 'On-site technical scope'}\n\n`;
  text += `--------------------------------------------------------------------------------\n`;
  text += `ITEMIZED PRICING SCHEDULE:\n`;
  text += `--------------------------------------------------------------------------------\n`;

  (data.items || []).forEach((item, index) => {
    text += `${index + 1}. ${item.description}\n`;
    text += `   Qty: ${item.quantity} ${item.unit || 'ea'} | Unit Rate: ${formatZAR(item.unitPrice)} | Total: ${formatZAR(item.total)}\n`;
  });

  if (data.calloutFee > 0) {
    text += `• Standard Callout & Diagnostics: ${formatZAR(data.calloutFee)}\n`;
  }
  if (data.labourTotal > 0) {
    text += `• Technical Labour (${data.labourHours} hrs @ ${formatZAR(data.labourRatePerHour)}/hr): ${formatZAR(data.labourTotal)}\n`;
  }
  if (data.travelTotal > 0) {
    text += `• Logistics & Travel (${data.travelDistanceKm} km): ${formatZAR(data.travelTotal)}\n`;
  }

  text += `--------------------------------------------------------------------------------\n`;
  text += `Subtotal (Excl VAT):               ${formatZAR(data.subtotal)}\n`;
  if (data.discountAmount && data.discountAmount > 0) {
    text += `Discount (${data.discountPct}%):                  -${formatZAR(data.discountAmount)}\n`;
  }
  if (data.vatEnabled) {
    text += `VAT (15%):                         ${formatZAR(data.vatAmount)}\n`;
  }
  text += `TOTAL AMOUNT:                      ${formatZAR(data.totalAmount)}\n`;
  text += `================================================================================\n\n`;
  text += `BANKING DETAILS (EFT SETTLEMENT):\n`;
  text += `Bank:           ${profile.bankName || 'Tyme Bank Business'}\n`;
  text += `Account Name:   ${profile.accountName || 'Harrys Aircon and Electrical'}\n`;
  text += `Account Number: ${profile.accountNumber || '53002734919'}\n`;
  text += `Branch Code:    ${profile.branchCode || '678910'}\n`;
  text += `Reference:      ${docNumber}\n\n`;
  text += `TERMS & CONDITIONS:\n`;
  text += `${(data as Quotation).terms || '80% Deposit on acceptance, balance on completion. Certified SANS 10142 compliance.'}\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  const title = `${docType === 'invoice' ? 'Tax Invoice Text' : 'Quotation Text'} ${docNumber}`;

  return await saveOrShareFile(blob, filename, 'text/plain', title, forceDownloadOnly);
}
