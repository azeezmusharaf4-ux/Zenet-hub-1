import React from 'react';
import { 
  ArrowLeft, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  Phone, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  HelpCircle, 
  Mail,
  Zap
} from 'lucide-react';
import { ActiveAppView } from '../types';

interface RefundPolicyViewProps {
  onBackToMarketplace?: () => void;
  onSelectView?: (view: ActiveAppView) => void;
}

export const RefundPolicyView: React.FC<RefundPolicyViewProps> = ({
  onBackToMarketplace,
  onSelectView
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10 animate-in fade-in duration-200 pb-28 md:pb-16 text-[#0F172A]">
      {/* Top Navigation - Step 1 */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#EAE6F8] zenet-stagger-item zenet-stagger-1">
        <button
          onClick={onBackToMarketplace}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5B4DF5] hover:text-[#4338CA] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] bg-[#F1EEFC] px-3 py-1 rounded-full">
          Customer Protection
        </span>
      </div>

      {/* Header Banner - Step 2 */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE6F8] shadow-xs mb-8 zenet-stagger-item zenet-stagger-2">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#5B4DF5] flex items-center justify-center shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight mb-2">
              Refund & Warranty Policy
            </h1>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Last updated: October 2026. At ZENET HUB, customer satisfaction and fair transactions are our highest priorities. Learn how our automated refund systems and warranty protections work.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Step 3 */}
      <div className="bg-white rounded-2xl p-6 sm:p-10 border border-[#EAE6F8] shadow-xs space-y-8 text-sm leading-relaxed text-slate-700 zenet-stagger-item zenet-stagger-3">

        
        {/* Section 1 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">1.</span> Overview & Escrow Principle
          </h2>
          <p>
            ZENET HUB operates with escrow protections across our digital catalogue. Funds deducted for orders are held securely until the digital product or service is delivered successfully. In the event of non-delivery, technical failure, or unfulfilled orders, our platform is designed to refund 100% of the affected amount directly to your ZENET HUB wallet.
          </p>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">2.</span> Virtual Phone Numbers (SMS Verification) Policy
          </h2>
          <div className="bg-emerald-50 border border-emerald-200/80 p-5 rounded-2xl mb-4 text-emerald-950">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-emerald-900 mb-1">
                  Automated Zero-Risk Guarantee
                </h4>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  When you purchase an international virtual number for SMS verification:
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs text-emerald-800 mt-2 pl-1">
                  <li><strong>No SMS Received:</strong> If the provider network does not deliver an SMS verification code before the activation countdown timer expires, the full order price is <strong>automatically credited back to your wallet</strong> immediately.</li>
                  <li><strong>Manual Cancellation:</strong> If you cancel an active virtual number before any SMS code is received, your wallet is <strong>instantly refunded in full</strong>.</li>
                  <li><strong>No Manual Review Required:</strong> You do not need to contact support or wait for approval—our backend processes SMS refunds in real time.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">3.</span> Digital Accounts & Product Warranty
          </h2>
          <p className="mb-3">
            Digital account listings (e.g. aged social media accounts, PVA profiles, and monetization-ready pages) include a dedicated warranty period specified on the product page (commonly 7 or 14 days):
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 mb-3 text-xs text-slate-700">
            <p><strong>Initial Check Guarantee:</strong> Buyers must check delivered account credentials upon purchase. If credentials (username/password/2FA) do not allow valid login upon initial delivery, report it immediately via the Help & Support desk.</p>
            <p><strong>Replacement or Refund:</strong> If verified non-functional by our review system within the warranty window, the seller or platform must provide a verified replacement or issue a full refund to your wallet balance.</p>
            <p><strong>Exclusions:</strong> Warranty does not cover issues arising from buyer actions that violate social platform terms of service (such as mass spamming, changing recovery emails without guidance, or engaging in suspicious network activity after successful delivery).</p>
          </div>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">4.</span> Social Media Boosting Services
          </h2>
          <p className="mb-2">
            Social media growth and engagement services (views, followers, likes, comments) are processed through automated provider networks:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 mb-3">
            <li><strong>Partial or Canceled Orders:</strong> If an order is canceled or partially completed by the provider network, the unfulfilled quantity is automatically calculated and refunded back to your wallet.</li>
            <li><strong>Private or Invalid Links:</strong> Ensure that profiles, channels, or posts are set to <strong>Public</strong> before placing an order. Orders submitted with private, broken, or restricted links may fail and can be resubmitted after correcting the target.</li>
            <li><strong>Refill Guarantee:</strong> Services marked with a refill icon (♻️) include drop protection for the specified refill duration.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">5.</span> Wallet Deposits & Balances
          </h2>
          <p>
            Wallet deposits are credited to your ZENET HUB account balance upon successful confirmation by Paystack. Since deposits are intended for instant purchasing across all marketplace services, funds remain permanently stored in your digital wallet until used.
          </p>
        </section>

        {/* Section 6 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">6.</span> How to Request Assistance or File a Dispute
          </h2>
          <p className="mb-3">
            If you encounter any issue requiring manual inspection or resolution, follow these simple steps:
          </p>
          <ol className="list-decimal list-inside space-y-2 pl-2 text-slate-700 mb-4">
            <li>Navigate to the <strong className="text-slate-900">Help & Support</strong> section on the website.</li>
            <li>Click <strong className="text-slate-900">Open Support Ticket</strong> and select the relevant category (e.g. Order Dispute, Product Issue, or Delivery).</li>
            <li>Provide your <strong className="text-slate-900">Order ID</strong> and a concise description of the issue.</li>
            <li>Our administrative team will review the transaction logs and respond with resolution options.</li>
          </ol>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
            <p><strong>Official Support Email:</strong> <a href="mailto:Zenethubifficial@gmail.com" className="text-[#5B4DF5] hover:underline">Zenethubifficial@gmail.com</a></p>
            <p><strong>Platform:</strong> ZENET HUB (<a href="https://zenet-hub.com.ng" className="text-[#5B4DF5] hover:underline">https://zenet-hub.com.ng</a>)</p>
          </div>
        </section>
      </div>

      {/* Bottom Action */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={onBackToMarketplace}
          className="px-6 py-3 rounded-xl bg-[#5B4DF5] hover:bg-[#4d4df0] text-white font-bold text-sm shadow-sm transition cursor-pointer"
        >
          Return to Marketplace
        </button>
      </div>
    </div>
  );
};
