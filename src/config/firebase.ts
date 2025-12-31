import admin from 'firebase-admin';
import config from './env';
import logger from '../utils/logger';

/**
 * Firebase Admin SDK Configuration
 * Used for: Push Notifications, Dynamic Links, Cloud Messaging
 */

let firebaseApp: admin.app.App | null = null;
let isFirebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 */
export const initializeFirebase = () => {
  try {
    // Check if already initialized
    if (isFirebaseInitialized && firebaseApp) {
      logger.info('Firebase already initialized');
      return firebaseApp;
    }

    // Initialize Firebase Admin with service account
    const serviceAccount = {
      projectId: config.firebase.projectId,
      privateKey: config.firebase.privateKey?.replace(/\\n/g, '\n'),
      clientEmail: config.firebase.clientEmail,
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: config.firebase.projectId,
    });

    isFirebaseInitialized = true;

    logger.info('✅ Firebase Admin SDK initialized successfully', {
      projectId: config.firebase.projectId,
    });

    return firebaseApp;
  } catch (error: any) {
    logger.error('❌ Failed to initialize Firebase Admin SDK', {
      error: error.message,
      stack: error.stack,
    });

    // Don't throw - allow app to continue without Firebase
    logger.warn('⚠️ Application will continue without Firebase features');
    return null;
  }
};

/**
 * Get Firebase Admin App instance
 */
export const getFirebaseApp = (): admin.app.App | null => {
  if (!isFirebaseInitialized) {
    return initializeFirebase();
  }
  return firebaseApp;
};

/**
 * Get Firebase Messaging instance
 */
export const getMessaging = (): admin.messaging.Messaging | null => {
  const app = getFirebaseApp();
  if (!app) {
    logger.warn('Firebase not initialized, messaging unavailable');
    return null;
  }
  return admin.messaging(app);
};

/**
 * Get Firestore instance (for storing deep link metadata)
 */
export const getFirestore = (): admin.firestore.Firestore | null => {
  const app = getFirebaseApp();
  if (!app) {
    logger.warn('Firebase not initialized, Firestore unavailable');
    return null;
  }
  return admin.firestore(app);
};

/**
 * Check if Firebase is available
 */
export const isFirebaseAvailable = (): boolean => {
  return isFirebaseInitialized && firebaseApp !== null;
};

/**
 * Firebase health check
 */
export const getFirebaseHealth = async () => {
  try {
    if (!isFirebaseAvailable()) {
      return {
        status: 'unavailable',
        initialized: false,
        error: 'Firebase not initialized',
      };
    }

    // Test Firestore connection
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('_health_check').limit(1).get();
    }

    return {
      status: 'available',
      initialized: true,
      projectId: config.firebase.projectId,
      features: {
        messaging: !!getMessaging(),
        firestore: !!getFirestore(),
      },
    };
  } catch (error: any) {
    return {
      status: 'error',
      initialized: true,
      error: error.message,
    };
  }
};

// Initialize Firebase on module load
if (config.firebase.projectId && config.firebase.privateKey && config.firebase.clientEmail) {
  initializeFirebase();
} else {
  logger.warn('⚠️ Firebase credentials not configured, Firebase features disabled');
}

export default {
  initializeFirebase,
  getFirebaseApp,
  getMessaging,
  getFirestore,
  isFirebaseAvailable,
  getFirebaseHealth,
};


