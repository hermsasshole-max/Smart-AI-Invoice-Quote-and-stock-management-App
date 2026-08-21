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
import { BusinessProfile, Quotation, Invoice } from '../types';
import { formatZAR } from './calculator';

export interface ExportResult {
  filename: string;
  method: 'share' | 'download' | 'open';
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveOrShareFile(
  blob: Blob,
  filename: string,
  mimeType: string,
  title: string,
  forceDownloadOnly: boolean = false
): Promise<ExportResult> {
  if (typeof window !== 'undefined' && window.AndroidInterface?.saveFile) {
    try {
      const base64Data = await blobToBase64(blob);
      window.AndroidInterface.saveFile(base64Data, filename, mimeType);
      return { filename, method: 'download' };
    } catch (bridgeErr) {
      console.warn('AndroidInterface.saveFile failed, falling back:', bridgeErr);
    }
  }

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
    const dataUrl = await blobToBase64(blob);
    const win = window.open(dataUrl, '_blank');
    if (!win) {
      window.location.href = dataUrl;
    }
    return { filename, method: 'open' };
  }
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

  const headerHeight = shouldCondenseSinglePage ? 36 : 42;
  const clientBoxY = shouldCondenseSinglePage ? 41 : 48;
  const clientBoxHeight = shouldCondenseSinglePage ? 26 : 34;
  const tableStartY = shouldCondenseSinglePage ? 70 : 86;
  const tableFontSize = shouldCondenseSinglePage ? 7.5 : 8.5;
  const tableHeadFontSize = shouldCondenseSinglePage ? 8 : 9;
  const tableCellPadding = shouldCondenseSinglePage ? 1.8 : 3;
  const bankingBoxHeight = shouldCondenseSinglePage ? 28 : 36;
  const lineSpacing = shouldCondenseSinglePage ? 4.5 : 5.5;

  doc.setFillColor(27, 30, 40);
  doc.rect(0, 0, 210, headerHeight, 'F');

  doc.setFillColor(56, 189, 248);
  doc.rect(0, headerHeight, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 14 : 16);
  doc.text(profile.companyName.toUpperCase(), 14, shouldCondenseSinglePage ? 12 : 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(shouldCondenseSinglePage ? 8 : 9);
  doc.setTextColor(56, 189, 248);
  doc.text(profile.tagline || 'Electrical   Air Conditioning   Solar   Security', 14, shouldCondenseSinglePage ? 17 : 21);

  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Reg: ${profile.regNumber} | VAT: ${profile.vatNumber}`, 14, shouldCondenseSinglePage ? 22 : 27);
  doc.text(`Tel: ${profile.phone} | Email: ${profile.email}`, 14, shouldCondenseSinglePage ? 27 : 32);
  if (!shouldCondenseSinglePage) {
    doc.text(`Address: ${profile.address}`, 14, 37);
  }

  doc.setFillColor(245, 158, 11);
  doc.roundedRect(140, shouldCondenseSinglePage ? 8 : 10, 56, shouldCondenseSinglePage ? 8.5 : 10, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(shouldCondenseSinglePage ? 9.5 : 11);
  doc.text(docTitle, 168, shouldCondenseSinglePage ? 13.5 : 16.5, { align: 'center' });

  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Ref #: ${docNumber}`, 140, shouldCondenseSinglePage ? 21 : 26);
  doc.text(`Date: ${data.date}`, 140, shouldCondenseSinglePage ? 26 : 31);
  doc.text(`${isInvoice ? 'Due Date' : 'Valid Until'}: ${docSecondaryDate}`, 140, shouldCondenseSinglePage ? 31 : 36);

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

