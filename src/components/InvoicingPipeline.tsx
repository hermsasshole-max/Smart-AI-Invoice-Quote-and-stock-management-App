import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice } from '../types';
import { formatZAR, getWhatsAppShareLink, generateWhatsAppQuoteSummary } from '../utils/calculator';
import {
  exportToPDF,
  exportToExcel,
  exportToWord,
  exportToPlainText,
  printHtmlDocument,
  openPdfInNewTab,
} from '../utils/multiFormatExport';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import {
  DollarSign,
  FileText,
  MessageSquare,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  Plus,
  Eye,
  Trash2,
  X,
  Send,
  MoreHorizontal,
} from 'lucide-react';

export const InvoicingPipeline: React.FC = () => {
  const { invoices, updateInvoice, deleteInvoice, recordPayment, profile, sunlightMode } = useApp();

  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'EFT' | 'Cash' | 'Card' | 'Instant EFT'>('EFT');
  const [payReference, setPayReference] = useState('');
  const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);

  const handleOpenPayment = (inv: Invoice) => {
    const remaining = inv.totalAmount - inv.amountPaid;
    setPayAmount(remaining > 0 ? remaining : 0);
    setPayReference(`PAY-${inv.invoiceNumber}`);
    setPaymentModalInvoice(inv);
  };

  const handleRecordPayment = () => {
    if (!paymentModalInvoice || payAmount <= 0) return;
    recordPayment(paymentModalInvoice.id, payAmount, payMethod, payReference);
    setPaymentModalInvoice(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>Invoicing & Payment Settlement</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              EFT & SANS Compliant
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track tax invoices, log partial or full EFT settlements, and dispatch automated payment receipts via WhatsApp.
          </p>
        </div>
      </div>

      {/* Invoice List */}
      <div className="space-y-3">
        {invoices.map((inv) => {
          const balance = inv.totalAmount - inv.amountPaid;
          const isPaid = inv.status === 'paid';
          const isOverdue = !isPaid && new Date(inv.dueDate) < new Date();

          const waSummary = generateWhatsAppQuoteSummary('invoice', inv, profile);
          const waLink = getWhatsAppShareLink(inv.clientPhone, waSummary);

          return (
            <div
              key={inv.id}
              className={`p-5 rounded-2xl border transition-all ${
                sunlightMode
                  ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                  : 'bg-[#1B1E28] border-[#282E3E] text-white hover:border-[#334155]'
              }`}
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Invoice Details */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                      {inv.invoiceNumber}
                    </span>
                    <h4 className="font-bold text-base">{inv.clientName}</h4>
                    <span
                      className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                        isPaid
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isOverdue
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {isPaid ? 'PAID IN FULL' : isOverdue ? 'OVERDUE' : inv.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    📞 {inv.clientPhone} • Due Date: <strong className="text-slate-200">{inv.dueDate}</strong> • 📍 {inv.clientAddress}
                  </div>

                  <div className="text-xs text-slate-300 font-medium">
                    <span className="text-sky-400">[{inv.serviceType}]</span> {inv.scopeOfWork}
                  </div>
                </div>

                {/* Financials & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right font-mono pr-2">
                    <div className="text-xs text-slate-400">
                      Total: <span className="font-bold text-white">{formatZAR(inv.totalAmount)}</span>
                    </div>
                    <div className="text-sm font-black">
                      {isPaid ? (
                        <span className="text-emerald-400">PAID</span>
                      ) : (
                        <span className="text-amber-400">Due: {formatZAR(balance)}</span>
                      )}
                    </div>
                  </div>

                  {/* Record Payment CTA */}
                  {!isPaid && (
                    <button
                      onClick={() => handleOpenPayment(inv)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Log Payment</span>
                    </button>
                  )}

                  {/* WhatsApp */}
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
                    title="Send Tax Invoice via WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>

                  {/* Preview Document */}
                  <button
                    onClick={() => setPreviewInvoice(inv)}
                    className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 cursor-pointer"
                    title="Preview Tax Invoice"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* Export Options */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenExportMenuId(openExportMenuId === inv.id ? null : inv.id)}
                      className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 cursor-pointer"
                      title="Export Options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openExportMenuId === inv.id && (
                      <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#12141C] border border-[#334155] shadow-2xl py-1 z-30 text-xs">
                        <button
                          onClick={() => {
                            printHtmlDocument('invoice', inv, profile);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-amber-400 font-semibold border-b border-[#334155]"
                        >
                          <Printer className="w-4 h-4 text-amber-400" />
                          <span>Print / Save as PDF</span>
                        </button>

                        <button
                          onClick={() => {
                            exportToPDF('invoice', inv, profile);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200"
                        >
                          <Download className="w-4 h-4 text-sky-400" />
                          <span>Download PDF</span>
                        </button>

                        <button
                          onClick={() => {
                            exportToExcel('invoice', inv, profile);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200"
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>Export to Excel (.xlsx)</span>
                        </button>

                        <button
                          onClick={() => {
                            exportToWord('invoice', inv, profile);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200"
                        >
                          <Download className="w-4 h-4 text-blue-400" />
                          <span>Export to Word (.docx)</span>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('Delete this invoice?')) {
                              deleteInvoice(inv.id);
                            }
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-red-500/10 flex items-center space-x-2 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Invoice</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {invoices.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-dashed border-[#334155] text-slate-400 text-xs">
            No invoices issued yet. Convert an approved quotation in the Quotations tab to generate an official Tax Invoice.
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#282E3E]">
              <div>
                <h3 className="font-bold text-white text-base">Record Payment Settlement</h3>
                <p className="text-xs text-slate-400 font-mono">{paymentModalInvoice.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Amount Paid (ZAR)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-amber-400 font-mono font-black text-lg focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="EFT">Electronic Funds Transfer (EFT)</option>
                  <option value="Instant EFT">Instant EFT / Ozow / PayFast</option>
                  <option value="Cash">Cash on Hand</option>
                  <option value="Card">Card Machine (Yoco / Speedpoint)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Bank Reference Number</label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. TYME-REF-9921"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-[#282E3E]">
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="px-4 py-2 rounded-xl bg-[#282E3E] text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewInvoice}
        onClose={() => setPreviewInvoice(null)}
        docType="invoice"
        data={previewInvoice}
      />
    </div>
  );
};
