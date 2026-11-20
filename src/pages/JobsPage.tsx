import React, { useRef, useState } from 'react';
import { Briefcase, ExternalLink, Globe, Loader2, Search, ShieldAlert } from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { RichAnswer } from '../components/RichAnswer';
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

interface JobsPageProps {
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
}

const COUNTRIES = [
  { id: 'Saudi Arabia', en: 'Saudi Arabia', bn: 'সৌদি আরব (Saudi Arabia)' },
  { id: 'UAE', en: 'United Arab Emirates (UAE)', bn: 'সংযুক্ত আরব আমিরাত (UAE)' },
  { id: 'Qatar', en: 'Qatar', bn: 'কাতার (Qatar)' },
  { id: 'Malaysia', en: 'Malaysia', bn: 'মালয়েশিয়া (Malaysia)' },
  { id: 'Singapore', en: 'Singapore', bn: 'সিঙ্গাপুর (Singapore)' },
  { id: 'South Korea (EPS)', en: 'South Korea (EPS)', bn: 'দক্ষিণ কোরিয়া (EPS)' },
  { id: 'Europe (Italy/Romania/Poland)', en: 'Europe (Italy / Romania / Poland)', bn: 'ইউরোপ (ইতালি / রোমানিয়া / পোল্যান্ড)' },
];

const CATEGORIES = [
  { id: 'Electrician & Technician', en: 'Electrician & Technician', bn: 'ইলেকট্রিশিয়ান ও টেকনিশিয়ান' },
  { id: 'Construction & Welding', en: 'Construction & Welding', bn: 'নির্মাণ ও ওয়েল্ডিং কর্মী' },
  { id: 'Driving & Delivery', en: 'Driving & Delivery', bn: 'ড্রাইভিং ও ডেলিভারি' },
  { id: 'Hospitality & Hotel Staff', en: 'Hospitality & Hotel Staff', bn: 'হসপিটালিটি ও হোটেল স্টাফ' },
  { id: 'Factory & Warehouse', en: 'Factory & Warehouse Worker', bn: 'ফ্যাক্টরি ও ওয়্যারহাউস কর্মী' },
  { id: 'IT & Engineering', en: 'IT & Engineering', bn: 'আইটি ও ইঞ্জিনিয়ারিং' },
  { id: 'Nursing & Caregiver', en: 'Nursing & Caregiver', bn: 'নার্সিং ও কেয়ারগিভার' },
];

export const JobsPage: React.FC<JobsPageProps> = ({
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onResultSuccess,
}) => {
  const { uiLang, t } = useUiLanguage();
  const [country, setCountry] = useState(COUNTRIES[0].id);
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [skills, setSkills] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<{ title: string; uri: string }[]>([]);
  const inFlightRef = useRef(false);

  const executeSearch = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    onBusyChange(true);
    setError(null);
    setErrorCode(undefined);
    setRetryAfterSec(undefined);
    setAnswer('');
    setSources([]);

    try {
      await streamAiSse<{
        answer: string;
        sources: { title: string; uri: string }[];
        historyItem: HistoryItem;
        quota: QuotaState;
      }>(
        '/api/ai/jobs',
        { country, category, skills, responseLanguage },
        {
          onDelta: (chunk) => {
            setAnswer((prev) => (prev ?? '') + chunk);
          },
          onDone: (data) => {
            setAnswer(data.answer);
            setSources(data.sources || []);
            onResultSuccess(data.historyItem, data.quota);
          },
        }
      );
    } catch (err) {
      if (err instanceof AiClientError) {
        setError(err.message);
        setErrorCode(err.errorCode);
        setRetryAfterSec(err.retryAfterSec);
      } else {
        setError(err instanceof Error ? err.message : t('Unexpected error occurred.', 'অপ্রত্যাশিত ত্রুটি হয়েছে।'));
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      onBusyChange(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSearch();
  };

  const activeCountryObj = COUNTRIES.find((c) => c.id === country) ?? COUNTRIES[0];
  const activeCatObj = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t(
            'International Employment · Verified Google Search Grounding',
            'আন্তর্জাতিক কর্মসংস্থান · Google সার্চ ভিত্তিক যাচাইকৃত সূত্র'
          )}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('Global Job Information & Guidance', 'বিদেশে চাকরির তথ্য ও নির্দেশিকা')}
        </h1>
      </div>

      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
          {t(
            'Safety Notice: Always verify visas and recruiting agency licenses through BMET (Ami Probashi) and official embassy portals before making payments.',
            'নিরাপত্তা পরামর্শ: বিদেশে যাওয়ার আগে সর্বদা BMET (আমি প্রবাসী অ্যাপ) ও সংশ্লিষ্ট দূতাবাসের অফিশিয়াল পোর্টাল থেকে ভিসা ও রিক্রুটিং এজেন্সির লাইসেন্স যাচাই করুন।'
          )}
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Select Destination Country', 'গন্তব্য দেশ নির্বাচন করুন')}
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {uiLang === 'bn' ? c.bn : c.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Job Category', 'কাজের ক্ষেত্র')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {uiLang === 'bn' ? cat.bn : cat.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t('Your Experience or Skills (Optional)', 'আপনার অভিজ্ঞতা বা দক্ষতা (ঐচ্ছিক)')}
          </label>
          <input
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder={t(
              'e.g., 3 years experience, SSC pass, valid driving license...',
              'যেমন: ৩ বছরের অভিজ্ঞতা, SSC পাস, বৈধ ড্রাইভিং লাইসেন্স আছে...'
            )}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>
              {loading
                ? t('Searching Verified Info...', 'যাচাইকৃত তথ্য খোঁজা হচ্ছে...')
                : t('Find Jobs & Guide', 'চাকরি ও আবেদন গাইড খুঁজুন')}
            </span>
          </button>
        </div>
      </form>

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        onRetry={executeSearch}
        retrying={loading}
        activeModel={activeModel}
        availableModels={availableModels}
        onSwitchModel={onSwitchModel}
      />

      {loading && !answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-400 shrink-0" />
          <span>{t('Searching verified job details & links...', 'যাচাইকৃত চাকরির তথ্য ও সূত্র খোঁজা হচ্ছে...')}</span>
        </div>
      )}

      {answer && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <Briefcase className="w-5 h-5 text-blue-700 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {uiLang === 'bn' ? activeCountryObj.bn : activeCountryObj.en} —{' '}
                {uiLang === 'bn' ? activeCatObj.bn : activeCatObj.en}
              </h2>
            </div>
            <RichAnswer content={answer} isStreaming={loading} language={responseLanguage} />
          </div>

          {sources.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('Verified Web Sources & Job Links', 'যাচাইকৃত ওয়েব সূত্র ও চাকরির লিংক')}
                </h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 flex items-center justify-between gap-3 text-sm text-blue-700 dark:text-blue-400 hover:underline min-h-[44px]"
                  >
                    <span className="truncate font-medium">{src.title}</span>
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
