import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  X,
  Plus,
  Trash2,
  Share2,
  FileText,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Package,
  AlertCircle,
  Clock,
  MapPin,
  Phone,
  User,
  Wand2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { parseVoiceToQuote, StructuredVoiceQuote } from '../services/geminiService';
import { formatZAR, calculateSellingPrice } from '../utils/calculator';
import { buildJsPDFDocument, saveOrShareFile } from '../utils/multiFormatExport';
import { Quotation, QuoteLineItem, ServiceCategory } from '../types';

interface VoiceQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuoteCreated?: (quote: Quotation) => void;
}

export const VoiceQuoteModal: React.FC<VoiceQuoteModalProps> = ({
  isOpen,
  onClose,
  onQuoteCreated,
}) => {
  const { profile, addQuote, getNextQuoteNumber, inventory, deductStock, sunlightMode, addClient, clients } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<StructuredVoiceQuote | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Audio Visualizer refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Editable Form State when Parsed
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [serviceType, setServiceType] = useState<ServiceCategory>('Electrical');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [depositPct, setDepositPct] = useState(50);
  const [calloutFee, setCalloutFee] = useState(650);
  const [labourHours, setLabourHours] = useState(2);
  const [labourRate, setLabourRate] = useState(550);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Web Speech API initialization
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setParsedData(null);
      setTranscript('');
      setAudioError(null);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-ZA'; // South African English

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscript(fullTranscript.trim());
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          setAudioError('Microphone permission denied. Please allow mic access.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setAudioError('Speech recognition is not natively supported in this browser. You can type notes or use voice recording.');
    }

    return () => {
      stopListening();
    };
  }, [isOpen]);

  // Start Mic & Audio Visualizer
  const startListening = async () => {
    setAudioError(null);
    setTranscript('');
    try {
      // 1. Audio stream for waveform visualization
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateAudioLevel);
          };
          updateAudioLevel();
        }
      }

      // 2. Start Speech Recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      }
    } catch (err: any) {
      console.warn('Mic access error:', err);
      setAudioError('Unable to access microphone. Please check permissions.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Process Voice Transcript with Gemini
  const handleProcessTranscript = async () => {
    if (!transcript.trim()) return;
    stopListening();
    setIsProcessing(true);

    try {
      const result = await parseVoiceToQuote(transcript, profile);
      setParsedData(result);

      // Populate form state
      setClientName(result.client?.name || '');
      setClientPhone(result.client?.phone || '');
      setClientAddress(result.client?.address || '');
      setServiceType((result.serviceType as ServiceCategory) || 'Electrical');
      setScopeOfWork(result.scopeOfWork || transcript);
      setCalloutFee(result.calloutFee || 650);
      setLabourHours(result.labourHours || 2);
      setLabourRate(result.labourRatePerHour || 550);
      setDepositPct(result.paymentTerms?.depositRequiredPercent || 50);
      setNotes(result.summaryNotes || 'Standard 12-month workmanship guarantee. SANS 10142-1 certified.');

      // Enrich items with live inventory data
      const enriched = (result.items || []).map((it, idx) => {
        const cost = it.costPrice || (it.unitPrice ? Number((it.unitPrice / 1.35).toFixed(2)) : 100);
        const markup = it.markupPercent || 35;
        const sellPrice = it.unitPrice || Number((cost * (1 + markup / 100)).toFixed(2));
        const qty = it.quantity || 1;

        // Check if item exists in inventory
        const matchedInv = inventory.find(
          (inv) =>
            inv.name.toLowerCase().includes(it.description.toLowerCase()) ||
            (it.sku && inv.sku.toLowerCase() === it.sku.toLowerCase())
        );

        return {
          id: 'item_' + Date.now() + '_' + idx,
          description: it.description || 'Installation Item',
          category: it.category || 'Electrical',
          quantity: qty,
          costPrice: matchedInv ? matchedInv.costPrice : cost,
          markupPct: matchedInv ? matchedInv.defaultMarkup : markup,
          unitPrice: matchedInv ? matchedInv.sellingPrice : sellPrice,
          unit: matchedInv ? matchedInv.unit : (it.unit || 'ea'),
          total: Number((qty * (matchedInv ? matchedInv.sellingPrice : sellPrice)).toFixed(2)),
          inventoryId: matchedInv?.id,
          sku: matchedInv?.sku,
          stockQty: matchedInv ? matchedInv.stockQty : null,
        };
      });

      setItems(enriched);
    } catch (err) {
      console.error('Error parsing voice to quote:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Item Calculations
  const updateItem = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };

      if (field === 'costPrice' || field === 'markupPct') {
        const cost = Number(item.costPrice) || 0;
        const markup = Number(item.markupPct) || 0;
        item.unitPrice = Number((cost * (1 + markup / 100)).toFixed(2));
        item.total = Number((item.quantity * item.unitPrice).toFixed(2));
      } else if (field === 'quantity' || field === 'unitPrice') {
        item.total = Number(((Number(item.quantity) || 1) * (Number(item.unitPrice) || 0)).toFixed(2));
      }

      next[index] = item;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: 'item_' + Date.now(),
        description: 'New Material Item',
        category: 'Electrical',
        quantity: 1,
        costPrice: 150,
        markupPct: 35,
        unitPrice: 202.5,
        unit: 'ea',
        total: 202.5,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Grand Totals
  const materialsSubtotal = items.reduce((sum, it) => sum + (it.total || 0), 0);
  const additionalLabourHours = Math.max(0, labourHours - 1);
  const labourTotal = calloutFee + additionalLabourHours * labourRate;
  const subtotal = materialsSubtotal + labourTotal;
  const vatAmount = Number((subtotal * 0.15).toFixed(2));
  const totalAmount = Number((subtotal + vatAmount).toFixed(2));
  const depositAmount = Number((totalAmount * (depositPct / 100)).toFixed(2));

  // Build Quote Object
  const generateFinalQuoteObject = (): Omit<Quotation, 'id'> => {
    const quoteNumber = getNextQuoteNumber();
    const today = new Date().toISOString().split('T')[0];
    const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return {
      quoteNumber,
      date: today,
      expiryDate: expiry,
      clientId: 'c_' + Date.now(),
      clientName: clientName || 'Field Client',
      clientPhone: clientPhone || '',
      clientAddress: clientAddress || 'On-site Client Location',
      serviceType,
      scopeOfWork,
      items: items.map((it) => ({
        id: it.id,
        description: it.description,
        category: it.category,
        costPrice: it.costPrice,
        markupPct: it.markupPct,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        unit: it.unit,
        total: it.total,
        inventoryId: it.inventoryId,
      })),
      calloutFee,
      labourHours,
      labourRatePerHour: labourRate,
      labourTotal,
      travelDistanceKm: 0,
      travelRatePerKm: 6.5,
      travelTotal: 0,
      subtotal,
      discountPct: 0,
      discountAmount: 0,
      vatEnabled: true,
      vatAmount,
      totalAmount,
      depositPercentage: depositPct,
      depositAmount,
      status: 'draft',
      notes,
      terms: '50% deposit required upon quotation acceptance. Balance due upon completion and SANS 10142-1 compliance testing.',
    };
  };

  // 1-Tap Save & Create Quote
  const handleSaveQuote = (autoDeductStock: boolean = false) => {
    setIsSaving(true);
    try {
      const quoteData = generateFinalQuoteObject();
      const savedQuote = addQuote(quoteData);

      // Auto-add client if new
      if (clientName && clientName !== 'Field Client') {
        const existingClient = clients.find(
          (c) => c.name.toLowerCase() === clientName.toLowerCase() || (clientPhone && c.phone === clientPhone)
        );
        if (!existingClient) {
          addClient({
            name: clientName,
            phone: clientPhone || '',
            address: clientAddress || '',
          });
        }
      }

      if (autoDeductStock) {
        const stockToDeduct = items
          .filter((it) => it.inventoryId || it.sku)
          .map((it) => ({ id: it.inventoryId, sku: it.sku, quantity: it.quantity }));
        if (stockToDeduct.length > 0) {
          deductStock(stockToDeduct);
        }
      }

      if (onQuoteCreated) {
        onQuoteCreated(savedQuote);
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // 1-Tap WhatsApp Share
  const handleShareWhatsApp = async () => {
    const quoteData = generateFinalQuoteObject();
    const savedQuote = addQuote(quoteData);

    const message = `*QUOTATION: ${savedQuote.quoteNumber}*\n*From:* ${profile.companyName}\n*Client:* ${savedQuote.clientName}\n*Service:* ${savedQuote.serviceType}\n*Scope:* ${savedQuote.scopeOfWork}\n\n*Total (incl. VAT):* ${formatZAR(savedQuote.totalAmount)}\n*Deposit Required (50%):* ${formatZAR(savedQuote.depositAmount || 0)}\n\n_Valid for 14 days. SANS 10142-1 certified._\n\nBanking Details:\n${profile.bankName} | Acc: ${profile.accountNumber} | Branch: ${profile.branchCode}`;

    const cleanPhone = (clientPhone || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('0') ? '27' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    // Generate & download PDF directly
    try {
      const doc = buildJsPDFDocument('quote', savedQuote, profile);
      const blob = doc.output('blob');
      await saveOrShareFile(blob, `${savedQuote.quoteNumber}_${(savedQuote.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, 'application/pdf', `Quotation ${savedQuote.quoteNumber}`, true);
    } catch (e) {
      console.warn('PDF export error:', e);
    }

    try {
      const a = document.createElement('a');
      a.href = waUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 1000);
    } catch (e) {
      window.location.href = waUrl;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden transition-all my-auto ${
          sunlightMode
            ? 'bg-white border-slate-300 text-slate-900'
            : 'bg-[#151824] border-[#2A3146] text-white'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/40 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">Voice-to-Quote & Job Engine</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  AI FLASH
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Speak your on-site quote naturally in plain English or trade slang
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {!parsedData ? (
            /* STEP 1: VOICE RECORDING & LIVE WAVEFORM */
            <div className="space-y-6 text-center py-4">
              {/* Giant Hero Voice FAB */}
              <div className="flex flex-col items-center justify-center relative">
                {/* Waveform Pulse Rings */}
                {isListening && (
                  <div className="absolute w-44 h-44 rounded-full bg-amber-500/20 animate-ping pointer-events-none" />
                )}
                {isListening && (
                  <div className="absolute w-36 h-36 rounded-full bg-red-500/30 animate-pulse pointer-events-none" />
                )}

                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 cursor-pointer relative z-10 ${
                    isListening
                      ? 'bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 text-white shadow-red-500/40 scale-105'
                      : 'bg-gradient-to-tr from-amber-500 via-amber-400 to-orange-500 text-slate-950 hover:shadow-amber-500/40 hover:scale-105'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-10 h-10 animate-bounce" />
                      <span className="text-[11px] font-black uppercase mt-1 tracking-wider">Listening</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-10 h-10" />
                      <span className="text-[11px] font-black uppercase mt-1 tracking-wider">Tap to Speak</span>
                    </>
                  )}
                </button>

                {/* Live Audio Visualizer Bars */}
                {isListening && (
                  <div className="flex items-center justify-center space-x-1.5 mt-6 h-8">
                    {[12, 28, 45, 80, 55, 90, 70, 40, 85, 60, 30, 15].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-gradient-to-t from-amber-500 to-rose-500 rounded-full transition-all duration-75"
                        style={{
                          height: `${Math.max(6, Math.min(32, (h * audioLevel) / 60))}px`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Status Message */}
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-200">
                  {isListening
                    ? 'Listening to your voice... Speak clearly into your device.'
                    : 'Tap the microphone and say something like:'}
                </p>
                <p className="text-xs text-amber-300/90 italic bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 max-w-lg mx-auto">
                  "Quote for Mr. Jacobs in Sandton, phone 0824567890. Install 5kW inverter, 100m 6mm solar cable, 40A double pole breaker, 4 hours labour. 50% deposit required."
                </p>
              </div>

              {/* Live Transcript Display */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Live Transcribed Text</span>
                  {transcript && (
                    <button
                      type="button"
                      onClick={() => setTranscript('')}
                      className="text-[11px] text-slate-500 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your transcribed voice notes will appear here in real-time, or you can type directly..."
                  rows={4}
                  className={`w-full p-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    sunlightMode
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-[#1C2030] border-[#2C344D] text-slate-100 placeholder-slate-500'
                  }`}
                />
              </div>

              {audioError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{audioError}</span>
                </div>
              )}

              {/* Action: Generate Structured Quote */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProcessTranscript}
                  disabled={!transcript.trim() || isProcessing}
                  className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer ${
                    !transcript.trim() || isProcessing
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 text-slate-950 shadow-amber-500/30 hover:opacity-95'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Parsing with Gemini 2.5 Flash...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Generate Structured Quotation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: INTERACTIVE STRUCTURED QUOTE CARD */
            <div className="space-y-5 animate-fadeIn">
              {/* Header Info Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wand2 className="w-5 h-5 text-amber-400" />
                  <div>
                    <span className="font-bold text-xs text-amber-300 block">Structured Output Extracted</span>
                    <span className="text-[11px] text-slate-400">
                      Tweak details below before creating your PDF or sending via WhatsApp
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setParsedData(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  Re-record
                </button>
              </div>

              {/* Client & Service Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Client Name</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-white font-medium focus:ring-1 focus:ring-amber-500"
                    placeholder="e.g. John Smith"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-sky-400" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-white font-medium focus:ring-1 focus:ring-amber-500"
                    placeholder="082 123 4567"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>Site Address</span>
                  </label>
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-white font-medium focus:ring-1 focus:ring-amber-500"
                    placeholder="e.g. Sandton, JHB"
                  />
                </div>
              </div>

              {/* Scope of Work */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Scope of Work</label>
                <textarea
                  value={scopeOfWork}
                  onChange={(e) => setScopeOfWork(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-white font-medium focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>Parsed Materials & Hardware ({items.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {items.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={it.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-bold text-slate-200"
                          placeholder="Item Description"
                        />
                        {it.stockQty !== null && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              it.stockQty > 0
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {it.stockQty > 0 ? `In Stock (${it.stockQty})` : 'Out of Stock'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Qty ({it.unit || 'ea'})</span>
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                            className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-slate-500 block">Cost (ZAR)</span>
                          <input
                            type="number"
                            value={it.costPrice}
                            onChange={(e) => updateItem(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-slate-500 block">Markup %</span>
                          <input
                            type="number"
                            value={it.markupPct}
                            onChange={(e) => updateItem(idx, 'markupPct', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-amber-400 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-slate-500 block">Sell (Total)</span>
                          <div className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700 text-emerald-400 font-mono font-bold text-right">
                            {formatZAR(it.total)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Labour, Callout & Deposit Policy */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Call-Out Fee</span>
                  <input
                    type="number"
                    value={calloutFee}
                    onChange={(e) => setCalloutFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Labour Hours</span>
                  <input
                    type="number"
                    value={labourHours}
                    onChange={(e) => setLabourHours(parseFloat(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Deposit Required %</span>
                  <select
                    value={depositPct}
                    onChange={(e) => setDepositPct(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 font-bold"
                  >
                    <option value={0}>0% (No Deposit)</option>
                    <option value={30}>30% Deposit</option>
                    <option value={50}>50% Deposit (Standard)</option>
                    <option value={70}>70% Deposit (High Material)</option>
                  </select>
                </div>
              </div>

              {/* Financial Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Materials Total:</span>
                  <span className="font-mono">{formatZAR(materialsSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Labour & Callout:</span>
                  <span className="font-mono">{formatZAR(labourTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>15% SARS VAT:</span>
                  <span className="font-mono">{formatZAR(vatAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                  <span>Grand Total:</span>
                  <span className="text-emerald-400 font-mono">{formatZAR(totalAmount)}</span>
                </div>
                {depositAmount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-amber-400 pt-1">
                    <span>{depositPct}% Upfront Deposit:</span>
                    <span className="font-mono">{formatZAR(depositAmount)}</span>
                  </div>
                )}
              </div>

              {/* 1-Tap Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send WhatsApp PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveQuote(true)}
                  disabled={isSaving}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/30 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>Save Quote & Reserve Stock</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
