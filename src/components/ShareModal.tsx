import React, { useState } from 'react';
import { Quotation, Invoice, BusinessProfile } from '../types';
import { formatZAR, generateWhatsAppQuoteSummary, getWhatsAppShareLink } from '../utils/calculator';
import { exportToPDF } from '../utils/multiFormatExport';
import {
  X,
  MessageSquare,
  Mail,
  Copy,
  Download,
  Share2,
  Check,
  Smartphone,
  FileText,
  ExternalLink,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: 'quote' | 'invoice';
  data: Quotation | Invoice | null;
  profile: BusinessProfile;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  docType,
  data,
  profile,
}) => {
  const [copied, setCopied] = useState(false);
  const [customPhone, setCustomPhone] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (data) {
      setCustomPhone(data.clientPhone || '');
      setCustomEmail(data.clientEmail || '');
    }
  }, [data]);

  if (!isOpen || !data) return null;

  const isInvoice = docType === 'invoice';
  const docTitle = isInvoice ? 'Tax Invoice' : 'Official Quotation';
  const docNumber = isInvoice ? (data as Invoice).invoiceNumber : (data as Quotation).quoteNumber;
  const targetPhone = customPhone.trim() || data.clientPhone || '';
  const targetEmail = customEmail.trim() || data.clientEmail || '';

  const waSummary = generateWhatsAppQuoteSummary(docType, data, profile);
  const waLink = getWhatsAppShareLink(targetPhone, waSummary);

  const emailSubject = encodeURIComponent(`${docTitle} ${docNumber} - ${profile.companyName || 'CorTech'}`);
  const emailBody = encodeURIComponent(
    `Dear ${data.clientName},\n\nPlease find attached the details for ${docTitle} ${docNumber}.\n\nTotal Amount: ${formatZAR(data.totalAmount)}\nDate: ${data.date}\n\nSummary:\n${waSummary}\n\nKind regards,\n${profile.companyName || ''}\n${profile.phone || ''}`
  );
  const mailtoLink = `mailto:${targetEmail}?subject=${emailSubject}&body=${emailBody}`;

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleCopySummary = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(waSummary);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = waSummary;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      showFeedback('Summary text copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Copy error:', err);
      showFeedback('Could not copy to clipboard.');
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      showFeedback('Generating and downloading PDF...');
      await exportToPDF(docType, data, profile, true);
      showFeedback('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      showFeedback('Failed to download PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleNativeShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `${docTitle} ${docNumber}`,
          text: waSummary,
        });
        showFeedback('Shared successfully via system drawer!');
      } else {
        handleCopySummary();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Native share failed:', err);
        handleCopySummary();
      }
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 no-print">
      <div className="relative w-full max-w-lg bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#151722] border-b border-[#282E3E]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Share {docTitle}</span>
                <span className="text-sky-400 font-mono text-xs">{docNumber}</span>
              </h3>
              <p className="text-xs text-slate-400">
                Prepared for {data.clientName} ({formatZAR(data.totalAmount)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#282E3E] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert banner */}
        {feedbackMsg && (
          <div className="px-4 py-2.5 bg-sky-600/90 text-white text-xs font-semibold flex items-center justify-center space-x-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-300" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Quick Recipient Details Check */}
          <div className="bg-[#12141C] p-3.5 rounded-xl border border-[#282E3E] space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between">
              <span>Client Contact Details</span>
              <span className="text-emerald-400 text-[10px]">Editable for dispatch</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">WhatsApp Phone Number:</label>
                <input
                  type="text"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="e.g. 082 123 4567"
                  className="w-full px-2.5 py-1.5 bg-[#1B1E28] border border-[#334155] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Email Address:</label>
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="client@example.co.za"
                  className="w-full px-2.5 py-1.5 bg-[#1B1E28] border border-[#334155] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Action 1: WhatsApp Primary Dispatch */}
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                <MessageSquare className="w-4 h-4" />
                <span>Instant WhatsApp Dispatch</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                1-Tap Send
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Sends an itemized summary with deposit terms, totals, and EFT banking details directly to the client's WhatsApp.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => showFeedback('Opening WhatsApp...')}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send via WhatsApp {targetPhone ? `(${targetPhone})` : ''}</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
            </a>
          </div>

          {/* Action 2: Email Dispatch */}
          <div className="p-4 bg-blue-950/30 border border-blue-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 flex items-center space-x-1.5">
                <Mail className="w-4 h-4" />
                <span>Email Official Breakdown</span>
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                Email App
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Opens your device's default mail client with the subject and line-by-line quote summary pre-populated.
            </p>
            <a
              href={mailtoLink}
              onClick={() => showFeedback('Opening default mail client...')}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
            >
              <Mail className="w-4 h-4" />
              <span>Send via Email {targetEmail ? `(${targetEmail})` : ''}</span>
            </a>
          </div>

          {/* Action 3: Download PDF Direct */}
          <div className="p-4 bg-sky-950/30 border border-sky-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 flex items-center space-x-1.5">
                <FileText className="w-4 h-4" />
                <span>Save / Download Vector PDF</span>
              </span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono">
                A4 Vector (.pdf)
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Generates the clean A4 PDF file directly onto your phone or computer Downloads folder to attach anywhere.
            </p>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF Document'}</span>
            </button>
          </div>

          {/* Action 4 & 5: Copy Summary & Native Share Drawer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopySummary}
              className="py-2.5 px-3 bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Text Summary'}</span>
            </button>

            {canNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2.5 px-3 bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-purple-600/20"
              >
                <Smartphone className="w-4 h-4" />
                <span>Device Share Drawer</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#151722] border-t border-[#282E3E] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
