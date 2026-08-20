import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem } from '../types';
import { formatZAR, calculateSellingPrice } from '../utils/calculator';
import {
  Package,
  Plus,
  Trash2,
  Edit2,
  Search,
  AlertCircle,
  TrendingUp,
  X,
  Check,
} from 'lucide-react';

export const InventoryManager: React.FC = () => {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, profile, sunlightMode } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Electrical' | 'Air Conditioning' | 'Solar & Backup' | 'Security & CCTV' | 'Hardware'>('Electrical');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [defaultMarkup, setDefaultMarkup] = useState<number>(35);
  const [unit, setUnit] = useState('ea');
  const [stockQty, setStockQty] = useState<number>(10);
  const [minStockLevel, setMinStockLevel] = useState<number>(2);
  const [supplier, setSupplier] = useState('Voltex');

  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const openAdd = () => {
    setEditingId(null);
    setSku('SKU-' + Math.floor(1000 + Math.random() * 9000));
    setName('');
    setCategory('Electrical');
    setCostPrice(100);
    setDefaultMarkup(profile.defaultMarkup || 35);
    setUnit('ea');
    setStockQty(10);
    setMinStockLevel(2);
    setSupplier('Voltex');
    setIsModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category as any);
    setCostPrice(item.costPrice);
    setDefaultMarkup(item.defaultMarkup);
    setUnit(item.unit);
    setStockQty(item.stockQty);
    setMinStockLevel(item.minStockLevel);
    setSupplier(item.supplier || '');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name || costPrice <= 0) {
      alert('Please provide valid name and cost price.');
      return;
    }

    const sellingPrice = calculateSellingPrice(costPrice, defaultMarkup);

    if (editingId) {
      updateInventoryItem(editingId, {
        sku,
        name,
        category,
        costPrice,
        defaultMarkup,
        sellingPrice,
        unit,
        stockQty,
        minStockLevel,
        supplier,
      });
    } else {
      addInventoryItem({
        sku,
        name,
        category,
        costPrice,
        defaultMarkup,
        sellingPrice,
        unit,
        stockQty,
        minStockLevel,
        supplier,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>Van Stock & Materials Catalog</span>
            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 font-mono">
              {inventory.length} SKUs
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track wholesale trade cost prices, tiered contractor markups, and reorder levels across service vehicles.
          </p>
        </div>

        <button
          onClick={openAdd}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-sky-600/20 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Catalog Item</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by part name, SKU, or supplier..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1B1E28] border border-[#282E3E] text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#1B1E28] border border-[#282E3E] text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-sky-500"
        >
          <option value="All">All Categories</option>
          <option value="Electrical">Electrical</option>
          <option value="Air Conditioning">Air Conditioning</option>
          <option value="Solar & Backup">Solar & Backup</option>
          <option value="Security & CCTV">Security & CCTV</option>
          <option value="Hardware">Hardware</option>
        </select>
      </div>

      {/* Inventory Table */}
      <div className={`rounded-2xl border overflow-hidden ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#12141C] text-slate-400 font-mono uppercase text-[10px] border-b border-[#282E3E]">
                <th className="p-3.5">SKU & Item Description</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Supplier</th>
                <th className="p-3.5 text-right">Cost Price (Excl)</th>
                <th className="p-3.5 text-center">Markup</th>
                <th className="p-3.5 text-right">Selling Rate</th>
                <th className="p-3.5 text-center">Van Stock</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282E3E]">
              {filteredItems.map((item) => {
                const isLow = item.stockQty <= item.minStockLevel;

                return (
                  <tr key={item.id} className="hover:bg-[#151824] transition-all">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-sm">{item.name}</div>
                      <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400 font-medium">{item.supplier || 'N/A'}</td>
                    <td className="p-3.5 text-right font-mono text-slate-300 font-semibold">
                      {formatZAR(item.costPrice)}
                    </td>
                    <td className="p-3.5 text-center font-mono text-amber-400 font-bold">
                      +{item.defaultMarkup}%
                    </td>
                    <td className="p-3.5 text-right font-mono text-emerald-400 font-black text-sm">
                      {formatZAR(item.sellingPrice)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center space-x-1 font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          isLow
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {isLow && <AlertCircle className="w-3 h-3" />}
                        <span>
                          {item.stockQty} {item.unit}
                        </span>
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex justify-end space-x-1.5">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-[#282E3E]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${item.name}?`)) {
                              deleteInventoryItem(item.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-xs">
            No inventory items match your filter criteria.
          </div>
        )}
      </div>

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#282E3E]">
              <h3 className="font-bold text-white text-base">
                {editingId ? 'Edit Inventory Item' : 'Add New Inventory SKU'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">SKU Code</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
                  >
                    <option value="Electrical">Electrical</option>
                    <option value="Air Conditioning">Air Conditioning</option>
                    <option value="Solar & Backup">Solar & Backup</option>
                    <option value="Security & CCTV">Security & CCTV</option>
                    <option value="Hardware">Hardware</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Item Description *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alliance 12000 BTU Inverter Split Unit"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Cost Price (ZAR) *</label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-amber-400 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Markup (%)</label>
                  <input
                    type="number"
                    value={defaultMarkup}
                    onChange={(e) => setDefaultMarkup(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#12141C] border border-[#282E3E] flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono">Calculated Selling Price:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {formatZAR(calculateSellingPrice(costPrice, defaultMarkup))}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="ea, m, roll"
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">In Van</label>
                  <input
                    type="number"
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Min Stock</label>
                  <input
                    type="number"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Supplier</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Voltex, ARB, Plumblink, ACDC Express"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
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
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
