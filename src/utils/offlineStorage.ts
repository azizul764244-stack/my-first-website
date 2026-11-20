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

  const recheckConnection = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/state', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      const online = res.ok || (typeof navigator !== 'undefined' ? navigator.onLine : true);
      setIsOnline(online);
      return online;
    } catch {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(online);
      return online;
    }
  }, []);
  return { isOnline, setIsOnline, recheckConnection };
}
