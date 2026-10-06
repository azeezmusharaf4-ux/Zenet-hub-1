import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, 
  ChevronRight, 
  TrendingUp, 
  Wallet, 
  Search, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw, 
  Copy, 
  Check, 
  Users, 
  Heart, 
  Eye, 
  Share2, 
  MessageSquare, 
  Bookmark,
  Zap,
  ShoppingBag,
  Settings,
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  Send,
  Music2,
  Gamepad2,
  Linkedin,
  Globe,
  Sliders,
  DollarSign,
  Radio,
  ExternalLink
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, SocialBoostService, SocialBoostOrder } from '../types';
import { auth, db, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch, sanitizeApiErrorMessage } from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { isAuthorizedOwner, isAuthorizedOwnerEmail } from '../lib/authorizedOwners';

export interface TikTokServiceSetting {
  id: string;
  name: string;
  minQuantity: number;
  maxQuantity: number;
  pricePer1k: number;
}

export const SETTINGS_SERVICES_LIST = [
  { id: 'tt-followers', name: 'TikTok Followers', type: 'Followers', defaultMin: 10, defaultMax: 1000000, defaultPrice: 2400 },
  { id: 'tt-likes', name: 'TikTok Likes', type: 'Likes', defaultMin: 50, defaultMax: 500000, defaultPrice: 850 },
  { id: 'tt-comments', name: 'TikTok Comments', type: 'Comments', defaultMin: 10, defaultMax: 10000, defaultPrice: 4500 },
  { id: 'tt-shares', name: 'TikTok Shares', type: 'Shares', defaultMin: 50, defaultMax: 200000, defaultPrice: 650 },
  { id: 'tt-views', name: 'TikTok Views', type: 'Views', defaultMin: 500, defaultMax: 2000000, defaultPrice: 250 }
];

// TikTok Vector Icon Component
export const TikTokIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6 text-white" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .56.04.83.12V9.3a6.33 6.33 0 0 0-1-.08 6.26 6.26 0 1 0 6.26 6.26V9.05a8.21 8.21 0 0 0 5.02 1.74V7.33a4.84 4.84 0 0 1-1-.64z" />
  </svg>
);

// WhatsApp Vector Icon Component
export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6 text-white" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
);

