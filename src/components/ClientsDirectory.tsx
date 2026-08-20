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
} from 'lucide-react';

export const ClientsDirectory: React.FC = () => {
  const { clients, addClient, updateClient, deleteClient, sunlightMode, setActiveTab } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);

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
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D2D30] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00FF41] text-black uppercase tracking-wider">
              FIELD CUSTOMER BASE
            </span>
            <span className="text-[11px] font-mono text-[#707070]">DIRECT WHATSAPP • PHONE DIAL • GPS NAV</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#FF6321]">
            Client Directory
          </h2>
          <p className="text-xs font-mono text-[#A0A0A5] mt-0.5">
            Manage residential & commercial property contacts, site locations, service histories, and quick communication.
          </p>
        </div>

        <button
          id="btn-add-new-client"
          onClick={() => setIsAddingClient(!isAddingClient)}
          className={`px-4 py-2 rounded font-mono font-bold text-xs uppercase flex items-center space-x-1.5 transition-all shadow ${
            isAddingClient
              ? 'bg-[#252528] text-[#A0A0A5] border border-[#2D2D30]'
              : sunlightMode
              ? 'bg-amber-400 text-black border-2 border-black font-extrabold'
              : 'bg-[#00FF41] hover:bg-[#00d636] text-black shadow-lg shadow-[#00FF4133]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{isAddingClient ? 'Cancel' : '+ Add New Client'}</span>
        </button>
      </div>

      {/* Add Client Drawer */}
      {isAddingClient && (
        <div
          className={`p-5 rounded border space-y-4 shadow-2xl ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#00FF41] flex items-center space-x-2 font-mono">
            <Users className="w-4 h-4 text-[#00FF41]" />
            <span>ADD NEW CLIENT / SITE LOCATION</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Full Name / Company *</label>
              <input
                type="text"
                placeholder="e.g. Pieter Marais"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold font-sans text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">WhatsApp / Phone *</label>
              <input
                type="text"
                placeholder="e.g. 083 456 7890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. pieter@example.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Physical Site Address *</label>
              <input
                type="text"
                placeholder="e.g. 14 Protea Crescent, Sandton, Johannesburg"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-sans text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Primary Service</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#007AFF] font-bold"
              >
                <option value="Electrical">Electrical</option>
                <option value="HVAC">HVAC+R</option>
                <option value="Solar">Solar & Inverters</option>
                <option value="Security">Security & CCTV</option>
                <option value="Consumables">Appliance / Maintenance</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-[#2D2D30] font-mono">
            <button
              onClick={() => setIsAddingClient(false)}
              className="px-3 py-1.5 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#A0A0A5] text-xs font-bold uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateClient}
              className="px-5 py-2 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold text-xs uppercase shadow-lg shadow-[#00FF4133]"
            >
              Save Client Profile
            </button>
          </div>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="relative font-mono">
        <Search className="w-3.5 h-3.5 text-[#707070] absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Search clients by name, phone, suburb, or street address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
        />
      </div>

      {/* Clients Grid */}
      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <div className="p-8 text-center text-[#707070] border border-dashed border-[#2D2D30] rounded text-xs font-mono uppercase">
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
                  className={`p-4 rounded border flex flex-col justify-between space-y-3 transition-all ${
                    sunlightMode
                      ? 'bg-white border-2 border-black text-black'
                      : 'bg-[#1A1A1C] border-[#2D2D30] text-[#E0E0E0]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1 font-mono">
                      <h4 className="font-bold text-sm text-[#E0E0E0] font-sans">{client.name}</h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0A0A0B] text-[#00FF41] border border-[#00FF4144]">
                        {client.serviceType}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-[#A0A0A5] font-mono mt-2">
                      <div className="flex items-center space-x-2 text-[#E0E0E0]">
                        <Phone className="w-3.5 h-3.5 text-[#007AFF]" />
                        <span className="font-bold">{client.phone}</span>
                      </div>

                      {client.email && (
                        <div className="flex items-center space-x-2 text-[#707070]">
                          <Mail className="w-3.5 h-3.5 text-[#707070]" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}

                      <div className="flex items-start space-x-2 text-[#707070] pt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#FF6321] flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{client.siteAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Contact & Action Bar */}
                  <div className="pt-2 border-t border-[#2D2D30] flex items-center justify-between font-mono">
                    <div className="flex items-center space-x-1.5">
                      {/* WhatsApp */}
                      <a
                        href={getWhatsAppShareLink(client.phone, waText)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded bg-[#25D366] text-black hover:bg-[#20ba59] text-xs font-bold flex items-center space-x-1 uppercase"
                        title="Open WhatsApp Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>

                      {/* Phone Dial */}
                      <a
                        href={`tel:${client.phone}`}
                        className="p-1.5 rounded bg-[#0A0A0B] text-[#007AFF] border border-[#2D2D30] hover:bg-[#252528]"
                        title="Dial Phone"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>

                      {/* Google Maps GPS Nav */}
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-[#0A0A0B] text-[#FF6321] border border-[#2D2D30] hover:bg-[#252528]"
                        title="Navigate in Google Maps"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteClient(client.id)}
                      className="p-1.5 text-[#707070] hover:text-[#FF4444]"
                      title="Delete client"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
