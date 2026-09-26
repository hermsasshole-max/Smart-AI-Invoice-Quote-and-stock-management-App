import React, { useState, useRef } from 'react';
import {
  Database,
  Table,
  Key,
  ShieldCheck,
  Copy,
  Check,
  Download,
  Upload,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  FolderTree,
  Terminal,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';

export const SqlSchemaViewer: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'indexeddb' | 'sql'>('indexeddb');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    dbStats,
    refreshDbStats,
    exportLocalBackup,
    importLocalBackup,
    clients,
    inventory,
    quotes,
    invoices,
    financialRecords,
    expenses,
    sunlightMode,
  } = useApp();

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const res = await exportLocalBackup();
      setFeedback({
        type: 'success',
        text: `Export complete! Saved "${res.filename}" (${(res.size / 1024).toFixed(1)} KB) directly to phone downloads.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: 'Export error: ' + (err.message || 'Failed to export backup'),
      });
    } finally {
      setExporting(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const localStores = [
    {
      name: 'clients',
      displayName: 'Clients Directory',
      recordCount: dbStats.clients,
      primaryKey: 'id (UUID / String)',
      description: 'Customer contact details, physical job addresses, VAT numbers and billing history.',
      columns: [
        { name: 'id', type: 'string (PK)', req: true, desc: 'Unique client identifier' },
        { name: 'name', type: 'string', req: true, desc: 'Business or contact person name' },
        { name: 'phone', type: 'string', req: true, desc: 'Mobile/telephone number' },
        { name: 'email', type: 'string', req: false, desc: 'Invoice dispatch address' },
        { name: 'address', type: 'string', req: true, desc: 'Physical job / site address' },
        { name: 'taxVatNumber', type: 'string', req: false, desc: 'SARS Tax / VAT registration number' },
        { name: 'notes', type: 'string', req: false, desc: 'Site access codes & instructions' },
      ],
      sample: clients.slice(0, 2),
    },
    {
      name: 'stock',
      displayName: 'Van Stock & Materials (Inventory)',
      recordCount: dbStats.stock,
      primaryKey: 'id (UUID / String)',
      description: 'Van parts catalog, wholesale unit costs, markups, selling prices and alert thresholds.',
      columns: [
        { name: 'id', type: 'string (PK)', req: true, desc: 'Unique SKU identifier' },
        { name: 'sku', type: 'string', req: true, desc: 'Item code / Barcode / SKU' },
        { name: 'description', type: 'string', req: true, desc: 'Item description and specification' },
        { name: 'unitCost', type: 'number', req: true, desc: 'Wholesale acquisition cost (excl. VAT)' },
        { name: 'markupPct', type: 'number', req: true, desc: 'Standard markup percentage (e.g. 35%)' },
        { name: 'sellingPrice', type: 'number', req: true, desc: 'Contractor retail selling price' },
        { name: 'quantityOnHand', type: 'number', req: true, desc: 'Current quantity on vehicle/shelf' },
        { name: 'minAlertLevel', type: 'number', req: true, desc: 'Minimum re-order warning threshold' },
      ],
      sample: inventory.slice(0, 2),
    },
    {
      name: 'quotations',
      displayName: 'Quotations & Estimates',
      recordCount: dbStats.quotations,
      primaryKey: 'id (UUID / String)',
      description: 'Client proposals with materials, labour, call-out fee, travel, and SANS compliance.',
      columns: [
        { name: 'id', type: 'string (PK)', req: true, desc: 'Internal quote ID' },
        { name: 'quoteNumber', type: 'string', req: true, desc: 'Document sequence (e.g. Q-2026-0001)' },
        { name: 'clientId', type: 'string (FK)', req: true, desc: 'Target client reference' },
        { name: 'items', type: 'QuoteLineItem[]', req: true, desc: 'Materials & components breakdown' },
        { name: 'subtotal', type: 'number', req: true, desc: 'Materials + Labour subtotal' },
        { name: 'vatAmount', type: 'number', req: true, desc: '15% SARS VAT (if VAT enabled)' },
        { name: 'totalAmount', type: 'number', req: true, desc: 'Final invoice payable total (ZAR)' },
        { name: 'date', type: 'string (YYYY-MM-DD)', req: true, desc: 'Issue date' },
        { name: 'expiryDate', type: 'string (YYYY-MM-DD)', req: true, desc: 'Proposal validity expiry' },
        { name: 'status', type: 'enum', req: true, desc: 'Pending / Accepted / Rejected' },
      ],
      sample: quotes.slice(0, 2),
    },
    {
      name: 'invoices',
      displayName: 'Tax Invoices & Progress Claims',
      recordCount: dbStats.invoices,
      primaryKey: 'id (UUID / String)',
      description: 'Official tax invoices, deposit tracking, payment receipts and balance due calculation.',
      columns: [
        { name: 'id', type: 'string (PK)', req: true, desc: 'Internal invoice ID' },
        { name: 'invoiceNumber', type: 'string', req: true, desc: 'Document sequence (e.g. INV-2026-0001)' },
        { name: 'clientId', type: 'string (FK)', req: true, desc: 'Billed client reference' },
        { name: 'quoteId', type: 'string (FK)', req: false, desc: 'Linked quotation ID (optional)' },
        { name: 'items', type: 'QuoteLineItem[]', req: true, desc: 'Billed items & labour hours' },
        { name: 'payments', type: 'InvoicePayment[]', req: false, desc: 'Payments received log' },
        { name: 'amountPaid', type: 'number', req: true, desc: 'Total payments received to date' },
        { name: 'balanceDue', type: 'number', req: true, desc: 'Remaining unpaid balance' },
        { name: 'dueDate', type: 'string (YYYY-MM-DD)', req: true, desc: 'Payment due date' },
        { name: 'status', type: 'enum', req: true, desc: 'Unpaid / Partially Paid / Paid' },
      ],
      sample: invoices.slice(0, 2),
    },
    {
      name: 'financial_records',
      displayName: 'Financial Ledger & Cashflow',
      recordCount: dbStats.financial_records,
      primaryKey: 'id (UUID / String)',
      description: 'Double-entry cashflow transactions for client payments and operating expenses.',
      columns: [
        { name: 'id', type: 'string (PK)', req: true, desc: 'Unique transaction ID' },
        { name: 'date', type: 'string (YYYY-MM-DD)', req: true, desc: 'Transaction execution date' },
        { name: 'type', type: "'Income' | 'Expense'", req: true, desc: 'Transaction type' },
        { name: 'category', type: 'string', req: true, desc: 'Chart of accounts category' },
        { name: 'amount', type: 'number', req: true, desc: 'Amount in ZAR' },
        { name: 'linkedInvoiceRef', type: 'string', req: false, desc: 'Linked invoice reference' },
        { name: 'paymentMethod', type: 'string', req: false, desc: 'EFT, Cash, Card, Instant EFT' },
      ],
      sample: financialRecords.slice(0, 2),
    },
  ];

  const sqlSchemaCode = `-- ==========================================
-- CorTech Field Service Operations Database Schema
-- Architecture: Offline-First Local IndexedDB + Optional PostgreSQL Cloud SQL
-- Standard: SANS 10142-1 Compliance & Audit Trail
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BUSINESS PROFILE & CONTRACTOR COMPLIANCE
CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    tagline VARCHAR(255),
    reg_number VARCHAR(100),
    vat_number VARCHAR(100),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150),
    address TEXT,
    bank_name VARCHAR(100),
    account_name VARCHAR(150),
    account_number VARCHAR(50),
    branch_code VARCHAR(20),
    account_type VARCHAR(50) DEFAULT 'Current',
    default_callout_fee NUMERIC(10, 2) DEFAULT 650.00,
    default_labour_rate NUMERIC(10, 2) DEFAULT 450.00,
    default_travel_rate NUMERIC(10, 2) DEFAULT 7.50,
    default_markup_pct NUMERIC(5, 2) DEFAULT 35.00,
    vat_enabled BOOLEAN DEFAULT true,
    vat_percentage NUMERIC(5, 2) DEFAULT 15.00,
    sans_compliance_notice TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. CLIENTS & RESIDENTIAL/COMMERCIAL SITES
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150),
    address TEXT NOT NULL,
    tax_vat_number VARCHAR(100),
    notes TEXT,
    total_billed NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_name ON clients(name);