  doc.setTextColor(2, 132, 199);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB SPECIFICATION', 110, clientBoxY + (shouldCondenseSinglePage ? 5 : 7));
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(shouldCondenseSinglePage ? 7.5 : 8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Category: ${data.serviceType}`, 110, clientBoxY + (shouldCondenseSinglePage ? 11 : 14));
  const splitScope = doc.splitTextToSize(data.scopeOfWork || 'On-site technical scope', 80);
  doc.text(splitScope.slice(0, 2), 110, clientBoxY + (shouldCondenseSinglePage ? 16 : 20));

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
  doc.setFontSize(shouldCondenseSinglePage ? 9.5 : 11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL AMOUNT:', 130, totalsY + 2);
  doc.setTextColor(2, 132, 199);
  doc.text(formatZAR(data.totalAmount), 196, totalsY + 2, { align: 'right' });

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
  forceDownload: boolean = false
): Promise<ExportResult> {
  const doc = buildJsPDFDocument(docType, data, profile);
  const blob = doc.output('blob');
  const docNumber = docType === 'invoice' ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const title = `${docType === 'invoice' ? 'Tax Invoice' : 'Quotation'} ${docNumber}`;
  return await saveOrShareFile(blob, filename, 'application/pdf', title, forceDownload);
}

export async function exportToExcel(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile,
  forceDownload: boolean = false
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
  forceDownload: boolean = false
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
          new Paragraph({ text: '' }),
          new Paragraph({
            text: `EFT Details: ${profile.bankName} | Acc: ${profile.accountNumber} | Branch: ${profile.branchCode} | Ref: ${docNumber}`,
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
  forceDownload: boolean = false
): Promise<ExportResult> {
  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'TAX INVOICE' : 'OFFICIAL QUOTATION';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;

  let text = `=================================================\n`;
  text += `${profile.companyName.toUpperCase()}\n`;
  text += `${profile.tagline}\n`;
  text += `Reg: ${profile.regNumber} | VAT: ${profile.vatNumber}\n`;
  text += `Tel: ${profile.phone} | Email: ${profile.email}\n`;
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
  if (data.vatEnabled) text += `VAT (15%): ${formatZAR(data.vatAmount)}\n`;
  text += `TOTAL AMOUNT: ${formatZAR(data.totalAmount)}\n\n`;
  text += `EFT Details:\n`;
  text += `Bank: ${profile.bankName}\n`;
  text += `Account: ${profile.accountNumber}\n`;
  text += `Branch: ${profile.branchCode}\n`;
  text += `Ref: ${docNumber}\n`;

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
      body { background: #ffffff; padding: 0; }
      .print-actions { display: none !important; }
      .print-sheet { border: none !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn-print" onclick="window.print()">
        Tap to Print / Save as PDF
    </button>
    <span style="color: #94A3B8; font-size: 13px; font-family: monospace;">
      On Android: In the print dialog, select <strong>"Save as PDF"</strong> to save to phone.
    </span>
  </div>
  <div class="print-sheet">
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
    <div style="padding: 20px 24px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #0284C7; font-family: monospace;">
            ${isInvoice ? 'Billed To / Site Location' : 'Client & Site Details'}
          </h4>
          <div style="font-size: 13px; line-height: 1.5; color: #334155;">
            <div style="font-weight: 700; color: #0F172A; font-size: 14px;">${data.clientName}</div>
            <div>  ${data.clientPhone}</div>
            ${data.clientEmail ? `<div>  ${data.clientEmail}</div>` : ''}
            <div>  ${data.clientAddress}</div>
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
          ${consumablesRow}
          ${miscRow}
          ${travelRow}
        </tbody>
      </table>
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; padding-top: 16px; border-top: 2px solid #E2E8F0;">
        <div style="background: #F1F5F9; padding: 14px; border-radius: 8px; border: 1px solid #E2E8F0; font-family: monospace; font-size: 11px;">
          <div style="font-weight: 700; color: #0284C7; text-transform: uppercase; margin-bottom: 8px;">
              Banking Details (EFT Settlement)
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

export function printHtmlDocument(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): void {
  if (typeof window !== 'undefined' && window.AndroidInterface?.printDocument) {
    try {
      window.AndroidInterface.printDocument();
      return;
    } catch (printErr) {
      console.warn('AndroidInterface.printDocument error, using web print:', printErr);
    }
  }

  const html = generatePrintableHtml(docType, data, profile);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
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

  if (typeof window !== 'undefined' && window.AndroidInterface?.shareFile) {
    try {
      const base64Data = await blobToBase64(blob);
      window.AndroidInterface.shareFile(base64Data, filename, mimeType, title);
      return { filename, method: 'share' };
    } catch (err) {
      console.warn('AndroidInterface.shareFile failed:', err);
    }
  }

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

  return await saveOrShareFile(blob, filename, mimeType, title, true);
}

export async function openPdfInNewTab(
  docType: 'quote' | 'invoice',
  data: Quotation | Invoice,
  profile: BusinessProfile
): Promise<void> {
  const doc = buildJsPDFDocument(docType, data, profile);
  const blob = doc.output('blob');
  const docNumber = docType === 'invoice' ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const filename = `${docType.toUpperCase()}_${docNumber}_${data.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const base64Data = await blobToBase64(blob);

  if (typeof window !== 'undefined' && window.AndroidInterface?.openFile) {
    try {
      window.AndroidInterface.openFile(base64Data, filename, 'application/pdf');
      return;
    } catch (err) {
      console.warn('Android openFile failed, opening in browser tab:', err);
    }
  }

  const url = URL.createObjectURL(blob);
  const newWin = window.open(url, '_blank');
  if (!newWin) {
    window.location.href = url;
  }
}
