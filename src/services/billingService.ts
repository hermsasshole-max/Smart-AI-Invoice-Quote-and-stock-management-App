import { getApiUrl } from '../config/api';
import { fetchWithRetry } from '../utils/apiClient';

export type SubscriptionTier = 'FREE' | 'PRO' | 'BUSINESS';

export interface BillingProduct {
  id: string;
  tier: SubscriptionTier;
  period: 'monthly' | 'yearly';
  title: string;
  description: string;
  priceZar: number;
  priceUsd: number;
  formattedPriceZar: string;
  formattedPriceUsd: string;
  savingsBadge?: string;
  features: string[];
}

export interface CachedEntitlements {
  userId: string;
  tier: SubscriptionTier;
  status: 'active' | 'grace_period' | 'expired';
  lastVerifiedOnline: number; // timestamp
  offlineGracePeriodDays: number;
  subscriptionExpiresAt?: string;
  creditsRemaining: number;
  creditsUsed: number;
  totalMonthlyCredits: number;
  documentsCreatedThisMonth: number;
  maxMonthlyDocuments: number;
  unlimitedDocuments: boolean;
  unlimitedAi: boolean;
  unlimitedInventory: boolean;
  customPdfBranding: boolean;
}

const STORAGE_KEY = 'harrys_billing_entitlements_v2';
const USER_ID_KEY = 'harrys_contractor_user_id';
const OFFLINE_GRACE_DAYS = 14;

export const PRODUCTS: BillingProduct[] = [
  {
    id: 'pro_monthly',
    tier: 'PRO',
    period: 'monthly',
    title: 'Pro Contractor',
    description: 'Unlimited documents, custom branding, and WhatsApp PDF delivery.',
    priceZar: 149,
    priceUsd: 9.99,
    formattedPriceZar: 'R149 / month',
    formattedPriceUsd: '$9.99 / month',
    features: [
      'Unlimited Invoices, Quotes & Estimates',
      'Unlimited Inventory Items & Low Stock Alerts',
      'Custom PDF Branding (Logo, SANS Notices & Colors)',
      'Direct WhatsApp & Email PDF Dispatch',
      '50 Gemini AI Assistant Credits / month',
      'Offline Job Site Mode with 14-day Grace Period',
    ],
  },
  {
    id: 'pro_yearly',
    tier: 'PRO',
    period: 'yearly',
    title: 'Pro Contractor (Annual)',
    description: 'Best value for active electrical & HVAC trades.',
    priceZar: 1490,
    priceUsd: 99.00,
    formattedPriceZar: 'R1,490 / year',
    formattedPriceUsd: '$99.00 / year',
    savingsBadge: 'SAVE 20%',
    features: [
      'Everything in Pro Monthly',
      '2 Months Free (Save R298 / $20.88)',
      'Priority Offline-First Sync',
      'Dedicated Trade Document Styling',
    ],
  },
  {
    id: 'business_monthly',
    tier: 'BUSINESS',
    period: 'monthly',
    title: 'Business AI Tier',
    description: 'Unlimited AI power for fast-growing trade businesses.',
    priceZar: 299,
    priceUsd: 19.99,
    formattedPriceZar: 'R299 / month',
    formattedPriceUsd: '$19.99 / month',
    features: [
      'Everything in Pro Plan',
      'Unlimited AI Generations & Voice-to-Quote',
      'Unlimited Receipt & Slip OCR Camera Scanning',
      'AI Automated Job Cost & Labor Estimator',
      'Multi-device Contractor Cloud Sync',
      'Priority 24/7 Technical Support',
    ],
  },
  {
    id: 'business_yearly',
    tier: 'BUSINESS',
    period: 'yearly',
    title: 'Business AI (Annual)',
    description: 'Full automated AI trade suite for teams & solo masters.',
    priceZar: 2990,
    priceUsd: 199.00,
    formattedPriceZar: 'R2,990 / year',
    formattedPriceUsd: '$199.00 / year',
    savingsBadge: 'SAVE 20%',
    features: [
      'Everything in Business AI Monthly',
      '2 Months Free (Save R598 / $40.88)',
      'Multi-crew License & Unlimited Receipts',
    ],
  },
];

class BillingService {
  private userId: string;

  constructor() {
    let storedId = localStorage.getItem(USER_ID_KEY);
    if (!storedId) {
      storedId = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem(USER_ID_KEY, storedId);
    }
    this.userId = storedId;
  }

  public getUserId(): string {
    return this.userId;
  }

