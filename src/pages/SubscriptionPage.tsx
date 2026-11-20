import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Loader2,
  ShieldAlert,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import type {
  AppStateResponse,
  PaymentConfig,
  PaymentMethod,
  PaymentRequest,
  QuotaState,
  SubscriptionPlanConfig,
  SubscriptionState,
} from '../types';

interface SubscriptionPageProps {
  subscription: SubscriptionState;
  quota: QuotaState;
  plans?: SubscriptionPlanConfig[];
  payments: PaymentRequest[];
  paymentConfig?: PaymentConfig;
  onStateSync: (state: AppStateResponse) => void;
}

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  bkashEnabled: true,
  bkashNumber: '01944527151',
  nagadEnabled: true,
  nagadNumber: '01354848807',
  rocketEnabled: false,
  rocketNumber: '',
  cardEnabled: false,
  sendMoneyNoteEn: 'Select "Send Money" from bKash or Nagad App, send the exact amount, and enter your TrxID below.',
  sendMoneyNoteBn: 'bKash বা Nagad অ্যাপ থেকে "Send Money" করে নির্ধারিত টাকা পাঠান এবং নিচে আপনার TrxID দিন।',
};

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
  subscription,
  quota,
  plans = [],
  payments,
  paymentConfig,
  onStateSync,
}) => {
  const { uiLang, t, formatDate } = useUiLanguage();
  const cfg = paymentConfig ?? DEFAULT_PAYMENT_CONFIG;

  const enabledMethods = useMemo(() => {
    const list: { id: PaymentMethod; labelEn: string; labelBn: string; number: string }[] = [];
    if (cfg.bkashEnabled) {
      list.push({
        id: 'bKash',
        labelEn: 'bKash (Send Money)',
        labelBn: 'বিকাশ (Send Money)',
        number: cfg.bkashNumber || '01944527151',
      });
    }
    if (cfg.nagadEnabled) {
      list.push({
        id: 'Nagad',
        labelEn: 'Nagad (Send Money)',
        labelBn: 'নগদ (Send Money)',
        number: cfg.nagadNumber || '01354848807',
      });
    }
    if (cfg.rocketEnabled) {
      list.push({
        id: 'Rocket',
        labelEn: 'Rocket',
        labelBn: 'রকেট',
        number: cfg.rocketNumber || '',
      });
    }
    if (cfg.cardEnabled) {
      list.push({
        id: 'Card',
        labelEn: 'Card Payment',
        labelBn: 'কার্ড পেমেন্ট',
        number: '',
      });
    }
    return list;
  }, [cfg]);

  const [selectedPlan, setSelectedPlan] = useState<'1_month' | '3_months'>('1_month');
  const [method, setMethod] = useState<PaymentMethod>(() => enabledMethods[0]?.id ?? 'bKash');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (enabledMethods.length > 0 && !enabledMethods.some((m) => m.id === method)) {
      setMethod(enabledMethods[0].id);
    }
  }, [enabledMethods, method]);

  const activeMethodObj = enabledMethods.find((m) => m.id === method) ?? enabledMethods[0];
  const freePlan = plans.find((p) => p.id === 'free');
  const oneMonthPlan = plans.find((p) => p.id === '1_month');
  const threeMonthPlan = plans.find((p) => p.id === '3_months');
  const activePrice =
    selectedPlan === '3_months'
      ? threeMonthPlan?.priceBdt ?? 500
      : oneMonthPlan?.priceBdt ?? 200;

  const remainingDaily = Math.max(0, quota.dailyLimit - quota.usedToday);
  const remainingMonthly = Math.max(0, quota.monthlyLimit - quota.monthlyUsed);

  const handleCopyNumber = async (num: string) => {
    if (!num) return;
    try {
      await navigator.clipboard.writeText(num);
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMethodObj) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/subscription/submit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          method: activeMethodObj.id,
          senderNumber,
          transactionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('Failed to submit payment.', 'পেমেন্ট জমা দিতে সমস্যা হয়েছে।'));
      }
      onStateSync(data.state);
      setSenderNumber('');
      setTransactionId('');
      setFeedback({
        type: 'success',
        text: data.message,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : t('Unexpected error occurred.', 'অপ্রত্যাশিত ত্রুটি হয়েছে।'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('Subscription & Usage Quota', 'সাবস্ক্রিপশন ও ব্যবহারের কোটা')}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('Sathi AI Pro Plans', 'সাথী AI প্রো প্ল্যান')}
        </h1>
      </div>

      {/* Current Subscription & Quota Overview */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Current Plan', 'বর্তমান প্ল্যান')}
          </p>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
            <Crown className={`w-4 h-4 ${subscription.isPaid ? 'text-amber-500' : 'text-slate-400'}`} />
            <span>
              {subscription.isPaid
                ? subscription.planNameBn
                : t('Free Starter', subscription.planNameBn)}
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {subscription.expiresAt
              ? `${t('Expires:', 'মেয়াদ শেষ:')} ${formatDate(subscription.expiresAt)}`
              : t('Free plan (no expiration)', 'ফ্রি প্ল্যান (মেয়াদ সীমাবদ্ধ নয়)')}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Remaining Daily Quota', 'আজকের অবশিষ্ট কোটা')}
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-400 mt-0.5">
            {remainingDaily} / {quota.dailyLimit}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {t(`Used: ${quota.usedToday} requests`, `ব্যবহৃত: ${quota.usedToday}টি অনুরোধ`)}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Remaining Monthly Quota', 'মাসিক অবশিষ্ট কোটা')}
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
            {remainingMonthly} / {quota.monthlyLimit}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subscription.isPaid
              ? t('Ad-free · Offline Mode ON (Pro)', 'বিজ্ঞাপনমুক্ত · অফলাইন মোড চালু (Pro)')
              : t('Ad-supported · Offline Mode OFF', 'বিজ্ঞাপনযুক্ত · অফলাইন মোড বন্ধ')}
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {uiLang === 'bn' ? freePlan?.nameBn || 'ফ্রি স্টার্টার' : freePlan?.nameEn || 'Free Plan'}
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
              ৳{freePlan?.priceBdt ?? 0}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {uiLang === 'bn' ? freePlan?.descriptionBn || 'দৈনিক সীমিত ব্যবহার' : 'Limited daily AI usage'}
            </p>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li>
                •{' '}
                {t(
                  `${freePlan?.dailyLimit ?? 12} daily AI requests`,
                  `দৈনিক ${freePlan?.dailyLimit ?? 12}টি এআই প্রশ্নোত্তর`
                )}
              </li>
              <li>
                •{' '}
                {t(
                  `${freePlan?.monthlyLimit ?? 150} monthly request quota`,
                  `মাসিক ${freePlan?.monthlyLimit ?? 150}টি অনুরোধ কোটা`
                )}
              </li>
              <li>• {t('Ads enabled (Entry, Banner & 5s Study Ad)', 'বিজ্ঞাপন চালু (প্রবেশ, ব্যানার ও পড়াশোনার Ad)')}</li>
              <li>• {t('Offline Mode OFF (Requires Data / Wi-Fi)', 'অফলাইন মোড বন্ধ (ডাটা / Wi-Fi আবশ্যক)')}</li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            {!subscription.isPaid ? t('Currently Active', 'বর্তমানে সক্রিয়') : t('Basic Tier', 'বেসিক স্তর')}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSelectedPlan('1_month')}
          className={`text-left rounded-2xl p-5 flex flex-col justify-between border-2 transition-colors ${
            selectedPlan === '1_month'
              ? 'border-blue-700 bg-blue-50/40 dark:bg-blue-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {uiLang === 'bn'
                  ? oneMonthPlan?.nameBn || '১ মাস প্রো'
                  : oneMonthPlan?.nameEn || '200 BDT Plan (1 Month)'}
              </p>
              <span className="text-xs text-slate-500">
                {oneMonthPlan?.durationDays ?? 30} {t('days', 'দিন মেয়াদ')}
              </span>
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
              ৳{oneMonthPlan?.priceBdt ?? 200}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {uiLang === 'bn' ? oneMonthPlan?.descriptionBn || 'মাসিক প্যাকেজ' : 'Monthly Pro package'}
            </p>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li>
                •{' '}
                {t(
                  `${oneMonthPlan?.dailyLimit ?? 200} daily AI requests`,
                  `দৈনিক ${oneMonthPlan?.dailyLimit ?? 200}টি এআই অনুরোধ`
                )}
              </li>
              <li>• {t('Zero Ads (All 3 Ad Slots Turned OFF)', 'সব বিজ্ঞাপন বন্ধ (সম্পূর্ণ অ্যাড-মুক্ত)')}</li>
              <li>• {t('Offline Mode ON (Read Saved Chats & Study Notes)', 'অফলাইন মোড চালু (আগের চ্যাট ও শিক্ষার নোট)')}</li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-blue-700 dark:text-blue-400">
            {selectedPlan === '1_month' ? t('Selected Plan', 'নির্বাচিত প্যাকেজ') : t('Select Plan', 'নির্বাচন করুন')}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedPlan('3_months')}
          className={`text-left rounded-2xl p-5 flex flex-col justify-between border-2 transition-colors ${
            selectedPlan === '3_months'
              ? 'border-blue-700 bg-blue-50/40 dark:bg-blue-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {uiLang === 'bn'
                  ? threeMonthPlan?.nameBn || '৩ মাস প্রো'
                  : threeMonthPlan?.nameEn || '500 BDT Plan (3 Months)'}
              </p>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {t('Save ৳100', '৳১০০ সাশ্রয়')}
              </span>
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
              ৳{threeMonthPlan?.priceBdt ?? 500}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {threeMonthPlan?.durationDays ?? 90} {t('days validity', 'দিন মেয়াদ')}
            </p>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li>
                •{' '}
                {t(
                  `${threeMonthPlan?.dailyLimit ?? 200}/day & ${threeMonthPlan?.monthlyLimit ?? 6000}/month quota`,
                  `দৈনিক ${threeMonthPlan?.dailyLimit ?? 200}টি ও মাসিক ${threeMonthPlan?.monthlyLimit ?? 6000} কোটা`
                )}
              </li>
              <li>• {t('Zero Ads (Entry, Banner & Forced Ad Disabled)', 'সম্পূর্ণ বিজ্ঞাপনমুক্ত অভিজ্ঞতা (সব Ad বন্ধ)')}</li>
              <li>• {t('Offline Mode ON (Chats + Study Notes without Data)', 'অফলাইন মোড চালু (ডাটা ছাড়াই চ্যাট ও নোট)')}</li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-blue-700 dark:text-blue-400">
            {selectedPlan === '3_months' ? t('Selected Plan', 'নির্বাচিত প্যাকেজ') : t('Select Plan', 'নির্বাচন করুন')}
          </div>
        </button>
      </div>

      {/* Payment Verification Form (bKash & Nagad Send Money Only by Default) */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t(
              `Send Money & Verification (${selectedPlan === '3_months' ? `3 Months — ৳${activePrice}` : `1 Month — ৳${activePrice}`})`,
              `পেমেন্ট ও যাচাইকরণ ফর্ম (${selectedPlan === '3_months' ? `৩ মাস — ৳${activePrice}` : `১ মাস — ৳${activePrice}`})`
            )}
          </h2>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {t(
              'Important: Send Money first to the selected bKash or Nagad number, then submit your Sender Number and Transaction ID (TrxID) for admin verification.',
              'গুরুত্বপূর্ণ: পেমেন্ট তথ্য জমা দেওয়ার পর অ্যাডমিন কর্তৃক ট্রানজেকশন আইডি (TrxID) যাচাই না হওয়া পর্যন্ত পেইড সাবস্ক্রিপশন স্বয়ংক্রিয়ভাবে চালু হবে না।'
            )}
          </span>
        </div>

        {enabledMethods.length === 0 ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
            {t(
              'All payment methods are currently disabled by Admin.',
              'বর্তমানে অ্যাডমিন সব পেমেন্ট মাধ্যম বন্ধ রেখেছেন।'
            )}
          </div>
        ) : (
          <>
            <div
              className={`grid gap-3 ${
                enabledMethods.length === 1
                  ? 'grid-cols-1'
                  : enabledMethods.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {enabledMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`min-h-[52px] px-4 py-2.5 rounded-xl border-2 text-left transition-colors flex items-center justify-between gap-2 ${
                    activeMethodObj?.id === m.id
                      ? m.id === 'bKash'
                        ? 'border-pink-600 bg-pink-600 text-white'
                        : m.id === 'Nagad'
                          ? 'border-orange-600 bg-orange-600 text-white'
                          : 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 hover:border-blue-500'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold">{uiLang === 'bn' ? m.labelBn : m.labelEn}</p>
                    {m.number && (
                      <p
                        className={`text-xs font-mono mt-0.5 ${
                          activeMethodObj?.id === m.id ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {m.number}
                      </p>
                    )}
                  </div>
                  <Smartphone className="w-4 h-4 shrink-0 opacity-85" />
                </button>
              ))}
            </div>

            {/* Highlighted Send Money Instructions Box */}
            {activeMethodObj && (
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                      {t(
                        `Send Money via ${activeMethodObj.id}`,
                        `${activeMethodObj.id} দিয়ে Send Money করুন`
                      )}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold font-mono tracking-wide text-slate-900 dark:text-white mt-0.5">
                      {activeMethodObj.number || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 text-xs font-bold text-slate-900 dark:text-white font-mono">
                      ৳{activePrice}
                    </div>
                    {activeMethodObj.number && (
                      <button
                        type="button"
                        onClick={() => handleCopyNumber(activeMethodObj.number)}
                        className="min-h-[40px] px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        {copiedNum ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedNum ? t('Copied!', 'কপি হয়েছে') : t('Copy Number', 'নম্বর কপি')}</span>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {uiLang === 'bn' ? cfg.sendMoneyNoteBn : cfg.sendMoneyNoteEn}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  {t('Sender Mobile Number', 'আপনার পাঠানো মোবাইল নম্বর')}
                </label>
                <input
                  type="text"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder={t('e.g., 01712345678', 'যেমন: 01712345678')}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  {t('Transaction ID (TrxID)', 'ট্রানজেকশন আইডি (TrxID)')}
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder={t('e.g., BKS9482XYZ', 'যেমন: BKS9482XYZ')}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono uppercase"
                />
              </div>
            </div>
          </>
        )}

        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs sm:text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={submitting || enabledMethods.length === 0}
            className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{t('Submit Payment Details', 'পেমেন্ট তথ্য জমা দিন')}</span>
          </button>
        </div>
      </form>

      {/* Payment Verification History */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
          {t('Your Payment & Verification History', 'আপনার পেমেন্ট ও যাচাইয়ের অবস্থা')}
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {payments.map((p) => (
            <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {p.planLabel} · {p.method}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  TrxID: {p.transactionId} · {p.senderNumber} · ৳{p.amountBdt}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {p.status === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('Verified & Active', 'যাচাইকৃত ও সক্রিয়')}</span>
                  </span>
                )}
                {p.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span>{t('Pending Verification', 'যাচাইয়ের অপেক্ষায়')}</span>
                  </span>
                )}
                {p.status === 'rejected' && (
                  <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                    <XCircle className="w-4 h-4" />
                    <span>{t('Rejected', 'বাতিল হয়েছে')}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
