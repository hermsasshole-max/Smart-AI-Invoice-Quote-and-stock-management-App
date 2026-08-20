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
} from 'lucide-react';

interface VoiceInvoiceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVoiceItems: (
    items: QuoteLineItem[],
    category: ServiceCategory,
    scope: string,
    labourHours: number
  ) => void;
}

export const VoiceInvoiceWizard: React.FC<VoiceInvoiceWizardProps> = ({
  isOpen,
  onClose,
  onApplyVoiceItems,
}) => {
  const { profile } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedScope, setParsedScope] = useState('');
  const [parsedCategory, setParsedCategory] = useState<ServiceCategory>('Air Conditioning');
  const [parsedHours, setParsedHours] = useState(4);
  const [extractedItems, setExtractedItems] = useState<QuoteLineItem[]>([]);

  // Speech Recognition hook
  useEffect(() => {
    let recognition: any = null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && isListening) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-ZA';

      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        setTranscript(current);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.start();
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [isListening]);

  if (!isOpen) return null;

  const handleSimulateFieldAudio = (sampleText: string) => {
    setTranscript(sampleText);
    parseVoiceText(sampleText);
  };

  const parseVoiceText = (text: string) => {
    const lower = text.toLowerCase();

    // Determine category
    let cat: ServiceCategory = 'Electrical';
    if (lower.includes('aircon') || lower.includes('btu') || lower.includes('split') || lower.includes('gas')) {
      cat = 'Air Conditioning';
    } else if (lower.includes('solar') || lower.includes('inverter') || lower.includes('battery') || lower.includes('panel')) {
      cat = 'Solar & Backup';
    } else if (lower.includes('gate') || lower.includes('motor') || lower.includes('centurion') || lower.includes('d5')) {
      cat = 'Automation & Gate Motors';
    } else if (lower.includes('camera') || lower.includes('cctv') || lower.includes('alarm')) {
      cat = 'Security & CCTV';
    }

    setParsedCategory(cat);
    setParsedScope(text);

    // Heuristic extract items
    const sampleItems: QuoteLineItem[] = [];
    if (cat === 'Air Conditioning') {
      sampleItems.push({
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
      sampleItems.push({
        id: 'voice_' + Date.now() + '_2',
        description: 'Wall Bracket Set & Anti-Vibration Mounts',
        category: 'Air Conditioning',
        costPrice: 280,
        markupPct: 35,
        unitPrice: 378,
        quantity: 1,
        unit: 'set',
        total: 378,
      });
      sampleItems.push({
        id: 'voice_' + Date.now() + '_3',
        description: 'Insulated Copper Pair 1/4 + 3/8 with condensate pipe',
        category: 'Air Conditioning',
        costPrice: 220,
        markupPct: 35,
        unitPrice: 297,
        quantity: 4,
        unit: 'm',
        total: 1188,
      });
      setParsedHours(4);
    } else if (cat === 'Solar & Backup') {
      sampleItems.push({
        id: 'voice_' + Date.now() + '_1',
        description: 'Deye 8kW Hybrid Inverter Single Phase',
        category: 'Solar & Backup',
        costPrice: 28500,
        markupPct: 25,
        unitPrice: 35625,
        quantity: 1,
        unit: 'unit',
        total: 35625,
      });
      sampleItems.push({
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
      setParsedHours(8);
    } else {
      sampleItems.push({
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
      sampleItems.push({
        id: 'voice_' + Date.now() + '_2',
        description: 'Veti 1 Double Switched Sockets',
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

    setExtractedItems(sampleItems);
  };

  const handleApply = () => {
    onApplyVoiceItems(extractedItems, parsedCategory, parsedScope || transcript, parsedHours);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-2xl bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#151722] border-b border-[#282E3E]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Hands-Free Voice Quote Wizard</h2>
              <p className="text-xs text-slate-400">
                Dictate work performed on site to automatically assemble quote line items
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

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Mic Record Card */}
          <div className="p-6 rounded-2xl bg-[#12141C] border border-[#334155] text-center space-y-4">
            <button
              onClick={() => {
                const nextState = !isListening;
                setIsListening(nextState);
                if (!nextState && transcript) {
                  parseVoiceText(transcript);
                }
              }}
              className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all shadow-xl cursor-pointer ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-red-500/40 scale-105'
                  : 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white hover:scale-105 shadow-sky-500/30'
              }`}
            >
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            <div>
              <h3 className="font-bold text-white text-base">
                {isListening ? 'Listening to your field notes...' : 'Tap Mic to Start Dictation'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Example: "Installed 1x 12000 BTU Alliance split aircon with 4 meters of copper and isolator, took about 4 hours."
              </p>
            </div>

            {/* Quick Test Presets */}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <span className="text-[11px] text-slate-500 w-full mb-1">Or click a field preset to test:</span>
              <button
                onClick={() =>
                  handleSimulateFieldAudio(
                    'Installed 12000 BTU Alliance Inverter split unit in master bedroom with 4m copper pipes and bracket, 4 hours labour.'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-sky-400 text-xs font-mono"
              >
                ❄️ 12k BTU Aircon Install
              </button>
              <button
                onClick={() =>
                  handleSimulateFieldAudio(
                    'Supplied and connected 8kW Deye hybrid inverter with 5.5kWh Hubble lithium battery and surge DB board, 8 hours labour.'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-amber-400 text-xs font-mono"
              >
                ☀️ Solar Inverter + Battery
              </button>
            </div>
          </div>

          {/* Transcript Textarea */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase font-mono">
              Field Dictation Transcript
            </label>
            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                parseVoiceText(e.target.value);
              }}
              placeholder="Dictated notes or typed summary..."
              className="w-full px-4 py-3 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Parsed Items Preview */}
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

              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {extractedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#1B1E28] border border-[#334155] flex justify-between items-center text-xs"
                  >
                    <span className="text-white font-medium">{item.description}</span>
                    <span className="text-sky-400 font-mono font-bold">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#151722] border-t border-[#282E3E] flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={extractedItems.length === 0}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            <Check className="w-4 h-4 text-slate-950" />
            <span>Apply to Quotation Form</span>
          </button>
        </div>
      </div>
    </div>
  );
};
