import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

let initErrorReason: string = '';

// Parse private key ensuring correct newline formatting and strip extra quotes
const getFormattedPrivateKey = () => {
  let key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
};

function getServiceAccountCredential() {
  // 1. Try local service account file in workspace root
  const rootDir = process.cwd();
  const potentialFiles = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(rootDir, 'bobbies-homie-firebase-adminsdk-fbsvc-cf302e18f6.json'),
  ].filter(Boolean) as string[];

  for (const filePath of potentialFiles) {
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (fileContent.project_id && fileContent.private_key) {
          return cert(fileContent);
        }
      } catch (e) {
        console.warn('Failed to parse service account JSON:', e);
      }
    }
  }

  // 2. Try JSON string in environment variable (easy 1-line paste)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (json.project_id && json.private_key) {
        return cert(json);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      initErrorReason = `Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${msg}`;
      console.warn(initErrorReason);
    }
  }

  // 3. Try private key with automatic fallbacks for project_id and client_email
  const privateKey = getFormattedPrivateKey();
  if (privateKey) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bobbies-homie';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@bobbies-homie.iam.gserviceaccount.com';
    try {
      return cert({
        projectId,
        clientEmail,
        privateKey,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      initErrorReason = `Invalid FIREBASE_PRIVATE_KEY: ${msg}`;
      console.error(initErrorReason);
    }
  } else {
    initErrorReason = `FIREBASE_PRIVATE_KEY is empty or missing in environment variables.`;
  }

  return null;
}

let adminApp: App | null = null;

export function getFirebaseAdminApp(): App | null {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const credential = getServiceAccountCredential();
  if (!credential) {
    return null;
  }

  try {
    adminApp = initializeApp({
      credential,
    });
    return adminApp;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    initErrorReason = `Failed to initialize Firebase Admin app: ${msg}`;
    console.error(initErrorReason);
    return null;
  }
}

export interface PushNotificationPayload {
  tokens: string[];
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
}

export interface PushResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  error?: string;
}

/**
 * Send push notification to one or multiple device tokens
 */
export async function sendPushNotification({
  tokens,
  title,
  body,
  link = '/',
  data = {},
}: PushNotificationPayload): Promise<PushResult> {
  const validTokens = tokens.filter((t) => typeof t === 'string' && t.trim().length > 0);
  if (validTokens.length === 0) {
    return { success: false, successCount: 0, failureCount: 0, error: 'No valid device tokens provided' };
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    return {
      success: false,
      successCount: 0,
      failureCount: validTokens.length,
      error: initErrorReason || 'Firebase Admin is not configured. Add FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_KEY on Vercel.',
    };
  }

  try {
    const messaging = getMessaging(app);
    const response = await messaging.sendEachForMulticast({
      tokens: validTokens,
      notification: {
        title,
        body,
      },
      data: {
        url: link,
        ...data,
      },
      webpush: {
        fcmOptions: {
          link,
        },
        notification: {
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
        },
      },
    });

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error: unknown) {
    console.error('Failed to send FCM push notification:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, successCount: 0, failureCount: validTokens.length, error: msg };
  }
}
