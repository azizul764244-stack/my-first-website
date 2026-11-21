import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BottomBannerAd,
  InterstitialAdModal,
  type InterstitialAdMode,
} from './components/AdSystem';
import { NavigationShell } from './components/NavigationShell';
import { UiLanguageProvider, useUiLanguage } from './contexts/UiLanguageContext';
import { AdminPage } from './pages/AdminPage';
import { AssistantPage } from './pages/AssistantPage';
import { EducationPage } from './pages/EducationPage';
import { HealthPage } from './pages/HealthPage';
import { HistoryView, ProfileView } from './pages/HistoryAndProfilePage';
import { AllToolsView, HomeView } from './pages/HomeAndToolsPage';
import { JobsPage } from './pages/JobsPage';
import { PhotoEditorPage } from './pages/PhotoEditorPage';
import { SocialPage } from './pages/SocialPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { VideoStudioPage } from './pages/VideoStudioPage';
import { normalizeLanguageCode } from './constants/languages';
import { adminFetch, setStoredAdminToken } from './utils/adminToken';
import {
  createFallbackOfflineState,
  loadOfflineSnapshot,
  saveOfflineSnapshot,
  useOnlineStatus,
} from './utils/offlineStorage';
import type {
  AdminSessionInfo,
  AppPage,
  AppStateResponse,
  ChatConversation,
  GeminiModelId,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from './types';

function isHiddenAdminLocation(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.replace(/\/+$/, '').toLowerCase();
  const pathname = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return (
    hash === '#/sathi-admin' ||
    hash === '#sathi-admin' ||
    pathname.endsWith('/sathi-admin') ||
    params.get('portal') === 'admin'
  );
}

interface AppInnerProps {
  appState: AppStateResponse | null;
  setAppState: React.Dispatch<React.SetStateAction<AppStateResponse | null>>;
  adminSession: AdminSessionInfo;
  setAdminSession: React.Dispatch<React.SetStateAction<AdminSessionInfo>>;
  loading: boolean;
  loadError: string | null;
  isOnline: boolean;
  onRetryConnection: () => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => Promise<void>;
  responseLanguage: ResponseLanguageCode;
  onChangeLanguage: (nextLang: ResponseLanguageCode) => Promise<void>;
  activeConversationId: string | null;
  setActiveConversationId: React.Dispatch<React.SetStateAction<string | null>>;
}

function AppInner({
  appState,
  setAppState,
  adminSession,
  setAdminSession,
  loading,
  loadError,
  isOnline,
  onRetryConnection,
  theme,
  onToggleTheme,
  responseLanguage,
  onChangeLanguage,
  activeConversationId,
  setActiveConversationId,
}: AppInnerProps) {
  const { uiLang, setUiLang, t } = useUiLanguage();
  const [currentPage, setCurrentPage] = useState<AppPage>(() =>
    isHiddenAdminLocation() ? 'admin' : 'home'
  );

  const [isTaskBusy, setIsTaskBusy] = useState(false);
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [interstitialMode, setInterstitialMode] = useState<InterstitialAdMode>('entry');
  const [interstitialShownCount, setInterstitialShownCount] = useState(0);

  const [pendingEducationQuestion, setPendingEducationQuestion] = useState<string>('');
  const [pendingVideoPrompt, setPendingVideoPrompt] = useState<string>('');

  const entryAdTriggeredRef = useRef(false);

  useEffect(() => {
    const onLocationChange = () => {
      if (isHiddenAdminLocation()) {
        setCurrentPage('admin');
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        window.location.hash = '#/sathi-admin';
        setCurrentPage('admin');
      }
    };
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleToggleUiLang = (nextUi: 'en' | 'bn') => {
    setUiLang(nextUi);
    if (responseLanguage === 'en' || responseLanguage === 'bn' || responseLanguage === 'auto') {
      void onChangeLanguage(nextUi);
    }
  };

  const handleSwitchModel = async (modelId: GeminiModelId) => {
    try {
      const res = await adminFetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setAppState(data.state);
      }
    } catch {
      // Ignore network hiccup
    }
  };

  const trackAdEvent = useCallback(
    async (event: 'banner_impression' | 'interstitial_impression' | 'click') => {
      try {
        const res = await fetch('/api/ads/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event }),
        });
        if (res.ok) {
          const data = await res.json();
          setAppState((prev) =>
            prev ? { ...prev, ads: { ...prev.ads, stats: data.stats } } : prev
          );
        }
      } catch {
        // Ignore analytics failure
      }
    },
    [setAppState]
  );

  // Place A: Entry Fullscreen Ad when entering the app (5s countdown before Skip/Close)
  // Automatically suppressed for Pro users, Admin portal, Health page, or Offline mode
  useEffect(() => {
    if (loading || !appState) return;
    if (entryAdTriggeredRef.current) return;
    if (
      isOnline &&
      !appState.subscription.isPaid &&
      appState.ads.interstitial.enabled &&
      currentPage !== 'admin' &&
      currentPage !== 'health' &&
      currentPage !== 'subscription'
    ) {
      entryAdTriggeredRef.current = true;
      setInterstitialMode('entry');
      setInterstitialShownCount(1);
      setInterstitialOpen(true);
    }
  }, [loading, appState, isOnline, currentPage]);

  const handleNavigate = (nextPage: AppPage) => {
    if (nextPage === 'admin') {
      if (window.location.hash !== '#/sathi-admin') {
        window.location.hash = '#/sathi-admin';
      }
    } else if (
      window.location.hash.toLowerCase().startsWith('#/sathi-admin') ||
      window.location.hash.toLowerCase().startsWith('#sathi-admin')
    ) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResultSuccess = (item: HistoryItem | undefined, quota: QuotaState) => {
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        quota,
        history: item ? [item, ...prev.history].slice(0, 60) : prev.history,
        analytics: {
          ...prev.analytics,
          totalRequests: prev.analytics.totalRequests + 1,
        },
      };
    });
  };

  const handleQuotaUpdate = (quota: QuotaState) => {
    setAppState((prev) => (prev ? { ...prev, quota } : prev));
  };

  const handleDeleteHistory = async (id: string) => {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setAppState((prev) => (prev ? { ...prev, history: data.history } : prev));
    }
  };

  const handleClearHistory = async () => {
    const res = await fetch('/api/history/clear', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setAppState((prev) => (prev ? { ...prev, history: data.history } : prev));
    }
  };

  const handleConversationsChange = (conversations: ChatConversation[]) => {
    setAppState((prev) => (prev ? { ...prev, conversations } : prev));
  };

  const handleDeleteConversationFromHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { conversations?: ChatConversation[] };
      if (res.ok && data.conversations) {
        handleConversationsChange(data.conversations);
        if (activeConversationId === id) {
          setActiveConversationId(data.conversations[0]?.id ?? null);
        }
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-700 dark:text-blue-400" />
        <p className="text-sm font-medium">{t('Loading Sathi AI...', 'সাথী AI লোড হচ্ছে...')}</p>
      </div>
    );
  }

  if (!appState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center gap-4">
        <p className="text-sm text-rose-600 font-medium">
          {loadError || t('Unable to load data.', 'তথ্য পাওয়া যায়নি')}
        </p>
        <button
          type="button"
          onClick={onRetryConnection}
          className="px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-700 text-white text-sm font-semibold"
        >
          {t('Try Again', 'আবার চেষ্টা করুন')}
        </button>
      </div>
    );
  }

  const aiFeatures = appState.appSettings.aiFeatures;
  const educationHistory = appState.history.filter((h) => h.tool === 'education');

  return (
    <>
      <NavigationShell
        currentPage={currentPage}
        onNavigate={handleNavigate}
        user={appState.user}
        accountStatus={appState.accountStatus}
        subscription={appState.subscription}
        quota={appState.quota}
        appSettings={appState.appSettings}
        isAdminAuthenticated={adminSession.authenticated}
        onSecretAdminTrigger={() => handleNavigate('admin')}
        uiLang={uiLang}
        onToggleUiLang={handleToggleUiLang}
        responseLanguage={responseLanguage}
        onChangeLanguage={onChangeLanguage}
        activeModel={appState.integrations.geminiModel}
        availableModels={appState.integrations.availableModels}
        onSwitchModel={handleSwitchModel}
        isOnline={isOnline}
        bottomBanner={
          <BottomBannerAd
            ads={appState.ads}
            isPaidUser={appState.subscription.isPaid}
            currentPage={currentPage}
            isTaskBusy={isTaskBusy}
            onNavigate={handleNavigate}
            onTrack={trackAdEvent}
          />
        }
      >
        {currentPage === 'home' && (
          <HomeView
            user={appState.user}
            subscription={appState.subscription}
            quota={appState.quota}
            history={appState.history}
            aiFeatures={aiFeatures}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onNavigate={handleNavigate}
            onQuickEducationAsk={(q) => {
              setPendingEducationQuestion(q);
              handleNavigate('education');
            }}
          />
        )}

        {currentPage === 'assistant' && (
          <AssistantPage
            enabled={aiFeatures?.generalChatEnabled ?? true}
            isOnline={isOnline}
            conversations={appState.conversations || []}
            activeConversationId={activeConversationId}
            onSelectConversation={setActiveConversationId}
            onConversationsChange={handleConversationsChange}
            responseLanguage={responseLanguage}
            activeModel={appState.integrations.geminiModel}
            availableModels={appState.integrations.availableModels}
            onSwitchModel={handleSwitchModel}
            onBusyChange={setIsTaskBusy}
            onQuotaUpdate={(quota) => {
              handleQuotaUpdate(quota);
            }}
          />
        )}

        {currentPage === 'tools' && (
          <AllToolsView onNavigate={handleNavigate} aiFeatures={aiFeatures} />
        )}

        {currentPage === 'education' && (
          <EducationPage
            enabled={aiFeatures?.educationEnabled ?? true}
            isPaidUser={appState.subscription.isPaid}
            isOnline={isOnline}
            ads={appState.ads}
            educationHistory={educationHistory}
            initialQuestion={pendingEducationQuestion}
            onClearInitialQuestion={() => setPendingEducationQuestion('')}
            responseLanguage={responseLanguage}
            activeModel={appState.integrations.geminiModel}
            availableModels={appState.integrations.availableModels}
            onSwitchModel={handleSwitchModel}
            onBusyChange={setIsTaskBusy}
            onNavigate={handleNavigate}
            onTrackAd={trackAdEvent}
            onResultSuccess={(item, quota) => handleResultSuccess(item, quota)}
          />
        )}

        {currentPage === 'jobs' && (
          <JobsPage
            responseLanguage={responseLanguage}
            activeModel={appState.integrations.geminiModel}
            availableModels={appState.integrations.availableModels}
            onSwitchModel={handleSwitchModel}
            onBusyChange={setIsTaskBusy}
            onResultSuccess={(item, quota) => handleResultSuccess(item, quota)}
          />
        )}

        {currentPage === 'health' && (
          <HealthPage
            responseLanguage={responseLanguage}
            activeModel={appState.integrations.geminiModel}
            availableModels={appState.integrations.availableModels}
            onSwitchModel={handleSwitchModel}
            onBusyChange={setIsTaskBusy}
            onResultSuccess={(item, quota) => handleResultSuccess(item, quota)}
          />
        )}

        {currentPage === 'social' && (
          <SocialPage
            responseLanguage={responseLanguage}
            activeModel={appState.integrations.geminiModel}
            availableModels={appState.integrations.availableModels}
            onSwitchModel={handleSwitchModel}
            onBusyChange={setIsTaskBusy}
            onResultSuccess={(item, quota) => handleResultSuccess(item, quota)}
            onSendPromptToVideoStudio={(prompt) => {
              setPendingVideoPrompt(prompt);
              handleNavigate('video');
            }}
          />
        )}

        {currentPage === 'video' && (
          <VideoStudioPage
            videoGenEnabled={aiFeatures?.videoGenerationEnabled ?? true}
            initialPrompt={pendingVideoPrompt}
            onClearInitialPrompt={() => setPendingVideoPrompt('')}
            responseLanguage={responseLanguage}
            integrations={appState.integrations}
            onSwitchModel={handleSwitchModel}
            onBusyChange={setIsTaskBusy}
            onResultSuccess={handleResultSuccess}
          />
        )}

        {currentPage === 'photo' && (
          <PhotoEditorPage
            imageGenEnabled={aiFeatures?.imageGenerationEnabled ?? true}
            responseLanguage={responseLanguage}
            activeModel={appState.integrations.geminiModel}
            availableModels={appState.integrations.availableModels}
            onSwitchModel={handleSwitchModel}
            onBusyChange={setIsTaskBusy}
            onQuotaUpdate={handleQuotaUpdate}
            onResultSuccess={handleResultSuccess}
          />
        )}

        {currentPage === 'subscription' && (
          <SubscriptionPage
            subscription={appState.subscription}
            quota={appState.quota}
            plans={appState.plans}
            payments={appState.payments}
            paymentConfig={appState.appSettings.paymentConfig}
            onStateSync={setAppState}
          />
        )}

        {currentPage === 'history' && (
          <HistoryView
            history={appState.history}
            conversations={appState.conversations || []}
            responseLanguage={responseLanguage}
            onDeleteItem={handleDeleteHistory}
            onClearAll={handleClearHistory}
            onOpenConversation={(convId) => {
              setActiveConversationId(convId);
              handleNavigate('assistant');
            }}
            onDeleteConversation={handleDeleteConversationFromHistory}
          />
        )}

        {currentPage === 'profile' && (
          <ProfileView
            user={appState.user}
            subscription={appState.subscription}
            quota={appState.quota}
            theme={theme}
            onToggleTheme={onToggleTheme}
            responseLanguage={responseLanguage}
            onChangeLanguage={onChangeLanguage}
            onStateSync={setAppState}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'admin' && (
          <AdminPage
            adminSession={adminSession}
            onSessionChange={setAdminSession}
            onAppStateSync={setAppState}
            onPreviewInterstitial={() => {
              setInterstitialMode('preview');
              setInterstitialOpen(true);
            }}
            onExitAdmin={() => {
              if (window.location.hash === '#/sathi-admin' || window.location.hash === '#sathi-admin') {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
              handleNavigate('home');
            }}
          />
        )}
      </NavigationShell>

      <InterstitialAdModal
        open={interstitialOpen && (!appState.subscription.isPaid || interstitialMode === 'preview')}
        mode={interstitialMode}
        ads={appState.ads}
        shownCount={Math.max(1, interstitialShownCount)}
        countdownSeconds={5}
        onClose={() => setInterstitialOpen(false)}
        onNavigate={handleNavigate}
        onTrack={trackAdEvent}
      />
    </>
  );
}

export default function App() {
  const [appState, setAppState] = useState<AppStateResponse | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSessionInfo>({
    authenticated: false,
    role: 'user',
    email: null,
    configured: true,
    missingVars: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguageCode>('en');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const { isOnline, setIsOnline, recheckConnection } = useOnlineStatus();

  const applyAppState = useCallback((data: AppStateResponse) => {
    setAppState(data);
    saveOfflineSnapshot(data);
    setTheme(data.user.theme || 'light');
    setResponseLanguage(normalizeLanguageCode(data.user.preferredLanguage));
    setActiveConversationId((prev) => prev ?? data.conversations?.[0]?.id ?? null);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const [stateRes, sessionRes] = await Promise.all([
        fetch('/api/state', { credentials: 'same-origin' }),
        adminFetch('/api/auth/session'),
      ]);
      if (!stateRes.ok) throw new Error('Unable to load data from server.');
      const data = (await stateRes.json()) as AppStateResponse;
      applyAppState(data);
      setIsOnline(true);
      if (sessionRes.ok) {
        const sessionData = (await sessionRes.json()) as AdminSessionInfo;
        if (!sessionData.authenticated) {
          setStoredAdminToken(null);
        }
        setAdminSession(sessionData);
      }
      setLoadError(null);
    } catch {
      const snapshot = loadOfflineSnapshot();
      applyAppState(snapshot ? snapshot.state : createFallbackOfflineState());
      setIsOnline(false);
      setLoadError(null);
    } finally {
      setLoading(false);
    }
  }, [applyAppState, setIsOnline]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Persist every appState change (new chats, new study notes, plan upgrades) to offline snapshot
  useEffect(() => {
    if (appState) {
      saveOfflineSnapshot(appState);
    }
  }, [appState]);

  // Refresh server state automatically when browser regains connectivity
  useEffect(() => {
    if (isOnline) {
      void fetchState();
    }
  }, [isOnline, fetchState]);

  const handleRetryConnection = async () => {
    const ok = await recheckConnection();
    if (ok) {
      await fetchState();
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: nextTheme }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setAppState(data.state);
      }
    } catch {
      // Theme still applied locally
    }
  };

  const handleChangeLanguage = async (nextLang: ResponseLanguageCode) => {
    setResponseLanguage(nextLang);
    try {
      const res = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: nextLang }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setAppState(data.state);
      }
    } catch {
      // Language still applied locally
    }
  };

  return (
    <UiLanguageProvider defaultLanguage={appState?.appSettings?.defaultLanguage ?? 'en'}>
      <AppInner
        appState={appState}
        setAppState={setAppState}
        adminSession={adminSession}
        setAdminSession={setAdminSession}
        loading={loading}
        loadError={loadError}
        isOnline={isOnline}
        onRetryConnection={handleRetryConnection}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        responseLanguage={responseLanguage}
        onChangeLanguage={handleChangeLanguage}
        activeConversationId={activeConversationId}
        setActiveConversationId={setActiveConversationId}
      />
    </UiLanguageProvider>
  );
}
