import React, { useState } from 'react';
import {
  Check,
  Zap,
  Shield,
  Sparkles,
  X,
  CreditCard,
  RefreshCw,
  Award,
  Smartphone,
  ChevronRight,
  Clock,
  KeyRound,
  Lock,
  Unlock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { billingService, PRODUCTS, BillingProduct, SubscriptionTier } from '../services/billingService';
import { entitlementManager } from '../services/EntitlementManager';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerReason?: string;
  defaultTier?: SubscriptionTier;
  onSuccess?: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  triggerReason,
  defaultTier = 'PRO',
  onSuccess,
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [currency, setCurrency] = useState<'ZAR' | 'USD'>('ZAR');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isRedeemingPromo, setIsRedeemingPromo] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const proProduct = PRODUCTS.find((p) => p.tier === 'PRO' && p.period === billingPeriod) || PRODUCTS[0];
  const businessProduct = PRODUCTS.find((p) => p.tier === 'BUSINESS' && p.period === billingPeriod) || PRODUCTS[2];

  const handleDeveloperCodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promoCode.trim()) {
      setPromoFeedback({ type: 'error', text: 'Please enter a developer code or token.' });
      return;
    }

    setIsRedeemingPromo(true);
    setPromoFeedback(null);

    try {
      const res = await billingService.redeemDeveloperCode(promoCode.trim());
      if (res.success) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#F59E0B', '#38BDF8', '#10B981', '#FFFFFF'],
        });

        setPromoFeedback({
          type: 'success',
          text: 'Developer Code Accepted (NismoR34)! Lifetime Unlimited Business Tier & AI Unlocked.',
        });

        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1800);
      } else {
        setPromoFeedback({
          type: 'error',
          text: res.message || 'Invalid developer password or token.',
        });
      }
    } catch (err: any) {
      setPromoFeedback({
        type: 'error',
        text: err?.message || 'Failed to verify developer code. Check connection.',
      });
    } finally {
      setIsRedeemingPromo(false);
    }
  };

  const handlePurchase = async (product: BillingProduct) => {
    setIsProcessing(true);
    setFeedbackMessage(null);

    try {
      const result = await billingService.purchase(product.id);
      if (result.success) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });

        setFeedbackMessage({
          type: 'success',
          text: result.message || `Welcome to ${product.title}!`,
        });

        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1800);
      } else {
        setFeedbackMessage({
          type: 'error',
          text: result.message || 'Payment could not be completed. Please try again.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'An error occurred during checkout.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setFeedbackMessage(null);

    try {
      const result = await billingService.restorePurchases();
      if (result.success) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.5 },
        });
        setFeedbackMessage({
          type: 'success',
          text: result.message,
        });
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setFeedbackMessage({
          type: 'error',
          text: result.message,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: 'Failed to restore purchases. Please check your network connection.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
      <div
        id="paywall-modal-container"
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8"
      >
        {/* Close Button */}
        <button
          id="paywall-close-button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Close Paywall"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-6 sm:p-8 text-slate-950">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 text-amber-400 font-bold text-xs tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Contractor Pro Plans
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-950/15 text-slate-950 border border-slate-950/20">
              Google Play & Web
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Scale Your Trade Business With Zero Limits
          </h2>
          <p className="mt-1 text-sm sm:text-base font-medium text-slate-900/90 max-w-2xl">
            {triggerReason ||
              'Unlimited invoices, quotes, stock tracking, and automated AI assistance engineered for electrical & HVAC pros.'}
          </p>

          {/* Billing Cycle & Currency Switcher */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-950/15">
            {/* Period Toggle */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-950/20 border border-slate-950/20 text-xs font-bold">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-slate-950 text-amber-400 shadow-sm'
                    : 'text-slate-950 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  billingPeriod === 'yearly'
                    ? 'bg-slate-950 text-amber-400 shadow-sm'
                    : 'text-slate-950 hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500 text-slate-950 font-black">
                  SAVE 20%
                </span>
              </button>
            </div>

            {/* Currency Selector */}
            <div className="flex items-center gap-1 text-xs font-bold text-slate-950">
              <span>Currency:</span>
              <button
                type="button"
                onClick={() => setCurrency('ZAR')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  currency === 'ZAR' ? 'bg-slate-950 text-amber-400 font-extrabold' : 'hover:bg-slate-950/10'
                }`}
              >
                ZAR (R)
              </button>
              <span className="opacity-40">|</span>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  currency === 'USD' ? 'bg-slate-950 text-amber-400 font-extrabold' : 'hover:bg-slate-950/10'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`mx-6 mt-4 p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <X className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Free Plan Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-200">Free Tier</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">Starter</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">For casual trade estimates and testing.</p>

              <div className="mt-4 mb-5">
                <div className="text-2xl font-black text-white">Free Forever</div>
                <div className="text-xs text-slate-500">No credit card required</div>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Max 5 Invoices & Quotes / month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Up to 20 Local Inventory Items</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Standard PDF Export Template</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>3 AI Assistant credits / month</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <button
                type="button"
                disabled
                className="w-full py-2.5 rounded-lg border border-slate-700 bg-slate-800/40 text-slate-400 text-xs font-semibold cursor-default text-center"
              >
                Current Default Plan
              </button>
            </div>
          </div>

          {/* 2. PRO CONTRACTOR (Highlighted) */}
          <div className="relative rounded-xl border-2 border-amber-500 bg-gradient-to-b from-slate-850 to-slate-900 p-5 flex flex-col justify-between shadow-xl shadow-amber-500/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-md">
              ★ Most Popular
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-amber-400">Pro Contractor</h3>
                <Award className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-xs text-slate-400 mt-1">For active solo contractors & technicians.</p>

              <div className="mt-4 mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">
                    {currency === 'ZAR' ? proProduct.formattedPriceZar.split(' ')[0] : proProduct.formattedPriceUsd.split(' ')[0]}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    /{billingPeriod === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingPeriod === 'yearly' && (
                  <div className="text-xs text-emerald-400 font-semibold mt-0.5">
                    Includes 2 Months Free
                  </div>
                )}
              </div>

              <ul className="space-y-2.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold text-white">Unlimited Invoices, Quotes & Estimates</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Unlimited Inventory with Low Stock Alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Custom PDF Branding & Company Logo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Direct WhatsApp & Email PDF Dispatch</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>50 AI Generation Credits / month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>14-Day Offline Job Site Grace Period</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <button
                id="buy-pro-plan-button"
                type="button"
                disabled={isProcessing}
                onClick={() => handlePurchase(proProduct)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Activating...</span>
                  </>
                ) : (
                  <>
                    <span>Upgrade to Pro</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3. BUSINESS / AI TIER */}
          <div className="rounded-xl border border-sky-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-sky-400">Business AI</h3>
                <Zap className="w-5 h-5 text-sky-400" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Full automated AI workflow for trade masters.</p>

              <div className="mt-4 mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">
                    {currency === 'ZAR'
                      ? businessProduct.formattedPriceZar.split(' ')[0]
                      : businessProduct.formattedPriceUsd.split(' ')[0]}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    /{billingPeriod === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingPeriod === 'yearly' && (
                  <div className="text-xs text-emerald-400 font-semibold mt-0.5">
                    Save R598 / $40.88 Annually
                  </div>
                )}
              </div>

              <ul className="space-y-2.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-semibold text-white">Everything in Pro Plan</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-bold text-sky-300">Unlimited Voice-to-Quote Generations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-bold text-sky-300">Unlimited Receipt OCR Camera Scans</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>AI Job Cost & Scope Estimator</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Multi-Device Sync & Cloud Backup</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Priority 24/7 Contractor Support</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <button
                id="buy-business-plan-button"
                type="button"
                disabled={isProcessing}
                onClick={() => handlePurchase(businessProduct)}
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-sky-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Activating...</span>
                  </>
                ) : (
                  <>
                    <span>Get Business AI</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Developer Token / Promo Code Unlock Card */}
        <div className="mx-6 sm:mx-8 mb-6 p-4 rounded-xl bg-slate-950/70 border border-amber-500/30">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <span>Developer Token / Master Bypass</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-mono">
                    Dev Access
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Enter your developer token password for instant unlimited free access to all features.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleDeveloperCodeSubmit}
              className="w-full md:w-auto flex items-center gap-2"
            >
              <input
                id="developer-token-input"
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Password (e.g. NismoR34)"
                className="flex-1 md:w-56 px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
              <button
                id="apply-developer-token-button"
                type="submit"
                disabled={isRedeemingPromo || !promoCode.trim()}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {isRedeemingPromo ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
                <span>Unlock Free</span>
              </button>
            </form>
          </div>

          {promoFeedback && (
            <div
              id="developer-token-feedback"
              className={`mt-3 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                promoFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
              }`}
            >
              {promoFeedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{promoFeedback.text}</span>
            </div>
          )}
        </div>

        {/* Footer Guarantees & Restore Purchases */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>14-Day Offline Grace Period</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>Google Play & Web Compatible</span>
            </div>
          </div>

          <button
            id="paywall-restore-purchases-button"
            type="button"
            disabled={isRestoring}
            onClick={handleRestore}
            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
            <span>Restore Purchases</span>
          </button>
        </div>
      </div>
    </div>
  );
};
