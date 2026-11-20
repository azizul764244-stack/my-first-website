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
  return { isOnline: true, setIsOnline: () => {}, recheckConnection: async () => true };
}
