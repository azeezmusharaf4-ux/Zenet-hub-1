import React from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  Phone, 
  TrendingUp, 
  Package, 
  Wrench, 
  Users, 
  CheckCircle2, 
  Mail, 
  MessageCircle, 
  Zap, 
  Lock, 
  Globe2,
  ChevronRight
} from 'lucide-react';
import { ActiveAppView } from '../types';

interface AboutViewProps {
  onBackToMarketplace?: () => void;
  onSelectView?: (view: ActiveAppView) => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const AboutView: React.FC<AboutViewProps> = ({
  onBackToMarketplace,
  onSelectView
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10 animate-in fade-in duration-200 pb-28 md:pb-16 text-[#0F172A]">
      {/* Top Navigation / Breadcrumb - Step 1 */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#EAE6F8] zenet-stagger-item zenet-stagger-1">
        <button
          onClick={onBackToMarketplace}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5B4DF5] hover:text-[#4338CA] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] bg-[#F1EEFC] px-3 py-1 rounded-full">
          About Zenet Hub
        </span>
      </div>

      {/* Hero Header - Step 2 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5B4DF5] via-[#4F46E5] to-[#3730A3] text-white p-6 sm:p-10 mb-8 shadow-lg shadow-indigo-500/15 zenet-stagger-item zenet-stagger-2">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold tracking-wide uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Digital Services Marketplace
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4 leading-tight">
            Discover & Purchase Digital Solutions with Confidence
          </h1>
          <p className="text-base sm:text-lg text-indigo-100 font-normal leading-relaxed">
            Zenet Hub is a digital services marketplace where users can discover and purchase digital products and services. We aim to provide a simple, convenient, and user-friendly platform where customers can explore our services and access digital solutions.
          </p>
        </div>
        {/* Subtle decorative circles */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-20 top-0 w-48 h-48 bg-purple-400/20 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* Our Services Section */}
      <div className="mb-12">
        {/* Services Heading - Step 3 */}
        <div className="text-center max-w-xl mx-auto mb-8 zenet-stagger-item zenet-stagger-3">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] mb-2">
            Our Core Services
          </h2>
          <p className="text-sm text-[#64748B]">
            Explore the comprehensive digital products and solutions available on Zenet Hub.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Digital Account Services - Step 4 */}
          <div 
            onClick={() => onSelectView?.('log-accounts')}
            className="group bg-white rounded-2xl p-6 border border-[#EAE6F8] hover:border-[#5B4DF5]/40 hover:shadow-md hover:shadow-indigo-500/5 transition cursor-pointer flex flex-col justify-between zenet-stagger-item zenet-stagger-4"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#5B4DF5] flex items-center justify-center mb-4 group-hover:bg-[#5B4DF5] group-hover:text-white transition">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2 group-hover:text-[#5B4DF5] transition">
                Digital Account Services
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Discover aged, phone-verified (PVA), monetization-ready, and 2FA-secured digital accounts across all major social media platforms.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#5B4DF5]">
              <span>Explore Accounts</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* 2. Virtual Phone Numbers - Step 5 */}
          <div 
            onClick={() => onSelectView?.('virtual-numbers')}
            className="group bg-white rounded-2xl p-6 border border-[#EAE6F8] hover:border-[#5B4DF5]/40 hover:shadow-md hover:shadow-indigo-500/5 transition cursor-pointer flex flex-col justify-between zenet-stagger-item zenet-stagger-5"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2 group-hover:text-emerald-600 transition">
                Virtual Phone Numbers
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Instant SMS verification phone numbers from different countries worldwide with automated OTP delivery and auto-refund guarantee.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600">
              <span>Get Virtual Numbers</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* 3. Social Media Growth & Boosting - Step 6 */}
          <div 
            onClick={() => onSelectView?.('social-boost')}
            className="group bg-white rounded-2xl p-6 border border-[#EAE6F8] hover:border-[#5B4DF5]/40 hover:shadow-md hover:shadow-indigo-500/5 transition cursor-pointer flex flex-col justify-between zenet-stagger-item zenet-stagger-6"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center mb-4 group-hover:bg-pink-600 group-hover:text-white transition">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2 group-hover:text-pink-600 transition">
                Social Media Growth & Boosting
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                High-quality social media engagement, followers, views, likes, comments, and stream metrics across TikTok, Instagram, YouTube, Telegram, and more.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-pink-600">
              <span>Boost Your Channels</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* 4. Digital Tools & Online Services - Step 7 */}
          <div 
            onClick={() => onSelectView?.('marketplace')}
            className="group bg-white rounded-2xl p-6 border border-[#EAE6F8] hover:border-[#5B4DF5]/40 hover:shadow-md hover:shadow-indigo-500/5 transition cursor-pointer flex flex-col justify-between zenet-stagger-item zenet-stagger-7"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2 group-hover:text-blue-600 transition">
                Digital Tools & Online Services
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Streamlined utilities and digital tools designed to accelerate your online workflow, business operations, and digital communication.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
              <span>View Tools</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* 5. Digital Products & Useful Updates - Step 8 */}
          <div 
            onClick={() => onSelectView?.('zened-update')}
            className="group bg-white rounded-2xl p-6 border border-[#EAE6F8] hover:border-[#5B4DF5]/40 hover:shadow-md hover:shadow-indigo-500/5 transition cursor-pointer flex flex-col justify-between md:col-span-2 lg:col-span-2 zenet-stagger-item zenet-stagger-8"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2 group-hover:text-amber-600 transition">
                Digital Products & Useful Updates
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Exclusive digital products, verified guides, tools, and timely updates tailored for creators, marketers, and businesses seeking digital excellence.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-600">
              <span>Explore Zenet Updates</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </div>
      </div>

      {/* Why Choose Zenet Hub - Step 9 */}
      <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-[#EAE6F8] mb-12 zenet-stagger-item zenet-stagger-9">
        <h2 className="text-xl font-extrabold text-[#0F172A] mb-6 text-center">
          Our Commitment to You
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-[#0F172A] mb-1">Instant Automated Delivery</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Real-time service routing delivers verification codes, boosts, and credentials immediately upon purchase.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-[#5B4DF5] flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-[#0F172A] mb-1">Escrow & Buyer Protection</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Every order is protected by our transparent escrow mechanism and verified replacement/refund policies.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-[#0F172A] mb-1">Bank-Grade Payment Security</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Deposits are processed securely via Paystack with encrypted endpoints, card protection, and instant wallet credit.
            </p>
          </div>
        </div>
      </div>

      {/* Contact & Support Callout - Step 10 */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE6F8] flex flex-col md:flex-row items-center justify-between gap-6 zenet-stagger-item zenet-stagger-10">
        <div>
          <h3 className="text-lg font-bold text-[#0F172A] mb-1">
            Have questions or need assistance?
          </h3>
          <p className="text-sm text-[#64748B]">
            Our support team is always ready to assist with orders, inquiries, and technical help.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[#64748B]">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Mail className="w-4 h-4 text-[#5B4DF5]" />
              Zenethubifficial@gmail.com
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Globe2 className="w-4 h-4 text-emerald-600" />
              https://zenet-hub.com.ng
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => onSelectView?.('support')}
            className="flex-1 md:flex-initial px-5 py-3 rounded-xl bg-[#5B4DF5] hover:bg-[#4d4df0] text-white text-sm font-bold shadow-sm transition cursor-pointer text-center"
          >
            Help & Support Desk
          </button>
          <a
            href="https://wa.me/2347065096590"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition cursor-pointer text-center inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};
