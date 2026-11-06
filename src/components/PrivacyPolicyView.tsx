import React from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Lock, 
  Eye, 
  Database, 
  Bell, 
  CheckCircle2, 
  Mail, 
  FileText
} from 'lucide-react';
import { ActiveAppView } from '../types';

interface PrivacyPolicyViewProps {
  onBackToMarketplace?: () => void;
  onSelectView?: (view: ActiveAppView) => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({
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
          Privacy & Security
        </span>
      </div>

      {/* Header Banner - Step 2 */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE6F8] shadow-xs mb-8 zenet-stagger-item zenet-stagger-2">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#5B4DF5] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight mb-2">
              Privacy Policy
            </h1>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Last updated: October 2026. This Privacy Policy describes how ZENET HUB collects, uses, and safeguards your personal information when you use our website (<span className="font-semibold text-slate-800">https://zenet-hub.com.ng</span>) and digital services.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Step 3 */}
      <div className="bg-white rounded-2xl p-6 sm:p-10 border border-[#EAE6F8] shadow-xs space-y-8 text-sm leading-relaxed text-slate-700 zenet-stagger-item zenet-stagger-3">

        
        {/* Section 1 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">1.</span> Our Privacy Commitment
          </h2>
          <p>
            At ZENET HUB, we respect your privacy and are committed to protecting the personal data you share with us. We do not sell, rent, or trade your personal information to third parties for marketing purposes. All data collection is strictly limited to what is necessary to operate our marketplace, fulfill digital orders, and secure your account.
          </p>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">2.</span> Information We Collect
          </h2>
          <p className="mb-2">We collect information that you directly provide to us, including:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 mb-3">
            <li><strong className="text-slate-800">Account Credentials:</strong> Full name, verified email address, phone number, and encrypted password.</li>
            <li><strong className="text-slate-800">Wallet & Transaction Records:</strong> Deposit references, purchase history, order timestamps, and wallet balance.</li>
            <li><strong className="text-slate-800">Service Interactions:</strong> Selected virtual number orders, social boost target links, and support tickets.</li>
            <li><strong className="text-slate-800">Technical Device Data:</strong> IP address, browser type, and access timestamps used strictly for security monitoring and fraud prevention.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">3.</span> How We Use Your Information
          </h2>
          <p className="mb-2">Your information is used exclusively to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
            <li>Create, authenticate, and maintain your ZENET HUB user account.</li>
            <li>Process payments, wallet top-ups, and automate service delivery.</li>
            <li>Dispatch transactional email notifications directly to your verified email (welcome messages, login security alerts, deposit confirmations, OTP arrivals, and refund receipts).</li>
            <li>Deliver responsive customer support through our ticket center.</li>
            <li>Detect and prevent fraudulent activities, duplicate referrals, or unauthorized account access.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">4.</span> Payment Security & Gateway Compliance
          </h2>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 mb-3">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>Zero Card Storage Policy:</strong> All payment transactions are executed through Paystack, a certified PCI-DSS compliant payment processor. ZENET HUB never sees, receives, or stores your credit/debit card numbers or bank PINs on its infrastructure.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">5.</span> Data Storage & Infrastructure Security
          </h2>
          <p>
            ZENET HUB utilizes Google Cloud Firestore and Firebase Authentication with enterprise-grade encryption at rest and in transit (TLS/SSL). Role-based access control (RBAC) security rules strictly prevent unauthorized users from viewing or altering your private wallet balances, credentials, or personal transaction logs.
          </p>
        </section>

        {/* Section 6 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">6.</span> Third-Party Service Providers
          </h2>
          <p className="mb-2">
            We only integrate with essential, verified infrastructure providers required for service delivery:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
            <li><strong>Paystack:</strong> Secure deposit processing and card tokenization.</li>
            <li><strong>Google Firebase:</strong> Cloud database storage and user authentication.</li>
            <li><strong>Google SMTP:</strong> Reliable transactional email delivery to your inbox.</li>
            <li><strong>Verified Telecom & SMM Gateways:</strong> Automated real-time routing for virtual numbers and growth metrics.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">7.</span> Your Privacy Rights & Data Control
          </h2>
          <p className="mb-2">As a registered user, you have the right to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
            <li>Access and update your profile information and password at any time via your Account Profile.</li>
            <li>Request a full review or export of your transaction history.</li>
            <li>Submit an account closure or deletion request by contacting our support team.</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="text-[#5B4DF5]">8.</span> Privacy Inquiries & Contact
          </h2>
          <p className="mb-3">
            If you have questions, concerns, or requests regarding this Privacy Policy, please reach out to our privacy team:
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
            <p><strong>Platform:</strong> ZENET HUB (<a href="https://zenet-hub.com.ng" className="text-[#5B4DF5] hover:underline">https://zenet-hub.com.ng</a>)</p>
            <p><strong>Official Contact Email:</strong> <a href="mailto:Zenethubifficial@gmail.com" className="text-[#5B4DF5] hover:underline">Zenethubifficial@gmail.com</a></p>
            <p><strong>Response Time:</strong> Our privacy and compliance team typically responds within 24 hours.</p>
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
