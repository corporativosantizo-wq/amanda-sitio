// ============================================================================
// lib/hooks/use-activity-tracker.ts
// Tracks user activity: page views, idle detection, and significant actions
// ============================================================================

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const DEBOUNCE_MS = 2000; // Don't send more than 1 event per 2 seconds

let lastTrack = 0;
let idleTimer: NodeJS.Timeout | null = null;
let isIdle = false;

function sendActivity(accion: string, modulo?: string, detalle?: string) {
  const now = Date.now();
  if (now - lastTrack < DEBOUNCE_MS && accion === 'page_view') return;
  lastTrack = now;

  // Fire-and-forget beacon
  const body = JSON.stringify({ accion, modulo, detalle });
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/admin/actividad', body);
  } else {
    fetch('/api/admin/actividad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

function resetIdleTimer() {
  if (isIdle) {
    isIdle = false;
    sendActivity('idle_end');
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    isIdle = true;
    sendActivity('idle_start');
  }, IDLE_THRESHOLD_MS);
}

/**
 * Hook that automatically tracks page views and idle time.
 * Must be used in the admin layout so it covers all pages.
 */
export function useActivityTracker() {
  const pathname = usePathname();
  const prevPath = useRef('');

  // Track page views on route change
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      sendActivity('page_view', pathname);
      resetIdleTimer();
    }
  }, [pathname]);

  // Set up idle detection listeners
  useEffect(() => {
    const onActivity = () => resetIdleTimer();

    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('click', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });

    // Initial timer
    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('scroll', onActivity);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  // Expose manual tracking for significant actions
  const trackAction = useCallback((accion: string, modulo?: string, detalle?: string) => {
    sendActivity(accion, modulo, detalle);
    resetIdleTimer();
  }, []);

  return { trackAction };
}
