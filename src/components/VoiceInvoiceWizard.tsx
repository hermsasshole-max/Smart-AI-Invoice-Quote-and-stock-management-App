import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { QuoteLineItem, ServiceCategory } from '../types';
import { formatZAR, calculateSellingPrice } from '../utils/calculator';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Receipt,
  RotateCcw,
  Play,
  Pause,
} from 'lucide-react';

interface VoiceInvoiceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (type: 'invoice' | 'quote', id: string) => void;
}

type WizardStep = 'client_name' | 'client_address' | 'client_phone' | 'client_email' | 'service_type' | 'items_flow' | 'notes' | 'review';

export const VoiceInvoiceWizard: React.FC<VoiceInvoiceWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createInvoice, createQuotation, inventory, profile, sunlightMode, clients, addClient } = useApp();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('client_name');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [serviceType, setServiceType] = useState<ServiceCategory>('Electrical');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [docType, setDocType] = useState<'invoice' | 'quote'>('invoice');

  // Item sub-loop state
  const [currentItemDesc, setCurrentItemDesc] = useState('');
  const [currentItemQty, setCurrentItemQty] = useState(1);
  const [currentItemPrice, setCurrentItemPrice] = useState(250);
  const [itemSubStep, setItemSubStep] = useState<'desc' | 'qty' | 'price' | 'confirm'>('desc');

  // Speech Recognition & Synthesis State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechFeedback, setSpeechFeedback] = useState<string>('');
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize Speech Recognition & Synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-ZA'; // South African English accent support

        recognition.onresult = (event: any) => {
          let final = '';
          let interim = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }

          setInterimTranscript(interim);
          if (final) {
            handleSpokenInput(final.trim());
          }
        };

        recognition.onerror = (err: any) => {
          console.warn('Speech Recognition Error:', err);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
      }
    }

    return () => {
      stopListening();
      stopSpeaking();
    };
  }, []);

  // Speak helper
  const speak = (text: string) => {
    if (isVoiceMuted || !synthRef.current) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-ZA';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-start listening after speaking if supported
      if (!isListening && recognitionRef.current) {
        startListening();
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      // Already running or error
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (e) {
      // Ignore
    }
  };

  // Trigger prompt speech whenever currentStep changes
  useEffect(() => {
    if (!isOpen) return;

    let promptText = '';
    switch (currentStep) {
      case 'client_name':
        promptText = "What is the client's name or company name?";
        break;
      case 'client_address':
        promptText = "What is the client's site address or location?";
        break;
      case 'client_phone':
        promptText = "What is the contact phone number?";
        break;
      case 'client_email':
        promptText = "What is the client's email address? Or say skip.";
        break;
      case 'service_type':
        promptText = "What is the service trade? Electrical, Air Conditioning, Solar, or Refrigeration?";
        break;
      case 'items_flow':
        if (itemSubStep === 'desc') {
          promptText = "What item or service is being added? Say 'done' when you have finished adding items.";
        } else if (itemSubStep === 'qty') {
          promptText = `How many ${currentItemDesc} are required?`;
        } else if (itemSubStep === 'price') {
          promptText = `What is the unit price in Rands for ${currentItemDesc}?`;
        }
        break;
      case 'notes':
        promptText = "Are there any job notes or description of services to add? Or say none.";
        break;
      case 'review':
        promptText = `Ready to generate. Total is ${formatZAR(
          calculateWizardTotal()
        )}. Say create invoice or create quotation.`;
        break;
    }

    if (promptText) {
      setSpeechFeedback(promptText);
      speak(promptText);
    }
  }, [currentStep, itemSubStep, isOpen]);

  // Clean numbers from spoken text (e.g. "two hundred and fifty rand" -> 250)
  const parseSpokenNumber = (text: string): number => {
    const clean = text.toLowerCase().replace(/rand|zar|rands|r|\$/g, '').trim();
    const parsed = parseFloat(clean.replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Parse email from spoken text ("john dot smith at gmail dot com")
  const parseSpokenEmail = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/\s+at\s+/g, '@')
      .replace(/\s+dot\s+/g, '.')
      .replace(/\s+/g, '');
  };

  // Clean phone number from spoken text
  const parseSpokenPhone = (text: string): string => {
    return text.replace(/[^0-9+]/g, '');
  };

  // Handle Spoken Input depending on the active step
  const handleSpokenInput = (spoken: string) => {
    const lower = spoken.toLowerCase().trim();

    // Universal navigation words
    if (lower === 'cancel' || lower === 'close') {
      onClose();
      return;
    }

    if (currentStep === 'client_name') {
      const cleanName = spoken.replace(/^my client is |^the client is |^client name is /i, '').trim();
      setClientName(cleanName);
      // Auto-match existing client if found
      const existing = clients.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
      if (existing) {
        setClientPhone(existing.phone);
        setClientAddress(existing.siteAddress);
        setClientEmail(existing.email || '');
      }
      setTimeout(() => setCurrentStep('client_address'), 600);
    } else if (currentStep === 'client_address') {
      if (lower === 'skip' || lower === 'no address') {
        setClientAddress('Site Location');
      } else {
        setClientAddress(spoken);
      }
      setTimeout(() => setCurrentStep('client_phone'), 600);
    } else if (currentStep === 'client_phone') {
      if (lower === 'skip' || lower === 'no phone') {
        setClientPhone('082 000 0000');
      } else {
        const phone = parseSpokenPhone(spoken) || spoken;
        setClientPhone(phone);
      }
      setTimeout(() => setCurrentStep('client_email'), 600);
    } else if (currentStep === 'client_email') {
      if (lower === 'skip' || lower === 'none' || lower === 'no email') {
        setClientEmail('');
      } else {
        setClientEmail(parseSpokenEmail(spoken));
      }
      setTimeout(() => setCurrentStep('service_type'), 600);
    } else if (currentStep === 'service_type') {
      if (lower.includes('air') || lower.includes('hvac')) {
        setServiceType('Air Conditioning');
      } else if (lower.includes('solar') || lower.includes('battery') || lower.includes('inverter')) {
        setServiceType('Solar');
      } else if (lower.includes('refrigeration') || lower.includes('fridge') || lower.includes('gas')) {
        setServiceType('Refrigeration');
      } else {
        setServiceType('Electrical');
      }
      setTimeout(() => setCurrentStep('items_flow'), 600);
    } else if (currentStep === 'items_flow') {
      if (lower === 'done' || lower === 'finish' || lower === 'finished' || lower === 'no more') {
        setCurrentStep('notes');
        return;
      }

      if (itemSubStep === 'desc') {
        // Check if matches catalog item
        const matched = inventory.find((i) =>
          i.description.toLowerCase().includes(lower) || lower.includes(i.description.toLowerCase())
        );
        if (matched) {
          setCurrentItemDesc(matched.description);
          setCurrentItemPrice(matched.sellingPrice);
        } else {
          setCurrentItemDesc(spoken);
        }
        setItemSubStep('qty');
      } else if (itemSubStep === 'qty') {
        const num = parseSpokenNumber(spoken) || 1;
        setCurrentItemQty(num);
        setItemSubStep('price');
      } else if (itemSubStep === 'price') {
        const rate = parseSpokenNumber(spoken) || currentItemPrice;
        setCurrentItemPrice(rate);

        // Add line item
        const newItem: QuoteLineItem = {
          id: `li-voice-${Date.now()}-${Math.random()}`,
          type: 'material',
          description: currentItemDesc || 'Technical Materials & Labour',
          quantity: currentItemQty,
          unit: 'ea',
          unitCost: rate * 0.7,
          unitPrice: rate,
          total: Number((currentItemQty * rate).toFixed(2)),
          category: serviceType,
        };
        setLineItems((prev) => [...prev, newItem]);

        // Reset sub-step for next item
        setCurrentItemDesc('');
        setCurrentItemQty(1);
        setCurrentItemPrice(250);
        setItemSubStep('desc');
      }
    } else if (currentStep === 'notes') {
      if (lower === 'none' || lower === 'skip' || lower === 'no notes') {
        setScopeOfWork('');
      } else {
        setScopeOfWork(spoken);
      }
      setTimeout(() => setCurrentStep('review'), 600);
    } else if (currentStep === 'review') {
      if (lower.includes('invoice') || lower.includes('create invoice')) {
        handleFinalSubmit('invoice');
      } else if (lower.includes('quote') || lower.includes('quotation')) {
        handleFinalSubmit('quote');
      }
    }
  };

  const calculateWizardTotal = () => {
    const itemsTotal = lineItems.reduce((acc, it) => acc + it.total, 0);
    const vat = vatEnabled ? itemsTotal * 0.15 : 0;
    return itemsTotal + vat;
  };

  const handleFinalSubmit = (type: 'invoice' | 'quote' = docType) => {
    if (!clientName.trim()) {
      alert('Please enter or speak a client name.');
      return;
    }

    const items = lineItems.length > 0
      ? lineItems
      : [
          {
            id: `li-voice-default-${Date.now()}`,
            type: 'service' as const,
            description: `${serviceType} Technical Diagnostics & Callout`,
            quantity: 1,
            unit: 'ea',
            unitCost: 550,
            unitPrice: 750,
            total: 750,
            category: serviceType,
          },
        ];

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const vatAmount = vatEnabled ? Number((subtotal * 0.15).toFixed(2)) : 0;
    const totalAmount = Number((subtotal + vatAmount).toFixed(2));

    // Save or match client
    let clientId = `cli-${Date.now()}`;
    const matchedClient = clients.find((c) => c.name.toLowerCase() === clientName.toLowerCase());
    if (matchedClient) {
      clientId = matchedClient.id;
    } else {
      addClient({
        name: clientName,
        phone: clientPhone || '082 000 0000',
        email: clientEmail,
        siteAddress: clientAddress || 'Site Location',
        serviceType,
        notes: scopeOfWork,
      });
    }

    if (type === 'invoice') {
      const created = createInvoice({
        invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        clientId,
        clientName,
        clientPhone: clientPhone || '082 000 0000',
        clientEmail,
        clientAddress: clientAddress || 'Site Location',
        serviceType,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items,
        calloutFee: 0,
        labourTotal: 0,
        travelTotal: 0,
        materialsTotal: subtotal,
        subtotal,
        vatEnabled,
        vatRate: 15,
        vatAmount,
        totalAmount,
        amountPaid: 0,
        status: 'issued',
        notes: scopeOfWork,
        scopeOfWork,
      });

      if (onSuccess) onSuccess('invoice', created.id);
    } else {
      const created = createQuotation({
        quoteNumber: `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        clientId,
        clientName,
        clientPhone: clientPhone || '082 000 0000',
        clientEmail,
        clientAddress: clientAddress || 'Site Location',
        serviceType,
        date: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items,
        calloutFee: 0,
        masterLabourHours: 0,
        masterLabourRate: profile.rates.masterLabourRate,
        assistantLabourHours: 0,
        assistantLabourRate: profile.rates.assistantLabourRate,
        travelKm: 0,
        travelRate: profile.rates.travelRatePerKm,
        isAfterHours: false,
        afterHoursMultiplier: 1.5,
        materialsTotal: subtotal,
        labourTotal: 0,
        travelTotal: 0,
        subtotal,
        vatEnabled,
        vatRate: 15,
        vatAmount,
        totalAmount,
        status: 'draft',
        notes: scopeOfWork,
        scopeOfWork,
        terms: '70% deposit required upon confirmation. Balance payable on completion.',
      });

      if (onSuccess) onSuccess('quote', created.id);
    }

    onClose();
  };

  const stepsList: WizardStep[] = [
    'client_name',
    'client_address',
    'client_phone',
    'client_email',
    'service_type',
    'items_flow',
    'notes',
    'review',
  ];

  const currentStepIndex = stepsList.indexOf(currentStep);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          sunlightMode ? 'bg-white border-2 border-black text-black' : 'bg-[#232838] border-[#334155] text-[#F8FAFC]'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#334155] flex items-center justify-between bg-gradient-to-r from-[#38BDF8]/15 via-transparent to-transparent">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-[#38BDF8] text-[#1B1E28]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#38BDF8] text-[#1B1E28] uppercase">
                  INTERACTIVE VOICE WIZARD
                </span>
                <span className="text-[11px] font-mono text-[#94A3B8]">
                  STEP {currentStepIndex + 1} OF {stepsList.length}
                </span>
              </div>
              <h3 className="text-base font-bold uppercase tracking-tight text-white">
                Step-by-Step Hands-Free Invoice Assistant
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsVoiceMuted(!isVoiceMuted)}
              title={isVoiceMuted ? 'Unmute Assistant' : 'Mute Assistant'}
              className={`p-2 rounded-lg border text-xs transition-colors ${
                isVoiceMuted ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-[#1B1E28] text-[#94A3B8] border-[#334155] hover:text-[#38BDF8]'
              }`}
            >
              {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#10B981]" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-[#334155] hover:bg-[#1B1E28] text-[#94A3B8] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Step Indicator */}
        <div className="grid grid-cols-8 gap-1 p-2 bg-[#1B1E28] border-b border-[#334155]">
          {stepsList.map((step, idx) => (
            <div
              key={step}
              onClick={() => setCurrentStep(step)}
              className={`h-1.5 rounded-full cursor-pointer transition-all ${
                idx === currentStepIndex
                  ? 'bg-[#38BDF8] ring-2 ring-[#38BDF8]/40'
                  : idx < currentStepIndex
                  ? 'bg-[#10B981]'
                  : 'bg-[#334155]'
              }`}
            />
          ))}
        </div>

        {/* Voice Feedback & Wave Visualizer */}
        <div className="p-4 bg-[#1B1E28]/90 border-b border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`relative p-3 rounded-full font-bold flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50 ring-4 ring-red-500/30'
                  : 'bg-[#38BDF8] text-[#1B1E28] hover:bg-[#7DD3FC]'
              }`}
            >
              {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <div>
              <div className="text-[10px] font-mono uppercase text-[#94A3B8] flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-ping' : isSpeaking ? 'bg-[#10B981]' : 'bg-gray-500'}`} />
                <span>{isSpeaking ? 'Assistant Speaking...' : isListening ? 'Listening for your voice...' : 'Microphone Ready (Click to Speak)'}</span>
              </div>
              <p className="text-sm font-semibold text-[#38BDF8] mt-0.5">
                "{speechFeedback}"
              </p>
              {interimTranscript && (
                <p className="text-xs font-mono text-[#10B981] italic mt-0.5">
                  Hearing: "{interimTranscript}"
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => speak(speechFeedback)}
              className="px-2.5 py-1.5 rounded-lg bg-[#232838] border border-[#334155] text-xs font-mono text-[#94A3B8] hover:text-white flex items-center space-x-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Repeat Prompt</span>
            </button>
          </div>
        </div>

        {/* Wizard Form Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Step 1: Client Name */}
          {currentStep === 'client_name' && (
            <div className="space-y-3 animate-fadeIn">
              <label className="text-xs font-mono uppercase text-[#94A3B8] block">
                1. Client Name / Surname / Business Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Johan van der Merwe / Apex Retail Mall"
                className="w-full px-4 py-3 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] text-lg font-bold focus:border-[#38BDF8] focus:outline-none"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[11px] font-mono text-[#94A3B8]">Existing Clients:</span>
                {clients.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setClientName(c.name);
                      setClientPhone(c.phone);
                      setClientAddress(c.siteAddress);
                      setClientEmail(c.email || '');
                      setServiceType(c.serviceType);
                    }}
                    className="px-2 py-1 rounded bg-[#1B1E28] border border-[#334155] text-xs font-mono text-[#94A3B8] hover:border-[#38BDF8] hover:text-[#38BDF8]"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Client Address */}
          {currentStep === 'client_address' && (
            <div className="space-y-3 animate-fadeIn">
              <label className="text-xs font-mono uppercase text-[#94A3B8] block">
                2. Site Location / Physical Address
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. 45 Hendrik Verwoerd Dr, Randburg, JHB"
                className="w-full px-4 py-3 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] text-base font-bold focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
          )}

          {/* Step 3: Client Phone */}
          {currentStep === 'client_phone' && (
            <div className="space-y-3 animate-fadeIn">
              <label className="text-xs font-mono uppercase text-[#94A3B8] block">
                3. Contact Phone / WhatsApp Number
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 082 345 6789"
                className="w-full px-4 py-3 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] text-base font-bold focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
          )}

          {/* Step 4: Client Email */}
          {currentStep === 'client_email' && (
            <div className="space-y-3 animate-fadeIn">
              <label className="text-xs font-mono uppercase text-[#94A3B8] block">
                4. Email Address (Optional)
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. johan@example.co.za"
                className="w-full px-4 py-3 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] text-base font-bold focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
          )}

          {/* Step 5: Service Category */}
          {currentStep === 'service_type' && (
            <div className="space-y-3 animate-fadeIn">
              <label className="text-xs font-mono uppercase text-[#94A3B8] block">
                5. Service Trade Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['Electrical', 'Air Conditioning', 'Solar', 'Refrigeration'] as ServiceCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setServiceType(cat)}
                    className={`p-4 rounded-xl border font-bold text-center transition-all ${
                      serviceType === cat
                        ? 'bg-[#38BDF8] text-[#1B1E28] border-[#38BDF8] shadow-lg shadow-[#38BDF833]'
                        : 'bg-[#1B1E28] border-[#334155] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Interactive Items Flow */}
          {currentStep === 'items_flow' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#334155] pb-2">
                <label className="text-xs font-mono uppercase text-[#38BDF8] font-bold">
                  6. Add Materials, Diagnostics & Labour Line Items
                </label>
                <span className="text-xs font-mono text-[#10B981] font-bold">
                  Current Items Total: {formatZAR(lineItems.reduce((acc, it) => acc + it.total, 0))}
                </span>
              </div>

              {/* Sub-step item adding box */}
              <div className="p-3 bg-[#1B1E28] rounded-xl border border-[#334155] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-1.5">
                    <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">
                      Item Description / Part
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 20A Circuit Breaker / R410A Gas Topup"
                      value={currentItemDesc}
                      onChange={(e) => setCurrentItemDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#232838] border border-[#334155] text-xs text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={currentItemQty}
                      onChange={(e) => setCurrentItemQty(Number(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-lg bg-[#232838] border border-[#334155] text-xs text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Unit Rate (ZAR)</label>
                    <input
                      type="number"
                      value={currentItemPrice}
                      onChange={(e) => setCurrentItemPrice(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg bg-[#232838] border border-[#334155] text-xs text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-mono text-[#94A3B8]">
                    Line Total: <strong className="text-[#38BDF8]">{formatZAR(currentItemQty * currentItemPrice)}</strong>
                  </span>
                  <button
                    onClick={() => {
                      if (!currentItemDesc.trim()) return;
                      const newItem: QuoteLineItem = {
                        id: `li-voice-${Date.now()}`,
                        type: 'material',
                        description: currentItemDesc.trim(),
                        quantity: currentItemQty,
                        unit: 'ea',
                        unitCost: currentItemPrice * 0.7,
                        unitPrice: currentItemPrice,
                        total: Number((currentItemQty * currentItemPrice).toFixed(2)),
                        category: serviceType,
                      };
                      setLineItems([...lineItems, newItem]);
                      setCurrentItemDesc('');
                      setCurrentItemQty(1);
                      setCurrentItemPrice(250);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#38BDF8] text-[#1B1E28] font-bold text-xs uppercase flex items-center space-x-1 hover:bg-[#7DD3FC]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              {/* Line Items List */}
              {lineItems.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {lineItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-[#1B1E28] border border-[#334155] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex-1 pr-2">
                        <span className="font-bold text-white">{item.description}</span>
                        <div className="text-[11px] text-[#94A3B8]">
                          {item.quantity} x {formatZAR(item.unitPrice)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#10B981]">{formatZAR(item.total)}</span>
                        <button
                          onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                          className="p-1 text-[#94A3B8] hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 7: Notes & Scope of Work */}
          {currentStep === 'notes' && (
            <div className="space-y-3 animate-fadeIn">
              <label className="text-xs font-mono uppercase text-[#94A3B8] block">
                7. Scope of Work / Service Description & Job Notes
              </label>
              <textarea
                rows={4}
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                placeholder="e.g. Conducted full fault-finding on main DB board. Replaced faulty 20A circuit breaker for geyser circuit. Tested earth leakage trip times in compliance with SANS 10142-1."
                className="w-full px-4 py-3 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] text-sm font-sans focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
          )}

          {/* Step 8: Final Review & Generation */}
          {currentStep === 'review' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-xl bg-[#1B1E28] border border-[#334155] space-y-3">
                <div className="flex justify-between items-start border-b border-[#334155] pb-2">
                  <div>
                    <h4 className="font-bold text-white text-base">{clientName || 'Client Name'}</h4>
                    <p className="text-xs font-mono text-[#94A3B8]">{clientAddress} • {clientPhone}</p>
                    {clientEmail && <p className="text-xs font-mono text-[#94A3B8]">{clientEmail}</p>}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#38BDF8] text-[#1B1E28]">
                    {serviceType}
                  </span>
                </div>

                {scopeOfWork && (
                  <div className="p-2.5 rounded-lg bg-[#232838] border border-[#334155] text-xs">
                    <span className="text-[10px] font-mono text-[#38BDF8] uppercase block font-bold mb-0.5">Scope of Work:</span>
                    <p className="text-[#94A3B8]">{scopeOfWork}</p>
                  </div>
                )}

                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Items Count:</span>
                    <span className="text-[#F8FAFC]">{lineItems.length} items</span>
                  </div>
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Subtotal (Excl VAT):</span>
                    <span className="text-[#F8FAFC]">{formatZAR(lineItems.reduce((acc, it) => acc + it.total, 0))}</span>
                  </div>
                  {vatEnabled && (
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>VAT (15%):</span>
                      <span className="text-[#F8FAFC]">{formatZAR(lineItems.reduce((acc, it) => acc + it.total, 0) * 0.15)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-[#10B981] pt-2 border-t border-[#334155]">
                    <span>Grand Total:</span>
                    <span>{formatZAR(calculateWizardTotal())}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center space-x-2 text-xs font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vatEnabled}
                      onChange={(e) => setVatEnabled(e.target.checked)}
                      className="rounded accent-[#38BDF8]"
                    />
                    <span>Include 15% South African VAT</span>
                  </label>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setDocType('invoice')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                        docType === 'invoice' ? 'bg-[#38BDF8] text-[#1B1E28]' : 'bg-[#232838] text-[#94A3B8]'
                      }`}
                    >
                      Tax Invoice
                    </button>
                    <button
                      onClick={() => setDocType('quote')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                        docType === 'quote' ? 'bg-[#F59E0B] text-[#1B1E28]' : 'bg-[#232838] text-[#94A3B8]'
                      }`}
                    >
                      Official Quotation
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="p-4 border-t border-[#334155] bg-[#1B1E28] flex items-center justify-between">
          <button
            onClick={() => {
              if (currentStepIndex > 0) {
                setCurrentStep(stepsList[currentStepIndex - 1]);
              }
            }}
            disabled={currentStepIndex === 0}
            className="px-3.5 py-2 rounded-lg border border-[#334155] text-xs font-mono text-[#94A3B8] hover:text-white disabled:opacity-30 flex items-center space-x-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-2">
            {currentStep !== 'review' ? (
              <button
                onClick={() => {
                  if (currentStepIndex < stepsList.length - 1) {
                    setCurrentStep(stepsList[currentStepIndex + 1]);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#1B1E28] font-bold text-xs uppercase flex items-center space-x-1.5 font-mono shadow"
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => handleFinalSubmit(docType)}
                className="px-5 py-2 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#1B1E28] font-bold text-xs uppercase flex items-center space-x-2 font-mono shadow-lg shadow-[#10B98133]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Generate {docType === 'invoice' ? 'Tax Invoice' : 'Quotation'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
