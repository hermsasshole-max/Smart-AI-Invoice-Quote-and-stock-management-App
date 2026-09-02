import { Client } from '../types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App for authentication
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export interface GoogleContactParsed {
  resourceName?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  company?: string;
  jobTitle?: string;
  photoUrl?: string;
  selected?: boolean;
}

export const SCOPES = 'https://www.googleapis.com/auth/contacts.readonly';

// In-memory token cache (never stored in localStorage)
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export function getCurrentGoogleUser(): User | null {
  return currentUser || auth.currentUser;
}

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Load Google Identity Services library as fallback
 */
export function loadGoogleGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.accounts?.oauth2) return resolve();

    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services SDK')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

/**
 * Primary Google Authentication method using Firebase Auth popup (standard for AI Studio apps)
 * with graceful fallback to Google Identity Services token client using the configured OAuth client ID.
 */
export async function requestGoogleContactsToken(clientId?: string): Promise<string> {
  // 1. Try Firebase Auth popup first (preferred & fully configured with brand & domain)
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope(SCOPES);
    provider.setCustomParameters({
      prompt: 'consent',
    });

    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      return credential.accessToken;
    }
  } catch (firebaseErr: any) {
    console.warn('Firebase Auth popup encountered an issue, trying GIS token client:', firebaseErr);

    // If user cancelled, don't retry GIS automatically to avoid double popups
    if (
      firebaseErr?.code === 'auth/popup-closed-by-user' ||
      firebaseErr?.code === 'auth/cancelled-popup-request'
    ) {
      throw new Error('Sign-in cancelled by user.');
    }

    // 2. Fallback to Google Identity Services Token Client
    const oauthClientId =
      clientId ||
      (firebaseConfig as any).oAuthClientId ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID);

    if (!oauthClientId) {
      throw new Error(
        firebaseErr?.message ||
          'No valid Google OAuth Client ID found. Please confirm OAuth setup in the integration settings.'
      );
    }

    await loadGoogleGsiScript();

    if (!window.google?.accounts?.oauth2) {
      throw new Error(firebaseErr?.message || 'Google Identity Services SDK is not initialized.');
    }

    return new Promise((resolve, reject) => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: oauthClientId,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(`Google authorization failed: ${response.error_description || response.error}`));
              return;
            }
            if (!response.access_token) {
              reject(new Error('No access token returned from Google authentication'));
              return;
            }
            cachedAccessToken = response.access_token;
            resolve(response.access_token);
          },
          error_callback: (err: any) => {
            reject(
              new Error(
                err?.message ||
                  'Google Auth Popup closed or blocked. If inside an iframe, please open the app in a new tab or allow popups.'
              )
            );
          },
        });

        client.requestAccessToken({ prompt: 'consent' });
      } catch (err: any) {
        reject(new Error(`Failed to initialize Google Auth Client: ${err.message || err}`));
      }
    });
  }

  throw new Error('Could not retrieve Google Contacts access token.');
}

/**
 * Sign out from Google Auth and clear in-memory token
 */
export async function googleSignOut(): Promise<void> {
  cachedAccessToken = null;
  currentUser = null;
  await signOut(auth).catch(() => {});
}

/**
 * Fetch contacts directly from Google People API
 */
export async function fetchGooglePeopleContacts(accessToken: string): Promise<GoogleContactParsed[]> {
  const url = new URL('https://people.googleapis.com/v1/people/me/connections');
  url.searchParams.set(
    'personFields',
    'names,phoneNumbers,emailAddresses,addresses,organizations,photos'
  );
  url.searchParams.set('pageSize', '150');
  url.searchParams.set('sortOrder', 'FIRST_NAME_ASCENDING');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Google People API failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  const connections = data.connections || [];

  const parsedList: GoogleContactParsed[] = [];

  for (const person of connections) {
    const name = person.names?.[0]?.displayName || person.names?.[0]?.givenName || '';
    const phone = person.phoneNumbers?.[0]?.canonicalForm || person.phoneNumbers?.[0]?.value || '';
    const email = person.emailAddresses?.[0]?.value || '';
    const address = person.addresses?.[0]?.formattedValue || person.addresses?.[0]?.streetAddress || '';
    const company = person.organizations?.[0]?.name || '';
    const jobTitle = person.organizations?.[0]?.title || '';
    const photoUrl = person.photos?.[0]?.url || '';

    // Only include contacts with at least a name or a phone number
    if (name || phone) {
      parsedList.push({
        resourceName: person.resourceName,
        name: name || phone,
        phone: phone || '',
        email: email || undefined,
        address: address || '',
        company: company || undefined,
        jobTitle: jobTitle || undefined,
        photoUrl: photoUrl || undefined,
        selected: true,
      });
    }
  }

  return parsedList;
}

