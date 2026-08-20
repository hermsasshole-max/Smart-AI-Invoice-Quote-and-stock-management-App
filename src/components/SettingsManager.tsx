import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatZAR } from '../utils/calculator';
import {
  Settings,
  Building,
  CreditCard,
  Percent,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  Shield,
  HelpCircle,
  Database,
  Sliders,
  Image,
  Trash2,
  FileText,
  Globe,
  Tag,
} from 'lucide-react';

export const SettingsManager: React.FC = () => {
  const {
    profile,
    updateProfile,
    updateRates,
    sunlightMode,
    exportDataJSON,
    importDataJSON,
    resetToFactoryDefaults,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  // Local form state
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [tagline, setTagline] = useState(profile.tagline || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [regNumber, setRegNumber] = useState(profile.registrationNumber || '');
  const [vatNumber, setVatNumber] = useState(profile.vatNumber || '');
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl || '');

  // Banking
  const [bankName, setBankName] = useState(profile.bankName);
  const [accountName, setAccountName] = useState(profile.accountName || '');
  const [accountNumber, setAccountNumber] = useState(profile.accountNumber);
  const [branchCode, setBranchCode] = useState(profile.branchCode);
  const [accountType, setAccountType] = useState(profile.accountType);

  // Rates
  const [callout, setCallout] = useState(profile.rates.calloutDiagnostic);
  const [masterLabour, setMasterLabour] = useState(profile.rates.masterLabourRate);
  const [assistantLabour, setAssistantLabour] = useState(profile.rates.assistantLabourRate);
  const [travelRate, setTravelRate] = useState(profile.rates.travelRatePerKm);
  const [travelIncluded, setTravelIncluded] = useState(profile.rates.travelIncludedKm);
  const [afterHoursMult, setAfterHoursMult] = useState(profile.rates.afterHoursMultiplier);
  const [defaultMarkup, setDefaultMarkup] = useState(profile.rates.defaultMaterialMarkupPct);

  // Handle Logo Image Upload (Base64 file reader)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLogoUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = () => {
    updateProfile({
      companyName,
      tagline,
      website,
      email,
      phone,
      address,
      registrationNumber: regNumber,
      vatNumber,
      logoUrl,
      bankName,
      accountName,
      accountNumber,
      branchCode,
      accountType,
    });

    updateRates({
      calloutDiagnostic: Number(callout),
      masterLabourRate: Number(masterLabour),
      assistantLabourRate: Number(assistantLabour),
      travelRatePerKm: Number(travelRate),
      travelIncludedKm: Number(travelIncluded),
      afterHoursMultiplier: Number(afterHoursMult),
      defaultMaterialMarkupPct: Number(defaultMarkup),
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDownloadBackup = () => {
    const json = exportDataJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harrys_field_services_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    const ok = importDataJSON(importJsonText);
    if (ok) {
      alert('Data successfully restored from backup JSON.');
      setShowImportBox(false);
      setImportJsonText('');
    } else {
      alert('Invalid backup JSON format. Please verify the file.');
    }
  };

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#F8FAFC]'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#334155] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#38BDF8] text-[#1B1E28] uppercase tracking-wider">
              CONTRACTOR PROFILE & TRADE RATES
            </span>
            <span className="text-[11px] font-mono text-[#94A3B8]">SOUTH AFRICAN BUSINESS CONFIGURATION</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#F8FAFC]">
            Settings & Rate Cards
          </h2>
          <p className="text-xs font-mono text-[#94A3B8] mt-0.5">
            Configure business identity, logo branding, bank account details for EFT payments, standard rates, and database backups.
          </p>
        </div>

        <button
          id="btn-save-settings"
          onClick={handleSaveAll}
          className="px-5 py-2 rounded-lg bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#1B1E28] font-bold text-xs uppercase flex items-center space-x-2 shadow-lg shadow-[#38BDF833] font-mono"
        >
          <CheckCircle className="w-4 h-4" />
          <span>SAVE CONFIGURATION</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-[#10B98122] border border-[#10B98166] text-[#10B981] rounded-lg flex items-center space-x-2 text-xs font-mono font-bold">
          <CheckCircle className="w-4 h-4 text-[#10B981]" />
          <span>Settings, company letterhead, rate parameters, and banking details saved successfully!</span>
        </div>
      )}

      {/* Grid: 4 Cards (Business info, Logo upload, Banking, Rates) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Business Profile */}
        <div
          className={`p-5 rounded-xl border space-y-4 ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#38BDF8] flex items-center space-x-2 font-mono">
            <Building className="w-4 h-4 text-[#38BDF8]" />
            <span>BUSINESS INFORMATION</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold font-sans text-xs focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Tagline / Slogan</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] text-xs focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Account / Dispatch Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Website URL</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Business Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-sans text-xs focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Company Reg #</label>
                <input
                  type="text"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">VAT Registration #</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Company Letterhead / Logo Branding */}
        <div
          className={`p-5 rounded-xl border space-y-4 ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#F59E0B] flex items-center space-x-2 font-mono">
            <Image className="w-4 h-4 text-[#F59E0B]" />
            <span>COMPANY LETTERHEAD / LOGO BRANDING</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <p className="text-[11px] text-[#94A3B8]">
              Upload your official company logo or trade badge to automatically display on all generated PDF quotes, invoices, and Word documents.
            </p>

            <div className="p-4 rounded-xl bg-[#1B1E28] border border-dashed border-[#334155] flex flex-col items-center justify-center space-y-3">
              {logoUrl ? (
                <div className="relative group">
                  <img
                    src={logoUrl}
                    alt="Company Logo Preview"
                    className="max-h-24 max-w-full object-contain rounded-lg p-1.5 bg-white border border-[#38BDF8]"
                  />
                  <button
                    onClick={() => setLogoUrl('')}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 shadow"
                    title="Remove Logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-1 py-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#232838] flex items-center justify-center text-[#94A3B8]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-[#94A3B8] block">No custom logo uploaded</span>
                  <span className="text-[10px] text-[#94A3B8] block">Default official brand header will be used</span>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#1B1E28] font-bold text-xs uppercase flex items-center space-x-1 shadow"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{logoUrl ? 'Change Logo Image' : 'Upload Logo File'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">
                Or Paste Image Direct URL:
              </label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] text-xs focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Card 3: South African Banking Details (For EFTs) */}
        <div
          className={`p-5 rounded-xl border space-y-4 ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#38BDF8] flex items-center space-x-2 font-mono">
            <CreditCard className="w-4 h-4 text-[#38BDF8]" />
            <span>BANKING DETAILS (FOR INVOICE EFTS)</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Account Holder / Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#10B981] font-mono font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Branch Code</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-mono focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Account Type</label>
                <input
                  type="text"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#1B1E28] border border-[#334155] text-[10px] text-[#94A3B8] font-mono">
              Clients receive these banking details on all quote and invoice exports for instant EFT settlement.
            </div>
          </div>
        </div>

        {/* Card 4: Standard Trade Rates & Multipliers */}
        <div
          className={`p-5 rounded-xl border space-y-4 ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#F59E0B] flex items-center space-x-2 font-mono">
            <Sliders className="w-4 h-4 text-[#F59E0B]" />
            <span>STANDARD TRADE RATES (ZAR R)</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Call-Out Base (R)</label>
                <input
                  type="number"
                  value={callout}
                  onChange={(e) => setCallout(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F59E0B] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Master Labour/hr (R)</label>
                <input
                  type="number"
                  value={masterLabour}
                  onChange={(e) => setMasterLabour(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#38BDF8] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Assistant Labour/hr (R)</label>
                <input
                  type="number"
                  value={assistantLabour}
                  onChange={(e) => setAssistantLabour(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Travel Rate/km (R)</label>
                <input
                  type="number"
                  step="0.5"
                  value={travelRate}
                  onChange={(e) => setTravelRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#10B981] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Free Radius (km)</label>
                <input
                  type="number"
                  value={travelIncluded}
                  onChange={(e) => setTravelIncluded(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Material Markup %</label>
                <input
                  type="number"
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#38BDF8] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Backup & Restore Bar */}
      <div
        className={`p-4 md:p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono ${
          sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
        }`}
      >
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-[#F8FAFC] flex items-center space-x-2">
            <Database className="w-4 h-4 text-[#38BDF8]" />
            <span>OFFLINE DATABASE BACKUP & RESTORE</span>
          </h4>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            Export a full JSON snapshot of your quotations, invoices, and catalog for safe keeping or transfer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadBackup}
            className="px-3 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] hover:bg-[#2D3449] text-xs font-bold text-[#F8FAFC] uppercase flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Export Backup JSON</span>
          </button>

          <button
            onClick={() => setShowImportBox(!showImportBox)}
            className="px-3 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] hover:bg-[#2D3449] text-xs font-bold text-[#F8FAFC] uppercase flex items-center space-x-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Restore JSON</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset all data to initial factory demo seed?')) {
                resetToFactoryDefaults();
                alert('Database reset to factory demo seed.');
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-[#EF444422] border border-[#EF444455] text-[#EF4444] hover:bg-[#EF444433] text-xs font-bold uppercase flex items-center space-x-1 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Factory Reset</span>
          </button>
        </div>
      </div>

      {/* JSON Import Dialog */}
      {showImportBox && (
        <div className="p-4 rounded-xl bg-[#1B1E28] border border-[#334155] space-y-3 font-mono">
          <h4 className="font-bold text-xs uppercase text-[#38BDF8]">Paste Backup JSON Content</h4>
          <textarea
            rows={5}
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="Paste raw exported JSON here..."
            className="w-full p-2.5 rounded-lg bg-[#232838] border border-[#334155] font-mono text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowImportBox(false)}
              className="px-3 py-1.5 bg-[#232838] border border-[#334155] text-[#94A3B8] rounded-lg text-xs uppercase hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleImportSubmit}
              className="px-4 py-1.5 bg-[#38BDF8] text-[#1B1E28] font-bold rounded-lg text-xs uppercase hover:bg-[#7DD3FC]"
            >
              Apply Backup Restore
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

