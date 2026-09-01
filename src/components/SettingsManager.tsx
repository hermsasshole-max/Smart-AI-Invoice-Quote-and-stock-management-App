import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings,
  Building,
  CreditCard,
  Percent,
  ShieldCheck,
  RotateCcw,
  Check,
  Zap,
  Crown,
  Sparkles,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  KeyRound,
  Unlock,
  X,
  Hash,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { billingService } from '../services/billingService';

export const SettingsManager: React.FC = () => {
  const {
    profile,
    updateProfile,
    resetToSampleData,
    sunlightMode,
    tier,
    entitlements,
    openPaywall,
    refreshEntitlements,
    getNextQuoteNumber,
    getNextInvoiceNumber,
    setNextQuoteNumber,
    setNextInvoiceNumber,
  } = useApp();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [restoringIap, setRestoringIap] = useState(false);
  const [iapMessage, setIapMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState('');
  const [devCodeProcessing, setDevCodeProcessing] = useState(false);
  const [devCodeFeedback, setDevCodeFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [tagline, setTagline] = useState(profile.tagline);
  const [regNumber, setRegNumber] = useState(profile.regNumber);
  const [vatNumber, setVatNumber] = useState(profile.vatNumber);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [address, setAddress] = useState(profile.address);
  const [bankName, setBankName] = useState(profile.bankName);
  const [accountName, setAccountName] = useState(profile.accountName);
  const [accountNumber, setAccountNumber] = useState(profile.accountNumber);
  const [branchCode, setBranchCode] = useState(profile.branchCode);
  const [accountType, setAccountType] = useState(profile.accountType);
  const [defaultCalloutFee, setDefaultCalloutFee] = useState(profile.defaultCalloutFee);
  const [defaultLabourRate, setDefaultLabourRate] = useState(profile.defaultLabourRate);
  const [defaultTravelRate, setDefaultTravelRate] = useState(profile.defaultTravelRate);
  const [defaultMarkup, setDefaultMarkup] = useState(profile.defaultMarkup);
  const [vatEnabled, setVatEnabled] = useState(profile.vatEnabled);
  const [sansNotice, setSansNotice] = useState(profile.sansComplianceNotice);

  // Document Sequence State
  const [nextQuoteNum, setNextQuoteNum] = useState<string>(() => getNextQuoteNumber());
  const [nextInvNum, setNextInvNum] = useState<string>(() => getNextInvoiceNumber());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      companyName,
      tagline,
      regNumber,
      vatNumber,
      phone,
      email,
      address,
      bankName,
      accountName,
      accountNumber,
      branchCode,
      accountType,
      defaultCalloutFee,
      defaultLabourRate,
      defaultTravelRate,
      defaultMarkup,
      vatEnabled,
      sansComplianceNotice: sansNotice,
      nextQuoteNumber: nextQuoteNum.trim() || undefined,
      nextInvoiceNumber: nextInvNum.trim() || undefined,
    });

    if (nextQuoteNum.trim()) {
      setNextQuoteNumber(nextQuoteNum.trim());
    }
    if (nextInvNum.trim()) {
      setNextInvoiceNumber(nextInvNum.trim());
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>Business Profile & Banking Settings</span>
            <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
              SANS & SARS Ready
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure company registration, TymeBank EFT details, default hourly labour rates, and SANS 10142 compliance notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (confirm('Reset all demo data back to default initial seed state?')) {
              resetToSampleData();
              alert('Sample data restored.');
            }
          }}
          className="px-3.5 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-bold flex items-center space-x-1.5 border border-[#334155] cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Sample Data</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Registration Card */}
        <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#1B1E28] border-[#282E3E] text-white'}`}>
          <h3 className="font-black text-base flex items-center space-x-2 text-sky-400 pb-4 border-b border-[#282E3E]">
            <Building className="w-5 h-5" />
            <span>Company Legal & Contact Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Business Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Tagline / Services</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">CIPC Registration No.</label>
              <input
                type="text"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">SARS VAT Number</label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Primary Phone (WhatsApp)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Business Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Physical / Workshop Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
              />
            </div>
          </div>
        </div>

        {/* Banking Details Card */}
        <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#1B1E28] border-[#282E3E] text-white'}`}>
          <h3 className="font-black text-base flex items-center space-x-2 text-amber-400 pb-4 border-b border-[#282E3E]">
            <CreditCard className="w-5 h-5" />
            <span>South African Banking Details (Printed on Invoices & Quotes)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Account Holder Name</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-amber-400 font-mono font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Branch Code</label>
              <input
                type="text"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Default Rates & Compliance */}
        <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#1B1E28] border-[#282E3E] text-white'}`}>
          <h3 className="font-black text-base flex items-center space-x-2 text-emerald-400 pb-4 border-b border-[#282E3E]">
            <Percent className="w-5 h-5" />
            <span>Default Rates, Markup Tiers & Compliance</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Callout Fee (ZAR)</label>
              <input
                type="number"
                value={defaultCalloutFee}
                onChange={(e) => setDefaultCalloutFee(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Labour Rate / Hr (ZAR)</label>
              <input
                type="number"
                value={defaultLabourRate}
                onChange={(e) => setDefaultLabourRate(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Travel Rate / Km (ZAR)</label>
              <input
                type="number"
                value={defaultTravelRate}
                onChange={(e) => setDefaultTravelRate(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Default Markup (%)</label>
              <input
                type="number"
                value={defaultMarkup}
                onChange={(e) => setDefaultMarkup(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold flex items-center justify-between">
                <span>Next Quote Number</span>
                <span className="text-[10px] text-sky-400 font-normal">Auto-Sequence</span>
              </label>
              <input
                type="text"
                value={nextQuoteNum}
                onChange={(e) => setNextQuoteNum(e.target.value)}
                placeholder="e.g. Q-2026-0144"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-sky-300 font-mono font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold flex items-center justify-between">
                <span>Next Invoice Number</span>
                <span className="text-[10px] text-emerald-400 font-normal">Auto-Sequence</span>
              </label>
              <input
                type="text"
                value={nextInvNum}
                onChange={(e) => setNextInvNum(e.target.value)}
                placeholder="e.g. INV-2026-0102"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-emerald-300 font-mono font-bold"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">SANS 10142 Compliance Notice</label>
              <textarea
                rows={2}
                value={sansNotice}
                onChange={(e) => setSansNotice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
              />
            </div>
          </div>
        </div>

        {/* Subscription & Entitlements Management Card */}
        <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#1B1E28] border-[#282E3E] text-white'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-[#282E3E] gap-2">
            <h3 className="font-black text-base flex items-center space-x-2 text-amber-400">
              <Crown className="w-5 h-5 text-amber-400" />
              <span>Subscription & Monetization Tier</span>
            </h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wider uppercase ${
              tier === 'BUSINESS'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : tier === 'PRO'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-700 text-slate-300 border border-slate-600'
            }`}>
              Active Plan: {tier}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-[#12141C] border border-[#282E3E]">
              <span className="text-slate-400 block font-mono uppercase font-bold text-[10px]">Monthly Invoices & Quotes</span>
              <span className="text-white font-extrabold text-sm mt-0.5 block">
                {entitlements.unlimitedDocuments ? 'Unlimited Documents' : `Max ${entitlements.maxMonthlyDocuments} / month`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#12141C] border border-[#282E3E]">
              <span className="text-slate-400 block font-mono uppercase font-bold text-[10px]">AI Voice & Slip OCR Credits</span>
              <span className="text-amber-400 font-extrabold text-sm mt-0.5 block">
                {entitlements.unlimitedAi ? 'Unlimited AI Queries' : `${entitlements.creditsRemaining} remaining`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#12141C] border border-[#282E3E]">
              <span className="text-slate-400 block font-mono uppercase font-bold text-[10px]">Van Inventory Catalog</span>
              <span className="text-white font-extrabold text-sm mt-0.5 block">
                {entitlements.unlimitedInventory ? 'Unlimited Items' : 'Max 10 Items'}
              </span>
            </div>
          </div>

          {/* Offline Grace Period Details */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-700 flex items-start space-x-3 text-xs">
            <Wifi className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-slate-200 block">Failsafe Offline Job-Site Grace Period Active</span>
              <p className="text-slate-400 text-[11px] mt-0.5">
                If working on a remote roof or in a basement without cellular reception, all document creation and cached tier entitlements remain valid locally for up to 14 days without network access.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openPaywall('View and change subscription tier')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>{tier === 'FREE' ? 'Upgrade Plan (Pro / Business)' : 'Manage Subscription Plans'}</span>
            </button>

            <button
              type="button"
              disabled={restoringIap}
              onClick={async () => {
                setRestoringIap(true);
                setIapMessage(null);
                try {
                  const restored = await billingService.restorePurchases();
                  await refreshEntitlements();
                  if (restored) {
                    setIapMessage(`Successfully restored ${restored.tier} subscription!`);
                  } else {
                    setIapMessage('No active Google Play or Stripe subscription found to restore.');
                  }
                } catch (e: any) {
                  setIapMessage('Failed to restore: ' + (e.message || 'Network error'));
                } finally {
                  setRestoringIap(false);
                  setTimeout(() => setIapMessage(null), 4000);
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 font-bold text-xs flex items-center space-x-1.5 border border-[#334155] cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${restoringIap ? 'animate-spin' : ''}`} />
              <span>{restoringIap ? 'Checking Play Store...' : 'Restore IAP Purchases'}</span>
            </button>
          </div>

          {/* Developer Token / Voucher Redemption Section */}
          <div className="mt-5 pt-4 border-t border-[#282E3E]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold text-slate-200 block">Developer Token / Master Code</span>
                  <span className="text-slate-400 text-[11px]">Enter developer password for lifetime unlimited free access</span>
                </div>
              </div>

              <div className="w-full sm:w-auto flex items-center space-x-2">
                <input
                  id="settings-developer-token-input"
                  type="text"
                  value={devCode}
                  onChange={(e) => setDevCode(e.target.value)}
                  placeholder="Code (e.g. NismoR34)"
                  className="px-3 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-400 flex-1 sm:w-44"
                />
                <button
                  id="settings-redeem-token-button"
                  type="button"
                  disabled={devCodeProcessing || !devCode.trim()}
                  onClick={async () => {
                    setDevCodeProcessing(true);
                    setDevCodeFeedback(null);
                    try {
                      const res = await billingService.redeemDeveloperCode(devCode.trim());
                      if (res.success) {
                        confetti({
                          particleCount: 100,
                          spread: 70,
                          origin: { y: 0.6 },
                        });
                        await refreshEntitlements();
                        setDevCodeFeedback({
                          type: 'success',
                          text: 'Developer Code (NismoR34) Verified! Unlimited Lifetime Business Tier Active.',
                        });
                        setDevCode('');
                      } else {
                        setDevCodeFeedback({
                          type: 'error',
                          text: res.message || 'Invalid developer password.',
                        });
                      }
                    } catch (e: any) {
                      setDevCodeFeedback({
                        type: 'error',
                        text: 'Failed to verify developer code: ' + (e.message || 'Error'),
                      });
                    } finally {
                      setDevCodeProcessing(false);
                      setTimeout(() => setDevCodeFeedback(null), 5000);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {devCodeProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                  <span>Unlock</span>
                </button>
              </div>
            </div>

            {devCodeFeedback && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border ${
                  devCodeFeedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                    : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                }`}
              >
                {devCodeFeedback.type === 'success' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{devCodeFeedback.text}</span>
              </div>
            )}
          </div>

          {iapMessage && (
            <div className="mt-3 text-xs text-sky-400 font-medium">
              {iapMessage}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end space-x-3">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
              <Check className="w-4 h-4" />
              <span>Settings Saved Successfully!</span>
            </span>
          )}

          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-lg shadow-sky-500/20 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Save All Profile Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
