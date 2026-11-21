import React, { useRef } from 'react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Cpu,
  Crown,
  Film,
  GraduationCap,
  HeartPulse,
  History,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  Megaphone,
  MessageSquareText,
  ShieldCheck,
  User,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { useUiLanguage, type UiLang } from '../contexts/UiLanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { PWAInstallButton } from './PWAInstallButton';
import type {
  AppPage,
  AppSettingsConfig,
  GeminiModelId,
  GeminiModelOption,
  QuotaState,
  ResponseLanguageCode,
  SubscriptionState,
  UserAccountStatus,
  UserProfile,
} from '../types';

interface NavigationShellProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  user: UserProfile;
  accountStatus?: UserAccountStatus;
  subscription: SubscriptionState;
  quota: QuotaState;
  appSettings?: AppSettingsConfig;
  isAdminAuthenticated?: boolean;
  onSecretAdminTrigger?: () => void;
  uiLang: UiLang;
  onToggleUiLang: (lang: UiLang) => void;
  responseLanguage: ResponseLanguageCode;
  onChangeLanguage: (lang: ResponseLanguageCode) => void;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  isOnline?: boolean;
  children: React.ReactNode;
  bottomBanner?: React.ReactNode;
}

export const SIDEBAR_NAV_ITEMS: {
  id: AppPage;
  labelEn: string;
  labelBn: string;
  icon: React.FC<{ className?: string }>;
  group: 'core' | 'tools' | 'account';
}[] = [
  { id: 'home', labelEn: 'Home', labelBn: 'হোম', icon: Home, group: 'core' },
  {
    id: 'assistant',
    labelEn: 'AI General Chat',
    labelBn: 'এআই চ্যাট সহকারী',
    icon: MessageSquareText,
    group: 'core',
  },
  { id: 'tools', labelEn: 'All AI Tools', labelBn: 'সকল এআই টুলস', icon: LayoutGrid, group: 'core' },
  {
    id: 'education',
    labelEn: 'Education AI',
    labelBn: 'শিক্ষা AI',
    icon: GraduationCap,
    group: 'tools',
  },
  { id: 'jobs', labelEn: 'Global Jobs', labelBn: 'বিদেশে চাকরি', icon: Briefcase, group: 'tools' },
  {
    id: 'health',
    labelEn: 'Health Assistant',
    labelBn: 'স্বাস্থ্য সহকারী',
    icon: HeartPulse,
    group: 'tools',
  },
  {
    id: 'social',
    labelEn: 'Social Media AI',
    labelBn: 'সোশ্যাল মিডিয়া AI',
    icon: Megaphone,
    group: 'tools',
  },
  { id: 'video', labelEn: 'Flow AI Video', labelBn: 'ভিডিও স্টুডিও', icon: Film, group: 'tools' },
  {
    id: 'photo',
    labelEn: 'AI Image & Photo',
    labelBn: 'ফটো ও ইমেজ স্টুডিও',
    icon: ImageIcon,
    group: 'tools',
  },
  {
    id: 'subscription',
    labelEn: 'Subscription',
    labelBn: 'সাবস্ক্রিপশন',
    icon: Crown,
    group: 'account',
  },
  { id: 'history', labelEn: 'History', labelBn: 'ইতিহাস', icon: History, group: 'account' },
  { id: 'profile', labelEn: 'Profile', labelBn: 'প্রোফাইল', icon: User, group: 'account' },
];

