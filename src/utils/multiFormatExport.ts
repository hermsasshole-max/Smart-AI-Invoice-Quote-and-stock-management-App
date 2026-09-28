import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
} from 'docx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { BusinessProfile, Quotation, Invoice } from '../types';
import { formatZAR } from './calculator';

export interface ExportResult {
  filename: string;
  method: 'share' | 'download' | 'open';
}

/**
 * Universal helper to open external links (WhatsApp, mailto, etc.) safely on Android, Capacitor and Web
 */
export function openExternalUrl(url: string): void {
  if (typeof window !== 'undefined' && window.AndroidInterface?.openUrl) {
    try {
      window.AndroidInterface.openUrl(url);
      return;
    } catch (e) {
      console.warn('AndroidInterface.openUrl failed, falling back:', e);
    }
  }

  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 1000);
  } catch (e) {
    window.location.href = url;
  }
}

// Resilient helper to execute autoTable regardless of CJS/ESM bundling
function applyAutoTable(doc: jsPDF, options: any) {
  try {
    if (typeof autoTable === 'function') {
      autoTable(doc, options);
    } else if ((autoTable as any)?.default && typeof (autoTable as any).default === 'function') {
      (autoTable as any).default(doc, options);
    } else if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(options);
    } else {
      console.warn('AutoTable plugin not detected, continuing with basic document layout');
    }
  } catch (err) {
    console.error('applyAutoTable execution error:', err);
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Universal, infallible file downloader for web browsers, PWA, iframes, and Android WebViews
 */
export async function downloadBlob(blob: Blob, filename: string, mimeType: string): Promise<boolean> {
  // 1. Android Native Bridge if running inside an Android WebView container
  if (typeof window !== 'undefined' && window.AndroidInterface?.saveFile) {
    try {
      const base64Data = await blobToBase64(blob);
      const res = window.AndroidInterface.saveFile(base64Data, filename, mimeType);
      if (res !== false) return true;
    } catch (bridgeErr) {
      console.warn('AndroidInterface.saveFile failed, proceeding to Capacitor / Web download:', bridgeErr);
    }
  }

  // 2. Capacitor Native Filesystem for installed Android apps
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      
      const saved = await Filesystem.writeFile({
        path: filename,
        data: cleanData,
        directory: Directory.Documents,
        recursive: true,
      });

      // Prompt user with Share sheet to immediately save to Downloads, Google Drive, or view
      try {
        await Share.share({
          title: `Saved: ${filename}`,
          url: saved.uri,
          dialogTitle: `Save or Open ${filename}`,
        });
      } catch (shareErr) {
        // user dismissed sheet
      }
      return true;
    } catch (capErr) {
      console.warn('Capacitor Filesystem.writeFile error, falling back to Web API:', capErr);
    }
  }

  // 3. Standard Blob Object URL download for Web & PWA
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_self';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Revoke after 30 seconds to allow slow mobile devices to finish streaming
    setTimeout(() => {
      try {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      } catch (e) {}
    }, 30000);
    return true;
  } catch (blobErr) {
    console.warn('Blob URL download failed, trying Base64 data URI:', blobErr);
  }

  // 4. Base64 Data URI fallback (works when blob: is restricted by sandboxed iframes)
  try {
    const dataUrl = await blobToBase64(blob);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.target = '_self';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      } catch (e) {}
    }, 15000);
    return true;
  } catch (dataUrlErr) {
    console.error('Data URL fallback also failed:', dataUrlErr);
    return false;
  }
}

