import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice, InvoiceStatus, QuoteLineItem, ServiceCategory } from '../types';
import { formatZAR, getWhatsAppShareLink } from '../utils/calculator';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import {
  Receipt,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  MessageSquare,
  Phone,
  DollarSign,
  Briefcase,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

export const InvoicingPipeline: React.FC = () => {
  const {
    invoices,
    createInvoice,
    markInvoicePaid,
    deleteInvoice,
    jobs,
    completeJobAndDeductStock,
    profile,
    sunlightMode,
    clients,
    inventory,
    setActiveTab,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [isCreatingStandalone, setIsCreatingStandalone] = useState(false);

  // Standalone emergency invoice form state
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [serviceType, setServiceType] = useState<ServiceCategory>('Electrical');
  const [description, setDescription] = useState('Emergency Diagnostic & Fault Finding Callout');
  const [calloutFee, setCalloutFee] = useState(750);
  const [labourAmount, setLabourAmount] = useState(550);
  const [materialsAmount, setMaterialsAmount] = useState(0);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [notes, setNotes] = useState('Payment strictly on completion. SABS approved materials installed.');

  // Handle client select
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setClientName(client.name);
      setClientPhone(client.phone);
      setClientEmail(client.email || '');
      setClientAddress(client.siteAddress);
      setServiceType(client.serviceType);
    }
  };

  // Submit standalone emergency invoice
  const handleCreateStandaloneInvoice = () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      alert('Please enter client name and phone.');
      return;
    }

    const subtotal = calloutFee + labourAmount + materialsAmount;
    const vatAmount = vatEnabled ? Number((subtotal * 0.15).toFixed(2)) : 0;
    const totalAmount = subtotal + vatAmount;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const items: QuoteLineItem[] = [
      {
        id: `li-direct-${Date.now()}`,
        type: 'callout',
        description: description,
        quantity: 1,
        unit: 'ea',
        unitCost: calloutFee,
        unitPrice: calloutFee,
        total: calloutFee,
      },
    ];

    if (materialsAmount > 0) {
      items.push({
        id: `li-direct-mat-${Date.now()}`,
        type: 'material',
        description: 'Electrical / HVAC Consumables & Parts',
        quantity: 1,
        unit: 'lot',
        unitCost: materialsAmount * 0.7,
        unitPrice: materialsAmount,
        total: materialsAmount,
      });
    }

    createInvoice(
      {
        invoiceNumber,
        clientId: selectedClientId || `cli-${Date.now()}`,
        clientName,
        clientPhone,
        clientEmail,
        clientAddress: clientAddress || 'Site Location',
        serviceType,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0], // immediate for emergency
        items,
        calloutFee,
        labourTotal: labourAmount,
        travelTotal: 0,
        materialsTotal: materialsAmount,
        subtotal,
        vatEnabled,
        vatRate: 15,
        vatAmount,
        totalAmount,
        amountPaid: 0,
        status: 'issued',
        notes,
      },
      false
    );

    setIsCreatingStandalone(false);
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'all') return true;
    return inv.status === statusFilter;
  });

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D2D30] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#007AFF] text-white uppercase tracking-wider">
              FINANCIAL DISPATCH & AUDIT
            </span>
            <span className="text-[11px] font-mono text-[#707070]">15% VAT INVOICING • SANS 10142 HANDOVER</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#FF6321]">
            Invoicing & Job Execution Pipeline
          </h2>
          <p className="text-xs font-mono text-[#A0A0A5] mt-0.5">
            Track active jobs on-site, issue official tax invoices, record EFT/Cash settlements, and auto-deduct materials from SQLite.
          </p>
        </div>

        <button
          id="btn-new-direct-invoice"
          onClick={() => setIsCreatingStandalone(!isCreatingStandalone)}
          className={`px-4 py-2 rounded font-mono font-bold text-xs uppercase flex items-center space-x-2 transition-all shadow ${
            isCreatingStandalone
              ? 'bg-[#252528] text-[#A0A0A5] border border-[#2D2D30]'
              : sunlightMode
              ? 'bg-amber-400 text-black border-2 border-black font-extrabold'
              : 'bg-[#FF6321] hover:bg-[#e0551a] text-black shadow-lg shadow-[#FF632133]'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isCreatingStandalone ? 'CANCEL INVOICE' : '+ EMERGENCY / COUNTER TAX INVOICE'}</span>
        </button>
      </div>

      {/* Standalone Emergency / Counter Invoice Creator */}
      {isCreatingStandalone && (
        <div
          className={`p-5 rounded border space-y-4 shadow-2xl ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#2D2D30] pb-2">
            <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-[#FF6321] flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#FF6321]" />
              <span>DIRECT EMERGENCY CALLOUT / COUNTER SALE TAX INVOICE</span>
            </h3>
            <span className="text-[10px] text-[#707070] font-mono uppercase">Auto-Generates Tax Invoice #</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Client Selection
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
              >
                <option value="">-- CHOOSE EXISTING OR TYPE BELOW --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Client Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Johan Van Der Merwe"
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold font-sans"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Phone Number (WhatsApp) *
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 082 123 4567"
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Service Type
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#007AFF] font-bold"
              >
                <option value="Electrical">Electrical Emergency Callout</option>
                <option value="HVAC">HVAC Regas & Fault Finding</option>
                <option value="Solar">Solar / Inverter Repair</option>
                <option value="Security">CCTV / Gate Motor Emergency</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Work Scope & Fault Summary
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-sans text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Call-Out / Diagnostic (R)
              </label>
              <input
                type="number"
                value={calloutFee}
                onChange={(e) => setCalloutFee(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] font-bold text-[#E0E0E0]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Labour Fee (R)
              </label>
              <input
                type="number"
                value={labourAmount}
                onChange={(e) => setLabourAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] font-bold text-[#E0E0E0]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#2D2D30] font-mono">
            <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
                className="rounded text-[#00FF41] focus:ring-[#00FF41]"
              />
              <span className="text-[#E0E0E0]">Include 15% South African VAT</span>
            </label>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsCreatingStandalone(false)}
                className="px-3 py-1.5 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#A0A0A5] text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStandaloneInvoice}
                className="px-5 py-2 rounded bg-[#FF6321] hover:bg-[#e0551a] text-black font-bold text-xs uppercase shadow-lg shadow-[#FF632133]"
              >
                Issue Tax Invoice Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Jobs On-Site Section */}
      <div
        className={`p-4 md:p-5 rounded border ${
          sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
        }`}
      >
        <div className="flex items-center justify-between mb-3 font-mono">
          <div className="flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-[#007AFF]" />
            <h3 className="font-bold text-sm uppercase text-[#E0E0E0]">Active Jobs in Progress ({jobs.length})</h3>
          </div>
          <span className="text-[10px] text-[#707070] uppercase">1-Tap Completion auto-deducts materials from SQLite</span>
        </div>

        {jobs.length === 0 ? (
          <div className="p-6 text-center text-[#707070] border border-dashed border-[#2D2D30] rounded text-xs font-mono uppercase">
            No active jobs in the pipeline. Convert an accepted quotation to start work.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`p-3.5 rounded border flex flex-col justify-between space-y-3 font-mono ${
                  job.status === 'completed'
                    ? 'bg-[#0A0A0B] border-[#2D2D30] opacity-70'
                    : 'bg-[#0A0A0B] border-[#007AFF44]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#007AFF]">{job.jobNumber}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        job.status === 'completed'
                          ? 'bg-[#00FF4122] text-[#00FF41] border border-[#00FF4144]'
                          : 'bg-[#007AFF22] text-[#007AFF] border border-[#007AFF44]'
                      }`}
                    >
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-[#E0E0E0] mt-1 font-sans">{job.title}</h4>
                  <p className="text-[11px] text-[#707070] flex items-center space-x-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#707070]" />
                    <span>{job.clientAddress}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#2D2D30] text-xs">
                  <div className="flex items-center space-x-2">
                    <a
                      href={`tel:${job.clientPhone}`}
                      className="p-1.5 rounded bg-[#007AFF] text-white hover:bg-[#0062cc]"
                      title="Call Client"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={getWhatsAppShareLink(job.clientPhone, `Hi ${job.clientName}, updating you on job ${job.jobNumber}.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded bg-[#25D366] text-black hover:bg-[#20ba59]"
                      title="WhatsApp Client"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {job.status !== 'completed' && (
                    <button
                      onClick={() => completeJobAndDeductStock(job.id)}
                      className="px-3 py-1.5 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold text-xs uppercase flex items-center space-x-1 shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete & Deduct Stock</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tax Invoices Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[#707070] flex items-center space-x-2">
            <Receipt className="w-3.5 h-3.5 text-[#FF6321]" />
            <span>Tax Invoices Registry ({invoices.length})</span>
          </h3>

          {/* Status Filter Chips */}
          <div className="flex space-x-1 text-xs font-mono">
            {(['all', 'issued', 'paid', 'overdue'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${
                  statusFilter === st
                    ? 'bg-[#FF6321] text-black shadow'
                    : 'bg-[#1A1A1C] border border-[#2D2D30] text-[#707070] hover:text-[#E0E0E0]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-[#707070] border border-dashed border-[#2D2D30] rounded text-xs font-mono uppercase">
            No invoices matching the filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInvoices.map((inv) => {
              const isPaid = inv.status === 'paid';
              const whatsappMessage = `*TAX INVOICE: ${inv.invoiceNumber}*\n*${profile.companyName}*\n\nClient: ${inv.clientName}\nService: ${inv.serviceType}\nTotal Due: ${formatZAR(inv.totalAmount)}\nStatus: ${inv.status.toUpperCase()}\n\n*Banking Details for EFT:*\nBank: ${profile.bankName}\nAccount: ${profile.accountNumber}\nBranch Code: ${profile.branchCode}\nRef: ${inv.invoiceNumber}\n\nThank you for choosing Harrys Aircon Electrical & Solar Services.`;

              return (
                <div
                  key={inv.id}
                  className={`p-4 rounded border transition-all ${
                    sunlightMode
                      ? 'bg-white border-2 border-black text-black'
                      : 'bg-[#1A1A1C] border-[#2D2D30] text-[#E0E0E0]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3 font-mono">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-[#FF6321]">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0A0A0B] text-[#A0A0A5] border border-[#2D2D30]">
                          {inv.serviceType}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-[#E0E0E0] mt-1 font-sans">
                        {inv.clientName}
                      </h4>
                      <p className="text-[11px] text-[#707070] flex items-center space-x-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-[#707070]" />
                        <span>Issued: {inv.date} | Due: {inv.dueDate}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-[#00FF41]">
                        {formatZAR(inv.totalAmount)}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          isPaid
                            ? 'bg-[#00FF4122] text-[#00FF41] border border-[#00FF4144]'
                            : 'bg-[#FF632122] text-[#FF6321] border border-[#FF632144]'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </div>

                  {/* Line items brief */}
                  <div className="py-2 border-y border-[#2D2D30] text-[11px] font-mono text-[#A0A0A5] space-y-1 mb-3">
                    <div className="flex justify-between">
                      <span className="text-[#707070]">SUBTOTAL:</span>
                      <span>{formatZAR(inv.subtotal)}</span>
                    </div>
                    {inv.vatEnabled && (
                      <div className="flex justify-between">
                        <span className="text-[#707070]">VAT (15%):</span>
                        <span>{formatZAR(inv.vatAmount)}</span>
                      </div>
                    )}
                    {isPaid && (
                      <div className="flex justify-between text-[#00FF41] font-bold">
                        <span>PAID VIA {inv.paymentMethod || 'EFT'}:</span>
                        <span>{formatZAR(inv.amountPaid)}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions (WhatsApp, PDF, Mark Paid) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono">
                    <div className="flex items-center space-x-1.5">
                      <a
                        href={getWhatsAppShareLink(inv.clientPhone, whatsappMessage)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded bg-[#25D366] text-black hover:bg-[#20ba59] text-xs font-bold flex items-center space-x-1 uppercase"
                        title="Send Tax Invoice Link on WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>

                      <button
                        onClick={() => generateInvoicePDF(inv, profile)}
                        className="px-2.5 py-1.5 rounded bg-[#0A0A0B] text-[#E0E0E0] border border-[#2D2D30] hover:bg-[#252528] text-xs font-bold flex items-center space-x-1 uppercase"
                        title="Download Tax Invoice PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-[#00FF41]" />
                        <span>PDF</span>
                      </button>
                    </div>

                    {!isPaid && (
                      <button
                        onClick={() => markInvoicePaid(inv.id, 'EFT')}
                        className="px-3 py-1.5 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold text-xs uppercase flex items-center space-x-1 shadow"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Mark Paid (EFT)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
