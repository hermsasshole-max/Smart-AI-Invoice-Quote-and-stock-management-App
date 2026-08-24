import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { QuoteLineItem, ServiceCategory } from '../types';
import { calculateSellingPrice } from '../utils/calculator';
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  X,
  Volume2,
  Play,
  Pause,
  Zap,
  User,
  MapPin,
  FileText,
  Clock,
  ListPlus,
  RefreshCw,
} from 'lucide-react';

interface VoiceInvoiceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVoiceItems: (
    items: QuoteLineItem[],
    category: ServiceCategory,
    scope: string,
    labourHours: number,
    clientInfo?: { name: string; phone: string; address: string }
  ) => void;
}

type WizardStep = 'intro' | 'client' | 'category_scope' | 'materials' | 'labour' | 'review';

export const VoiceInvoiceWizard: React.FC<VoiceInvoiceWizardProps> = ({
  isOpen,
  onClose,
  onApplyVoiceItems,
}) => {
  const { profile } = useApp();
  const [currentStep, setCurrentStep] = useState<WizardStep>('intro');
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  
  // Form State extracted via Voice
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [parsedCategory, setParsedCategory] = useState<ServiceCategory>('Air Conditioning');
  const [parsedScope, setParsedScope] = useState('');
  const [parsedHours, setParsedHours] = useState(4);
  const [extractedItems, setExtractedItems] = useState<QuoteLineItem[]>([]);

  // Speech Recognition hook
  useEffect(() => {
    let recognition: any = null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && isListening) {
      try {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-ZA';

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = event.results.length - 1; i >= 0; i--) {
            current = event.results[i][0].transcript;
            break;
          }
          setInterimText(current);
          handleVoiceInputByStep(current, currentStep);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.start();
      } catch (e) {
        console.warn('SpeechRecognition error:', e);
      }
    }

    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [isListening, currentStep]);

  if (!isOpen) return null;

  const handleVoiceInputByStep = (text: string, step: WizardStep) => {
    const clean = text.trim();
    if (!clean) return;

    if (step === 'client') {
      if (!clientName) setClientName(clean);
    } else if (step === 'category_scope') {
      parseCategoryAndScope(clean);
    } else if (step === 'materials') {
      parseMaterials(clean);
    } else if (step === 'labour') {
      const match = clean.match(/(\d+(\.\d+)?)\s*(hours|hrs|hour)/i);
      if (match) {
        setParsedHours(parseFloat(match[1]));
      }
    }
  };

  const parseCategoryAndScope = (text: string) => {
    const lower = text.toLowerCase();
    let cat: ServiceCategory = 'Electrical';
    if (lower.includes('aircon') || lower.includes('btu') || lower.includes('split') || lower.includes('hvac')) {
      cat = 'Air Conditioning';
    } else if (lower.includes('solar') || lower.includes('inverter') || lower.includes('battery') || lower.includes('panel')) {
      cat = 'Solar & Backup';
    } else if (lower.includes('gate') || lower.includes('motor') || lower.includes('centurion') || lower.includes('d5')) {
      cat = 'Automation & Gate Motors';
    } else if (lower.includes('camera') || lower.includes('cctv') || lower.includes('alarm')) {
      cat = 'Security & CCTV';
    } else if (lower.includes('refrigerat') || lower.includes('cold room') || lower.includes('chiller')) {
      cat = 'Air Conditioning';
    }

    setParsedCategory(cat);
    setParsedScope(text);
  };

  const parseMaterials = (text: string) => {
    const lower = text.toLowerCase();
    const items: QuoteLineItem[] = [];

    if (lower.includes('aircon') || lower.includes('btu') || parsedCategory === 'Air Conditioning') {
      items.push({
        id: 'voice_' + Date.now() + '_1',
        description: 'Alliance 12000 BTU Inverter Midwall Split Aircon (R32)',
        category: 'Air Conditioning',
        costPrice: 6800,
        markupPct: 30,
        unitPrice: 8840,
        quantity: 1,
        unit: 'unit',
        total: 8840,
      });
      items.push({
        id: 'voice_' + Date.now() + '_2',
        description: 'Galvanized Wall Bracket Set & Anti-Vibration Mounts',
        category: 'Air Conditioning',
        costPrice: 280,
        markupPct: 35,
        unitPrice: 378,
        quantity: 1,
        unit: 'set',
        total: 378,
      });
      items.push({
        id: 'voice_' + Date.now() + '_3',
        description: 'Pair Insulated Copper Pipe 1/4 + 3/8 with condensate line',
        category: 'Air Conditioning',
        costPrice: 220,
        markupPct: 35,
        unitPrice: 297,
        quantity: 4,
        unit: 'm',
        total: 1188,
      });
      items.push({
        id: 'voice_' + Date.now() + '_4',
        description: '30A Double Pole Weatherproof Rotary Isolator',
        category: 'Air Conditioning',
        costPrice: 195,
        markupPct: 40,
        unitPrice: 273,
        quantity: 1,
        unit: 'ea',
        total: 273,
      });
      setParsedHours(4);
    } else if (lower.includes('solar') || lower.includes('inverter') || parsedCategory === 'Solar & Backup') {
      items.push({
        id: 'voice_' + Date.now() + '_1',
        description: 'Deye 8kW Hybrid Inverter Single Phase (IP65)',
        category: 'Solar & Backup',
        costPrice: 28500,
        markupPct: 25,
        unitPrice: 35625,
        quantity: 1,
        unit: 'unit',
        total: 35625,
      });
      items.push({
        id: 'voice_' + Date.now() + '_2',
        description: 'Hubble AM-2 5.5kWh 51.2V LiFePO4 Battery',
        category: 'Solar & Backup',
        costPrice: 23500,
        markupPct: 22,
        unitPrice: 28670,
        quantity: 1,
        unit: 'unit',
        total: 28670,
      });
      items.push({
        id: 'voice_' + Date.now() + '_3',
        description: 'AC/DC Pre-Wired Protection DB with Type 2 Surge & Changeover',
        category: 'Solar & Backup',
        costPrice: 4200,
        markupPct: 30,
        unitPrice: 5460,
        quantity: 1,
        unit: 'ea',
        total: 5460,
      });
      setParsedHours(8);
    } else {
      items.push({
        id: 'voice_' + Date.now() + '_1',
        description: 'Surfix 2.5mm² Cable (100m Roll)',
        category: 'Electrical',
        costPrice: 1250,
        markupPct: 35,
        unitPrice: 1687.5,
        quantity: 1,
        unit: 'roll',
        total: 1687.5,
      });
      items.push({
        id: 'voice_' + Date.now() + '_2',
        description: 'Veti 1 Double Switched Socket Outlets',
        category: 'Electrical',
        costPrice: 145,
        markupPct: 40,
        unitPrice: 203,
        quantity: 4,
        unit: 'ea',
        total: 812,
      });
      setParsedHours(3);
    }

    setExtractedItems(items);
  };

  const handleApplyPreset = (presetType: 'aircon' | 'solar' | 'db_upgrade') => {
    if (presetType === 'aircon') {
      setClientName('Dr. Johan van der Merwe');
      setClientPhone('082 555 1290');
      setClientAddress('42 Sandown Manor, Sandton, Johannesburg');
      setParsedCategory('Air Conditioning');
      setParsedScope('Supply and install 1x 12000 BTU Alliance Midwall Split Inverter air conditioning unit with 4m copper piping, bracket, and 30A electrical isolator.');
      parseMaterials('12000 btu aircon split inverter');
      setParsedHours(4);
    } else if (presetType === 'solar') {
      setClientName('Sarah Jenkins');
      setClientPhone('071 884 9021');
      setClientAddress('18 Waterfall Country Estate, Midrand');
      setParsedCategory('Solar & Backup');
      setParsedScope('Supply and install 8kW Deye Hybrid Inverter, 5.5kWh Hubble Lithium Battery, and SANS compliant AC/DC surge protection DB board.');
      parseMaterials('8kw deye solar inverter battery');
      setParsedHours(8);
    } else {
      setClientName('Michael Khumalo');
      setClientPhone('083 409 7712');
      setClientAddress('15 Ridge Road, Bryanston, Sandton');
      setParsedCategory('Electrical');
      setParsedScope('Distribution Board Upgrade: Install 63A main switch, earth leakage unit, rewire 4x circuit breakers, and issue SANS 10142 Certificate of Compliance (CoC).');
      parseMaterials('electrical db upgrade cable');
      setParsedHours(5);
    }
    setCurrentStep('review');
  };

  const handleFinalSubmit = () => {
    onApplyVoiceItems(
      extractedItems,
      parsedCategory,
      parsedScope || 'On-site technical scope execution',
      parsedHours,
      clientName ? { name: clientName, phone: clientPhone, address: clientAddress } : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="modal-container relative w-full max-w-2xl bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#151722] border-b border-[#282E3E]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Voice-to-Text Quotation Builder</h2>
              <p className="text-xs text-slate-400">
                Interactive speech wizard to assemble on-site quotes hands-free
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#282E3E] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-[#12141C] border-b border-[#282E3E] text-xs font-mono">
          <button
            onClick={() => setCurrentStep('intro')}
            className={`flex items-center space-x-1 ${currentStep === 'intro' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            <span>1. Start</span>
          </button>
          <span className="text-slate-600">→</span>
          <button
            onClick={() => setCurrentStep('client')}
            className={`flex items-center space-x-1 ${currentStep === 'client' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            <span>2. Client</span>
          </button>
          <span className="text-slate-600">→</span>
          <button
            onClick={() => setCurrentStep('category_scope')}
            className={`flex items-center space-x-1 ${currentStep === 'category_scope' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            <span>3. Scope</span>
          </button>
          <span className="text-slate-600">→</span>
          <button
            onClick={() => setCurrentStep('materials')}
            className={`flex items-center space-x-1 ${currentStep === 'materials' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            <span>4. Items</span>
          </button>
          <span className="text-slate-600">→</span>
          <button
            onClick={() => setCurrentStep('review')}
            className={`flex items-center space-x-1 ${currentStep === 'review' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            <span>5. Review</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Active Mic Controller Card */}
          <div className="p-5 rounded-2xl bg-[#12141C] border border-[#334155] text-center space-y-4">
            <div className="flex justify-center items-center space-x-4">
              <button
                onClick={() => setIsListening(!isListening)}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-red-500/40 scale-105'
                    : 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white hover:scale-105 shadow-sky-500/30'
                }`}
              >
                {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>
            </div>

            <div>
              <h3 className="font-bold text-white text-base">
                {isListening ? 'Listening to speech (en-ZA)...' : 'Tap Microphone to Speak'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {currentStep === 'client' && 'Say client name, phone number, and street address.'}
                {currentStep === 'category_scope' && 'Say the service category (Aircon, Solar, Electrical) and scope of work.'}
                {currentStep === 'materials' && 'Say the materials and equipment needed (e.g. 12000 BTU inverter, 4m copper).'}
                {currentStep === 'review' && 'Review your assembled quotation data below.'}
                {currentStep === 'intro' && 'Speak naturally or tap a quick-start trade preset below.'}
              </p>
            </div>

            {interimText && (
              <div className="p-2.5 rounded-lg bg-[#1B1E28] border border-sky-500/30 text-sky-300 text-xs font-mono">
                🗣️ "{interimText}"
              </div>
            )}
          </div>

          {/* Intro Presets */}
          {currentStep === 'intro' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase font-mono">
                Or Tap a South African Field Preset:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleApplyPreset('aircon')}
                  className="p-3 rounded-xl bg-[#151722] hover:bg-[#1f2333] border border-[#282E3E] hover:border-sky-500/50 text-left transition-all group cursor-pointer"
                >
                  <div className="font-bold text-sky-400 text-sm">❄️ 12k BTU Aircon</div>
                  <div className="text-[11px] text-slate-400 mt-1">Inverter split, copper piping, bracket & isolator</div>
                </button>

                <button
                  onClick={() => handleApplyPreset('solar')}
                  className="p-3 rounded-xl bg-[#151722] hover:bg-[#1f2333] border border-[#282E3E] hover:border-amber-500/50 text-left transition-all group cursor-pointer"
                >
                  <div className="font-bold text-amber-400 text-sm">☀️ 8kW Solar Backup</div>
                  <div className="text-[11px] text-slate-400 mt-1">Deye inverter, 5.5kWh Hubble battery & surge DB</div>
                </button>

                <button
                  onClick={() => handleApplyPreset('db_upgrade')}
                  className="p-3 rounded-xl bg-[#151722] hover:bg-[#1f2333] border border-[#282E3E] hover:border-emerald-500/50 text-left transition-all group cursor-pointer"
                >
                  <div className="font-bold text-emerald-400 text-sm">⚡ DB Board Upgrade</div>
                  <div className="text-[11px] text-slate-400 mt-1">63A main switch, earth leakage & CoC issuance</div>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Form Fields based on voice input */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Dr. Johan van der Merwe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1">
                  Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="e.g. 082 555 1290"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1">
                Site Address
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. 42 Sandown Manor, Sandton"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1">
                Scope of Work
              </label>
              <textarea
                rows={2}
                value={parsedScope}
                onChange={(e) => {
                  setParsedScope(e.target.value);
                  parseCategoryAndScope(e.target.value);
                }}
                placeholder="Technical scope details..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Extracted Items */}
            {extractedItems.length > 0 && (
              <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-amber-400 uppercase font-mono">
                    Extracted {extractedItems.length} Line Items
                  </span>
                  <span className="text-slate-400 font-mono">
                    Category: <strong className="text-white">{parsedCategory}</strong> | Labour: {parsedHours} hrs
                  </span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {extractedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#1B1E28] border border-[#334155] flex justify-between items-center text-xs"
                    >
                      <span className="text-white font-medium">{item.description}</span>
                      <span className="text-sky-400 font-mono font-bold">
                        {item.quantity} {item.unit} @ R{item.unitPrice}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#151722] border-t border-[#282E3E] flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            onClick={handleFinalSubmit}
            disabled={extractedItems.length === 0 && !parsedScope}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4 text-slate-950" />
            <span>Apply to Quotation Form</span>
          </button>
        </div>
      </div>
    </div>
  );
};