// High-speed fallback services catalogue covering all major platforms with REAL Voiker IDs
const DEFAULT_TIKTOK_SERVICES: SocialBoostService[] = [
  // --- TIKTOK (Voiker Real IDs) ---
  {
    id: 'vk-3',
    provider: 'Voiker',
    providerServiceId: '3',
    platform: 'TikTok',
    category: 'TikTok - Views',
    name: 'TikTok Views Real 💎',
    type: 'Views',
    rateUsd: 0.1246,
    ratePer1000: 206,
    min: 1000,
    max: 50000000,
    deliverySpeed: 'Instant Automated Start',
    refill: false,
    quality: 'High-Retention Algorithmic Discovery',
    description: 'Directly routed through Voiker network for instant video impressions and reach.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link',
    isActive: true,
    isCheapest: true
  },
  {
    id: 'vk-6',
    provider: 'Voiker',
    providerServiceId: '6',
    platform: 'TikTok',
    category: 'TikTok - Likes',
    name: 'TikTok Likes | 💖',
    type: 'Likes',
    rateUsd: 0.5670,
    ratePer1000: 936,
    min: 10,
    max: 100000,
    deliverySpeed: 'Instant Start',
    refill: false,
    quality: 'Real Accounts Engagement',
    description: 'High-speed genuine heart likes to trigger TikTok engagement metrics.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'vk-834',
    provider: 'Voiker',
    providerServiceId: '834',
    platform: 'TikTok',
    category: 'TikTok - Followers',
    name: 'TikTok Followers 🌍 | ✅Quality: ₕQ',
    type: 'Followers',
    rateUsd: 2.7450,
    ratePer1000: 4529,
    min: 50,
    max: 5000000,
    deliverySpeed: '5,000 - 15,000 / day',
    refill: false,
    quality: 'High-Retention Global Followers',
    description: 'Grow your profile audience with authentic global followers.',
    inputLabel: 'TikTok Profile Link or @Username',
    inputPlaceholder: 'https://www.tiktok.com/@username or @username',
    inputType: 'link',
    isActive: true,
    isBestValue: true
  },
  {
    id: 'vk-44',
    provider: 'Voiker',
    providerServiceId: '44',
    platform: 'TikTok',
    category: 'TikTok - Comments',
    name: 'TikTok Comments ~ Custom ~ 𝐇𝐐 🚀',
    type: 'Comments',
    rateUsd: 8.4524,
    ratePer1000: 13946,
    min: 10,
    max: 100000,
    deliverySpeed: 'Starts in 0-10 min',
    refill: false,
    quality: 'Custom Written Text',
    description: 'Custom relevant comments written by you posted directly to your video.',
    inputLabel: 'TikTok Video URL & Custom Comments (1 per line)',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890\nGreat video!\nLove this content!',
    inputType: 'custom_comments',
    isActive: true
  },
  {
    id: 'vk-841',
    provider: 'Voiker',
    providerServiceId: '841',
    platform: 'TikTok',
    category: 'TikTok - Shares',
    name: 'TikTok Shares 𝐂𝐡𝐞𝐚𝐩𝐞𝐬𝐭 𝐢𝐧 𝐭𝐡𝐞 𝐌𝐚𝐫𝐤𝐞𝐭 🛍️',
    type: 'Shares',
    rateUsd: 0.1606,
    ratePer1000: 265,
    min: 10,
    max: 217545811,
    deliverySpeed: '500K / day',
    refill: false,
    quality: 'Algorithm Signal Boost',
    description: 'Boost video redistribute signals and content recommendation on TikTok.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'vk-10',
    provider: 'Voiker',
    providerServiceId: '10',
    platform: 'TikTok',
    category: 'TikTok - Saves',
    name: 'TikTok Video Saves [Refill: 30 Days] 🔥♻️',
    type: 'Favorites',
    rateUsd: 0.1688,
    ratePer1000: 279,
    min: 10,
    max: 100000,
    deliverySpeed: 'Fast Organic Pacing',
    refill: true,
    quality: 'Bookmark Retention Signals',
    description: 'Authentic TikTok bookmark favorites with 30-day automated refill.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link',
    isActive: true
  },

  // --- INSTAGRAM (Voiker Real IDs) ---
  {
    id: 'vk-7',
    provider: 'Voiker',
    providerServiceId: '7',
    platform: 'Instagram',
    category: 'Instagram - Likes',
    name: 'Instagram - Likes + Impressions Real Profiles 💖 🌎 🔥',
    type: 'Likes',
    rateUsd: 0.0855,
    ratePer1000: 141,
    min: 100,
    max: 100000,
    deliverySpeed: 'Instant Start',
    refill: false,
    quality: 'Real Profiles with Impressions',
    description: 'Post and Reels likes with real profile impressions.',
    inputLabel: 'Instagram Post / Reel URL',
    inputPlaceholder: 'https://instagram.com/p/... or reel link',
    inputType: 'link',
    isActive: true,
    isCheapest: true
  },
  {
    id: 'vk-711',
    provider: 'Voiker',
    providerServiceId: '711',
    platform: 'Instagram',
    category: 'Instagram - Followers',
    name: 'Instagram Followers | 𝐎𝐥𝐝 𝐀𝐜𝐜𝐨𝐮𝐧𝐭 [R365 ♻️] ❌',
    type: 'Followers',
    rateUsd: 3.1949,
    ratePer1000: 5272,
    min: 10,
    max: 217545811,
    deliverySpeed: 'Gradual Organic Pace',
    refill: true,
    cancel: true,
    quality: 'Aged Accounts with Posts',
    description: 'High retention Instagram followers with 365-day warranty and refill.',
    inputLabel: 'Instagram Profile Link or @Username',
    inputPlaceholder: 'https://instagram.com/username or @username',
    inputType: 'link',
    isActive: true,
    isBestValue: true
  },
  {
    id: 'vk-43',
    provider: 'Voiker',
    providerServiceId: '43',
    platform: 'Instagram',
    category: 'Instagram - Views',
    name: 'Instagram Views 𝐂𝐡𝐞𝐚𝐩𝐞𝐬𝐭 𝐢𝐧 𝐭𝐡𝐞 𝐌𝐚𝐫𝐤𝐞𝐭 🛍️',
    type: 'Views',
    rateUsd: 0.0027,
    ratePer1000: 4,
    min: 100,
    max: 2147483647,
    deliverySpeed: 'Instant Delivery',
    refill: false,
    quality: 'High Retention Video Views',
    description: 'Ultra fast video and reels impressions to trigger discovery algorithm.',
    inputLabel: 'Instagram Reel or Video URL',
    inputPlaceholder: 'https://instagram.com/reel/...',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'vk-151',
    provider: 'Voiker',
    providerServiceId: '151',
    platform: 'Instagram',
    category: 'Instagram - Comments',
    name: 'Instagram Mix Positive Emoji Comments',
    type: 'Comments',
    rateUsd: 4.5491,
    ratePer1000: 7506,
    min: 10,
    max: 200000,
    deliverySpeed: 'Gradual Pace',
    refill: false,
    quality: 'Positive Emoji Comments',
    description: 'Engaging positive comments and emoji reactions to improve social proof.',
    inputLabel: 'Instagram Post URL',
    inputPlaceholder: 'https://instagram.com/p/...',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'vk-19',
    provider: 'Voiker',
    providerServiceId: '19',
    platform: 'Instagram',
    category: 'Instagram - Saves',
    name: 'Instagram Saves + Impressions 🚀',
    type: 'Favorites',
    rateUsd: 0.1357,
    ratePer1000: 224,
    min: 10,
    max: 400000,
    deliverySpeed: 'Instant Start',
    refill: false,
    quality: 'Bookmark Signals',
    description: 'Post saves and discovery reach impressions.',
    inputLabel: 'Instagram Post URL',
    inputPlaceholder: 'https://instagram.com/p/...',
    inputType: 'link',
    isActive: true
  },

  // --- FACEBOOK (Voiker Real IDs) ---
  {
    id: 'vk-42',
    provider: 'Voiker',
    providerServiceId: '42',
    platform: 'Facebook',
    category: 'Facebook - Followers',
    name: 'Facebook Page & Profile Followers 🔴',
    type: 'Followers',
    rateUsd: 0.2358,
    ratePer1000: 389,
    min: 10,
    max: 50000,
    deliverySpeed: 'Steady Delivery',
    refill: false,
    quality: 'Active Profiles',
    description: 'Grow your Facebook business page or personal creator profile followers.',
    inputLabel: 'Facebook Page or Profile URL',
    inputPlaceholder: 'https://facebook.com/...',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'vk-177',
    provider: 'Voiker',
    providerServiceId: '177',
    platform: 'Facebook',
    category: 'Facebook - Post Likes',
    name: 'Facebook Post Likes',
    type: 'Likes',
    rateUsd: 0.2498,
    ratePer1000: 412,
    min: 10,
    max: 50000,
    deliverySpeed: 'Fast Delivery',
    refill: false,
    quality: 'Real Accounts',
    description: 'Instant likes for any Facebook post, photo, or status update.',
    inputLabel: 'Facebook Post URL',
    inputPlaceholder: 'https://facebook.com/.../posts/...',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'vk-698',
    provider: 'Voiker',
    providerServiceId: '698',
    platform: 'Facebook',
    category: 'Facebook - Video Views',
    name: 'Facebook Views ~ 10 Seconds',
    type: 'Views',
    rateUsd: 0.4436,
    ratePer1000: 732,
    min: 500,
    max: 10000000,
    deliverySpeed: 'Fast Delivery',
    refill: false,
    quality: '10s Retention Views',
    description: 'High watch-time video views for Facebook watch & video posts.',
    inputLabel: 'Facebook Video URL',
    inputPlaceholder: 'https://facebook.com/watch/?v=...',
    inputType: 'link',
    isActive: true
  },

  // --- YOUTUBE (Voiker Real IDs) ---
  {
    id: 'vk-264',
    provider: 'Voiker',
    providerServiceId: '264',
    platform: 'YouTube',
    category: 'YouTube - Views',
    name: 'Youtube Views | Monetizable | Best For SEO | Suggested + Browse | Lifetime Guaranteed',
    type: 'Views',
    rateUsd: 3.6497,
    ratePer1000: 6022,
    min: 100,
    max: 100000000,
    deliverySpeed: 'Natural Organic Pacing',
    refill: true,
    quality: 'Monetizable SEO Views',
    description: 'Source: Suggested, browse features, and external. Safe for monetization.',
    inputLabel: 'YouTube Video URL',
    inputPlaceholder: 'https://youtube.com/watch?v=...',
    inputType: 'link',
    isActive: true,
    isBestValue: true
  },
  {
    id: 'vk-298',
    provider: 'Voiker',
    providerServiceId: '298',
    platform: 'YouTube',
    category: 'YouTube - Subscribers',
    name: 'YouTube Subscribers ℍ𝕚𝕘𝕙 𝔻𝕣𝕠𝕡 ℕ𝕠 ℝ𝕖𝕗𝕚𝕝𝕝',
    type: 'Subscribers',
    rateUsd: 0.0924,
    ratePer1000: 152,
    min: 10,
    max: 500000,
    deliverySpeed: 'Steady Pace',
    refill: false,
    quality: 'Wholesale Channel Growth',
    description: 'Rapid subscriber growth for new and existing YouTube channels.',
    inputLabel: 'YouTube Channel Link',
    inputPlaceholder: 'https://youtube.com/@channel or channel link',
    inputType: 'link',
    isActive: true,
    isCheapest: true
  },
  {
    id: 'vk-282',
    provider: 'Voiker',
    providerServiceId: '282',
    platform: 'YouTube',
    category: 'YouTube - Likes',
    name: 'YouTube Likes 𝐂𝐡𝐞𝐚𝐩𝐞𝐬𝐭 𝐢𝐧 𝐭𝐡𝐞 𝐌𝐚𝐫𝐤𝐞𝐭 🛍️',
    type: 'Likes',
    rateUsd: 0.1992,
    ratePer1000: 329,
    min: 10,
    max: 5000,
    deliverySpeed: 'Instant Start',
    refill: false,
    quality: 'High Quality Likes',
    description: 'Instant thumbs-up likes to improve video ranking and audience engagement.',
    inputLabel: 'YouTube Video URL',
    inputPlaceholder: 'https://youtube.com/watch?v=...',
    inputType: 'link',
    isActive: true
  },

  // --- TWITTER / X (Voiker Real IDs) ---
  {
    id: 'vk-810',
    provider: 'Voiker',
    providerServiceId: '810',
    platform: 'Twitter / X',
    category: 'Twitter - Followers',
    name: 'Twitter Followers | Real Profile Base',
    type: 'Followers',
    rateUsd: 1.4573,
    ratePer1000: 2405,
    min: 100,
    max: 10000,
    deliverySpeed: 'Fast Delivery',
    refill: false,
    quality: 'Active Profiles',
    description: 'Grow your X audience and follower count safely.',
    inputLabel: 'Twitter / X Profile Link or @handle',
    inputPlaceholder: 'https://x.com/username or @username',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'vk-751',
    provider: 'Voiker',
    providerServiceId: '751',
    platform: 'Twitter / X',
    category: 'Twitter - Likes',
    name: 'Twitter Likes | HQ | R30',
    type: 'Likes',
    rateUsd: 2.3905,
    ratePer1000: 3944,
    min: 10,
    max: 10000,
    deliverySpeed: 'Instant Start',
    refill: true,
    quality: 'High Quality Likes with 30d Refill',
    description: 'Likes on tweets to increase impressions and algorithm visibility.',
    inputLabel: 'Tweet URL',
    inputPlaceholder: 'https://x.com/user/status/123...',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'vk-831',
    provider: 'Voiker',
    providerServiceId: '831',
    platform: 'Twitter / X',
    category: 'Twitter - Retweets',
    name: 'Twitter Retweets',
    type: 'Shares',
    rateUsd: 1.3021,
    ratePer1000: 2148,
    min: 20,
    max: 5000,
    deliverySpeed: 'Fast Delivery',
    refill: false,
    quality: 'Organic Retweets',
    description: 'Direct retweets to amplify reach across the Twitter feed.',
    inputLabel: 'Tweet URL',
    inputPlaceholder: 'https://x.com/user/status/123...',
    inputType: 'link',
    isActive: true
  },

  // --- TELEGRAM (Voiker Real IDs) ---
  {
    id: 'vk-513',
    provider: 'Voiker',
    providerServiceId: '513',
    platform: 'Telegram',
    category: 'Telegram - Members',
    name: 'Telegram Members | Max 100K | 0-15 Minutes',
    type: 'Members',
    rateUsd: 0.3545,
    ratePer1000: 585,
    min: 10,
    max: 100000,
    deliverySpeed: '0-15 Minutes Start',
    refill: false,
    cancel: true,
    quality: 'Fast Channel/Group Members',
    description: 'Rapid member growth for Telegram channels and public groups.',
    inputLabel: 'Telegram Channel/Group Link',
    inputPlaceholder: 'https://t.me/channelname or @channelname',
    inputType: 'link',
    isActive: true,
    isCheapest: true
  },
  {
    id: 'vk-968',
    provider: 'Voiker',
    providerServiceId: '968',
    platform: 'Telegram',
    category: 'Telegram - Views',
    name: 'Telegram Post Views ⚡ 🔥',
    type: 'Views',
    rateUsd: 0.0083,
    ratePer1000: 14,
    min: 10,
    max: 500000,
    deliverySpeed: 'Instant Speed',
    refill: false,
    cancel: true,
    quality: 'Ultra-Fast Post Impressions',
    description: 'Post views on Telegram broadcasts to simulate active readership.',
    inputLabel: 'Telegram Post Link',
    inputPlaceholder: 'https://t.me/channel/123',
    inputType: 'link',
    isActive: true
  },

  // --- WHATSAPP (Voiker Real IDs) ---
  {
    id: 'vk-776',
    provider: 'Voiker',
    providerServiceId: '776',
    platform: 'WhatsApp',
    category: 'Whatsapp - Members',
    name: 'Whatsapp Channel Members 𝐂𝐡𝐞𝐚𝐩𝐞𝐬𝐭 𝐢𝐧 𝐭𝐡𝐞 𝐌𝐚𝐫𝐤𝐞𝐭 🛍️',
    type: 'Members',
    rateUsd: 2.8327,
    ratePer1000: 4674,
    min: 10,
    max: 10000,
    deliverySpeed: 'Fast Delivery',
    refill: false,
    quality: 'Channel Followers',
    description: 'Active followers and members for WhatsApp Public Channels.',
    inputLabel: 'WhatsApp Channel Link',
    inputPlaceholder: 'https://whatsapp.com/channel/...',
    inputType: 'link',
    isActive: true
  },

  // --- SPOTIFY (Voiker Real IDs) ---
  {
    id: 'vk-432',
    provider: 'Voiker',
    providerServiceId: '432',
    platform: 'Spotify & Music',
    category: 'Spotify - Plays',
    name: 'Spotify Free Plays [Lifetime Guaranteed] [Max: 1M] ♻️',
    type: 'Views',
    rateUsd: 0.4584,
    ratePer1000: 756,
    min: 1000,
    max: 1000000000,
    deliverySpeed: '20K / day',
    refill: false,
    quality: 'Royalty-Eligible Streams',
    description: 'Stream plays on your track to boost artist algorithm placement.',
    inputLabel: 'Spotify Track URL',
    inputPlaceholder: 'https://open.spotify.com/track/...',
    inputType: 'link',
    isActive: true
  },

  // --- DISCORD (Voiker Real IDs) ---
  {
    id: 'vk-1040',
    provider: 'Voiker',
    providerServiceId: '1040',
    platform: 'Discord',
    category: 'Discord',
    name: 'Discord Offline Members | ✅Quality: Real With Avatar',
    type: 'Members',
    rateUsd: 2.8350,
    ratePer1000: 4678,
    min: 50,
    max: 1500,
    deliverySpeed: 'Instant Speed',
    refill: false,
    quality: 'Real Avatars & Handles',
    description: 'Join members to increase Discord server headcount and credibility.',
    inputLabel: 'Discord Server Invite Link',
    inputPlaceholder: 'https://discord.gg/...',
    inputType: 'link',
    isActive: true
  },

  // --- LINKEDIN (Voiker Real IDs) ---
  {
    id: 'vk-4631',
    provider: 'Voiker',
    providerServiceId: '4631',
    platform: 'LinkedIn',
    category: 'LinkedIn',
    name: 'Linkedin Followers | Page or Profile | 30 Days Refill ♻️',
    type: 'Followers',
    rateUsd: 13.6500,
    ratePer1000: 22523,
    min: 10,
    max: 100000000,
    deliverySpeed: 'Steady B2B Pace',
    refill: true,
    quality: 'Professional Profiles',
    description: 'Followers on company pages or personal profiles with 30-day refill.',
    inputLabel: 'LinkedIn Profile or Company Page URL',
    inputPlaceholder: 'https://linkedin.com/in/... or company link',
    inputType: 'link',
    isActive: true
  },

  // --- WEBSITE TRAFFIC (Voiker Real IDs) ---
  {
    id: 'vk-560',
    provider: 'Voiker',
    providerServiceId: '560',
    platform: 'Website Traffic & SEO',
    category: 'Website Traffic',
    name: 'Website Traffic [WW - Direct Visits] [Speed: 50K/Day] 💧',
    type: 'Views',
    rateUsd: 0.5354,
    ratePer1000: 883,
    min: 100,
    max: 1000000,
    deliverySpeed: '50K / day',
    refill: false,
    quality: 'Worldwide Organic Direct Visits',
    description: 'Direct browser visits to increase web traffic and analytics rankings.',
    inputLabel: 'Website URL',
    inputPlaceholder: 'https://example.com',
    inputType: 'link',
    isActive: true
  }
];

