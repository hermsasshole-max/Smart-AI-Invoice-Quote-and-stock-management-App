import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem, ServiceCategory } from '../types';
import { formatZAR, calculateSellingPrice, calculateMarkupPct } from '../utils/calculator';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Flame,
  Zap,
  Sun,
  Shield,
  Trash2,
  Edit2,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Scale,
  Sliders,
  Filter,
  X,
} from 'lucide-react';

export const InventoryManager: React.FC = () => {
  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    adjustStockOnHand,
    updateCanisterWeight,
    lowStockItems,
    sunlightMode,
    profile,
    setActiveTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ServiceCategory>('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New Item Form State
  const [newSku, setNewSku] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<ServiceCategory>('Electrical');
  const [newUnit, setNewUnit] = useState<'ea' | 'm' | 'roll' | 'kg' | 'canister' | 'box' | 'pair' | 'lot'>('ea');
  const [newCostPrice, setNewCostPrice] = useState<number>(100);
  const [newMarkupPct, setNewMarkupPct] = useState<number>(profile.rates.defaultMaterialMarkupPct || 30);
  const [newStockOnHand, setNewStockOnHand] = useState<number>(5);
  const [newMinStock, setNewMinStock] = useState<number>(2);
  const [newSupplier, setNewSupplier] = useState('Voltex');
  const [newCanisterWeight, setNewCanisterWeight] = useState<number | undefined>(undefined);

  // Filter items
  const filteredInventory = inventory.filter((item) => {
    const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchSearch =
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplierRef && item.supplierRef.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchLowStock = !showLowStockOnly || item.stockOnHand <= item.minStockAlert;
    return matchCategory && matchSearch && matchLowStock;
  });

  const handleAddNewItem = () => {
    if (!newDescription.trim()) {
      alert('Please provide an item description.');
      return;
    }

    const calculatedSelling = calculateSellingPrice(newCostPrice, newMarkupPct);

    addInventoryItem({
      sku: newSku.trim() || `SKU-${Math.floor(10000 + Math.random() * 90000)}`,
      description: newDescription.trim(),
      category: newCategory,
      unit: newUnit,
      costPrice: newCostPrice,
      markupPct: newMarkupPct,
      sellingPrice: calculatedSelling,
      stockOnHand: newStockOnHand,
      minStockAlert: newMinStock,
      supplierRef: newSupplier,
      canisterWeightKg: newCanisterWeight,
    });

    setIsAddingNew(false);
    setNewSku('');
    setNewDescription('');
    setNewCostPrice(100);
  };

  const handleSaveItemEdit = (item: InventoryItem) => {
    if (!item.description.trim()) {
      alert('Description cannot be empty.');
      return;
    }
    const sellingPrice = calculateSellingPrice(item.costPrice, item.markupPct);
    updateInventoryItem(item.id, {
      ...item,
      sellingPrice,
    });
    setEditingItem(null);
  };

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D2D30] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF6321] text-black uppercase tracking-wider">
              ZAR PRICE BOOK & VAN STOCK
            </span>
            <span className="text-[11px] font-mono text-[#707070]">STOCK DEDUCTIONS • OCR SCANNING</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#FF6321]">
            Inventory & Price Book
          </h2>
          <p className="text-xs font-mono text-[#A0A0A5] mt-0.5">
            Maintain South African trade cost prices, automated retail markups, refrigerant gas weights, and on-site van stock levels.
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono">
          <button
            onClick={() => setActiveTab('scanner')}
            className="px-3.5 py-2 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold text-xs uppercase flex items-center space-x-1.5 shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Scan Receipt / Invoice</span>
          </button>

          <button
            id="btn-add-inventory-item"
            onClick={() => setIsAddingNew(!isAddingNew)}
            className={`px-4 py-2 rounded font-bold text-xs uppercase flex items-center space-x-1.5 transition-all shadow ${
              isAddingNew
                ? 'bg-[#252528] text-[#A0A0A5] border border-[#2D2D30]'
                : sunlightMode
                ? 'bg-amber-400 text-black border-2 border-black font-extrabold'
                : 'bg-[#FF6321] hover:bg-[#e0551a] text-black shadow-lg shadow-[#FF632133]'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{isAddingNew ? 'Cancel' : '+ Add Catalog Item'}</span>
          </button>
        </div>
      </div>

      {/* Add New Item Drawer */}
      {isAddingNew && (
        <div
          className={`p-5 rounded-xl border space-y-4 shadow-2xl ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <h3 className="font-bold text-xs uppercase tracking-widest text-[#FF6321] flex items-center space-x-2 font-mono">
            <Package className="w-4 h-4 text-[#FF6321]" />
            <span>ADD NEW ITEM TO ZAR PRICE BOOK</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">SKU / Code</label>
              <input
                type="text"
                placeholder="e.g. ELEC-CB-63A"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Description / Spec *</label>
              <input
                type="text"
                placeholder="e.g. CBI 63A Double Pole Main Switch 240V"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#007AFF] font-bold"
              >
                <option value="Electrical">Electrical</option>
                <option value="HVAC">HVAC</option>
                <option value="Solar">Solar</option>
                <option value="Refrigeration">Refrigeration</option>
                <option value="Security">Security</option>
                <option value="Consumables">Consumables</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Unit of Measure</label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as any)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
              >
                <option value="ea">Each (ea)</option>
                <option value="m">Meter (m)</option>
                <option value="roll">Roll (roll)</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="canister">Gas Canister (canister)</option>
                <option value="box">Box (box)</option>
                <option value="lot">Lot (lot)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Cost Price (Excl VAT)</label>
              <input
                type="number"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Markup %</label>
              <input
                type="number"
                value={newMarkupPct}
                onChange={(e) => setNewMarkupPct(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#00FF41] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Stock on Hand</label>
              <input
                type="number"
                value={newStockOnHand}
                onChange={(e) => setNewStockOnHand(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-[#2D2D30] font-mono">
            <button
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#A0A0A5] text-xs font-bold uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNewItem}
              className="px-5 py-2 rounded bg-[#FF6321] hover:bg-[#e0551a] text-black font-bold text-xs uppercase shadow-lg shadow-[#FF632133]"
            >
              Save to Catalog
            </button>
          </div>
        </div>
      )}

      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 font-mono">
          <Search className="w-3.5 h-3.5 text-[#707070] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by description, SKU, or supplier (Voltex, Metraclark, ARB)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {(['All', 'Electrical', 'HVAC', 'Solar', 'Refrigeration', 'Security', 'Consumables'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as any)}
              className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${
                selectedCategory === cat
                  ? 'bg-[#FF6321] text-black shadow'
                  : 'bg-[#1A1A1C] border border-[#2D2D30] text-[#707070] hover:text-[#E0E0E0]'
              }`}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-3 py-1 rounded text-xs font-bold uppercase flex items-center space-x-1 transition-all ${
              showLowStockOnly
                ? 'bg-[#FF4444] text-white shadow'
                : 'bg-[#1A1A1C] border border-[#2D2D30] text-[#707070] hover:text-[#E0E0E0]'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Low Stock ({lowStockItems.length})</span>
          </button>
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="space-y-3">
        {filteredInventory.length === 0 ? (
          <div className="p-8 text-center text-[#707070] border border-dashed border-[#2D2D30] rounded text-xs font-mono uppercase">
            No inventory items matching current search or filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredInventory.map((item) => {
              const isLow = item.stockOnHand <= item.minStockAlert;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                    isLow
                      ? sunlightMode
                        ? 'bg-rose-100 border-2 border-rose-600 text-black'
                        : 'bg-[#0A0A0B] border-[#FF444488]'
                      : sunlightMode
                      ? 'bg-white border-2 border-black text-black'
                      : 'bg-[#1A1A1C] border-[#2D2D30] text-[#E0E0E0] hover:border-[#3D3D42]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1 font-mono">
                      <span className="text-[10px] font-bold text-[#007AFF] bg-[#0A0A0B] px-1.5 py-0.5 rounded border border-[#2D2D30]">
                        {item.sku}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0A0A0B] text-[#A0A0A5] border border-[#2D2D30]">
                        {item.category}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#E0E0E0] line-clamp-2 mt-1 font-sans">
                      {item.description}
                    </h4>

                    {item.canisterWeightKg !== undefined && (
                      <div className="mt-2 p-2 rounded bg-[#007AFF11] border border-[#007AFF44] text-xs font-mono text-[#007AFF] flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <Scale className="w-3.5 h-3.5 text-[#007AFF]" />
                          <span>Gas Canister: {item.canisterWeightKg} kg</span>
                        </div>
                        <button
                          onClick={() => {
                            const newW = prompt('Enter new cylinder gross weight (kg):', String(item.canisterWeightKg));
                            if (newW) updateCanisterWeight(item.id, parseFloat(newW) || item.canisterWeightKg!);
                          }}
                          className="text-[10px] font-bold text-[#007AFF] underline uppercase"
                        >
                          Weigh
                        </button>
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-[#2D2D30] grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-[#707070] uppercase block">Trade Cost</span>
                        <span className="font-bold text-[#E0E0E0]">{formatZAR(item.costPrice)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#707070] uppercase block">Retail Quote (+{item.markupPct}%)</span>
                        <span className="font-bold text-[#00FF41]">{formatZAR(item.sellingPrice)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stock On Hand & Stepper Controls */}
                  <div className="pt-2 border-t border-[#2D2D30] flex items-center justify-between font-mono">
                    <div>
                      <div className="text-[10px] text-[#707070] uppercase">Stock on Hand</div>
                      <div className={`text-xs font-bold ${isLow ? 'text-[#FF4444]' : 'text-[#E0E0E0]'}`}>
                        {item.stockOnHand} {item.unit} {isLow && '⚠️ LOW'}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => adjustStockOnHand(item.id, -1)}
                        className="w-7 h-7 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] hover:bg-[#252528] font-bold text-xs flex items-center justify-center"
                        title="Deduct 1 unit"
                      >
                        -1
                      </button>

                      <button
                        onClick={() => adjustStockOnHand(item.id, 1)}
                        className="w-7 h-7 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#00FF41] hover:bg-[#252528] font-bold text-xs flex items-center justify-center"
                        title="Add 1 unit"
                      >
                        +1
                      </button>

                      <button
                        onClick={() => setEditingItem(JSON.parse(JSON.stringify(item)))}
                        className="w-7 h-7 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#007AFF] hover:bg-[#252528] flex items-center justify-center"
                        title="Edit catalog item"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="w-7 h-7 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#707070] hover:text-[#FF4444] flex items-center justify-center"
                        title="Delete item"
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

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl p-5 rounded-xl bg-[#141416] border border-[#2D2D30] shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#2D2D30] pb-2">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-[#FF6321]" />
                <h3 className="font-bold text-sm text-white uppercase">Edit Catalog Item: {editingItem.sku}</h3>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-[#707070] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">SKU / Code</label>
                <input
                  type="text"
                  value={editingItem.sku}
                  onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Trade Category</label>
                <select
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as ServiceCategory })}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#007AFF] font-bold"
                >
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Solar">Solar</option>
                  <option value="Refrigeration">Refrigeration</option>
                  <option value="Security">Security</option>
                  <option value="Consumables">Consumables</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Description / Spec *</label>
                <input
                  type="text"
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Cost Price (ZAR)</label>
                <input
                  type="number"
                  value={editingItem.costPrice}
                  onChange={(e) => {
                    const cost = Number(e.target.value) || 0;
                    const markup = editingItem.markupPct;
                    setEditingItem({
                      ...editingItem,
                      costPrice: cost,
                      sellingPrice: calculateSellingPrice(cost, markup),
                    });
                  }}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Markup %</label>
                <input
                  type="number"
                  value={editingItem.markupPct}
                  onChange={(e) => {
                    const markup = Number(e.target.value) || 0;
                    const cost = editingItem.costPrice;
                    setEditingItem({
                      ...editingItem,
                      markupPct: markup,
                      sellingPrice: calculateSellingPrice(cost, markup),
                    });
                  }}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#00FF41] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Stock On Hand</label>
                <input
                  type="number"
                  value={editingItem.stockOnHand}
                  onChange={(e) => setEditingItem({ ...editingItem, stockOnHand: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Min Stock Alert Level</label>
                <input
                  type="number"
                  value={editingItem.minStockAlert}
                  onChange={(e) => setEditingItem({ ...editingItem, minStockAlert: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2D2D30]">
              <span className="text-[#00FF41] font-bold">
                Calculated Selling Price: {formatZAR(editingItem.sellingPrice)}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-1.5 rounded bg-[#252528] text-[#A0A0A5] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveItemEdit(editingItem)}
                  className="px-5 py-1.5 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold uppercase"
                >
                  Save Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-5 rounded-xl bg-[#18181B] border border-red-500/40 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase">Delete Catalog Item</h3>
            </div>
            <p className="text-xs text-[#A0A0A5]">
              Are you sure you want to remove this item from your catalog?
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded bg-[#27272A] text-xs text-[#A0A0A5] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteInventoryItem(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase"
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
