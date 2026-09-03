import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseCategory, ExpenseLinkType } from '../types';
import { formatZAR } from '../utils/calculator';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  Building,
  FileText,
  Trash2,
  Edit2,
  Scan,
  Download,
  Printer,
  Sparkles,
  CheckCircle2,
  Calendar,
  CreditCard,
  Tag,
  AlertCircle,
  X,
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

interface ExpenseManagerProps {
  setActiveTab: (tab: string) => void;
  openReceiptScanner: () => void;
}

const COMMON_SUPPLIERS = [
  'Voltex',
  'ARB Electrical',
  'Plumblink',
  'Builders Warehouse',
  'Herholdts Solar',
  'Shell / Engen Fuel',
  'ACDC Dynamics',
  'Bolt & Nut Centre',
  'Fourways Airconditioning',
];

const CATEGORIES: ExpenseCategory[] = [
  'Materials & Stock',
  'Vehicle Fuel & Fleet',
  'Labor & Contractor Wages',
  'Tools & Equipment',
  'Overheads & Compliance',
  'Marketing & Software',
  'Other & Miscellaneous',
];

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  setActiveTab,
  openReceiptScanner,
}) => {
  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    quotes,
    invoices,
    sunlightMode,
    profile,
  } = useApp();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLinkType, setSelectedLinkType] = useState<string>('all'); // 'all' | 'standalone' | 'quote' | 'invoice'
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' | 'YYYY-MM'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Materials & Stock' as ExpenseCategory,
    amount: '',
    vatAmount: '',
    autoCalculateVat: true,
    supplier: '',
    invoiceNumber: '',
    paymentMethod: 'Card' as 'EFT' | 'Card' | 'Cash' | 'Account' | 'Debit Order',
    linkType: 'standalone' as ExpenseLinkType,
    linkedQuoteId: '',
    linkedInvoiceId: '',
    relatedClientOrJob: '',
    notes: '',
  });

  // Calculate unique months from expenses
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    expenses.forEach((e) => {
      if (e.date) months.add(e.date.slice(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Search matching
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        exp.description.toLowerCase().includes(q) ||
        exp.supplier?.toLowerCase().includes(q) ||
        exp.invoiceNumber?.toLowerCase().includes(q) ||
        exp.relatedClientOrJob?.toLowerCase().includes(q) ||
        exp.linkedQuoteNumber?.toLowerCase().includes(q) ||
        exp.linkedInvoiceNumber?.toLowerCase().includes(q);

      // Category matching
      const matchesCategory =
        selectedCategory === 'all' || exp.category === selectedCategory;

      // Link Type matching
      const matchesLinkType =
        selectedLinkType === 'all' ||
        (selectedLinkType === 'standalone' && (!exp.linkType || exp.linkType === 'standalone')) ||
        (selectedLinkType === 'quote' && exp.linkType === 'quote') ||
        (selectedLinkType === 'invoice' && exp.linkType === 'invoice');

      // Month matching
      const matchesMonth =
        selectedMonth === 'all' || (exp.date && exp.date.startsWith(selectedMonth));

      return matchesSearch && matchesCategory && matchesLinkType && matchesMonth;
    });
  }, [expenses, searchQuery, selectedCategory, selectedLinkType, selectedMonth]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let total = 0;
    let standalone = 0;
    let jobLinked = 0;
    let vatClaimable = 0;

    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      total += amt;
      const isJobLinked = exp.linkType === 'quote' || exp.linkType === 'invoice';
      if (isJobLinked) {
        jobLinked += amt;
      } else {
        standalone += amt;
      }
      vatClaimable += Number(exp.vatAmount) || 0;
    });

    return { total, standalone, jobLinked, vatClaimable };
  }, [filteredExpenses]);

  // Open Modal to Add
  const handleOpenAdd = () => {
    setEditingExpenseId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: 'Materials & Stock',
      amount: '',
      vatAmount: '',
      autoCalculateVat: true,
      supplier: '',
      invoiceNumber: '',
      paymentMethod: 'Card',
      linkType: 'standalone',
      linkedQuoteId: '',
      linkedInvoiceId: '',
      relatedClientOrJob: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  // Open Modal to Edit
  const handleOpenEdit = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setFormData({
      date: exp.date,
      description: exp.description,
      category: exp.category,
      amount: exp.amount.toString(),
      vatAmount: exp.vatAmount !== undefined ? exp.vatAmount.toString() : '',
      autoCalculateVat: false,
      supplier: exp.supplier || '',
      invoiceNumber: exp.invoiceNumber || '',
      paymentMethod: exp.paymentMethod || 'Card',
      linkType: exp.linkType || 'standalone',
      linkedQuoteId: exp.linkedQuoteId || '',
      linkedInvoiceId: exp.linkedInvoiceId || '',
      relatedClientOrJob: exp.relatedClientOrJob || '',
      notes: exp.notes || '',
    });
    setIsModalOpen(true);
  };

  // Auto-calculate VAT on amount change
  const handleAmountChange = (val: string) => {
    const num = parseFloat(val);
    let vatVal = formData.vatAmount;
    if (formData.autoCalculateVat) {
      if (!isNaN(num) && num > 0) {
        // SARS 15% VAT component = Total - (Total / 1.15)
        const calcVat = Number((num - num / 1.15).toFixed(2));
        vatVal = calcVat.toString();
      } else {
        vatVal = '';
      }
    }
    setFormData((prev) => ({ ...prev, amount: val, vatAmount: vatVal }));
  };

  // Handle link selection change
  const handleLinkTypeChange = (type: ExpenseLinkType) => {
    setFormData((prev) => {
      let clientOrJob = prev.relatedClientOrJob;
      let qId = prev.linkedQuoteId;
      let invId = prev.linkedInvoiceId;

      if (type === 'standalone') {
        qId = '';
        invId = '';
      } else if (type === 'quote') {
        invId = '';
        if (quotes.length > 0 && !qId) {
          const firstQuote = quotes[0];
          qId = firstQuote.id;
          clientOrJob = `${firstQuote.clientName} (Quote #${firstQuote.quoteNumber})`;
        }
      } else if (type === 'invoice') {
        qId = '';
        if (invoices.length > 0 && !invId) {
          const firstInv = invoices[0];
          invId = firstInv.id;
          clientOrJob = `${firstInv.clientName} (Inv #${firstInv.invoiceNumber})`;
        }
      }

      return {
        ...prev,
        linkType: type,
        linkedQuoteId: qId,
        linkedInvoiceId: invId,
        relatedClientOrJob: clientOrJob,
      };
    });
  };

  // Quote picker change
  const handleQuoteSelect = (quoteId: string) => {
    const q = quotes.find((x) => x.id === quoteId);
    setFormData((prev) => ({
      ...prev,
      linkedQuoteId: quoteId,
      relatedClientOrJob: q ? `${q.clientName} (Quote #${q.quoteNumber})` : prev.relatedClientOrJob,
    }));
  };

  // Invoice picker change
  const handleInvoiceSelect = (invId: string) => {
    const inv = invoices.find((x) => x.id === invId);
    setFormData((prev) => ({
      ...prev,
      linkedInvoiceId: invId,
      relatedClientOrJob: inv ? `${inv.clientName} (Inv #${inv.invoiceNumber})` : prev.relatedClientOrJob,
    }));
  };

  // Submit Expense Save
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid expense amount in ZAR.');
      return;
    }
    if (!formData.description.trim()) {
      alert('Please provide a brief description for this expense.');
      return;
    }

    const vatNum = formData.vatAmount !== '' ? parseFloat(formData.vatAmount) : 0;

    let linkedQuoteNumber: string | undefined;
    if (formData.linkType === 'quote' && formData.linkedQuoteId) {
      const q = quotes.find((x) => x.id === formData.linkedQuoteId);
      if (q) linkedQuoteNumber = q.quoteNumber;
    }

    let linkedInvoiceNumber: string | undefined;
    if (formData.linkType === 'invoice' && formData.linkedInvoiceId) {
      const inv = invoices.find((x) => x.id === formData.linkedInvoiceId);
      if (inv) linkedInvoiceNumber = inv.invoiceNumber;
    }

    const payload: Omit<Expense, 'id'> = {
      date: formData.date,
      description: formData.description.trim(),
      category: formData.category,
      amount: Number(amountNum.toFixed(2)),
      vatAmount: !isNaN(vatNum) ? Number(vatNum.toFixed(2)) : 0,
      supplier: formData.supplier.trim() || undefined,
      invoiceNumber: formData.invoiceNumber.trim() || undefined,
      paymentMethod: formData.paymentMethod,
      relatedClientOrJob: formData.relatedClientOrJob.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      linkType: formData.linkType,
      linkedQuoteId: formData.linkType === 'quote' ? formData.linkedQuoteId : undefined,
      linkedQuoteNumber: formData.linkType === 'quote' ? linkedQuoteNumber : undefined,
      linkedInvoiceId: formData.linkType === 'invoice' ? formData.linkedInvoiceId : undefined,
      linkedInvoiceNumber: formData.linkType === 'invoice' ? linkedInvoiceNumber : undefined,
    };

    if (editingExpenseId) {
      updateExpense(editingExpenseId, payload);
    } else {
      addExpense(payload);
    }

    setIsModalOpen(false);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredExpenses.length === 0) {
      alert('No expense records to export.');
      return;
    }

    const headers = [
      'Date',
      'Description',
      'Category',
      'Supplier',
      'Receipt / Invoice #',
      'Payment Method',
      'Link Type',
      'Linked Document',
      'Client / Job',
      'VAT Amount (ZAR)',
      'Total Amount (ZAR)',
    ];

    const rows = filteredExpenses.map((exp) => [
      `"${exp.date}"`,
      `"${exp.description.replace(/"/g, '""')}"`,
      `"${exp.category}"`,
      `"${(exp.supplier || '').replace(/"/g, '""')}"`,
      `"${(exp.invoiceNumber || '').replace(/"/g, '""')}"`,
      `"${exp.paymentMethod || 'Card'}"`,
      `"${exp.linkType || 'standalone'}"`,
      `"${exp.linkedQuoteNumber ? `Quote ${exp.linkedQuoteNumber}` : exp.linkedInvoiceNumber ? `Invoice ${exp.linkedInvoiceNumber}` : 'None'}"`,
      `"${(exp.relatedClientOrJob || '').replace(/"/g, '""')}"`,
      (exp.vatAmount || 0).toFixed(2),
      exp.amount.toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `harrys_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                sunlightMode ? 'text-slate-900' : 'text-white'
              }`}
            >
              Expense & Supplier Log
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              SARS Input VAT
            </span>
          </div>
          <p className={`text-xs sm:text-sm mt-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
            Track trade materials, fuel, wages, and overheads. Link expenses directly to job quotations, customer invoices, or keep as standalone business overheads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openReceiptScanner}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-md shadow-sky-600/20 active:scale-95 cursor-pointer transition-all"
          >
            <Scan className="w-4 h-4" />
            <span>Scan Slip (OCR)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className={`px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center space-x-1.5 active:scale-95 cursor-pointer transition-all ${
              sunlightMode
                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                : 'bg-[#181B26] border-[#282E3E] text-slate-300 hover:text-white hover:bg-[#202534]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs sm:text-sm font-black flex items-center space-x-1.5 shadow-md shadow-amber-500/25 active:scale-95 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Log Expense</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Expenses */}
        <div
          className={`p-4 rounded-2xl border ${
            sunlightMode
              ? 'bg-white border-slate-300 shadow-sm'
              : 'bg-[#181B26] border-[#282E3E]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold uppercase mb-1">
            <span>Total Expenses</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${sunlightMode ? 'text-slate-900' : 'text-white'}`}>
            {formatZAR(metrics.total)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {filteredExpenses.length} entries in view
          </div>
        </div>

        {/* Job Linked (Quotes / Invoices) */}
        <div
          className={`p-4 rounded-2xl border ${
            sunlightMode
              ? 'bg-white border-slate-300 shadow-sm'
              : 'bg-[#181B26] border-[#282E3E]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold uppercase mb-1">
            <span>Job-Linked Costs</span>
            <FileText className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-sky-400">
            {formatZAR(metrics.jobLinked)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Linked to Quotes or Invoices
          </div>
        </div>

        {/* Standalone Overheads */}
        <div
          className={`p-4 rounded-2xl border ${
            sunlightMode
              ? 'bg-white border-slate-300 shadow-sm'
              : 'bg-[#181B26] border-[#282E3E]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold uppercase mb-1">
            <span>Standalone Overheads</span>
            <Building className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {formatZAR(metrics.standalone)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            General Fleet, Rent & Overhead
          </div>
        </div>

        {/* Claimable Input VAT */}
        <div
          className={`p-4 rounded-2xl border ${
            sunlightMode
              ? 'bg-white border-slate-300 shadow-sm'
              : 'bg-[#181B26] border-[#282E3E]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold uppercase mb-1">
            <span>Claimable Input VAT</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            {formatZAR(metrics.vatClaimable)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            SARS 15% VAT deductions
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border space-y-3 ${
          sunlightMode ? 'bg-white border-slate-300' : 'bg-[#181B26] border-[#282E3E]'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, supplier, receipt #, client or quote..."
              className={`w-full pl-10 pr-9 py-2 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 border ${
                sunlightMode
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-[#12141C] border-[#282E3E] text-white placeholder:text-slate-500'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-amber-500 border ${
                sunlightMode
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-[#12141C] border-[#282E3E] text-white'
              }`}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-amber-500 border ${
                sunlightMode
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-[#12141C] border-[#282E3E] text-white'
              }`}
            >
              <option value="all">All Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Link Type Quick Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#282E3E]/50">
          <span className="text-[11px] font-mono font-bold uppercase text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-amber-400" />
            Link Type:
          </span>

          <button
            type="button"
            onClick={() => setSelectedLinkType('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedLinkType === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Types ({expenses.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedLinkType('standalone')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              selectedLinkType === 'standalone'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Building className="w-3 h-3" />
            <span>Standalone Only</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLinkType('quote')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              selectedLinkType === 'quote'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Linked to Quotations</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLinkType('invoice')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              selectedLinkType === 'invoice'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <DollarSign className="w-3 h-3" />
            <span>Linked to Invoices</span>
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          sunlightMode ? 'bg-white border-slate-300' : 'bg-[#181B26] border-[#282E3E]'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className={`font-mono uppercase text-[10px] border-b ${
                  sunlightMode
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-[#12141C] text-slate-400 border-[#282E3E]'
                }`}
              >
                <th className="p-3.5">Date & Supplier</th>
                <th className="p-3.5">Description & Category</th>
                <th className="p-3.5">Linked Context (Optional)</th>
                <th className="p-3.5 text-center">Payment</th>
                <th className="p-3.5 text-right">VAT (15%)</th>
                <th className="p-3.5 text-right">Total (Incl)</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                sunlightMode ? 'divide-slate-200' : 'divide-[#282E3E]'
              }`}
            >
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Receipt className="w-10 h-10 text-slate-500 mx-auto" />
                      <div className="font-bold text-sm text-slate-300">No expenses found</div>
                      <p className="text-xs text-slate-400">
                        Try adjusting your filters or click "+ Log Expense" to record supplier materials, fuel, or trade overheads.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAdd}
                        className="mt-2 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Log First Expense</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const isLinkedToQuote = exp.linkType === 'quote' && exp.linkedQuoteNumber;
                  const isLinkedToInvoice = exp.linkType === 'invoice' && exp.linkedInvoiceNumber;

                  return (
                    <tr
                      key={exp.id}
                      className={`transition-colors ${
                        sunlightMode ? 'hover:bg-slate-50' : 'hover:bg-[#1C2030]'
                      }`}
                    >
                      {/* Date & Supplier */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-mono text-xs font-bold text-slate-300">
                          {exp.date}
                        </div>
                        <div className="font-semibold text-xs text-amber-400 mt-0.5">
                          {exp.supplier || 'Unspecified Supplier'}
                        </div>
                        {exp.invoiceNumber && (
                          <div className="font-mono text-[10px] text-slate-400">
                            Slip #{exp.invoiceNumber}
                          </div>
                        )}
                      </td>

                      {/* Description & Category */}
                      <td className="p-3.5 max-w-xs">
                        <div
                          className={`font-bold text-xs sm:text-sm line-clamp-2 ${
                            sunlightMode ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          {exp.description}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {exp.category}
                          </span>
                          {exp.notes && (
                            <span className="text-[10px] text-slate-400 italic truncate max-w-[150px]">
                              {exp.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Linked Context */}
                      <td className="p-3.5">
                        {isLinkedToQuote ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setActiveTab('quotes')}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 cursor-pointer"
                              title="Jump to Quotations"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Quote #{exp.linkedQuoteNumber}</span>
                              <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                            </button>
                            {exp.relatedClientOrJob && (
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">
                                {exp.relatedClientOrJob}
                              </div>
                            )}
                          </div>
                        ) : isLinkedToInvoice ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setActiveTab('invoices')}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 cursor-pointer"
                              title="Jump to Invoices"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Invoice #{exp.linkedInvoiceNumber}</span>
                              <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                            </button>
                            {exp.relatedClientOrJob && (
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">
                                {exp.relatedClientOrJob}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              <Building className="w-3 h-3 text-emerald-400" />
                              <span>Standalone Overhead</span>
                            </span>
                            {exp.relatedClientOrJob && (
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">
                                {exp.relatedClientOrJob}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-slate-800/80 text-slate-300">
                          {exp.paymentMethod || 'Card'}
                        </span>
                      </td>

                      {/* VAT Amount */}
                      <td className="p-3.5 text-right font-mono text-slate-400 whitespace-nowrap">
                        {exp.vatAmount ? formatZAR(exp.vatAmount) : 'R0.00'}
                      </td>

                      {/* Total Amount */}
                      <td className="p-3.5 text-right font-mono font-black text-sm text-amber-400 whitespace-nowrap">
                        {formatZAR(exp.amount)}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(exp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-[#282E3E] cursor-pointer"
                            title="Edit Expense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete expense "${exp.description}" (${formatZAR(exp.amount)})?`)) {
                                deleteExpense(exp.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log / Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden my-6 transition-all ${
              sunlightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#151824] border-[#2E354B] text-white'
            }`}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#282E3E] flex items-center justify-between bg-[#1B1E2C]">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white">
                    {editingExpenseId ? 'Edit Logged Expense' : 'Log New Expense / Slip'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Optionally link to an active quotation, customer invoice, or keep standalone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveExpense} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Optional Linkage Selector - Highlighted Segmented Control */}
              <div className="p-3.5 rounded-xl bg-[#1B1F2E] border border-amber-500/30 space-y-2.5">
                <label className="block text-xs font-mono font-bold uppercase text-amber-400 flex items-center justify-between">
                  <span>Job Linkage (Optional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Link to Job or Standalone</span>
                </label>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLinkTypeChange('standalone')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center text-center cursor-pointer border ${
                      formData.linkType === 'standalone'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-[#12141C] border-[#282E3E] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building className="w-4 h-4 mb-1" />
                    <span>Standalone</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLinkTypeChange('quote')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center text-center cursor-pointer border ${
                      formData.linkType === 'quote'
                        ? 'bg-sky-600 border-sky-500 text-white shadow-md'
                        : 'bg-[#12141C] border-[#282E3E] text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-4 h-4 mb-1" />
                    <span>Link to Quote</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLinkTypeChange('invoice')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center text-center cursor-pointer border ${
                      formData.linkType === 'invoice'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                        : 'bg-[#12141C] border-[#282E3E] text-slate-400 hover:text-white'
                    }`}
                  >
                    <DollarSign className="w-4 h-4 mb-1" />
                    <span>Link to Invoice</span>
                  </button>
                </div>

                {/* Quotation Selection Dropdown */}
                {formData.linkType === 'quote' && (
                  <div className="pt-2 border-t border-[#282E3E] space-y-1">
                    <label className="block text-[11px] font-mono text-sky-300 font-bold">
                      Select Quotation ({quotes.length} available):
                    </label>
                    <select
                      value={formData.linkedQuoteId}
                      onChange={(e) => handleQuoteSelect(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-sky-500/40 text-white text-xs font-semibold focus:outline-none focus:border-sky-400"
                    >
                      {quotes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.quoteNumber} — {q.clientName} ({formatZAR(q.totalAmount)}) [{q.date}]
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Invoice Selection Dropdown */}
                {formData.linkType === 'invoice' && (
                  <div className="pt-2 border-t border-[#282E3E] space-y-1">
                    <label className="block text-[11px] font-mono text-indigo-300 font-bold">
                      Select Invoice ({invoices.length} available):
                    </label>
                    <select
                      value={formData.linkedInvoiceId}
                      onChange={(e) => handleInvoiceSelect(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-indigo-500/40 text-white text-xs font-semibold focus:outline-none focus:border-indigo-400"
                    >
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — {inv.clientName} ({formatZAR(inv.totalAmount)}) [{inv.status}]
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Date & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as ExpenseCategory })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-amber-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Supplier & Common Chips */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="e.g. Voltex, Plumblink, Shell, Builders..."
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {COMMON_SUPPLIERS.slice(0, 6).map((sup) => (
                    <button
                      key={sup}
                      type="button"
                      onClick={() => setFormData({ ...formData, supplier: sup })}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                    >
                      {sup}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. 50m 4mm twin & earth cable, diesel, R410a refrigerant cylinder"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Amount & VAT Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                    Total Amount (Incl. VAT) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-amber-400 text-xs">
                      R
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">
                      VAT Component (15%)
                    </label>
                    <label className="text-[10px] text-amber-400 flex items-center space-x-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.autoCalculateVat}
                        onChange={(e) => {
                          const auto = e.target.checked;
                          setFormData((prev) => {
                            let vatVal = prev.vatAmount;
                            const num = parseFloat(prev.amount);
                            if (auto && !isNaN(num) && num > 0) {
                              vatVal = Number((num - num / 1.15).toFixed(2)).toString();
                            }
                            return { ...prev, autoCalculateVat: auto, vatAmount: vatVal };
                          });
                        }}
                        className="rounded accent-amber-500"
                      />
                      <span>Auto 15%</span>
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                      R
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.vatAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, vatAmount: e.target.value, autoCalculateVat: false })
                      }
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method & Slip / Invoice Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paymentMethod: e.target.value as 'EFT' | 'Card' | 'Cash' | 'Account' | 'Debit Order',
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-amber-500"
                  >
                    <option value="Card">Bank Debit / Credit Card</option>
                    <option value="EFT">Electronic Funds Transfer (EFT)</option>
                    <option value="Cash">Cash / Petty Cash</option>
                    <option value="Account">Supplier Trade Account</option>
                    <option value="Debit Order">Monthly Debit Order</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                    Supplier Slip / Invoice #
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    placeholder="e.g. SLIP-98421"
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Client or Job Reference / Notes */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
                  Client / Job Reference or Overhead Note
                </label>
                <input
                  type="text"
                  value={formData.relatedClientOrJob}
                  onChange={(e) => setFormData({ ...formData, relatedClientOrJob: e.target.value })}
                  placeholder="e.g. Mrs Van Der Merwe aircon install, or Bakkie Fuel"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#282E3E] text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#282E3E] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs sm:text-sm font-black shadow-md shadow-amber-500/25 cursor-pointer active:scale-95 transition-all"
                >
                  {editingExpenseId ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