export async function saveOrShareFile(
  blob: Blob,
  filename: string,
  mimeType: string,
  title: string,
  forceDownloadOnly: boolean = true
): Promise<ExportResult> {
  // If download is requested (default for all download and export buttons)
  if (forceDownloadOnly) {
    await downloadBlob(blob, filename, mimeType);
    return { filename, method: 'download' };
  }

  // 1. Android Native Bridge
  if (typeof window !== 'undefined' && window.AndroidInterface?.shareFile) {
    try {
      const base64Data = await blobToBase64(blob);
      const res = window.AndroidInterface.shareFile(base64Data, filename, mimeType, title);
      if (res !== false) return { filename, method: 'share' };
    } catch (err) {
      console.warn('AndroidInterface.shareFile error:', err);
    }
  }

  // 2. Capacitor Native Share
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: cleanData,
        directory: Directory.Cache,
      });
      await Share.share({
        title: title,
        text: `${title} - ${filename}`,
        url: fileResult.uri,
        dialogTitle: title,
      });
      return { filename, method: 'share' };
    } catch (capErr: any) {
      if (capErr?.message?.includes('canceled') || capErr?.name === 'AbortError') {
        return { filename, method: 'share' };
      }
      console.warn('Capacitor Share failed, trying web share:', capErr);
    }
  }

  // 3. Web Share API
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
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
      if (shareErr.name === 'AbortError') {
        return { filename, method: 'share' };
      }
      console.warn('Navigator share error, falling back to download:', shareErr);
    }
  }

  await downloadBlob(blob, filename, mimeType);
  return { filename, method: 'download' };
}

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
    tableRows.push(['Call-Out Fee (Includes 1st Hour Technical Labor)', '1 ea', formatZAR(data.calloutFee), formatZAR(data.calloutFee)]);
  }
  if (data.labourHours > 0) {
    const addlRate = data.labourRatePerHour || 450;
    const addlTotal = data.additionalLabourTotal ?? ((data.labourHours || 0) * addlRate);
    tableRows.push([`Additional Technical Labour (${data.labourHours} hrs @ ${formatZAR(addlRate)}/hr)`, `${data.labourHours} hrs`, formatZAR(addlRate), formatZAR(addlTotal)]);
  }
  if (Boolean(data.consumablesFee && data.consumablesFee > 0)) {
    tableRows.push([`Consumables & Fasteners (${data.consumablesTier || 'Standard'}) - ${data.consumablesDescription || 'Fixings, lugs, glands, tape'}`, '1 lot', formatZAR(data.consumablesFee || 0), formatZAR(data.consumablesFee || 0)]);
  }
  if (Boolean(data.miscellaneousFee && data.miscellaneousFee > 0)) {
    tableRows.push([`Miscellaneous Surcharges - ${data.miscellaneousDescription || 'Site equipment / access fee'}`, '1 item', formatZAR(data.miscellaneousFee || 0), formatZAR(data.miscellaneousFee || 0)]);
  }
  if (data.travelTotal > 0) {
    tableRows.push([`Logistics & Travel Surcharge (${data.travelDistanceKm} km @ ${formatZAR(data.travelRatePerKm || 7.5)}/km)`, `${data.travelDistanceKm} km`, formatZAR(data.travelRatePerKm || 7.5), formatZAR(data.travelTotal)]);
  }

  const estimatedUnscaledHeight = 154 + (tableRows.length * 8.5);
  const overflowRatio = estimatedUnscaledHeight / 297;
  const shouldCondenseSinglePage = overflowRatio > 0.95 && overflowRatio <= 1.25;

  const headerHeight = shouldCondenseSinglePage ? 38 : 44;
  const clientBoxY = shouldCondenseSinglePage ? 43 : 50;
  const clientBoxHeight = shouldCondenseSinglePage ? 26 : 34;
  const tableStartY = shouldCondenseSinglePage ? 72 : 88;
  const tableFontSize = shouldCondenseSinglePage ? 7.5 : 8.5;
  const tableHeadFontSize = shouldCondenseSinglePage ? 8 : 9;
  const tableCellPadding = shouldCondenseSinglePage ? 1.8 : 3;
  const bankingBoxHeight = shouldCondenseSinglePage ? 28 : 36;
  const lineSpacing = shouldCondenseSinglePage ? 4.5 : 5.5;

  // 1. Top Header Banner in Royal Blue with Golden Yellow accent stripe
  doc.setFillColor(30, 64, 175); // Royal Blue (#1E40AF)
  doc.rect(0, 0, 210, headerHeight, 'F');

  doc.setFillColor(250, 204, 21); // Vibrant Yellow (#FACC15)
  doc.rect(0, headerHeight, 210, 2.5, 'F');

  // Company Name in high-contrast crisp white with graceful line wrapping
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 13 : 15);
  const companyLines = doc.splitTextToSize((profile.companyName || "HARRY'S AIRCON ELECTRICAL & SOLAR SERVICES").toUpperCase(), 122);
  let compY = shouldCondenseSinglePage ? 9.5 : 12;
  companyLines.forEach((cline: string) => {
    doc.text(cline, 14, compY);
    compY += (shouldCondenseSinglePage ? 4.8 : 5.5);
  });

  // Tagline in warm golden yellow
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(shouldCondenseSinglePage ? 7.8 : 8.5);
  doc.setTextColor(254, 240, 138); // Yellow-200
  doc.text(profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered", 14, compY);

  // Company Details in Dove Grey / Soft White
  compY += (shouldCondenseSinglePage ? 4.2 : 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(shouldCondenseSinglePage ? 7 : 7.8);
  doc.setTextColor(241, 245, 249); // Dove White (#F1F5F9)
  doc.text(`Reg: ${profile.regNumber || '2021/849201/07'} | VAT: ${profile.vatNumber || '4820391823'}`, 14, compY);
  compY += (shouldCondenseSinglePage ? 3.8 : 4.5);
  doc.text(`Tel: ${profile.phone || '+27 82 456 7890'} | Email: ${profile.email || 'info@harryselectrical.co.za'}`, 14, compY);
  if (!shouldCondenseSinglePage) {
    compY += 4.5;
    doc.text(`Address: ${profile.address || '14 Electron Avenue, Kya Sand Industrial, JHB'} | Web: ${profile.website || 'https://harryselectrical.co.za'}`, 14, compY);
  }

  // Right-side Document Badge in Golden Yellow with Royal Blue bold text
  doc.setFillColor(250, 204, 21); // Vibrant Yellow
  doc.roundedRect(138, shouldCondenseSinglePage ? 7.5 : 9.5, 58, shouldCondenseSinglePage ? 8.5 : 10, 2, 2, 'F');
  doc.setTextColor(30, 58, 138); // Royal Blue Navy (#1E3A8A)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 9.5 : 11);
  doc.text(docTitle, 167, shouldCondenseSinglePage ? 13 : 16, { align: 'center' });

  // Document metadata in crisp white
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Ref #: ${docNumber}`, 140, shouldCondenseSinglePage ? 20.5 : 25.5);
  doc.setTextColor(241, 245, 249);
  doc.text(`Date: ${data.date}`, 140, shouldCondenseSinglePage ? 25 : 30.5);
  doc.text(`${isInvoice ? 'Due Date' : 'Valid Until'}: ${docSecondaryDate}`, 140, shouldCondenseSinglePage ? 29.5 : 35.5);

  // Status indicator
  doc.setFillColor(254, 240, 138);
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(shouldCondenseSinglePage ? 6.5 : 7.2);
  doc.roundedRect(140, shouldCondenseSinglePage ? 32 : 38, 28, 4.5, 1, 1, 'F');
  doc.text(`STATUS: ${(data.status || 'SENT').toUpperCase()}`, 154, shouldCondenseSinglePage ? 35.2 : 41.2, { align: 'center' });

  // 2. Client & Site Details Box in Dove Grey with Royal Blue left accent bar
  doc.setFillColor(248, 250, 252); // Light Dove Grey (#F8FAFC)
  doc.setDrawColor(203, 213, 225); // Dove Grey border (#CBD5E1)
  doc.roundedRect(14, clientBoxY, 182, clientBoxHeight, 2, 2, 'FD');

  // Left Royal Blue vertical accent bar
  doc.setFillColor(30, 64, 175);
  doc.rect(14, clientBoxY, 3, clientBoxHeight, 'F');

  doc.setTextColor(30, 64, 175); // Royal Blue
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 8 : 9);
  doc.text(isInvoice ? 'BILLED TO & SITE LOCATION' : 'CLIENT & SITE DETAILS', 20, clientBoxY + (shouldCondenseSinglePage ? 5 : 7));
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(shouldCondenseSinglePage ? 9 : 10);
  doc.text(data.clientName, 20, clientBoxY + (shouldCondenseSinglePage ? 11 : 14));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${data.clientPhone} ${data.clientEmail ? '| Email: ' + data.clientEmail : ''}`, 20, clientBoxY + (shouldCondenseSinglePage ? 16 : 20));
  doc.text(`Site Address: ${data.clientAddress}`, 20, clientBoxY + (shouldCondenseSinglePage ? 21 : 26));

  doc.setTextColor(30, 64, 175); // Royal Blue
  doc.setFont('helvetica', 'bold');
  doc.text('JOB SPECIFICATION', 110, clientBoxY + (shouldCondenseSinglePage ? 5 : 7));
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Category: ${data.serviceType}`, 110, clientBoxY + (shouldCondenseSinglePage ? 11 : 14));
  const splitScope = doc.splitTextToSize(data.scopeOfWork || 'On-site technical scope', 80);
  doc.text(splitScope.slice(0, 2), 110, clientBoxY + (shouldCondenseSinglePage ? 16 : 20));

  // 3. Items & Services Table with Royal Blue Head and Yellow accent
  applyAutoTable(doc, {
    startY: tableStartY,
    head: [['Item / Description', 'Qty', 'Unit Rate (ZAR)', 'Total (ZAR)']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 64, 175], // Royal Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: tableHeadFontSize,
      cellPadding: tableCellPadding + 0.5,
    },
    styles: {
      fontSize: tableFontSize,
      textColor: [15, 23, 42],
      cellPadding: tableCellPadding,
      lineColor: [226, 232, 240], // Dove Grey
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Dove Grey tint
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY ?? (tableStartY + (tableRows.length * 8))) + (shouldCondenseSinglePage ? 4 : 6);

  // 4. Banking Details Box in Dove Grey with Royal Blue left bar
  doc.setFillColor(241, 245, 249); // Dove Grey (#F1F5F9)
  doc.setDrawColor(203, 213, 225); // Dove Grey border (#CBD5E1)
  doc.roundedRect(14, finalY, 108, bankingBoxHeight, 2, 2, 'FD');

  // Left Royal Blue accent bar
  doc.setFillColor(30, 64, 175);
  doc.rect(14, finalY, 3.5, bankingBoxHeight, 'F');

  doc.setTextColor(30, 64, 175); // Royal Blue
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.text('BANKING DETAILS (EFT SETTLEMENT)', 20, finalY + (shouldCondenseSinglePage ? 5 : 6));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(shouldCondenseSinglePage ? 7 : 8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Bank: ${profile.bankName || 'Tyme Bank Business'}`, 20, finalY + (shouldCondenseSinglePage ? 10 : 12));
  doc.text(`Account Name: ${profile.accountName || profile.companyName || 'Harrys Aircon and Electrical'}`, 20, finalY + (shouldCondenseSinglePage ? 14 : 17));
  doc.text(`Account Number: ${profile.accountNumber || '53002734919'}`, 20, finalY + (shouldCondenseSinglePage ? 18 : 22));
  doc.text(`Branch Code: ${profile.branchCode || '678910'} (${profile.accountType || 'Business Current Account'})`, 20, finalY + (shouldCondenseSinglePage ? 22 : 27));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(`Reference: ${docNumber}`, 20, finalY + (shouldCondenseSinglePage ? 26 : 32));

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

  totalsY += lineSpacing + 2;
  doc.setDrawColor(203, 213, 225);
  doc.line(130, totalsY - 2, 196, totalsY - 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 9 : 10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL AMOUNT:', 130, totalsY + 2);
  doc.setTextColor(30, 64, 175); // Royal Blue
  doc.text(formatZAR(data.totalAmount), 196, totalsY + 2, { align: 'right' });

  // Deposit and Balance Due calculation for PDF
  const isInvoiceDoc = docType === 'invoice';
  if (isInvoiceDoc) {
    const inv = data as Invoice;
    const paid = inv.amountPaid || inv.depositAmountPaid || 0;
    if (paid > 0) {
      totalsY += lineSpacing + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
      doc.setTextColor(16, 185, 129);
      const paidLabel = inv.depositPaidDate ? `Deposit Paid (${inv.depositPaidDate}):` : 'Deposit / Paid to Date:';
      doc.text(paidLabel, 130, totalsY);
      doc.text(`-${formatZAR(paid)}`, 196, totalsY, { align: 'right' });

      totalsY += lineSpacing + 2;
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(128, totalsY - 3.5, 70, shouldCondenseSinglePage ? 6.5 : 8, 1.5, 1.5, 'FD');
      doc.setFontSize(shouldCondenseSinglePage ? 8.5 : 9.5);
      doc.setTextColor(185, 28, 28);
      doc.text('BALANCE DUE:', 130, totalsY + 1.5);
      doc.text(formatZAR(Math.max(0, inv.totalAmount - paid)), 196, totalsY + 1.5, { align: 'right' });
    }
  } else {
    const quote = data as Quotation;
    const paid = quote.isDepositPaid ? (quote.depositAmountPaid || 0) : 0;
    if (paid > 0) {
      totalsY += lineSpacing + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
      doc.setTextColor(16, 185, 129);
      const paidLabel = quote.depositPaidDate ? `Deposit Paid (${quote.depositPaidDate}):` : 'Deposit Paid:';
      doc.text(paidLabel, 130, totalsY);
      doc.text(`-${formatZAR(paid)}`, 196, totalsY, { align: 'right' });

      totalsY += lineSpacing + 2;
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(128, totalsY - 3.5, 70, shouldCondenseSinglePage ? 6.5 : 8, 1.5, 1.5, 'FD');
      doc.setFontSize(shouldCondenseSinglePage ? 8.5 : 9.5);
      doc.setTextColor(21, 128, 61);
      doc.text('REMAINING BALANCE:', 130, totalsY + 1.5);
      doc.text(formatZAR(Math.max(0, quote.totalAmount - paid)), 196, totalsY + 1.5, { align: 'right' });
    } else {
      const depPct = quote.depositPercentage || 80;
      const depReq = quote.depositAmount || Number(((quote.totalAmount * depPct) / 100).toFixed(2));
      if (depReq > 0) {
        totalsY += lineSpacing + 3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(shouldCondenseSinglePage ? 7 : 8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Deposit Required (${depPct}%):`, 130, totalsY);
        doc.text(formatZAR(depReq), 196, totalsY, { align: 'right' });

        totalsY += lineSpacing;
        doc.text('Balance on Completion:', 130, totalsY);
        doc.text(formatZAR(Math.max(0, quote.totalAmount - depReq)), 196, totalsY, { align: 'right' });
      }
    }
  }

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