// Predefined platform branding definitions for catalogue display
interface PlatformCardInfo {
  id: string;
  name: string;
  description: string;
  bgColor: string;
  textColor: string;
  iconBg: string;
  badgeColor: string;
  popularTypes: string[];
}

const PLATFORMS_METADATA: PlatformCardInfo[] = [
  {
    id: 'TikTok',
    name: 'TikTok',
    description: 'Followers, Likes, Views, Comments, Shares & Saves',
    bgColor: 'hover:border-black/30',
    textColor: 'group-hover:text-black',
    iconBg: 'bg-black text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Likes', 'Views', 'Comments', 'Shares']
  },
  {
    id: 'Instagram',
    name: 'Instagram',
    description: 'Followers, HQ Likes, Reel Views, Comments & Story Reach',
    bgColor: 'hover:border-pink-500/40',
    textColor: 'group-hover:text-pink-600',
    iconBg: 'bg-linear-to-tr from-amber-500 via-rose-500 to-purple-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Likes', 'Views', 'Comments', 'Reels']
  },
  {
    id: 'YouTube',
    name: 'YouTube',
    description: 'Subscribers, Monetizable Views, Likes, Comments & Watch Time',
    bgColor: 'hover:border-red-500/40',
    textColor: 'group-hover:text-red-600',
    iconBg: 'bg-red-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Subscribers', 'Views', 'Likes', 'Comments', 'Watch Hours']
  },
  {
    id: 'Facebook',
    name: 'Facebook',
    description: 'Page Followers, Post Likes, Video Views & Group Members',
    bgColor: 'hover:border-blue-600/40',
    textColor: 'group-hover:text-blue-600',
    iconBg: 'bg-blue-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Likes', 'Views', 'Members']
  },
  {
    id: 'Twitter / X',
    name: 'Twitter / X',
    description: 'High-Retention Followers, Retweets, Likes & Impressions',
    bgColor: 'hover:border-neutral-900/40',
    textColor: 'group-hover:text-neutral-900',
    iconBg: 'bg-neutral-950 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Likes', 'Shares', 'Views']
  },
  {
    id: 'Telegram',
    name: 'Telegram',
    description: 'Channel Members, Post Views, Reactions & Group Boost',
    bgColor: 'hover:border-sky-500/40',
    textColor: 'group-hover:text-sky-600',
    iconBg: 'bg-sky-500 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Members', 'Views', 'Likes']
  },
  {
    id: 'WhatsApp',
    name: 'WhatsApp',
    description: 'Channel Followers, Group Members & Engagement',
    bgColor: 'hover:border-emerald-500/40',
    textColor: 'group-hover:text-emerald-600',
    iconBg: 'bg-emerald-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Members']
  },
  {
    id: 'Spotify & Music',
    name: 'Spotify & Music',
    description: 'Track Plays, Monthly Listeners, Playlist Followers & Saves',
    bgColor: 'hover:border-green-500/40',
    textColor: 'group-hover:text-green-600',
    iconBg: 'bg-green-500 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Views', 'Followers']
  },
  {
    id: 'Discord',
    name: 'Discord',
    description: 'Online Active Members, Offline Server Members & Boosts',
    bgColor: 'hover:border-indigo-500/40',
    textColor: 'group-hover:text-indigo-600',
    iconBg: 'bg-indigo-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Members']
  },
  {
    id: 'LinkedIn',
    name: 'LinkedIn',
    description: 'Connections, Company Page Followers, Post Likes & Shares',
    bgColor: 'hover:border-blue-700/40',
    textColor: 'group-hover:text-blue-700',
    iconBg: 'bg-blue-700 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Likes', 'Shares']
  },
  {
    id: 'Twitch & Streaming',
    name: 'Twitch & Streaming',
    description: 'Live Stream Viewers, Channel Followers & Video Views',
    bgColor: 'hover:border-purple-600/40',
    textColor: 'group-hover:text-purple-600',
    iconBg: 'bg-purple-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Views', 'Followers']
  },
  {
    id: 'Website Traffic & SEO',
    name: 'Website Traffic & SEO',
    description: 'Direct Organic Website Visitors, Search Engine Impressions',
    bgColor: 'hover:border-teal-500/40',
    textColor: 'group-hover:text-teal-600',
    iconBg: 'bg-teal-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Views']
  },
  {
    id: 'Reviews & Ratings',
    name: 'Reviews & Ratings',
    description: 'Google Maps Reviews, Trustpilot Ratings & App Reviews',
    bgColor: 'hover:border-amber-500/40',
    textColor: 'group-hover:text-amber-600',
    iconBg: 'bg-amber-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Comments']
  },
  {
    id: 'Threads',
    name: 'Threads',
    description: 'Followers, Likes, Reposts & Thread Replies',
    bgColor: 'hover:border-black/40',
    textColor: 'group-hover:text-black',
    iconBg: 'bg-black text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Likes', 'Shares']
  },
  {
    id: 'Snapchat',
    name: 'Snapchat',
    description: 'Public Profile Followers, Story Views & Spotlight Likes',
    bgColor: 'hover:border-amber-400/50',
    textColor: 'group-hover:text-amber-500',
    iconBg: 'bg-yellow-400 text-black',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Views']
  },
  {
    id: 'Pinterest',
    name: 'Pinterest',
    description: 'Board Followers, Pin Repins & Impressions',
    bgColor: 'hover:border-red-600/40',
    textColor: 'group-hover:text-red-600',
    iconBg: 'bg-red-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Shares']
  },
  {
    id: 'Reddit',
    name: 'Reddit',
    description: 'Post Upvotes, Subreddit Subscribers & Karma Growth',
    bgColor: 'hover:border-orange-500/40',
    textColor: 'group-hover:text-orange-600',
    iconBg: 'bg-orange-600 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Likes', 'Members']
  },
  {
    id: 'Quora',
    name: 'Quora',
    description: 'Question Answers, Followers, Upvotes & Spaces Reach',
    bgColor: 'hover:border-red-700/40',
    textColor: 'group-hover:text-red-700',
    iconBg: 'bg-red-800 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Likes', 'Views']
  },
  {
    id: 'Other Services',
    name: 'Other Growth Services',
    description: 'Snapchat, Reddit Upvotes, Pinterest Pins, Quora & Multi-Network',
    bgColor: 'hover:border-purple-500/40',
    textColor: 'group-hover:text-purple-600',
    iconBg: 'bg-purple-700 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    popularTypes: ['Followers', 'Likes', 'Views']
  }
];

