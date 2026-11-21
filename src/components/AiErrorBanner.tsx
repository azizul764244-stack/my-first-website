import React, { useState } from 'react';
import { AlertCircle, Cpu, Loader2, RefreshCw } from 'lucide-react';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import type { AiErrorCode, GeminiModelId, GeminiModelOption } from '../types';

interface AiErrorBannerProps {
  error: string | null;
  errorCode?: AiErrorCode;
  retryAfterSec?: number;
  onRetry?: () => void;
  retrying?: boolean;
  activeModel?: GeminiModelId;
  availableModels?: GeminiModelOption[];
  onSwitchModel?: (modelId: GeminiModelId) => Promise<void> | void;
}

export const AiErrorBanner: React.FC<AiErrorBannerProps> = ({
  error,
  errorCode,
  retryAfterSec,
  onRetry,
  retrying = false,
  activeModel,
  availableModels,
  onSwitchModel,
}) => {
  const { t } = useUiLanguage();
  const [switching, setSwitching] = useState(false);
  const [switchedNotice, setSwitchedNotice] = useState<string | null>(null);

  if (!error) return null;

  const showModelSwitcher =
    errorCode === 'quota_exhausted' ||
    errorCode === 'rate_limit' ||
    errorCode === 'overloaded' ||
    errorCode === 'not_found' ||
    errorCode === 'network';

  const freeTierAlternatives = (availableModels ?? []).filter(
    (m) => m.isFreeTier && m.id !== activeModel
  );

  const heading =
    errorCode === 'not_found'
      ? t('Selected Gemini Model Not Found (404)', 'নির্বাচিত Gemini মডেলটি পাওয়া যায়নি (Error 404)')
      : errorCode === 'quota_exhausted'
        ? t('AI API Quota Exhausted (429)', 'এআই API কোটা পূর্ণ হয়েছে (৪২৯)')
        : errorCode === 'rate_limit'
          ? t('Temporary Rate Limit Reached (429)', 'সাময়িক অনুরোধ সীমা পূর্ণ হয়েছে (৪২৯)')
          : errorCode === 'overloaded'
            ? t('Selected Gemini Model Temporarily Unavailable (503)', 'নির্বাচিত Gemini মডেলটি সাময়িকভাবে অনুপলব্ধ (৫০৩)')
            : errorCode === 'auth'
              ? t('Gemini API Connection / Key Issue', 'Gemini API সংযোগ বা কী (Key) সমস্যা')
              : t('AI Request Failed', 'এআই অনুরোধ সম্পন্ন করা যায়নি');

  const handleModelChange = async (nextModelId: GeminiModelId) => {
    if (!onSwitchModel || nextModelId === activeModel) return;
    setSwitching(true);
    setSwitchedNotice(null);
    try {
      await onSwitchModel(nextModelId);
      setSwitchedNotice(
        t(
          `Switched to model "${nextModelId}" — click Retry to try again.`,
          `মডেল "${nextModelId}"-এ পরিবর্তন হয়েছে — এখন "আবার চেষ্টা করুন" বাটনে চাপ দিন।`
        )
      );
    } catch {
      setSwitchedNotice(
        t(
          'Could not switch model right now. Please try again.',
          'এই মুহূর্তে মডেল পরিবর্তন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
        )
      );
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div
      role="alert"
      className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 text-sm text-rose-900 dark:text-rose-100">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-xs sm:text-sm">{heading}</p>
            <p className="text-xs sm:text-sm leading-relaxed text-rose-800 dark:text-rose-200">
              {error}
            </p>
            {retryAfterSec && errorCode === 'rate_limit' && (
              <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                {t(
                  `Suggested wait: retry in about ${retryAfterSec} seconds.`,
                  `প্রস্তাবিত বিরতি: প্রায় ${retryAfterSec} সেকেন্ড পর আবার চেষ্টা করুন।`
                )}
              </p>
            )}
          </div>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying || switching}
            className="min-h-[42px] px-4 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            {retrying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{retrying ? t('Retrying...', 'চেষ্টা করা হচ্ছে...') : t('Retry', 'আবার চেষ্টা করুন')}</span>
          </button>
        )}
      </div>

      {showModelSwitcher && availableModels && availableModels.length > 0 && onSwitchModel && (
        <div className="pt-2.5 border-t border-rose-200/80 dark:border-rose-800/70 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-rose-800 dark:text-rose-200">
              <Cpu className="w-4 h-4 shrink-0" />
              <span>
                {t(
                  'Manually switch to another free-tier Gemini model (never auto-switches to paid):',
                  'অন্য একটি ফ্রি-টিয়ার Gemini মডেল নির্বাচন করুন (স্বয়ংক্রিয়ভাবে পেইড মডেলে নেওয়া হয় না):'
                )}
              </span>
            </div>
            <select
              aria-label={t('Switch Gemini model', 'Gemini মডেল পরিবর্তন করুন')}
              disabled={switching || retrying}
              value={activeModel}
              onChange={(e) => handleModelChange(e.target.value as GeminiModelId)}
              className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-xs font-medium text-slate-800 dark:text-slate-100"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.labelBn} ({m.isFreeTier ? t('Free Tier', 'ফ্রি টিয়ার') : t('Paid API', 'পেইড API')})
                </option>
              ))}
            </select>
          </div>

          {freeTierAlternatives.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {freeTierAlternatives.map((alt) => (
                <button
                  key={alt.id}
                  type="button"
                  disabled={switching || retrying}
                  onClick={() => handleModelChange(alt.id)}
                  className="min-h-[34px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 disabled:opacity-60 text-xs font-semibold text-rose-900 dark:text-rose-100 transition-colors"
                >
                  {t(`Use ${alt.id} (Free Tier)`, `${alt.labelBn} (ফ্রি) চালু করুন`)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {switchedNotice && (
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {switchedNotice}
        </p>
      )}
    </div>
  );
};