/**
 * Check if the browser or Android device supports the W3C Native Contact Picker API
 */
export function isNativeContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

/**
 * Open native Android / Mobile contact picker via navigator.contacts.select()
 */
export async function pickNativeDeviceContacts(): Promise<GoogleContactParsed[]> {
  if (!isNativeContactPickerSupported()) {
    throw new Error('Native Device Contact Picker is not supported on this browser/platform.');
  }

  const props = ['name', 'tel', 'email', 'address'];
  const opts = { multiple: true };

  try {
    const rawContacts = await (navigator as any).contacts.select(props, opts);
    if (!rawContacts || !Array.isArray(rawContacts)) return [];

    return rawContacts.map((c: any) => {
      const name = Array.isArray(c.name) ? c.name[0] : c.name || 'Device Contact';
      const phone = Array.isArray(c.tel) ? c.tel[0] : c.tel || '';
      const email = Array.isArray(c.email) ? c.email[0] : c.email || undefined;
      const address = Array.isArray(c.address)
        ? typeof c.address[0] === 'string'
          ? c.address[0]
          : Object.values(c.address[0] || {}).join(', ')
        : c.address || '';

      return {
        name,
        phone,
        email,
        address,
        selected: true,
      };
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return []; // User cancelled picker
    }
    throw err;
  }
}

/**
 * Parse VCF (vCard 3.0 / 4.0 / 2.1) export file format
 */
export function parseVCardFileContent(vcfText: string): GoogleContactParsed[] {
  const contacts: GoogleContactParsed[] = [];
  const vcards = vcfText.split(/END:VCARD/i);

  for (const card of vcards) {
    if (!card.trim() || !card.toUpperCase().includes('BEGIN:VCARD')) continue;

    let name = '';
    let phone = '';
    let email = '';
    let address = '';
    let company = '';

    const lines = card.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Full Name
      if (line.startsWith('FN:') || line.startsWith('FN;')) {
        name = line.substring(line.indexOf(':') + 1).trim();
      } else if (!name && (line.startsWith('N:') || line.startsWith('N;'))) {
        const parts = line.substring(line.indexOf(':') + 1).split(';');
        const last = parts[0] || '';
        const first = parts[1] || '';
        name = `${first} ${last}`.trim();
      }

      // Telephone (CELL, PREF, WORK, HOME)
      if (line.startsWith('TEL') && !phone) {
        phone = line.substring(line.indexOf(':') + 1).trim();
      }

      // Email
      if (line.startsWith('EMAIL') && !email) {
        email = line.substring(line.indexOf(':') + 1).trim();
      }

      // Organization / Company
      if (line.startsWith('ORG:') || line.startsWith('ORG;')) {
        company = line.substring(line.indexOf(':') + 1).replace(/;/g, ' ').trim();
      }

      // Address
      if (line.startsWith('ADR:') || line.startsWith('ADR;')) {
        const adrParts = line.substring(line.indexOf(':') + 1).split(';');
        address = adrParts.filter(Boolean).join(', ').trim();
      }
    }

    if (name || phone) {
      contacts.push({
        name: name || phone || 'Imported Contact',
        phone: phone || '',
        email: email || undefined,
        address: address || '',
        company: company || undefined,
        selected: true,
      });
    }
  }

  return contacts;
}