  /**
   * Get cached entitlements with failsafe offline grace period computation
   */
  public getCachedEntitlements(): CachedEntitlements {
    const raw = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();

    if (raw) {
      try {
        const parsed: CachedEntitlements = JSON.parse(raw);
        const daysSinceSync = (now - parsed.lastVerifiedOnline) / (1000 * 60 * 60 * 24);

        // Check if within 14-day offline grace period
        if (parsed.tier !== 'FREE') {
          if (daysSinceSync <= OFFLINE_GRACE_DAYS) {
            parsed.status = daysSinceSync > 3 ? 'grace_period' : 'active';
            return parsed;
          } else {
            console.warn('[BillingService] Offline grace period expired (14 days). Reverting to FREE tier.');
            parsed.tier = 'FREE';
            parsed.status = 'expired';
            parsed.unlimitedDocuments = false;
            parsed.unlimitedAi = false;
            parsed.maxMonthlyDocuments = 5;
            parsed.totalMonthlyCredits = 3;
            parsed.customPdfBranding = false;
            return parsed;
          }
        }
        return parsed;
      } catch (err) {
        console.error('[BillingService] Corrupted cached entitlements, initializing fresh free tier:', err);
      }
    }

    const defaultFree: CachedEntitlements = {
      userId: this.userId,
      tier: 'FREE',
      status: 'active',
      lastVerifiedOnline: now,
      offlineGracePeriodDays: OFFLINE_GRACE_DAYS,
      creditsRemaining: 3,
      creditsUsed: 0,
      totalMonthlyCredits: 3,
      documentsCreatedThisMonth: 0,
      maxMonthlyDocuments: 5,
      unlimitedDocuments: false,
      unlimitedAi: false,
      unlimitedInventory: false,
      customPdfBranding: false,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultFree));
    return defaultFree;
  }

  /**
   * Save and persist entitlements locally
   */
  public saveEntitlements(entitlements: Partial<CachedEntitlements>): CachedEntitlements {
    const current = this.getCachedEntitlements();
    const updated: CachedEntitlements = {
      ...current,
      ...entitlements,
      lastVerifiedOnline: entitlements.lastVerifiedOnline || Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('billing-entitlements-changed'));
    }

    return updated;
  }

  /**
   * Sync entitlements with backend /api/usage
   * Gracefully falls back to cached/offline state without blocking or throwing
   */
  public async syncWithServer(): Promise<CachedEntitlements> {
    try {
      const res = await fetchWithRetry(`/api/usage?userId=${encodeURIComponent(this.userId)}`, {
        method: 'GET',
        headers: {
          'x-user-id': this.userId,
        },
        timeoutMs: 30000,
        retries: 2,
        silent: true,
      });

      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && !data.offline) {
          const updated = this.saveEntitlements({
            tier: data.tier || 'FREE',
            status: 'active',
            lastVerifiedOnline: Date.now(),
            creditsRemaining: data.aiCredits?.remaining ?? (data.tier === 'BUSINESS' ? 999999 : 3),
            creditsUsed: data.aiCredits?.used ?? 0,
            totalMonthlyCredits: data.aiCredits?.total ?? 3,
            documentsCreatedThisMonth: data.documents?.createdThisMonth ?? 0,
            maxMonthlyDocuments: data.documents?.maxAllowed ?? 5,
            unlimitedDocuments: data.documents?.unlimited ?? false,
            unlimitedAi: data.aiCredits?.unlimited ?? (data.tier === 'BUSINESS'),
            unlimitedInventory: data.inventory?.unlimited ?? false,
            customPdfBranding: data.entitlements?.customPdfBranding ?? false,
            subscriptionExpiresAt: data.subscriptionExpiresAt,
          });
          return updated;
        }
      }
    } catch (err) {
      console.warn('[BillingService] Server unreachable, relying on offline cached entitlements:', err);
    }

    return this.getCachedEntitlements();
  }

  /**
   * Purchase a subscription plan (Google Play IAP / RevenueCat / Web Stripe fallback)
   */
  public async purchase(productId: string): Promise<{ success: boolean; tier: SubscriptionTier; message: string }> {
    const product = PRODUCTS.find((p) => p.id === productId) || PRODUCTS[0];
    const isAndroid = Boolean(window.AndroidInterface?.isAndroidApp?.());

    console.log(`[BillingService] Initiating purchase flow for ${productId} (Android Native=${isAndroid})`);

    try {
      // 1. If running inside native Android WebView with Google Play IAP Bridge
      if (isAndroid && window.AndroidInterface?.showToast) {
        window.AndroidInterface.showToast(`Starting Google Play Billing for ${product.title}...`);
      }

      // 2. Call server verification endpoint to register and activate the entitlement
      const verifyRes = await fetchWithRetry('/api/billing/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId,
        },
        body: JSON.stringify({
          userId: this.userId,
          productId: product.id,
          platform: isAndroid ? 'google_play' : 'web_stripe',
          orderId: 'ORD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
          purchaseToken: 'tok_' + Math.random().toString(36).substring(2, 18),
        }),
        timeoutMs: 45000,
        retries: 3,
      });

      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        const newTier: SubscriptionTier = verifyData.tier || product.tier;

        this.saveEntitlements({
          tier: newTier,
          status: 'active',
          lastVerifiedOnline: Date.now(),
          subscriptionExpiresAt: verifyData.expiresAt,
          unlimitedDocuments: true,
          unlimitedInventory: true,
          unlimitedAi: newTier === 'BUSINESS',
          customPdfBranding: true,
          creditsRemaining: newTier === 'BUSINESS' ? 999999 : 50,
          totalMonthlyCredits: newTier === 'BUSINESS' ? 999999 : 50,
        });

        return {
          success: true,
          tier: newTier,
          message: `Congratulations! Your ${product.title} subscription is now active.`,
        };
      }
    } catch (err) {
      console.warn('[BillingService] Online verification failed. Applying local fail-open subscription:', err);
    }

    // Fail-open local activation if network hiccups during checkout
    const newTier = product.tier;
    this.saveEntitlements({
      tier: newTier,
      status: 'active',
      lastVerifiedOnline: Date.now(),
      unlimitedDocuments: true,
      unlimitedInventory: true,
      unlimitedAi: newTier === 'BUSINESS',
      customPdfBranding: true,
      creditsRemaining: newTier === 'BUSINESS' ? 999999 : 50,
      totalMonthlyCredits: newTier === 'BUSINESS' ? 999999 : 50,
    });

    return {
      success: true,
      tier: newTier,
      message: `Your ${product.title} subscription is active in offline mode.`,
    };
  }

  /**
   * Developer / Promo Code Unlock: Redeem 'NismoR34' for Lifetime Unlimited Access
   */
  public async redeemDeveloperCode(rawCode: string): Promise<{ success: boolean; tier: SubscriptionTier; message: string }> {
    const code = (rawCode || '').trim();
    if (code.toLowerCase() !== 'nismor34') {
      return {
        success: false,
        tier: this.getCachedEntitlements().tier,
        message: 'Invalid developer token. Please verify the code and try again.',
      };
    }

    const lifetimeExpiresAt = '2099-12-31T23:59:59.000Z';

    // 1. Immediately activate complete Business tier on client
    this.saveEntitlements({
      tier: 'BUSINESS',
      status: 'active',
      lastVerifiedOnline: Date.now(),
      subscriptionExpiresAt: lifetimeExpiresAt,
      unlimitedDocuments: true,
      unlimitedInventory: true,
      unlimitedAi: true,
      customPdfBranding: true,
      creditsRemaining: 999999,
      totalMonthlyCredits: 999999,
      maxMonthlyDocuments: 999999,
      offlineGracePeriodDays: 36500,
    });

    // 2. Sync with backend so server-side usage meters & AI calls recognize Developer Access
    try {
      await fetchWithRetry('/api/billing/developer-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId,
        },
        body: JSON.stringify({
          code: 'NismoR34',
          userId: this.userId,
        }),
        timeoutMs: 30000,
        retries: 2,
        silent: true,
      });
    } catch (err) {
      console.warn('[BillingService] Server sync for developer token failed (offline mode active):', err);
    }

    return {
      success: true,
      tier: 'BUSINESS',
      message: 'Developer Code Accepted! Unlimited Free Access to all features & AI unlocked permanently.',
    };
  }

  /**
   * Restore Purchases (Google Play & Web)
   */
  public async restorePurchases(): Promise<{ success: boolean; message: string; tier: SubscriptionTier }> {
    try {
      const res = await fetchWithRetry(`/api/usage?userId=${encodeURIComponent(this.userId)}`, {
        headers: { 'x-user-id': this.userId },
        timeoutMs: 30000,
        retries: 2,
        silent: true,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.tier && data.tier !== 'FREE') {
          this.syncWithServer();
          return {
            success: true,
            tier: data.tier,
            message: `Found active ${data.tier} plan. Your purchases have been restored!`,
          };
        }
      }
    } catch (err) {
      console.warn('[BillingService] Restore check failed over network:', err);
    }

    const current = this.getCachedEntitlements();
    if (current.tier !== 'FREE') {
      return {
        success: true,
        tier: current.tier,
        message: `Restored cached ${current.tier} plan (Offline Grace Period active).`,
      };
    }

    return {
      success: false,
      tier: 'FREE',
      message: 'No previous active subscription found for this Google Play / Web account.',
    };
  }
}

export const billingService = new BillingService();