-- 3. VAN STOCK & MATERIALS INVENTORY
CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    markup_pct NUMERIC(5, 2) NOT NULL DEFAULT 35.00,
    selling_price NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'ea',
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    min_alert_level INTEGER NOT NULL DEFAULT 5,
    supplier VARCHAR(150),
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_sku ON stock(sku);
CREATE INDEX idx_stock_category ON stock(category);

-- 4. FAST QUOTATIONS & ESTIMATES
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    subtotal NUMERIC(12, 2) NOT NULL,
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    is_deposit_paid BOOLEAN DEFAULT false,
    deposit_amount_paid NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotes_number ON quotations(quote_number);

-- 5. TAX INVOICES & PROGRESS CLAIMS
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    quote_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    subtotal NUMERIC(12, 2) NOT NULL,
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_number ON invoices(invoice_number);

-- 6. FINANCIAL RECORDS & CASHFLOW LEDGER
CREATE TABLE IF NOT EXISTS financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('Income', 'Expense')),
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    linked_invoice_ref VARCHAR(100),
    description TEXT,
    payment_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fin_records_date ON financial_records(date);
CREATE INDEX idx_fin_records_type ON financial_records(type);
`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full px-0 sm:px-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>Local Database & Storage Engine</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              Offline-First
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Client records, stock catalogs, quotations, and tax invoices are saved directly on this Android device with zero cloud dependency.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-1 p-1 bg-[#151722] border border-[#282E3E] rounded-xl self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('indexeddb')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'indexeddb'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Local IndexedDB</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('sql')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'sql'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>SQL Schema (DDL)</span>
          </button>
        </div>
      </div>

      {/* Backup & Portability Banner */}
      <div
        className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
          sunlightMode
            ? 'bg-white border-slate-300 text-slate-900 shadow-slate-300/50'
            : 'bg-[#181B26] border-[#282E3E] text-white shadow-black/80'
        }`}
      >
        <div className="flex items-start space-x-3.5">
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/30 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-bold text-white">Full Local Device Backup</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                Encrypted JSON
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Export all local tables to an offline JSON archive file directly in your Android phone downloads. You can restore or migrate your entire business records instantly anytime.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          <button
            type="button"
            id="database-screen-export-btn"
            disabled={exporting}
            onClick={handleExport}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-sky-500/20 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export Local Backup</span>
          </button>

          <button
            type="button"
            id="database-screen-import-btn"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-[#334155] cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Import / Restore</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImporting(true);
              setFeedback(null);
              try {
                const text = await file.text();
                const res = await importLocalBackup(text);
                confetti({
                  particleCount: 80,
                  spread: 60,
                  origin: { y: 0.6 },
                });
                setFeedback({
                  type: 'success',
                  text: res.message || 'Database restored successfully!',
                });
              } catch (err: any) {
                setFeedback({
                  type: 'error',
                  text: 'Restore failed: ' + (err.message || 'Invalid JSON backup'),
                });
              } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setTimeout(() => setFeedback(null), 7000);
              }
            }}
          />
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 border animate-pulse ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Tab 1: Local IndexedDB Object Stores */}
      {activeSubTab === 'indexeddb' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {localStores.map((store) => (
              <div
                key={store.name}
                className="p-4 rounded-xl sm:rounded-2xl bg-[#181B26] border border-[#282E3E] shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#282E3E]">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                      {store.name}
                    </span>
                    <span className="text-xs font-black text-white font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                      {store.recordCount} records
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-2.5">{store.displayName}</h4>
                  <p className="text-[11px] text-slate-400 mt-1">{store.description}</p>

                  <div className="mt-3 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Object Store Fields:
                    </span>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {store.columns.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between text-[11px] font-mono py-0.5 border-b border-slate-800/60"
                        >
                          <span className="text-slate-200">{col.name}</span>
                          <span className="text-slate-400 text-[10px]">{col.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-[#282E3E] text-[10px] text-slate-400 flex items-center justify-between">
                  <span>PK: {store.primaryKey}</span>
                  <span className="text-emerald-400 font-bold">IndexedDB Native</span>
                </div>
              </div>
            ))}
          </div>

          {/* Architecture Guarantee Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-[#151722] border border-[#282E3E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-white block">Offline Reliability & No Quota Restrictions</span>
                <span className="text-slate-400 text-[11px]">
                  All database transactions run through Dexie.js ACID-compliant IndexedDB. Standard localStorage with 5MB limits is completely bypassed.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshDbStats}
              className="px-3 py-1.5 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verify Tables</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: SQL DDL Schema */}
      {activeSubTab === 'sql' && (
        <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#151722] border border-[#282E3E] shadow-2xl relative">
          <div className="flex items-center justify-between pb-3 border-b border-[#282E3E]">
            <div className="flex items-center space-x-2">
              <Table className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono text-slate-300">schema.sql • PostgreSQL / SQLite Reference</span>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="px-3 py-1.5 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-bold flex items-center space-x-1.5 cursor-pointer active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied SQL!' : 'Copy SQL Script'}</span>
            </button>
          </div>

          <pre className="mt-4 p-4 rounded-xl bg-[#0E1017] border border-[#282E3E] text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed">
            {sqlSchemaCode}
          </pre>
        </div>
      )}
    </div>
  );
};
