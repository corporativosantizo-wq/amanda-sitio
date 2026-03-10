// ============================================================================
// lib/hooks/use-session-keep-alive.ts
// Keeps Clerk session alive by refreshing the token every 4 minutes.
// Shows a modal overlay when the session expires instead of redirecting.
// ============================================================================

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

const REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

export function useSessionKeepAlive() {
  const { getToken, isSignedIn } = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshToken = useCallback(async () => {
    try {
      const token = await getToken({ skipCache: true });
      if (!token) {
        setSessionExpired(true);
      }
    } catch {
      setSessionExpired(true);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;

    // Initial refresh
    refreshToken();

    // Set up interval
    intervalRef.current = setInterval(refreshToken, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSignedIn, refreshToken]);

  const handleReconnect = useCallback(() => {
    window.location.reload();
  }, []);

  return { sessionExpired, handleReconnect };
}
