import React, { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  lang?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  className = '',
  lang = 'en-ZA',
}) => {
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    let recognition: any = null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && isListening) {
      try {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          if (current) {
            onTranscript(current);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Voice dictation error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err) {
        console.warn('SpeechRecognition failed:', err);
        setIsListening(false);
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
  }, [isListening, lang, onTranscript]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsListening((prev) => !prev);
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      title={isListening ? 'Stop Voice Dictation' : 'Dictate with Voice (en-ZA)'}
      className={`p-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 transition-all cursor-pointer ${
        isListening
          ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
          : 'bg-[#282E3E] text-slate-400 hover:text-amber-400 hover:bg-[#334155]'
      } ${className}`}
    >
      {isListening ? (
        <>
          <MicOff className="w-3.5 h-3.5" />
          <span className="text-[10px]">Listening...</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] hidden sm:inline">Voice Note</span>
        </>
      )}
    </button>
  );
};