export async function exportToPDF(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDownload: boolean = true
): Promise<ExportResult> {
  const doc = buildJsPDFDocument(docType, data, profile);
  const blob = doc.output('blob');
  const docNumber = docType === 'invoice' ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const clientClean = (data.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${docType.toUpperCase()}_${docNumber || 'DOC'}_${clientClean}.pdf`;
  const title = `${docType === 'invoice' ? 'Tax Invoice' : 'Quotation'} ${docNumber || ''}`;
  return await saveOrShareFile(blob, filename, 'application/pdf', title, forceDownload);
}

export async function exportToExcel(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDownload: boolean = true
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'Tax Invoice' : 'Quotation';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;

  const rows: any[] = [
    [profile.companyName.toUpperCase()],
    [profile.tagline],
    [`Reg: ${profile.regNumber} | VAT: ${profile.vatNumber} | Tel: ${profile.phone}`],
    [],
    [`${docTitle.toUpperCase()} DETAILS`],
    ['Document Ref:', docNumber, '', 'Date:', data.date],
    ['Client Name:', data.clientName, '', isInvoice ? 'Due Date:' : 'Expiry Date:', isInvoice ? (data as Invoice).dueDate : (data as Quotation).expiryDate],
    ['Phone:', data.clientPhone, '', 'Category:', data.serviceType],
    ['Site Address:', data.clientAddress],
    ['Scope of Work:', data.scopeOfWork],
    [],
    ['LINE ITEMS & CHARGES'],
    ['Description', 'Qty', 'Unit', 'Rate (ZAR)', 'Total (ZAR)'],
  ];

  (data.items || []).forEach((item) => {
    rows.push([item.description, item.quantity, item.unit || 'ea', item.unitPrice, item.total]);
  });

  if (data.calloutFee > 0) {
    rows.push(['Call-Out Fee (1st Hour Included)', 1, 'ea', data.calloutFee, data.calloutFee]);
  }
  if (data.labourHours > 0) {
    const addlTotal = data.additionalLabourTotal ?? ((data.labourHours || 0) * (data.labourRatePerHour || 450));
    rows.push([`Additional Technical Labour (${data.labourHours} hrs @ ${data.labourRatePerHour}/hr)`, data.labourHours, 'hrs', data.labourRatePerHour || 450, addlTotal]);
  }
  if (data.consumablesFee && data.consumablesFee > 0) {
    rows.push([`Consumables (${data.consumablesTier || 'Standard'})`, 1, 'lot', data.consumablesFee, data.consumablesFee]);
  }
  if (data.miscellaneousFee && data.miscellaneousFee > 0) {
    rows.push([`Misc: ${data.miscellaneousDescription || 'Site fee'}`, 1, 'item', data.miscellaneousFee, data.miscellaneousFee]);
  }
  if (data.travelTotal > 0) {
    rows.push([`Logistics & Travel (${data.travelDistanceKm} km)`, data.travelDistanceKm, 'km', data.travelRatePerKm || 7.5, data.travelTotal]);
  }

  rows.push([]);
  rows.push(['FINANCIAL TOTALS']);
  rows.push(['Subtotal (Excl VAT):', '', '', '', data.subtotal]);
  if (data.discountAmount && data.discountAmount > 0) {
    rows.push([`Discount (${data.discountPct}%):`, '', '', '', -data.discountAmount]);
  }
  if (data.vatEnabled) {
    rows.push(['South African VAT (15%):', '', '', '', data.vatAmount]);
  }
  rows.push(['TOTAL AMOUNT (ZAR):', '', '', '', data.totalAmount]);

  if (isInvoice) {
    const inv = data as Invoice;
    const paid = inv.amountPaid || inv.depositAmountPaid || 0;
    if (paid > 0) {
      rows.push([`Deposit / Paid to Date (${inv.depositPaidDate || 'Paid'}):`, '', '', '', -paid]);
      rows.push(['REMAINING BALANCE DUE (ZAR):', '', '', '', Math.max(0, inv.totalAmount - paid)]);
    }
  } else {
    const quote = data as Quotation;
    if (quote.isDepositPaid && (quote.depositAmountPaid || 0) > 0) {
      rows.push([`Deposit Paid (${quote.depositPaidDate || 'Paid'}):`, '', '', '', -(quote.depositAmountPaid || 0)]);
      rows.push(['REMAINING BALANCE DUE (ZAR):', '', '', '', Math.max(0, quote.totalAmount - (quote.depositAmountPaid || 0))]);
    } else {
      const depPct = quote.depositPercentage || 80;
      const depReq = quote.depositAmount || Number(((quote.totalAmount * depPct) / 100).toFixed(2));
      if (depReq > 0) {
        rows.push([`Deposit Required (${depPct}%):`, '', '', '', depReq]);
        rows.push(['Balance on Completion:', '', '', '', Math.max(0, quote.totalAmount - depReq)]);
      }
    }
  }

  rows.push([]);
  rows.push(['BANKING DETAILS FOR EFT:']);
  rows.push([`Bank: ${profile.bankName}`]);
  rows.push([`Account Name: ${profile.accountName}`]);
  rows.push([`Account Number: ${profile.accountNumber}`]);
  rows.push([`Branch Code: ${profile.branchCode}`]);
  rows.push([`Reference: ${docNumber}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, docTitle);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  return await saveOrShareFile(blob, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docTitle, forceDownload);
}

