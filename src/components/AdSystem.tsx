import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Clock, Crown, Lock, Megaphone, Sparkles, X } from 'lucide-react';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import type { AdMobConfig, AdSystemState, AppPage } from '../types';

export const REAL_ADSENSE_PUBLISHER_ID = 'ca-pub-9416678178678630';

export const REAL_ADSENSE_DEFAULT_CONFIG: AdMobConfig = {
  providerMode: 'live_admob',
  testMode: false,
  appId: '',
  bannerUnitId: '',
  entryInterstitialUnitId: '',
  studyInterstitialUnitId: '',
  adsenseClientId: REAL_ADSENSE_PUBLISHER_ID,
  adsenseBannerSlot: '',
  adsenseInterstitialSlot: '',
};

export const GOOGLE_TEST_ADMOB_CONFIG: AdMobConfig = {
  providerMode: 'test_ad',
  testMode: true,
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
  entryInterstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  studyInterstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  adsenseClientId: '',
  adsenseBannerSlot: '',
  adsenseInterstitialSlot: '',
};

export function resolveAdMobConfig(ads: AdSystemState): AdMobConfig {
  const cfg = ads.admobConfig;
  if (!cfg) return REAL_ADSENSE_DEFAULT_CONFIG;
  return {
    ...REAL_ADSENSE_DEFAULT_CONFIG,
    ...cfg,
    adsenseClientId:
      cfg.providerMode === 'live_admob' && !cfg.adsenseClientId
        ? REAL_ADSENSE_PUBLISHER_ID
        : (cfg.adsenseClientId ?? ''),
  };
}

function ensureAdSenseScriptLoaded(clientId: string) {
  if (typeof document === 'undefined' || !clientId.startsWith('ca-pub-')) return;
  const existing = document.querySelector(
    `script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"][src*="${clientId}"]`
  );
  if (existing) return;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.sathiAdsense = clientId;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  document.head.appendChild(script);
}

const AdSenseUnitSlot: React.FC<{
  clientId: string;
  slotId?: string;
  format?: 'horizontal' | 'rectangle' | 'auto';
  className?: string;
}> = ({ clientId, slotId, format = 'auto', className = '' }) => {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!clientId.startsWith('ca-pub-') || !slotId?.trim()) return;
    ensureAdSenseScriptLoaded(clientId);
    if (!pushedRef.current) {
      pushedRef.current = true;
      try {
        const w = window as unknown as { adsbygoogle?: unknown[] };
        w.adsbygoogle = w.adsbygoogle || [];
        w.adsbygoogle.push({});
      } catch {
        // Ignore if blocked by adblocker
      }
    }
  }, [clientId, slotId]);

  if (!clientId.startsWith('ca-pub-') || !slotId?.trim()) return null;

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: 'block' }}
      data-ad-client={clientId}
      data-ad-slot={slotId.trim()}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
};

interface BottomBannerAdProps {
  ads: AdSystemState;
  isPaidUser: boolean;
  currentPage: AppPage;
  isTaskBusy: boolean;
  onNavigate: (page: AppPage) => void;
  onTrack: (event: 'banner_impression' | 'click') => void;
}

