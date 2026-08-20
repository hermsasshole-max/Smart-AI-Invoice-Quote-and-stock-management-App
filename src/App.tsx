import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { QuotationEngine } from './components/QuotationEngine';
import { InvoicingPipeline } from './components/InvoicingPipeline';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { InventoryManager } from './components/InventoryManager';
import { ClientsDirectory } from './components/ClientsDirectory';
import { SqlSchemaViewer } from './components/SqlSchemaViewer';
import { SettingsManager } from './components/SettingsManager';

const MainContent: React.FC = () => {
  const { activeTab, sunlightMode } = useApp();

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        sunlightMode ? 'bg-[#FFFBEB] text-black font-sans' : 'bg-[#0A0A0B] text-[#E0E0E0] font-sans'
      }`}
    >
      <Navbar />
      <main className="flex-1 pb-12">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'quotes' && <QuotationEngine />}
        {activeTab === 'invoices' && <InvoicingPipeline />}
        {activeTab === 'scanner' && <ReceiptScannerModal />}
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'clients' && <ClientsDirectory />}
        {activeTab === 'schema' && <SqlSchemaViewer />}
        {activeTab === 'settings' && <SettingsManager />}
      </main>

      {/* Technical Data Grid Telemetry Footer */}
      <footer
        className={`border-t px-4 md:px-6 py-2.5 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono shrink-0 gap-2 ${
          sunlightMode
            ? 'bg-amber-200 border-amber-400 text-black font-bold'
            : 'bg-[#111113] border-[#2D2D30] text-[#707070]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-4 uppercase tracking-wider">
          <span className="text-[#A0A0A5]">GPS LOC: <span className={sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}>-33.9249° S, 18.4241° E</span></span>
          <span className="opacity-40">|</span>
          <span className="text-[#A0A0A5]">WEATHER: <span className={sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}>24°C CLEAR</span></span>
          <span className="opacity-40">|</span>
          <span className="text-[#A0A0A5]">LOAD SHEDDING: <span className="text-[#00FF41] font-bold">STAGE 0 (STABLE)</span></span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[#00FF41] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-ping"></span>
            SQLITE SYNCED: JUST NOW
          </span>
          <span className="opacity-40">|</span>
          <span>BATTERY: 92%</span>
          <span className="opacity-40">|</span>
          <span className="uppercase text-[#A0A0A5]">SOUTH AFRICA (SAST UTC+2)</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
