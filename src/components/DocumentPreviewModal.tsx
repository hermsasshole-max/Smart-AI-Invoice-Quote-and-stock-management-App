import React, { useState } from 'react';
import { Quotation, Invoice, BusinessProfile } from '../types';
import { formatZAR, getWhatsAppShareLink, generateWhatsAppQuoteSummary, calculateTotals } from '../utils/calculator';
import {
  exportToPDF,
  exportToExcel,
  exportToWord,
  exportToPlainText,
  printHtmlDocument,
  openPdfInNewTab,
  ExportResult,
} from '../utils/multiFormatExport';
import {
  X,
  Download,
  Share2,
  FileText,
  FileSpreadsheet,
  File,
  Printer,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ShieldCheck,
  Building,
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  Zap,
  Copy,
  Check,
  FolderDown,
  Info,
} from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: 'quote' | 'invoice';
  data: Quotation | Invoice | null;
  profile: BusinessProfile;
  sunlightMode?: boolean;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  docType,
  data,
  profile,
  sunlightMode,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  if (!isOpen || !data) return null;

  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'Tax Invoice' : 'Official Quotation';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const docSecondaryDate = isInvoice
    ? (data as Invoice).dueDate || 'Upon Presentation'
    : (data as Quotation).expiryDate || '30 Days from issue';

  const totals = calculateTotals({
    items: data.items || [],
    calloutFee: data.calloutFee || 0,
    masterLabourHours: data.masterLabourHours || 0,
    masterLabourRate: data.masterLabourRate || 550,
    assistantLabourHours: data.assistantLabourHours || 0,
    assistantLabourRate: data.assistantLabourRate || 150,
    travelKm: data.travelKm || 0,
    travelRate: data.travelRate || 9.5,
    isAfterHours: data.isAfterHours || false,
    afterHoursMultiplier: data.afterHoursMultiplier || 1.5,
    discountPct: data.discountPct || 0,
    vatEnabled: data.vatEnabled,
    vatRate: 15,
  });

  const whatsappText = isInvoice
    ? `Hi ${data.clientName}, please find your Tax Invoice ${docNumber} for ${formatZAR(
        data.totalAmount
      )} from ${profile.companyName}. Banking: ${profile.bankName}, Acc: ${profile.accountNumber}, Ref: ${docNumber}. Thank you!`
    : generateWhatsAppQuoteSummary(profile, docNumber, data.clientName, data.serviceType, totals, data.vatEnabled);

  const handleExport = async (format: 'pdf' | 'xlsx' | 'docx' | 'txt', forceDirect = false) => {
    setIsExporting(format);
    setStatusMessage(null);
    try {
      let result: ExportResult;
      if (format === 'pdf') {
        result = await exportToPDF(docType, data, profile, forceDirect);
      } else if (format === 'xlsx') {
        result = await exportToExcel(docType, data, profile, forceDirect);
      } else if (format === 'docx') {
        result = await exportToWord(docType, data, profile, forceDirect);
      } else {
        result = await exportToPlainText(docType, data, profile, forceDirect);
      }

      if (result.method === 'share') {
        setStatusMessage({
          text: 'Shared or saved to device via Android / System Share!',
          type: 'success',
        });
      } else if (result.method === 'download') {
        setStatusMessage({
          text: `Saved ${result.filename} to your device Downloads folder.`,
          type: 'success',
        });
      } else if (result.method === 'open') {
        setStatusMessage({
          text: 'Document opened in a new tab for instant viewing or manual download.',
          type: 'info',
        });
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setStatusMessage({
        text: `Export initiated. Use "Print / Save as PDF" or "WhatsApp" if your browser restricts direct downloads.`,
        type: 'info',
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handlePrint = () => {
    try {
      printHtmlDocument(docType, data, profile);
      setStatusMessage({
        text: 'Print window opened. In the print dialog, select "Save as PDF" to save directly to your phone.',
        type: 'info',
      });
    } catch (e) {
      window.print();
    }
  };

  const handleOpenPdfTab = async () => {
    try {
      setIsExporting('view-tab');
      await openPdfInNewTab(docType, data, profile);
      setStatusMessage({
        text: 'PDF opened in new tab. You can now view or tap 3-dots -> Download.',
        type: 'success',
      });
    } catch (e) {
      console.error(e);
      handlePrint();
    } finally {
      setIsExporting(null);
    }
  };

  const handleCopyFormattedText = () => {
    const textLines = [
      `*${profile.companyName.toUpperCase()}*`,
      `${profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"}`,
      `Reg: ${profile.regNumber} | VAT: ${profile.vatNumber}`,
      `Tel: ${profile.phone} | Email: ${profile.email}`,
      `Address: ${profile.address}`,
      `-----------------------------------------`,
      `*${docTitle.toUpperCase()}: ${docNumber}*`,
      `Date: ${data.date} | ${isInvoice ? 'Due Date' : 'Valid Until'}: ${docSecondaryDate}`,
      `Client: ${data.clientName} (${data.clientPhone})`,
      `Site: ${data.clientAddress}`,
      `Category: ${data.serviceType}`,
      `-----------------------------------------`,
      `*ITEMIZED SUMMARY:*`,
    ];

    (data.items || []).forEach((it) => {
      textLines.push(`• ${it.description} (${it.quantity} ${it.unit || 'ea'}) - ${formatZAR(it.total)}`);
    });

    if (data.calloutFee > 0) textLines.push(`• Callout Diagnostics: ${formatZAR(data.calloutFee)}`);
    if (data.labourTotal > 0) textLines.push(`• Labour: ${formatZAR(data.labourTotal)}`);
    if (data.travelTotal > 0) textLines.push(`• Travel Surcharge: ${formatZAR(data.travelTotal)}`);

    textLines.push(`-----------------------------------------`);
    textLines.push(`Subtotal: ${formatZAR(data.subtotal)}`);
    if (data.discountAmount && data.discountAmount > 0) {
      textLines.push(`Discount (${data.discountPct}%): -${formatZAR(data.discountAmount)}`);
    }
    if (data.vatEnabled) {
      textLines.push(`VAT (15%): ${formatZAR(data.vatAmount)}`);
    }
    textLines.push(`*TOTAL AMOUNT: ${formatZAR(data.totalAmount)}*`);
    textLines.push(`-----------------------------------------`);
    textLines.push(`*BANKING DETAILS (EFT):*`);
    textLines.push(`Bank: ${profile.bankName || 'Tyme Bank Business'}`);
    textLines.push(`Acc Name: ${profile.accountName || 'Harrys Aircon and Electrical'}`);
    textLines.push(`Acc No: ${profile.accountNumber || '53002734919'}`);
    textLines.push(`Branch: ${profile.branchCode || '678910'}`);
    textLines.push(`Ref: ${docNumber}`);

    navigator.clipboard.writeText(textLines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
    setStatusMessage({
      text: 'Full document copied to clipboard! You can paste directly into WhatsApp, Email, or Notes.',
      type: 'success',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div
        className={`relative w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          sunlightMode
            ? 'bg-white border-black text-black'
            : 'bg-[#1B1E28] border-[#334155] text-[#F8FAFC]'
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#334155] bg-[#232838]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-[#38BDF8]/10 text-[#38BDF8]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold font-mono text-[#F8FAFC]">{docNumber}</span>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full font-mono ${
                    data.status === 'paid'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : data.status === 'accepted'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  {data.status}
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] font-mono">
                {docTitle} • {data.clientName} • {formatZAR(data.totalAmount)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155] transition-colors"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Android Storage & Delivery Banner with Clear Guidance */}
        <div className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-[#0284C7]/20 via-[#38BDF8]/10 to-transparent border-b border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center space-x-2 text-[#38BDF8]">
            <Smartphone className="w-4 h-4 shrink-0 text-[#38BDF8]" />
            <span>
              <strong>Phone Storage Ready:</strong> Android browsers save files directly to your <strong>Downloads</strong> folder without needing OS storage permissions.
            </span>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero OS Permission Required</span>
          </div>
        </div>

        {/* Primary Action Export Toolbar */}
        <div className="px-4 sm:px-6 py-3 border-b border-[#334155] bg-[#232838]/80 flex flex-wrap items-center gap-2">
          {/* Print / Save as PDF (Android Native Spooler) */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-slate-950 font-bold font-mono text-xs flex items-center space-x-2 shadow-lg shadow-[#F59E0B33]"
            title="Open Print Dialog to Save as PDF on Android"
          >
            <Printer className="w-4 h-4 text-slate-950 fill-current" />
            <span>Print / Save as PDF</span>
          </button>

          {/* Native Android Share / Save to Phone */}
          <button
            onClick={() => handleExport('pdf', false)}
            disabled={!!isExporting}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#38BDF8] hover:from-[#0369A1] hover:to-[#0284C7] text-white font-bold font-mono text-xs flex items-center space-x-2 shadow-lg shadow-[#0284C733]"
            title="Save to Android Device or Share via Apps"
          >
            <Share2 className="w-4 h-4" />
            <span>Save to Phone / Share</span>
          </button>

          {/* Direct PDF Download */}
          <button
            onClick={() => handleExport('pdf', true)}
            disabled={!!isExporting}
            className="px-3 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-mono text-xs font-semibold flex items-center space-x-1.5"
            title="Download PDF directly to Downloads"
          >
            <FileText className="w-4 h-4 text-red-400" />
            <span>PDF (.pdf)</span>
          </button>

          {/* View in New Tab */}
          <button
            onClick={handleOpenPdfTab}
            disabled={!!isExporting}
            className="px-3 py-2 rounded-xl bg-sky-600/15 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-mono text-xs font-semibold flex items-center space-x-1.5"
            title="Open PDF in a new browser tab"
          >
            <ExternalLink className="w-4 h-4 text-sky-400" />
            <span>Open in Tab</span>
          </button>

          {/* Excel Spreadsheet */}
          <button
            onClick={() => handleExport('xlsx', true)}
            disabled={!!isExporting}
            className="px-3 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-semibold flex items-center space-x-1.5"
            title="Download Excel Sheet (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel (.xlsx)</span>
          </button>

          {/* Word Document */}
          <button
            onClick={() => handleExport('docx', true)}
            disabled={!!isExporting}
            className="px-3 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-mono text-xs font-semibold flex items-center space-x-1.5"
            title="Download Word Document (.docx)"
          >
            <File className="w-4 h-4 text-blue-400" />
            <span>Word (.docx)</span>
          </button>

          {/* Copy Text to Clipboard */}
          <button
            onClick={handleCopyFormattedText}
            className="px-3 py-2 rounded-xl bg-purple-600/15 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-mono text-xs font-semibold flex items-center space-x-1.5"
            title="Copy entire formatted document text to clipboard"
          >
            {copiedText ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-purple-400" />
                <span>Copy Text</span>
              </>
            )}
          </button>

          {/* WhatsApp Direct Share */}
          <a
            href={getWhatsAppShareLink(data.clientPhone, whatsappText)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-mono text-xs font-bold flex items-center space-x-1.5 ml-auto"
            title="Send to client via WhatsApp"
          >
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp</span>
          </a>
        </div>

        {/* Feedback Alert if applicable */}
        {statusMessage && (
          <div
            className={`px-4 sm:px-6 py-2 text-xs font-mono flex items-center space-x-2 border-b border-[#334155] ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-sky-500/10 text-sky-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Live Document Visual Preview Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0F172A]/40 print:p-0 print:bg-white">
          <div
            id="printable-document-sheet"
            className="max-w-3xl mx-auto bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 overflow-hidden print:border-none print:shadow-none font-sans"
          >
            {/* Header Navy Stripe */}
            <div className="bg-[#1B1E28] text-white p-6 border-b-4 border-[#38BDF8]">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  {profile.logoUrl && (
                    <img
                      src={profile.logoUrl}
                      alt={profile.companyName}
                      className="w-12 h-12 object-contain bg-white/10 rounded-lg p-1"
                    />
                  )}
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-white uppercase">
                      {profile.companyName}
                    </h2>
                    <p className="text-xs text-[#38BDF8] font-medium">
                      {profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"}
                    </p>
                    <div className="text-[11px] text-slate-300 mt-2 space-y-0.5 font-mono">
                      <p>Reg: {profile.regNumber} | VAT: {profile.vatNumber}</p>
                      <p>Tel: {profile.phone} | Email: {profile.email}</p>
                      <p>Address: {profile.address} | Web: {profile.website || 'https://harryselectrical.co.za'}</p>
                    </div>
                  </div>
                </div>

                <div className="text-left md:text-right font-mono">
                  <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg text-sm font-black uppercase tracking-wider mb-2">
                    {docTitle}
                  </span>
                  <div className="text-xs text-slate-200 space-y-0.5">
                    <p><span className="text-slate-400">Ref #:</span> <strong className="text-white">{docNumber}</strong></p>
                    <p><span className="text-slate-400">Date:</span> {data.date}</p>
                    <p><span className="text-slate-400">{isInvoice ? 'Due Date:' : 'Valid Until:'}</span> {docSecondaryDate}</p>
                    <p className="text-[#38BDF8] font-bold uppercase mt-1">Status: {data.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Client & Site Details */}
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <h4 className="text-[11px] font-bold font-mono text-[#0284C7] uppercase tracking-wider mb-2">
                    {isInvoice ? 'Billed To / Site Location' : 'Client & Site Details'}
                  </h4>
                  <div className="space-y-1 text-slate-700">
                    <p className="font-bold text-sm text-slate-900">{data.clientName}</p>
                    <p className="flex items-center space-x-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{data.clientPhone}</span>
                    </p>
                    {data.clientEmail && (
                      <p className="flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{data.clientEmail}</span>
                      </p>
                    )}
                    <p className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{data.clientAddress}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold font-mono text-[#0284C7] uppercase tracking-wider mb-2">
                    Job Specifications
                  </h4>
                  <div className="space-y-1 text-slate-700">
                    <p><span className="text-slate-500">Service Category:</span> <strong className="text-slate-900">{data.serviceType}</strong></p>
                    {data.scopeOfWork && (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                        <span className="font-bold block text-[10px] uppercase text-amber-700 font-mono mb-0.5">Scope of Work</span>
                        {data.scopeOfWork}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="p-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0284C7] text-white font-mono uppercase text-[11px]">
                    <th className="py-2.5 px-3 rounded-l-md">Item / Description</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate (ZAR)</th>
                    <th className="py-2.5 px-3 text-right rounded-r-md">Total (ZAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {(data.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{item.description}</td>
                      <td className="py-2.5 px-2 text-center font-mono">{item.quantity} {item.unit || 'ea'}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatZAR(item.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatZAR(item.total)}</td>
                    </tr>
                  ))}

                  {data.calloutFee > 0 && (
                    <tr className="hover:bg-slate-50 bg-slate-50/50">
                      <td className="py-2 px-3 font-medium text-slate-800">Standard Callout & Technical Diagnostics</td>
                      <td className="py-2 px-2 text-center font-mono">1 ea</td>
                      <td className="py-2 px-3 text-right font-mono">{formatZAR(data.calloutFee)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatZAR(data.calloutFee)}</td>
                    </tr>
                  )}

                  {data.labourTotal > 0 && (
                    <tr className="hover:bg-slate-50 bg-slate-50/50">
                      <td className="py-2 px-3 font-medium text-slate-800">Technical Labour & Installation Execution</td>
                      <td className="py-2 px-2 text-center font-mono">1 lot</td>
                      <td className="py-2 px-3 text-right font-mono">{formatZAR(data.labourTotal)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatZAR(data.labourTotal)}</td>
                    </tr>
                  )}

                  {data.travelTotal > 0 && (
                    <tr className="hover:bg-slate-50 bg-slate-50/50">
                      <td className="py-2 px-3 font-medium text-slate-800">Travel & Logistics Surcharge</td>
                      <td className="py-2 px-2 text-center font-mono">1 trip</td>
                      <td className="py-2 px-3 text-right font-mono">{formatZAR(data.travelTotal)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatZAR(data.travelTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Summary Totals & Bank Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-4 border-t-2 border-slate-200">
                {/* EFT Bank Details */}
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-xs">
                  <h5 className="font-bold text-[#0284C7] uppercase text-[11px] mb-2 flex items-center space-x-1.5">
                    <Building className="w-3.5 h-3.5" />
                    <span>Banking Details (EFT Settlement)</span>
                  </h5>
                  <div className="space-y-1 text-slate-700 text-[11px]">
                    <p><span className="text-slate-500">Bank:</span> <strong>{profile.bankName || 'Tyme Bank Business'}</strong></p>
                    <p><span className="text-slate-500">Account Name:</span> <strong>{profile.accountName || 'Harrys Aircon and Electrical'}</strong></p>
                    <p><span className="text-slate-500">Account Number:</span> <strong>{profile.accountNumber || '53002734919'}</strong></p>
                    <p><span className="text-slate-500">Branch Code:</span> <strong>{profile.branchCode || '678910'}</strong> ({profile.accountType || 'Current'})</p>
                    <p><span className="text-slate-500">Reference:</span> <strong className="text-[#0284C7]">{docNumber}</strong></p>
                  </div>
                </div>

                {/* Calculation Totals */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal (Excl VAT):</span>
                    <span className="font-bold text-slate-900">{formatZAR(data.subtotal)}</span>
                  </div>

                  {data.discountAmount && data.discountAmount > 0 ? (
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Discount ({data.discountPct}%):</span>
                      <span>-{formatZAR(data.discountAmount)}</span>
                    </div>
                  ) : null}

                  {data.vatEnabled ? (
                    <div className="flex justify-between text-slate-600">
                      <span>South African VAT (15%):</span>
                      <span className="font-bold text-slate-900">{formatZAR(data.vatAmount)}</span>
                    </div>
                  ) : null}

                  <div className="flex justify-between text-base font-black text-[#1B1E28] pt-2 border-t border-slate-300">
                    <span>TOTAL AMOUNT:</span>
                    <span className="text-[#0284C7]">{formatZAR(data.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="mt-6 pt-4 border-t border-slate-200 text-[11px] text-slate-500 italic">
                <p><strong>Terms:</strong> {(data as Quotation).terms || '80% Deposit on acceptance, balance on completion. All materials remain property of contractor until paid in full.'}</p>
                <p className="mt-1">Certified SANS 10142 compliance & workmanship warranty from Harry's Aircon Electrical & Solar Services.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-[#334155] bg-[#232838] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center space-x-2 text-[#94A3B8]">
            <FolderDown className="w-4 h-4 text-[#38BDF8]" />
            <span>Files save to your phone's <strong>Downloads</strong> or <strong>Google Drive</strong>.</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-semibold flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print to PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#334155] hover:bg-[#475569] text-[#F8FAFC] font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
