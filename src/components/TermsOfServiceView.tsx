import React from 'react';
import { 
  ArrowLeft, 
  FileText, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Mail, 
  HelpCircle,
  Lock
} from 'lucide-react';
import { ActiveAppView } from '../types';

interface TermsOfServiceViewProps {
  onBackToMarketplace?: () => void;
  onSelectView?: (view: ActiveAppView) => void;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({
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
          Legal Agreement
        </span>
      </div>

      {/* Header Banner - Step 2 */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE6F8] shadow-xs mb-8 zenet-stagger-item zenet-stagger-2">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#5B4DF5] flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight mb-2">
              Terms of Service
            </h1>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Last updated: October 2026. Please read these Terms of Service carefully before registering, depositing, or purchasing any services on ZENET HUB.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Step 3 */}
      <div className="bg-white rounded-2xl p-6 sm:p-10 border border-[#EAE6F8] shadow-xs space-y-8 text-sm leading-relaxed text-slate-700 zenet-stagger-item zenet-stagger-3">

        
        {/* Section 1 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">1.</span> Acceptance of Terms
          </h2>
          <p>
            By accessing or using ZENET HUB (<span className="font-semibold text-slate-900">https://zenet-hub.com.ng</span>), creating an account, depositing funds, or ordering services, you agree to be legally bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, you must not access or use our platform.
          </p>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">2.</span> Marketplace Scope & Digital Services
          </h2>
          <p className="mb-2">
            ZENET HUB operates as an online digital marketplace providing access to digital solutions, including:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 mb-3">
            <li><strong className="text-slate-800">Digital Account Services:</strong> Social media accounts, aged profiles, PVA assets, and creator pages.</li>
            <li><strong className="text-slate-800">Virtual Phone Numbers:</strong> Disposable and activation numbers from multiple countries for SMS verification and OTP receipt.</li>
            <li><strong className="text-slate-800">Social Media Growth & Boosting:</strong> Automated promotional engagement and distribution services.</li>
            <li><strong className="text-slate-800">Digital Tools & Online Utilities:</strong> Specialized software tools, updates, and online resources.</li>
          </ul>
          <p>
            ZENET HUB connects buyers with digital resources through automated delivery systems and strict escrow controls to guarantee delivery integrity.
          </p>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">3.</span> User Registration & Account Security
          </h2>
          <p className="mb-2">
            To make purchases or fund a balance, you must register an account using a valid, verified email address. You agree to:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
            <li>Provide accurate, truthful, and up-to-date contact details during registration.</li>
            <li>Maintain the confidentiality of your account credentials and password.</li>
            <li>Accept full responsibility for all activities conducted under your registered account.</li>
            <li>Notify our support team immediately at <span className="font-semibold text-[#5B4DF5]">Zenethubifficial@gmail.com</span> if you suspect any unauthorized access.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">4.</span> Wallet, Deposits & Payment Terms
          </h2>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 mb-3">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-[#5B4DF5] mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed">
                All deposits are processed through certified, PCI-DSS compliant payment gateways (Paystack) with end-to-end encryption. ZENET HUB does not store your credit or debit card numbers on its servers.
              </p>
            </div>
          </div>
          <p className="mb-2">
            Deposited funds are credited to your ZENET HUB wallet balance in Nigerian Naira (₦). Wallet balances may be used across all marketplace services. You agree not to attempt fraudulent chargebacks or unauthorized payment reversals; any such attempt will result in immediate suspension and blacklisting of the offending account.
          </p>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">5.</span> Virtual Numbers & Automated SMS Refund Guarantee
          </h2>
          <div className="bg-emerald-50 border border-emerald-200/70 p-4 rounded-xl mb-3 text-emerald-900">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs font-medium leading-relaxed">
                <strong>Zero-Risk SMS Policy:</strong> If a purchased virtual number fails to receive the requested SMS verification code before the activation window expires, or if you cancel the number before receiving an SMS, 100% of the purchase amount is automatically refunded directly to your wallet balance.
              </p>
            </div>
          </div>
          <p>
            Virtual phone numbers are intended solely for legitimate online verification purposes. Using virtual numbers for illegal activities, spam, or malicious attacks is strictly prohibited.
          </p>
        </section>

        {/* Section 6 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">6.</span> Product Warranties & Replacement Policy
          </h2>
          <p className="mb-2">
            Digital account listings are covered under their individually designated warranty periods (e.g., 7 or 14 days, as stated on the product card). Buyers must inspect delivered account credentials upon receipt. If login credentials are non-functional upon initial delivery, buyers are eligible for an immediate replacement or full wallet refund via our Support desk.
          </p>
        </section>

        {/* Section 7 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">7.</span> Prohibited Activities
          </h2>
          <p className="mb-2">You agree NOT to use ZENET HUB to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
            <li>Engage in fraud, money laundering, identity theft, or deceptive practices.</li>
            <li>Interfere with or exploit platform vulnerabilities, rate limits, or automated APIs.</li>
            <li>Distribute malware, spam, phishing schemes, or malicious content.</li>
            <li>Harass, threaten, or defame other marketplace participants or staff members.</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">8.</span> Limitation of Liability
          </h2>
          <p>
            ZENET HUB provides services on an "as-is" and "as-available" basis. While we strive for 99.9% uptime and verified inventory, ZENET HUB shall not be liable for indirect, incidental, or consequential damages resulting from third-party social media platform policy updates, unexpected server downtime, or external network changes.
          </p>
        </section>

        {/* Section 9 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">9.</span> Contact & Dispute Inquiries
          </h2>
          <p className="mb-3">
            If you have questions regarding these Terms of Service or wish to file an inquiry, please contact our administrative team:
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
            <p><strong>Platform:</strong> ZENET HUB (<a href="https://zenet-hub.com.ng" className="text-[#5B4DF5] hover:underline">https://zenet-hub.com.ng</a>)</p>
            <p><strong>Official Support Email:</strong> <a href="mailto:Zenethubifficial@gmail.com" className="text-[#5B4DF5] hover:underline">Zenethubifficial@gmail.com</a></p>
            <p><strong>Support Ticket Desk:</strong> Accessible 24/7 in the Help & Support center.</p>
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
