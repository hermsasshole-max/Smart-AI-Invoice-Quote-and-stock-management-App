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
} from 'lucide-react';

export const SettingsManager: React.FC = () => {
  const { profile, updateProfile, resetToSampleData, sunlightMode } = useApp();

  const [savedSuccess, setSavedSuccess] = useState(false);

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
    });

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
