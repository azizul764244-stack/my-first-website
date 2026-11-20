import React, { useRef, useState } from 'react';
import { Check, Copy, Film, Loader2, Megaphone, Send } from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { VoiceInputButton } from '../components/VoiceControls';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { AiClientError, postAiJson } from '../utils/api';
import type {
  AiErrorCode,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
  SocialContentResult,
} from '../types';

interface SocialPageProps {
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
  onSendPromptToVideoStudio: (prompt: string) => void;
}

const PLATFORMS: ('Facebook' | 'TikTok' | 'YouTube')[] = ['Facebook', 'TikTok', 'YouTube'];
const TONES = [
  { id: 'Informative & Engaging', en: 'Informative & Engaging', bn: 'তথ্যবহুল ও আকর্ষণীয়' },
  { id: 'Educational & Simple', en: 'Educational & Simple', bn: 'শিক্ষামূলক ও সহজ' },
  { id: 'Inspirational & Storytelling', en: 'Inspirational & Storytelling', bn: 'প্রেরণাদায়ক ও গল্পনির্ভর' },
  { id: 'Entertaining & Fast-Paced', en: 'Entertaining & Fast-Paced', bn: 'বিনোদনমূলক ও দ্রুতগতির' },
];

export const SocialPage: React.FC<SocialPageProps> = ({
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onResultSuccess,
  onSendPromptToVideoStudio,
}) => {
  const { uiLang, t } = useUiLanguage();
  const [platform, setPlatform] = useState<'Facebook' | 'TikTok' | 'YouTube'>('YouTube');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState(TONES[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<SocialContentResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // ignore
    }
  };

  const executeSocial = async () => {
    if (inFlightRef.current) return;
    if (!topic.trim()) {
      setError(t('Please enter a video or post topic.', 'অনুগ্রহ করে ভিডিও বা পোস্টের বিষয় লিখুন।'));
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

    try {
      const data = await postAiJson<{
        result: SocialContentResult;
        historyItem: HistoryItem;
        quota: QuotaState;
      }>('/api/ai/social', { platform, topic, tone, responseLanguage });
      setResult(data.result);
      onResultSuccess(data.historyItem, data.quota);
    } catch (err) {
      if (err instanceof AiClientError) {
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
    await executeSocial();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('Social Media AI', 'সোশ্যাল মিডিয়া AI')}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t(
            'Viral Video Ideas, Scripts, Captions & Video Prompts',
            'ভাইরাল আইডিয়া, স্ক্রিপ্ট, ক্যাপশন ও ভিডিও প্রম্পট'
          )}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Platform', 'প্ল্যাটফর্ম')}
            </label>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 min-h-[38px] rounded-lg text-xs font-medium transition-colors ${
                    platform === p
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Content Tone', 'উপস্থাপনার ধরন (Tone)')}
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {TONES.map((toneOpt) => (
                <option key={toneOpt.id} value={toneOpt.id}>
                  {uiLang === 'bn' ? toneOpt.bn : toneOpt.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Video or Content Topic', 'ভিডিও বা কনটেন্টের বিষয়')}
            </label>
            <VoiceInputButton
              language={responseLanguage}
              onTranscript={(text) =>
                setTopic((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
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
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t(
              'e.g., 5 practical steps to start freelancing on mobile',
              'যেমন: মোবাইল ফোনে ফ্রিল্যান্সিং শেখার সঠিক ৫টি ধাপ'
            )}
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>
              {loading
                ? t('Creating Content Package...', 'কনটেন্ট তৈরি হচ্ছে...')
                : t('Generate Content Package', 'সম্পূর্ণ কনটেন্ট প্যাকেজ তৈরি করুন')}
            </span>
          </button>
        </div>
      </form>

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        onRetry={executeSocial}
        retrying={loading}
        activeModel={activeModel}
        availableModels={availableModels}
        onSwitchModel={onSwitchModel}
      />

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('Video Ideas & Titles', 'ভিডিও আইডিয়া ও শিরোনাম')} ({result.platform})
                </h2>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(result.ideas || []).map((idea, idx) => (
                  <div key={idx} className="py-2.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {idx + 1}. {idea.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{idea.angle}</p>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  {t('Catchy Titles', 'প্রস্তাবিত আকর্ষণীয় শিরোনাম')}
                </p>
                <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                  {(result.titles || []).map((title, i) => (
                    <li key={i}>• {title}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('Video Script', 'ভিডিও স্ক্রিপ্ট')}
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      'script',
                      `Hook: ${result.script?.hook}\n\nBody: ${result.script?.body}\n\nCTA: ${result.script?.cta}`
                    )
                  }
                  className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
                >
                  {copiedKey === 'script' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'script' ? t('Copied', 'কপি হয়েছে') : t('Copy Script', 'স্ক্রিপ্ট কপি')}</span>
                </button>
              </div>

              <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                    {t('First 3 Seconds (Hook)', 'প্রথম ৩ সেকেন্ড (Hook)')}
                  </p>
                  <p>{result.script?.hook}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                    {t('Main Body', 'মূল অংশ')}
                  </p>
                  <p>{result.script?.body}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                    {t('Call to Action (CTA)', 'কল টু অ্যাকশন (CTA)')}
                  </p>
                  <p>{result.script?.cta}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('Caption & Hashtags', 'ক্যাপশন ও হ্যাশট্যাগ')}
              </h3>
              <button
                type="button"
                onClick={() =>
                  copyText('caption', `${result.caption}\n\n${(result.hashtags || []).join(' ')}`)
                }
                className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
              >
                {copiedKey === 'caption' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'caption' ? t('Copied', 'কপি হয়েছে') : t('Copy', 'কপি করুন')}</span>
              </button>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{result.caption}</p>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              {(result.hashtags || []).join(' ')}
            </p>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('AI Video Prompt (English Production Prompt)', 'AI ভিডিও প্রম্পট (ইংরেজি প্রোডাকশন প্রম্পট)')}
                </h3>
                <button
                  type="button"
                  onClick={() => onSendPromptToVideoStudio(result.aiVideoPrompt)}
                  className="min-h-[40px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Film className="w-4 h-4" />
                  <span>{t('Open in Flow Video Studio', 'ভিডিও স্টুডিওতে নিয়ে যান')}</span>
                </button>
              </div>
              <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {result.aiVideoPrompt}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