export async function exportToWord(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDownload: boolean = true
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'Tax Invoice' : 'Official Quotation';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;

  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Description', style: 'Heading' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Qty' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Unit Rate (ZAR)' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Total (ZAR)' })] }),
      ],
    }),
  ];

  (data.items || []).forEach((item) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(item.description)] }),
          new TableCell({ children: [new Paragraph(`${item.quantity} ${item.unit || 'ea'}`)] }),
          new TableCell({ children: [new Paragraph(formatZAR(item.unitPrice))] }),
          new TableCell({ children: [new Paragraph(formatZAR(item.total))] }),
        ],
      })
    );
  });

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
            text: `${docTitle}: ${docNumber} | Date: ${data.date}`,
          }),
          new Paragraph({
            text: `Client: ${data.clientName} (${data.clientPhone}) | Site: ${data.clientAddress}`,
          }),
          new Paragraph({
            text: `Scope: ${data.serviceType} - ${data.scopeOfWork}`,
          }),
          new Paragraph({ text: '' }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: `Subtotal: ${formatZAR(data.subtotal)}` }),
          new Paragraph({ text: `VAT (15%): ${formatZAR(data.vatAmount)}` }),
          new Paragraph({
            text: `TOTAL: ${formatZAR(data.totalAmount)}`,
            heading: HeadingLevel.HEADING_2,
          }),
          ...(isInvoice
            ? (data as Invoice).amountPaid > 0
              ? [
                  new Paragraph({ text: `Deposit / Paid to Date: -${formatZAR((data as Invoice).amountPaid)}` }),
                  new Paragraph({
                    text: `REMAINING BALANCE DUE: ${formatZAR(Math.max(0, data.totalAmount - (data as Invoice).amountPaid))}`,
                    heading: HeadingLevel.HEADING_3,
                  }),
                ]
              : []
            : (data as Quotation).isDepositPaid && ((data as Quotation).depositAmountPaid || 0) > 0
            ? [
                new Paragraph({ text: `Deposit Paid (${(data as Quotation).depositPaidDate || 'Paid'}): -${formatZAR((data as Quotation).depositAmountPaid || 0)}` }),
                new Paragraph({
                  text: `REMAINING BALANCE DUE: ${formatZAR(Math.max(0, data.totalAmount - ((data as Quotation).depositAmountPaid || 0)))}`,
                  heading: HeadingLevel.HEADING_3,
                }),
              ]
            : [
                new Paragraph({
                  text: `Deposit Required (${(data as Quotation).depositPercentage || 80}%): ${formatZAR(
                    (data as Quotation).depositAmount || (data.totalAmount * ((data as Quotation).depositPercentage || 80)) / 100
                  )}`,
                }),
                new Paragraph({
                  text: `Balance on Completion: ${formatZAR(
                    data.totalAmount -
                      ((data as Quotation).depositAmount || (data.totalAmount * ((data as Quotation).depositPercentage || 80)) / 100)
                  )}`,
                }),
              ]),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: `EFT Settlement: ${profile.bankName || 'Tyme Bank Business'} | Acc Name: ${profile.accountName || profile.companyName || 'Harrys Aircon and Electrical'} | Acc: ${profile.accountNumber || '53002734919'} | Branch: ${profile.branchCode || '678910'} (${profile.accountType || 'Business Current Account'}) | Ref: ${docNumber}`,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  return await saveOrShareFile(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docTitle, forceDownload);
}

