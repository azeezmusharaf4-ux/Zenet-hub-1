import React from 'react';
import { CategoryType, AccountListing } from '../types';
import { isCategoryMatch } from '../utils/category';
import { getPlatformConfig } from './PlatformIcon';
import { 
  CheckCircle2, 
  ChevronRight, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp,
  Layers
} from 'lucide-react';

interface CategoriesViewProps {
  listings: AccountListing[];
  onSelectCategory: (category: CategoryType) => void;
}

interface CategoryInfo {
  type: CategoryType;
  title: string;
  icon: string;
  color: string;
  bgGradient: string;
  borderAccent: string;
  description: string;
  popularBadges: string[];
}

const CATEGORY_CATALOG: CategoryInfo[] = [
  {
    type: 'Facebook',
    title: 'Facebook Accounts',
    icon: '📘',
    color: 'from-blue-600 to-indigo-600',
    bgGradient: 'from-blue-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-blue-500/40',
    description: 'Aged 2010-2023 Facebook PVA accounts, Meta Business Managers, Ads Manager enabled, 2FA secret keys included.',
    popularBadges: ['Aged 2018-2022', 'PVA 2FA Enabled', 'Marketplace Active', 'BM Unlimited']
  },
  {
    type: 'Instagram',
    title: 'Instagram Accounts',
    icon: '📸',
    color: 'from-purple-600 via-pink-600 to-amber-500',
    bgGradient: 'from-purple-950/40 via-[#120a28] to-pink-950/40',
    borderAccent: 'border-purple-500/40',
    description: 'Organic niche accounts (Fitness, Luxury, Crypto, Memes), Meta Verified badges, Original Email included.',
    popularBadges: ['Organic Growth', 'OG Email Included', 'Meta Verified', 'Aged Accounts']
  },
  {
    type: 'TikTok',
    title: 'TikTok Creator Accounts',
    icon: '🎵',
    color: 'from-pink-600 to-rose-600',
    bgGradient: 'from-pink-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-pink-500/40',
    description: 'Monetized Creator Rewards Program accounts, 10k+ followers, Live streaming enabled, USA/UK targeted region.',
    popularBadges: ['Monetized Creator', '10k-100k Followers', 'Live Studio Access', 'USA/UK Audience']
  },
  {
    type: 'YouTube',
    title: 'YouTube Channels',
    icon: '▶️',
    color: 'from-red-600 to-rose-700',
    bgGradient: 'from-red-950/50 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-red-600/40',
    description: 'YPP Monetized channels with AdSense connection, zero copyright strikes, 1k+ subscribers, 4k watch hours.',
    popularBadges: ['YPP Monetized', 'AdSense Connected', 'Zero Strikes', '10k+ Subs']
  },
  {
    type: 'Gmail',
    title: 'Gmail / Google PVA',
    icon: '📧',
    color: 'from-red-600 to-amber-600',
    bgGradient: 'from-red-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-red-500/40',
    description: 'Bulk phone-verified Gmail accounts, Google Ads threshold ready, YouTube Channel ready, Recovery mail attached.',
    popularBadges: ['Bulk PVA', 'Google Ads Ready', 'Aged 5+ Years', 'Recovery Access']
  },
  {
    type: 'Twitter/X',
    title: 'Twitter / X Accounts',
    icon: '𝕏',
    color: 'from-cyan-500 to-blue-600',
    bgGradient: 'from-cyan-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-cyan-500/40',
    description: 'X Premium Blue checkmark accounts, crypto & Web3 followers, high engagement, archived tweets.',
    popularBadges: ['X Premium Blue', 'Crypto Followers', 'Aged 2015-2021', 'API Enabled']
  },
  {
    type: 'Telegram',
    title: 'Telegram Channels & Groups',
    icon: '✈️',
    color: 'from-sky-500 to-blue-600',
    bgGradient: 'from-sky-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-sky-500/40',
    description: 'Established Telegram broadcast channels, high-member groups, TData session files, Premium accounts.',
    popularBadges: ['Broadcast Channel', 'TData Session', 'Crypto Community', 'Monetized Group']
  },
  {
    type: 'WhatsApp',
    title: 'WhatsApp Business Accounts',
    icon: '💬',
    color: 'from-emerald-500 to-green-700',
    bgGradient: 'from-emerald-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-emerald-500/40',
    description: 'Aged WhatsApp Business API profiles, virtual & real SIM verified, bulk marketing ready.',
    popularBadges: ['Business API', 'Aged Numbers', 'Bulk Marketing', '2FA Secured']
  },
  {
    type: 'Discord',
    title: 'Discord Servers & Accounts',
    icon: '🎮',
    color: 'from-indigo-600 to-purple-800',
    bgGradient: 'from-indigo-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-indigo-500/40',
    description: 'Early Supporter badges, 2016-2020 aged Discord accounts, high member servers with Nitro boosts.',
    popularBadges: ['Early Supporter', 'High Member Server', 'Aged 2016-2020', 'Nitro Boosted']
  },
  {
    type: 'LinkedIn',
    title: 'LinkedIn Sales Accounts',
    icon: '💼',
    color: 'from-blue-700 to-sky-800',
    bgGradient: 'from-blue-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-blue-400/40',
    description: 'Aged LinkedIn accounts with 500+ connections, Sales Navigator active, SSI score 80+, verified skills.',
    popularBadges: ['500+ Connections', 'Sales Navigator', 'Aged Profile', 'High SSI Score']
  },
  {
    type: 'Reddit',
    title: 'Reddit High Karma Profiles',
    icon: '🤖',
    color: 'from-orange-600 to-red-600',
    bgGradient: 'from-orange-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-orange-500/40',
    description: 'High post & comment karma Reddit accounts, aged 3-10 years, subreddit moderator access.',
    popularBadges: ['10k+ Karma', 'Aged 3-10 Yrs', 'Mod Access', 'Crypto Friendly']
  },
  {
    type: 'Snapchat',
    title: 'Snapchat Spotlight Creator',
    icon: '👻',
    color: 'from-amber-400 to-yellow-600',
    bgGradient: 'from-amber-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-amber-400/40',
    description: 'Spotlight payout eligible channels, high snap score handles, verified creator profiles.',
    popularBadges: ['Spotlight Payout', '100k+ Snap Score', 'Verified Creator', 'High Reach']
  },
  {
    type: 'Pinterest',
    title: 'Pinterest Business Accounts',
    icon: '📌',
    color: 'from-red-500 to-pink-700',
    bgGradient: 'from-red-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-red-400/40',
    description: 'High monthly view Pinterest Business boards, affiliate traffic ready, claim domain verified.',
    popularBadges: ['100k+ Monthly Views', 'Business Verified', 'Affiliate Ready', 'Rich Pins']
  },
  {
    type: 'Threads',
    title: 'Threads Profiles',
    icon: '🧵',
    color: 'from-purple-500 to-slate-800',
    bgGradient: 'from-purple-950/40 via-[#120a28] to-slate-950/40',
    borderAccent: 'border-purple-400/40',
    description: 'Meta Threads accounts linked to high follower Instagram handles, active engagement.',
    popularBadges: ['Meta Threads', 'Instagram Linked', 'Organic Followers', 'High Engagement']
  },
  {
    type: 'Other',
    title: 'Other Digital Assets',
    icon: '⚡',
    color: 'from-emerald-600 to-teal-600',
    bgGradient: 'from-emerald-950/40 via-[#120a28] to-purple-950/40',
    borderAccent: 'border-emerald-500/40',
    description: 'Specialized digital assets, gaming accounts, domain handles, streaming accounts, and custom services.',
    popularBadges: ['Custom Gaming', 'Aged Domains', 'Verified Assets', 'Fast Transfer']
  }
];

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  listings,
  onSelectCategory
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-7xl mx-auto pb-12">
      
      {/* Category Header Banner */}
      <div className="bg-gradient-to-r from-purple-950/90 via-[#170a33] to-indigo-950/90 border border-[#381d6d] p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Escrow Categories Catalog</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Browse Verified Digital Accounts by Category
          </h1>

          <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed">
            All accounts are manually audited and backed by ZENET 7-Day Escrow Money-Back Protection. Select a category below to filter active listings.
          </p>
        </div>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {CATEGORY_CATALOG.map((cat) => {
          const catListings = listings.filter((l) => isCategoryMatch(l.category, cat.type) && l.status === 'active');
          const count = catListings.length;
          const platformConfig = getPlatformConfig(cat.type);

          return (
            <div
              key={cat.type}
              onClick={() => onSelectCategory(cat.type)}
              className={`bg-gradient-to-br ${cat.bgGradient} border ${cat.borderAccent} p-5 sm:p-6 rounded-3xl space-y-4 hover:border-purple-400/60 transition duration-200 cursor-pointer shadow-xl group relative overflow-hidden`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl ${platformConfig.avatarBg} flex items-center justify-center p-2 shadow-lg border border-white/20 shrink-0 text-white`}>
                    {platformConfig.iconSvg}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base sm:text-lg group-hover:text-purple-200 transition">
                      {cat.title}
                    </h3>
                    <span className="text-xs text-purple-300/70 font-mono font-semibold">
                      {count} Active Escrow {count === 1 ? 'Listing' : 'Listings'}
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-[#1c0e3a] border border-[#371b6d] flex items-center justify-center text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition shrink-0">
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition" />
                </div>
              </div>

              <p className="text-xs text-purple-200/75 leading-relaxed line-clamp-2">
                {cat.description}
              </p>

              {/* Badges Pill list */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {cat.popularBadges.map((badge, idx) => (
                  <span
                    key={idx}
                    className="bg-[#180c35]/80 text-purple-200/90 border border-[#381a6c] text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {badge}
                  </span>
                ))}
              </div>

              {/* Footer CTA */}
              <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between text-xs font-extrabold text-purple-300 group-hover:text-white">
                <span>View All {cat.type} Listings</span>
                <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/80 px-2 py-0.5 rounded uppercase">
                  ESCROW ACTIVE
                </span>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
