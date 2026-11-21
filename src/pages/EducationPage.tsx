import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Lock,
  Send,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { InterstitialAdModal } from '../components/AdSystem';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { RichAnswer } from '../components/RichAnswer';
import { VoiceInputButton } from '../components/VoiceControls';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { AiClientError, streamAiSse } from '../utils/api';
import type {
  AdSystemState,
  AiErrorCode,
  AppPage,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface EducationPageProps {
  enabled?: boolean;
  isPaidUser: boolean;
  isOnline: boolean;
  ads: AdSystemState;
  educationHistory?: HistoryItem[];
  initialQuestion?: string;
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onClearInitialQuestion: () => void;
  onBusyChange: (busy: boolean) => void;
  onNavigate: (page: AppPage) => void;
  onTrackAd: (event: 'interstitial_impression' | 'click') => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
}

const SUBJECTS = [
  { id: 'Mathematics', en: 'Mathematics (General & Higher)', bn: 'গণিত (সাধারণ ও উচ্চতর)' },
  { id: 'Physics', en: 'Physics', bn: 'পদার্থবিজ্ঞান' },
  { id: 'Chemistry', en: 'Chemistry', bn: 'রসায়ন' },
  { id: 'Biology', en: 'Biology', bn: 'জীববিজ্ঞান' },
  { id: 'English Grammar', en: 'English Grammar & Composition', bn: 'ইংরেজি গ্রামার ও রাইটিং' },
  { id: 'Bangla Grammar', en: 'Bangla Grammar & Literature', bn: 'বাংলা ব্যাকরণ ও সাহিত্য' },
  { id: 'ICT', en: 'ICT (Information & Tech)', bn: 'আইসিটি (তথ্য ও যোগাযোগ প্রযুক্তি)' },
];

const LEVELS = [
  { id: 'SSC', en: 'SSC (Class 9–10)', bn: 'এসএসসি (SSC / নবম–দশম)' },
  { id: 'HSC', en: 'HSC (Class 11–12)', bn: 'এইচএসসি (HSC / একাদশ–দ্বাদশ)' },
  { id: 'Class 6-8', en: 'Class 6–8', bn: 'ষষ্ঠ–অষ্টম শ্রেণি' },
  { id: 'Admission', en: 'Admission & Job Exams', bn: 'ভর্তি ও চাকরি পরীক্ষা' },
];

const SAMPLE_QUESTIONS = [
  {
    en: 'Solve x² - 7x + 12 = 0 step by step with explanation.',
    bn: 'x² - 7x + 12 = 0 সমীকরণটি ধাপে ধাপে সমাধান করো।',
  },
  {
    en: 'Explain the difference between Present Perfect and Past Indefinite Tense with examples.',
    bn: 'Present Perfect ও Past Indefinite Tense-এর পার্থক্য উদাহরণসহ লেখো।',
  },
  {
    en: 'Explain photosynthesis reaction and steps clearly for HSC Biology.',
    bn: 'সালোকসংশ্লেষণ প্রক্রিয়া ও বিক্রিয়া ধাপে ধাপে বুঝিয়ে দাও।',
  },
  {
    en: 'Explain Newton’s 2nd Law F = ma with an SSC physics numerical example.',
    bn: 'নিউটনের ২য় সূত্র F = ma একটি গাণিতিক উদাহরণসহ বুঝিয়ে দাও।',
  },
];

export const EducationPage: React.FC<EducationPageProps> = ({
  enabled = true,
  isPaidUser,
  isOnline,
  ads,
  educationHistory = [],
  initialQuestion,
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onClearInitialQuestion,
  onBusyChange,
  onNavigate,
  onTrackAd,
  onResultSuccess,
}) => {
  const { uiLang, t, formatDate } = useUiLanguage();
  const [subject, setSubject] = useState(SUBJECTS[0].id);
  const [level, setLevel] = useState(LEVELS[0].id);
  const [question, setQuestion] = useState(initialQuestion || '');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState<string | null>(null);

  // Forced Study Ad Gate: free users watch 5-second fullscreen ad before answer unlocks
  const [forcedAdOpen, setForcedAdOpen] = useState(false);
  const [adGateCleared, setAdGateCleared] = useState(true);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(
    educationHistory[0]?.id ?? null
  );

  const inFlightRef = useRef(false);

  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion);
      onClearInitialQuestion();
    }
  }, [initialQuestion, onClearInitialQuestion]);

  if (!enabled) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('Education Mode is Currently Disabled', 'শিক্ষা AI মোড বর্তমানে বন্ধ রয়েছে')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {t(
            'Education Mode has been turned off by the Administrator from the Admin Panel.',
            'অ্যাডমিন প্যানেল থেকে শিক্ষা AI মোড সাময়িকভাবে বন্ধ করা হয়েছে।'
          )}
        </p>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setImagePreview(dataUrl);
      const [meta, base64] = dataUrl.split(',');
      const mimeMatch = meta.match(/data:(.*);base64/);
      setImageMimeType(mimeMatch ? mimeMatch[1] : file.type);
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const executeSolve = async () => {
    if (inFlightRef.current) return;
    if (!isOnline) {
      setError(
        t(
          'You are currently offline. You can read your saved study notes below, or reconnect to internet for new questions.',
          'আপনি এখন অফলাইনে আছেন। নিচে সংরক্ষিত শিক্ষার নোট পড়তে পারেন, অথবা নতুন প্রশ্নের জন্য ইন্টারনেট সংযোগ চালু করুন।'
        )
      );
      return;
    }
    if (!question.trim() && !imageBase64) {
      setError(
        t(
          'Please enter a study question or upload a photo of your textbook/notebook.',
          'অনুগ্রহ করে একটি প্রশ্ন লিখুন অথবা বই/খাতার ছবি আপলোড করুন।'
        )
      );
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

    // Place C: For free users, trigger mandatory 5s Study Ad between question and answer
    const shouldGateWithForcedAd = !isPaidUser && ads.interstitial.enabled;
    if (shouldGateWithForcedAd) {
      setAdGateCleared(false);
      setForcedAdOpen(true);
    } else {
      setAdGateCleared(true);
      setForcedAdOpen(false);
    }

    try {
      await streamAiSse<{ answer: string; historyItem: HistoryItem; quota: QuotaState }>(
        '/api/ai/education',
        {
          subject,
          level,
          question,
          imageBase64,
          imageMimeType,
          responseLanguage,
          modelId: activeModel,
        },
        {
          onDelta: (chunk) => {
            setAnswer((prev) => (prev ?? '') + chunk);
          },
          onDone: (data) => {
            setAnswer(data.answer);
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
      setAnswer(null);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      onBusyChange(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSolve();
  };

  const activeSubjectObj = SUBJECTS.find((s) => s.id === subject) ?? SUBJECTS[0];
  const canDisplayAnswer = Boolean(answer) && adGateCleared;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Education AI · SSC / HSC Step-by-Step Tutor', 'শিক্ষা AI · SSC / HSC ধাপে ধাপে ব্যাখ্যা')}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('SSC / HSC Study & Question Solver', 'SSC / HSC পড়াশোনার প্রশ্ন সমাধান')}
          </h1>
        </div>

        {!isPaidUser && ads.interstitial.enabled && (
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            {t('Free Mode: 5s Ad before answer (Pro = Ad-Free)', 'ফ্রি মোড: উত্তরের আগে ৫ সেকেন্ড অ্যাড (Pro = অ্যাড-মুক্ত)')}
          </span>
        )}
      </div>

      {!isOnline && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              {t('Offline Mode — Saved Study Notes', 'অফলাইন মোড — সংরক্ষিত শিক্ষার নোট')}
            </p>
            <p className="mt-0.5">
              {t(
                'No Mobile Data / Wi-Fi detected. You can read all your saved SSC/HSC study notes below anytime. Reconnect to ask new live AI questions.',
                'মোবাইল ডাটা বা Wi-Fi নেই। আপনি নিচে সংরক্ষিত সব SSC/HSC শিক্ষার নোট পড়তে পারবেন। নতুন প্রশ্ন করতে ইন্টারনেট চালু করুন।'
              )}
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Select Subject', 'বিষয় নির্বাচন করুন')}
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {uiLang === 'bn' ? s.bn : s.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Class / Level', 'শ্রেণি / স্তর')}
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {uiLang === 'bn' ? l.bn : l.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Enter Your Question', 'আপনার প্রশ্নটি লিখুন')}
            </label>
            <VoiceInputButton
              language={responseLanguage}
              onTranscript={(text) =>
                setQuestion((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
              }
              onError={(err) => {
                if (typeof err === 'string') {
                  setError(err);
                } else {
                  setError(err.message);
                  setErrorCode(err.errorCode);
                }
              }}
              disabled={loading || !isOnline}
              compact
            />
          </div>
          <textarea
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t(
              'e.g., A right triangle has hypotenuse 10 cm and base 6 cm. Find the height.',
              'যেমন: একটি সমকোণী ত্রিভুজের অতিভুজ ১০ সেমি এবং ভূমি ৬ সেমি হলে লম্ব কত?'
            )}
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('Quick Examples:', 'দ্রুত নমুনা:')}
          </span>
          {SAMPLE_QUESTIONS.map((sample) => {
            const label = uiLang === 'bn' ? sample.bn : sample.en;
            return (
              <button
                key={sample.en}
                type="button"
                onClick={() => setQuestion(label)}
                className="px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-xs text-slate-700 dark:text-slate-300 transition-colors text-left"
              >
                {label.slice(0, 42)}...
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>{t('Upload Textbook/Note Photo (Optional)', 'খাতা/বইয়ের ছবি দিন (ঐচ্ছিক)')}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>

            {imagePreview && (
              <div className="flex items-center gap-2">
                <img
                  src={imagePreview}
                  alt={t('Uploaded question', 'আপলোড করা প্রশ্ন')}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(undefined);
                    setImageMimeType(undefined);
                  }}
                  aria-label={t('Remove photo', 'ছবি সরান')}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isOnline}
            className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>
              {loading
                ? t('Solving...', 'সমাধান তৈরি হচ্ছে...')
                : t('Solve Step by Step', 'ধাপে ধাপে সমাধান করুন')}
            </span>
          </button>
        </div>
      </form>

      {/* Error banner only shown after any ad overlay closes */}
      {!forcedAdOpen && (
        <AiErrorBanner
          error={error}
          errorCode={errorCode}
          retryAfterSec={retryAfterSec}
          onRetry={executeSolve}
          retrying={loading}
          activeModel={activeModel}
          availableModels={availableModels}
          onSwitchModel={onSwitchModel}
        />
      )}

      {/* Pending notice while ad was dismissed cleanly and answer is still streaming */}
      {loading && (!answer || !adGateCleared) && !forcedAdOpen && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-400 shrink-0" />
          <span>{t('Generating fast step-by-step answer...', 'দ্রুত সমাধান তৈরি হচ্ছে...')}</span>
        </div>
      )}

      {canDisplayAnswer && answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <BookOpen className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('Detailed Solution', 'বিস্তারিত সমাধান')} (
              {uiLang === 'bn' ? activeSubjectObj.bn : activeSubjectObj.en})
            </h2>
          </div>
          <RichAnswer content={answer} isStreaming={loading} language={responseLanguage} />
        </div>
      )}

      {/* Saved Study Notes (Offline Local Storage) */}
      {educationHistory.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('Saved Study Notes', 'সংরক্ষিত শিক্ষার নোট')} ({educationHistory.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'Saved in local storage — Readable anytime even without Data / Wi-Fi.',
                  'লোকাল স্টোরেজে সংরক্ষিত — ডাটা বা Wi-Fi ছাড়াই যেকোনো সময় পড়তে পারবেন।'
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {educationHistory.map((note) => {
              const isOpen = expandedNoteId === note.id;
              return (
                <div
                  key={note.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedNoteId(isOpen ? null : note.id)}
                    className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatDate(note.createdAt, true)}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {note.title}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-lg">
                        <span className="font-semibold">{t('Question:', 'প্রশ্ন:')}</span> {note.prompt}
                      </p>
                      <RichAnswer content={note.response} language={responseLanguage} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Mandatory 5s Study Interstitial Ad (Place C) */}
      <InterstitialAdModal
        open={forcedAdOpen && !isPaidUser}
        mode="forced_study"
        ads={ads}
        shownCount={1}
        countdownSeconds={5}
        answerReady={Boolean(answer && !loading && !error)}
        answerFailed={Boolean(error && !loading)}
        onClose={() => {
          setForcedAdOpen(false);
          setAdGateCleared(true);
        }}
        onNavigate={(page) => {
          setForcedAdOpen(false);
          setAdGateCleared(true);
          onNavigate(page);
        }}
        onTrack={onTrackAd}
      />
    </div>
  );
};
