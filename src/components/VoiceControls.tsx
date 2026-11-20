import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Square, Volume2 } from 'lucide-react';
import { getBcp47Locale } from '../constants/languages';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { AiClientError, postAiJson } from '../utils/api';
import type { ResponseLanguageCode } from '../types';

// Client-side WAV cache prevents duplicate /api/ai/tts calls when replaying the same answer
const ttsClientCache = new Map<string, string>();

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function detectTextBcp47Locale(text: string, preferred: ResponseLanguageCode): string {
  if (preferred && preferred !== 'auto') {
    return getBcp47Locale(preferred);
  }
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-BD';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar-SA';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja-JP';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko-KR';
  return 'en-US';
}

function stripMarkdownForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

interface VoiceInputButtonProps {
  language: ResponseLanguageCode;
  onTranscript: (text: string) => void;
  onError?: (err: AiClientError | string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  language,
  onTranscript,
  onError,
  disabled = false,
  compact = false,
}) => {
  const { t } = useUiLanguage();
  const [status, setStatus] = useState<'idle' | 'listening' | 'recording' | 'transcribing'>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStreamTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const transcribeRecordedBlob = async (blob: Blob, mimeType: string) => {
    if (!mountedRef.current) return;
    setStatus('transcribing');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const commaIdx = dataUrl.indexOf(',');
          resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
        };
        reader.onerror = () => reject(new Error('অডিও ফাইল পড়া যায়নি।'));
        reader.readAsDataURL(blob);
      });

      const res = await postAiJson<{ text: string }>('/api/ai/transcribe', {
        audioBase64: base64,
        mimeType: mimeType || 'audio/webm',
        responseLanguage: language,
      });

      if (mountedRef.current && res.text?.trim()) {
        onTranscript(res.text.trim());
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof AiClientError) {
        onError?.(err);
      } else {
        onError?.('ভয়েস লেখা রূপান্তরে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    } finally {
      if (mountedRef.current) {
        setStatus('idle');
      }
    }
  };

  const startFallbackRecorder = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError?.('এই ব্রাউজারে মাইক্রোফোন রেকর্ডিং সমর্থিত নয়।');
      setStatus('idle');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };
      recorder.onstop = async () => {
        const mime = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        stopStreamTracks();
        if (blob.size < 400) {
          if (mountedRef.current) {
            setStatus('idle');
            onError?.('কোনো স্পষ্ট কথা শোনা যায়নি। অনুগ্রহ করে আবার বলুন।');
          }
          return;
        }
        await transcribeRecordedBlob(blob, mime.split(';')[0]);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      if (mountedRef.current) {
        setStatus('recording');
      }
    } catch {
      stopStreamTracks();
      if (mountedRef.current) {
        setStatus('idle');
        onError?.('মাইক্রোফোনের অনুমতি পাওয়া যায়নি। ব্রাউজার সেটিংস থেকে মাইক্রোফোন চালু করুন।');
      }
    }
  };

  const handleToggleVoice = async () => {
    if (disabled || status === 'transcribing') return;

    if (status === 'listening') {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setStatus('idle');
      return;
    }

    if (status === 'recording') {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        stopStreamTracks();
        setStatus('idle');
      }
      return;
    }

    const SpeechCtor = getSpeechRecognitionCtor();
    if (SpeechCtor) {
      try {
        const recognition = new SpeechCtor();
        recognition.lang = getBcp47Locale(language);
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        let gotResult = false;
        let fellBack = false;

        recognition.onstart = () => {
          if (mountedRef.current) setStatus('listening');
        };

        recognition.onresult = (event) => {
          const parts: string[] = [];
          for (let i = 0; i < event.results.length; i += 1) {
            const item = event.results[i];
            if (item?.[0]?.transcript) {
              parts.push(item[0].transcript);
            }
          }
          const combined = parts.join(' ').trim();
          if (combined) {
            gotResult = true;
            onTranscript(combined);
          }
        };

        recognition.onerror = (ev) => {
          if (!mountedRef.current) return;
          if (ev.error === 'not-allowed' || ev.error === 'audio-capture') {
            setStatus('idle');
            onError?.('মাইক্রোফোন ব্যবহারের অনুমতি দিন এবং ডিভাইস সংযুক্ত আছে কি না দেখুন।');
            return;
          }
          if (ev.error === 'service-not-allowed' || ev.error === 'network' || ev.error === 'language-not-supported') {
            fellBack = true;
            void startFallbackRecorder();
            return;
          }
          if (ev.error === 'no-speech') {
            setStatus('idle');
            onError?.('কোনো কথা শোনা যায়নি। আবার মাইক বাটনে চাপ দিয়ে বলুন।');
            return;
          }
          setStatus('idle');
        };

        recognition.onend = () => {
          if (!mountedRef.current) return;
          if (!fellBack) {
            setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch {
        // Fallback to MediaRecorder + /api/ai/transcribe
      }
    }

    await startFallbackRecorder();
  };

  const active = status === 'listening' || status === 'recording';
  const busy = status === 'transcribing';

  return (
    <button
      type="button"
      onClick={handleToggleVoice}
      disabled={disabled || busy}
      title={
        active
          ? t('Stop voice', 'ভয়েস থামান')
          : busy
            ? t('Transcribing voice...', 'কথা টেক্সটে রূপান্তর হচ্ছে...')
            : t('Speak with voice', 'ভয়েস দিয়ে বলুন')
      }
      aria-label={active ? t('Stop voice recording', 'ভয়েস রেকর্ডিং থামান') : t('Start voice input', 'ভয়েস ইনপুট চালু করুন')}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
        compact ? 'min-h-[38px] px-3 text-xs' : 'min-h-[44px] px-3.5 text-xs font-semibold'
      } ${
        active
          ? 'bg-rose-600 hover:bg-rose-700 border-rose-600 text-white animate-pulse'
          : 'bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
      } disabled:opacity-50`}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
      ) : active ? (
        <MicOff className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4 text-blue-700 dark:text-blue-400" />
      )}
      <span>
        {busy
          ? t('Converting...', 'রূপান্তর হচ্ছে...')
          : active
            ? t('Listening... (Stop)', 'শুনছি... (থামান)')
            : compact
              ? t('Voice', 'ভয়েস')
              : t('Speak', 'ভয়েস বলুন')}
      </span>
    </button>
  );
};

interface VoiceOutputButtonProps {
  text: string;
  language?: ResponseLanguageCode;
  compact?: boolean;
  autoSpeakKey?: string;
  onError?: (err: AiClientError | string) => void;
}

export const VoiceOutputButton: React.FC<VoiceOutputButtonProps> = ({
  text,
  language = 'en',
  compact = false,
  autoSpeakKey,
  onError,
}) => {
  const { t } = useUiLanguage();
  const [state, setState] = useState<'idle' | 'loading' | 'speaking'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  const lastAutoSpokenRef = useRef<string>('');

  const stopPlayback = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if (mountedRef.current) {
      setState('idle');
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPlayback();
    };
  }, []);

  const playBase64Audio = async (audioBase64: string, mimeType: string) => {
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    audioRef.current = audio;
    audio.onended = () => {
      if (mountedRef.current) setState('idle');
      audioRef.current = null;
    };
    audio.onerror = () => {
      if (mountedRef.current) {
        setState('idle');
        onError?.('অডিও প্লে করতে সমস্যা হয়েছে।');
      }
      audioRef.current = null;
    };
    if (mountedRef.current) setState('speaking');
    await audio.play();
  };

  const findMatchingOsVoice = (bcp47: string): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const langPrefix = bcp47.split('-')[0].toLowerCase();
    return (
      voices.find((v) => v.lang.toLowerCase() === bcp47.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
      null
    );
  };

  const speakWithOsVoice = (cleanText: string, bcp47: string, voice: SpeechSynthesisVoice | null): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 1200));
      utterance.lang = bcp47;
      if (voice) utterance.voice = voice;
      utterance.rate = 1.0;
      utterance.onstart = () => {
        if (mountedRef.current) setState('speaking');
      };
      utterance.onend = () => {
        if (mountedRef.current) setState('idle');
      };
      utterance.onerror = () => {
        if (mountedRef.current) setState('idle');
      };
      setState('speaking');
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  };

  const handleSpeak = async () => {
    if (state === 'speaking' || state === 'loading') {
      stopPlayback();
      return;
    }

    const cleanText = stripMarkdownForSpeech(text);
    if (!cleanText) return;

    const bcp47 = detectTextBcp47Locale(cleanText, language);
    const osVoice = findMatchingOsVoice(bcp47);

    // Zero-quota native speech first if OS has a matching voice for that language
    if (osVoice) {
      const ok = speakWithOsVoice(cleanText, bcp47, osVoice);
      if (ok) return;
    }

    // Otherwise use cached or server Gemini TTS (supports Bengali, Hindi, English, Arabic, etc.)
    const cacheKey = `${bcp47}:${cleanText.slice(0, 900)}`;
    const cachedWav = ttsClientCache.get(cacheKey);
    if (cachedWav) {
      try {
        await playBase64Audio(cachedWav, 'audio/wav');
        return;
      } catch {
        // continue to fetch or fallback
      }
    }

    setState('loading');
    try {
      const res = await postAiJson<{ audioBase64: string; mimeType: string }>('/api/ai/tts', {
        text: cleanText.slice(0, 900),
        responseLanguage: language,
      });
      if (!mountedRef.current) return;
      ttsClientCache.set(cacheKey, res.audioBase64);
      await playBase64Audio(res.audioBase64, res.mimeType || 'audio/wav');
    } catch (err) {
      if (!mountedRef.current) return;
      // Graceful fallback to generic browser speechSynthesis if available
      const fallbackOk = speakWithOsVoice(cleanText, bcp47, null);
      if (fallbackOk) return;
      setState('idle');
      if (err instanceof AiClientError) {
        onError?.(err);
      } else {
        onError?.('ভয়েস আউটপুট চালু করা যায়নি।');
      }
    }
  };

  useEffect(() => {
    if (autoSpeakKey && autoSpeakKey !== lastAutoSpokenRef.current && text.trim()) {
      lastAutoSpokenRef.current = autoSpeakKey;
      void handleSpeak();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpeakKey]);

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={!text.trim()}
      aria-label={state === 'speaking' ? t('Stop voice', 'ভয়েস থামান') : t('Listen to answer', 'ভয়েসে শুনুন')}
      className={`inline-flex items-center gap-1.5 rounded-lg border transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
        compact ? 'px-2.5 py-1.5 min-h-[36px] text-xs' : 'px-3 py-1.5 min-h-[40px] text-xs font-medium'
      } ${
        state === 'speaking'
          ? 'bg-blue-700 text-white border-blue-700'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
      }`}
    >
      {state === 'loading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700 dark:text-blue-400" />
      ) : state === 'speaking' ? (
        <Square className="w-3 h-3 fill-current" />
      ) : (
        <Volume2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
      )}
      <span>
        {state === 'loading'
          ? t('Preparing audio...', 'অডিও তৈরি...')
          : state === 'speaking'
            ? t('Stop', 'থামান')
            : t('Listen', 'শুনুন')}
      </span>
    </button>
  );
};
