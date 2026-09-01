import React, { useState } from 'react';
import { 
  Store, 
  ShieldCheck, 
  Wallet, 
  ShoppingBag, 
  Headphones, 
  ChevronDown, 
  Menu, 
  X, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Lock, 
  Bell, 
  Code,
  MessageCircle,
  Send
} from 'lucide-react';
import { AccountListing } from '../types';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onBrowseMarketplace: () => void;
  featuredListings?: AccountListing[];
  onSelectListing?: (listing: AccountListing) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onBrowseMarketplace,
  featuredListings = [],
  onSelectListing
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqItems = [
    {
      q: "What is ZENET HUB?",
      a: "ZENET HUB is a premium digital marketplace providing fast, verified, and automated digital products and services with dedicated escrow wallet protection."
    },
    {
      q: "How does the Dedicated Virtual Account funding work?",
      a: "When you register, ZENET HUB automatically assigns you a unique Paystack Dedicated Virtual Account. Any bank transfer you make to that account instantly credits your ZENET HUB wallet."
    },
    {
      q: "How fast are digital purchases delivered?",
      a: "Digital purchases and services on ZENET HUB are processed with instant automated delivery or rapid seller fulfillment, backed by escrow safety."
    },
    {
      q: "Is my payment and wallet balance safe?",
      a: "Yes! All payments are processed through PCI-DSS compliant Paystack encryption, and funds are safely held in your escrow wallet until orders are fulfilled."
    },
    {
      q: "Can I contact support if I have questions?",
      a: "Our customer support team is available 24/7 via live tickets, WhatsApp, and Telegram to assist you with any inquiries."
    }
  ];

  return (
    <div className="min-h-screen bg-[#070311] text-purple-100 font-sans selection:bg-purple-600 selection:text-white">
      
      {/* 1. TOP NAVIGATION */}
      <nav className="sticky top-0 z-50 bg-[#0d0718]/95 backdrop-blur-md border-b border-[#23123f] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-violet-600 to-indigo-600 p-0.5 shadow-lg shadow-purple-600/30">
              <div className="w-full h-full bg-[#0d0718] rounded-[14px] flex items-center justify-center">
                <Store className="w-5 h-5 text-purple-400 group-hover:scale-110 transition duration-300" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg sm:text-xl tracking-tight text-white">ZENET</span>
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                  HUB
                </span>
              </div>
              <span className="text-[9px] font-bold text-purple-300/60 uppercase tracking-widest block -mt-1">
                Digital Marketplace
              </span>
            </div>
          </a>

          {/* Nav Links - Desktop */}
          <div className="hidden md:flex items-center gap-8 text-xs font-bold text-purple-200/80">
            <button onClick={() => scrollToSection('hero')} className="hover:text-white transition cursor-pointer">
              Home
            </button>
            <button onClick={onBrowseMarketplace} className="hover:text-white transition cursor-pointer">
              Marketplace
            </button>
            <button onClick={() => scrollToSection('services')} className="hover:text-white transition cursor-pointer">
              Services
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition cursor-pointer">
              How It Works
            </button>
            <button onClick={() => scrollToSection('faq')} className="hover:text-white transition cursor-pointer">
              FAQ
            </button>
          </div>

          {/* Auth Action Buttons - Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => onOpenAuth('login')}
              className="text-xs font-extrabold text-purple-200 hover:text-white px-4 py-2 rounded-full hover:bg-[#1a0e33] border border-transparent hover:border-[#2d1850] transition cursor-pointer"
            >
              Log In
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="text-xs font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-full shadow-lg shadow-purple-600/30 transition cursor-pointer active:scale-95"
            >
              Create Account
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-purple-300 hover:text-white bg-[#190d34] rounded-xl border border-[#301a58]"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#23123f] flex flex-col gap-3 text-sm font-bold text-purple-200 animate-in slide-in-from-top duration-200">
            <button onClick={() => scrollToSection('hero')} className="text-left py-2 px-3 hover:bg-[#190d34] rounded-xl">Home</button>
            <button onClick={() => { setMobileMenuOpen(false); onBrowseMarketplace(); }} className="text-left py-2 px-3 hover:bg-[#190d34] rounded-xl">Marketplace</button>
            <button onClick={() => scrollToSection('services')} className="text-left py-2 px-3 hover:bg-[#190d34] rounded-xl">Services</button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-left py-2 px-3 hover:bg-[#190d34] rounded-xl">How It Works</button>
            <button onClick={() => scrollToSection('faq')} className="text-left py-2 px-3 hover:bg-[#190d34] rounded-xl">FAQ</button>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#23123f]">
              <button
                onClick={() => { setMobileMenuOpen(false); onOpenAuth('login'); }}
                className="w-full py-2.5 bg-[#1a0e33] border border-[#2d1850] rounded-xl text-center text-xs font-bold"
              >
                Log In
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onOpenAuth('signup'); }}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-center text-xs font-black text-white shadow-md"
              >
                Create Account
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* 2. HERO SECTION */}
      <section id="hero" className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-8 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] sm:w-[800px] h-[350px] bg-purple-600/15 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-extrabold mb-6 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Premium Digital Marketplace Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6">
            A faster and cleaner marketplace for{' '}
            <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
              digital services
            </span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-purple-300/80 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
            ZENET HUB empowers users to create an account, fund their personal Paystack Dedicated Virtual Wallet, purchase verified digital products and services, track orders live, and enjoy 24/7 support.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              onClick={() => onOpenAuth('signup')}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-purple-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
            <button
              onClick={() => onOpenAuth('login')}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#160b2e] hover:bg-[#201042] text-purple-200 border border-[#331b5d] hover:border-purple-500/50 font-bold text-sm rounded-2xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Login Dashboard</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. TRUST / FEATURE CARDS */}
      <section className="px-4 sm:px-8 py-8 border-y border-[#1e0f39] bg-[#0a0418]/60">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          
          <div className="p-4 sm:p-5 rounded-2xl bg-[#120826] border border-[#271448] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs sm:text-sm">Fast Delivery</h4>
              <p className="text-[10px] sm:text-xs text-purple-300/60 font-semibold">Instant processing</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#120826] border border-[#271448] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs sm:text-sm">Secure Wallet</h4>
              <p className="text-[10px] sm:text-xs text-purple-300/60 font-semibold">Paystack DVA transfers</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#120826] border border-[#271448] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <ShoppingBag className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs sm:text-sm">Marketplace Access</h4>
              <p className="text-[10px] sm:text-xs text-purple-300/60 font-semibold">Verified digital assets</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#120826] border border-[#271448] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Headphones className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs sm:text-sm">Quick Support</h4>
              <p className="text-[10px] sm:text-xs text-purple-300/60 font-semibold">24/7 dedicated help</p>
            </div>
          </div>

        </div>
      </section>

      {/* 4. MARKETPLACE SECTION */}
      <section className="px-4 sm:px-8 py-16 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block mb-1">
              Explore Offerings
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Browse Available Digital Services
            </h2>
            <p className="text-xs sm:text-sm text-purple-300/70 font-medium mt-1">
              Browse top verified products and digital account solutions listed on ZENET HUB.
            </p>
          </div>

          <button
            onClick={onBrowseMarketplace}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer shrink-0"
          >
            Browse Marketplace
          </button>
        </div>

        {/* Featured Preview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredListings.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectListing ? onSelectListing(item) : onOpenAuth('login')}
              className="bg-[#0f0721] border border-[#251347] rounded-2xl p-5 hover:border-purple-500/50 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                    {item.category}
                  </span>
                  <span className="text-base font-black font-mono text-emerald-400">
                    ₦{item.price.toLocaleString()}
                  </span>
                </div>
                <h3 className="font-extrabold text-white text-base group-hover:text-purple-300 transition line-clamp-1 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-purple-300/70 line-clamp-2 mb-4">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#1d0e38] flex items-center justify-between text-xs font-bold text-purple-300">
                <span>View Details</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition text-purple-400" />
              </div>
            </div>
          ))}

          {featuredListings.length === 0 && (
            <div className="col-span-full bg-[#0d061c] border border-[#23123f] p-8 rounded-2xl text-center">
              <Store className="w-10 h-10 text-purple-400 mx-auto mb-3" />
              <h4 className="text-base font-extrabold text-white">Verified Marketplace Inventory</h4>
              <p className="text-xs text-purple-300/70 max-w-md mx-auto mt-1 mb-4">
                Explore social media accounts, monetized channels, age-verified profiles, and digital services on ZENET HUB.
              </p>
              <button
                onClick={onBrowseMarketplace}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl transition"
              >
                Open Product Catalog
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section id="how-it-works" className="px-4 sm:px-8 py-16 bg-[#0a0418] border-y border-[#1e0f39]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block mb-1">
              Simple Workflow
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              How ZENET HUB Works
            </h2>
            <p className="text-xs sm:text-sm text-purple-300/70 font-medium mt-2">
              Four simple steps to fund your wallet and purchase verified digital services securely.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-[#120826] border border-[#271448] p-6 rounded-2xl relative">
              <span className="text-2xl font-mono font-black text-purple-500/40 block mb-3">01</span>
              <h3 className="font-extrabold text-white text-base mb-2">Create Account</h3>
              <p className="text-xs text-purple-300/70 font-medium leading-relaxed">
                Sign up instantly with your email to get access to your personalized ZENET HUB dashboard.
              </p>
            </div>

            <div className="bg-[#120826] border border-[#271448] p-6 rounded-2xl relative">
              <span className="text-2xl font-mono font-black text-purple-500/40 block mb-3">02</span>
              <h3 className="font-extrabold text-white text-base mb-2">Fund Wallet</h3>
              <p className="text-xs text-purple-300/70 font-medium leading-relaxed">
                Transfer money from any bank app to your unique Paystack Dedicated Virtual Account for automatic instant wallet credit.
              </p>
            </div>

            <div className="bg-[#120826] border border-[#271448] p-6 rounded-2xl relative">
              <span className="text-2xl font-mono font-black text-purple-500/40 block mb-3">03</span>
              <h3 className="font-extrabold text-white text-base mb-2">Choose Service</h3>
              <p className="text-xs text-purple-300/70 font-medium leading-relaxed">
                Select your preferred digital product or service from our verified category catalog.
              </p>
            </div>

            <div className="bg-[#120826] border border-[#271448] p-6 rounded-2xl relative">
              <span className="text-2xl font-mono font-black text-purple-500/40 block mb-3">04</span>
              <h3 className="font-extrabold text-white text-base mb-2">Track Order</h3>
              <p className="text-xs text-purple-300/70 font-medium leading-relaxed">
                Receive instant product details or live status updates in your Order History tab.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. FEATURES / SERVICES */}
      <section id="services" className="px-4 sm:px-8 py-16 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block mb-1">
            Built For Quality
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Features & Digital Services
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-[#0f0721] border border-[#251347] p-6 rounded-2xl">
            <ShoppingBag className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="font-extrabold text-white text-base mb-2">Service Marketplace</h3>
            <p className="text-xs text-purple-300/70 leading-relaxed">
              Curated listings across Instagram, Telegram, Twitter, TikTok, YouTube, Reddit, and specialized digital utilities.
            </p>
          </div>

          <div className="bg-[#0f0721] border border-[#251347] p-6 rounded-2xl">
            <Wallet className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="font-extrabold text-white text-base mb-2">Wallet Funding</h3>
            <p className="text-xs text-purple-300/70 leading-relaxed">
              Seamless Paystack Dedicated NUBAN integration ensures 100% automated credit with webhook idempotency.
            </p>
          </div>

          <div className="bg-[#0f0721] border border-[#251347] p-6 rounded-2xl">
            <ShieldCheck className="w-8 h-8 text-amber-400 mb-4" />
            <h3 className="font-extrabold text-white text-base mb-2">Order History</h3>
            <p className="text-xs text-purple-300/70 leading-relaxed">
              Full transparency with detailed purchase credentials, timestamps, reference codes, and download receipts.
            </p>
          </div>

          <div className="bg-[#0f0721] border border-[#251347] p-6 rounded-2xl">
            <Code className="w-8 h-8 text-indigo-400 mb-4" />
            <h3 className="font-extrabold text-white text-base mb-2">API Integration</h3>
            <p className="text-xs text-purple-300/70 leading-relaxed">
              Direct Paystack live API endpoints for secure server-side transaction verification and DVA provisioning.
            </p>
          </div>

          <div className="bg-[#0f0721] border border-[#251347] p-6 rounded-2xl">
            <Bell className="w-8 h-8 text-violet-400 mb-4" />
            <h3 className="font-extrabold text-white text-base mb-2">Notifications</h3>
            <p className="text-xs text-purple-300/70 leading-relaxed">
              Real-time messaging and order progress alerts directly in your user control panel.
            </p>
          </div>

          <div className="bg-[#0f0721] border border-[#251347] p-6 rounded-2xl">
            <Headphones className="w-8 h-8 text-rose-400 mb-4" />
            <h3 className="font-extrabold text-white text-base mb-2">Fast Support</h3>
            <p className="text-xs text-purple-300/70 leading-relaxed">
              Dedicated support ticket system with direct social messaging channels for fast dispute resolution.
            </p>
          </div>

        </div>
      </section>

      {/* 7. FAQ */}
      <section id="faq" className="px-4 sm:px-8 py-16 bg-[#0a0418] border-t border-[#1e0f39]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block mb-1">
              Got Questions?
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#120826] border border-[#271448] rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left font-extrabold text-white text-xs sm:text-sm flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-purple-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-5 sm:px-5 text-xs text-purple-300/80 leading-relaxed border-t border-[#1f0d3b] pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FINAL CTA */}
      <section className="px-4 sm:px-8 py-16 max-w-5xl mx-auto text-center">
        <div className="bg-gradient-to-r from-[#170a30] via-[#1f0d42] to-[#170a30] border border-[#371c66] p-8 sm:p-12 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />
          
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
            Ready to use ZENET HUB?
          </h2>
          <p className="text-xs sm:text-sm text-purple-300/80 max-w-xl mx-auto font-medium mb-8">
            Get your dedicated virtual bank account today and start purchasing verified digital assets securely.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onOpenAuth('signup')}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl shadow-xl transition cursor-pointer"
            >
              Get Started Now
            </button>
            <button
              onClick={() => onOpenAuth('login')}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#120726] hover:bg-[#1a0a38] text-purple-200 border border-[#301857] font-bold text-sm rounded-2xl transition cursor-pointer"
            >
              Login Account
            </button>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="border-t border-[#1f0e3b] bg-[#06020f] px-4 sm:px-8 py-12 text-xs text-purple-300/70">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-white tracking-tight">ZENET</span>
              <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                HUB
              </span>
            </div>
            <p className="text-xs text-purple-300/60 leading-relaxed">
              ZENET HUB Digital Marketplace — Premium digital accounts, verified assets, and escrow wallet security.
            </p>
          </div>

          <div>
            <h5 className="font-extrabold text-white text-xs uppercase tracking-wider mb-3">Quick Navigation</h5>
            <ul className="space-y-2 font-medium">
              <li><button onClick={() => scrollToSection('hero')} className="hover:text-white transition">Home</button></li>
              <li><button onClick={onBrowseMarketplace} className="hover:text-white transition">Marketplace</button></li>
              <li><button onClick={() => scrollToSection('services')} className="hover:text-white transition">Services</button></li>
              <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition">How It Works</button></li>
              <li><button onClick={() => scrollToSection('faq')} className="hover:text-white transition">FAQ</button></li>
            </ul>
          </div>

          <div>
            <h5 className="font-extrabold text-white text-xs uppercase tracking-wider mb-3">Account & Access</h5>
            <ul className="space-y-2 font-medium">
              <li><button onClick={() => onOpenAuth('login')} className="hover:text-white transition">Login</button></li>
              <li><button onClick={() => onOpenAuth('signup')} className="hover:text-white transition">Register Account</button></li>
              <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
            </ul>
          </div>

          <div>
            <h5 className="font-extrabold text-white text-xs uppercase tracking-wider mb-3">Connect & Support</h5>
            <div className="space-y-2 font-medium">
              <a 
                href="https://wa.me/2348000000000" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Channel</span>
              </a>
              <a 
                href="https://t.me/zenethub" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 text-sky-400 hover:text-sky-300 transition"
              >
                <Send className="w-4 h-4" />
                <span>Telegram Support</span>
              </a>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto border-t border-[#1a0c33] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-[11px] text-purple-300/50">
          <p>© {new Date().getFullYear()} ZENET HUB Digital Marketplace. All rights reserved.</p>
          <p>Powered by Paystack Dedicated Virtual Accounts & Firebase Escrow Protection</p>
        </div>
      </footer>

    </div>
  );
};
