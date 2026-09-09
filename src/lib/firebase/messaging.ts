'use client';

import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getFirebaseMessaging, isFirebaseConfigured } from './client';
import { updateUserFcmToken } from '@/lib/services/db';

export interface FcmTokenResult {
  token: string | null;
  status: 'granted' | 'denied' | 'unsupported' | 'not_configured' | 'error';
  message?: string;
}

/**
 * Request notification permission from browser, register service worker,
 * retrieve FCM token, and optionally save it to Supabase profile.
 */
export async function requestFcmToken(userId?: string): Promise<FcmTokenResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { token: null, status: 'unsupported', message: 'Notifications are not supported in this browser' };
  }

  if (!isFirebaseConfigured) {
    return {
      token: null,
      status: 'not_configured',
      message: 'Firebase configuration is missing in environment variables',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { token: null, status: 'denied', message: 'Notification permission denied' };
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return { token: null, status: 'unsupported', message: 'FCM is not supported on this platform' };
    }

    // Register service worker if not already registered
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const currentToken = await getToken(messaging, {
      vapidKey: vapidKey || undefined,
      serviceWorkerRegistration,
    });

    if (currentToken) {
      // Save token to Supabase profile if userId is provided
      if (userId) {
        await updateUserFcmToken(userId, currentToken);
      }
      return { token: currentToken, status: 'granted' };
    } else {
      return { token: null, status: 'error', message: 'No registration token available' };
    }
  } catch (error: unknown) {
    console.error('Error getting FCM token:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { token: null, status: 'error', message: msg };
  }
}

/**
 * Setup foreground notification listener
 */
export async function setupForegroundMessageListener(
  onPayload: (payload: MessagePayload) => void
): Promise<(() => void) | null> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      onPayload(payload);
    });
    return unsubscribe;
  } catch (error) {
    console.warn('Could not setup foreground listener:', error);
    return null;
  }
}
