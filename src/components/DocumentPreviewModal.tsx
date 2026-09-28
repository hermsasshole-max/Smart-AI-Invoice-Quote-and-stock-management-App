import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Quotation, Invoice } from '../types';
import { formatZAR, getWhatsAppShareLink, generateWhatsAppQuoteSummary } from '../utils/calculator';
import {
  exportToPDF,
  exportToExcel,
  exportToWord,
  exportToPlainText,
  printHtmlDocument,
  openPdfInNewTab,
  shareDocumentDirectly,
  openExternalUrl,
} from '../utils/multiFormatExport';
import { ShareModal } from './ShareModal';
import {
  X,
  Printer,
  Download,
  Share2,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  ExternalLink,
  Check,
  Copy,
  Smartphone,
} from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: 'quote' | 'invoice';
  data: Quotation | Invoice | null;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  docType,
  data,
}) => {
  const { profile, sunlightMode } = useApp();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  if (!isOpen || !data) return null;

  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'Tax Invoice' : 'Official Quotation';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const docSecondaryDate = isInvoice
    ? (data as Invoice).dueDate || 'Upon Presentation'
    : (data as Quotation).expiryDate || '30 Days';

  const isAndroidApp = typeof window !== 'undefined' && !!(window as any).AndroidInterface;

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const waSummary = generateWhatsAppQuoteSummary(docType, data, profile);
  const waLink = getWhatsAppShareLink(data.clientPhone, waSummary);

  const copyToClipboard = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(waSummary);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = waSummary;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      showNotification('WhatsApp summary copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      showNotification('Could not copy to clipboard');
    }
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'word' | 'txt') => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        showNotification('Generating vector PDF...');
        await exportToPDF(docType, data, profile, true);
        showNotification(isAndroidApp ? 'Saving PDF to Downloads folder...' : 'PDF downloaded successfully!');
      } else if (format === 'excel') {
        showNotification('Generating Excel sheet...');
        await exportToExcel(docType, data, profile, true);
        showNotification('Excel spreadsheet downloaded!');
      } else if (format === 'word') {
        showNotification('Generating Word document...');
        await exportToWord(docType, data, profile, true);
        showNotification('Word document downloaded!');
      } else if (format === 'txt') {
        await exportToPlainText(docType, data, profile, true);
        showNotification('Text export downloaded!');
      }
    } catch (err) {
      console.error('Export error:', err);
      showNotification('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="modal-container relative w-full max-w-4xl bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Toast Alert */}
        {toastMsg && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-full shadow-lg border border-sky-400 animate-fade-in flex items-center space-x-2">
            <Check className="w-3.5 h-3.5" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Modal Header Actions Bar */}
        <div className="no-print action-buttons print-actions flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-[#151722] border-b border-[#282E3E]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>{docTitle}</span>
                <span className="text-sky-400 font-mono text-sm">{docNumber}</span>
                {isAndroidApp && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                    <Smartphone className="w-3 h-3" /> Android App
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Prepared for {data.clientName} ({data.clientPhone})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                showNotification('Opening Print / PDF Spooler...');
                printHtmlDocument(docType, data, profile);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Print directly or save via Android print spooler"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleShare}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Share PDF via Android Share Sheet (Drive, WhatsApp, Print, Files)"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>

            <button
              onClick={() => openPdfInNewTab(docType, data, profile)}
              className="px-3 py-1.5 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Open PDF in a new standalone browser tab"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">New Tab</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#282E3E] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content: Document Visual Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0F1118] print:p-0 print:bg-white">
          <div className="print-sheet invoice-container invoice-card print-area max-w-3xl mx-auto bg-white text-[#0F172A] rounded-xl shadow-xl overflow-hidden border border-slate-200" data-printable="true">
            {/* Header Banner */}
            <div className="invoice-header bg-[#1B1E28] text-white p-6 border-b-4 border-sky-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-black tracking-wide text-white uppercase">
                    {profile.companyName}
                  </h3>
                  <p className="text-xs text-sky-400 font-medium">
                    {profile.tagline || "Electrical • Air Conditioning • Solar • Security"}
                  </p>
                  <div className="mt-2 text-[11px] text-slate-300 font-mono space-y-0.5">
                    <div>Reg: {profile.regNumber} | VAT: {profile.vatNumber}</div>
                    <div>Tel: {profile.phone} | Email: {profile.email}</div>
                    <div>Address: {profile.address}</div>
                  </div>
                </div>

                <div className="text-left sm:text-right font-mono">
                  <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-xs font-black uppercase mb-1">
                    {docTitle}
                  </span>
                  <div className="text-xs text-slate-300 space-y-0.5">
                    <div><span className="text-slate-400">Ref:</span> <strong>{docNumber}</strong></div>
                    <div><span className="text-slate-400">Date:</span> {data.date}</div>
                    <div><span className="text-slate-400">{isInvoice ? 'Due:' : 'Valid:'}</span> {docSecondaryDate}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Client & Scope Bar */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 font-mono block mb-1">
                  {isInvoice ? 'Billed To & Site Location' : 'Client & Site Details'}
                </span>
                <div className="font-bold text-sm text-slate-900">{data.clientName}</div>
                <div className="text-slate-600">📞 {data.clientPhone}</div>
                {data.clientEmail && <div className="text-slate-600">✉️ {data.clientEmail}</div>}
                <div className="text-slate-600 mt-1">📍 {data.clientAddress}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 font-mono block mb-1">
                  Job Specifications
                </span>
                <div className="font-semibold text-slate-800">Category: {data.serviceType}</div>
                {data.scopeOfWork && (
                  <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-950 text-[11px] leading-relaxed">
                    <strong className="block text-[9px] uppercase font-mono text-amber-800 mb-0.5">Scope of Work</strong>
                    {data.scopeOfWork}
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="p-6">
              <table className="invoice-table w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-sky-600 text-white font-mono uppercase text-[10px]">
                    <th className="p-2.5 rounded-l">Item / Description</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Rate (ZAR)</th>
                    <th className="p-2.5 text-right rounded-r">Total (ZAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Materials & Stock Items */}
                  {(data.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-900">
                        <div>{item.description}</div>
                        {item.category && (
                          <div className="text-[10px] text-slate-400 font-mono">{item.category}</div>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600">{item.quantity} {item.unit || 'ea'}</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">{formatZAR(item.unitPrice)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatZAR(item.total)}</td>
                    </tr>
                  ))}

                  {/* 1. Callout Fee */}
                  {data.calloutFee > 0 && (
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-900">
                        <div>Call-Out Fee (Includes 1st Hour Technical Labor)</div>
                        <div className="text-[10px] text-slate-400">Site diagnostic inspection & primary labor</div>
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600">1 ea</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">{formatZAR(data.calloutFee)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatZAR(data.calloutFee)}</td>
                    </tr>
                  )}

                  {/* 2. Additional Labour Hours */}
                  {data.labourHours > 0 && (
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-900">
                        <div>Additional Technical Labour ({data.labourHours} hrs @ {formatZAR(data.labourRatePerHour || 450)}/hr)</div>
                        <div className="text-[10px] text-slate-400">Labor worked after the initial 1st hour</div>
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600">{data.labourHours} hrs</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">{formatZAR(data.labourRatePerHour || 450)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatZAR(data.additionalLabourTotal ?? ((data.labourHours || 0) * (data.labourRatePerHour || 450)))}
                      </td>
                    </tr>
                  )}

                  {/* 3. Consumables & Fasteners */}
                  {Boolean(data.consumablesFee && data.consumablesFee > 0) && (
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-900">
                        <div className="flex items-center space-x-1.5">
                          <span>Consumables & Fasteners</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono uppercase font-bold">
                            {data.consumablesTier || 'Standard'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {data.consumablesDescription || 'Fasteners, fixings, sealant, tape, lugs & glands'}
                        </div>
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600">1 lot</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">{formatZAR(data.consumablesFee || 0)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatZAR(data.consumablesFee || 0)}</td>
                    </tr>
                  )}

                  {/* 4. Miscellaneous Charges */}
                  {Boolean(data.miscellaneousFee && data.miscellaneousFee > 0) && (
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-900">
                        <div>Miscellaneous Site Surcharges</div>
                        <div className="text-[10px] text-slate-500">{data.miscellaneousDescription || 'Site equipment / access fee'}</div>
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600">1 item</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">{formatZAR(data.miscellaneousFee || 0)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatZAR(data.miscellaneousFee || 0)}</td>
                    </tr>
                  )}

                  {/* 5. Logistics & Travel */}
                  {data.travelTotal > 0 && (
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-900">
                        <div>Logistics & Travel Surcharge ({data.travelDistanceKm} km @ {formatZAR(data.travelRatePerKm || 7.5)}/km)</div>
                        <div className="text-[10px] text-slate-400">Round-trip site vehicle dispatch</div>
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600">{data.travelDistanceKm} km</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">{formatZAR(data.travelRatePerKm || 7.5)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatZAR(data.travelTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals & Banking Details */}
              <div className="invoice-totals mt-6 pt-4 border-t-2 border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-lg font-mono text-xs text-slate-700">
                  <div className="font-bold text-sky-600 uppercase mb-1 flex items-center space-x-1">
                    <span>🏦 Banking Details (EFT)</span>
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    <div>Bank: <strong>{profile.bankName || '—'}</strong></div>
                    <div>Account Name: <strong>{profile.accountName || profile.companyName || '—'}</strong></div>
                    <div>Account Number: <strong>{profile.accountNumber || '—'}</strong></div>
                    <div>Branch Code: <strong>{profile.branchCode || '—'}</strong></div>
                    <div>Reference: <strong className="text-sky-600">{docNumber}</strong></div>
                  </div>
                </div>

                <div className="font-mono text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal (Excl VAT):</span>
                    <span className="font-bold text-slate-900">{formatZAR(data.subtotal)}</span>
                  </div>
                  {data.discountAmount && data.discountAmount > 0 && (
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Discount ({data.discountPct}%):</span>
                      <span>-{formatZAR(data.discountAmount)}</span>
                    </div>
                  )}
                  {data.vatEnabled && (
                    <div className="flex justify-between text-slate-600">
                      <span>South African VAT (15%):</span>
                      <span className="font-bold text-slate-900">{formatZAR(data.vatAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-300">
                    <span>TOTAL:</span>
                    <span className="text-sky-600">{formatZAR(data.totalAmount)}</span>
                  </div>
                  {isInvoice ? (
                    ((data as Invoice).amountPaid > 0 || (data as Invoice).depositAmountPaid) && (
                      <div className="pt-2.5 border-t border-slate-200 text-xs space-y-1.5">
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Total Paid to Date:</span>
                          <span>-{formatZAR((data as Invoice).amountPaid || (data as Invoice).depositAmountPaid || 0)}</span>
                        </div>
                        {(data as Invoice).payments && (data as Invoice).payments!.length > 0 ? (
                          <div className="bg-emerald-50/70 border border-emerald-200 rounded p-2 text-[10px] space-y-1">
                            <div className="font-bold text-emerald-800 uppercase font-mono text-[9px]">Payments Logged:</div>
                            {(data as Invoice).payments!.map((pmt, pIdx) => (
                              <div key={pIdx} className="flex justify-between text-slate-700 font-mono">
                                <span>{pmt.date} • {pmt.method} {pmt.reference ? `(${pmt.reference})` : ''}</span>
                                <span className="font-bold text-emerald-700">{formatZAR(pmt.amount)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (data as Invoice).depositPaidDate ? (
                          <div className="text-[10px] text-slate-500 font-sans">
                            Paid via {(data as Invoice).depositPaymentMethod || 'EFT'} on {(data as Invoice).depositPaidDate}
                            {(data as Invoice).depositReference ? ` (Ref: ${(data as Invoice).depositReference})` : ''}
                          </div>
                        ) : null}
                        <div className="flex justify-between text-sm font-black text-red-600 bg-red-50 p-2 rounded border border-red-200">
                          <span>REMAINING BALANCE DUE:</span>
                          <span>{formatZAR(Math.max(0, data.totalAmount - ((data as Invoice).amountPaid || (data as Invoice).depositAmountPaid || 0)))}</span>
                        </div>
                      </div>
                    )
                  ) : (
                    (data as Quotation).isDepositPaid && ((data as Quotation).depositAmountPaid || 0) > 0 ? (
                      <div className="pt-2.5 border-t border-slate-200 text-xs space-y-1.5">
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Deposit Paid:</span>
                          <span>-{formatZAR((data as Quotation).depositAmountPaid || 0)}</span>
                        </div>
                        {(data as Quotation).depositPaidDate && (
                          <div className="text-[10px] text-emerald-700 font-sans">
                            Received via {(data as Quotation).depositPaymentMethod || 'EFT'} on {(data as Quotation).depositPaidDate}
                            {(data as Quotation).depositReference ? ` (Ref: ${(data as Quotation).depositReference})` : ''}
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                          <span>REMAINING BALANCE:</span>
                          <span>{formatZAR(Math.max(0, data.totalAmount - ((data as Quotation).depositAmountPaid || 0)))}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2.5 border-t border-slate-200 text-xs space-y-1 text-slate-600">
                        <div className="flex justify-between">
                          <span>Deposit Required ({(data as Quotation).depositPercentage || 80}%):</span>
                          <span className="font-semibold text-slate-800">
                            {formatZAR((data as Quotation).depositAmount || (data.totalAmount * ((data as Quotation).depositPercentage || 80)) / 100)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Balance on Completion:</span>
                          <span>
                            {formatZAR(data.totalAmount - ((data as Quotation).depositAmount || (data.totalAmount * ((data as Quotation).depositPercentage || 80)) / 100))}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Footer SANS Notice */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 font-mono flex flex-col sm:flex-row justify-between items-center gap-2">
              <div>{profile.sansComplianceNotice}</div>
              <div>{profile.companyName || ''}</div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Multi-Format Export Bar */}
        <div className="no-print action-buttons p-4 bg-[#151722] border-t border-[#282E3E] flex flex-wrap items-center justify-between gap-3">
          {/* WhatsApp & Copy */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => openExternalUrl(waLink)}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send WhatsApp</span>
            </button>

            <button
              onClick={copyToClipboard}
              className="px-3 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied Text!' : 'Copy Summary'}</span>
            </button>
          </div>

          {/* Download & Save Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-sky-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Save or Share PDF on Android"
            >
              <Download className="w-4 h-4" />
              <span>PDF (.pdf)</span>
            </button>

            <button
              onClick={() => handleExport('excel')}
              disabled={isExporting}
              className="px-3 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Download Excel Spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => handleExport('word')}
              disabled={isExporting}
              className="px-3 py-2 rounded-xl bg-blue-700/80 hover:bg-blue-600 text-white text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Download Word Document"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Word (.docx)</span>
            </button>

            <button
              onClick={() => handleExport('txt')}
              disabled={isExporting}
              className="px-3 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Download Plain Text"
            >
              <span>Plain Text</span>
            </button>
          </div>
        </div>
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        docType={docType}
        data={data}
        profile={profile}
      />
    </div>
  );
};
