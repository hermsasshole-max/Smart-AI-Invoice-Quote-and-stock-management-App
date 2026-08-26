import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

export type SubscriptionTier = 'FREE' | 'PRO' | 'BUSINESS';

export interface TierEntitlements {
  maxMonthlyDocuments: number; // Invoices + Quotes
  maxInventoryItems: number;
  monthlyAiCredits: number;
  customPdfBranding: boolean;
  directShareDelivery: boolean;
  unlimitedAi: boolean;
  cloudSync: boolean;
  priceZarMonthly: number;
  priceUsdMonthly: number;
}

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierEntitlements> = {
  FREE: {
    maxMonthlyDocuments: 5,
    maxInventoryItems: 20,
    monthlyAiCredits: 3,
    customPdfBranding: false,
    directShareDelivery: false,
    unlimitedAi: false,
    cloudSync: false,
    priceZarMonthly: 0,
    priceUsdMonthly: 0,
  },
  PRO: {
    maxMonthlyDocuments: Infinity,
    maxInventoryItems: Infinity,
    monthlyAiCredits: 50,
    customPdfBranding: true,
    directShareDelivery: true,
    unlimitedAi: false,
    cloudSync: false,
    priceZarMonthly: 149,
    priceUsdMonthly: 9.99,
  },
  BUSINESS: {
    maxMonthlyDocuments: Infinity,
    maxInventoryItems: Infinity,
    monthlyAiCredits: Infinity,
    customPdfBranding: true,
    directShareDelivery: true,
    unlimitedAi: true,
    cloudSync: true,
    priceZarMonthly: 299,
    priceUsdMonthly: 19.99,
  },
};

export interface UserSubscriptionRecord {
  userId: string;
  tier: SubscriptionTier;
  status: 'active' | 'cancelled' | 'expired' | 'grace_period';
  billingCycle: string; // YYYY-MM
  aiCreditsUsed: number;
  aiCreditsBonus: number;
  documentsCreatedThisMonth: number;
  subscriptionExpiresAt?: string;
  source?: 'google_play' | 'revenuecat' | 'stripe' | 'manual';
  originalPurchaseDate?: string;
  lastVerifiedAt: string;
}

