import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Cpu,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  FileWarning,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Smartphone,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Video,
  Wrench,
  X,
} from 'lucide-react';
import { GOOGLE_TEST_ADMOB_CONFIG, REAL_ADSENSE_DEFAULT_CONFIG } from '../components/AdSystem';
import { adminFetch, setStoredAdminToken } from '../utils/adminToken';
import type {
  AdMobConfig,
  AdminDashboardData,
  AdminSessionInfo,
  AppSettingsConfig,
  AppStateResponse,
  GeminiModelId,
  PaymentRequest,
  RegisteredUserRecord,
  SubscriptionPlanConfig,
  SubscriptionPlanId,
} from '../types';

type AdminTabId = 'overview' | 'users' | 'plans' | 'api' | 'settings' | 'security';

interface AdminPageProps {
  adminSession: AdminSessionInfo;
  onSessionChange: (next: AdminSessionInfo) => void;
  onAppStateSync: (next: AppStateResponse) => void;
  onPreviewInterstitial: () => void;
  onExitAdmin: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  adminSession,
  onSessionChange,
  onAppStateSync,
  onPreviewInterstitial,
  onExitAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Login Gate state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusBanner({ type, text });
    window.setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 3400);
  };

  const fetchDashboard = useCallback(async () => {
    if (!adminSession.authenticated) return;
    setLoadingDashboard(true);
    setDashboardError(null);
    try {
      const res = await adminFetch('/api/admin/dashboard');
      if (res.status === 401 || res.status === 403) {
        setStoredAdminToken(null);
        onSessionChange({
          ...adminSession,
          authenticated: false,
          role: 'user',
          email: null,
        });
        setDashboard(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'অ্যাডমিন ডেটা লোড করা যায়নি।');
      }
      setDashboard(data as AdminDashboardData);
    } catch (err) {
      setDashboardError(
        err instanceof Error ? err.message : 'অ্যাডমিন ড্যাশবোর্ড লোড করতে সমস্যা হয়েছে।'
      );
    } finally {
      setLoadingDashboard(false);
    }
  }, [adminSession, onSessionChange]);

  useEffect(() => {
    if (adminSession.authenticated) {
      fetchDashboard();
    } else {
      setDashboard(null);
    }
  }, [adminSession.authenticated, fetchDashboard]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'ভুল ইমেইল / পাসওয়ার্ড');
        return;
      }
      if (typeof data.token === 'string' && data.token) {
        setStoredAdminToken(data.token);
      }
      setLoginPassword('');
      onSessionChange(data.session as AdminSessionInfo);
    } catch {
      setLoginError('সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await adminFetch('/api/auth/admin-logout', {
        method: 'POST',
      });
    } catch {
      // Ignore network hiccup
    }
    setStoredAdminToken(null);
    setDashboard(null);
    onSessionChange({
      ...adminSession,
      authenticated: false,
      role: 'user',
      email: null,
    });
  };

  const applyDashboardMutation = (data: {
    dashboard?: AdminDashboardData;
    state?: AppStateResponse;
  }) => {
    if (data.dashboard) setDashboard(data.dashboard);
    if (data.state) onAppStateSync(data.state);
  };

  // ============================================================
  // 1. HIDDEN ADMIN AUTHENTICATION GATE (When Not Logged In)
  // ============================================================
  if (!adminSession.authenticated) {
    return (
      <div className="max-w-lg mx-auto py-6 sm:py-10 space-y-5">
        <button
          type="button"
          onClick={onExitAdmin}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[38px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>সাথী AI অ্যাপে ফিরে যান</span>
        </button>

        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 p-6 text-white space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold">সাথী AI — অ্যাডমিন লগইন</h1>
            <p className="text-xs text-blue-100 leading-relaxed">
              কেবল অনুমোদিত অ্যাডমিন অ্যাকাউন্ট দিয়ে প্রবেশ করুন। সার্ভার-সাইড প্রমাণীকরণ ছাড়া কোনো ড্যাশবোর্ড তথ্য প্রদর্শিত হয় না।
            </p>
          </div>

          <div className="p-6 space-y-4">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  অ্যাডমিন ইমেইল
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@yourdomain.com"
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  অ্যাডমিন পাসওয়ার্ড
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full min-h-[46px] pl-3.5 pr-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-200"
                >
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                {loggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                <span>{loggingIn ? 'যাচাই করা হচ্ছে...' : 'অ্যাডমিন প্যানেলে প্রবেশ করুন'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 2. AUTHENTICATED ADMIN DASHBOARD
  // ============================================================
  if (loadingDashboard && !dashboard) {
    return (
      <div className="min-h-[360px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-700 dark:text-blue-400" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          সার্ভার থেকে লাইভ অ্যাডমিন ডেটা লোড হচ্ছে...
        </p>
      </div>
    );
  }

  if (dashboardError && !dashboard) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 p-6 text-center space-y-4">
        <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">{dashboardError}</p>
        <button
          type="button"
          onClick={fetchDashboard}
          className="min-h-[42px] px-5 rounded-xl bg-blue-700 text-white text-xs font-semibold"
        >
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  if (!dashboard) return null;

  const tabs: { id: AdminTabId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview', label: 'ওভারভিউ', icon: Activity },
    { id: 'users', label: `ব্যবহারকারী (${dashboard.users.length})`, icon: Users },
    { id: 'plans', label: 'প্ল্যান ও পেমেন্ট', icon: Crown },
    { id: 'api', label: 'API ও ৪২৯ লগ', icon: Cpu },
    { id: 'settings', label: 'সেটিংস ও অ্যাড', icon: Settings },
    { id: 'security', label: 'নিরাপত্তা লগ', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>যাচাইকৃত অ্যাডমিন: {adminSession.email}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">সাথী AI অ্যাডমিন কন্ট্রোল সেন্টার</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchDashboard}
            disabled={loadingDashboard}
            className="min-h-[40px] px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDashboard ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>
          <button
            type="button"
            onClick={onExitAdmin}
            className="min-h-[40px] px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>অ্যাপ ভিউ</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[40px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>লগআউট</span>
          </button>
        </div>
      </div>

      {/* Status Toast */}
      {statusBanner && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{statusBanner.text}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`min-h-[42px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          dashboard={dashboard}
          onApplyMutation={applyDashboardMutation}
          onNotify={notify}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'users' && (
        <UsersTab
          dashboard={dashboard}
          onApplyMutation={applyDashboardMutation}
          onNotify={notify}
        />
      )}

      {activeTab === 'plans' && (
        <PlansAndPaymentsTab
          dashboard={dashboard}
          onApplyMutation={applyDashboardMutation}
          onNotify={notify}
          onOpenPaymentSetup={() => setActiveTab('settings')}
        />
      )}

      {activeTab === 'api' && (
        <ApiAndModelsTab
          dashboard={dashboard}
          onApplyMutation={applyDashboardMutation}
          onNotify={notify}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsAndAdsTab
          dashboard={dashboard}
          onApplyMutation={applyDashboardMutation}
          onNotify={notify}
          onPreviewInterstitial={onPreviewInterstitial}
        />
      )}

      {activeTab === 'security' && <SecurityAuditTab dashboard={dashboard} />}
    </div>
  );
};

// ============================================================================
// TAB 1: OVERVIEW & LIVE STATISTICS
// ============================================================================
const OverviewTab: React.FC<{
  dashboard: AdminDashboardData;
  onApplyMutation: (d: { dashboard?: AdminDashboardData; state?: AppStateResponse }) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onNavigateTab: (tab: AdminTabId) => void;
}> = ({ dashboard, onApplyMutation, onNotify, onNavigateTab }) => {
  const { overview, payments, apiLogs, adminLogs } = dashboard;
  const pendingPayments = payments.filter((p) => p.status === 'pending');

  const handleVerifyPayment = async (id: string) => {
    const res = await adminFetch(`/api/admin/payments/${id}/verify`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify('পেমেন্ট যাচাই সম্পন্ন ও সাবস্ক্রিপশন সক্রিয় করা হয়েছে।');
    } else {
      onNotify(data.error || 'পেমেন্ট যাচাই ব্যর্থ হয়েছে।', 'error');
    }
  };

  const handleRejectPayment = async (id: string) => {
    const res = await adminFetch(`/api/admin/payments/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ reason: 'ট্রানজেকশন আইডি মেলেনি' }),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify('পেমেন্ট অনুরোধ বাতিল করা হয়েছে।');
    } else {
      onNotify(data.error || 'পেমেন্ট বাতিল করা যায়নি।', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Real Backend KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="মোট নিবন্ধিত ব্যবহারকারী"
          value={overview.totalUsers}
          sub={`সক্রিয়: ${overview.activeUsers} · স্থগিত: ${overview.suspendedUsers}`}
        />
        <StatCard
          label="ফ্রি ও প্রো ব্যবহারকারী"
          value={`${overview.freeUsers} / ${overview.proUsers}`}
          sub="ফ্রি বনাম প্রো"
          accent="blue"
        />
        <StatCard
          label="দৈনিক ও মাসিক AI অনুরোধ"
          value={`${overview.dailyAiRequests} / ${overview.monthlyAiRequests}`}
          sub={`মোট ব্যবহার: ${overview.totalAiRequests} · ক্যাশ হিট: ${overview.cacheHitCount}`}
        />
        <StatCard
          label="API ও ৪২৯ ত্রুটি লগ"
          value={overview.error429Count}
          sub={`মোট API ত্রুটি: ${overview.totalApiErrors}টি`}
          accent={overview.error429Count > 0 ? 'rose' : 'emerald'}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="অপেক্ষমাণ পেমেন্ট"
          value={overview.pendingPaymentsCount}
          sub="যাচাইয়ের অপেক্ষায়"
          accent="amber"
        />
        <StatCard
          label="যাচাইকৃত মোট আয়"
          value={`৳${overview.verifiedRevenueBdt}`}
          sub="সকল যাচাইকৃত ট্রানজেকশন"
          accent="emerald"
        />
        <StatCard
          label="রেট-লিমিট ৪২৯"
          value={overview.rateLimit429Count}
          sub="সাময়িক API থ্রটলিং"
        />
        <StatCard
          label="কোটা পূর্ণ ৪২৯"
          value={overview.quotaExhausted429Count}
          sub="ব্যবহারকারী/API কোটা সীমা"
        />
      </div>

      {/* Pending Payment Queue */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              অপেক্ষমাণ পেমেন্ট যাচাই ({pendingPayments.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('plans')}
            className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
          >
            সকল প্ল্যান ও পেমেন্ট →
          </button>
        </div>

        {pendingPayments.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            এই মুহূর্তে যাচাইয়ের জন্য কোনো অপেক্ষমাণ পেমেন্ট নেই।
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendingPayments.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                onVerify={handleVerifyPayment}
                onReject={handleRejectPayment}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent API Errors */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-rose-600" />
              <span>সাম্প্রতিক API ও ৪২৯ ঘটনা</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('api')}
              className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
            >
              সব লগ দেখুন
            </button>
          </div>
          {apiLogs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
              এখনো কোনো API কল রেকর্ড হয়নি। ব্যবহারকারীরা AI টুলস চালালে এখানে রিয়েল লগ দেখা যাবে।
            </p>
          ) : (
            <div className="space-y-2">
              {apiLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {log.endpoint} · {log.model}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {new Date(log.createdAt).toLocaleString('bn-BD')} · {log.latencyMs}ms
                    </p>
                  </div>
                  <ApiStatusBadge status={log.status} httpStatus={log.httpStatus} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Admin Activity */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>সাম্প্রতিক অ্যাডমিন অ্যাক্টিভিটি</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('security')}
              className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
            >
              অডিট লগ দেখুন
            </button>
          </div>
          {adminLogs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
              এখনো কোনো অ্যাডমিন অ্যাকশন রেকর্ড হয়নি।
            </p>
          ) : (
            <div className="space-y-2">
              {adminLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs space-y-0.5"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{log.summaryBn}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {log.actorEmail} · {new Date(log.createdAt).toLocaleString('bn-BD')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// ============================================================================
// TAB 2: USER MANAGEMENT
// ============================================================================
const UsersTab: React.FC<{
  dashboard: AdminDashboardData;
  onApplyMutation: (d: { dashboard?: AdminDashboardData; state?: AppStateResponse }) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ dashboard, onApplyMutation, onNotify }) => {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLocation, setNewLocation] = useState('ঢাকা, বাংলাদেশ');
  const [newPlanId, setNewPlanId] = useState<SubscriptionPlanId>('free');

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPlanId, setEditPlanId] = useState<SubscriptionPlanId>('free');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editDailyLimit, setEditDailyLimit] = useState(12);
  const [editMonthlyLimit, setEditMonthlyLimit] = useState(150);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dashboard.users;
    return dashboard.users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    );
  }, [dashboard.users, search]);

  const startEdit = (u: RegisteredUserRecord) => {
    if (editingUserId === u.id) {
      setEditingUserId(null);
      return;
    }
    setEditingUserId(u.id);
    setEditPlanId(u.subscription.planId);
    setEditExpiryDate(u.subscription.expiresAt ? u.subscription.expiresAt.slice(0, 10) : '');
    setEditDailyLimit(u.quota.dailyLimit);
    setEditMonthlyLimit(u.quota.monthlyLimit);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        phone: newPhone,
        location: newLocation,
        planId: newPlanId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      onNotify(data.error || 'ব্যবহারকারী যোগ করা যায়নি।', 'error');
      return;
    }
    onApplyMutation(data);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setShowAddForm(false);
    onNotify('নতুন ব্যবহারকারী সফলভাবে নিবন্ধিত হয়েছে।');
  };

  const handleToggleStatus = async (u: RegisteredUserRecord) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    const res = await adminFetch(`/api/admin/users/${u.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify(
        nextStatus === 'suspended'
          ? `${u.name}-এর অ্যাকাউন্ট স্থগিত করা হয়েছে।`
          : `${u.name}-এর অ্যাকাউন্ট পুনরায় সক্রিয় করা হয়েছে।`
      );
    } else {
      onNotify(data.error || 'অ্যাকাউন্ট অবস্থা পরিবর্তন ব্যর্থ হয়েছে।', 'error');
    }
  };

  const handleSaveUserPlan = async (userId: string) => {
    const res = await adminFetch(`/api/admin/users/${userId}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        planId: editPlanId,
        expiresAt: editExpiryDate ? new Date(`${editExpiryDate}T23:59:59`).toISOString() : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      if (data.user) {
        setEditDailyLimit(data.user.quota.dailyLimit);
        setEditMonthlyLimit(data.user.quota.monthlyLimit);
      }
      onNotify('ব্যবহারকারীর সাবস্ক্রিপশন প্ল্যান ও মেয়াদ হালনাগাদ হয়েছে।');
    } else {
      onNotify(data.error || 'প্ল্যান আপডেট ব্যর্থ হয়েছে।', 'error');
    }
  };

  const handleSaveUserQuota = async (userId: string, resetUsage = false) => {
    const res = await adminFetch(`/api/admin/users/${userId}/quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        dailyLimit: editDailyLimit,
        monthlyLimit: editMonthlyLimit,
        resetUsage,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify(resetUsage ? 'আজকের ব্যবহার শূন্য ও কোটা আপডেট হয়েছে।' : 'ব্যবহারকারীর কোটা হালনাগাদ হয়েছে।');
    } else {
      onNotify(data.error || 'কোটা আপডেট ব্যর্থ হয়েছে।', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, ইমেইল, ফোন বা আইডি দিয়ে ব্যবহারকারী খুঁজুন..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((s) => !s)}
          className="min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showAddForm ? 'ফর্ম বন্ধ করুন' : 'নতুন ব্যবহারকারী যোগ করুন'}</span>
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateUser}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 p-5 space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-700" />
            <span>নতুন নিবন্ধিত ব্যবহারকারী যোগ করুন</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="পূর্ণ নাম *"
              className="min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="ইমেইল ঠিকানা *"
              className="min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="মোবাইল নম্বর (ঐচ্ছিক)"
              className="min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="অবস্থান"
              className="min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
            <select
              value={newPlanId}
              onChange={(e) => setNewPlanId(e.target.value as SubscriptionPlanId)}
              className="min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              {dashboard.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameBn} (৳{p.priceBdt})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="min-h-[42px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold"
            >
              ব্যবহারকারী সংরক্ষণ করুন
            </button>
          </div>
        </form>
      )}

      {/* User List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
            কোনো ব্যবহারকারী খুঁজে পাওয়া যায়নি।
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isEditing = editingUserId === u.id;
            return (
              <div
                key={u.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{u.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          u.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {u.status === 'active' ? 'সক্রিয়' : 'স্থগিত'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                        {u.subscription.planNameBn}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-mono break-all">
                      {u.email} · {u.phone || 'নম্বর নেই'} · ID: {u.id}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      আজকের কোটা: {u.quota.usedToday}/{u.quota.dailyLimit} · মাসিক:{' '}
                      {u.quota.monthlyUsed}/{u.quota.monthlyLimit} · মোট অনুরোধ: {u.totalRequests}
                      {u.subscription.expiresAt &&
                        ` · মেয়াদ: ${new Date(u.subscription.expiresAt).toLocaleDateString('bn-BD')}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(u)}
                      className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                        u.status === 'active'
                          ? 'border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                          : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      {u.status === 'active' ? (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          <span>স্থগিত করুন</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>সক্রিয় করুন</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => startEdit(u)}
                      className="min-h-[38px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{isEditing ? 'সম্পাদনা বন্ধ করুন' : 'প্ল্যান ও কোটা পরিচালনা'}</span>
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                    {/* Plan & Expiry Editor */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-3">
                      <p className="font-bold text-slate-900 dark:text-white">
                        সাবস্ক্রিপশন প্ল্যান ও মেয়াদ পরিবর্তন
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1">প্ল্যান নির্বাচন</label>
                          <select
                            value={editPlanId}
                            onChange={(e) => setEditPlanId(e.target.value as SubscriptionPlanId)}
                            className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          >
                            {dashboard.plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nameBn} (৳{p.priceBdt})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">মেয়াদ শেষ তারিখ (ঐচ্ছিক)</label>
                          <input
                            type="date"
                            value={editExpiryDate}
                            onChange={(e) => setEditExpiryDate(e.target.value)}
                            className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveUserPlan(u.id)}
                        className="min-h-[40px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold inline-flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>প্ল্যান সংরক্ষণ করুন</span>
                      </button>
                    </div>

                    {/* User Quota Editor */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-3">
                      <p className="font-bold text-slate-900 dark:text-white">
                        ব্যবহারকারীর ব্যক্তিগত কোটা নিয়ন্ত্রণ
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1">দৈনিক সীমা</label>
                          <input
                            type="number"
                            min={1}
                            max={10000}
                            value={editDailyLimit}
                            onChange={(e) => setEditDailyLimit(Number(e.target.value))}
                            className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">মাসিক সীমা</label>
                          <input
                            type="number"
                            min={1}
                            max={200000}
                            value={editMonthlyLimit}
                            onChange={(e) => setEditMonthlyLimit(Number(e.target.value))}
                            className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveUserQuota(u.id, false)}
                          className="min-h-[40px] px-4 rounded-xl bg-slate-900 dark:bg-blue-700 text-white font-semibold inline-flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>কোটা সংরক্ষণ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveUserQuota(u.id, true)}
                          className="min-h-[40px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>আজকের ব্যবহার শূন্য করুন</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ============================================================================
// TAB 3: PLAN MANAGEMENT & PAYMENT VERIFICATION
// ============================================================================
const PlansAndPaymentsTab: React.FC<{
  dashboard: AdminDashboardData;
  onApplyMutation: (d: { dashboard?: AdminDashboardData; state?: AppStateResponse }) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onOpenPaymentSetup: () => void;
}> = ({ dashboard, onApplyMutation, onNotify, onOpenPaymentSetup }) => {
  const [planDrafts, setPlanDrafts] = useState<Record<string, SubscriptionPlanConfig>>({});
  const paymentCfg = dashboard.appSettings.paymentConfig;

  useEffect(() => {
    const map: Record<string, SubscriptionPlanConfig> = {};
    for (const p of dashboard.plans) {
      map[p.id] = p;
    }
    setPlanDrafts(map);
  }, [dashboard.plans]);

  const updateDraft = (id: SubscriptionPlanId, patch: Partial<SubscriptionPlanConfig>) => {
    setPlanDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const handleSavePlan = async (id: SubscriptionPlanId) => {
    const draft = planDrafts[id];
    if (!draft) return;
    const res = await adminFetch(`/api/admin/plans/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify(`"${draft.nameBn}" প্ল্যান সফলভাবে হালনাগাদ হয়েছে।`);
    } else {
      onNotify(data.error || 'প্ল্যান সংরক্ষণ করা যায়নি।', 'error');
    }
  };

  const handleVerifyPayment = async (id: string) => {
    const res = await adminFetch(`/api/admin/payments/${id}/verify`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify('পেমেন্ট যাচাই সম্পন্ন এবং প্রো সাবস্ক্রিপশন সক্রিয় হয়েছে।');
    }
  };

  const handleRejectPayment = async (id: string) => {
    const res = await adminFetch(`/api/admin/payments/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ reason: 'ট্রানজেকশন আইডি পাওয়া যায়নি' }),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify('পেমেন্ট অনুরোধ বাতিল করা হয়েছে।');
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Payment Numbers Overview Banner */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                সক্রিয় Send Money পেমেন্ট মাধ্যম ও নম্বর
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pro প্ল্যান কেনার সময় কেবল সক্রিয় মাধ্যমগুলো ব্যবহারকারীরা দেখতে পাবেন।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPaymentSetup}
            className="min-h-[38px] px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
          >
            পেমেন্ট নম্বর পরিবর্তন →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">bKash (বিকাশ)</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                  paymentCfg?.bkashEnabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {paymentCfg?.bkashEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="font-mono font-bold text-sm text-pink-700 dark:text-pink-400 mt-1">
              {paymentCfg?.bkashEnabled ? paymentCfg.bkashNumber || '—' : 'বন্ধ রাখা হয়েছে'}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Nagad (নগদ)</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                  paymentCfg?.nagadEnabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {paymentCfg?.nagadEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="font-mono font-bold text-sm text-orange-700 dark:text-orange-400 mt-1">
              {paymentCfg?.nagadEnabled ? paymentCfg.nagadNumber || '—' : 'বন্ধ রাখা হয়েছে'}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Rocket (রকেট)</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                  paymentCfg?.rocketEnabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {paymentCfg?.rocketEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {paymentCfg?.rocketEnabled ? paymentCfg.rocketNumber : 'অপসারণ / বন্ধ'}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Card Payment</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                  paymentCfg?.cardEnabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {paymentCfg?.cardEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {paymentCfg?.cardEnabled ? 'সক্রিয়' : 'অপসারণ / বন্ধ'}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            সাবস্ক্রিপশন প্ল্যান কনফিগারেশন (Free, Pro, ৳২০০, ৳৫০০)
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dashboard.plans.map((p) => {
            const draft = planDrafts[p.id] ?? p;
            return (
              <div
                key={p.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-[11px] text-blue-700 dark:text-blue-400 font-semibold">
                      ID: {p.id}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {draft.nameBn}
                    </h3>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(e) => updateDraft(p.id, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-blue-700"
                    />
                    <span>সক্রিয়</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">প্ল্যানের নাম (বাংলা)</label>
                    <input
                      type="text"
                      value={draft.nameBn}
                      onChange={(e) => updateDraft(p.id, { nameBn: e.target.value })}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">মূল্য (টাকা / BDT)</label>
                    <input
                      type="number"
                      min={0}
                      value={draft.priceBdt}
                      onChange={(e) => updateDraft(p.id, { priceBdt: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">দৈনিক সীমা</label>
                    <input
                      type="number"
                      min={1}
                      value={draft.dailyLimit}
                      onChange={(e) => updateDraft(p.id, { dailyLimit: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">মাসিক সীমা</label>
                    <input
                      type="number"
                      min={1}
                      value={draft.monthlyLimit}
                      onChange={(e) => updateDraft(p.id, { monthlyLimit: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">মেয়াদ (দিন, ০ = সীমাহীন)</label>
                    <input
                      type="number"
                      min={0}
                      value={draft.durationDays}
                      onChange={(e) => updateDraft(p.id, { durationDays: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">সংক্ষিপ্ত বিবরণ</label>
                    <input
                      type="text"
                      value={draft.descriptionBn}
                      onChange={(e) => updateDraft(p.id, { descriptionBn: e.target.value })}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSavePlan(p.id)}
                  className="min-h-[40px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>প্ল্যান আপডেট করুন</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Full Payment Verification History */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            সকল পেমেন্ট অনুরোধ ও যাচাই ইতিহাস ({dashboard.payments.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {dashboard.payments.map((p) => (
            <PaymentRow
              key={p.id}
              payment={p}
              onVerify={handleVerifyPayment}
              onReject={handleRejectPayment}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// TAB 4: API MANAGEMENT, MODEL SETTINGS & 429 LOGS
// ============================================================================
const ApiAndModelsTab: React.FC<{
  dashboard: AdminDashboardData;
  onApplyMutation: (d: { dashboard?: AdminDashboardData; state?: AppStateResponse }) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ dashboard, onApplyMutation, onNotify }) => {
  const { integrations, overview, apiLogs } = dashboard;
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(integrations.geminiModel);
  const [logFilter, setLogFilter] = useState<'all' | '429' | 'error' | 'success'>('all');

  useEffect(() => {
    setSelectedModel(integrations.geminiModel);
  }, [integrations.geminiModel]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return apiLogs;
    if (logFilter === '429') {
      return apiLogs.filter((l) => l.status === 'rate_limit_429' || l.status === 'quota_429');
    }
    return apiLogs.filter((l) => l.status === logFilter);
  }, [apiLogs, logFilter]);

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ modelId: selectedModel }),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify(`সক্রিয় Gemini মডেল "${selectedModel}"-এ পরিবর্তন করা হয়েছে।`);
    } else {
      onNotify(data.error || 'মডেল আপডেট করা যায়নি।', 'error');
    }
  };

  const handleClearCache = async () => {
    const res = await adminFetch('/api/admin/cache/clear', {
      method: 'POST',
      credentials: 'same-origin',
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify(`সার্ভারের ${data.cleared ?? 0}টি ক্যাশড রেসপন্স পরিষ্কার করা হয়েছে।`);
    }
  };

  const handleClearApiLogs = async () => {
    const res = await adminFetch('/api/admin/api-logs/clear', {
      method: 'POST',
      credentials: 'same-origin',
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify('API এবং ৪২৯ ত্রুটি লগ পরিষ্কার করা হয়েছে।');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="মোট API কল" value={apiLogs.length} sub="সাম্প্রতিক রেকর্ড (সর্বোচ্চ ২০০)" />
        <StatCard
          label="মোট ৪২৯ লগ"
          value={overview.error429Count}
          sub={`রেট: ${overview.rateLimit429Count} · কোটা: ${overview.quotaExhausted429Count}`}
          accent={overview.error429Count > 0 ? 'rose' : 'emerald'}
        />
        <StatCard label="ক্যাশ হিট" value={overview.cacheHitCount} sub="অপ্রয়োজনীয় API কল সাশ্রয়" />
        <StatCard
          label="সার্ভার Gemini কী"
          value={integrations.geminiConnected ? 'সংযুক্ত' : 'অসংযুক্ত'}
          sub="শুধুমাত্র সার্ভার এনভায়রনমেন্টে সংরক্ষিত"
          accent={integrations.geminiConnected ? 'emerald' : 'amber'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSaveModel}
          className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              গ্লোবাল Gemini মডেল ও সার্ভার ক্যাশ
            </h2>
          </div>

          <div className="space-y-2">
            {integrations.availableModels.map((m) => (
              <label
                key={m.id}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedModel === m.id
                    ? 'border-blue-700 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="adminGeminiModel"
                  value={m.id}
                  checked={selectedModel === m.id}
                  onChange={() => setSelectedModel(m.id)}
                  className="mt-1 accent-blue-700"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{m.labelBn}</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {m.id}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">{m.descriptionBn}</p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">{m.tierNoteBn}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="min-h-[42px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>মডেল সংরক্ষণ করুন</span>
            </button>

            <button
              type="button"
              onClick={handleClearCache}
              className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>AI রেসপন্স ক্যাশ পরিষ্কার</span>
            </button>
          </div>
        </form>

        {/* Server Integration Status */}
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            সার্ভার API ও ইন্টিগ্রেশন অবস্থা
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            সকল API কী শুধুমাত্র সার্ভার প্রসেসে (GEMINI_API_KEY) সুরক্ষিত থাকে — ব্রাউজারে কখনো পাঠানো হয় না।
          </p>
          <IntegrationRow
            label="Gemini AI সার্ভার কী (শিক্ষা, চ্যাট, স্বাস্থ্য, সোশ্যাল)"
            active={integrations.geminiConnected}
            detail={`সক্রিয় মডেল: ${integrations.geminiModel}`}
          />
          <IntegrationRow
            label="AI ইমেজ জেনারেশন (ChatGPT স্টাইল)"
            active={Boolean(integrations.imageGenReady)}
            detail={integrations.imageGenReady ? 'সক্রিয় (Text & Image-to-Image)' : 'API কী অনুপস্থিত'}
          />
          <IntegrationRow
            label="Flow AI ভিডিও জেনারেশন"
            active={Boolean(integrations.videoGenReady)}
            detail={integrations.videoApiLabel}
          />
          <IntegrationRow
            label="Google Search গ্রাউন্ডিং (বিদেশে চাকরি)"
            active={integrations.searchGroundingReady}
            detail="সক্রিয়"
          />
          <IntegrationRow
            label="ফটো এডিটর ইঞ্জিন"
            active={true}
            detail={integrations.photoCloudApiLabel}
          />
        </div>
      </div>

      {/* Real API & 429 Error Logs */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              লাইভ API ব্যবহার ও ৪২৯ ত্রুটি লগ ({filteredLogs.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              সকল এআই অনুরোধ, রেট-লিমিট (৪২৯), কোটা ত্রুটি এবং লেটেন্সি এখানে রেকর্ড হয়।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
              {(
                [
                  { id: 'all', label: 'সকল' },
                  { id: '429', label: '৪২৯ ত্রুটি' },
                  { id: 'error', label: 'অন্যান্য ত্রুটি' },
                  { id: 'success', label: 'সফল' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLogFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    logFilter === f.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {apiLogs.length > 0 && (
              <button
                type="button"
                onClick={handleClearApiLogs}
                className="min-h-[36px] px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>লগ মুছুন</span>
              </button>
            )}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            নির্বাচিত ফিল্টারে কোনো API লগ পাওয়া যায়নি।
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {log.endpoint}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                      {log.model}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] uppercase">
                      {log.language}
                    </span>
                    {log.cached && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
                        ক্যাশ হিট
                      </span>
                    )}
                  </div>
                  {log.errorMessage && (
                    <p className="text-rose-700 dark:text-rose-300">{log.errorMessage}</p>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {new Date(log.createdAt).toLocaleString('bn-BD')} · সময়: {log.latencyMs}ms
                  </p>
                </div>
                <ApiStatusBadge status={log.status} httpStatus={log.httpStatus} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ============================================================================
// TAB 5: APP SETTINGS, ANNOUNCEMENTS, MAINTENANCE MODE & AD MANAGEMENT
// ============================================================================
function normalizeSettingsDraft(raw: AppSettingsConfig): AppSettingsConfig {
  return {
    ...raw,
    defaultLanguage: raw.defaultLanguage === 'bn' ? 'bn' : 'en',
    paymentConfig: {
      bkashEnabled: raw.paymentConfig?.bkashEnabled ?? true,
      bkashNumber: raw.paymentConfig?.bkashNumber ?? '01944527151',
      nagadEnabled: raw.paymentConfig?.nagadEnabled ?? true,
      nagadNumber: raw.paymentConfig?.nagadNumber ?? '01354848807',
      rocketEnabled: raw.paymentConfig?.rocketEnabled ?? false,
      rocketNumber: raw.paymentConfig?.rocketNumber ?? '',
      cardEnabled: raw.paymentConfig?.cardEnabled ?? false,
      sendMoneyNoteEn:
        raw.paymentConfig?.sendMoneyNoteEn ??
        'Send Money the exact amount via bKash or Nagad, then submit your Transaction ID (TrxID).',
      sendMoneyNoteBn:
        raw.paymentConfig?.sendMoneyNoteBn ??
        'নিচের বিকাশ বা নগদ নম্বরে নির্ধারিত টাকা Send Money করে Transaction ID (TrxID) জমা দিন।',
    },
    aiFeatures: {
      educationEnabled: raw.aiFeatures?.educationEnabled ?? true,
      generalChatEnabled: raw.aiFeatures?.generalChatEnabled ?? true,
      imageGenerationEnabled: raw.aiFeatures?.imageGenerationEnabled ?? true,
      videoGenerationEnabled: raw.aiFeatures?.videoGenerationEnabled ?? true,
    },
  };
}

const SettingsAndAdsTab: React.FC<{
  dashboard: AdminDashboardData;
  onApplyMutation: (d: { dashboard?: AdminDashboardData; state?: AppStateResponse }) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onPreviewInterstitial: () => void;
}> = ({ dashboard, onApplyMutation, onNotify, onPreviewInterstitial }) => {
  const [settingsDraft, setSettingsDraft] = useState<AppSettingsConfig>(() =>
    normalizeSettingsDraft(dashboard.appSettings)
  );
  const [dailyLimit, setDailyLimit] = useState(dashboard.quota.dailyLimit);
  const [monthlyLimit, setMonthlyLimit] = useState(dashboard.quota.monthlyLimit);

  const [admobDraft, setAdmobDraft] = useState<AdMobConfig>(() => ({
    ...REAL_ADSENSE_DEFAULT_CONFIG,
    ...(dashboard.ads.admobConfig ?? {}),
  }));
  const [bannerEnabled, setBannerEnabled] = useState(dashboard.ads.banner.enabled);
  const [bannerTitle, setBannerTitle] = useState(dashboard.ads.banner.title);
  const [bannerSubtitle, setBannerSubtitle] = useState(dashboard.ads.banner.subtitle);
  const [interstitialEnabled, setInterstitialEnabled] = useState(dashboard.ads.interstitial.enabled);
  const [maxInterstitial, setMaxInterstitial] = useState(
    Math.min(2, dashboard.ads.interstitial.maxPerSession)
  );

  useEffect(() => {
    setSettingsDraft(normalizeSettingsDraft(dashboard.appSettings));
    setDailyLimit(dashboard.quota.dailyLimit);
    setMonthlyLimit(dashboard.quota.monthlyLimit);
    setAdmobDraft({
      ...REAL_ADSENSE_DEFAULT_CONFIG,
      ...(dashboard.ads.admobConfig ?? {}),
    });
    setBannerEnabled(dashboard.ads.banner.enabled);
    setBannerTitle(dashboard.ads.banner.title);
    setBannerSubtitle(dashboard.ads.banner.subtitle);
    setInterstitialEnabled(dashboard.ads.interstitial.enabled);
    setMaxInterstitial(Math.min(2, dashboard.ads.interstitial.maxPerSession));
  }, [dashboard]);

  const handleSaveAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(settingsDraft),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify('পেমেন্ট, ভাষা, AI ফিচার ও অ্যাপ সেটিংস সফলভাবে সংরক্ষিত হয়েছে।');
    } else {
      onNotify(data.error || 'অ্যাপ সেটিংস সংরক্ষণ করা যায়নি।', 'error');
    }
  };

  const handleSaveDefaultQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ dailyLimit, monthlyLimit }),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify('সিস্টেমের ডিফল্ট কোটা সীমা আপডেট করা হয়েছে।');
    }
  };

  const handleSaveAds = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextAdmobConfig: AdMobConfig = {
      ...admobDraft,
      testMode: admobDraft.providerMode === 'test_ad',
    };
    const res = await adminFetch('/api/admin/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        networkMode: admobDraft.providerMode === 'demo_house' ? 'demo_house' : 'admob_ready',
        admobConfig: nextAdmobConfig,
        banner: {
          ...dashboard.ads.banner,
          enabled: bannerEnabled,
          title: bannerTitle,
          subtitle: bannerSubtitle,
        },
        interstitial: {
          ...dashboard.ads.interstitial,
          enabled: interstitialEnabled,
          maxPerSession: Math.min(2, Math.max(0, maxInterstitial)),
        },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onApplyMutation(data);
      onNotify('AdMob / AdSense Unit ID ও বিজ্ঞাপন কনফিগারেশন সংরক্ষিত হয়েছে।');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Global App Settings: Payment, Language, AI Features, Announcements & Maintenance */}
      <form
        onSubmit={handleSaveAppSettings}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5 text-xs"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            পেমেন্ট, ভাষা, AI ফিচার ও অ্যাপ সেটিংস
          </h2>
        </div>

        {/* 1. LANGUAGE SETUP */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2">
          <label className="block font-bold text-slate-900 dark:text-white">
            ১. ভাষা সেটআপ (Default Launch Language)
          </label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            অ্যাপ চালু হলে ডিফল্ট ভাষা এখানে নির্ধারিত হবে। ব্যবহারকারী যেকোনো সময় হেডারের EN / BN বাটন দিয়ে ভাষা বদলাতে পারবেন।
          </p>
          <select
            value={settingsDraft.defaultLanguage}
            onChange={(e) =>
              setSettingsDraft((prev) => ({
                ...prev,
                defaultLanguage: e.target.value === 'bn' ? 'bn' : 'en',
              }))
            }
            className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
          >
            <option value="en">English (en — প্রাথমিক / Default)</option>
            <option value="bn">বাংলা (bn — Bengali)</option>
          </select>
        </div>

        {/* 2. PAYMENT SETUP */}
        <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>২. পেমেন্ট সেটআপ (bKash ও Nagad Send Money)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* bKash */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-pink-700 dark:text-pink-400">bKash (বিকাশ)</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={settingsDraft.paymentConfig.bkashEnabled}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        paymentConfig: { ...prev.paymentConfig, bkashEnabled: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-pink-600"
                  />
                  <span>{settingsDraft.paymentConfig.bkashEnabled ? 'ON' : 'OFF'}</span>
                </label>
              </div>
              <input
                type="text"
                value={settingsDraft.paymentConfig.bkashNumber}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    paymentConfig: { ...prev.paymentConfig, bkashNumber: e.target.value },
                  }))
                }
                placeholder="01944527151"
                className="w-full min-h-[38px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-semibold"
              />
            </div>

            {/* Nagad */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-orange-700 dark:text-orange-400">Nagad (নগদ)</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={settingsDraft.paymentConfig.nagadEnabled}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        paymentConfig: { ...prev.paymentConfig, nagadEnabled: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-orange-600"
                  />
                  <span>{settingsDraft.paymentConfig.nagadEnabled ? 'ON' : 'OFF'}</span>
                </label>
              </div>
              <input
                type="text"
                value={settingsDraft.paymentConfig.nagadNumber}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    paymentConfig: { ...prev.paymentConfig, nagadNumber: e.target.value },
                  }))
                }
                placeholder="01354848807"
                className="w-full min-h-[38px] px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Rocket OFF */}
            <label className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 cursor-pointer">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">Rocket (রকেট)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {settingsDraft.paymentConfig.rocketEnabled ? 'চালু আছে' : 'অপসারণ / বন্ধ (OFF)'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={settingsDraft.paymentConfig.rocketEnabled}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    paymentConfig: { ...prev.paymentConfig, rocketEnabled: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-blue-700"
              />
            </label>

            {/* Card Payment OFF */}
            <label className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 cursor-pointer">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Card Payment</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {settingsDraft.paymentConfig.cardEnabled ? 'চালু আছে' : 'অপসারণ / বন্ধ (OFF)'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settingsDraft.paymentConfig.cardEnabled}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    paymentConfig: { ...prev.paymentConfig, cardEnabled: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-blue-700"
              />
            </label>
          </div>

          {settingsDraft.paymentConfig.rocketEnabled && (
            <div>
              <label className="block font-semibold mb-1">Rocket নম্বর</label>
              <input
                type="text"
                value={settingsDraft.paymentConfig.rocketNumber}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    paymentConfig: { ...prev.paymentConfig, rocketNumber: e.target.value },
                  }))
                }
                placeholder="01XXXXXXXXX"
                className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block font-semibold mb-1">Send Money নির্দেশনা (English)</label>
              <input
                type="text"
                value={settingsDraft.paymentConfig.sendMoneyNoteEn}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    paymentConfig: { ...prev.paymentConfig, sendMoneyNoteEn: e.target.value },
                  }))
                }
                className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Send Money নির্দেশনা (বাংলা)</label>
              <input
                type="text"
                value={settingsDraft.paymentConfig.sendMoneyNoteBn}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    paymentConfig: { ...prev.paymentConfig, sendMoneyNoteBn: e.target.value },
                  }))
                }
                className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>
        </div>

        {/* 3. AI FEATURES SETUP */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2.5">
          <p className="font-bold text-slate-900 dark:text-white">
            ৩. AI ফিচার সেটআপ (৪টি মূল মোড ON / OFF)
          </p>

          <label className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <GraduationCap className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Education Mode (SSC / HSC)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  SSC / HSC সকল বিষয়, গ্রামার, গণিত, বিজ্ঞান ও ধাপে ধাপে সমাধান
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settingsDraft.aiFeatures.educationEnabled}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  aiFeatures: { ...prev.aiFeatures, educationEnabled: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-blue-700 shrink-0"
            />
          </label>

          <label className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">General Chat Mode (ChatGPT স্টাইল)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  গল্প, কবিতা, CV, চাকরির প্রশ্ন ও যেকোনো সাধারণ প্রশ্নের উত্তর
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settingsDraft.aiFeatures.generalChatEnabled}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  aiFeatures: { ...prev.aiFeatures, generalChatEnabled: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-blue-700 shrink-0"
            />
          </label>

          <label className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <ImageIcon className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Image Generation (AI ইমেজ)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  টেক্সট লিখে বা ছবি আপলোড করে সুন্দর AI ছবি তৈরি ও এডিট
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settingsDraft.aiFeatures.imageGenerationEnabled}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  aiFeatures: { ...prev.aiFeatures, imageGenerationEnabled: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-blue-700 shrink-0"
            />
          </label>

          <label className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <Video className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Video Generation (Flow AI স্টাইল)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Text-to-Video ও Image-to-Video ছোট AI ভিডিও তৈরি
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settingsDraft.aiFeatures.videoGenerationEnabled}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  aiFeatures: { ...prev.aiFeatures, videoGenerationEnabled: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-blue-700 shrink-0"
            />
          </label>
        </div>

        {/* Announcements */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>অ্যাপ ঘোষণা (Announcement Banner)</span>
            </span>
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={settingsDraft.announcement.enabled}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    announcement: { ...prev.announcement, enabled: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-blue-700"
              />
              <span>চালু</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={settingsDraft.announcement.title}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  announcement: { ...prev.announcement, title: e.target.value },
                }))
              }
              placeholder="ঘোষণার শিরোনাম"
              className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
            <select
              value={settingsDraft.announcement.type}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  announcement: {
                    ...prev.announcement,
                    type: e.target.value as AppSettingsConfig['announcement']['type'],
                  },
                }))
              }
              className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              <option value="info">তথ্য (নীল)</option>
              <option value="success">সুখবর (সবুজ)</option>
              <option value="warning">সতর্কতা (হলুদ)</option>
            </select>
          </div>
          <textarea
            rows={2}
            value={settingsDraft.announcement.message}
            onChange={(e) =>
              setSettingsDraft((prev) => ({
                ...prev,
                announcement: { ...prev.announcement, message: e.target.value },
              }))
            }
            placeholder="ঘোষণার বিস্তারিত বার্তা লিখুন..."
            className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
        </div>

        {/* Maintenance Mode */}
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Wrench className="w-4 h-4" />
              <span>রক্ষণাবেক্ষণ মোড (Maintenance Mode)</span>
            </span>
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={settingsDraft.maintenanceMode.enabled}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    maintenanceMode: { ...prev.maintenanceMode, enabled: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-amber-600"
              />
              <span>চালু</span>
            </label>
          </div>
          <textarea
            rows={2}
            value={settingsDraft.maintenanceMode.messageBn}
            onChange={(e) =>
              setSettingsDraft((prev) => ({
                ...prev,
                maintenanceMode: { ...prev.maintenanceMode, messageBn: e.target.value },
              }))
            }
            className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800"
          />
        </div>

        {/* Global AI Controls */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2.5">
          <p className="font-bold text-slate-900 dark:text-white">গ্লোবাল AI নীতিমালা</p>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>সকল AI সেবা চালু রাখুন</span>
            <input
              type="checkbox"
              checked={settingsDraft.aiSettings.enabled}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  aiSettings: { ...prev.aiSettings, enabled: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-blue-700"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>সার্ভার রেসপন্স ক্যাশ সক্রিয় (৪২৯ কমাতে সহায়ক)</span>
            <input
              type="checkbox"
              checked={settingsDraft.aiSettings.cacheEnabled}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  aiSettings: { ...prev.aiSettings, cacheEnabled: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-blue-700"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>স্ট্রিমিং উত্তর (প্রগতিশীল আউটপুট)</span>
            <input
              type="checkbox"
              checked={settingsDraft.aiSettings.streamEnabled}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  aiSettings: { ...prev.aiSettings, streamEnabled: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-blue-700"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>সাধারণ ব্যবহারকারীদের মডেল পরিবর্তনের অনুমতি দিন</span>
            <input
              type="checkbox"
              checked={settingsDraft.aiSettings.allowUserModelSwitch}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  aiSettings: { ...prev.aiSettings, allowUserModelSwitch: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-blue-700"
            />
          </label>
        </div>

        <button
          type="submit"
          className="min-h-[44px] px-5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>সকল সেটিংস সংরক্ষণ করুন</span>
        </button>
      </form>

      {/* Right Column: Ads & Default Quota */}
      <div className="space-y-6">
        <form
          onSubmit={handleSaveDefaultQuota}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              প্রাথমিক ব্যবহারকারীর কোটা নিয়ন্ত্রণ
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">দৈনিক সীমা</label>
              <input
                type="number"
                min={1}
                max={5000}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">মাসিক সীমা</label>
              <input
                type="number"
                min={10}
                max={100000}
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-blue-700 text-white font-semibold inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>কোটা আপডেট করুন</span>
          </button>
        </form>

        <form
          onSubmit={handleSaveAds}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-blue-700 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">বিজ্ঞাপন ব্যবস্থাপনা</h2>
            </div>
            <button
              type="button"
              onClick={onPreviewInterstitial}
              className="min-h-[38px] px-3 rounded-lg bg-slate-100 dark:bg-slate-800 font-medium inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>অ্যাড প্রিভিউ</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">ব্যানার ভিউ</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {dashboard.ads.stats.bannerImpressions}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">ইন্টারস্টিশাল</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {dashboard.ads.stats.interstitialImpressions}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">মোট ক্লিক</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {dashboard.ads.stats.clicks}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-1 text-[11px] text-blue-900 dark:text-blue-200">
            <p className="font-bold">সক্রিয় ৩ জায়গার অ্যাড ও Pro নীতিমালা:</p>
            <p>১. অ্যাপে ঢোকার সময়: ১টি ফুলস্ক্রিন Ad (৫ সেকেন্ড পর Skip/Close)</p>
            <p>২. সব সময় ব্যানার: Home, Chat ও Tools পেজে ১টি স্থায়ী ছোট Banner Ad</p>
            <p>৩. শিক্ষা বাধ্যতামূলক Ad: প্রশ্ন করার পর উত্তর দেখানোর আগে ৫ সেকেন্ডের Forced Ad</p>
            <p className="font-semibold text-emerald-700 dark:text-emerald-300 pt-0.5">
              ✓ Pro প্ল্যানে সব Ad স্বয়ংক্রিয়ভাবে বন্ধ থাকে (অফলাইন সেভড ডেটা ফ্রি ও প্রো সবার জন্য চালু)
            </p>
          </div>

          <div className="space-y-3">
            {/* AdMob / AdSense Unit ID Setup */}
            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${
                      admobDraft.providerMode === 'live_admob'
                        ? 'bg-emerald-600'
                        : admobDraft.providerMode === 'test_ad'
                          ? 'bg-amber-600'
                          : 'bg-slate-600'
                    }`}
                  >
                    {admobDraft.providerMode === 'live_admob'
                      ? 'REAL ADSENSE ACTIVE'
                      : admobDraft.providerMode === 'test_ad'
                        ? 'TEST AD ACTIVE'
                        : 'DEMO HOUSE'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Google AdSense / AdMob সেটআপ
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setAdmobDraft((prev) => ({
                        ...prev,
                        providerMode: 'live_admob',
                        testMode: false,
                        adsenseClientId: REAL_ADSENSE_DEFAULT_CONFIG.adsenseClientId,
                      }))
                    }
                    className="min-h-[32px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                  >
                    Real AdSense বসান
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAdmobDraft({
                        ...GOOGLE_TEST_ADMOB_CONFIG,
                        adsenseClientId: admobDraft.adsenseClientId,
                        adsenseBannerSlot: admobDraft.adsenseBannerSlot,
                        adsenseInterstitialSlot: admobDraft.adsenseInterstitialSlot,
                      })
                    }
                    className="min-h-[32px] px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50"
                  >
                    Google Test ID বসান
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">অ্যাড প্রোভাইডার মোড</label>
                <select
                  value={admobDraft.providerMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as AdMobConfig['providerMode'];
                    setAdmobDraft((prev) => ({
                      ...prev,
                      providerMode: nextMode,
                      testMode: nextMode === 'test_ad',
                    }));
                  }}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  <option value="live_admob">
                    Real Google AdSense / AdMob চালু (ca-pub-9416678178678630)
                  </option>
                  <option value="test_ad">Google Test Ad (পরীক্ষার জন্য Test ID)</option>
                  <option value="demo_house">অভ্যন্তরীণ সাথী ডিমো অ্যাডস</option>
                </select>
              </div>

              <div className="pt-1 space-y-2">
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  Chrome / Vercel ওয়েবসাইট AdSense কনফিগারেশন (Auto Ads + Banner Slot):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1">
                      AdSense Publisher ID
                    </label>
                    <input
                      type="text"
                      value={admobDraft.adsenseClientId}
                      onChange={(e) =>
                        setAdmobDraft((p) => ({ ...p, adsenseClientId: e.target.value }))
                      }
                      placeholder="ca-pub-9416678178678630"
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1">
                      Banner Ad Slot ID (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={admobDraft.adsenseBannerSlot}
                      onChange={(e) =>
                        setAdmobDraft((p) => ({ ...p, adsenseBannerSlot: e.target.value }))
                      }
                      placeholder="Banner Slot ID"
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1">
                      Display/Interstitial Slot ID (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={admobDraft.adsenseInterstitialSlot}
                      onChange={(e) =>
                        setAdmobDraft((p) => ({ ...p, adsenseInterstitialSlot: e.target.value }))
                      }
                      placeholder="Display Slot ID"
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/50 space-y-2">
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  Android AdMob Unit ID (ঐচ্ছিক — Test ID অথবা আসল Android App Unit ID):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold mb-1">AdMob App ID</label>
                    <input
                      type="text"
                      value={admobDraft.appId}
                      onChange={(e) => setAdmobDraft((p) => ({ ...p, appId: e.target.value }))}
                      placeholder="ca-app-pub-3940256099942544~3347511713"
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Banner Ad Unit ID</label>
                    <input
                      type="text"
                      value={admobDraft.bannerUnitId}
                      onChange={(e) => setAdmobDraft((p) => ({ ...p, bannerUnitId: e.target.value }))}
                      placeholder="ca-app-pub-3940256099942544/6300978111"
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Entry Interstitial Unit ID</label>
                    <input
                      type="text"
                      value={admobDraft.entryInterstitialUnitId}
                      onChange={(e) =>
                        setAdmobDraft((p) => ({ ...p, entryInterstitialUnitId: e.target.value }))
                      }
                      placeholder="ca-app-pub-3940256099942544/1033173712"
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Study Forced Ad Unit ID</label>
                    <input
                      type="text"
                      value={admobDraft.studyInterstitialUnitId}
                      onChange={(e) =>
                        setAdmobDraft((p) => ({ ...p, studyInterstitialUnitId: e.target.value }))
                      }
                      placeholder="ca-app-pub-3940256099942544/1033173712"
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  বর্তমানে Real Google AdSense (`ca-pub-9416678178678630`) সক্রিয় আছে ও `index.html` + `ads.txt`-এ যুক্ত রয়েছে। চাইলে উপরের `Google Test ID বসান` বাটনে ক্লিক করে যেকোনো সময় Test মোডে নিতে পারবেন।
                </p>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">বটম ব্যানার শিরোনাম</label>
              <input
                type="text"
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">বটম ব্যানার বিবরণ</label>
              <input
                type="text"
                value={bannerSubtitle}
                onChange={(e) => setBannerSubtitle(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerEnabled}
                  onChange={(e) => setBannerEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                <span>স্থায়ী ব্যানার অ্যাড চালু</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={interstitialEnabled}
                  onChange={(e) => setInterstitialEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                <span>এন্ট্রি ও শিক্ষা Forced ৫সেকেণ্ড Ad</span>
              </label>
            </div>
            <div>
              <label className="block font-semibold mb-1">সেশন প্রতি সর্বোচ্চ ফুল-স্ক্রিন অ্যাড</label>
              <input
                type="number"
                min={0}
                max={2}
                value={maxInterstitial}
                onChange={(e) =>
                  setMaxInterstitial(Math.min(2, Math.max(0, Number(e.target.value))))
                }
                className="w-24 min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[42px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>বিজ্ঞাপন সেটিংস সংরক্ষণ</span>
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// TAB 6: SECURITY STATUS & ADMIN ACTIVITY LOGS
// ============================================================================
const SecurityAuditTab: React.FC<{ dashboard: AdminDashboardData }> = ({ dashboard }) => {
  const { adminConfig, adminLogs, integrations } = dashboard;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            সার্ভার-সাইড নিরাপত্তা ও এনভায়রনমেন্ট অবস্থা
          </h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          সকল অ্যাডমিন রুট (HTTP 401/403 RBAC), HttpOnly HMAC সেশন কুকি, ব্রুট-ফোর্স রেট লিমিট এবং সার্ভার-অনলি গোপন কী যাচাইকৃত।
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between">
            <div>
              <p className="font-bold">সার্ভার অ্যাডমিন প্রমাণীকরণ</p>
              <p className="text-slate-500 dark:text-slate-400 font-mono">
                {adminConfig.adminEmail || 'অ্যাডমিন অ্যাকাউন্ট'}
              </p>
            </div>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              সুরক্ষিত (scrypt + RBAC)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between">
            <div>
              <p className="font-bold">Gemini API কী (সার্ভার-অনলি)</p>
              <p className="text-slate-500 dark:text-slate-400">ক্লায়েন্ট বান্ডেলে কখনো প্রকাশিত হয় না</p>
            </div>
            <span
              className={`font-semibold ${
                integrations.geminiConnected
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-600'
              }`}
            >
              {integrations.geminiConnected ? 'সক্রিয়' : 'অনুপস্থিত'}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            অ্যাডমিন অ্যাক্টিভিটি অডিট লগ ({adminLogs.length})
          </h2>
        </div>

        {adminLogs.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            এখনো কোনো অ্যাডমিন অ্যাক্টিভিটি লগ নেই।
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
            {adminLogs.map((log) => (
              <div
                key={log.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-900 dark:text-white">{log.summaryBn}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    অ্যাকশন: {log.action} · অ্যাডমিন: {log.actorEmail} · IP: {log.ip}
                  </p>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                  {new Date(log.createdAt).toLocaleString('bn-BD')}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ============================================================================
// SHARED UI HELPERS
// ============================================================================
const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub: string;
  accent?: 'default' | 'blue' | 'emerald' | 'amber' | 'rose';
}> = ({ label, value, sub, accent = 'default' }) => {
  const valueClass =
    accent === 'blue'
      ? 'text-blue-700 dark:text-blue-400'
      : accent === 'emerald'
        ? 'text-emerald-700 dark:text-emerald-400'
        : accent === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : accent === 'rose'
            ? 'text-rose-700 dark:text-rose-400'
            : 'text-slate-900 dark:text-white';

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold font-mono tabular-nums mt-1 ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
    </div>
  );
};

const PaymentRow: React.FC<{
  payment: PaymentRequest;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
}> = ({ payment: p, onVerify, onReject }) => (
  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div className="space-y-0.5">
      <p className="text-sm font-bold text-slate-900 dark:text-white">
        {p.userName} · {p.planLabel}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
        {p.method} · TrxID: {p.transactionId} · নম্বর: {p.senderNumber} · ৳{p.amountBdt}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        অবস্থা:{' '}
        {p.status === 'pending'
          ? 'যাচাইয়ের অপেক্ষায়'
          : p.status === 'verified'
            ? 'যাচাইকৃত ও সক্রিয়'
            : 'বাতিল'}
      </p>
    </div>

    {p.status === 'pending' ? (
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onVerify(p.id)}
          className="min-h-[40px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>যাচাই ও সক্রিয় করুন</span>
        </button>
        <button
          type="button"
          onClick={() => onReject(p.id)}
          className="min-h-[40px] px-3.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <X className="w-4 h-4" />
          <span>বাতিল</span>
        </button>
      </div>
    ) : (
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
        পর্যালোচনা সম্পন্ন
      </span>
    )}
  </div>
);

const ApiStatusBadge: React.FC<{ status: string; httpStatus: number }> = ({
  status,
  httpStatus,
}) => {
  const isSuccess = status === 'success';
  const is429 = status === 'rate_limit_429' || status === 'quota_429';
  return (
    <span
      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold font-mono shrink-0 ${
        isSuccess
          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
          : is429
            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
      }`}
    >
      {httpStatus} · {isSuccess ? 'OK' : is429 ? '429 LIMIT' : 'ERROR'}
    </span>
  );
};

const IntegrationRow: React.FC<{ label: string; active: boolean; detail: string }> = ({
  label,
  active,
  detail,
}) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800 text-xs">
    <div>
      <p className="font-semibold text-slate-800 dark:text-slate-200">{label}</p>
      <p className="text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
    <span
      className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
        active ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
      }`}
    >
      {active ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      <span>{active ? 'সক্রিয়' : 'ডিমো / প্রস্তুত'}</span>
    </span>
  </div>
);
