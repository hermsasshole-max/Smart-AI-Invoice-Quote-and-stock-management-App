import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Client, ServiceCategory } from '../types';
import { getWhatsAppShareLink } from '../utils/calculator';
import {
  Users,
  Plus,
  Search,
  Phone,
  MessageSquare,
  MapPin,
  Mail,
  FileText,
  Trash2,
  Edit2,
  Calendar,
  ExternalLink,
  Shield,
  Zap,
  X,
  AlertTriangle,
} from 'lucide-react';

export const ClientsDirectory: React.FC = () => {
  const { clients, addClient, updateClient, deleteClient, sunlightMode, setActiveTab } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [serviceType, setServiceType] = useState<ServiceCategory>('Electrical');
  const [notes, setNotes] = useState('');

  const handleCreateClient = () => {
    if (!name.trim() || !phone.trim()) {
      alert('Please enter client name and contact phone number.');
      return;
    }

    addClient({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      siteAddress: siteAddress.trim() || 'Site Address TBD',
      serviceType,
      notes: notes.trim(),
    });

    setIsAddingClient(false);
    setName('');
    setPhone('');
    setEmail('');
    setSiteAddress('');
    setNotes('');
  };

  const handleSaveEdit = (c: Client) => {
    if (!c.name.trim() || !c.phone.trim()) {
      alert('Client name and phone number cannot be empty.');
      return;
    }
    updateClient(c.id, c);
    setEditingClient(null);
  };

  const filteredClients = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.siteAddress.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#F8FAFC]'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#334155] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#38BDF8] text-[#1B1E28] uppercase tracking-wider">
              FIELD CUSTOMER BASE
            </span>
            <span className="text-[11px] font-mono text-[#94A3B8]">DIRECT WHATSAPP • PHONE DIAL • GPS NAV</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-white">
            Client Directory
          </h2>
          <p className="text-xs font-mono text-[#94A3B8] mt-0.5">
            Full client profile management, site addresses, service categories, WhatsApp triggers, and GPS navigation.
          </p>
        </div>

        <button
          id="btn-add-new-client"
          onClick={() => setIsAddingClient(!isAddingClient)}
          className={`px-4 py-2 rounded-lg font-mono font-bold text-xs uppercase flex items-center space-x-1.5 transition-all shadow ${
            isAddingClient
              ? 'bg-[#232838] text-[#94A3B8] border border-[#334155]'
              : sunlightMode
              ? 'bg-amber-400 text-black border-2 border-black font-extrabold'
              : 'bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#1B1E28] shadow-lg shadow-[#38BDF833]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{isAddingClient ? 'Cancel' : '+ Add New Client'}</span>
        </button>
      </div>

      {/* Add Client Drawer */}
      {isAddingClient && (
        <div
          className={`p-5 rounded-2xl border space-y-4 shadow-2xl ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#38BDF8] flex items-center space-x-2 font-mono">
            <Users className="w-4 h-4 text-[#38BDF8]" />
            <span>ADD NEW CLIENT / SITE LOCATION</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Full Name / Company *</label>
              <input
                type="text"
                placeholder="e.g. Pieter Marais"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold font-sans text-xs focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">WhatsApp / Phone *</label>
              <input
                type="text"
                placeholder="e.g. 083 456 7890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. pieter@example.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Physical Site Address *</label>
              <input
                type="text"
                placeholder="e.g. 14 Protea Crescent, Sandton, Johannesburg"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-sans text-xs focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Primary Trade</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#38BDF8] font-bold focus:border-[#38BDF8] focus:outline-none"
              >
                <option value="Electrical">Electrical</option>
                <option value="HVAC">HVAC+R</option>
                <option value="Solar">Solar & Inverters</option>
                <option value="Refrigeration">Refrigeration</option>
                <option value="Security">Security & CCTV</option>
                <option value="Consumables">Appliance / Maintenance</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-[#334155] font-mono">
            <button
              onClick={() => setIsAddingClient(false)}
              className="px-3 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#94A3B8] text-xs font-bold uppercase hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateClient}
              className="px-5 py-2 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#1B1E28] font-bold text-xs uppercase shadow-lg shadow-[#10B98133]"
            >
              Save Client Profile
            </button>
          </div>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="relative font-mono">
        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Search clients by name, phone, suburb, or street address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-[#232838] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
        />
      </div>

      {/* Clients Grid */}
      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <div className="p-8 text-center text-[#94A3B8] border border-dashed border-[#334155] rounded-xl text-xs font-mono uppercase">
            No clients found matching "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredClients.map((client) => {
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.siteAddress)}`;
              const waText = `Hi ${client.name}, this is Harry from Harrys Aircon Electrical and Solar Services. How can I assist you with your ${client.serviceType} system today?`;

              return (
                <div
                  key={client.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                    sunlightMode
                      ? 'bg-white border-2 border-black text-black'
                      : 'bg-[#232838] border-[#334155] text-[#F8FAFC] hover:border-[#38BDF8]/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1 font-mono">
                      <h4 className="font-bold text-sm text-white font-sans">{client.name}</h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1B1E28] text-[#38BDF8] border border-[#38BDF8]/30">
                        {client.serviceType}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-[#94A3B8] font-mono mt-2">
                      <div className="flex items-center space-x-2 text-[#F8FAFC]">
                        <Phone className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span className="font-bold">{client.phone}</span>
                      </div>

                      {client.email && (
                        <div className="flex items-center space-x-2 text-[#94A3B8]">
                          <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}

                      <div className="flex items-start space-x-2 text-[#94A3B8] pt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{client.siteAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Contact & Action Bar */}
                  <div className="pt-2 border-t border-[#334155] flex items-center justify-between font-mono">
                    <div className="flex items-center space-x-1.5">
                      {/* WhatsApp */}
                      <a
                        href={getWhatsAppShareLink(client.phone, waText)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-black hover:bg-[#20ba59] text-xs font-bold flex items-center space-x-1 uppercase shadow-sm"
                        title="Open WhatsApp Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>

                      {/* Phone Dial */}
                      <a
                        href={`tel:${client.phone}`}
                        className="p-1.5 rounded-lg bg-[#1B1E28] text-[#38BDF8] border border-[#334155] hover:bg-[#232838] hover:border-[#38BDF8]"
                        title="Dial Phone"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>

                      {/* Google Maps GPS Nav */}
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[#1B1E28] text-[#F59E0B] border border-[#334155] hover:bg-[#232838] hover:border-[#F59E0B]"
                        title="Navigate in Google Maps"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="flex items-center space-x-1">
                      {/* Edit Client */}
                      <button
                        onClick={() => setEditingClient(JSON.parse(JSON.stringify(client)))}
                        className="p-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#94A3B8] hover:text-[#38BDF8] hover:border-[#38BDF8]"
                        title="Edit Client Profile"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteConfirmId(client.id)}
                        className="p-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] hover:border-red-500/40 text-[#94A3B8] hover:text-red-400"
                        title="Delete client"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-5 rounded-2xl bg-[#232838] border border-[#334155] shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#38BDF8]" />
                <h3 className="font-bold text-sm text-white uppercase">Edit Client Profile</h3>
              </div>
              <button onClick={() => setEditingClient(null)} className="text-[#94A3B8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Full Name / Company *</label>
                <input
                  type="text"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Phone (WhatsApp) *</label>
                  <input
                    type="text"
                    value={editingClient.phone}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Email</label>
                  <input
                    type="email"
                    value={editingClient.email || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Physical Site Address</label>
                <input
                  type="text"
                  value={editingClient.siteAddress}
                  onChange={(e) => setEditingClient({ ...editingClient, siteAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Primary Trade Category</label>
                <select
                  value={editingClient.serviceType}
                  onChange={(e) => setEditingClient({ ...editingClient, serviceType: e.target.value as ServiceCategory })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#38BDF8] font-bold focus:border-[#38BDF8] focus:outline-none"
                >
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC+R</option>
                  <option value="Solar">Solar & Inverters</option>
                  <option value="Refrigeration">Refrigeration</option>
                  <option value="Security">Security & CCTV</option>
                  <option value="Consumables">Appliance / Maintenance</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Notes / Site Access Details</label>
                <textarea
                  rows={2}
                  value={editingClient.notes || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                  placeholder="Gate code, DB location, dogs on property, etc."
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#334155]">
              <button
                onClick={() => setEditingClient(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1B1E28] text-[#94A3B8] hover:text-white border border-[#334155]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(editingClient)}
                className="px-5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#1B1E28] font-bold uppercase shadow"
              >
                Save Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-5 rounded-2xl bg-[#232838] border border-red-500/40 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase">Delete Client Profile</h3>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Are you sure you want to delete this client? Past invoices and quotations referencing this client will remain in record.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1B1E28] text-xs text-[#94A3B8] hover:text-white border border-[#334155]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteClient(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase shadow"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