// Persistent File-Backed Store with Atomic Writes & In-Memory Cache
const DATA_DIR = path.join(process.cwd(), 'data');
const USAGE_FILE = path.join(DATA_DIR, 'user-usage-store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class UsageStore {
  private cache: Map<string, UserSubscriptionRecord> = new Map();
  private isLoaded = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const raw = fs.readFileSync(USAGE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        for (const [key, val] of Object.entries(data)) {
          this.cache.set(key, val as UserSubscriptionRecord);
        }
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('[UsageStore] Failed to load store file, starting fresh cache:', err);
      this.isLoaded = true;
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.flushToDisk();
    }, 500);
  }

  public flushToDisk() {
    try {
      const obj: Record<string, UserSubscriptionRecord> = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      const tmpFile = `${USAGE_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), 'utf-8');
      fs.renameSync(tmpFile, USAGE_FILE);
    } catch (err) {
      console.error('[UsageStore] Failed to write usage store to disk:', err);
    }
  }

  private getCurrentCycle(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  public getUserRecord(userId: string): UserSubscriptionRecord {
    const currentCycle = this.getCurrentCycle();
    let record = this.cache.get(userId);

    if (!record) {
      record = {
        userId,
        tier: 'FREE',
        status: 'active',
        billingCycle: currentCycle,
        aiCreditsUsed: 0,
        aiCreditsBonus: 0,
        documentsCreatedThisMonth: 0,
        lastVerifiedAt: new Date().toISOString(),
      };
      this.cache.set(userId, record);
      this.scheduleSave();
      return record;
    }

    // Auto-rollover on new calendar month
    if (record.billingCycle !== currentCycle) {
      record.billingCycle = currentCycle;
      record.aiCreditsUsed = 0;
      record.documentsCreatedThisMonth = 0;
      record.lastVerifiedAt = new Date().toISOString();
      this.cache.set(userId, record);
      this.scheduleSave();
    }

    return record;
  }

  public updateUserTier(
    userId: string,
    tier: SubscriptionTier,
    expiresAt?: string,
    source: 'google_play' | 'revenuecat' | 'stripe' | 'manual' = 'manual'
  ): UserSubscriptionRecord {
    const record = this.getUserRecord(userId);
    record.tier = tier;
    record.status = 'active';
    record.subscriptionExpiresAt = expiresAt;
    record.source = source;
    record.lastVerifiedAt = new Date().toISOString();
    this.cache.set(userId, record);
    this.scheduleSave();
    return record;
  }

  /**
   * Atomic AI credit check and decrement ($inc: -1)
   */
  public consumeAiCredit(userId: string, amount: number = 1): { success: boolean; record: UserSubscriptionRecord; remaining: number } {
    const record = this.getUserRecord(userId);
    const tierConfig = TIER_DEFINITIONS[record.tier];

    // Business tier has unlimited AI generations
    if (tierConfig.unlimitedAi) {
      record.aiCreditsUsed += amount;
      record.lastVerifiedAt = new Date().toISOString();
      this.cache.set(userId, record);
      this.scheduleSave();
      return { success: true, record, remaining: Infinity };
    }

    const totalAllowed = tierConfig.monthlyAiCredits + record.aiCreditsBonus;
    const remaining = totalAllowed - record.aiCreditsUsed;

    if (remaining < amount) {
      return { success: false, record, remaining: Math.max(0, remaining) };
    }

    // Atomic increment
    record.aiCreditsUsed += amount;
    record.lastVerifiedAt = new Date().toISOString();
    this.cache.set(userId, record);
    this.scheduleSave();

    return {
      success: true,
      record,
      remaining: Math.max(0, totalAllowed - record.aiCreditsUsed),
    };
  }

  public incrementDocumentCount(userId: string): { success: boolean; record: UserSubscriptionRecord; allowed: boolean } {
    const record = this.getUserRecord(userId);
    const tierConfig = TIER_DEFINITIONS[record.tier];

    if (record.documentsCreatedThisMonth >= tierConfig.maxMonthlyDocuments) {
      return { success: false, record, allowed: false };
    }

    record.documentsCreatedThisMonth += 1;
    record.lastVerifiedAt = new Date().toISOString();
    this.cache.set(userId, record);
    this.scheduleSave();

    return { success: true, record, allowed: true };
  }
}

export const usageStore = new UsageStore();

/**
 * Extract User Identifier from Headers or Body
 */
export function extractUserId(req: Request): string {
  const customId = req.headers['x-user-id'] || req.headers['x-device-id'] || req.query.userId || req.body?.userId;
  if (typeof customId === 'string' && customId.trim().length > 0) {
    return customId.trim();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token.length > 5) {
      return `user_${token.slice(-12)}`;
    }
  }

  // Fallback to client IP or default contractor device identifier
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'default_contractor';
  return `contractor_${String(ip).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`;
}

/**
 * EXPRESS MIDDLEWARE: Require AI Credit before calling Gemini API
 * Returns standard JSON on failure: { "error": "LIMIT_REACHED", "tier": "FREE", "upgradeRequired": true }
 */
export function requireAiCredit(featureName: string = 'ai_assistant') {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = extractUserId(req);
    const result = usageStore.consumeAiCredit(userId, 1);

    if (!result.success) {
      const now = new Date();
      // Calculate start of next month for reset date
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      console.warn(`[UsageMeter] Blocked AI request for user=${userId} (Tier=${result.record.tier}). Limits reached.`);

      return res.status(402).json({
        error: 'LIMIT_REACHED',
        tier: result.record.tier,
        upgradeRequired: true,
        feature: featureName,
        message:
          result.record.tier === 'FREE'
            ? 'You have used all 3 free monthly AI credits. Upgrade to Pro (50 credits) or Business (Unlimited) to continue.'
            : 'You have used your 50 Pro AI credits for this billing period. Upgrade to Business for unlimited AI generations.',
        creditsRemaining: 0,
        creditsUsed: result.record.aiCreditsUsed,
        tierLimit: TIER_DEFINITIONS[result.record.tier].monthlyAiCredits,
        resetDate: nextMonth.toISOString(),
      });
    }

    // Attach metering context to request object
    (req as any).metering = {
      userId,
      tier: result.record.tier,
      creditsRemaining: result.remaining,
    };

    next();
  };
}

/**
 * EXPRESS MIDDLEWARE: Require Minimum Tier for Gated Endpoints
 */
export function requireTier(minimumTier: SubscriptionTier) {
  const tierWeight: Record<SubscriptionTier, number> = {
    FREE: 0,
    PRO: 1,
    BUSINESS: 2,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = extractUserId(req);
    const record = usageStore.getUserRecord(userId);

    if (tierWeight[record.tier] < tierWeight[minimumTier]) {
      return res.status(403).json({
        error: 'TIER_UPGRADE_REQUIRED',
        currentTier: record.tier,
        requiredTier: minimumTier,
        upgradeRequired: true,
        message: `This feature requires a ${minimumTier} subscription plan.`,
      });
    }

    next();
  };
}
