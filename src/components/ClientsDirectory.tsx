import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Client } from '../types';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Search,
  X,
  Check,
  Smartphone,
  Globe,
  UploadCloud,
  Eye,
  Navigation,
} from 'lucide-react';
import { VoiceDictationButton } from './VoiceDictationButton';
import { ContactImportModal } from './ContactImportModal';
import { Client360Modal } from './Client360Modal';

export const ClientsDirectory: React.FC = () => {
  const { clients, addClient, addBulkClients, updateClient, deleteClient, sunlightMode } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [selected360Client, setSelected360Client] = useState<Client | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const handleImportContacts = (newClientsData: Omit<Client, 'id'>[]) => {
    const importedCount = addBulkClients(newClientsData);
    showNotice(`Successfully imported ${importedCount} client(s) into your directory!`);
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAdd = () => {
    setEditingClientId(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditingClientId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setAddress(c.address);
    setNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name || !phone) {
      alert('Please fill in name and phone number.');
      return;
    }

    if (editingClientId) {
      updateClient(editingClientId, {
        name,
        phone,
        email,
        address,
        notes,
      });
    } else {
      addClient({
        name,
        phone,
        email,
        address,
        notes,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>Customer Directory</span>
            <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
              {clients.length} Registered
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Maintain residential and commercial client profiles, service history, and direct WhatsApp communication.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-sky-400 border border-sky-500/30 font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
            title="Import from Google Contacts or Android phone address book"
          >
            <Globe className="w-4 h-4 text-sky-400" />
            <span>Import Contacts</span>
          </button>

          <button
            onClick={openAdd}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-sky-600/20 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Client</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by client name, mobile number, or street address..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1B1E28] border border-[#282E3E] text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const cleanPhone = client.phone.replace(/[^0-9]/g, '');
          const waUrl = `https://wa.me/${cleanPhone.startsWith('0') ? '27' + cleanPhone.slice(1) : cleanPhone}`;

          return (
            <div
              key={client.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                sunlightMode
                  ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                  : 'bg-[#1B1E28] border-[#282E3E] text-white hover:border-[#334155]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-base text-white">{client.name}</h3>
                    {client.notes && (
                      <span className="text-[10px] text-amber-400 font-mono block mt-0.5">
                        {client.notes}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => openEdit(client)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-[#282E3E]"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${client.name}?`)) {
                          deleteClient(client.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                  {client.email && (
                    <div className="flex items-center space-x-2 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  <div className="flex items-start space-x-2 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{client.address}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions: 360 View & WhatsApp */}
              <div className="pt-4 mt-3 border-t border-[#282E3E]/60 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelected360Client(client)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold flex items-center space-x-1 border border-slate-700 transition-colors cursor-pointer"
                  title="View 360° Client Profile, Invoices & Jobs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>360° Profile</span>
                </button>

                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          );
        })}

        {filteredClients.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-2xl border border-dashed border-[#334155] text-slate-400 text-xs">
            No clients matching "{searchTerm}".
          </div>
        )}
      </div>

      {/* Modal for Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#282E3E]">
              <h3 className="font-bold text-white text-base">
                {editingClientId ? 'Edit Client Profile' : 'Add New Client'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sipho Dlamini"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Phone Number (WhatsApp) *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +27 71 234 5678"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sipho@email.com"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Site / Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 15 Protea Road, Bellville, Cape Town"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-400 font-mono uppercase font-bold">Service Notes / Property Info</label>
                  <VoiceDictationButton
                    onTranscript={(text) => setNotes((prev) => (prev ? prev + ' ' + text : text))}
                  />
                </div>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Single-phase 60A DB board, dog on premises"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-[#282E3E]">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#282E3E] text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20"
              >
                Save Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback Notice */}
      {feedbackNotice && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xl border border-emerald-400 animate-in fade-in slide-in-from-bottom-2 flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Google Contacts & Android Phonebook Import Modal */}
      <ContactImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportContacts}
        existingClients={clients}
      />

      {/* 360° Client Profile Modal */}
      <Client360Modal
        client={selected360Client}
        isOpen={!!selected360Client}
        onClose={() => setSelected360Client(null)}
      />
    </div>
  );
};
