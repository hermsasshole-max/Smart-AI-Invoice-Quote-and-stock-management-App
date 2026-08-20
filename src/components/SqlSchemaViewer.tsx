import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SQLITE_DDL_SCHEMA } from '../data/seedData';
import { Database, Copy, Check, Download, Code2, Layers, Cpu, ShieldCheck } from 'lucide-react';

export const SqlSchemaViewer: React.FC = () => {
  const { sunlightMode, inventory, quotations, invoices, clients, jobs } = useApp();
  const [copied, setCopied] = useState(false);

  const handleCopyDDL = () => {
    navigator.clipboard.writeText(SQLITE_DDL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([SQLITE_DDL_SCHEMA], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `harrys_field_services_schema_${new Date().toISOString().split('T')[0]}.sql`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#F8FAFC]'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#334155] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#38BDF8] text-[#1B1E28] uppercase tracking-wider flex items-center space-x-1">
              <Database className="w-3 h-3" />
              <span>ANDROID KOTLIN / ROOM SQLITE DDL</span>
            </span>
            <span className="text-[11px] font-mono text-[#94A3B8]">OFFLINE-FIRST RELATIONAL DATA LAYER</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-white">
            SQLite Database & Room Entities Schema
          </h2>
          <p className="text-xs font-mono text-[#94A3B8] mt-0.5">
            Comprehensive DDL schema and Room Entity architecture powering offline field synchronization, foreign keys, cascade triggers, and stock reconciliation.
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono">
          <button
            onClick={handleCopyDDL}
            className="px-3.5 py-2 rounded-lg bg-[#232838] border border-[#334155] hover:bg-[#1B1E28] text-[#F8FAFC] font-bold text-xs uppercase flex items-center space-x-1.5 shadow"
          >
            {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4 text-[#94A3B8]" />}
            <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY SQL DDL'}</span>
          </button>

          <button
            onClick={handleDownloadSQL}
            className="px-3.5 py-2 rounded-lg bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#1B1E28] font-bold text-xs uppercase flex items-center space-x-1.5 shadow"
          >
            <Download className="w-4 h-4" />
            <span>Download .sql</span>
          </button>
        </div>
      </div>

      {/* Relational Table Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
        <div className="p-3 rounded-xl bg-[#232838] border border-[#334155]">
          <span className="text-[#94A3B8] block text-[10px] uppercase">TABLE</span>
          <span className="font-bold text-[#10B981]">inventory_items</span>
          <div className="text-xs text-white mt-1 font-bold">{inventory.length} Records</div>
        </div>

        <div className="p-3 rounded-xl bg-[#232838] border border-[#334155]">
          <span className="text-[#94A3B8] block text-[10px] uppercase">TABLE</span>
          <span className="font-bold text-[#38BDF8]">quotations</span>
          <div className="text-xs text-white mt-1 font-bold">{quotations.length} Records</div>
        </div>

        <div className="p-3 rounded-xl bg-[#232838] border border-[#334155]">
          <span className="text-[#94A3B8] block text-[10px] uppercase">TABLE</span>
          <span className="font-bold text-[#F59E0B]">invoices</span>
          <div className="text-xs text-white mt-1 font-bold">{invoices.length} Records</div>
        </div>

        <div className="p-3 rounded-xl bg-[#232838] border border-[#334155]">
          <span className="text-[#94A3B8] block text-[10px] uppercase">TABLE</span>
          <span className="font-bold text-[#10B981]">field_jobs</span>
          <div className="text-xs text-white mt-1 font-bold">{jobs.length} Records</div>
        </div>

        <div className="p-3 rounded-xl bg-[#232838] border border-[#334155]">
          <span className="text-[#94A3B8] block text-[10px] uppercase">TABLE</span>
          <span className="font-bold text-[#38BDF8]">clients</span>
          <div className="text-xs text-white mt-1 font-bold">{clients.length} Records</div>
        </div>

        <div className="p-3 rounded-xl bg-[#232838] border border-[#334155]">
          <span className="text-[#94A3B8] block text-[10px] uppercase">TABLE</span>
          <span className="font-bold text-[#F59E0B]">business_profile</span>
          <div className="text-xs text-white mt-1 font-bold">1 Active Singleton</div>
        </div>
      </div>

      {/* SQL DDL Code View */}
      <div
        className={`p-5 rounded-2xl border font-mono text-xs overflow-hidden shadow-2xl ${
          sunlightMode ? 'bg-[#1B1E28] text-[#10B981] border-2 border-black' : 'bg-[#1B1E28] border-[#334155] text-[#10B981]'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#334155] pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-[#38BDF8]" />
            <span className="text-white font-bold">schema.sql (SQLite 3.x / Android Room Compatible)</span>
          </div>
          <span className="text-[#94A3B8] text-[11px] uppercase">Strict Types • Indexes • Triggers</span>
        </div>

        <pre className="max-h-[500px] overflow-y-auto leading-relaxed p-2 select-all scrollbar-thin scrollbar-thumb-[#334155] text-[11px] font-mono">
          {SQLITE_DDL_SCHEMA}
        </pre>
      </div>
    </div>
  );
};