export async function exportToPlainText(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDownload: boolean = true
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;

  let text = `=================================================\n`;
  text += `${(profile.companyName || "HARRY'S AIRCON ELECTRICAL & SOLAR SERVICES").toUpperCase()}\n`;
  text += `${profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"}\n`;
  text += `Reg: ${profile.regNumber || '2021/849201/07'} | VAT: ${profile.vatNumber || '4820391823'}\n`;
  text += `Tel: ${profile.phone || '+27 82 456 7890'} | Email: ${profile.email || 'info@harryselectrical.co.za'}\n`;
  text += `Address: ${profile.address || '14 Electron Avenue, Kya Sand Industrial, JHB'}\n`;
  text += `Website: ${profile.website || 'https://harryselectrical.co.za'}\n`;
  text += `=================================================\n\n`;
  text += `${docTitle}: ${docNumber}\n`;
  text += `Date: ${data.date}\n`;
  text += `Client: ${data.clientName} (${data.clientPhone})\n`;
  text += `Site: ${data.clientAddress}\n`;
  text += `Scope: ${data.serviceType} - ${data.scopeOfWork}\n\n`;
  text += `-------------------------------------------------\n`;
  text += `SCHEDULE OF ITEMS & LABOUR:\n`;
  (data.items || []).forEach((item, idx) => {
    text += `${idx + 1}. ${item.description} - ${item.quantity} ${item.unit || 'ea'} @ ${formatZAR(item.unitPrice)} = ${formatZAR(item.total)}\n`;
  });
  if (data.calloutFee > 0) text += `* Call-Out (1st Hour Included): ${formatZAR(data.calloutFee)}\n`;
  if (data.labourHours > 0) text += `* Addl Labour (${data.labourHours} hrs): ${formatZAR(data.additionalLabourTotal || 0)}\n`;
  if (data.consumablesFee) text += `* Consumables: ${formatZAR(data.consumablesFee)}\n`;
  if (data.travelTotal > 0) text += `* Logistics/Travel (${data.travelDistanceKm} km): ${formatZAR(data.travelTotal)}\n`;
  text += `-------------------------------------------------\n`;
  text += `Subtotal: ${formatZAR(data.subtotal)}\n`;
  if (data.discountAmount && data.discountAmount > 0) text += `Discount (${data.discountPct}%): -${formatZAR(data.discountAmount)}\n`;
  if (data.vatEnabled) text += `VAT (15%): ${formatZAR(data.vatAmount)}\n`;
  text += `TOTAL AMOUNT: ${formatZAR(data.totalAmount)}\n`;

  if (isInvoice) {
    const paid = (data as Invoice).amountPaid || (data as Invoice).depositAmountPaid || 0;
    if (paid > 0) {
      text += `Deposit / Paid to Date (${(data as Invoice).depositPaidDate || 'Paid'}): -${formatZAR(paid)}\n`;
      text += `REMAINING BALANCE DUE: ${formatZAR(Math.max(0, data.totalAmount - paid))}\n`;
    }
  } else {
    const quote = data as Quotation;
    if (quote.isDepositPaid && (quote.depositAmountPaid || 0) > 0) {
      text += `Deposit Paid (${quote.depositPaidDate || 'Paid'}): -${formatZAR(quote.depositAmountPaid || 0)}\n`;
      text += `REMAINING BALANCE DUE: ${formatZAR(Math.max(0, quote.totalAmount - (quote.depositAmountPaid || 0)))}\n`;
    } else {
      const depPct = quote.depositPercentage || 80;
      const depReq = quote.depositAmount || Number(((quote.totalAmount * depPct) / 100).toFixed(2));
      if (depReq > 0) {
        text += `Deposit Required (${depPct}%): ${formatZAR(depReq)}\n`;
        text += `Balance on Completion: ${formatZAR(Math.max(0, quote.totalAmount - depReq))}\n`;
      }
    }
  }
  text += `\n`;
  text += `EFT Details:\n`;
  text += `Bank: ${profile.bankName || 'Tyme Bank Business'}\n`;
  text += `Account Name: ${profile.accountName || profile.companyName || 'Harrys Aircon and Electrical'}\n`;
  text += `Account: ${profile.accountNumber || '53002734919'}\n`;
  text += `Branch: ${profile.branchCode || '678910'} (${profile.accountType || 'Business Current Account'})\n`;
  text += `Payment Ref: ${docNumber}\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  return await saveOrShareFile(blob, filename, 'text/plain', docTitle, forceDownload);
}

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
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500; color: #0F172A;">
            <div>Call-Out Fee (Includes 1st Hour Technical Labor)</div>
            <div style="font-size: 11px; color: #64748B;">Site diagnostic inspection & primary labor</div>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">1 ea</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(data.calloutFee)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">${formatZAR(data.calloutFee)}</td>
        </tr>`
      : '';

  const labourRow =
    data.labourHours > 0
      ? `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500; color: #0F172A;">
            <div>Additional Technical Labour (${data.labourHours} hrs @ ${formatZAR(data.labourRatePerHour || 450)}/hr)</div>
            <div style="font-size: 11px; color: #64748B;">Labor worked after initial 1st hour</div>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">${data.labourHours} hrs</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(data.labourRatePerHour || 450)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">${formatZAR(data.additionalLabourTotal ?? ((data.labourHours || 0) * (data.labourRatePerHour || 450)))}</td>
        </tr>`
      : '';

  const consumablesRow =
    Boolean(data.consumablesFee && data.consumablesFee > 0)
      ? `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500; color: #0F172A;">
            <div>Consumables & Fasteners <span style="font-size: 10px; background: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; text-transform: uppercase;">${data.consumablesTier || 'Standard'}</span></div>
            <div style="font-size: 11px; color: #64748B;">${data.consumablesDescription || 'Fasteners, fixings, sealant, tape, lugs & glands'}</div>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">1 lot</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(data.consumablesFee || 0)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">${formatZAR(data.consumablesFee || 0)}</td>
        </tr>`
      : '';

  const miscRow =
    Boolean(data.miscellaneousFee && data.miscellaneousFee > 0)
      ? `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500; color: #0F172A;">
            <div>Miscellaneous Site Surcharges</div>
            <div style="font-size: 11px; color: #64748B;">${data.miscellaneousDescription || 'Site equipment / specialized access fee'}</div>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">1 item</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(data.miscellaneousFee || 0)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">${formatZAR(data.miscellaneousFee || 0)}</td>
        </tr>`
      : '';

  const travelRow =
    data.travelTotal > 0
      ? `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500; color: #0F172A;">
            <div>Logistics & Travel Surcharge (${data.travelDistanceKm} km @ ${formatZAR(data.travelRatePerKm || 7.5)}/km)</div>
            <div style="font-size: 11px; color: #64748B;">Round-trip site vehicle dispatch</div>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-family: monospace;">${data.travelDistanceKm} km</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${formatZAR(data.travelRatePerKm || 7.5)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">${formatZAR(data.travelTotal)}</td>
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
      html, body, #root, .app-container, .invoice-container, .print-area {
        background-color: #ffffff !important;
        background: #ffffff !important;
        color: #111827 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Ensure headers, borders, and text stay crisp black/white */
      .invoice-header, .invoice-table th, .invoice-card {
        background-color: #f3f4f6 !important;
        color: #111827 !important;
        border-color: #e5e7eb !important;
      }

      /* Prevent elements from breaking across pages awkwardly */
      .invoice-table tr, .invoice-totals {
        page-break-inside: avoid !important;
      }

      /* Hide UI elements like navigation bars, debug buttons, and action bars */
      .no-print, .debug-panel, nav, button, .action-buttons {
        display: none !important;
      }

      body { background: #ffffff !important; padding: 0 !important; }
      .print-actions { display: none !important; }
      .print-sheet { border: none !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body class="invoice-container print-area">
  <div class="print-actions no-print action-buttons">
    <button class="btn-print" onclick="window.print()">
        Tap to Print / Save as PDF
    </button>
    <span style="color: #94A3B8; font-size: 13px; font-family: monospace;">
      On Android: In the print dialog, select <strong>"Save as PDF"</strong> to save to phone.
    </span>
  </div>
  <div class="print-sheet invoice-card">
    <div class="invoice-header" style="background: linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%); color: #ffffff; padding: 24px 28px; border-bottom: 5px solid #FACC15;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
        <div style="max-width: 65%;">
          <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #FFFFFF; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">
            ${profile.companyName || "HARRY'S AIRCON ELECTRICAL & SOLAR SERVICES"}
          </h1>
          <p style="margin: 0 0 12px 0; font-size: 13px; color: #FEF08A; font-weight: 700; font-style: italic;">
            ${profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"}
          </p>
          <div style="font-size: 11px; color: #F1F5F9; line-height: 1.6; font-family: monospace;">
            <div>${[profile.regNumber ? `Reg: ${profile.regNumber}` : 'Reg: 2021/849201/07', profile.vatNumber ? `VAT: ${profile.vatNumber}` : 'VAT: 4820391823'].filter(Boolean).join(' | ')}</div>
            <div>${[profile.phone ? `Tel: ${profile.phone}` : 'Tel: +27 82 456 7890', profile.email ? `Email: ${profile.email}` : 'Email: info@harryselectrical.co.za'].filter(Boolean).join(' | ')}</div>
            <div>${[profile.address ? `Address: ${profile.address}` : 'Address: 14 Electron Avenue, Kya Sand Industrial, JHB', profile.website ? `Web: ${profile.website}` : 'Web: https://harryselectrical.co.za'].filter(Boolean).join(' | ')}</div>
          </div>
        </div>
        <div style="text-align: right; font-family: monospace;">
          <div style="display: inline-block; padding: 6px 16px; background: #FACC15; color: #1E3A8A; border: 2px solid #EAB308; border-radius: 8px; font-size: 15px; font-weight: 900; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); margin-bottom: 8px;">
            ${docTitle}
          </div>
          <div style="font-size: 12px; color: #F1F5F9; line-height: 1.6;">
            <div><span style="color: #CBD5E1;">Ref #:</span> <strong style="color: #FFFFFF; font-size: 13px;">${docNumber}</strong></div>
            <div><span style="color: #CBD5E1;">Date:</span> ${data.date}</div>
            <div><span style="color: #CBD5E1;">${isInvoice ? 'Due Date:' : 'Valid Until:'}</span> ${docSecondaryDate}</div>
            <div style="display: inline-block; padding: 2px 8px; background: rgba(250, 204, 21, 0.2); color: #FEF08A; border: 1px solid #FACC15; border-radius: 4px; font-weight: 800; font-size: 11px; text-transform: uppercase; margin-top: 4px;">
              Status: ${data.status}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style="padding: 20px 24px; background: #F8FAFC; border-bottom: 1px solid #CBD5E1; border-left: 5px solid #1E40AF;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #1E40AF; font-family: monospace; font-weight: 800;">
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
          <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #1E40AF; font-family: monospace; font-weight: 800;">
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
    <div style="padding: 24px;">
      <table class="invoice-table" style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #1E40AF; color: #ffffff; font-family: monospace; text-transform: uppercase; font-size: 11px; border-bottom: 3px solid #FACC15;">
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
          ${consumablesRow}
          ${miscRow}
          ${travelRow}
        </tbody>
      </table>
      <div class="invoice-totals" style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; padding-top: 16px; border-top: 2px solid #E2E8F0;">
        <div style="background: #F1F5F9; padding: 16px; border-radius: 8px; border: 1px solid #CBD5E1; border-left: 5px solid #1E40AF; font-family: monospace; font-size: 11px;">
          <div style="font-weight: 800; color: #1E40AF; text-transform: uppercase; margin-bottom: 8px; font-size: 12px; display: flex; justify-content: space-between;">
              <span>Banking Details (EFT Settlement)</span>
              <span style="background: #FEF08A; color: #1E3A8A; padding: 1px 6px; border-radius: 4px; font-size: 10px;">VERIFIED EFT</span>
          </div>
          <div style="line-height: 1.7; color: #1E293B;">
            <div>Bank: <strong>${profile.bankName || 'Tyme Bank Business'}</strong></div>
            <div>Account Name: <strong>${profile.accountName || profile.companyName || 'Harrys Aircon and Electrical'}</strong></div>
            <div>Account Number: <strong style="font-size: 12px; letter-spacing: 0.5px;">${profile.accountNumber || '53002734919'}</strong></div>
            <div>Branch Code: <strong>${profile.branchCode || '678910'}</strong> (${profile.accountType || 'Business Current Account'})</div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #CBD5E1;">
              Payment Ref: <strong style="color: #1E40AF; background: #FEF08A; padding: 2px 6px; border-radius: 4px;">${docNumber}</strong>
            </div>
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
            <span style="color: #1E40AF; font-size: 18px;">${formatZAR(data.totalAmount)}</span>
          </div>
          ${
            isInvoice
              ? (data as Invoice).amountPaid > 0
                ? `<div style="display: flex; justify-content: space-between; color: #16A34A; font-weight: 700; margin-top: 8px;">
                    <span>Deposit / Paid to Date (${(data as Invoice).depositPaidDate || 'Paid'}):</span>
                    <span>-${formatZAR((data as Invoice).amountPaid)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: #DC2626; background: #FEF2F2; padding: 6px 8px; border-radius: 6px; border: 1px solid #FECACA; margin-top: 6px;">
                    <span>BALANCE DUE:</span>
                    <span>${formatZAR(Math.max(0, data.totalAmount - (data as Invoice).amountPaid))}</span>
                  </div>`
                : ''
              : (data as Quotation).isDepositPaid && ((data as Quotation).depositAmountPaid || 0) > 0
              ? `<div style="display: flex; justify-content: space-between; color: #16A34A; font-weight: 700; margin-top: 8px;">
                  <span>Deposit Paid (${(data as Quotation).depositPaidDate || 'Paid'}):</span>
                  <span>-${formatZAR((data as Quotation).depositAmountPaid || 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: #15803D; background: #F0FDF4; padding: 6px 8px; border-radius: 6px; border: 1px solid #BBF7D0; margin-top: 6px;">
                  <span>REMAINING BALANCE:</span>
                  <span>${formatZAR(Math.max(0, data.totalAmount - ((data as Quotation).depositAmountPaid || 0)))}</span>
                </div>`
              : `<div style="display: flex; justify-content: space-between; color: #64748B; margin-top: 6px; font-size: 12px;">
                  <span>Deposit Required (${(data as Quotation).depositPercentage || 80}%):</span>
                  <span>${formatZAR((data as Quotation).depositAmount || (data.totalAmount * ((data as Quotation).depositPercentage || 80)) / 100)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #64748B; font-size: 12px;">
                  <span>Balance on Completion:</span>
                  <span>${formatZAR(data.totalAmount - ((data as Quotation).depositAmount || (data.totalAmount * ((data as Quotation).depositPercentage || 80)) / 100))}</span>
                </div>`
          }
        </div>
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #64748B; font-style: italic; line-height: 1.5;">
        <div><strong>Terms:</strong> ${(data as Quotation).terms || '80% Deposit on acceptance, balance on completion. All materials remain property of contractor until paid in full.'}</div>
        ${profile.sansComplianceNotice ? `<div style="margin-top: 4px;">${profile.sansComplianceNotice}</div>` : ''}
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

export async function printHtmlDocument(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): Promise<void> {
  const isInvoice = docType === 'invoice';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const safeClient = (data.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${docType.toUpperCase()}_${docNumber || 'DOC'}_${safeClient}`;

  // 1. Android Native Bridge with direct PDF stream to Android PrintManager
  if (typeof window !== 'undefined' && window.AndroidInterface?.printPdf) {
    try {
      const doc = buildJsPDFDocument(docType, data, profile);
      const pdfBlob = doc.output('blob');
      const base64data = await blobToBase64(pdfBlob);
      const res = window.AndroidInterface.printPdf(base64data, filename);
      if (res !== false) return;
    } catch (androidPdfErr) {
      console.warn('Direct PDF print bridge error:', androidPdfErr);
    }
  }

  // 2. Android Bridge standard printDocument fallback
  if (typeof window !== 'undefined' && window.AndroidInterface?.printDocument) {
    try {
      const res = window.AndroidInterface.printDocument();
      if (res !== false) return;
    } catch (printErr) {
      console.warn('AndroidInterface.printDocument error, using web print:', printErr);
    }
  }

  // 3. Capacitor Native: generate PDF and invoke native Share Sheet for printing/saving
  if (Capacitor.isNativePlatform()) {
    try {
      const doc = buildJsPDFDocument(docType, data, profile);
      const pdfBlob = doc.output('blob');
      const base64data = await blobToBase64(pdfBlob);
      const cleanData = base64data.includes(',') ? base64data.split(',')[1] : base64data;
      const saved = await Filesystem.writeFile({
        path: `${filename}.pdf`,
        data: cleanData,
        directory: Directory.Cache,
      });
      await Share.share({
        title: `Print / Save as PDF: ${filename}`,
        url: saved.uri,
        dialogTitle: 'Select Print Service or Save PDF',
      });
      return;
    } catch (capPrintErr) {
      console.warn('Capacitor native print share fallback failed:', capPrintErr);
    }
  }

  // 4. In-Browser / Mobile / Tablet Print via isolated hidden iframe (prevents modal backdrop / CSS clipping)
  try {
    const htmlContent = generatePrintableHtml(docType, data, profile);
    const existingFrame = document.getElementById('cortech-print-frame');
    if (existingFrame && document.body.contains(existingFrame)) {
      document.body.removeChild(existingFrame);
    }

    const printIframe = document.createElement('iframe');
    printIframe.id = 'cortech-print-frame';
    printIframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;z-index:-999;');
    document.body.appendChild(printIframe);

    const frameDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
    if (frameDoc && printIframe.contentWindow) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (iframeErr) {
          console.warn('Iframe print failed, falling back to window.print():', iframeErr);
          document.body.classList.add('printing-document');
          window.print();
          document.body.classList.remove('printing-document');
        } finally {
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
          }, 4000);
        }
      }, 350);
      return;
    }
  } catch (webPrintErr) {
    console.warn('Isolated iframe print failed, trying main window print:', webPrintErr);
  }

  // 5. Fallback: Main window print with body clean class
  try {
    document.body.classList.add('printing-document');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-document');
    }, 1000);
  } catch (fallbackPrintErr) {
    console.warn('window.print failed completely, downloading vector PDF fallback:', fallbackPrintErr);
    await exportToPDF(docType, data, profile, true);
  }
}

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
  const sanitizedClient = (data.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
  const title = `${docType === 'invoice' ? 'Tax Invoice' : 'Quotation'} ${docNumber || ''}`;

  if (format === 'pdf') {
    const doc = buildJsPDFDocument(docType, data, profile);
    blob = doc.output('blob');
    filename = `${docType.toUpperCase()}_${docNumber || 'DOC'}_${sanitizedClient}.pdf`;
    mimeType = 'application/pdf';
  } else if (format === 'excel') {
    return await exportToExcel(docType, data, profile, true);
  } else if (format === 'word') {
    return await exportToWord(docType, data, profile, true);
  } else {
    return await exportToPlainText(docType, data, profile, true);
  }

  // 1. Android Native Bridge with direct FileProvider share intent
  if (typeof window !== 'undefined' && window.AndroidInterface?.shareFile) {
    try {
      const base64Data = await blobToBase64(blob);
      const res = window.AndroidInterface.shareFile(base64Data, filename, mimeType, title);
      if (res !== false) return { filename, method: 'share' };
    } catch (err) {
      console.warn('AndroidInterface.shareFile failed:', err);
    }
  }

  // 2. Capacitor Native Share with attached file
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: cleanData,
        directory: Directory.Cache,
      });
      await Share.share({
        title: title,
        text: `${title} - ${filename}`,
        url: fileResult.uri,
        dialogTitle: title,
      });
      return { filename, method: 'share' };
    } catch (capErr: any) {
      if (capErr?.message?.includes('canceled') || capErr?.name === 'AbortError') {
        return { filename, method: 'share' };
      }
      console.warn('Capacitor Share failed, trying web share:', capErr);
    }
  }

  // 3. Web Share API with File
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: `${title} for ${data.clientName}`,
        });
        return { filename, method: 'share' };
      } else {
        // Fallback: Share text summary
        await navigator.share({
          title: title,
          text: `${title} for ${data.clientName} (Total: R ${data.totalAmount})`,
        });
        return { filename, method: 'share' };
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        return { filename, method: 'share' };
      }
      console.warn('Navigator share error, downloading document instead:', shareErr);
    }
  }

  await downloadBlob(blob, filename, mimeType);
  return { filename, method: 'download' };
}

