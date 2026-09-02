import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatZAR } from '../utils/calculator';
import { Expense, ExpenseCategory, Invoice } from '../types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PieChart,
  BarChart3,
  Layers,
  Fuel,
  Wrench,
  Users,
  Shield,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search,
  FileText,
  CreditCard,
  Percent,
  Sparkles,
  Zap,
  ShoppingBag,
  Car,
  Receipt,
  Package,
  X,
  ChevronDown,
} from 'lucide-react';

interface MonthlyBucket {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "August 2026"
  shortLabel: string; // e.g. "Aug"
  year: number;
  monthNum: number;
  // Revenue
  invoicedRevenue: number;
  cashCollected: number;
  outstandingReceivables: number;
  invoiceCount: number;
  // Expenses
  totalExpenses: number;
  materialsCost: number;
  fuelCost: number;
  laborCost: number;
  toolsCost: number;
  overheadsCost: number;
  otherCost: number;
  expenseCount: number;
  // Metrics
  netProfit: number;
  netMarginPct: number;
  grossMarginPct: number;
  vatCollected: number;
  vatPaid: number;
  netVatPayable: number;
}

export const FinancialAnalysis: React.FC = () => {
  const { invoices, expenses, addExpense, updateExpense, deleteExpense, clearAllExpenses, profile, sunlightMode, quotes } = useApp();

  // Navigation & Sub-views
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'monthly' | 'categories' | 'aging' | 'expenses' | 'insights'>('overview');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all'); // 'all' or 'YYYY-MM'
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>('all');
  
  // Modal State for Adding/Editing Expenses
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseFormData, setExpenseFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Materials & Stock' as ExpenseCategory,
    amount: '',
    vatAmount: '',
    supplier: '',
    invoiceNumber: '',
    paymentMethod: 'Card' as 'EFT' | 'Card' | 'Cash' | 'Account' | 'Debit Order',
    relatedClientOrJob: '',
    notes: '',
    autoCalculateVat: true,
  });

  // Available Month Keys extracted from data
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();

    invoices.forEach((inv) => {
      if (inv.date) {
        monthSet.add(inv.date.slice(0, 7));
      }
    });

    expenses.forEach((exp) => {
      if (exp.date) {
        monthSet.add(exp.date.slice(0, 7));
      }
    });

    // Ensure 2026 full range is present if data exists
    const sorted = Array.from(monthSet).sort().reverse();
    return sorted;
  }, [invoices, expenses]);

  // Aggregate Data Month by Month
  const monthlyBuckets: MonthlyBucket[] = useMemo(() => {
    // Determine target months
    const allMonths = [
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-06',
      '2026-05',
      '2026-04',
      '2026-03',
      '2026-02',
      '2026-01',
    ];

    // Combine with any extra found in data
    availableMonths.forEach((m) => {
      if (!allMonths.includes(m)) allMonths.push(m);
    });

    allMonths.sort();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return allMonths.map((mKey) => {
      const [yStr, mStr] = mKey.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const label = `${fullMonthNames[m - 1]} ${y}`;
      const shortLabel = `${monthNames[m - 1]} '${String(y).slice(-2)}`;

      // Filter invoices for this month
      const monthInvoices = invoices.filter((inv) => (inv.date || '').startsWith(mKey));
      const invoicedRevenue = monthInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      const cashCollected = monthInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
      const outstandingReceivables = invoicedRevenue - cashCollected;
      const vatCollected = monthInvoices.reduce((sum, inv) => sum + (inv.vatAmount || 0), 0);

      // Filter expenses for this month
      const monthExpenses = expenses.filter((exp) => (exp.date || '').startsWith(mKey));
      const totalExpenses = monthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const vatPaid = monthExpenses.reduce((sum, exp) => sum + (exp.vatAmount || 0), 0);

      const materialsCost = monthExpenses
        .filter((e) => e.category === 'Materials & Stock')
        .reduce((sum, e) => sum + e.amount, 0);
      const fuelCost = monthExpenses
        .filter((e) => e.category === 'Vehicle Fuel & Fleet')
        .reduce((sum, e) => sum + e.amount, 0);
      const laborCost = monthExpenses
        .filter((e) => e.category === 'Labor & Contractor Wages')
        .reduce((sum, e) => sum + e.amount, 0);
      const toolsCost = monthExpenses
        .filter((e) => e.category === 'Tools & Equipment')
        .reduce((sum, e) => sum + e.amount, 0);
      const overheadsCost = monthExpenses
        .filter((e) => e.category === 'Overheads & Compliance')
        .reduce((sum, e) => sum + e.amount, 0);
      const otherCost = monthExpenses
        .filter((e) => e.category === 'Marketing & Software' || e.category === 'Other & Miscellaneous')
        .reduce((sum, e) => sum + e.amount, 0);

      const netProfit = invoicedRevenue - totalExpenses;
      const netMarginPct = invoicedRevenue > 0 ? (netProfit / invoicedRevenue) * 100 : 0;
      const directCosts = materialsCost + laborCost;
      const grossMarginPct = invoicedRevenue > 0 ? ((invoicedRevenue - directCosts) / invoicedRevenue) * 100 : 0;
      const netVatPayable = vatCollected - vatPaid;

      return {
        monthKey: mKey,
        label,
        shortLabel,
        year: y,
        monthNum: m,
        invoicedRevenue,
        cashCollected,
        outstandingReceivables,
        invoiceCount: monthInvoices.length,
        totalExpenses,
        materialsCost,
        fuelCost,
        laborCost,
        toolsCost,
        overheadsCost,
        otherCost,
        expenseCount: monthExpenses.length,
        netProfit,
        netMarginPct,
        grossMarginPct,
        vatCollected,
        vatPaid,
        netVatPayable,
      };
    });
  }, [invoices, expenses, availableMonths]);

  // Filtered Totals based on user selected month filter
  const currentViewMetrics = useMemo(() => {
    let targetBuckets = monthlyBuckets;
    if (selectedMonthFilter !== 'all') {
      targetBuckets = monthlyBuckets.filter((b) => b.monthKey === selectedMonthFilter);
    }

    const totalInvoiced = targetBuckets.reduce((sum, b) => sum + b.invoicedRevenue, 0);
    const totalCollected = targetBuckets.reduce((sum, b) => sum + b.cashCollected, 0);
    const totalOutstanding = targetBuckets.reduce((sum, b) => sum + b.outstandingReceivables, 0);
    const totalExpenses = targetBuckets.reduce((sum, b) => sum + b.totalExpenses, 0);
    const totalNetProfit = totalInvoiced - totalExpenses;
    const netMarginPct = totalInvoiced > 0 ? (totalNetProfit / totalInvoiced) * 100 : 0;

    const materials = targetBuckets.reduce((sum, b) => sum + b.materialsCost, 0);
    const fuel = targetBuckets.reduce((sum, b) => sum + b.fuelCost, 0);
    const labor = targetBuckets.reduce((sum, b) => sum + b.laborCost, 0);
    const tools = targetBuckets.reduce((sum, b) => sum + b.toolsCost, 0);
    const overheads = targetBuckets.reduce((sum, b) => sum + b.overheadsCost, 0);
    const other = targetBuckets.reduce((sum, b) => sum + b.otherCost, 0);

    const directCosts = materials + labor;
    const grossMarginPct = totalInvoiced > 0 ? ((totalInvoiced - directCosts) / totalInvoiced) * 100 : 0;
    const collectionRatePct = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    const outputVat = targetBuckets.reduce((sum, b) => sum + b.vatCollected, 0);
    const inputVat = targetBuckets.reduce((sum, b) => sum + b.vatPaid, 0);
    const sarsVatPayable = outputVat - inputVat;

    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      totalExpenses,
      totalNetProfit,
      netMarginPct,
      grossMarginPct,
      collectionRatePct,
      materials,
      fuel,
      labor,
      tools,
      overheads,
      other,
      outputVat,
      inputVat,
      sarsVatPayable,
    };
  }, [monthlyBuckets, selectedMonthFilter]);

  // Service / Trade Category Split
  const tradeCategoryMetrics = useMemo(() => {
    const targetInvoices = selectedMonthFilter === 'all'
      ? invoices
      : invoices.filter((inv) => (inv.date || '').startsWith(selectedMonthFilter));

    const categoryMap: Record<string, { revenue: number; count: number }> = {
      'Solar & Backup': { revenue: 0, count: 0 },
      'Air Conditioning': { revenue: 0, count: 0 },
      'Electrical': { revenue: 0, count: 0 },
      'Security & CCTV': { revenue: 0, count: 0 },
      'Automation & Gate Motors': { revenue: 0, count: 0 },
      'Maintenance & Repairs': { revenue: 0, count: 0 },
    };

    targetInvoices.forEach((inv) => {
      const cat = inv.serviceType || 'Electrical';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { revenue: 0, count: 0 };
      }
      categoryMap[cat].revenue += inv.totalAmount || 0;
      categoryMap[cat].count += 1;
    });

    const totalRev = currentViewMetrics.totalInvoiced || 1;
    return Object.entries(categoryMap).map(([category, data]) => ({
      category,
      revenue: data.revenue,
      count: data.count,
      pctOfTotal: (data.revenue / totalRev) * 100,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [invoices, selectedMonthFilter, currentViewMetrics.totalInvoiced]);

  // Dynamic Supplier & Merchant Spend Aggregate
  const supplierSpendMetrics = useMemo(() => {
    const targetExpenses = selectedMonthFilter === 'all'
      ? expenses
      : expenses.filter((exp) => (exp.date || '').startsWith(selectedMonthFilter));

    const map: Record<string, { amount: number; count: number; category: string }> = {};
    targetExpenses.forEach((exp) => {
      const sup = exp.supplier?.trim() || 'General / Unspecified Merchant';
      if (!map[sup]) {
        map[sup] = { amount: 0, count: 0, category: exp.category };
      }
      map[sup].amount += exp.amount || 0;
      map[sup].count += 1;
    });

    const totalExp = currentViewMetrics.totalExpenses || 1;
    return Object.entries(map).map(([name, data]) => ({
      name,
      amount: data.amount,
      count: data.count,
      category: data.category,
      pctOfTotal: (data.amount / totalExp) * 100,
    })).sort((a, b) => b.amount - a.amount);
  }, [expenses, selectedMonthFilter, currentViewMetrics.totalExpenses]);

  // Receivables Aging Engine (0-30, 31-60, 61-90, 90+ days)
  const agingAnalysis = useMemo(() => {
    const today = new Date();
    const buckets = {
      current: { label: 'Current (0–30 Days)', count: 0, amount: 0, invoices: [] as Invoice[] },
      days31_60: { label: '31–60 Days Overdue', count: 0, amount: 0, invoices: [] as Invoice[] },
      days61_90: { label: '61–90 Days Overdue', count: 0, amount: 0, invoices: [] as Invoice[] },
      days90Plus: { label: '90+ Days Critical', count: 0, amount: 0, invoices: [] as Invoice[] },
    };

    invoices.forEach((inv) => {
      const balance = (inv.totalAmount || 0) - (inv.amountPaid || 0);
      if (balance <= 0.01) return; // Fully paid

      const dueDate = new Date(inv.dueDate || inv.date);
      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        buckets.current.count += 1;
        buckets.current.amount += balance;
        buckets.current.invoices.push(inv);
      } else if (diffDays <= 60) {
        buckets.days31_60.count += 1;
        buckets.days31_60.amount += balance;
        buckets.days31_60.invoices.push(inv);
      } else if (diffDays <= 90) {
        buckets.days61_90.count += 1;
        buckets.days61_90.amount += balance;
        buckets.days61_90.invoices.push(inv);
      } else {
        buckets.days90Plus.count += 1;
        buckets.days90Plus.amount += balance;
        buckets.days90Plus.invoices.push(inv);
      }
    });

    return buckets;
  }, [invoices]);

  // Filtered Expenses List for the Register
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesMonth = selectedMonthFilter === 'all' || (exp.date || '').startsWith(selectedMonthFilter);
      const matchesCategory = selectedExpenseCategory === 'all' || exp.category === selectedExpenseCategory;
      const matchesSearch =
        expenseSearchQuery === '' ||
        exp.description.toLowerCase().includes(expenseSearchQuery.toLowerCase()) ||
        (exp.supplier && exp.supplier.toLowerCase().includes(expenseSearchQuery.toLowerCase())) ||
        (exp.invoiceNumber && exp.invoiceNumber.toLowerCase().includes(expenseSearchQuery.toLowerCase())) ||
        (exp.relatedClientOrJob && exp.relatedClientOrJob.toLowerCase().includes(expenseSearchQuery.toLowerCase()));

      return matchesMonth && matchesCategory && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, selectedMonthFilter, selectedExpenseCategory, expenseSearchQuery]);

  // Max value for monthly chart scaling
  const maxChartValue = useMemo(() => {
    let max = 1000;
    monthlyBuckets.forEach((b) => {
      if (b.invoicedRevenue > max) max = b.invoicedRevenue;
      if (b.totalExpenses > max) max = b.totalExpenses;
    });
    return max * 1.15;
  }, [monthlyBuckets]);

  // Handlers for Expenses
  const handleOpenAddExpense = () => {
    setEditingExpenseId(null);
    setExpenseFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: 'Materials & Stock',
      amount: '',
      vatAmount: '',
      supplier: '',
      invoiceNumber: '',
      paymentMethod: 'Card',
      relatedClientOrJob: '',
      notes: '',
      autoCalculateVat: profile.vatEnabled,
    });
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setExpenseFormData({
      date: exp.date,
      description: exp.description,
      category: exp.category,
      amount: String(exp.amount),
      vatAmount: exp.vatAmount !== undefined ? String(exp.vatAmount) : '',
      supplier: exp.supplier || '',
      invoiceNumber: exp.invoiceNumber || '',
      paymentMethod: exp.paymentMethod || 'Card',
      relatedClientOrJob: exp.relatedClientOrJob || '',
      notes: exp.notes || '',
      autoCalculateVat: false,
    });
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseFormData.amount) || 0;
    if (amountNum <= 0) return;

    let vatNum = parseFloat(expenseFormData.vatAmount) || 0;
    if (expenseFormData.autoCalculateVat && profile.vatEnabled) {
      vatNum = Number((amountNum * 0.15 / 1.15).toFixed(2));
    }

    if (editingExpenseId) {
      updateExpense(editingExpenseId, {
        date: expenseFormData.date,
        description: expenseFormData.description || 'Trade Expense',
        category: expenseFormData.category,
        amount: amountNum,
        vatAmount: vatNum,
        supplier: expenseFormData.supplier || undefined,
        invoiceNumber: expenseFormData.invoiceNumber || undefined,
        paymentMethod: expenseFormData.paymentMethod,
        relatedClientOrJob: expenseFormData.relatedClientOrJob || undefined,
        notes: expenseFormData.notes || undefined,
      });
    } else {
      addExpense({
        date: expenseFormData.date,
        description: expenseFormData.description || 'Trade Expense',
        category: expenseFormData.category,
        amount: amountNum,
        vatAmount: vatNum,
        supplier: expenseFormData.supplier || undefined,
        invoiceNumber: expenseFormData.invoiceNumber || undefined,
        paymentMethod: expenseFormData.paymentMethod,
        relatedClientOrJob: expenseFormData.relatedClientOrJob || undefined,
        notes: expenseFormData.notes || undefined,
      });
    }

    setIsExpenseModalOpen(false);
  };

  const handleDeleteExpenseConfirm = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense record?')) {
      deleteExpense(id);
    }
  };

  // Export Financials as CSV
  const handleExportCSV = () => {
    const headers = ['Month', 'Invoiced Revenue (ZAR)', 'Cash Collected (ZAR)', 'Outstanding (ZAR)', 'Materials (ZAR)', 'Fuel (ZAR)', 'Labor (ZAR)', 'Overheads (ZAR)', 'Total Expenses (ZAR)', 'Net Profit (ZAR)', 'Net Margin (%)'];
    const rows = monthlyBuckets.map((b) => [
      `"${b.label}"`,
      b.invoicedRevenue.toFixed(2),
      b.cashCollected.toFixed(2),
      b.outstandingReceivables.toFixed(2),
      b.materialsCost.toFixed(2),
      b.fuelCost.toFixed(2),
      b.laborCost.toFixed(2),
      b.overheadsCost.toFixed(2),
      b.totalExpenses.toFixed(2),
      b.netProfit.toFixed(2),
      b.netMarginPct.toFixed(1),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `harrys_financial_summary_${selectedMonthFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print P&L Statement
  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Timeframe Selector Bar */}
      <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300 text-slate-900 shadow-sm' : 'bg-[#1B1E28] border-[#282E3E] text-white shadow-xl'}`}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>South African Trade Financial Intelligence & P&L</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <span>Financial Analysis & Month-to-Month Breakdown</span>
            </h1>
            <p className={`text-xs sm:text-sm mt-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Real-time income vs. expenditure tracking, trade profit margins, aging receivables, and SARS VAT summaries.
            </p>
          </div>

          {/* Quick Action Buttons & Month Selector */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="flex items-center space-x-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-slate-400 ml-1.5" />
              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none pr-3 cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">Full Year 2026 (YTD)</option>
                {monthlyBuckets.map((b) => (
                  <option key={b.monthKey} value={b.monthKey} className="bg-slate-900 text-white">
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenAddExpense}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Log Expense</span>
            </button>

            <button
              onClick={handleExportCSV}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                sunlightMode ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-[#222736] hover:bg-[#2B3144] border-slate-700 text-slate-300'
              }`}
              title="Export Month-to-Month CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handlePrintStatement}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                sunlightMode ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-[#222736] hover:bg-[#2B3144] border-slate-700 text-slate-300'
              }`}
              title="Print P&L Statement"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print P&L</span>
            </button>

            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer text-rose-400 hover:text-rose-300 border-rose-500/30 hover:bg-rose-950/30 transition-colors"
              title="Reset all expense records to 0 for a clean ledger"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Expenses</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'overview', label: 'Executive Overview', icon: BarChart3 },
            { id: 'monthly', label: 'Month-by-Month Matrix', icon: Layers },
            { id: 'categories', label: 'Service & Cost Breakdown', icon: PieChart },
            { id: 'aging', label: 'Receivables & Aging', icon: Clock },
            { id: 'expenses', label: 'Expense Register', icon: Receipt },
            { id: 'insights', label: 'Actionable Insights', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : sunlightMode
                    ? 'text-slate-600 hover:bg-slate-200/80'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced Revenue */}
        <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">Total Revenue</span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">{formatZAR(currentViewMetrics.totalInvoiced)}</h3>
            </div>
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
            <span className="flex items-center text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {formatZAR(currentViewMetrics.totalCollected)} collected
            </span>
            <span className="font-mono text-slate-300 font-bold">{currentViewMetrics.collectionRatePct.toFixed(0)}% paid</span>
          </div>
        </div>

        {/* Total Operating Expenditure */}
        <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">Total Operating Costs</span>
              <h3 className="text-xl sm:text-2xl font-black text-rose-400 mt-1 font-mono">{formatZAR(currentViewMetrics.totalExpenses)}</h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
            <span>Materials: {formatZAR(currentViewMetrics.materials)}</span>
            <span>Fuel: {formatZAR(currentViewMetrics.fuel)}</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">Net Profit (ZAR)</span>
              <h3 className={`text-xl sm:text-2xl font-black mt-1 font-mono ${currentViewMetrics.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatZAR(currentViewMetrics.totalNetProfit)}
              </h3>
            </div>
            <div className={`p-2.5 rounded-xl border ${currentViewMetrics.totalNetProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
              {currentViewMetrics.totalNetProfit >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
            <span className="text-emerald-400 font-bold font-mono">Net Margin: {currentViewMetrics.netMarginPct.toFixed(1)}%</span>
            <span className="text-sky-400 font-bold font-mono">Gross: {currentViewMetrics.grossMarginPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* SARS VAT & Receivables */}
        <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">Outstanding Receivables</span>
              <h3 className="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono">{formatZAR(currentViewMetrics.totalOutstanding)}</h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
            <span>SARS Net VAT:</span>
            <span className="font-mono font-bold text-slate-200">{formatZAR(currentViewMetrics.sarsVatPayable)}</span>
          </div>
        </div>
      </div>

      {/* VIEW 1: EXECUTIVE OVERVIEW & MONTHLY BAR CHART */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Comparative Month-to-Month Bar Chart */}
          <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  <span>Month-to-Month Income vs. Expenditure (2026)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visual comparison of invoiced client revenue, cash collected, and operational expenses.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-4 text-xs font-medium">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded bg-sky-500" />
                  <span className="text-slate-300">Revenue Invoiced</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded bg-rose-500" />
                  <span className="text-slate-300">Expenditure</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="text-slate-300">Net Profit</span>
                </div>
              </div>
            </div>

            {/* SVG Visual Comparative Chart */}
            <div className="w-full overflow-x-auto pb-2">
              <div className="min-w-[650px] h-64 flex items-end gap-6 px-4 pt-4 border-b border-slate-800">
                {monthlyBuckets.map((bucket) => {
                  const revHeightPct = Math.min(100, Math.max(8, (bucket.invoicedRevenue / maxChartValue) * 100));
                  const expHeightPct = Math.min(100, Math.max(8, (bucket.totalExpenses / maxChartValue) * 100));
                  const profitHeightPct = Math.min(100, Math.max(4, (Math.abs(bucket.netProfit) / maxChartValue) * 100));

                  return (
                    <div key={bucket.monthKey} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Hover Tooltip */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-[11px] p-2 rounded-lg shadow-xl pointer-events-none z-20 whitespace-nowrap">
                        <div className="font-bold text-amber-400">{bucket.label}</div>
                        <div className="text-sky-300">Revenue: {formatZAR(bucket.invoicedRevenue)}</div>
                        <div className="text-rose-300">Expenses: {formatZAR(bucket.totalExpenses)}</div>
                        <div className="text-emerald-300 font-bold">Net Profit: {formatZAR(bucket.netProfit)} ({bucket.netMarginPct.toFixed(1)}%)</div>
                      </div>

                      {/* Bars Group */}
                      <div className="w-full flex items-end justify-center gap-1.5 h-full">
                        {/* Revenue Bar */}
                        <div
                          style={{ height: `${revHeightPct}%` }}
                          className="w-1/3 bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-md hover:brightness-110 transition-all cursor-pointer relative"
                          title={`Invoiced: ${formatZAR(bucket.invoicedRevenue)}`}
                        />

                        {/* Expense Bar */}
                        <div
                          style={{ height: `${expHeightPct}%` }}
                          className="w-1/3 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md hover:brightness-110 transition-all cursor-pointer relative"
                          title={`Expenses: ${formatZAR(bucket.totalExpenses)}`}
                        />

                        {/* Net Profit Bar */}
                        <div
                          style={{ height: `${profitHeightPct}%` }}
                          className={`w-1/3 rounded-t-md hover:brightness-110 transition-all cursor-pointer ${
                            bucket.netProfit >= 0
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                              : 'bg-gradient-to-t from-orange-600 to-amber-500'
                          }`}
                          title={`Net Profit: ${formatZAR(bucket.netProfit)}`}
                        />
                      </div>

                      {/* Month Label */}
                      <span className="text-[11px] font-mono text-slate-400 mt-2 whitespace-nowrap font-semibold">
                        {bucket.shortLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick 2-Column Split: Top Services vs Expense Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Earning Service Categories */}
            <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Revenue by Trade & Service Category</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedMonthFilter === 'all' ? 'YTD 2026' : selectedMonthFilter}
                </span>
              </div>

              <div className="space-y-3.5">
                {tradeCategoryMetrics.map((item) => (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-200">{item.category}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-mono">{item.count} jobs</span>
                        <span className="font-bold text-white font-mono">{formatZAR(item.revenue)}</span>
                        <span className="text-amber-400 font-mono font-bold w-12 text-right">
                          {item.pctOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, item.pctOfTotal)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenditure Distribution */}
            <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-rose-400" />
                  <span>Cost Split by Expense Category</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Total: {formatZAR(currentViewMetrics.totalExpenses)}
                </span>
              </div>

              <div className="space-y-3.5">
                {[
                  { label: 'Materials & Stock', amount: currentViewMetrics.materials, color: 'from-sky-500 to-blue-600', icon: Package },
                  { label: 'Labor & Wages', amount: currentViewMetrics.labor, color: 'from-amber-500 to-orange-600', icon: Users },
                  { label: 'Vehicle Fuel & Fleet', amount: currentViewMetrics.fuel, color: 'from-emerald-500 to-teal-600', icon: Car },
                  { label: 'Overheads & Compliance', amount: currentViewMetrics.overheads, color: 'from-purple-500 to-indigo-600', icon: Building },
                  { label: 'Tools & Equipment', amount: currentViewMetrics.tools, color: 'from-rose-500 to-pink-600', icon: Wrench },
                  { label: 'Other & Marketing', amount: currentViewMetrics.other, color: 'from-slate-500 to-slate-600', icon: Layers },
                ].map((item) => {
                  const pct = currentViewMetrics.totalExpenses > 0 ? (item.amount / currentViewMetrics.totalExpenses) * 100 : 0;
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          {item.label}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white font-mono">{formatZAR(item.amount)}</span>
                          <span className="text-slate-400 font-mono font-bold w-12 text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`bg-gradient-to-r ${item.color} h-2 rounded-full`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: FULL MONTH-BY-MONTH MATRIX TABLE */}
      {activeSubTab === 'monthly' && (
        <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>Month-to-Month Financial Matrix (2026)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Detailed breakdown of income, operational costs, net profit, and profit margins per calendar month.
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Matrix CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50 text-slate-400 font-mono text-[11px]">
                  <th className="py-3 px-3">Month</th>
                  <th className="py-3 px-3 text-right">Invoiced (ZAR)</th>
                  <th className="py-3 px-3 text-right">Collected (ZAR)</th>
                  <th className="py-3 px-3 text-right">Materials</th>
                  <th className="py-3 px-3 text-right">Labor Wages</th>
                  <th className="py-3 px-3 text-right">Fuel & Fleet</th>
                  <th className="py-3 px-3 text-right">Overheads</th>
                  <th className="py-3 px-3 text-right font-bold text-rose-400">Total Costs</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-400">Net Profit (ZAR)</th>
                  <th className="py-3 px-3 text-center">Net Margin</th>
                  <th className="py-3 px-3 text-center">Gross Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {monthlyBuckets.map((bucket) => {
                  const isPositive = bucket.netProfit >= 0;
                  return (
                    <tr key={bucket.monthKey} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-3 font-sans font-bold text-white flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        {bucket.label}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-200 font-bold">{formatZAR(bucket.invoicedRevenue)}</td>
                      <td className="py-3.5 px-3 text-right text-emerald-400">{formatZAR(bucket.cashCollected)}</td>
                      <td className="py-3.5 px-3 text-right text-slate-300">{formatZAR(bucket.materialsCost)}</td>
                      <td className="py-3.5 px-3 text-right text-slate-300">{formatZAR(bucket.laborCost)}</td>
                      <td className="py-3.5 px-3 text-right text-slate-300">{formatZAR(bucket.fuelCost)}</td>
                      <td className="py-3.5 px-3 text-right text-slate-300">{formatZAR(bucket.overheadsCost)}</td>
                      <td className="py-3.5 px-3 text-right text-rose-400 font-bold">{formatZAR(bucket.totalExpenses)}</td>
                      <td className={`py-3.5 px-3 text-right font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatZAR(bucket.netProfit)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                          bucket.netMarginPct >= 20 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          bucket.netMarginPct > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {bucket.netMarginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-300">
                        {bucket.grossMarginPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-slate-900/80 font-mono font-bold text-xs text-white">
                  <td className="py-3.5 px-3 font-sans">Full Year Total</td>
                  <td className="py-3.5 px-3 text-right text-sky-400">{formatZAR(currentViewMetrics.totalInvoiced)}</td>
                  <td className="py-3.5 px-3 text-right text-emerald-400">{formatZAR(currentViewMetrics.totalCollected)}</td>
                  <td className="py-3.5 px-3 text-right">{formatZAR(currentViewMetrics.materials)}</td>
                  <td className="py-3.5 px-3 text-right">{formatZAR(currentViewMetrics.labor)}</td>
                  <td className="py-3.5 px-3 text-right">{formatZAR(currentViewMetrics.fuel)}</td>
                  <td className="py-3.5 px-3 text-right">{formatZAR(currentViewMetrics.overheads)}</td>
                  <td className="py-3.5 px-3 text-right text-rose-400">{formatZAR(currentViewMetrics.totalExpenses)}</td>
                  <td className="py-3.5 px-3 text-right text-emerald-400 text-sm font-black">{formatZAR(currentViewMetrics.totalNetProfit)}</td>
                  <td className="py-3.5 px-3 text-center text-amber-400">{currentViewMetrics.netMarginPct.toFixed(1)}%</td>
                  <td className="py-3.5 px-3 text-center">{currentViewMetrics.grossMarginPct.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: TRADE SERVICE CATEGORIES & SUPPLIER SPEND */}
      {activeSubTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Detailed Trade Services */}
          <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Service Category Performance & Ticket Sizes</span>
            </h3>
            <div className="space-y-4">
              {tradeCategoryMetrics.map((item) => {
                const avgTicket = item.count > 0 ? item.revenue / item.count : 0;
                return (
                  <div key={item.category} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{item.category}</span>
                      <span className="font-mono text-xs font-bold text-amber-400">{item.pctOfTotal.toFixed(1)}% of Revenue</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 pt-1">
                      <div>
                        <span className="block text-[10px] text-slate-500">Total Billed</span>
                        <span className="font-mono font-bold text-slate-200">{formatZAR(item.revenue)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Completed Jobs</span>
                        <span className="font-mono font-bold text-slate-200">{item.count}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Avg Ticket Size</span>
                        <span className="font-mono font-bold text-emerald-400">{formatZAR(avgTicket)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supplier Spend & Distribution */}
          <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-sky-400" />
              <span>Supplier & Merchant Expenditure Split</span>
            </h3>
            {supplierSpendMetrics.length > 0 ? (
              <div className="space-y-3">
                {supplierSpendMetrics.map((supplier) => (
                  <div key={supplier.name} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{supplier.name}</h4>
                      <p className="text-[11px] text-slate-400">{supplier.category} · {supplier.count} {supplier.count === 1 ? 'record' : 'records'}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-white block">{formatZAR(supplier.amount)}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">{supplier.pctOfTotal.toFixed(1)}% of expenses</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800">
                <Building className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-300">No Supplier Purchases Recorded Yet</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Log your trade purchases or scan slips from Voltex, Fourways, Rubicon, Stafix, or fuel stations to populate this breakdown.
                </p>
                <button
                  onClick={handleOpenAddExpense}
                  className="mt-3 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Purchase</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: AGING RECEIVABLES & CASH FLOW HEALTH */}
      {activeSubTab === 'aging' && (
        <div className="space-y-6">
          {/* Aging Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
              <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase block">Current (0–30 Days)</span>
              <h4 className="text-xl font-black text-white font-mono mt-1">{formatZAR(agingAnalysis.current.amount)}</h4>
              <span className="text-xs text-slate-400 mt-1 block">{agingAnalysis.current.count} invoices pending</span>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30">
              <span className="text-[11px] font-mono text-amber-400 font-bold uppercase block">31–60 Days Overdue</span>
              <h4 className="text-xl font-black text-white font-mono mt-1">{formatZAR(agingAnalysis.days31_60.amount)}</h4>
              <span className="text-xs text-slate-400 mt-1 block">{agingAnalysis.days31_60.count} invoices overdue</span>
            </div>

            <div className="p-4 rounded-xl bg-orange-950/40 border border-orange-500/30">
              <span className="text-[11px] font-mono text-orange-400 font-bold uppercase block">61–90 Days Overdue</span>
              <h4 className="text-xl font-black text-white font-mono mt-1">{formatZAR(agingAnalysis.days61_90.amount)}</h4>
              <span className="text-xs text-slate-400 mt-1 block">{agingAnalysis.days61_90.count} invoices overdue</span>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30">
              <span className="text-[11px] font-mono text-rose-400 font-bold uppercase block">90+ Days Critical</span>
              <h4 className="text-xl font-black text-white font-mono mt-1">{formatZAR(agingAnalysis.days90Plus.amount)}</h4>
              <span className="text-xs text-slate-400 mt-1 block">{agingAnalysis.days90Plus.count} invoices critical</span>
            </div>
          </div>

          {/* Unpaid Invoices Detail List */}
          <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Outstanding Client Invoices & Payment Status</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 font-mono text-[11px]">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3 text-right">Total (ZAR)</th>
                    <th className="py-2.5 px-3 text-right">Paid (ZAR)</th>
                    <th className="py-2.5 px-3 text-right text-amber-400">Balance Due</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {invoices.filter((inv) => (inv.totalAmount || 0) > (inv.amountPaid || 0)).map((inv) => {
                    const balance = (inv.totalAmount || 0) - (inv.amountPaid || 0);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-bold text-white">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3 font-sans text-slate-200">{inv.clientName}</td>
                        <td className="py-3 px-3 font-sans text-slate-400">{inv.serviceType}</td>
                        <td className="py-3 px-3 text-right">{formatZAR(inv.totalAmount)}</td>
                        <td className="py-3 px-3 text-right text-emerald-400">{formatZAR(inv.amountPaid)}</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400">{formatZAR(balance)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'partially_paid' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {inv.status === 'partially_paid' ? 'Deposit Paid' : 'Unpaid'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: EXPENSE REGISTER & LOG MANAGER */}
      {activeSubTab === 'expenses' && (
        <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search supplier, item, ref..."
                  value={expenseSearchQuery}
                  onChange={(e) => setExpenseSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={selectedExpenseCategory}
                onChange={(e) => setSelectedExpenseCategory(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="all">All Expense Categories</option>
                <option value="Materials & Stock">Materials & Stock</option>
                <option value="Vehicle Fuel & Fleet">Vehicle Fuel & Fleet</option>
                <option value="Labor & Contractor Wages">Labor & Contractor Wages</option>
                <option value="Tools & Equipment">Tools & Equipment</option>
                <option value="Overheads & Compliance">Overheads & Compliance</option>
                <option value="Marketing & Software">Marketing & Software</option>
              </select>
            </div>

            <button
              onClick={handleOpenAddExpense}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Record New Expense</span>
            </button>
          </div>

          {/* Expenses Table or Clean Empty State */}
          {filteredExpenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50 text-slate-400 font-mono text-[11px]">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Supplier / Merchant</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3 text-right">VAT Amount</th>
                    <th className="py-3 px-3 text-right font-bold text-rose-400">Total (ZAR)</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-300">{exp.date}</td>
                      <td className="py-3 px-3 font-sans font-medium text-white max-w-xs truncate">
                        {exp.description}
                        {exp.relatedClientOrJob && (
                          <span className="block text-[10px] text-slate-400 font-sans">
                            Job: {exp.relatedClientOrJob}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-200">{exp.supplier || '—'}</td>
                      <td className="py-3 px-3 text-slate-400">{exp.paymentMethod || 'Card'}</td>
                      <td className="py-3 px-3 text-right text-slate-400">{formatZAR(exp.vatAmount || 0)}</td>
                      <td className="py-3 px-3 text-right font-bold text-rose-400">{formatZAR(exp.amount)}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenEditExpense(exp)}
                            className="p-1 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                            title="Edit Expense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpenseConfirm(exp.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">No Expense Records Found</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {expenseSearchQuery || selectedExpenseCategory !== 'all' || selectedMonthFilter !== 'all'
                  ? 'No expenses match the current search filters. Clear or adjust your filter selection above.'
                  : 'Your financial expense ledger is ready for daily entries. Log your daily diesel receipts, wholesaler material slips, and equipment purchases.'}
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={handleOpenAddExpense}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Daily Expense</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 6: ACTIONABLE FINANCIAL INSIGHTS & MARGIN LEAKS */}
      {activeSubTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Margin Leaks & Cost Controls */}
          <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>Margin Leak Warnings & Optimization</span>
            </h3>
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30">
                <span className="font-bold text-amber-300 block mb-1">
                  Materials Cost Ratio: {currentViewMetrics.totalInvoiced > 0 ? ((currentViewMetrics.materials / currentViewMetrics.totalInvoiced) * 100).toFixed(1) : '0.0'}%
                </span>
                <p className="text-slate-300">
                  {currentViewMetrics.materials > 0
                    ? `Direct materials purchases total ${formatZAR(currentViewMetrics.materials)}. Standardizing your markup to 30–35% on high-ticket equipment ensures you protect a healthy gross margin.`
                    : 'No direct material slips recorded for this period yet. As you enter supplier slips from Voltex, Fourways, or Rubicon, this ratio will calculate your exact hardware markup protection.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/30">
                <span className="font-bold text-sky-300 block mb-1">
                  {tradeCategoryMetrics.length > 0 && tradeCategoryMetrics[0].revenue > 0
                    ? `${tradeCategoryMetrics[0].category} Delivers Top Revenue (${tradeCategoryMetrics[0].pctOfTotal.toFixed(1)}%)`
                    : 'High-Ticket Trade Service Focus'}
                </span>
                <p className="text-slate-300">
                  {tradeCategoryMetrics.length > 0 && tradeCategoryMetrics[0].revenue > 0
                    ? `${tradeCategoryMetrics[0].category} generated ${formatZAR(tradeCategoryMetrics[0].revenue)} across ${tradeCategoryMetrics[0].count} completed jobs. Upselling surge protection and maintenance plans on these jobs boosts net margin.`
                    : 'Solar & Aircon installations typically average higher ticket sizes and healthy markup margins when bundled with maintenance agreements.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30">
                <span className="font-bold text-purple-300 block mb-1">SARS Input VAT Deductions: {formatZAR(currentViewMetrics.inputVat)}</span>
                <p className="text-slate-300">
                  {currentViewMetrics.inputVat > 0
                    ? `By capturing slips from registered trade accounts, you claim back ${formatZAR(currentViewMetrics.inputVat)} in Input VAT against your ${formatZAR(currentViewMetrics.outputVat)} output liability (Net SARS Payable: ${formatZAR(currentViewMetrics.sarsVatPayable)}).`
                    : `Your output VAT liability is currently ${formatZAR(currentViewMetrics.outputVat)}. As you record tax invoices and slips, input VAT will automatically deduct from this liability.`}
                </p>
              </div>
            </div>
          </div>

          {/* Cash Flow Health Recommendations */}
          <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Cash Flow & Working Capital Health</span>
            </h3>
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <span className="font-bold text-emerald-300 block mb-1">50% Upfront Deposit Policy</span>
                <p className="text-slate-300">
                  Enforcing 50% deposits on quotes before dispatching technicians or ordering inverter batteries prevents working capital lock-up at wholesalers.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="font-bold text-slate-200 block mb-1">
                  Fleet Diesel & Route Optimization ({currentViewMetrics.fuel > 0 ? formatZAR(currentViewMetrics.fuel) : 'R0.00'})
                </span>
                <p className="text-slate-400">
                  {currentViewMetrics.fuel > 0
                    ? `Fleet fuel represents ${(currentViewMetrics.totalExpenses > 0 ? ((currentViewMetrics.fuel / currentViewMetrics.totalExpenses) * 100).toFixed(1) : '0')}% of recorded overheads. Bundling nearby service call-outs minimizes transit fuel burn.`
                    : 'Log fuel slips daily to track vehicle running costs per service route across Sandton, Bryanston, and greater Johannesburg.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="font-bold text-slate-200 block mb-1">Quotation Conversion Pipeline</span>
                <p className="text-slate-400">
                  You have active quotations valued at {formatZAR(quotes.reduce((s, q) => s + (q.totalAmount || 0), 0))}. Following up on pending quotes generates immediate pipeline cash flow.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET EXPENSES CONFIRMATION */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[#1B1E28] border border-rose-500/30 text-white shadow-2xl p-6 relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-center text-white">Reset All Financial Expenses?</h3>
            <p className="text-xs text-slate-300 text-center mt-2 leading-relaxed">
              This will clear all logged expense records from storage so you can start logging daily expenses with a clean slate (R0.00). Invoices and quotes will remain intact.
            </p>
            <div className="flex justify-center gap-3 mt-6 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllExpenses();
                  setIsResetConfirmOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-rose-600/30"
              >
                Yes, Reset Expenses to R0.00
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT EXPENSE */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[#1B1E28] border border-[#282E3E] text-white shadow-2xl p-6 relative">
            <button
              onClick={() => setIsExpenseModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <span>{editingExpenseId ? 'Edit Business Expense' : 'Log Business Expense'}</span>
            </h3>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={expenseFormData.date}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Category</label>
                  <select
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Materials & Stock">Materials & Stock</option>
                    <option value="Vehicle Fuel & Fleet">Vehicle Fuel & Fleet</option>
                    <option value="Labor & Contractor Wages">Labor & Contractor Wages</option>
                    <option value="Tools & Equipment">Tools & Equipment</option>
                    <option value="Overheads & Compliance">Overheads & Compliance</option>
                    <option value="Marketing & Software">Marketing & Software</option>
                    <option value="Other & Miscellaneous">Other & Miscellaneous</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Description / Items Purchased</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Centurion D5 SMART motor & backup batteries"
                  value={expenseFormData.description}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Total Amount (ZAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseFormData.amount}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Supplier / Merchant</label>
                  <input
                    type="text"
                    placeholder="e.g. Voltex Kya Sand / Shell"
                    value={expenseFormData.supplier}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, supplier: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tax Invoice / Receipt Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. VTX-90210"
                    value={expenseFormData.invoiceNumber}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, invoiceNumber: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Payment Method</label>
                  <select
                    value={expenseFormData.paymentMethod}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, paymentMethod: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Card">Speedpoint / Card</option>
                    <option value="EFT">Electronic Funds Transfer (EFT)</option>
                    <option value="Account">Supplier Trade Account</option>
                    <option value="Debit Order">Debit Order</option>
                    <option value="Cash">Petty Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Related Job / Client (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Johan Van Der Merwe - Gate Motor"
                  value={expenseFormData.relatedClientOrJob}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, relatedClientOrJob: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="autoCalcVatCheck"
                  checked={expenseFormData.autoCalculateVat}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, autoCalculateVat: e.target.checked })}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="autoCalcVatCheck" className="text-slate-300 font-semibold cursor-pointer">
                  Auto-calculate 15% South African Input VAT for SARS deduction
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold cursor-pointer"
                >
                  {editingExpenseId ? 'Update Expense' : 'Save Expense Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default FinancialAnalysis;
