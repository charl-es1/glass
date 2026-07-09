import { adminDb } from './firebase-admin';

export interface SystemSettings {
  id: "global";
  siteTitle: string;
  email: string;
  phone: string;
  country: string;
  defaultLanguage: string;
  address: string;
  headerLogo: {
    url: string;
    storagePath: string;
    width: number;
    height: number;
  } | null;
  footerLogo: {
    url: string;
    storagePath: string;
    width: number;
    height: number;
  } | null;
  favicon: {
    url: string;
    storagePath: string;
    width: number;
    height: number;
  } | null;
  updatedAt: string;
  updatedBy: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  id: 'global',
  siteTitle: 'GlassCut Manager',
  email: 'info@glasscutting.com',
  phone: '+233 24 123 4567',
  country: 'GH - Ghana',
  defaultLanguage: 'en',
  address: '123 Glass Lane, Industrial Area, Accra, Ghana',
  headerLogo: null,
  footerLogo: null,
  favicon: null,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

let cachedSettings: SystemSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds cache TTL

export async function getSystemSettings(): Promise<SystemSettings> {
  // During Next.js build phase, return default settings to avoid Firestore connection timeouts.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return DEFAULT_SETTINGS;
  }

  const now = Date.now();
  if (cachedSettings && (now - cacheTimestamp < CACHE_TTL)) {
    return cachedSettings;
  }

  try {
    const doc = await adminDb.collection('settings').doc('global').get();
    if (doc.exists) {
      const data = doc.data();
      let serializedUpdatedAt = DEFAULT_SETTINGS.updatedAt;
      if (data?.updatedAt) {
        if (typeof data.updatedAt.toDate === 'function') {
          serializedUpdatedAt = data.updatedAt.toDate().toISOString();
        } else if (data.updatedAt instanceof Date) {
          serializedUpdatedAt = data.updatedAt.toISOString();
        } else if (typeof data.updatedAt === 'string') {
          serializedUpdatedAt = data.updatedAt;
        } else if (data.updatedAt.seconds) {
          serializedUpdatedAt = new Date(data.updatedAt.seconds * 1000).toISOString();
        }
      }
      
      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...data,
        id: 'global',
        updatedAt: serializedUpdatedAt,
      } as SystemSettings;
    } else {
      cachedSettings = DEFAULT_SETTINGS;
    }
    cacheTimestamp = now;
    return cachedSettings;
  } catch (error) {
    console.error('Error fetching system settings from Firestore:', error);
    return cachedSettings || DEFAULT_SETTINGS;
  }
}

export async function saveSystemSettings(settings: Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedBy'>, adminUserId: string): Promise<SystemSettings> {
  try {
    const dataToSave = {
      ...settings,
      id: 'global',
      updatedAt: new Date(),
      updatedBy: adminUserId,
    };

    await adminDb.collection('settings').doc('global').set(dataToSave, { merge: true });
    
    // Invalidate the cache
    clearSettingsCache();

    return {
      ...settings,
      id: 'global',
      updatedAt: dataToSave.updatedAt.toISOString(),
      updatedBy: adminUserId,
    };
  } catch (error) {
    console.error('Error saving system settings to Firestore:', error);
    throw error;
  }
}

export function clearSettingsCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}
