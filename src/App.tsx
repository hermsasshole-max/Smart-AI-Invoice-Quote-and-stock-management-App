import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SafeAreaProvider, SafeAreaView, useSafeArea } from './components/SafeAreaProvider';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { QuotationEngine } from './components/QuotationEngine';
import { InvoicingPipeline } from './components/InvoicingPipeline';
import { FinancialAnalysis } from './components/FinancialAnalysis';
import { ClientsDirectory } from './components/ClientsDirectory';
import { InventoryManager } from './components/InventoryManager';
import { SettingsManager } from './components/SettingsManager';
import { SqlSchemaViewer } from './components/SqlSchemaViewer';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { PaywallModal } from './components/PaywallModal';
import { DebugModal } from './components/DebugModal';
import { DebugFloatingButton } from './components/DebugFloatingButton';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppContent: React.FC<{
  isDebugOpen: boolean;
  setIsDebugOpen: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ isDebugOpen, setIsDebugOpen }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { sunlightMode, isPaywallOpen, closePaywall, paywallReason } = useApp();
  const { isLandscape } = useSafeArea();

  // Keyboard shortcut: Ctrl+Shift+D or Cmd+Shift+D to toggle Debug Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsDebugOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsDebugOpen]);

  return (
    <SafeAreaView
      className={`app-container min-h-screen min-h-[100dvh] w-full flex flex-col transition-colors duration-200 ${
        sunlightMode ? 'bg-[#F1F5F9] text-[#0F172A]' : 'bg-[#0E1017] text-slate-100'
      }`}
    >
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openReceiptScanner={() => setIsScannerOpen(true)}
        openDebugModal={() => setIsDebugOpen(true)}
      />

      <main className={`flex-1 w-full max-w-7xl mx-auto py-4 sm:py-6 transition-all ${
        isLandscape ? 'px-4 sm:px-6 lg:px-8' : 'px-3 sm:px-6 lg:px-8'
      }`}>
        {activeTab === 'dashboard' && (
          <Dashboard
            setActiveTab={setActiveTab}
            openReceiptScanner={() => setIsScannerOpen(true)}
          />
        )}
        {activeTab === 'quotes' && <QuotationEngine />}
        {activeTab === 'invoices' && <InvoicingPipeline />}
        {activeTab === 'financials' && <FinancialAnalysis />}
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
          <div className="flex items-center space-x-3">
            <span>SANS 10142-1 Compliance • ZAR Financial Engine</span>
            <button
              type="button"
              onClick={() => setIsDebugOpen(true)}
              className="text-slate-400 hover:text-amber-400 underline cursor-pointer text-[11px]"
            >
              [Debug Console]
            </button>
          </div>
        </div>
      </footer>

      {/* Global Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      {/* Global Monetization Paywall Modal */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={closePaywall}
        triggerReason={paywallReason}
      />

      {/* Global Visual Debug Modal / Overlay */}
      <DebugModal
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
      />

      {/* Floating On-Screen Debug Action Button */}
      <DebugFloatingButton onClick={() => setIsDebugOpen(true)} />
    </SafeAreaView>
  );
};

export const App: React.FC = () => {
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  return (
    <ErrorBoundary onOpenDebugModal={() => setIsDebugOpen(true)}>
      <AppProvider>
        <SafeAreaProvider>
          <AppContent isDebugOpen={isDebugOpen} setIsDebugOpen={setIsDebugOpen} />
        </SafeAreaProvider>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;

