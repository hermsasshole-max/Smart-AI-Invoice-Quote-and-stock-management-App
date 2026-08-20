import React, { useState } from 'react';
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

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  // Local form state
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [regNumber, setRegNumber] = useState(profile.registrationNumber || '');
  const [vatNumber, setVatNumber] = useState(profile.vatNumber || '');

  // Banking
  const [bankName, setBankName] = useState(profile.bankName);
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

  const handleSaveAll = () => {
    updateProfile({
      companyName,
      email,
      phone,
      address,
      registrationNumber: regNumber,
      vatNumber,
      bankName,
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
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D2D30] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF6321] text-black uppercase tracking-wider">
              CONTRACTOR PROFILE & TRADE RATES
            </span>
            <span className="text-[11px] font-mono text-[#707070]">SOUTH AFRICAN BUSINESS CONFIGURATION</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#FF6321]">
            Settings & Rate Cards
          </h2>
          <p className="text-xs font-mono text-[#A0A0A5] mt-0.5">
            Customize company header, banking details for EFT invoice settlements, labour and travel rate parameters, and backup offline database.
          </p>
        </div>

        <button
          id="btn-save-settings"
          onClick={handleSaveAll}
          className="px-5 py-2 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold text-xs uppercase flex items-center space-x-2 shadow-lg shadow-[#00FF4133] font-mono"
        >
          <CheckCircle className="w-4 h-4" />
          <span>SAVE CONFIGURATION</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-[#00FF4111] border border-[#00FF4144] text-[#00FF41] rounded flex items-center space-x-2 text-xs font-mono font-bold">
          <CheckCircle className="w-4 h-4 text-[#00FF41]" />
          <span>Settings, rate parameters, and banking details saved successfully!</span>
        </div>
      )}

      {/* Grid: 3 Main Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Business Profile */}
        <div
          className={`p-5 rounded border space-y-4 ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#00FF41] flex items-center space-x-2 font-mono">
            <Building className="w-4 h-4 text-[#00FF41]" />
            <span>BUSINESS INFORMATION</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold font-sans text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Account / Dispatch Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Business Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-sans text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Company Reg #</label>
                <input
                  type="text"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">VAT #</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: South African Banking Details (For EFTs) */}
        <div
          className={`p-5 rounded border space-y-4 ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#007AFF] flex items-center space-x-2 font-mono">
            <CreditCard className="w-4 h-4 text-[#007AFF]" />
            <span>BANKING DETAILS (FOR INVOICE EFTS)</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#00FF41] font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Branch Code</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Account Type</label>
                <input
                  type="text"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>
            </div>

            <div className="p-3 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[10px] text-[#707070] font-mono">
              Clients receive these banking details with their quote & invoice PDFs and WhatsApp links for instant EFT payment.
            </div>
          </div>
        </div>

        {/* Card 3: Standard Trade Rates & Multipliers */}
        <div
          className={`p-5 rounded border space-y-4 ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#FF6321] flex items-center space-x-2 font-mono">
            <Sliders className="w-4 h-4 text-[#FF6321]" />
            <span>STANDARD TRADE RATES (ZAR R)</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Call-Out Base (R)</label>
                <input
                  type="number"
                  value={callout}
                  onChange={(e) => setCallout(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#FF6321] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Master Labour/hr (R)</label>
                <input
                  type="number"
                  value={masterLabour}
                  onChange={(e) => setMasterLabour(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#00FF41] font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Assistant Labour/hr (R)</label>
                <input
                  type="number"
                  value={assistantLabour}
                  onChange={(e) => setAssistantLabour(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Travel Rate/km (R)</label>
                <input
                  type="number"
                  step="0.5"
                  value={travelRate}
                  onChange={(e) => setTravelRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#007AFF] font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Free Radius (km)</label>
                <input
                  type="number"
                  value={travelIncluded}
                  onChange={(e) => setTravelIncluded(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Material Markup %</label>
                <input
                  type="number"
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#00FF41] font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Backup & Restore Bar */}
      <div
        className={`p-4 md:p-5 rounded border flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono ${
          sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
        }`}
      >
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-[#E0E0E0] flex items-center space-x-2">
            <Database className="w-4 h-4 text-[#00FF41]" />
            <span>OFFLINE DATABASE BACKUP & RESTORE</span>
          </h4>
          <p className="text-[11px] text-[#707070] mt-0.5">
            Export a full JSON snapshot of your quotations, invoices, and catalog for safe keeping or transfer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadBackup}
            className="px-3 py-1.5 rounded bg-[#0A0A0B] border border-[#2D2D30] hover:bg-[#252528] text-xs font-bold text-[#E0E0E0] uppercase flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#00FF41]" />
            <span>Export Backup JSON</span>
          </button>

          <button
            onClick={() => setShowImportBox(!showImportBox)}
            className="px-3 py-1.5 rounded bg-[#0A0A0B] border border-[#2D2D30] hover:bg-[#252528] text-xs font-bold text-[#E0E0E0] uppercase flex items-center space-x-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>Restore JSON</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset all data to initial factory demo seed?')) {
                resetToFactoryDefaults();
                alert('Database reset to factory demo seed.');
              }
            }}
            className="px-3 py-1.5 rounded bg-[#FF444422] border border-[#FF444455] text-[#FF4444] hover:bg-[#FF444433] text-xs font-bold uppercase flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Factory Reset</span>
          </button>
        </div>
      </div>

      {/* JSON Import Dialog */}
      {showImportBox && (
        <div className="p-4 rounded bg-[#0A0A0B] border border-[#2D2D30] space-y-3 font-mono">
          <h4 className="font-bold text-xs uppercase text-[#007AFF]">Paste Backup JSON Content</h4>
          <textarea
            rows={5}
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="Paste raw exported JSON here..."
            className="w-full p-2.5 rounded bg-[#111113] border border-[#2D2D30] font-mono text-xs text-[#E0E0E0]"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowImportBox(false)}
              className="px-3 py-1.5 bg-[#1A1A1C] border border-[#2D2D30] text-[#A0A0A5] rounded text-xs uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleImportSubmit}
              className="px-4 py-1.5 bg-[#007AFF] text-white font-bold rounded text-xs uppercase hover:bg-[#0062cc]"
            >
              Apply Backup Restore
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
