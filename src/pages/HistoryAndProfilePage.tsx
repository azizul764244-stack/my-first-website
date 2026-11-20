import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  MessageSquareText,
  Moon,
  Pin,
  Save,
  Sun,
  Trash2,
} from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { LanguageSelector } from '../components/LanguageSelector';
import { RichAnswer } from '../components/RichAnswer';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import type {
  AppPage,
  AppStateResponse,
  ChatConversation,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
  SubscriptionState,
  UserProfile,
} from '../types';

interface HistoryViewProps {
  history: HistoryItem[];
  conversations?: ChatConversation[];
  responseLanguage?: ResponseLanguageCode;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onOpenConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  conversations = [],
  responseLanguage = 'en',
  onDeleteItem,
  onClearAll,
  onOpenConversation,
  onDeleteConversation,
}) => {
  const { t, formatDate } = useUiLanguage();
  const [sectionTab, setSectionTab] = useState<'tools' | 'chats'>('chats');
  const [filterTool, setFilterTool] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(history[0]?.id ?? null);

  const filtered = history.filter((item) => filterTool === 'all' || item.tool === filterTool);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Activity & Chat Archive', 'কার্যক্রম ও চ্যাট আর্কাইভ')}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('Usage History', 'ব্যবহারের ইতিহাস')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setSectionTab('chats')}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors ${
                sectionTab === 'chats'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t('AI Chats', 'এআই চ্যাট')} ({conversations.length})
            </button>
            <button
              type="button"
              onClick={() => setSectionTab('tools')}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors ${
                sectionTab === 'tools'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t('Tool History', 'টুল ইতিহাস')} ({history.length})
            </button>
          </div>

          {sectionTab === 'tools' && history.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="min-h-[40px] px-3.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('Clear All', 'সব মুছুন')}</span>
            </button>
          )}
        </div>
      </div>

      {sectionTab === 'chats' ? (
        conversations.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('No saved chat conversations yet.', 'এখনো কোনো চ্যাট কথোপকথন সংরক্ষিত হয়নি।')}
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => {
              const lastMsg = conv.messages[conv.messages.length - 1];
              return (
                <div
                  key={conv.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <MessageSquareText className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                      {conv.pinned && <Pin className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />}
                      <span>
                        {conv.messages.length} {t('messages', 'বার্তা')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatDate(conv.updatedAt, true)}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {conv.title}
                    </p>
                    {lastMsg && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {lastMsg.text}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onOpenConversation && (
                      <button
                        type="button"
                        onClick={() => onOpenConversation(conv.id)}
                        className="min-h-[40px] px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>{t('Open Chat', 'চ্যাট খুলুন')}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDeleteConversation && (
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.id)}
                        aria-label={t('Delete conversation', 'কথোপকথন মুছুন')}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <>
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl overflow-x-auto w-full sm:w-fit">
            {[
              { id: 'all', en: 'All', bn: 'সকল' },
              { id: 'education', en: 'Education', bn: 'শিক্ষা AI' },
              { id: 'jobs', en: 'Jobs', bn: 'চাকরি' },
              { id: 'health', en: 'Health', bn: 'স্বাস্থ্য' },
              { id: 'social', en: 'Social', bn: 'সোশ্যাল' },
              { id: 'video', en: 'Video', bn: 'ভিডিও' },
              { id: 'photo', en: 'Photo/Image', bn: 'ছবি' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterTool(f.id)}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  filterTool === f.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t(f.en, f.bn)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('No saved history found in this category.', 'এই বিভাগে কোনো সংরক্ষিত ইতিহাস পাওয়া যায়নি।')}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const isOpen = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    <div className="p-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : item.id)}
                        className="flex-1 text-left min-w-0 min-h-[44px]"
                      >
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                          <span>{item.toolLabelBn}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="tabular-nums">{formatDate(item.createdAt, true)}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          aria-label={t('Delete item', 'মুছে ফেলুন')}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : item.id)}
                          aria-label={t('Toggle details', 'বিস্তারিত দেখুন')}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">{t('Prompt:', 'প্রশ্ন:')}</span> {item.prompt}
                        </div>
                        <RichAnswer content={item.response} language={responseLanguage} />
                        {item.sources && item.sources.length > 0 && (
                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {t('Sources:', 'সূত্র:')}
                            </p>
                            {item.sources.map((s, idx) => (
                              <a
                                key={idx}
                                href={s.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>{s.title}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface ProfileViewProps {
  user: UserProfile;
  subscription: SubscriptionState;
  quota: QuotaState;
  theme: 'light' | 'dark';
  responseLanguage: ResponseLanguageCode;
  onChangeLanguage: (lang: ResponseLanguageCode) => void;
  onToggleTheme: () => void;
  onStateSync: (state: AppStateResponse) => void;
  onNavigate: (page: AppPage) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  subscription,
  quota,
  theme,
  responseLanguage,
  onChangeLanguage,
  onToggleTheme,
  onStateSync,
  onNavigate,
}) => {
  const { uiLang, setUiLang, t } = useUiLanguage();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);
  const [location, setLocation] = useState(user.location);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        email,
        location,
        theme,
        preferredLanguage: responseLanguage,
      }),
    });
    const data = await res.json();
    if (res.ok && data.state) {
      onStateSync(data.state);
      setSavedMsg(t('Profile saved successfully.', 'প্রোফাইল তথ্য সংরক্ষিত হয়েছে।'));
      setTimeout(() => setSavedMsg(null), 2200);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('User Account', 'ব্যবহারকারীর অ্যাকাউন্ট')}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('Profile & Settings', 'প্রোফাইল ও সেটিংস')}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          <div className="flex items-center gap-4">
            <ImageWithFallback
              src={user.avatarUrl}
              alt={user.name}
              className="w-16 h-16 rounded-2xl object-cover shrink-0"
              fallbackTitle={user.name}
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{user.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.location}</p>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mt-1">
                {subscription.isPaid ? subscription.planNameBn : t('Free Plan', subscription.planNameBn)}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('Daily Quota', 'আজকের কোটা')}</span>
              <span className="font-mono tabular-nums font-semibold">
                {Math.max(0, quota.dailyLimit - quota.usedToday)} / {quota.dailyLimit} {t('left', 'বাকি')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('Monthly Quota', 'মাসিক কোটা')}</span>
              <span className="font-mono tabular-nums font-semibold">
                {Math.max(0, quota.monthlyLimit - quota.monthlyUsed)} / {quota.monthlyLimit}{' '}
                {t('left', 'বাকি')}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-4 py-2 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <span>{t('App Interface Language', 'অ্যাপের ভাষা')}</span>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setUiLang('en')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    uiLang === 'en' ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setUiLang('bn')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    uiLang === 'bn' ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  BN
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              className="w-full min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-between"
            >
              <span>{t('Switch App Theme', 'অ্যাপ থিম পরিবর্তন করুন')}</span>
              <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? t('Dark', 'ডার্ক') : t('Light', 'লাইট')}</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('subscription')}
              className="w-full min-h-[44px] px-4 rounded-xl bg-blue-700 text-white text-xs font-semibold flex items-center justify-between"
            >
              <span>{t('Manage Subscription', 'সাবস্ক্রিপশন পরিচালনা')}</span>
              <Crown className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('Personal Info & AI Language', 'ব্যক্তিগত তথ্য ও ভাষা')}
          </h2>

          <LanguageSelector value={responseLanguage} onChange={onChangeLanguage} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">{t('Full Name', 'পূর্ণ নাম')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">{t('Mobile Number', 'মোবাইল নম্বর')}</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">{t('Email', 'ইমেইল')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">{t('Location', 'অবস্থান')}</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
          </div>

          {savedMsg && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{savedMsg}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{t('Save Changes', 'সংরক্ষণ করুন')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
