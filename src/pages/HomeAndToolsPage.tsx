import React, { useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Crown,
  Film,
  GraduationCap,
  HeartPulse,
  History,
  Image as ImageIcon,
  Megaphone,
  MessageSquareText,
  Moon,
  Search,
  Sun,
} from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import type {
  AiFeatureFlags,
  AppPage,
  HistoryItem,
  QuotaState,
  SubscriptionState,
  UserProfile,
} from '../types';

export interface ToolDirectoryItem {
  id: string;
  page: AppPage;
  titleEn: string;
  titleBn: string;
  subtitleEn: string;
  subtitleBn: string;
  categoryKey: 'edu_career' | 'health' | 'media';
  categoryEn: string;
  categoryBn: string;
  icon: React.FC<{ className?: string }>;
  accentClass: string;
  noteEn: string;
  noteBn: string;
  featureKey?: keyof AiFeatureFlags;
}

export const TOOL_DIRECTORY: ToolDirectoryItem[] = [
  {
    id: 'assistant',
    page: 'assistant',
    featureKey: 'generalChatEnabled',
    titleEn: 'General AI Chat (ChatGPT-Style)',
    titleBn: 'এআই চ্যাট সহকারী',
    subtitleEn: 'Stories, poems, CVs, job exam Q&A, coding, voice chat & image analysis',
    subtitleBn: 'গল্প, কবিতা, CV, চাকরির প্রশ্নোত্তর, ভয়েস ও ছবি দিয়ে যেকোনো কথা বলুন',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: MessageSquareText,
    accentClass: 'bg-blue-700 text-white dark:bg-blue-600 dark:text-white',
    noteEn: 'ChatGPT Mode · Voice + Vision',
    noteBn: 'ভয়েস + ছবি + মেমোরি',
  },
  {
    id: 'education',
    page: 'education',
    featureKey: 'educationEnabled',
    titleEn: 'SSC / HSC Education AI',
    titleBn: 'শিক্ষা AI (SSC / HSC)',
    subtitleEn: 'Step-by-step Math, Physics, Chemistry, Biology, ICT, Bangla & English Grammar',
    subtitleBn: 'SSC/HSC গণিত, বিজ্ঞান, আইসিটি ও ইংরেজি গ্রামারের ধাপে ধাপে সমাধান',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: GraduationCap,
    accentClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300',
    noteEn: 'Step-by-Step + Photo Solve',
    noteBn: 'প্রশ্ন ও ছবি বিশ্লেষণ',
  },
  {
    id: 'photo',
    page: 'photo',
    featureKey: 'imageGenerationEnabled',
    titleEn: 'AI Image Generator & Photo Studio',
    titleBn: 'এআই ইমেজ ও ফটো এডিটর',
    subtitleEn: 'Generate or edit images from text & photos + background removal & thumbnails',
    subtitleBn: 'লিখে বা ছবি দিয়ে সুন্দর ছবি তৈরি, ব্যাকগ্রাউন্ড রিমুভ ও ইউটিউব থাম্বনেইল',
    categoryKey: 'media',
    categoryEn: 'Media Studio',
    categoryBn: 'মিডিয়া স্টুডিও',
    icon: ImageIcon,
    accentClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
    noteEn: 'Image Gen + Canvas Editor',
    noteBn: 'এআই ছবি তৈরি ও এডিট',
  },
  {
    id: 'video',
    page: 'video',
    featureKey: 'videoGenerationEnabled',
    titleEn: 'Flow AI Video Studio',
    titleBn: 'Flow AI ভিডিও স্টুডিও',
    subtitleEn: 'Create short videos directly from text or images + AI storyboard',
    subtitleBn: 'টেক্সট বা ছবি থেকে Flow AI-এর মতো ছোট ভিডিও ও স্টোরিবোর্ড তৈরি করুন',
    categoryKey: 'media',
    categoryEn: 'Media Studio',
    categoryBn: 'মিডিয়া স্টুডিও',
    icon: Film,
    accentClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    noteEn: 'Flow AI Text & Image Video',
    noteBn: 'টেক্সট ও ইমেজ টু ভিডিও',
  },
  {
    id: 'jobs',
    page: 'jobs',
    titleEn: 'International Jobs Guide',
    titleBn: 'বিদেশে চাকরি',
    subtitleEn: 'Verified career guidance & visa info for Saudi Arabia, UAE, Qatar & Malaysia',
    subtitleBn: 'সৌদি, UAE, কাতার ও মালয়েশিয়া কাজের গাইড ও যাচাইকৃত সূত্র',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: Briefcase,
    accentClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300',
    noteEn: 'Verified Search Sources',
    noteBn: 'সার্চ গ্রাউন্ডিং সক্রিয়',
  },
  {
    id: 'health',
    page: 'health',
    titleEn: 'Health Information Assistant',
    titleBn: 'স্বাস্থ্য সহকারী',
    subtitleEn: 'General symptoms, medical terms & medicine safety information (ad-free)',
    subtitleBn: 'সাধারণ লক্ষণ, পরিভাষা ও ওষুধের সতর্কতামূলক তথ্য',
    categoryKey: 'health',
    categoryEn: 'Health',
    categoryBn: 'স্বাস্থ্য',
    icon: HeartPulse,
    accentClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    noteEn: 'Ad-Free Safe Guidance',
    noteBn: 'বিজ্ঞাপনমুক্ত নিরাপদ তথ্য',
  },
  {
    id: 'social',
    page: 'social',
    titleEn: 'Social Media AI',
    titleBn: 'সোশ্যাল মিডিয়া AI',
    subtitleEn: 'Facebook, TikTok & YouTube video ideas, scripts, captions & hashtags',
    subtitleBn: 'Facebook, TikTok ও YouTube স্ক্রিপ্ট, ক্যাপশন ও হ্যাশট্যাগ',
    categoryKey: 'media',
    categoryEn: 'Media Studio',
    categoryBn: 'মিডিয়া স্টুডিও',
    icon: Megaphone,
    accentClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
    noteEn: 'Reels & Shorts Scripts',
    noteBn: 'রিলস ও শর্টস স্ক্রিপ্ট',
  },
];