export const BottomBannerAd: React.FC<BottomBannerAdProps> = ({
  ads,
  isPaidUser,
  currentPage,
  isTaskBusy,
  onNavigate,
  onTrack,
}) => {
  const { t } = useUiLanguage();
  const trackedRef = useRef<string>('');
  const cfg = resolveAdMobConfig(ads);
  const isTestAd = cfg.providerMode === 'test_ad' || cfg.testMode;
  const isLiveAdMob = cfg.providerMode === 'live_admob' && !cfg.testMode;
  const effectiveAdSenseId = cfg.adsenseClientId || REAL_ADSENSE_PUBLISHER_ID;
  const hasLiveAdSenseSlot = isLiveAdMob && Boolean(effectiveAdSenseId && cfg.adsenseBannerSlot);

  // Zero ads for Pro users; never display floating/sticky ads or banners over chat, AI answers, input boxes, or bottom nav
  const shouldShow =
    ads.banner.enabled &&
    !isPaidUser &&
    !isTaskBusy &&
    (currentPage === 'home' || currentPage === 'tools') &&
    (hasLiveAdSenseSlot || isTestAd);

  useEffect(() => {
    if (shouldShow && isLiveAdMob && effectiveAdSenseId.startsWith('ca-pub-')) {
      ensureAdSenseScriptLoaded(effectiveAdSenseId);
    }
  }, [shouldShow, isLiveAdMob, effectiveAdSenseId]);

  useEffect(() => {
    if (shouldShow && trackedRef.current !== currentPage) {
      trackedRef.current = currentPage;
      onTrack('banner_impression');
    }
  }, [shouldShow, currentPage, onTrack]);

  if (!shouldShow) return null;

  const activeIdentifier = isTestAd
    ? cfg.bannerUnitId
    : cfg.bannerUnitId || effectiveAdSenseId;

  return (
    <div
      role="region"
      aria-label={t('Sponsored Banner Advertisement', 'স্পন্সরড ব্যানার বিজ্ঞাপন')}
      data-ad-slot="bottom-banner"
      data-ad-mode={cfg.providerMode}
      data-ad-client={isLiveAdMob ? effectiveAdSenseId : undefined}
      data-ad-unit={activeIdentifier}
      className="mt-8 border border-blue-200 dark:border-blue-900/70 bg-white dark:bg-slate-900 rounded-2xl px-3.5 py-2.5 shadow-sm space-y-2"
    >
      {hasLiveAdSenseSlot ? (
        <AdSenseUnitSlot
          clientId={effectiveAdSenseId}
          slotId={cfg.adsenseBannerSlot}
          format="horizontal"
        />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
              {isTestAd && (
                <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white font-bold tracking-wide">
                  TEST AD
                </span>
              )}
              {isLiveAdMob && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold tracking-wide">
                  Google AdSense
                </span>
              )}
              <span>{ads.banner.sponsorLabel || t('Ad', 'বিজ্ঞাপন')}</span>
              <span aria-hidden="true">·</span>
              <span>
                {isTestAd
                  ? t('Google Test Banner', 'Google টেস্ট ব্যানার')
                  : isLiveAdMob
                    ? t('Real AdSense Banner & Auto Ads', 'আসল AdSense ব্যানার ও অটো অ্যাড')
                    : t('Persistent Ad', 'স্থায়ী ব্যানার অ্যাড')}
              </span>
              {activeIdentifier && (
                <span className="hidden sm:inline font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[230px]">
                  ({activeIdentifier})
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {ads.banner.title}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              {ads.banner.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onTrack('click');
            onNavigate(ads.banner.targetPage || 'subscription');
          }}
          className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          <Crown className="w-3.5 h-3.5" />
          <span>{ads.banner.ctaText || t('Go Pro', 'প্রো নিন')}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export type InterstitialAdMode = 'entry' | 'forced_study' | 'preview';

interface InterstitialAdModalProps {
  open: boolean;
  mode?: InterstitialAdMode;
  ads: AdSystemState;
  shownCount: number;
  countdownSeconds?: number;
  answerReady?: boolean;
  answerFailed?: boolean;
  onClose: () => void;
  onNavigate: (page: AppPage) => void;
  onTrack: (event: 'interstitial_impression' | 'click') => void;
}

export const InterstitialAdModal: React.FC<InterstitialAdModalProps> = ({
  open,
  mode = 'entry',
  ads,
  shownCount,
  countdownSeconds = 5,
  answerReady = false,
  answerFailed = false,
  onClose,
  onNavigate,
  onTrack,
}) => {
  const { t } = useUiLanguage();
  const effectiveDuration = mode === 'preview' ? 0 : Math.max(1, countdownSeconds);
  const [secondsLeft, setSecondsLeft] = useState(effectiveDuration);
  const trackedOpenRef = useRef(false);

  const cfg = resolveAdMobConfig(ads);
  const isTestAd = cfg.providerMode === 'test_ad' || cfg.testMode;
  const isLiveAdMob = cfg.providerMode === 'live_admob' && !cfg.testMode;
  const effectiveAdSenseId = cfg.adsenseClientId || REAL_ADSENSE_PUBLISHER_ID;
  const activeUnitId = isTestAd
    ? mode === 'forced_study'
      ? cfg.studyInterstitialUnitId
      : cfg.entryInterstitialUnitId
    : (mode === 'forced_study' ? cfg.studyInterstitialUnitId : cfg.entryInterstitialUnitId) ||
      effectiveAdSenseId;

  useEffect(() => {
    if (!open) {
      trackedOpenRef.current = false;
      return;
    }

    if (isLiveAdMob && effectiveAdSenseId.startsWith('ca-pub-')) {
      ensureAdSenseScriptLoaded(effectiveAdSenseId);
    }

    setSecondsLeft(effectiveDuration);
    if (!trackedOpenRef.current) {
      trackedOpenRef.current = true;
      onTrack('interstitial_impression');
    }

    if (effectiveDuration <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, effectiveDuration, onTrack, isLiveAdMob, effectiveAdSenseId]);

  if (!open) return null;

  const canSkip = secondsLeft <= 0;
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, Math.round(((effectiveDuration - secondsLeft) / effectiveDuration) * 100))
      : 100;

  const isForcedStudy = mode === 'forced_study';
  const isEntry = mode === 'entry';
  const hasLiveAdSenseSlot =
    isLiveAdMob && Boolean(effectiveAdSenseId && cfg.adsenseInterstitialSlot);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('Fullscreen Advertisement', 'ফুলস্ক্রিন বিজ্ঞাপন')}
      data-ad-slot={isForcedStudy ? 'forced-study-interstitial' : 'entry-interstitial'}
      data-ad-mode={cfg.providerMode}
      data-ad-client={isLiveAdMob ? effectiveAdSenseId : undefined}
      data-ad-unit={activeUnitId}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Top Bar with Placement Label & 5-Second Skip Control */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
            {isTestAd && (
              <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold tracking-wide">
                TEST AD
              </span>
            )}
            {isLiveAdMob && (
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold tracking-wide">
                Google AdSense
              </span>
            )}
            {isForcedStudy ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>{t('Mandatory Ad Before Answer', 'উত্তরের আগে বাধ্যতামূলক বিজ্ঞাপন')}</span>
              </span>
            ) : isEntry ? (
              <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('App Entry Ad', 'অ্যাপ প্রবেশ বিজ্ঞাপন')}</span>
              </span>
            ) : (
              <span>
                {t('Sponsored Ad', 'স্পন্সরড বিজ্ঞাপন')} ({shownCount})
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!canSkip}
            onClick={() => {
              if (canSkip) onClose();
            }}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              canSkip
                ? 'bg-slate-900 dark:bg-blue-700 text-white hover:bg-slate-800 dark:hover:bg-blue-600 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
            }`}
          >
            {canSkip ? (
              <>
                <X className="w-4 h-4" />
                <span>{t('Skip / Close', 'Skip করুন')}</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span className="tabular-nums">
                  {t(`Skip in ${secondsLeft}s`, `${secondsLeft} সেকেন্ড পর Skip`)}
                </span>
              </>
            )}
          </button>
        </div>

        {/* 5-second countdown progress bar */}
        {effectiveDuration > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-700 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right tabular-nums">
              {canSkip
                ? t('You can skip this ad now', 'এখন বিজ্ঞাপন Skip করতে পারবেন')
                : t(
                    `Skip unlocks in ${secondsLeft} second${secondsLeft === 1 ? '' : 's'}`,
                    `${secondsLeft} সেকেন্ড পর Skip বাটন চালু হবে`
                  )}
            </p>
          </div>
        )}

        {/* Active AdSense / AdMob Status */}
        {(isTestAd || isLiveAdMob) && (
          <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isTestAd
                  ? t('Google Test Ad Active', 'Google টেস্ট অ্যাড চালু')
                  : t('Real Google AdSense Active', 'আসল Google AdSense চালু')}
              </span>
            </span>
            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[185px]">
              {activeUnitId}
            </span>
          </div>
        )}

        {hasLiveAdSenseSlot ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-800">
            <AdSenseUnitSlot
              clientId={effectiveAdSenseId}
              slotId={cfg.adsenseInterstitialSlot}
              format="rectangle"
            />
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white p-6 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 text-[11px] font-semibold text-blue-100">
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {isTestAd
                  ? t('Google AdMob Test Creative · Sathi AI Pro', 'Google AdMob টেস্ট অ্যাড · সাথী AI প্রো')
                  : t('Sathi AI · Real Google AdSense Partner', 'সাথী AI · Google AdSense অনুমোদিত')}
              </span>
            </div>
            <h3 className="text-xl font-bold leading-snug">{ads.interstitial.title}</h3>
            <p className="text-sm text-blue-100 leading-relaxed">{ads.interstitial.description}</p>
            <p className="text-xs text-blue-200 pt-1">
              {t(
                'Upgrade to Pro via bKash/Nagad to stop all ads and get 200+ daily AI requests!',
                'Pro কিনলে সব বিজ্ঞাপন বন্ধ হবে এবং দৈনিক ২০০+ এআই অনুরোধ ব্যবহার করতে পারবেন!'
              )}
            </p>
          </div>
        )}

        {/* Study Status Pill during Forced Ad */}
        {isForcedStudy && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
              answerFailed
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }`}
          >
            <span>
              {answerFailed
                ? t(
                    'Could not complete the AI request. Skip to view details.',
                    'এআই অনুরোধ সম্পন্ন করা যায়নি। Skip করে বিস্তারিত দেখুন।'
                  )
                : answerReady
                  ? t('Your step-by-step solution is ready!', 'আপনার প্রশ্নের সমাধান তৈরি হয়ে গেছে!')
                  : t('AI is solving your question right now...', 'এআই আপনার প্রশ্নের উত্তর তৈরি করছে...')}
            </span>
            <span className="font-mono font-bold tabular-nums">
              {canSkip ? (answerFailed ? t('Notice', 'বার্তা') : t('Ready', 'প্রস্তুত')) : `${secondsLeft}s`}
            </span>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            disabled={!canSkip}
            onClick={() => {
              if (canSkip) onClose();
            }}
            className={`flex-1 min-h-[44px] px-4 rounded-xl text-sm font-semibold transition-colors ${
              canSkip
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                : 'border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 cursor-not-allowed'
            }`}
          >
            {canSkip
              ? isForcedStudy
                ? answerFailed
                  ? t('Close Ad & View Error', 'অ্যাড বন্ধ করে বার্তা দেখুন')
                  : t('View Answer (Skip Ad)', 'উত্তর দেখুন (Skip Ad)')
                : t('Continue to Sathi AI', 'সাথী AI-তে প্রবেশ করুন')
              : t(`Wait ${secondsLeft}s to Skip`, `Skip করতে ${secondsLeft}s অপেক্ষা করুন`)}
          </button>

          <button
            type="button"
            onClick={() => {
              onTrack('click');
              onClose();
              onNavigate(ads.interstitial.targetPage || 'subscription');
            }}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors"
          >
            {ads.interstitial.ctaText || t('Remove All Ads (Pro)', 'সব অ্যাড বন্ধ করুন (Pro)')}
          </button>
        </div>
      </div>
    </div>
  );
};