export async function openPdfInNewTab(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): Promise<void> {
  const doc = buildJsPDFDocument(docType, data, profile);
  const blob = doc.output('blob');
  const docNumber = docType === 'invoice' ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const filename = `${docType.toUpperCase()}_${docNumber || 'DOC'}_${(data.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const base64Data = await blobToBase64(blob);

  // 1. Android Native Bridge
  if (typeof window !== 'undefined' && window.AndroidInterface?.openFile) {
    try {
      const res = window.AndroidInterface.openFile(base64Data, filename, 'application/pdf');
      if (res !== false) return;
    } catch (err) {
      console.warn('Android openFile failed, falling back:', err);
    }
  }

  // 2. Capacitor Native
  if (Capacitor.isNativePlatform()) {
    try {
      const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const saved = await Filesystem.writeFile({
        path: filename,
        data: cleanData,
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        url: saved.uri,
        dialogTitle: 'Open Document',
      });
      return;
    } catch (capErr) {
      console.warn('Capacitor open fallback error:', capErr);
    }
  }

  // 3. Browser
  const url = URL.createObjectURL(blob);
  try {
    const newWin = window.open(url, '_blank');
    if (!newWin) {
      await downloadBlob(blob, filename, 'application/pdf');
    }
  } catch (e) {
    await downloadBlob(blob, filename, 'application/pdf');
  }
}
