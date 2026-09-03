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
import { ExpenseManager } from './components/ExpenseManager';
import { SettingsManager } from './components/SettingsManager';
import { SqlSchemaViewer } from './components/SqlSchemaViewer';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { PaywallModal } from './components/PaywallModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileBottomNav } from './components/MobileBottomNav';
import { VoiceQuoteModal } from './components/VoiceQuoteModal';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isVoiceQuoteOpen, setIsVoiceQuoteOpen] = useState(false);
  const { sunlightMode, isPaywallOpen, closePaywall, paywallReason } = useApp();
  const { isLandscape } = useSafeArea();

  return (
    <SafeAreaView
      edges={['left', 'right']}
      className={`app-container min-h-screen min-h-[100dvh] w-full flex flex-col transition-colors duration-200 pb-28 md:pb-8 ${
        sunlightMode ? 'bg-[#F1F5F9] text-[#0F172A]' : 'bg-[#0E1017] text-slate-100'
      }`}
    >
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openReceiptScanner={() => setIsScannerOpen(true)}
      />

      <main
        id="main-view-container"
        className={`flex-1 w-full max-w-7xl mx-auto py-4 sm:py-6 transition-all ${
          isLandscape ? 'px-4 sm:px-6 lg:px-8' : 'px-3 sm:px-6 lg:px-8'
        }`}
      >
        {activeTab === 'dashboard' && (
          <Dashboard
            setActiveTab={setActiveTab}
            openReceiptScanner={() => setIsScannerOpen(true)}
            openVoiceQuote={() => setIsVoiceQuoteOpen(true)}
          />
        )}
        {activeTab === 'quotes' && <QuotationEngine />}
        {activeTab === 'invoices' && <InvoicingPipeline />}
        {activeTab === 'expenses' && (
          <ExpenseManager
            setActiveTab={setActiveTab}
            openReceiptScanner={() => setIsScannerOpen(true)}
          />
        )}
        {activeTab === 'financials' && <FinancialAnalysis />}
        {activeTab === 'clients' && <ClientsDirectory />}
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'schema' && <SqlSchemaViewer />}
        {activeTab === 'settings' && <SettingsManager />}
      </main>

      <footer
        className={`py-4 border-t text-center text-xs font-mono transition-colors hidden md:block ${
          sunlightMode
            ? 'bg-white border-[#CBD5E1] text-slate-600'
            : 'bg-[#151722] border-[#282E3E] text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>CorTech AI Business Manager • Field Service Suite</span>
          <div className="flex items-center space-x-3">
            <span>SANS 10142-1 Compliance • ZAR Financial Engine</span>
          </div>
        </div>
      </footer>

      {/* Persistent Mobile-First High-Touch Bottom Nav */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openVoiceQuote={() => setIsVoiceQuoteOpen(true)}
        openReceiptScanner={() => setIsScannerOpen(true)}
      />

      {/* Voice-to-Quote & Autonomous Job Engine Modal */}
      <VoiceQuoteModal
        isOpen={isVoiceQuoteOpen}
        onClose={() => setIsVoiceQuoteOpen(false)}
        onQuoteCreated={(quote) => {
          setActiveTab('quotes');
        }}
      />

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
    </SafeAreaView>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;

