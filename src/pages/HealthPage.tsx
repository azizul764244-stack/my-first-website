import React, { useRef, useState } from 'react';
import { AlertTriangle, HeartPulse, Loader2, PhoneCall, Send, Stethoscope } from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { RichAnswer } from '../components/RichAnswer';
import { VoiceInputButton } from '../components/VoiceControls';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { AiClientError, streamAiSse } from '../utils/api';
import type {
  AiErrorCode,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface HealthPageProps {
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
}

const SAMPLE_HEALTH = [
  {
    en: 'What is high blood pressure (hypertension) and what precautions are helpful?',
    bn: 'রক্তচাপ বা হাইপারটেনশন বলতে কী বোঝায় এবং সাধারণ সতর্কতা কী?',
  },
  {
    en: 'How does Paracetamol work and what dosage safety warnings apply?',
    bn: 'প্যারাসিটামল ওষুধ কীভাবে কাজ করে ও ব্যবহারে কী সতর্কতা মানা জরুরি?',
  },
  {
    en: 'When should someone with fever and body ache visit a doctor urgently?',
    bn: 'জ্বর ও শরীর ব্যথার সময় কখন দ্রুত ডাক্তারের কাছে যাওয়া উচিত?',
  },
];

export const HealthPage: React.FC<HealthPageProps> = ({
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onResultSuccess,
}) => {
  const { uiLang, t } = useUiLanguage();
  const [mode, setMode] = useState<'general' | 'symptom' | 'medicine'>('general');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const inFlightRef = useRef(false);

  const executeHealth = async () => {
    if (inFlightRef.current) return;
    if (!query.trim()) {
      setError(t('Please enter your health question.', 'অনুগ্রহ করে আপনার স্বাস্থ্য বিষয়ক প্রশ্নটি লিখুন।'));
      setErrorCode(undefined);
      setRetryAfterSec(undefined);
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    onBusyChange(true);
    setError(null);
    setErrorCode(undefined);
    setRetryAfterSec(undefined);
    setAnswer('');

    try {
      await streamAiSse<{
        answer: string;
        isUrgent: boolean;
        historyItem: HistoryItem;
        quota: QuotaState;
      }>(
        '/api/ai/health',
        { mode, query, responseLanguage, modelId: activeModel },
        {
          onDelta: (chunk) => {
            setAnswer((prev) => (prev ?? '') + chunk);
          },
          onDone: (data) => {
            setAnswer(data.answer);
            setIsUrgent(Boolean(data.isUrgent));
            onResultSuccess(data.historyItem, data.quota);
          },
        }
      );
    } catch (err) {
      setAnswer(null);
      if (err instanceof Error && err instanceof AiClientError) {
        setError(err.message);
        setErrorCode(err.errorCode);
        setRetryAfterSec(err.retryAfterSec);
      } else {
        setError(err instanceof Error ? err.message : t('Unexpected error.', 'অপ্রত্যাশিত ত্রুটি হয়েছে।'));
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      onBusyChange(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeHealth();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
          {t(
            'Ad-Free Safe Health Guidance · Never Diagnoses Diseases',
            'বিজ্ঞাপনমুক্ত নিরাপদ স্বাস্থ্য সহায়তা · কোনো রোগ নির্ণয় করা হয় না'
          )}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('General Health & Medicine Information', 'সাধারণ স্বাস্থ্য ও ওষুধ তথ্য')}
        </h1>
      </div>

      {/* Mandatory Medical Safety Notice */}
      <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 flex items-start gap-3">
        <Stethoscope className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed space-y-1">
          <p className="font-semibold text-slate-900 dark:text-white">
            {t('Important Medical Safety Notice', 'গুরুত্বপূর্ণ চিকিৎসা সতর্কতা')}
          </p>
          <p>
            {t(
              'Sathi AI only explains general health concepts, medical terms, and medicine precautions. It never diagnoses diseases or replaces a qualified doctor. Always consult an MBBS or licensed physician before taking medication.',
              'সাথী AI কেবল সাধারণ স্বাস্থ্য তথ্য, চিকিৎসা পরিভাষা এবং ওষুধের সাধারণ সতর্কতা ব্যাখ্যা করে। এটি কোনো রোগ নির্ণয় করে না বা চিকিৎসকের বিকল্প নয়। যেকোনো অসুস্থতা বা ওষুধ গ্রহণের আগে অবশ্যই রেজিস্টার্ড MBBS বা বিশেষজ্ঞ চিকিৎসকের পরামর্শ নিন।'
            )}
          </p>
        </div>
      </div>

      {isUrgent && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-rose-900 dark:text-rose-200">
            <p className="font-bold mb-1">
              {t('Urgent Medical Attention May Be Needed', 'জরুরি চিকিৎসা সহায়তা প্রয়োজন হতে পারে')}
            </p>
            <p className="text-xs sm:text-sm mb-2">
              {t(
                'Your symptoms may require immediate emergency care. Visit the nearest hospital ER or call emergency services immediately.',
                'আপনার বর্ণিত লক্ষণগুলো জরুরি অবস্থার ইঙ্গিত দিতে পারে। দেরি না করে নিকটস্থ হাসপাতালের জরুরি বিভাগে যান অথবা জরুরি সেবায় কল করুন।'
              )}
            </p>
            <a
              href="tel:999"
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-rose-700 text-white text-xs font-semibold"
            >
              <PhoneCall className="w-4 h-4" />
              <span>{t('Emergency Service 999', 'জরুরি সেবা ৯৯৯')}</span>
            </a>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
          {(
            [
              { id: 'general', en: 'General Info', bn: 'সাধারণ তথ্য' },
              { id: 'symptom', en: 'Symptoms & Terms', bn: 'লক্ষণ ও পরিভাষা' },
              { id: 'medicine', en: 'Medicine Info', bn: 'ওষুধের তথ্য' },
            ] as { id: 'general' | 'symptom' | 'medicine'; en: string; bn: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                mode === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t(tab.en, tab.bn)}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('What would you like to know?', 'কী বিষয়ে জানতে চান?')}
            </label>
            <VoiceInputButton
              language={responseLanguage}
              onTranscript={(text) =>
                setQuery((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
              }
              onError={(err) => {
                if (typeof err === 'string') {
                  setError(err);
                } else {
                  setError(err.message);
                  setErrorCode(err.errorCode);
                }
              }}
              disabled={loading}
              compact
            />
          </div>
          <textarea
            rows={4}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              'e.g., What are common signs of low hemoglobin or what safety rules apply to antibiotics?',
              'যেমন: হিমোগ্লোবিন কমে যাওয়ার সাধারণ লক্ষণগুলো কী কী? বা অ্যান্টিবায়োটিক ওষুধ গ্রহণে কী সতর্কতা মানা উচিত?'
            )}
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('Examples:', 'উদাহরণ:')}
          </span>
          {SAMPLE_HEALTH.map((sample) => {
            const label = uiLang === 'bn' ? sample.bn : sample.en;
            return (
              <button
                key={sample.en}
                type="button"
                onClick={() => setQuery(label)}
                className="px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-xs text-slate-700 dark:text-slate-300 transition-colors text-left"
              >
                {label.slice(0, 42)}...
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{loading ? t('Generating Info...', 'তথ্য প্রস্তুত হচ্ছে...') : t('Get Health Info', 'সাধারণ তথ্য জানুন')}</span>
          </button>
        </div>
      </form>

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        onRetry={executeHealth}
        retrying={loading}
        activeModel={activeModel}
        availableModels={availableModels}
        onSwitchModel={onSwitchModel}
      />

      {loading && !answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{t('Preparing general health information...', 'সাধারণ স্বাস্থ্য তথ্য প্রস্তুত হচ্ছে...')}</span>
        </div>
      )}

      {answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <HeartPulse className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('Health Information & Precautions', 'স্বাস্থ্য বিষয়ক তথ্য ও সতর্কতা')}
            </h2>
          </div>
          <RichAnswer content={answer} isStreaming={loading} language={responseLanguage} />
        </div>
      )}
    </div>
  );
};
