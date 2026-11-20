import React, { useState } from 'react';
import { Check, Download, ExternalLink, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { t } = useUiLanguage();
  const { isInstalled, hasNativePrompt, platformHint, triggerNativeInstall } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          <Check className="w-4 h-4 shrink-0" />
          <span>{t('Sathi AI is installed as a Chrome App!', 'সাথী AI অ্যাপ হিসেবে ইনস্টল করা আছে!')}</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (hasNativePrompt) {
      const outcome = await triggerNativeInstall();
      if (outcome !== 'accepted') {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2200);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          title={t('Install App in Chrome (Free)', 'Chrome থেকে ফ্রি অ্যাপ ইনস্টল করুন')}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{t('Install App', 'অ্যাপ ইনস্টল')}</span>
        </button>
      ) : (
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-blue-800/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-blue-300" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-white">
                {t(
                  'Install Sathi AI from Chrome — Free, No Play Store Needed',
                  'Play Store ছাড়াই Chrome থেকে ফ্রি অ্যাপ ইনস্টল করুন'
                )}
              </p>
              <p className="text-xs text-blue-200">
                {t(
                  'Add to Home Screen in one tap to launch Sathi AI fullscreen like a real mobile app.',
                  'এক ক্লিকে Add to Home Screen করে একদম ফোনের অ্যাপের মতো ব্যবহার করুন — কোনো টাকা লাগবে না।'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            className="min-h-[42px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{t('Install / Add to Home Screen', 'ইনস্টল করুন (Chrome App)')}</span>
          </button>
        </div>
      )}

      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('Install Sathi AI in Chrome', 'Chrome-এ সাথী AI ইনস্টল গাইড')}
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('Install Sathi AI (Free Chrome App)', 'সাথী AI অ্যাপ ইনস্টল করুন (ফ্রি)')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('No Play Store fee required', 'Play Store ছাড়াই সরাসরি Chrome থেকে')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={t('Close', 'বন্ধ করুন')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {hasNativePrompt ? (
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-3">
                <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
                  {t(
                    'Your browser supports one-tap installation! Click below to install Sathi AI directly on your device.',
                    'আপনার Chrome ব্রাউজারে সরাসরি ১-ট্যাপে ইনস্টল সমর্থন করে। নিচের বাটনে চাপ দিন:'
                  )}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const out = await triggerNativeInstall();
                    if (out === 'accepted') setGuideOpen(false);
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('Install Sathi AI Now', 'এখনই ইনস্টল করুন')}</span>
                </button>
              </div>
            ) : platformHint === 'ios-safari' ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 space-y-2.5 text-xs text-slate-700 dark:text-slate-200">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Share className="w-4 h-4 text-blue-600" />
                  <span>{t('iPhone / iPad Safari Steps:', 'iPhone / iPad-এ ইনস্টলের নিয়ম:')}</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>{t('Tap the Share icon at the bottom of Safari.', 'নিচের Share বাটনে ট্যাপ করুন।')}</li>
                  <li>{t('Scroll down and tap "Add to Home Screen".', 'নিচে গিয়ে "Add to Home Screen" সিলেক্ট করুন।')}</li>
                  <li>{t('Tap "Add" — Sathi AI will appear like a native app.', 'ডানপাশে "Add" চাপলে হোম স্ক্রিনে অ্যাপ চলে আসবে।')}</li>
                </ol>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 space-y-2.5 text-xs text-slate-700 dark:text-slate-200">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MoreVertical className="w-4 h-4 text-blue-600" />
                  <span>
                    {t(
                      'How to Install in Google Chrome:',
                      'Google Chrome-এ অ্যাপ হিসেবে সেভ করার নিয়ম:'
                    )}
                  </span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>
                    {t(
                      'Open this link directly in a Chrome tab (if viewing inside an embedded preview, open it in a full Chrome tab first).',
                      'লিংকটি সরাসরি Chrome ব্রাউজারে খুলুন।'
                    )}
                  </li>
                  <li>
                    {t(
                      'On Android Chrome: tap the 3-dot menu (⋮) → "Add to Home screen" or "Install app".',
                      'মোবাইল Chrome-এ উপরে ডানপাশের ⋮ মেনু → "Add to Home screen" / "Install app" চাপুন।'
                    )}
                  </li>
                  <li>
                    {t(
                      'On Desktop Chrome: click the Install icon in the right side of the address bar.',
                      'কম্পিউটার Chrome-এ অ্যাড্রেস বারের ডানদিকে Install আইকনে ক্লিক করুন।'
                    )}
                  </li>
                </ol>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ExternalLink className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? t('Link Copied!', 'লিংক কপি হয়েছে!') : t('Copy Website Link', 'ওয়েবসাইট লিংক কপি করুন')}</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="min-h-[40px] px-4 rounded-xl bg-slate-900 dark:bg-blue-700 text-white text-xs font-semibold"
              >
                {t('Got it', 'বুঝেছি')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
