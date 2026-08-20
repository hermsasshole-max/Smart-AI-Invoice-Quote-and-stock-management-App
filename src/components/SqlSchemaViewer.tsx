import React, { useState } from 'react';
import { Database, Table, Key, ShieldCheck, Copy, Check } from 'lucide-react';

export const SqlSchemaViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const sqlSchemaCode = `-- ==========================================
-- Harry's Aircon & Electrical Cloud SQL Schema
-- Target Database: PostgreSQL 15 / 16 (Google Cloud SQL)
-- Standard: SANS 10142-1 Compliance & Audit Trail
-- ==========================================

-- Enable UUID Extension
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
    notes TEXT,
    total_billed NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_name ON clients(name);

-- 3. VAN STOCK & MATERIALS INVENTORY
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    cost_price NUMERIC(10, 2) NOT NULL,
    default_markup NUMERIC(5, 2) NOT NULL DEFAULT 35.00,
    selling_price NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(30) DEFAULT 'ea',
    stock_qty INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 2,
    supplier VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_category ON inventory_items(category);

-- 4. ON-SITE FAST QUOTATIONS
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    client_email VARCHAR(150),
    client_address TEXT NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    scope_of_work TEXT,
    callout_fee NUMERIC(10, 2) DEFAULT 0.00,
    labour_hours NUMERIC(6, 2) DEFAULT 0.00,
    labour_rate_per_hour NUMERIC(10, 2) DEFAULT 0.00,
    labour_total NUMERIC(10, 2) DEFAULT 0.00,
    travel_distance_km NUMERIC(6, 2) DEFAULT 0.00,
    travel_rate_per_km NUMERIC(10, 2) DEFAULT 0.00,
    travel_total NUMERIC(10, 2) DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    vat_enabled BOOLEAN DEFAULT true,
    vat_amount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    notes TEXT,
    terms TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. QUOTATION LINE ITEMS
CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category VARCHAR(100),
    cost_price NUMERIC(10, 2) NOT NULL,
    markup_pct NUMERIC(5, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity NUMERIC(8, 2) NOT NULL,
    unit VARCHAR(30) DEFAULT 'ea',
    total NUMERIC(12, 2) NOT NULL
);

-- 6. TAX INVOICES & COC CERTIFICATIONS
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    quote_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    client_email VARCHAR(150),
    client_address TEXT NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    scope_of_work TEXT,
    subtotal NUMERIC(12, 2) NOT NULL,
    vat_amount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    amount_paid NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'issued',
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    coc_number VARCHAR(100),
    coc_issue_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. EFT & CASH PAYMENT AUDIT TRAIL
CREATE TABLE IF NOT EXISTS invoice_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. GEMINI AI OCR SLIP SCANS
CREATE TABLE IF NOT EXISTS receipt_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_name VARCHAR(255),
    invoice_number VARCHAR(100),
    scan_date DATE,
    total_amount NUMERIC(12, 2),
    raw_ocr_json JSONB,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchemaCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>Cloud SQL PostgreSQL Schema</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              PostgreSQL 16 & JSONB
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enterprise database architecture for Harry's Field Operations, SANS 10142 compliance, and OCR slips.
          </p>
        </div>

        <button
          onClick={copySql}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied DDL Script!' : 'Copy SQL Script'}</span>
        </button>
      </div>

      {/* Tables Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#1B1E28] border border-[#282E3E]">
          <div className="flex items-center space-x-2 text-sky-400 font-mono font-bold text-xs uppercase mb-1">
            <Table className="w-4 h-4" />
            <span>business_profiles</span>
          </div>
          <p className="text-xs text-slate-400">Stores TymeBank account info, VAT 15%, SANS compliance notices, and default markup rates.</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#1B1E28] border border-[#282E3E]">
          <div className="flex items-center space-x-2 text-amber-400 font-mono font-bold text-xs uppercase mb-1">
            <Table className="w-4 h-4" />
            <span>quotations & items</span>
          </div>
          <p className="text-xs text-slate-400">Foreign-keyed on-site quotes with labour, travel, callout, discount, and VAT calculation.</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#1B1E28] border border-[#282E3E]">
          <div className="flex items-center space-x-2 text-emerald-400 font-mono font-bold text-xs uppercase mb-1">
            <Table className="w-4 h-4" />
            <span>invoices & payments</span>
          </div>
          <p className="text-xs text-slate-400">Tax invoices linked with EFT audit trails, partial payments, and SANS CoC certificates.</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#1B1E28] border border-[#282E3E]">
          <div className="flex items-center space-x-2 text-indigo-400 font-mono font-bold text-xs uppercase mb-1">
            <Table className="w-4 h-4" />
            <span>receipt_scans</span>
          </div>
          <p className="text-xs text-slate-400">Gemini 2.5 Flash OCR JSON logs for supplier slip extraction and automatic van stock ingest.</p>
        </div>
      </div>

      {/* SQL Script Viewer */}
      <div className="p-4 rounded-2xl bg-[#12141C] border border-[#282E3E] overflow-hidden">
        <div className="flex justify-between items-center pb-3 mb-3 border-b border-[#282E3E] text-xs font-mono text-slate-400">
          <span>database_schema.sql</span>
          <span>PostgreSQL Syntax</span>
        </div>
        <pre className="text-xs font-mono text-sky-300 overflow-x-auto p-2 bg-[#0C0E14] rounded-xl max-h-[500px]">
          {sqlSchemaCode}
        </pre>
      </div>
    </div>
  );
};