interface HomeViewProps {
  user: UserProfile;
  subscription: SubscriptionState;
  quota: QuotaState;
  history: HistoryItem[];
  aiFeatures?: AiFeatureFlags;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: AppPage) => void;
  onQuickEducationAsk: (question: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  subscription,
  quota,
  history,
  aiFeatures,
  theme,
  onToggleTheme,
  onNavigate,
  onQuickEducationAsk,
}) => {
  const { uiLang, t, formatDate } = useUiLanguage();
  const [quickPrompt, setQuickPrompt] = useState('');
  const remainingToday = Math.max(0, quota.dailyLimit - quota.usedToday);

  const isFeatureEnabled = (key?: keyof AiFeatureFlags) => {
    if (!key || !aiFeatures) return true;
    return aiFeatures[key] !== false;
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) {
      onNavigate('education');
      return;
    }
    onQuickEducationAsk(quickPrompt.trim());
  };

  return (
    <div className="space-y-8">
      {/* Workspace Utility Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span>{t(`Welcome, ${user.name}`, `স্বাগতম, ${user.name}`)}</span>
            <span aria-hidden="true"> · </span>
            <span>{user.location}</span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Your All-in-One Sathi AI Dashboard', 'আপনার দৈনন্দিন বাংলা এআই ড্যাশবোর্ড')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-700" />
            )}
            <span>
              {theme === 'dark' ? t('Light Theme', 'লাইট থিম') : t('Dark Theme', 'ডার্ক থিম')}
            </span>
          </button>
        </div>
      </div>

      {/* Hero Split Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-blue-200 mb-2">
              {t(
                'SSC/HSC Education · General AI Chat · AI Image & Flow Video · Global Jobs',
                'শিক্ষা · জেনারেল চ্যাট · ইমেজ ও Flow ভিডিও · বিদেশে চাকরি'
              )}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold leading-snug mb-3">
              {t(
                'Complete AI Assistant for Study, Career, Images & Short Videos',
                'এক অ্যাপেই পড়াশোনা, বৈধ চাকরির তথ্য ও কনটেন্ট তৈরির পূর্ণ সমাধান'
              )}
            </h2>
            <p className="text-sm text-blue-100 leading-relaxed max-w-xl mb-6">
              {t(
                'Solve SSC/HSC math & grammar step by step, write CVs or stories, generate AI images & Flow videos, or switch instantly between English and Bengali.',
                'সহজ বাংলা ও ইংরেজিতে পড়াশোনা সমাধান করুন, CV বা গল্প লিখুন, এআই ছবি ও ছোট ভিডিও বানান এবং যেকোনো সময় ভাষা বদলান।'
              )}
            </p>
          </div>

          <div className="space-y-3">
            <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                placeholder={t(
                  'Ask any SSC/HSC study question (e.g., Explain Newton’s 2nd Law)...',
                  'যেকোনো পড়াশোনার প্রশ্ন লিখুন (যেমন: নিউটনের ২য় সূত্র ব্যাখ্যা করো)...'
                )}
                className="flex-1 min-h-[48px] px-4 rounded-xl bg-white/15 border border-white/25 text-sm text-white placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/60"
              />
              <button
                type="submit"
                className="min-h-[48px] px-5 rounded-xl bg-white text-blue-900 hover:bg-blue-50 text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>{t('Solve Now', 'সমাধান নিন')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('assistant')}
                className="min-h-[42px] px-4 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <MessageSquareText className="w-4 h-4" />
                <span>{t('Open General AI Chat (Stories, CV, Voice)', 'জেনারেল এআই চ্যাট খুলুন')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('photo')}
                className="min-h-[42px] px-4 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span>{t('AI Image Generator', 'এআই ছবি বানান')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('video')}
                className="min-h-[42px] px-4 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Film className="w-4 h-4" />
                <span>{t('Flow AI Video', 'ভিডিও বানান')}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="relative h-48 lg:h-52 w-full overflow-hidden">
            <ImageWithFallback
              src="/src/assets/images/sathi_hero_banner_1795095210678.jpg"
              alt={t('Sathi AI Workspace', 'সাথী AI ওয়ার্কস্পেস')}
              className="w-full h-full object-cover"
              fallbackTitle={t('Sathi AI Workspace', 'সাথী AI ওয়ার্কস্পেস')}
            />
          </div>
          <div className="p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('Remaining Daily Quota', 'আজকের অবশিষ্ট কোটা')}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                  {remainingToday}{' '}
                  <span className="text-sm font-normal text-slate-500">/ {quota.dailyLimit}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('Current Plan', 'বর্তমান প্ল্যান')}
                </p>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mt-1.5 truncate">
                  {subscription.isPaid
                    ? subscription.planNameBn
                    : t('Free Plan', subscription.planNameBn)}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {subscription.isPaid
                  ? subscription.expiresAt
                    ? `${t('Zero Ads · Pro Active · Expires', 'বিজ্ঞাপনমুক্ত · প্রো সক্রিয় · মেয়াদ')} ${formatDate(subscription.expiresAt)}`
                    : t('Zero Ads · Pro Plan Active', 'বিজ্ঞাপনমুক্ত · প্রো প্ল্যান সক্রিয়')
                  : t('Offline Saved Data ON · Pro removes Ads (৳200)', 'অফলাইনে সেভড ডেটা চালু · Pro নিলে বিজ্ঞাপনমুক্ত (৳২০০)')}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('subscription')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[40px]"
              >
                <Crown className="w-4 h-4" />
                <span>{t('Manage Plan', 'প্ল্যান পরিচালনা')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Chrome PWA Install Card */}
      <PWAInstallButton variant="card" />

      {/* Main Features Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {t('Core AI Services & Studios', 'প্রধান এআই সেবাসমূহ')}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('tools')}
            className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[40px] inline-flex items-center gap-1"
          >
            <span>{t('View All Tools', 'সকল টুলস দেখুন')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {TOOL_DIRECTORY.map((tool) => {
            const Icon = tool.icon;
            const enabled = isFeatureEnabled(tool.featureKey);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onNavigate(tool.page)}
                className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors flex flex-col justify-between gap-4 min-h-[144px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tool.accentClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      enabled
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {enabled
                      ? uiLang === 'bn'
                        ? tool.noteBn
                        : tool.noteEn
                      : t('Disabled by Admin', 'অ্যাডমিন বন্ধ রেখেছেন')}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    {uiLang === 'bn' ? tool.titleBn : tool.titleEn}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {uiLang === 'bn' ? tool.subtitleBn : tool.subtitleEn}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent History Section */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('Recent History', 'সাম্প্রতিক ইতিহাস')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[40px]"
          >
            {t('View All', 'সব দেখুন')}
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
            {t(
              'No saved activity yet. Start using any AI tool above.',
              'এখনো কোনো কার্যক্রম সংরক্ষিত হয়নি। উপরের যেকোনো টুল ব্যবহার করে শুরু করুন।'
            )}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate('history')}
                className="w-full py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl px-2 transition-colors min-h-[56px]"
              >
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                    <span>{item.toolLabelBn}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="tabular-nums">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface AllToolsViewProps {
  onNavigate: (page: AppPage) => void;
  aiFeatures?: AiFeatureFlags;
}

export const AllToolsView: React.FC<AllToolsViewProps> = ({ onNavigate, aiFeatures }) => {
  const { uiLang, t } = useUiLanguage();
  const [search, setSearch] = useState('');
  const [categoryKey, setCategoryKey] = useState<'all' | 'edu_career' | 'health' | 'media'>('all');

  const categories: { key: 'all' | 'edu_career' | 'health' | 'media'; en: string; bn: string }[] = [
    { key: 'all', en: 'All', bn: 'সকল' },
    { key: 'edu_career', en: 'Education & Career', bn: 'শিক্ষা ও ক্যারিয়ার' },
    { key: 'health', en: 'Health', bn: 'স্বাস্থ্য' },
    { key: 'media', en: 'Media Studio', bn: 'মিডিয়া স্টুডিও' },
  ];

  const isFeatureEnabled = (key?: keyof AiFeatureFlags) => {
    if (!key || !aiFeatures) return true;
    return aiFeatures[key] !== false;
  };

  const filtered = TOOL_DIRECTORY.filter((tool) => {
    const matchesCategory = categoryKey === 'all' || tool.categoryKey === categoryKey;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      tool.titleEn.toLowerCase().includes(q) ||
      tool.titleBn.toLowerCase().includes(q) ||
      tool.subtitleEn.toLowerCase().includes(q) ||
      tool.subtitleBn.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('Tools Directory', 'টুলস ডিরেক্টরি')}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('All AI Tools', 'সকল এআই টুলস')}
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              'Search tools (e.g., SSC math, CV, image, video)...',
              'টুল খুঁজুন (যেমন: গণিত, চাকরি, থাম্বনেইল)...'
            )}
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategoryKey(cat.key)}
              className={`px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                categoryKey === cat.key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {t(cat.en, cat.bn)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tool) => {
          const Icon = tool.icon;
          const enabled = isFeatureEnabled(tool.featureKey);
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onNavigate(tool.page)}
              className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors flex flex-col justify-between gap-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tool.accentClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {enabled ? t(tool.categoryEn, tool.categoryBn) : t('Disabled', 'বন্ধ')}
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  {uiLang === 'bn' ? tool.titleBn : tool.titleEn}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                  {uiLang === 'bn' ? tool.subtitleBn : tool.subtitleEn}
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <span>{t('Open Tool', 'চালু করুন')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
