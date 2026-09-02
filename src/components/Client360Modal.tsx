import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Client, Quotation, Invoice } from '../types';
import { formatZAR } from '../utils/calculator';
import {
  User,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  FileText,
  DollarSign,
  ShieldCheck,
  Navigation,
  Calendar,
  ExternalLink,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react';

interface Client360ModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateQuote?: (client: Client) => void;
}

export const Client360Modal: React.FC<Client360ModalProps> = ({
  client,
  isOpen,
  onClose,
  onCreateQuote,
}) => {
  const { quotes, invoices, sunlightMode } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'quotes' | 'invoices' | 'compliance'>('overview');

  if (!isOpen || !client) return null;

  const clientQuotes = quotes.filter(
    (q) => q.clientId === client.id || q.clientName.toLowerCase() === client.name.toLowerCase()
  );

  const clientInvoices = invoices.filter(
    (inv) => inv.clientId === client.id || inv.clientName.toLowerCase() === client.name.toLowerCase()
  );

  const totalQuoted = clientQuotes.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
  const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalPaid = clientInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);

  const cleanPhone = client.phone.replace(/[^0-9]/g, '');
  const waUrl = `https://wa.me/${cleanPhone.startsWith('0') ? '27' + cleanPhone.slice(1) : cleanPhone}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address || client.name)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div
        className={`w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden transition-all my-auto ${
          sunlightMode
            ? 'bg-white border-slate-300 text-slate-900'
            : 'bg-[#151824] border-[#2A3146] text-white'
        }`}
      >
        {/* Header Profile Hero */}
        <div className="px-6 py-5 border-b border-slate-700/50 bg-gradient-to-r from-sky-500/10 via-amber-500/10 to-transparent flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-sky-500/20">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-lg sm:text-xl tracking-tight">{client.name}</h3>
                {client.company && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                    {client.company}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">{client.address || 'No address specified'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold flex items-center space-x-1.5 border border-slate-700 shadow-sm"
              title="Open Navigation in Google Maps"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Navigate</span>
            </a>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
              title="Chat on WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-900/40 border-b border-slate-800 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Invoiced</span>
            <span className="text-white font-black text-sm">{formatZAR(totalInvoiced)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Paid</span>
            <span className="text-emerald-400 font-black text-sm">{formatZAR(totalPaid)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Balance Due</span>
            <span className={`font-black text-sm ${outstandingBalance > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {formatZAR(outstandingBalance)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Quotes Issued</span>
            <span className="text-amber-400 font-black text-sm">{clientQuotes.length} Quotes</span>
          </div>
        </div>

        {/* Navigation Subtabs */}
        <div className="flex border-b border-slate-800 px-6 pt-2 space-x-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-sky-500 text-sky-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Client Details & Notes
          </button>
          <button
            onClick={() => setActiveTab('quotes')}
            className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'quotes'
                ? 'border-sky-500 text-sky-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Quotation History ({clientQuotes.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'invoices'
                ? 'border-sky-500 text-sky-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Invoices & Payments ({clientInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'compliance'
                ? 'border-sky-500 text-sky-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            SANS 10142-1 COCs
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Contact Info</span>
                  <div className="flex items-center space-x-2 text-white font-mono">
                    <Phone className="w-3.5 h-3.5 text-sky-400" />
                    <span>{client.phone}</span>
                  </div>
                  {client.email && (
                    <div className="flex items-center space-x-2 text-slate-300 font-mono">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{client.email}</span>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Installation Site</span>
                  <div className="flex items-start space-x-2 text-white">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{client.address || 'Address not on file'}</span>
                  </div>
                </div>
              </div>

              {client.notes && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                  <span className="font-bold text-[10px] uppercase text-amber-400 block">Site Notes & DB Specs</span>
                  <p>{client.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quotes' && (
            <div className="space-y-2.5">
              {clientQuotes.map((q) => (
                <div
                  key={q.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-white">{q.quoteNumber}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-300">{q.serviceType}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{q.scopeOfWork}</p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-black text-amber-400 block">{formatZAR(q.totalAmount)}</span>
                    <span className="text-[10px] text-slate-500 capitalize">{q.status}</span>
                  </div>
                </div>
              ))}
              {clientQuotes.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">No quotations recorded for this client yet.</div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-2.5">
              {clientInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-white">{inv.invoiceNumber}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-300">{inv.serviceType}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Date: {inv.date}</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-black text-emerald-400 block">{formatZAR(inv.totalAmount)}</span>
                    <span
                      className={`text-[10px] uppercase font-bold ${
                        inv.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
              {clientInvoices.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">No invoices issued for this client yet.</div>
              )}
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
                  <div>
                    <span className="font-bold text-sky-300 block">SANS 10142-1 Compliance Status</span>
                    <span className="text-[11px] text-slate-400">
                      Standard Test Report & Certificate of Compliance valid for residential/commercial installations.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
          >
            Close
          </button>

          {onCreateQuote && (
            <button
              onClick={() => {
                onClose();
                onCreateQuote(client);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Create Quote for {client.name}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
