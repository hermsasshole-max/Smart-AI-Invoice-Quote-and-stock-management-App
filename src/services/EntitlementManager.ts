import { billingService, CachedEntitlements, SubscriptionTier } from './billingService';
import { fetchWithRetry } from '../utils/apiClient';

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  requiredTier?: SubscriptionTier;
}

class EntitlementManager {
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('billing-entitlements-changed', () => {
        this.notify();
      });
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getEntitlements(): CachedEntitlements {
    return billingService.getCachedEntitlements();
  }

  public getTier(): SubscriptionTier {
    return this.getEntitlements().tier;
  }

  public isProOrHigher(): boolean {
    const tier = this.getTier();
    return tier === 'PRO' || tier === 'BUSINESS';
  }

  public isBusiness(): boolean {
    return this.getTier() === 'BUSINESS';
  }

  /**
   * Check if user can create another Invoice or Quotation this month
   */
  public canCreateDocument(currentMonthDocumentCount: number): EntitlementCheckResult {
    const ent = this.getEntitlements();

    if (ent.unlimitedDocuments || ent.tier !== 'FREE') {
      return { allowed: true };
    }

    if (currentMonthDocumentCount >= ent.maxMonthlyDocuments) {
      return {
        allowed: false,
        upgradeRequired: true,
        requiredTier: 'PRO',
        reason: `You have reached the limit of ${ent.maxMonthlyDocuments} documents this month on the Free Plan. Upgrade to Pro for unlimited documents.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can add another inventory item (Free tier capped at 20)
   */
  public canAddInventoryItem(currentItemCount: number): EntitlementCheckResult {
    const ent = this.getEntitlements();

    if (ent.unlimitedInventory || ent.tier !== 'FREE') {
      return { allowed: true };
    }

    if (currentItemCount >= 20) {
      return {
        allowed: false,
        upgradeRequired: true,
        requiredTier: 'PRO',
        reason: 'Free tier is limited to 20 local inventory items. Upgrade to Pro for unlimited stock items and automated re-order warnings.',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can use AI tool (Receipt OCR, Voice-to-Quote, AI Estimator)
   */
  public canUseAiFeature(featureName: string = 'AI Assistant'): {
    allowed: boolean;
    creditsRemaining: number;
    unlimited: boolean;
    reason?: string;
  } {
    const ent = this.getEntitlements();

    if (ent.unlimitedAi || ent.tier === 'BUSINESS') {
      return { allowed: true, creditsRemaining: 999999, unlimited: true };
    }

    if (ent.creditsRemaining > 0) {
      return { allowed: true, creditsRemaining: ent.creditsRemaining, unlimited: false };
    }

    return {
      allowed: false,
      creditsRemaining: 0,
      unlimited: false,
      reason:
        ent.tier === 'FREE'
          ? `You have used all 3 monthly AI credits on Free. Upgrade to Pro (50 credits) or Business (Unlimited) to continue using ${featureName}.`
          : `You have used all 50 Pro AI credits for this month. Upgrade to Business for unlimited AI generations.`,
    };
  }

  /**
   * Optimistically decrement 1 AI credit on client side
   */
  public consumeAiCreditLocal(): void {
    const ent = this.getEntitlements();
    if (ent.unlimitedAi || ent.tier === 'BUSINESS') return;

    const newRemaining = Math.max(0, ent.creditsRemaining - 1);
    const newUsed = ent.creditsUsed + 1;

    billingService.saveEntitlements({
      creditsRemaining: newRemaining,
      creditsUsed: newUsed,
    });

    this.notify();
  }

  /**
   * Record that a document was created
   */
  public recordDocumentCreated(): void {
    const ent = this.getEntitlements();
    const newCount = ent.documentsCreatedThisMonth + 1;
    billingService.saveEntitlements({
      documentsCreatedThisMonth: newCount,
    });

    // Notify backend silently with background retry
    fetchWithRetry('/api/usage/document-created', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': billingService.getUserId(),
      },
      timeoutMs: 20000,
      retries: 2,
      silent: true,
    }).catch(() => {});

    this.notify();
  }

  /**
   * Check if custom PDF Branding & Styling is allowed
   */
  public isCustomBrandingAllowed(): boolean {
    return this.isProOrHigher();
  }

  /**
   * Check if direct WhatsApp / Email sharing is allowed
   */
  public isDirectShareAllowed(): boolean {
    return this.isProOrHigher();
  }
}

export const entitlementManager = new EntitlementManager();
