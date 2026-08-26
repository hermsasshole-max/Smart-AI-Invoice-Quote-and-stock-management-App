import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem } from '../types';
import { formatZAR, calculateSellingPrice } from '../utils/calculator';
import { ReceiptScannerModal } from './ReceiptScannerModal';
import { entitlementManager } from '../services/EntitlementManager';
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
  Scan,
} from 'lucide-react';

export const InventoryManager: React.FC = () => {
  const {
    inventory,
    addInventoryItem,
    addBulkInventory,
    updateInventoryItem,
    deleteInventoryItem,
    profile,
    sunlightMode,
    openPaywall,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [bulkJson, setBulkJson] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Hardware & Site Materials');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [defaultMarkup, setDefaultMarkup] = useState<number>(35);
  const [unit, setUnit] = useState('box');
  const [stockQty, setStockQty] = useState<number>(10);
  const [minStockLevel, setMinStockLevel] = useState<number>(2);
  const [supplier, setSupplier] = useState('Bolt & Nut Centre');
  const [notes, setNotes] = useState('');

  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat =
      filterCategory === 'All' ||
      item.category === filterCategory ||
      (filterCategory === 'Hardware & Site Materials' && (item.category === 'Hardware & Site Materials' || item.category === 'Hardware & Fasteners' || item.category === 'Hardware'));
    return matchesSearch && matchesCat;
  });

  const openAdd = () => {
    const check = entitlementManager.canAddInventoryItem(inventory.length);
    if (!check.allowed) {
      openPaywall(check.reason);
      return;
    }

    setEditingId(null);
    setSku('FAST-' + Math.floor(1000 + Math.random() * 9000));
    setName('');
    setCategory('Hardware & Site Materials');
    setCostPrice(100);
    setDefaultMarkup(profile.defaultMarkup || 35);
    setUnit('box');
    setStockQty(10);
    setMinStockLevel(2);
    setSupplier('Bolt & Nut Centre');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category);
    setCostPrice(item.costPrice);
    setDefaultMarkup(item.defaultMarkup);
    setUnit(item.unit);
    setStockQty(item.stockQty);
    setMinStockLevel(item.minStockLevel);
    setSupplier(item.supplier || '');
    setNotes(item.notes || '');
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
        category: category as any,
        costPrice,
        defaultMarkup,
        sellingPrice,
        unit,
        stockQty,
        minStockLevel,
        supplier,
        notes,
      });
    } else {
      addInventoryItem({
        sku,
        name,
        category: category as any,
        costPrice,
        defaultMarkup,
        sellingPrice,
        unit,
        stockQty,
        minStockLevel,
        supplier,
        notes,
      });
    }

    setIsModalOpen(false);
  };

  const handleBulkImport = () => {
    try {
      setBulkError('');
      const data = JSON.parse(bulkJson);
      if (!Array.isArray(data)) {
        throw new Error('Input must be a JSON array of items.');
      }
      
      const newItems: Omit<InventoryItem, 'id'>[] = data.map((item: any, idx: number) => {
        if (!item.item_name && !item.name) throw new Error(`Item at index ${idx} missing name/item_name.`);
        
        const costPrice = Number(item.unit_price) || Number(item.costPrice) || Number(item.cost_price) || 0;
        const defaultMarkup = item.defaultMarkup || 35;
        
        return {
          sku: item.sku || `BULK-${idx}`,
          name: item.item_name || item.name || 'Unknown Item',
          category: item.category || 'Hardware & Site Materials',
          costPrice,
          defaultMarkup,
          sellingPrice: calculateSellingPrice(costPrice, defaultMarkup),
          unit: item.unit || 'ea',
          stockQty: item.stockQty || item.quantity || 0,
          minStockLevel: item.minStockLevel || item.minStock || 0,
          supplier: item.supplier || '',
          notes: item.description || item.specifications ? `${item.description || ''} ${item.specifications || ''}`.trim() : (item.notes || '')
        };
      });
      
      addBulkInventory(newItems);
      setIsBulkModalOpen(false);
      setBulkJson('');
    } catch (e: any) {
      setBulkError(e.message || 'Failed to parse JSON. Please ensure it is valid.');
    }
  };

  const handleAdjustQty = (id: string, delta: number) => {
    const item = inventory.find((i) => i.id === id);
    if (item) {
      const newQty = Math.max(0, item.stockQty + delta);
      updateInventoryItem(id, { stockQty: newQty });
    }
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

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
            title="Scan supplier receipt using AI OCR to add materials to stock"
          >
            <Scan className="w-4 h-4 text-slate-950" />
            <span>Scan Slip to Stock</span>
          </button>
          <button
            onClick={() => {
              setBulkJson('');
              setBulkError('');
              setIsBulkModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md cursor-pointer active:scale-95"
          >
            <Package className="w-4 h-4" />
            <span>Bulk Import</span>
          </button>
          <button
            onClick={openAdd}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-sky-600/20 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Catalog Item</span>
          </button>
        </div>
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
          <option value="Hardware & Site Materials">Hardware & Site Materials / Fasteners</option>
          <option value="Electrical">Electrical</option>
          <option value="Air Conditioning">Air Conditioning</option>
          <option value="Solar & Backup">Solar & Backup</option>
          <option value="Security & CCTV">Security & CCTV</option>
          <option value="Automation & Gate Motors">Automation & Gate Motors</option>
          <option value="Consumables">Consumables</option>
        </select>
      </div>

      {/* Inventory Table */}
      <div className={`rounded-2xl border overflow-hidden ${sunlightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#1B1E28] border-[#282E3E] text-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`${sunlightMode ? 'bg-slate-100 text-slate-700' : 'bg-[#12141C] text-slate-400'} font-mono uppercase text-[10px] border-b border-[#282E3E]`}>
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
            <tbody className={`divide-y ${sunlightMode ? 'divide-slate-200' : 'divide-[#282E3E]'}`}>
              {filteredItems.map((item) => {
                const isLow = item.stockQty <= item.minStockLevel;

                return (
                  <tr key={item.id} className={`${sunlightMode ? 'hover:bg-slate-50' : 'hover:bg-[#151824]'} transition-all`}>
                    <td className="p-3.5">
                      <div className={`font-bold text-sm ${sunlightMode ? 'text-slate-900' : 'text-white'}`}>{item.name}</div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                        {item.notes && <span className="text-[10px] text-slate-500 italic truncate max-w-xs">{item.notes}</span>}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400 font-medium">{item.supplier || 'N/A'}</td>
                    <td className={`p-3.5 text-right font-mono font-semibold ${sunlightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                      {formatZAR(item.costPrice)}
                    </td>
                    <td className="p-3.5 text-center font-mono text-amber-500 font-bold">
                      +{item.defaultMarkup}%
                    </td>
                    <td className="p-3.5 text-right font-mono text-emerald-500 font-black text-sm">
                      {formatZAR(item.sellingPrice)}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => handleAdjustQty(item.id, -1)}
                          title="Decrease 1"
                          className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center text-xs active:scale-95"
                        >
                          -
                        </button>
                        <span
                          className={`inline-flex items-center space-x-1 font-mono font-bold px-2 py-0.5 rounded text-[11px] min-w-[55px] justify-center ${
                            isLow
                              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          {isLow && <AlertCircle className="w-3 h-3" />}
                          <span>
                            {item.stockQty} {item.unit}
                          </span>
                        </span>
                        <button
                          onClick={() => handleAdjustQty(item.id, 1)}
                          title="Increase 1"
                          className="w-5 h-5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center text-xs active:scale-95"
                        >
                          +
                        </button>
                      </div>
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
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-semibold"
                  >
                    <option value="Hardware & Site Materials">Hardware & Site Materials</option>
                    <option value="Hardware & Fasteners">Hardware & Fasteners</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Air Conditioning">Air Conditioning</option>
                    <option value="Solar & Backup">Solar & Backup</option>
                    <option value="Security & CCTV">Security & CCTV</option>
                    <option value="Automation & Gate Motors">Automation & Gate Motors</option>
                    <option value="Consumables">Consumables</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Item Description *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tek Screws Hex Flange 4.8x25mm (Box of 100)"
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
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono text-center"
                  >
                    <option value="box">box</option>
                    <option value="pack">pack</option>
                    <option value="ea">ea</option>
                    <option value="roll">roll</option>
                    <option value="length">length</option>
                    <option value="set">set</option>
                    <option value="m">m</option>
                    <option value="unit">unit</option>
                    <option value="kit">kit</option>
                  </select>
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
                  placeholder="Fastener City, Bolt & Nut, Voltex, Plumblink"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Notes / Pack Specifications</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Box of 100 screws. For roof sheeting & brackets."
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
      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#282E3E]">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <Package className="w-5 h-5 text-sky-400" />
                <span>Bulk Import JSON</span>
              </h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Paste a valid JSON array of stock items. Required fields: <code className="bg-[#12141C] px-1 py-0.5 rounded text-amber-400">item_name</code> or <code className="bg-[#12141C] px-1 py-0.5 rounded text-amber-400">name</code>.
              </p>
              
              <textarea
                value={bulkJson}
                onChange={(e) => setBulkJson(e.target.value)}
                placeholder="[\n  {\n    'sku': '...', \n    'item_name': '...', \n    'unit_price': 100\n  }\n]"
                className="w-full h-64 px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              />

              {bulkError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start space-x-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{bulkError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-[#282E3E]">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#282E3E] text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Import Items</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Slip to Inventory Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
};
