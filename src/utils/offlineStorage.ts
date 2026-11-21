import { useCallback, useEffect, useState } from 'react';
import type { AppStateResponse } from '../types';

const OFFLINE_SNAPSHOT_KEY = 'sathi_offline_state_v1';

export interface OfflineSnapshot {
  state: AppStateResponse;
  savedAt: string;
}

export function saveOfflineSnapshot(state: AppStateResponse): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: OfflineSnapshot = {
      state,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOfflineSnapshot(): OfflineSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineSnapshot;
    if (parsed && parsed.state && parsed.state.user && parsed.state.subscription) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function createFallbackOfflineState(): AppStateResponse {
  const today = new Date().toISOString().slice(0, 10);
  return {
    user: {
      id: 'usr_sathi_01',
      name: 'Sathi User',
      phone: '',
      email: '',
      avatarUrl: '/src/assets/images/sathi_avatar_user_1795095210432.jpg',
      location: 'Bangladesh',
      preferredLanguage: 'en',
      theme: 'light',
    },
    accountStatus: 'active',
    subscription: {
      planId: 'free',
      planNameBn: 'ফ্রি স্টার্টার প্ল্যান',
      status: 'active',
      isPaid: false,
      priceBdt: 0,
      activatedAt: null,
      expiresAt: null,
    },
    quota: {
      usedToday: 0,
      dailyLimit: 12,
      monthlyUsed: 0,
      monthlyLimit: 150,
      lastResetDate: today,
    },
    plans: [],
    payments: [],
    history: [],
    conversations: [],
    ads: {
      networkMode: 'admob_ready',
      admobConfig: {
        providerMode: 'live_admob',
        testMode: false,
        appId: '',
        bannerUnitId: '',
        entryInterstitialUnitId: '',
        studyInterstitialUnitId: '',
        adsenseClientId: 'ca-pub-9416678178678630',
        adsenseBannerSlot: '',
        adsenseInterstitialSlot: '',
      },
      banner: {
        enabled: true,
        title: 'Upgrade to Sathi Pro — ৳200/month',
        subtitle: 'Ad-free experience & 200 daily AI queries',
        ctaText: 'Go Pro',
        targetPage: 'subscription',
        sponsorLabel: 'Ad',
      },
      interstitial: {
        enabled: true,
        maxPerSession: 2,
        title: 'Sathi AI Pro',
        description: 'Unlock 200+ daily AI requests and an ad-free experience.',
        ctaText: 'Go Pro',
        targetPage: 'subscription',
      },
      stats: {
        bannerImpressions: 0,
        interstitialImpressions: 0,
        clicks: 0,
      },
    },
    appSettings: {
      defaultLanguage: 'en',
      paymentConfig: {
        bkashEnabled: true,
        bkashNumber: '01944527151',
        nagadEnabled: true,
        nagadNumber: '01354848807',
        rocketEnabled: false,
        rocketNumber: '',
        cardEnabled: false,
        sendMoneyNoteEn:
          'Send Money to the selected bKash or Nagad Personal number, then enter your sender number and TrxID below.',
        sendMoneyNoteBn:
          'নির্বাচিত বিকাশ বা নগদ পার্সোনাল নম্বরে Send Money করে নিচে আপনার প্রেরক নম্বর ও ট্রানজেকশন আইডি (TrxID) দিন।',
      },
      aiFeatures: {
        educationEnabled: true,
        generalChatEnabled: true,
        imageGenerationEnabled: true,
        videoGenerationEnabled: true,
      },
      announcement: {
        enabled: false,
        title: '',
        message: '',
        type: 'info',
      },
      maintenanceMode: {
        enabled: false,
        messageBn: '',
      },
      aiSettings: {
        enabled: true,
        cacheEnabled: true,
        allowUserModelSwitch: true,
        streamEnabled: true,
      },
    },
    integrations: {
      geminiConnected: true,
      geminiModel: 'gemini-3.1-flash-lite-preview',
      availableModels: [],
      searchGroundingReady: true,
      imageGenReady: true,
      videoGenReady: true,
      videoApiConnected: true,
      videoApiLabel: 'Flow AI Video',
      photoCloudApiConnected: true,
      photoCloudApiLabel: 'AI Image Studio',
    },
    analytics: {
      totalRequests: 0,
      activeUsers: 1,
      pendingPaymentsCount: 0,
      verifiedRevenueBdt: 0,
    },
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const recheckConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/state', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      const ok = res.ok;
      setIsOnline(ok);
      return ok;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  return { isOnline, setIsOnline, recheckConnection };
}
