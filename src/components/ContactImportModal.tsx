import React, { useState, useEffect, useRef } from 'react';
import {
  GoogleContactParsed,
  loadGoogleGsiScript,
  requestGoogleContactsToken,
  fetchGooglePeopleContacts,
  isNativeContactPickerSupported,
  pickNativeDeviceContacts,
  parseVCardFileContent,
} from '../services/googleContactsService';
import { Client } from '../types';
import {
  X,
  Smartphone,
  Check,
  Search,
  Users,
  AlertCircle,
  Loader2,
  RefreshCw,
  Upload,
  UserCheck,
  FileSpreadsheet,
  Globe,
  Sparkles,
} from 'lucide-react';

interface ContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newClients: Omit<Client, 'id'>[]) => void;
  existingClients: Client[];
}

export const ContactImportModal: React.FC<ContactImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingClients,
}) => {
  const [activeTab, setActiveTab] = useState<'google' | 'android' | 'vcf'>('google');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [contacts, setContacts] = useState<GoogleContactParsed[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasFetched, setHasFetched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const existingPhoneSet = new Set(
    existingClients.map((c) => c.phone.replace(/[^0-9]/g, '')).filter(Boolean)
  );

  useEffect(() => {
    if (isOpen) {
      loadGoogleGsiScript().catch(() => {});
    } else {
      setContacts([]);
      setErrorMsg(null);
      setSuccessMsg(null);
      setHasFetched(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFetchGoogleContacts = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const token = await requestGoogleContactsToken();
      const fetched = await fetchGooglePeopleContacts(token);
      if (fetched.length === 0) {
        setErrorMsg('No contacts found in your Google Account or no permissions granted.');
      } else {
        setContacts(fetched);
        setHasFetched(true);
        setSuccessMsg(`Successfully retrieved ${fetched.length} contacts from Google People API!`);
      }
    } catch (err: any) {
      console.error('Google Contacts Error:', err);
      setErrorMsg(err.message || 'Failed to authenticate or fetch Google Contacts. Please check your popup blocker.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickNativeAndroidContacts = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (!isNativeContactPickerSupported()) {
        throw new Error('Your browser does not support the native Android Contact Picker. Please use Google Account Sync or export a .VCF contact file.');
      }
      const picked = await pickNativeDeviceContacts();
      if (picked.length > 0) {
        setContacts((prev) => [...picked, ...prev]);
        setHasFetched(true);
        setSuccessMsg(`Selected ${picked.length} contact(s) from phone address book!`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not access device contacts.');
    } finally {
      setLoading(false);
    }
  };

  const handleVcfFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseVCardFileContent(text);
        if (parsed.length === 0) {
          setErrorMsg('No valid contacts found in this .VCF contact backup file.');
        } else {
          setContacts((prev) => [...parsed, ...prev]);
          setHasFetched(true);
          setSuccessMsg(`Parsed ${parsed.length} contacts from ${file.name}!`);
        }
      } catch (err: any) {
        setErrorMsg(`Failed to parse VCF file: ${err.message}`);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the selected file.');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const toggleSelectContact = (index: number) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  };

  const toggleSelectAll = (select: boolean) => {
    setContacts((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  const selectedCount = contacts.filter((c) => c.selected).length;

  const handleFinalImport = () => {
    const selected = contacts.filter((c) => c.selected);
    if (selected.length === 0) {
      alert('Please select at least one contact to import.');
      return;
    }

    const newClientsData: Omit<Client, 'id'>[] = selected.map((c) => {
      let formattedAddress = c.address || '';
      return {
        name: c.name.trim() || 'Client',
        phone: c.phone.trim() || '082 000 0000',
        email: c.email?.trim() || undefined,
        address: formattedAddress || 'Client Site / Address to be confirmed',
        company: c.company || undefined,
        notes: c.jobTitle ? `Title: ${c.jobTitle} (Imported from Contacts)` : 'Imported from Contacts',
      };
    });

    onImport(newClientsData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#151722] border-b border-[#282E3E] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <span>Import Phone & Google Contacts</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                  Google Workspace
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Instantly sync clients from Google Contacts, Android phonebook, or vCard (.VCF) files.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#282E3E] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Switcher Tabs */}
        <div className="flex border-b border-[#282E3E] bg-[#12141C] px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'google'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Google Contacts API</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'android'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android Phonebook</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vcf')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'vcf'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>vCard (.VCF) Backup</span>
          </button>
        </div>

        {/* Action / Connect Strip */}
        <div className="p-4 bg-[#181B26] border-b border-[#282E3E] space-y-3">
          {activeTab === 'google' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-sky-950/30 border border-sky-500/30 p-3.5 rounded-xl">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sync Directly via Google People API</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Connect your Google account to fetch names, mobile numbers, email addresses, and locations.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFetchGoogleContacts}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-sky-600/20 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                <span>{hasFetched ? 'Re-Sync Google Contacts' : 'Authorize & Fetch Contacts'}</span>
              </button>
            </div>
          )}

          {activeTab === 'android' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-950/30 border border-emerald-500/30 p-3.5 rounded-xl">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Select from Phone Address Book</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select residential or commercial client numbers directly from your Android phone.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePickNativeAndroidContacts}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                <span>Open Phone Contact Picker</span>
              </button>
            </div>
          )}

          {activeTab === 'vcf' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-950/30 border border-amber-500/30 p-3.5 rounded-xl">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Import from Contacts Backup File</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Exported contacts from Android or iPhone (.vcf file format) can be loaded offline.
                </p>
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".vcf,.vcard"
                  onChange={handleVcfFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload .VCF File</span>
                </button>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Contacts List & Selector */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {contacts.length > 0 ? (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search retrieved contacts..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#282E3E] text-slate-300 hover:text-white text-xs font-semibold"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#282E3E] text-slate-300 hover:text-white text-xs font-semibold"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredContacts.map((contact, idx) => {
                  const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
                  const alreadyExists = cleanPhone ? existingPhoneSet.has(cleanPhone) : false;

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleSelectContact(idx)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 select-none ${
                        contact.selected
                          ? 'bg-[#182635] border-sky-500/60 shadow-sm'
                          : 'bg-[#141722] border-[#282E3E] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!contact.selected}
                        onChange={() => {}}
                        className="mt-1 rounded text-sky-500 focus:ring-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-white text-xs truncate">{contact.name}</h4>
                          {alreadyExists && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                              Already in directory
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                          📞 {contact.phone || 'No phone'}
                        </div>
                        {contact.email && (
                          <div className="text-[10px] text-slate-500 truncate">
                            ✉️ {contact.email}
                          </div>
                        )}
                        {contact.address && (
                          <div className="text-[10px] text-slate-500 truncate">
                            📍 {contact.address}
                          </div>
                        )}
                        {contact.company && (
                          <div className="text-[10px] text-sky-400/80 truncate">
                            🏢 {contact.company}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-12 text-center rounded-2xl border border-dashed border-[#334155] text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#282E3E]/60 mx-auto flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-300">No contacts loaded yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click the authorization button above to connect your Google Contacts or pick directly from your Android phone address book.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="px-6 py-4 bg-[#151722] border-t border-[#282E3E] flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            {selectedCount} contact{selectedCount === 1 ? '' : 's'} selected for import
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#282E3E] text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinalImport}
              disabled={selectedCount === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-sky-600/20 cursor-pointer disabled:opacity-40 active:scale-95"
            >
              <UserCheck className="w-4 h-4" />
              <span>Import Selected ({selectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