export const NavigationShell: React.FC<NavigationShellProps> = ({
  currentPage,
  onNavigate,
  accountStatus = 'active',
  subscription,
  quota,
  appSettings,
  isAdminAuthenticated = false,
  onSecretAdminTrigger,
  uiLang,
  onToggleUiLang,
  responseLanguage,
  onChangeLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  isOnline = true,
  children,
  bottomBanner,
}) => {
  const { t } = useUiLanguage();
  const remainingToday = Math.max(0, quota.dailyLimit - quota.usedToday);
  const tapTimestampsRef = useRef<number[]>([]);

  const handleBrandClick = () => {
    const now = Date.now();
    const recent = [...tapTimestampsRef.current.filter((ts) => now - ts < 3500), now];
    tapTimestampsRef.current = recent;
    if (recent.length >= 5 && onSecretAdminTrigger) {
      tapTimestampsRef.current = [];
      onSecretAdminTrigger();
      return;
    }
    if (recent.length === 1 && currentPage !== 'home' && currentPage !== 'admin') {
      onNavigate('home');
    }
  };

  const canSwitchModel =
    isAdminAuthenticated || (appSettings?.aiSettings?.allowUserModelSwitch ?? true);

  const accountItems = isAdminAuthenticated
    ? [
        ...SIDEBAR_NAV_ITEMS.filter((i) => i.group === 'account'),
        {
          id: 'admin' as AppPage,
          labelEn: 'Admin Panel',
          labelBn: 'অ্যাডমিন প্যানেল',
          icon: ShieldCheck,
          group: 'account' as const,
        },
      ]
    : SIDEBAR_NAV_ITEMS.filter((i) => i.group === 'account');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar with Brand, Navigation, EN/BN Switcher & Pro Button */}
      <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-3 lg:gap-8">
          {/* Zone 1: Brand wordmark (also supports 5-tap hidden admin portal entry) */}
          <button
            type="button"
            onClick={handleBrandClick}
            className="text-base sm:text-lg font-bold tracking-tight text-blue-800 dark:text-blue-400 whitespace-nowrap shrink-0 font-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md select-none touch-manipulation py-1 px-1"
          >
            {t('Sathi AI', 'সাথী AI')}
          </button>

          {/* Zone 2: 5 clean single-line navigation links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            {(
              [
                { id: 'home', en: 'Home', bn: 'হোম' },
                { id: 'assistant', en: 'AI Chat', bn: 'এআই চ্যাট' },
                { id: 'tools', en: 'Tools', bn: 'টুলস' },
                { id: 'education', en: 'Education', bn: 'শিক্ষা' },
                { id: 'history', en: 'History', bn: 'ইতিহাস' },
              ] as { id: AppPage; en: string; bn: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  currentPage === item.id
                    ? 'border-blue-700 text-blue-800 dark:border-blue-400 dark:text-blue-300 font-semibold'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t(item.en, item.bn)}
              </button>
            ))}
          </nav>

          {/* Zone 3: Install App + EN / BN Language Toggle + Pro Action */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton variant="compact" />
            <div
              role="group"
              aria-label={t('Switch App Language', 'অ্যাপের ভাষা পরিবর্তন করুন')}
              className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <button
                type="button"
                onClick={() => onToggleUiLang('en')}
                className={`px-2.5 py-1.5 min-h-[32px] rounded-lg text-xs font-bold transition-colors ${
                  uiLang === 'en'
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onToggleUiLang('bn')}
                className={`px-2.5 py-1.5 min-h-[32px] rounded-lg text-xs font-bold transition-colors ${
                  uiLang === 'bn'
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                BN
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('subscription')}
              className="px-3 sm:px-4 py-2 min-h-[36px] sm:min-h-[40px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              {subscription.isPaid
                ? t('Pro Active', 'প্রো সক্রিয়')
                : t('Upgrade Pro', 'প্রো আপগ্রেড')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Desktop Left Navigation Rail */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-5 justify-between">
          <div className="space-y-6">
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('Main Navigation', 'প্রধান নেভিগেশন')}
              </p>
              <div className="space-y-1">
                {SIDEBAR_NAV_ITEMS.filter((i) => i.group === 'core').map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-3 min-h-[42px] rounded-xl text-sm font-medium transition-colors ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{t(item.labelEn, item.labelBn)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('AI Studios & Services', 'এআই স্টুডিও ও সেবা')}
              </p>
              <div className="space-y-1">
                {SIDEBAR_NAV_ITEMS.filter((i) => i.group === 'tools').map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-3 min-h-[42px] rounded-xl text-sm font-medium transition-colors ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{t(item.labelEn, item.labelBn)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('Account & Control', 'অ্যাকাউন্ট ও নিয়ন্ত্রণ')}
              </p>
              <div className="space-y-1">
                {accountItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-3 min-h-[42px] rounded-xl text-sm font-medium transition-colors ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{t(item.labelEn, item.labelBn)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 px-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>
                {subscription.isPaid
                  ? subscription.planNameBn
                  : t('Free Plan', subscription.planNameBn)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 mb-2">
              <span>{t('Remaining Today', 'আজকের বাকি কোটা')}</span>
              <span className="font-mono tabular-nums">
                {remainingToday}/{quota.dailyLimit}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-700 dark:bg-blue-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round((quota.usedToday / Math.max(1, quota.dailyLimit)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </aside>

        {/* Main Workspace Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-10">
          {currentPage !== 'admin' && (
            <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <LanguageSelector
                value={responseLanguage}
                onChange={onChangeLanguage}
                compact
              />
              <div className="flex flex-wrap items-center justify-between gap-2.5 py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {t('AI Model', 'এআই মডেল')}
                    </p>
                    {!canSwitchModel && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('Admin Locked', 'অ্যাডমিন নির্ধারিত')}
                      </p>
                    )}
                  </div>
                </div>
                <select
                  aria-label={t('Select active Gemini model', 'সক্রিয় Gemini মডেল নির্বাচন করুন')}
                  disabled={!canSwitchModel}
                  value={activeModel}
                  onChange={(e) => onSwitchModel(e.target.value as GeminiModelId)}
                  className="min-h-[40px] max-w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.labelBn} ({m.isFreeTier ? t('Free', 'ফ্রি') : t('Paid', 'পেইড')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* System Banners controlled from Admin App Settings */}
          {currentPage !== 'admin' && appSettings?.maintenanceMode?.enabled && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-100">
              <Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {t('System Maintenance Mode Active', 'সিস্টেম রক্ষণাবেক্ষণ মোড চালু রয়েছে')}
                </p>
                <p className="mt-0.5">{appSettings.maintenanceMode.messageBn}</p>
              </div>
            </div>
          )}

          {currentPage !== 'admin' && accountStatus === 'suspended' && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-xs sm:text-sm text-rose-900 dark:text-rose-100">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {t('Account Temporarily Suspended', 'অ্যাকাউন্ট সাময়িকভাবে স্থগিত রয়েছে')}
                </p>
                <p className="mt-0.5">
                  {t(
                    'Your account has been suspended by an administrator. AI requests cannot be sent right now.',
                    'অ্যাডমিন কর্তৃক আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে। এই অবস্থায় নতুন এআই অনুরোধ পাঠানো যাবে না।'
                  )}
                </p>
              </div>
            </div>
          )}

          {currentPage !== 'admin' &&
            appSettings?.announcement?.enabled &&
            appSettings.announcement.message && (
              <div
                className={`mb-5 p-3.5 rounded-2xl border flex items-start gap-3 text-xs ${
                  appSettings.announcement.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    : appSettings.announcement.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                }`}
              >
                <Bell className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  {appSettings.announcement.title && (
                    <p className="font-bold">{appSettings.announcement.title}</p>
                  )}
                  <p className="mt-0.5 leading-relaxed">{appSettings.announcement.message}</p>
                </div>
              </div>
            )}

          {currentPage !== 'admin' && !isOnline && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-100">
              <WifiOff className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {t('Offline Mode — Local Saved Data', 'অফলাইন মোড — সংরক্ষিত তথ্য')}
                </p>
                <p className="mt-0.5">
                  {t(
                    'You are currently offline. Saved AI Chats and Study Notes remain available from local storage.',
                    'এই মুহূর্তে ইন্টারনেট সংযোগ নেই — তবে লোকাল স্টোরেজে থাকা আগের চ্যাট ও শিক্ষার নোট পড়তে পারবেন।'
                  )}
                </p>
              </div>
            </div>
          )}

          {children}
          {bottomBanner}
        </main>
      </div>

      {/* Mobile Fixed Thumb-Zone Bottom Tab Bar */}
      <nav
        aria-label={t('Mobile Navigation', 'প্রধান মোবাইল নেভিগেশন')}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center"
      >
        {(
          [
            { id: 'home', en: 'Home', bn: 'হোম', icon: Home },
            { id: 'assistant', en: 'Chat', bn: 'চ্যাট', icon: MessageSquareText },
            { id: 'tools', en: 'Tools', bn: 'টুলস', icon: LayoutGrid },
            { id: 'history', en: 'History', bn: 'ইতিহাস', icon: History },
            { id: 'profile', en: 'Profile', bn: 'প্রোফাইল', icon: User },
          ] as { id: AppPage; en: string; bn: string; icon: React.FC<{ className?: string }> }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active =
            currentPage === tab.id ||
            (tab.id === 'tools' &&
              ['education', 'jobs', 'health', 'social', 'video', 'photo'].includes(currentPage)) ||
            (tab.id === 'profile' && ['subscription', 'admin'].includes(currentPage));

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? 'text-blue-700 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] leading-tight whitespace-nowrap">
                {t(tab.en, tab.bn)}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
