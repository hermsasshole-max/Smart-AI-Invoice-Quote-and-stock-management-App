import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { QuotationEngine } from './components/QuotationEngine';
import { InvoicingPipeline } from './components/InvoicingPipeline';
import { ClientsDirectory } from './components/ClientsDirectory';
import { InventoryManager } from './components/InventoryManager';
import { SettingsManager } from './components/SettingsManager';
import { SqlSchemaViewer } from './components/SqlSchemaViewer';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { sunlightMode } = useApp();

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        sunlightMode ? 'bg-[#F1F5F9] text-[#0F172A]' : 'bg-[#0E1017] text-slate-100'
      }`}
    >
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openReceiptScanner={() => setIsScannerOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            setActiveTab={setActiveTab}
            openReceiptScanner={() => setIsScannerOpen(true)}
          />
        )}
        {activeTab === 'quotes' && <QuotationEngine />}
        {activeTab === 'invoices' && <InvoicingPipeline />}
        {activeTab === 'clients' && <ClientsDirectory />}
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'schema' && <SqlSchemaViewer />}
        {activeTab === 'settings' && <SettingsManager />}
      </main>

      <footer
        className={`py-4 border-t text-center text-xs font-mono transition-colors ${
          sunlightMode
            ? 'bg-white border-[#CBD5E1] text-slate-600'
            : 'bg-[#151722] border-[#282E3E] text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Harry's Air Conditioning & Electrical Services (Pty) Ltd</span>
          <span>SANS 10142-1 Compliance • ZAR Financial Engine</span>
        </div>
      </footer>

      {/* Global Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