interface SocialBoostViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => Promise<void> | void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

export const SocialBoostView: React.FC<SocialBoostViewProps> = ({
  user,
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet,
  onOpenAuth,
  onBalanceUpdated
}) => {
  // Navigation: 'categories' (select platform) or 'platform-services' (browse services for that platform)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // Live services catalogue from Voiker
  const [allServices, setAllServices] = useState<SocialBoostService[]>(DEFAULT_TIKTOK_SERVICES);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  // Sub-tab: 'browse' or 'orders'
  const [activeSubTab, setActiveSubTab] = useState<'browse' | 'orders'>('browse');

  // Order Placement Modal state
  const [selectedService, setSelectedService] = useState<SocialBoostService | null>(null);
  const [orderTarget, setOrderTarget] = useState<string>('');
  const [orderQuantity, setOrderQuantity] = useState<number>(1000);
  const [orderComments, setOrderComments] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<SocialBoostOrder | null>(null);

  // User Orders History state
  const [orders, setOrders] = useState<SocialBoostOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState<string | null>(null);
  const [actionNotification, setActionNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin authorization check
  const isAdmin = Boolean(
    isAuthorizedOwner(user, userProfile) ||
    isAuthorizedOwnerEmail(user?.email || auth.currentUser?.email || userProfile?.email) ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'owner'
  );

  // Admin Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<'voiker' | 'tiktok'>('voiker');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<boolean>(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [voikerBalance, setVoikerBalance] = useState<{ balanceUsd: number; balanceNgn: number; currency: string } | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);

  // Voiker Global Pricing Settings (Zero Markup Direct Mode)
  const [voikerPricing, setVoikerPricing] = useState({
    defaultMarkupPercent: 0,
    minMarkupPer1k: 0,
    usdToNgnRate: 1650,
    pricingStyle: 'natural'
  });

  // Configured TikTok service overrides
  const [configuredSettings, setConfiguredSettings] = useState<Record<string, TikTokServiceSetting>>({
    'tt-followers': { id: 'tt-followers', name: 'TikTok Followers', minQuantity: 10, maxQuantity: 1000000, pricePer1k: 2400 },
    'tt-likes': { id: 'tt-likes', name: 'TikTok Likes', minQuantity: 50, maxQuantity: 500000, pricePer1k: 850 },
    'tt-comments': { id: 'tt-comments', name: 'TikTok Comments', minQuantity: 10, maxQuantity: 10000, pricePer1k: 4500 },
    'tt-shares': { id: 'tt-shares', name: 'TikTok Shares', minQuantity: 50, maxQuantity: 200000, pricePer1k: 650 },
    'tt-views': { id: 'tt-views', name: 'TikTok Views', minQuantity: 500, maxQuantity: 2000000, pricePer1k: 250 }
  });

  // Fetch Voiker & Boosting services from backend
  const loadServices = useCallback(async () => {
    setIsLoadingServices(true);
    try {
      const callerEmail = user?.email || userProfile?.email || '';
      // Try /api/voiker/services first
      let res: any = await safeApiFetch(`/api/voiker/services?callerEmail=${encodeURIComponent(callerEmail)}`);
      if (!res || !res.success || !Array.isArray(res.services) || res.services.length === 0) {
        // Fallback to /api/social-boost/services
        res = await safeApiFetch(`/api/social-boost/services?action=services&callerEmail=${encodeURIComponent(callerEmail)}`);
      }

      if (res && res.success && Array.isArray(res.services) && res.services.length > 0) {
        setAllServices(res.services);
        setHasApiKey(Boolean(res.hasApiKey));
      } else {
        setAllServices(DEFAULT_TIKTOK_SERVICES);
      }
    } catch (err) {
      console.warn('[Voiker] Live services fetch notice:', err);
      setAllServices(DEFAULT_TIKTOK_SERVICES);
    } finally {
      setIsLoadingServices(false);
    }
  }, [user?.email, userProfile?.email]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Realtime subscription to TikTok settings
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      if (db) {
        const docRef = doc(db, 'system_settings', 'tiktok_services_config');
        unsub = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data?.services && typeof data.services === 'object') {
              setConfiguredSettings(data.services);
            }
          }
        });
      }
    } catch (err) {
      console.warn('[Voiker] Firestore settings snapshot notice:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Fetch Wholesale Provider Balance (Owner only)
  const fetchVoikerBalance = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingBalance(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res: any = await safeApiFetch('/api/voiker/balance', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res && res.success) {
        setVoikerBalance({
          balanceUsd: res.balanceUsd || 0,
          balanceNgn: res.balanceNgn || 0,
          currency: res.currency || 'USD'
        });
      }
    } catch (e) {
      console.warn('[Voiker] Balance fetch notice:', e);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isSettingsOpen && isAdmin) {
      fetchVoikerBalance();
    }
  }, [isSettingsOpen, isAdmin, fetchVoikerBalance]);

  // Fetch User's Boosting Orders
  const fetchOrders = useCallback(async () => {
    if (!auth.currentUser) return;
    setIsLoadingOrders(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res: any = await safeApiFetch(`/api/voiker/orders?userId=${encodeURIComponent(auth.currentUser.uid)}`, { headers });
      if (!res || !res.success) {
        res = await safeApiFetch(`/api/social-boost/orders?action=orders&userId=${encodeURIComponent(auth.currentUser.uid)}`, { headers });
      }
      if (res && res.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.warn('[Voiker] Orders fetch notice:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'orders' || orderSuccess) {
      fetchOrders();
    }
  }, [activeSubTab, orderSuccess, fetchOrders]);

  // Handle Refill Request for eligible orders
  const handleRefillOrder = async (order: SocialBoostOrder) => {
    if (!auth.currentUser || actionLoadingOrderId) return;
    setActionLoadingOrderId(order.id);
    setActionNotification(null);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res: any = await safeApiFetch('/api/voiker/refill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ orderId: order.id, order: order.providerOrderId || order.id })
      });
      if (res && res.success) {
        setActionNotification({
          type: 'success',
          message: res.message || 'Refill successfully requested from provider.'
        });
        await fetchOrders();
      } else {
        throw new Error(res?.error || 'Provider rejected refill request.');
      }
    } catch (err: any) {
      setActionNotification({
        type: 'error',
        message: err.message || 'Failed to submit refill request.'
      });
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  // Handle Cancel Order for eligible orders
  const handleCancelOrder = async (order: SocialBoostOrder) => {
    if (!auth.currentUser || actionLoadingOrderId) return;
    if (!window.confirm('Are you sure you want to cancel this order? If permitted by Voiker, funds will be refunded to your wallet.')) return;
    setActionLoadingOrderId(order.id);
    setActionNotification(null);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res: any = await safeApiFetch('/api/voiker/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ orderId: order.id, order: order.providerOrderId || order.id })
      });
      if (res && res.success) {
        setActionNotification({
          type: 'success',
          message: res.message || 'Order cancelled successfully. Wallet balance refunded.'
        });
        if (onRefreshProfile) await onRefreshProfile();
        await fetchOrders();
      } else {
        throw new Error(res?.error || 'Cancellation rejected or order cannot be cancelled.');
      }
    } catch (err: any) {
      setActionNotification({
        type: 'error',
        message: err.message || 'Failed to cancel order.'
      });
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  // Filtered Services for the selected platform
  const currentPlatformServices = useMemo(() => {
    if (!selectedPlatform) return [];
    const platLower = selectedPlatform.toLowerCase().trim();

    return allServices.filter(svc => {
      const sPlat = (svc.platform || '').toLowerCase().trim();
      const sCat = (svc.category || '').toLowerCase().trim();
      const sName = (svc.name || '').toLowerCase().trim();

      if (platLower.includes('tiktok')) {
        return sPlat.includes('tiktok') || sCat.includes('tiktok') || sName.includes('tiktok');
      }
      if (platLower.includes('instagram')) {
        return sPlat.includes('instagram') || sCat.includes('instagram') || sName.includes('instagram') || sPlat.includes('ig ');
      }
      if (platLower.includes('youtube')) {
        return sPlat.includes('youtube') || sCat.includes('youtube') || sName.includes('youtube') || sPlat.includes('yt ');
      }
      if (platLower.includes('facebook')) {
        return sPlat.includes('facebook') || sCat.includes('facebook') || sName.includes('facebook') || sPlat.includes('fb ');
      }
      if (platLower.includes('twitter') || platLower.includes(' x')) {
        return sPlat.includes('twitter') || sCat.includes('twitter') || sPlat.includes(' x ') || sPlat.includes('x.com');
      }
      if (platLower.includes('telegram')) {
        return sPlat.includes('telegram') || sCat.includes('telegram') || sPlat.includes('tg ');
      }
      if (platLower.includes('whatsapp')) {
        return sPlat.includes('whatsapp') || sCat.includes('whatsapp') || sPlat.includes('wa ');
      }
      if (platLower.includes('spotify') || platLower.includes('music')) {
        return sPlat.includes('spotify') || sCat.includes('spotify') || sPlat.includes('music');
      }
      if (platLower.includes('discord')) {
        return sPlat.includes('discord') || sCat.includes('discord');
      }
      if (platLower.includes('linkedin')) {
        return sPlat.includes('linkedin') || sCat.includes('linkedin');
      }
      if (platLower.includes('twitch') || platLower.includes('streaming')) {
        return sPlat.includes('twitch') || sPlat.includes('stream');
      }
      if (platLower.includes('traffic') || platLower.includes('seo')) {
        return sPlat.includes('traffic') || sPlat.includes('visitor') || sPlat.includes('seo');
      }
      if (platLower.includes('review')) {
        return sPlat.includes('review') || sCat.includes('review');
      }
      if (platLower.includes('threads')) {
        return sPlat.includes('threads') || sCat.includes('threads') || sName.includes('threads');
      }
      if (platLower.includes('snapchat')) {
        return sPlat.includes('snapchat') || sCat.includes('snapchat') || sName.includes('snapchat');
      }
      if (platLower.includes('pinterest')) {
        return sPlat.includes('pinterest') || sCat.includes('pinterest') || sName.includes('pinterest');
      }
      if (platLower.includes('reddit')) {
        return sPlat.includes('reddit') || sCat.includes('reddit') || sName.includes('reddit');
      }

      return sPlat === platLower;
    });
  }, [allServices, selectedPlatform]);

  // Dynamic Type/Category filter tabs for the current platform
  const dynamicFilterCategories = useMemo(() => {
    const types = new Set<string>();
    currentPlatformServices.forEach(s => {
      if (s.type) types.add(s.type);
    });
    return ['All', ...Array.from(types).sort()];
  }, [currentPlatformServices]);

  // Filtered Services by Type and Search
  const filteredServices = useMemo(() => {
    return currentPlatformServices.filter(service => {
      // Type filter
      if (activeTypeFilter !== 'All') {
        const sType = (service.type || '').toLowerCase();
        const fType = activeTypeFilter.toLowerCase();
        if (!sType.includes(fType)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const name = (service.name || '').toLowerCase();
        const cat = (service.category || '').toLowerCase();
        const desc = (service.description || '').toLowerCase();
        if (!name.includes(query) && !cat.includes(query) && !desc.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [currentPlatformServices, activeTypeFilter, searchQuery]);

  // Open Order Modal for a selected service
  const handleOpenOrderModal = (service: SocialBoostService) => {
    setSelectedService(service);
    const minQ = service.min || 100;
    setOrderQuantity(Math.max(minQ, 1000 > minQ && 1000 <= (service.max || 100000) ? 1000 : minQ));
    setOrderTarget('');
    setOrderComments('');
    setOrderError(null);
  };

  // Close Order Modal
  const handleCloseOrderModal = () => {
    if (isSubmittingOrder) return;
    setSelectedService(null);
    setOrderError(null);
  };

  // Calculated Order Cost in NGN
  const calculatedCost = useMemo(() => {
    if (!selectedService) return 0;
    const rate = selectedService.ratePer1000 || selectedService.pricePerThousandNgn || 1500;
    const qty = Math.max(0, Number(orderQuantity) || 0);
    return Math.max(10, Math.round((rate / 1000) * qty));
  }, [selectedService, orderQuantity]);

  // Place Order handler
  const handlePlaceOrder = async () => {
    if (!selectedService) return;

    if (!auth.currentUser) {
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    const cleanTarget = orderTarget.trim();
    if (!cleanTarget) {
      setOrderError(selectedService.inputLabel || 'Please provide your target link or username.');
      return;
    }

    if (orderQuantity < selectedService.min || orderQuantity > selectedService.max) {
      setOrderError(`Quantity must be between ${selectedService.min.toLocaleString()} and ${selectedService.max.toLocaleString()}.`);
      return;
    }

    if (walletBalance < calculatedCost) {
      setOrderError(`Insufficient wallet balance. You need ₦${(calculatedCost - walletBalance).toLocaleString()} more.`);
      return;
    }

    setIsSubmittingOrder(true);
    setOrderError(null);

    try {
      const token = await getSafeIdToken(auth.currentUser);
      if (!token) {
        throw new Error('Please sign in again to place an order.');
      }

      const payload = {
        serviceId: selectedService.id,
        target: cleanTarget,
        link: cleanTarget,
        quantity: orderQuantity,
        ratePer1000: selectedService.ratePer1000,
        comments: selectedService.inputType === 'custom_comments' ? orderComments : undefined,
        action: 'order'
      };

      // Try dedicated Voiker order endpoint first
      let data: any = await safeApiFetch('/api/voiker/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!data || !data.success) {
        // Fallback to social-boost endpoint
        data = await safeApiFetch('/api/social-boost/order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to place boosting order.');
      }

      const newOrder: SocialBoostOrder = data.order || {
        id: data.orderId || `vk-${Date.now()}`,
        serviceName: selectedService.name,
        target: cleanTarget,
        quantity: orderQuantity,
        charge: calculatedCost,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      setOrderSuccess(newOrder);
      setSelectedService(null);

      // Deduct balance locally
      const updatedBalance = Math.max(0, walletBalance - calculatedCost);
      if (onBalanceUpdated) {
        onBalanceUpdated(updatedBalance);
      }
      if (onRefreshProfile) {
        await onRefreshProfile();
      }
      fetchOrders();
    } catch (err: any) {
      console.error('[VoikerBoost] Order Error:', err);
      setOrderError(sanitizeApiErrorMessage(err.message || 'Failed to process boosting order.'));
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Copy handler
  const handleCopy = (text: string, id: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for type badges and icons
  const getTypeIcon = (type?: string) => {
    const lower = (type || '').toLowerCase();
    if (lower.includes('follower')) return <Users className="w-3.5 h-3.5 text-purple-600" />;
    if (lower.includes('like') || lower.includes('reaction')) return <Heart className="w-3.5 h-3.5 text-rose-500" />;
    if (lower.includes('comment')) return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
    if (lower.includes('share') || lower.includes('repost')) return <Share2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (lower.includes('favorite') || lower.includes('save') || lower.includes('bookmark')) return <Bookmark className="w-3.5 h-3.5 text-pink-500" />;
    if (lower.includes('view') || lower.includes('play') || lower.includes('stream')) return <Eye className="w-3.5 h-3.5 text-blue-500" />;
    if (lower.includes('member') || lower.includes('subscriber')) return <Users className="w-3.5 h-3.5 text-indigo-600" />;
    return <Zap className="w-3.5 h-3.5 text-indigo-500" />;
  };

  // Helper to render platform icon
  const renderPlatformIcon = (platformName: string, className = "w-6 h-6") => {
    const p = platformName.toLowerCase();
    if (p.includes('tiktok')) return <TikTokIcon className={className} />;
    if (p.includes('instagram')) return <Instagram className={className} />;
    if (p.includes('youtube')) return <Youtube className={className} />;
    if (p.includes('facebook')) return <Facebook className={className} />;
    if (p.includes('twitter') || p.includes(' x')) return <Twitter className={className} />;
    if (p.includes('telegram')) return <Send className={className} />;
    if (p.includes('whatsapp')) return <WhatsAppIcon className={className} />;
    if (p.includes('spotify') || p.includes('music')) return <Music2 className={className} />;
    if (p.includes('discord')) return <Gamepad2 className={className} />;
    if (p.includes('linkedin')) return <Linkedin className={className} />;
    if (p.includes('traffic') || p.includes('seo')) return <Globe className={className} />;
    if (p.includes('threads')) return <MessageSquare className={className} />;
    if (p.includes('snapchat')) return <Sparkles className={className} />;
    if (p.includes('pinterest')) return <Bookmark className={className} />;
    if (p.includes('reddit')) return <Zap className={className} />;
    if (p.includes('quora')) return <MessageSquare className={className} />;
    return <TrendingUp className={className} />;
  };

  // Helper to get platform metadata
  const getPlatformMeta = (platformName: string): PlatformCardInfo => {
    const match = PLATFORMS_METADATA.find(m => m.id.toLowerCase() === platformName.toLowerCase());
    if (match) return match;
    return {
      id: platformName,
      name: platformName,
      description: `Authentic automated growth services for ${platformName}`,
      bgColor: 'hover:border-purple-500/40',
      textColor: 'group-hover:text-purple-600',
      iconBg: 'bg-purple-600 text-white',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      popularTypes: ['Engagement']
    };
  };

  // Status Badge Component
  const renderStatusBadge = (status?: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s.includes('complete')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Completed</span>
        </span>
      );
    }
    if (s.includes('progress') || s.includes('processing')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
          <RefreshCw className="w-3 h-3 text-purple-600 animate-spin" />
          <span>In Progress</span>
        </span>
      );
    }
    if (s.includes('cancel') || s.includes('refund')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
          <X className="w-3 h-3 text-rose-600" />
          <span>Cancelled & Refunded</span>
        </span>
      );
    }
    if (s.includes('partial')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          <span>Partially Fulfilled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
        <Clock className="w-3 h-3 text-blue-600" />
        <span>Pending Start</span>
      </span>
    );
  };

  // Helper to render the Admin Settings Modal
  const renderSettingsModal = () => {
    if (!isSettingsOpen) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div
          className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-[#0F172A]">
                    Boosting Service Settings
                  </h3>
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
                    Owner Controls
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#64748B]">
                  Manage Voiker provider connection, wholesale margins, and service overrides.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Tabs */}
          <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-2">
            <button
              type="button"
              onClick={() => setSettingsTab('voiker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                settingsTab === 'voiker'
                  ? 'bg-[#7C3AED] text-white shadow-2xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Voiker Provider & Pricing
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab('tiktok')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                settingsTab === 'tiktok'
                  ? 'bg-[#7C3AED] text-white shadow-2xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              TikTok Overrides
            </button>
          </div>

          {/* Tab 1: Voiker Provider & Margins */}
          {settingsTab === 'voiker' && (
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
              {/* Provider Connection Status Card */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-[#0F172A]">Upstream Provider: Voiker (SMM API v2)</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-white border border-[#E2E8F0] rounded-md text-[#64748B]">
                    https://voiker.com/api/v2
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] leading-relaxed">
                  Real-time catalogue sync active. <strong>{allServices.length.toLocaleString()}</strong> services loaded directly from Voiker network.
                </div>
              </div>

              {/* Wholesale Balance */}
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-purple-700">
                    Voiker Wholesale Account Balance
                  </div>
                  <div className="text-lg font-black text-[#0F172A] mt-0.5">
                    {isLoadingBalance ? (
                      <span className="text-xs text-[#64748B]">Checking...</span>
                    ) : voikerBalance ? (
                      <span>${voikerBalance.balanceUsd.toFixed(2)} USD <span className="text-xs font-semibold text-[#64748B]">(~₦{voikerBalance.balanceNgn.toLocaleString()})</span></span>
                    ) : hasApiKey ? (
                      <span>Connected (Key active)</span>
                    ) : (
                      <span className="text-xs text-amber-700 font-bold">VOIKER_API_KEY environment variable pending</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchVoikerBalance}
                  className="px-2.5 py-1.5 bg-white border border-purple-200 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                  <span>Check</span>
                </button>
              </div>

              {/* Pricing Controls Form */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider">
                  ZENET HUB Boosting Pricing Rules
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#475569] block mb-1">
                      Default Profit Markup (%)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={voikerPricing.defaultMarkupPercent}
                      onChange={(e) => setVoikerPricing(prev => ({ ...prev, defaultMarkupPercent: Number(e.target.value) || 45 }))}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-bold"
                    />
                    <span className="text-[9px] text-[#64748B]">Applied on top of provider wholesale cost</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#475569] block mb-1">
                      Min Margin / 1k (₦)
                    </label>
                    <input
                      type="number"
                      min="50"
                      value={voikerPricing.minMarkupPer1k}
                      onChange={(e) => setVoikerPricing(prev => ({ ...prev, minMarkupPer1k: Number(e.target.value) || 350 }))}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-bold"
                    />
                    <span className="text-[9px] text-[#64748B]">Floor margin per 1,000 units</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-[#475569] block mb-1">
                      USD to NGN Rate
                    </label>
                    <input
                      type="number"
                      min="500"
                      value={voikerPricing.usdToNgnRate}
                      onChange={(e) => setVoikerPricing(prev => ({ ...prev, usdToNgnRate: Number(e.target.value) || 1650 }))}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#475569] block mb-1">
                      Pricing Style
                    </label>
                    <select
                      value={voikerPricing.pricingStyle}
                      onChange={(e: any) => setVoikerPricing(prev => ({ ...prev, pricingStyle: e.target.value }))}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-bold"
                    >
                      <option value="natural">Natural (Exact NGN)</option>
                      <option value="clean">Clean (Nearest ₦100)</option>
                      <option value="tiered">Tiered (Nearest ₦50)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingSettings}
                  onClick={async () => {
                    setIsSavingSettings(true);
                    setSettingsSaveSuccess(false);
                    setSettingsSaveError(null);
                    try {
                      const token = await getSafeIdToken(auth.currentUser);
                      const res: any = await safeApiFetch('/api/voiker/pricing-settings', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(voikerPricing)
                      });
                      if (res && res.success) {
                        setSettingsSaveSuccess(true);
                        await loadServices();
                      } else {
                        throw new Error(res?.error || 'Failed to update settings');
                      }
                    } catch (e: any) {
                      setSettingsSaveError(e.message);
                    } finally {
                      setIsSavingSettings(false);
                    }
                  }}
                  className="w-full py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingSettings ? 'Saving...' : 'Apply & Save Pricing Rules'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: TikTok Overrides */}
          {settingsTab === 'tiktok' && (
            <div className="overflow-y-auto space-y-3 pr-1 flex-1 py-1">
              <p className="text-[11px] text-[#64748B]">
                Configure fixed prices and limits for canonical TikTok services.
              </p>
              {SETTINGS_SERVICES_LIST.map((svcDef) => {
                const cfg = configuredSettings[svcDef.id] || {
                  id: svcDef.id,
                  name: svcDef.name,
                  minQuantity: svcDef.defaultMin,
                  maxQuantity: svcDef.defaultMax,
                  pricePer1k: svcDef.defaultPrice
                };

                return (
                  <div
                    key={svcDef.id}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0F172A]">{svcDef.name}</span>
                      <span className="text-[10px] text-[#7C3AED] font-black">
                        ₦{(Number(cfg.pricePer1k) || 0).toLocaleString()} / 1,000
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-[#475569] block mb-0.5">Min</label>
                        <input
                          type="number"
                          value={cfg.minQuantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setConfiguredSettings(prev => ({
                              ...prev,
                              [svcDef.id]: { ...cfg, minQuantity: val }
                            }));
                          }}
                          className="w-full bg-white border border-[#E2E8F0] rounded px-2 py-1 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-[#475569] block mb-0.5">Max</label>
                        <input
                          type="number"
                          value={cfg.maxQuantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setConfiguredSettings(prev => ({
                              ...prev,
                              [svcDef.id]: { ...cfg, maxQuantity: val }
                            }));
                          }}
                          className="w-full bg-white border border-[#E2E8F0] rounded px-2 py-1 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-[#475569] block mb-0.5">Price / 1k (₦)</label>
                        <input
                          type="number"
                          value={cfg.pricePer1k}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setConfiguredSettings(prev => ({
                              ...prev,
                              [svcDef.id]: { ...cfg, pricePer1k: val }
                            }));
                          }}
                          className="w-full bg-white border border-[#E2E8F0] rounded px-2 py-1 text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Success / Error notification */}
          {settingsSaveSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Settings successfully synchronized and persisted!</span>
            </div>
          )}

          {settingsSaveError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{settingsSaveError}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // VIEW 1: PLATFORMS CATALOGUE (CLEAN GRID OF ALL SUPPORTED SOCIAL NETWORKS)
  // =========================================================================
  if (!selectedPlatform) {
    return (
      <div className="w-full max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 animate-in fade-in duration-150">
        {/* Top Back Navigation to Marketplace & Settings */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={onBackToMarketplace}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>

          <div className="flex items-center gap-2.5">
            {/* Wallet Balance */}
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Wallet className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Balance:</span>
              <span className="text-xs sm:text-sm font-black text-[#0F172A]">
                ₦{walletBalance.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={onOpenWallet}
                className="text-[10px] sm:text-xs font-black bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-2 py-0.5 rounded-md transition cursor-pointer ml-1"
              >
                + Top Up
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                title="Boosting Settings"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 text-[#0F172A] hover:text-[#7C3AED] border border-[#E2E8F0] hover:border-[#7C3AED]/40 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Header Section */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-[#7C3AED] border border-purple-200 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Automated Social Boosting</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Social Media Boost
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] font-medium mt-1">
            Select a platform below to supercharge your social growth, viral visibility, and audience reach.
          </p>
        </div>

        {/* Platform Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {PLATFORMS_METADATA.map((platform) => {
            // Count services for this platform
            const count = allServices.filter(s => {
              const sp = (s.platform || '').toLowerCase();
              const pl = platform.id.toLowerCase();
              return sp.includes(pl) || pl.includes(sp);
            }).length;

            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => {
                  setSelectedPlatform(platform.id);
                  setActiveTypeFilter('All');
                  setSearchQuery('');
                  setActiveSubTab('browse');
                }}
                className={`bg-white hover:bg-[#FDFCFE] border border-[#E2E8F0] ${platform.bgColor} rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between group cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-[#7C3AED]/20`}
              >
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                  {/* Platform Icon */}
                  <div className={`w-12 h-12 rounded-xl ${platform.iconBg} flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-200`}>
                    {renderPlatformIcon(platform.id, "w-6 h-6")}
                  </div>

                  {/* Title & Description */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-base sm:text-lg font-black text-[#0F172A] tracking-tight ${platform.textColor} transition-colors truncate`}>
                        {platform.name}
                      </span>
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${platform.badgeColor} rounded-full`}>
                        Active
                      </span>
                      {count > 0 && (
                        <span className="text-[10px] font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-md">
                          {count} services
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] font-medium mt-1 line-clamp-1">
                      {platform.description}
                    </p>
                  </div>
                </div>

                {/* Right Arrow */}
                <div className="w-8 h-8 rounded-full bg-[#F8FAFC] group-hover:bg-[#EDE9FE] flex items-center justify-center text-[#94A3B8] group-hover:text-[#7C3AED] transition-colors shrink-0 ml-2">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Owner Settings Modal */}
        {renderSettingsModal()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PLATFORM SERVICES VIEW (SERVICES CATALOGUE FOR CHOSEN PLATFORM)
  // =========================================================================
  const currentMeta = getPlatformMeta(selectedPlatform);

  return (
    <div className="w-full max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-6 animate-in fade-in duration-150">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => setSelectedPlatform(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Platforms</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* User Wallet Balance Badge */}
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Wallet className="w-4 h-4 text-[#7C3AED]" />
            <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Balance:</span>
            <span className="text-xs sm:text-sm font-black text-[#0F172A]">
              ₦{walletBalance.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={onOpenWallet}
              className="text-[10px] sm:text-xs font-black bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-2 py-0.5 rounded-md transition cursor-pointer ml-1"
            >
              + Top Up
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Boosting Settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 text-[#0F172A] hover:text-[#7C3AED] border border-[#E2E8F0] hover:border-[#7C3AED]/40 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Platform Title Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 mb-6 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${currentMeta.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
              {renderPlatformIcon(selectedPlatform, "w-7 h-7")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                  {selectedPlatform} Boost Services
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
                  Voiker Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] font-medium mt-0.5">
                {currentMeta.description}
              </p>
            </div>
          </div>

          {/* Subtabs: Browse Services vs My Orders */}
          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('browse')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'browse'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Browse Services
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('orders')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'orders'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>My Orders</span>
              {orders.length > 0 && (
                <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black">
                  {orders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ======================= SUBTAB: BROWSE SERVICES ======================= */}
      {activeSubTab === 'browse' && (
        <div className="space-y-4">
          {/* Controls: Search and Filter Pills */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${selectedPlatform} services by name, speed, or type...`}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#7C3AED] focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {dynamicFilterCategories.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveTypeFilter(filter)}
                  className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                    activeTypeFilter === filter
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A]'
                  }`}
                >
                  {filter}
                </button>
              ))}
              <span className="text-[11px] text-[#94A3B8] ml-auto shrink-0 font-medium hidden sm:inline">
                {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'} available
              </span>
            </div>
          </div>

          {/* Services List */}
          {isLoadingServices ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 text-[#7C3AED] animate-spin mb-3" />
              <p className="text-sm font-semibold text-[#64748B]">Loading live Voiker services...</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center flex flex-col items-center justify-center">
              <AlertCircle className="w-8 h-8 text-[#94A3B8] mb-2" />
              <h3 className="text-base font-bold text-[#0F172A]">No {selectedPlatform} services found</h3>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Try searching with a different keyword or resetting your filter.
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setActiveTypeFilter('All'); }}
                className="mt-4 px-4 py-2 bg-purple-50 text-[#7C3AED] font-bold text-xs rounded-xl hover:bg-purple-100 transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredServices.map((service, index) => {
                const rate = service.ratePer1000 || service.pricePerThousandNgn || 1500;
                return (
                  <div
                    key={`${service.id}-${index}`}
                    className="bg-white border border-[#E2E8F0] hover:border-[#7C3AED]/40 rounded-xl sm:rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4"
                  >
                    {/* Service Info */}
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-[10px] sm:text-[11px] font-bold text-[#475569]">
                          {getTypeIcon(service.type || service.category)}
                          <span>{service.type || service.category || selectedPlatform}</span>
                        </span>
                        {service.isBestValue && (
                          <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                            Best Value
                          </span>
                        )}
                        {service.isCheapest && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                            Cheapest
                          </span>
                        )}
                        {service.refill && (
                          <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-[9px] sm:text-[10px] font-bold">
                            Refill Guaranteed
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs sm:text-sm font-extrabold text-[#0F172A] leading-tight">
                        {service.name}
                      </h3>

                      {service.description && (
                        <p className="text-[11px] text-[#64748B] line-clamp-1 leading-normal">
                          {service.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 sm:gap-2.5 text-[10px] sm:text-[11px] text-[#64748B] pt-0.5 flex-wrap">
                        <span>Min: <strong className="text-[#0F172A]">{(service.min || 10).toLocaleString()}</strong></span>
                        <span>•</span>
                        <span>Max: <strong className="text-[#0F172A]">{(service.max || 100000).toLocaleString()}</strong></span>
                        {service.deliverySpeed && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              <span>{service.deliverySpeed}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Price and Action Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F1F5F9]">
                      <div className="text-left sm:text-right">
                        <div className="text-sm sm:text-base font-black text-[#7C3AED]">
                          ₦{rate.toLocaleString()}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
                          per 1,000 units
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenOrderModal(service)}
                        className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black rounded-xl shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        <span>Boost Now</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================= SUBTAB: MY ORDERS ======================= */}
      {activeSubTab === 'orders' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0F172A]">
              My Boosting Orders ({orders.length})
            </h2>
            <button
              type="button"
              onClick={fetchOrders}
              disabled={isLoadingOrders}
              className="inline-flex items-center gap-1.5 text-xs text-[#7C3AED] hover:text-[#6D28D9] font-bold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {actionNotification && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 ${
              actionNotification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {actionNotification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{actionNotification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNotification(null)}
                className="text-[#64748B] hover:text-[#0F172A] p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {!user ? (
            <div className="text-center py-8">
              <p className="text-xs sm:text-sm text-[#64748B] mb-3">Please sign in to view your order history.</p>
              <button
                type="button"
                onClick={() => onOpenAuth && onOpenAuth('login')}
                className="px-4 py-2 bg-[#7C3AED] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Log In
              </button>
            </div>
          ) : isLoadingOrders ? (
            <div className="text-center py-8">
              <RefreshCw className="w-5 h-5 text-[#7C3AED] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#64748B]">Synchronizing order statuses from provider...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingBag className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-bold text-[#0F172A]">No boosting orders found</p>
              <p className="text-xs text-[#64748B] mt-1">Select any service from the Browse tab to place your first boost!</p>
              <button
                type="button"
                onClick={() => setActiveSubTab('browse')}
                className="mt-3 px-4 py-2 bg-purple-50 text-[#7C3AED] text-xs font-bold rounded-xl hover:bg-purple-100 cursor-pointer"
              >
                Browse Services
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Cost</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Refill / Cancel</th>
                    <th className="py-2.5 px-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {orders.map((ord: any) => {
                    const orderIdStr = ord.orderId || ord.id || 'N/A';
                    const isPending = ['pending', 'awaiting'].includes((ord.status || '').toLowerCase());
                    const canRefill = Boolean(ord.refill && ord.providerOrderId && ['completed', 'in_progress'].includes((ord.status || '').toLowerCase()));
                    const canCancel = Boolean(ord.cancel && ord.providerOrderId && isPending);
                    const isLoadingThis = actionLoadingOrderId === ord.id;

                    return (
                      <tr key={orderIdStr} className="hover:bg-[#F8FAFC] transition">
                        <td className="py-3 px-3 font-mono text-[11px] text-[#0F172A]">
                          <div className="flex items-center gap-1.5">
                            <span>{orderIdStr}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(orderIdStr, orderIdStr)}
                              className="text-[#94A3B8] hover:text-[#0F172A] p-0.5 cursor-pointer"
                            >
                              {copiedId === orderIdStr ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          {ord.providerOrderId && (
                            <span className="text-[9px] text-[#64748B] block mt-0.5">
                              Provider #{ord.providerOrderId}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#0F172A] line-clamp-1 max-w-[200px]">
                            {ord.serviceName || ord.service || 'Boosting Service'}
                          </div>
                          <span className="text-[10px] text-[#64748B]">
                            {ord.platform || selectedPlatform}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-[11px] text-[#475569] truncate block max-w-[160px]" title={ord.target || ord.link}>
                            {ord.target || ord.link}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#0F172A]">
                          {(ord.quantity || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-black text-[#7C3AED]">
                          ₦{(ord.totalCharge || ord.price || ord.charge || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          {renderStatusBadge(ord.status)}
                          {ord.remains !== undefined && ord.remains !== null && (
                            <span className="text-[9px] text-[#64748B] block mt-0.5">
                              Remains: {ord.remains}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {canRefill && (
                              <button
                                type="button"
                                onClick={() => handleRefillOrder(ord)}
                                disabled={isLoadingThis}
                                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold cursor-pointer transition disabled:opacity-50"
                              >
                                {isLoadingThis ? '...' : 'Refill'}
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(ord)}
                                disabled={isLoadingThis}
                                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold cursor-pointer transition disabled:opacity-50"
                              >
                                {isLoadingThis ? '...' : 'Cancel'}
                              </button>
                            )}
                            {!canRefill && !canCancel && (
                              <span className="text-[10px] text-[#94A3B8]">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-[11px] text-[#94A3B8] whitespace-nowrap">
                          {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : 'Recent'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================= ORDER PLACEMENT MODAL ======================= */}
      {selectedService && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={handleCloseOrderModal}
                  className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED]">
                    {selectedService.platform || selectedPlatform} • {selectedService.type || selectedService.category}
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] truncate">
                    {selectedService.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseOrderModal}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
              {/* Rate & Features Header */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block">Price per 1,000 units</span>
                  <span className="text-base font-black text-[#7C3AED]">
                    ₦{(selectedService.ratePer1000 || selectedService.pricePerThousandNgn || 1500).toLocaleString()}
                  </span>
                </div>
                <div className="text-right text-[11px] text-[#64748B]">
                  <span>Min: <strong>{(selectedService.min || 10).toLocaleString()}</strong></span>
                  <span className="mx-1">•</span>
                  <span>Max: <strong>{(selectedService.max || 100000).toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Dynamic Target Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] block">
                  {selectedService.inputLabel || `${selectedPlatform} Target URL or @Username`}
                </label>
                {selectedService.inputType === 'custom_comments' ? (
                  <textarea
                    rows={4}
                    value={orderComments}
                    onChange={(e) => setOrderComments(e.target.value)}
                    placeholder="Enter custom comments (1 comment per line)...&#10;Great post!&#10;Awesome content!"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] font-medium focus:outline-hidden focus:border-[#7C3AED] focus:bg-white transition"
                  />
                ) : (
                  <input
                    type="text"
                    value={orderTarget}
                    onChange={(e) => setOrderTarget(e.target.value)}
                    placeholder={selectedService.inputPlaceholder || `https://${selectedPlatform?.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/...`}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] font-medium focus:outline-hidden focus:border-[#7C3AED] focus:bg-white transition"
                  />
                )}
                <span className="text-[10px] text-[#64748B] block">
                  Ensure account/post is set to <strong>Public</strong> before placing order.
                </span>
              </div>

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0F172A]">Quantity to Boost</label>
                  <span className="text-[10px] text-[#64748B]">
                    Min: {(selectedService.min || 10).toLocaleString()} | Max: {(selectedService.max || 100000).toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  min={selectedService.min || 10}
                  max={selectedService.max || 100000}
                  step={50}
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Number(e.target.value) || 0)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] font-extrabold focus:outline-hidden focus:border-[#7C3AED] focus:bg-white transition"
                />

                {/* Quick Select Buttons */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {[selectedService.min, 500, 1000, 2500, 5000, 10000].filter(q => q >= (selectedService.min || 10) && q <= (selectedService.max || 100000)).map(qty => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setOrderQuantity(qty)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        orderQuantity === qty
                          ? 'bg-purple-100 text-[#7C3AED] border-purple-300'
                          : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {qty.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Calculation & Wallet Check */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Total Charge:</span>
                  <span className="text-base font-black text-[#7C3AED]">
                    ₦{calculatedCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-purple-200/60">
                  <span className="text-[#64748B]">Your Wallet Balance:</span>
                  <span className="font-extrabold text-[#0F172A]">₦{walletBalance.toLocaleString()}</span>
                </div>

                {walletBalance < calculatedCost && (
                  <div className="text-[11px] text-rose-600 font-bold flex items-center justify-between pt-1">
                    <span>Shortfall: ₦{(calculatedCost - walletBalance).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseOrderModal();
                        onOpenWallet();
                      }}
                      className="underline hover:text-rose-700 cursor-pointer"
                    >
                      + Fund Wallet
                    </button>
                  </div>
                )}
              </div>

              {/* Order Error Notification */}
              {orderError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{orderError}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={handleCloseOrderModal}
                disabled={isSubmittingOrder}
                className="px-4 py-2 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isSubmittingOrder || walletBalance < calculatedCost}
                className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                {isSubmittingOrder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Confirm & Pay ₦{calculatedCost.toLocaleString()}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= ORDER SUCCESS MODAL ======================= */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-[#0F172A]">Order Successfully Placed!</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Your boost request has been submitted to the provider and automated delivery will begin shortly.
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 text-left text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Order ID:</span>
                <span className="font-mono font-bold text-[#0F172A]">{orderSuccess.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Service:</span>
                <span className="font-extrabold text-[#0F172A] truncate max-w-[200px]">{orderSuccess.serviceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Quantity:</span>
                <span className="font-bold text-[#0F172A]">{(orderSuccess.quantity || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Amount Paid:</span>
                <span className="font-black text-[#7C3AED]">₦{(orderSuccess.charge || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setOrderSuccess(null);
                  setActiveSubTab('orders');
                }}
                className="w-full py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black rounded-xl transition shadow-xs cursor-pointer"
              >
                Track in My Orders
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner Settings Modal */}
      {renderSettingsModal()}
    </div>
  );
};

export default SocialBoostView;

