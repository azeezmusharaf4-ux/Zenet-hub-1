import { TikTokServiceConfig } from '../types';

export const DEFAULT_TIKTOK_SERVICES: TikTokServiceConfig[] = [
  {
    id: 'followers',
    name: 'Real TikTok Followers',
    category: 'TikTok',
    targetType: 'profile_url',
    pricePer1k: 3500,
    minQuantity: 100,
    maxQuantity: 50000,
    status: 'active',
    description: 'Real audience follower growth for creator profiles & business accounts.',
    badge: 'Profile Growth',
    deliverySpeed: 'Organic delivery within 1-24 hours'
  },
  {
    id: 'likes',
    name: 'Real TikTok Likes',
    category: 'TikTok',
    targetType: 'video_url',
    pricePer1k: 1800,
    minQuantity: 50,
    maxQuantity: 25000,
    status: 'active',
    description: 'Genuine viewer heart likes to boost content engagement signals.',
    badge: 'High Engagement',
    deliverySpeed: 'Steady natural pace'
  },
  {
    id: 'comments',
    name: 'Real TikTok Comments',
    category: 'TikTok',
    targetType: 'video_url',
    requiresComments: true,
    pricePer1k: 6500,
    minQuantity: 10,
    maxQuantity: 2000,
    status: 'active',
    description: 'Custom relevant discussion comments submitted for your specific video.',
    badge: 'Custom Discussion',
    deliverySpeed: 'Gradual natural delivery'
  },
  {
    id: 'shares',
    name: 'Real TikTok Shares',
    category: 'TikTok',
    targetType: 'video_url',
    pricePer1k: 2200,
    minQuantity: 50,
    maxQuantity: 20000,
    status: 'active',
    description: 'Authentic share counts to trigger TikTok recommendation and distribution algorithms.',
    badge: 'Algorithm Boost',
    deliverySpeed: 'Fast distribution'
  },
  {
    id: 'favorites',
    name: 'Real TikTok Favorites',
    category: 'TikTok',
    targetType: 'video_url',
    pricePer1k: 2000,
    minQuantity: 50,
    maxQuantity: 20000,
    status: 'active',
    description: 'Authentic TikTok bookmark favorites to strengthen video recommendation signals.',
    badge: 'Bookmark Saves',
    deliverySpeed: 'Fast distribution'
  },
  {
    id: 'views',
    name: 'Real TikTok Views',
    category: 'TikTok',
    targetType: 'video_url',
    pricePer1k: 450,
    minQuantity: 500,
    maxQuantity: 500000,
    status: 'active',
    description: 'Expand your video reach and algorithmic discovery across the For You page.',
    badge: 'Viral Reach',
    deliverySpeed: 'Starts in 5-15 minutes'
  }
];

export const calculateServiceCost = (quantity: number, pricePer1k: number): number => {
  if (!quantity || quantity <= 0) return 0;
  return Math.max(1, Math.round((quantity / 1000) * pricePer1k));
};

export const validateTikTokUrl = (targetType: 'profile_url' | 'video_url', url: string): { isValid: boolean; message?: string } => {
  const clean = (url || '').trim();
  if (!clean) {
    return { 
      isValid: false, 
      message: targetType === 'profile_url' ? 'Please enter a TikTok profile URL or username.' : 'Please enter a TikTok video URL.' 
    };
  }

  if (targetType === 'profile_url') {
    // Accepts https://www.tiktok.com/@username, tiktok.com/@username, or @username
    if (clean.startsWith('@') && clean.length > 2) {
      return { isValid: true };
    }
    const isTikTokDomain = clean.includes('tiktok.com');
    if (!isTikTokDomain && !clean.startsWith('@')) {
      return { isValid: false, message: 'Please enter a valid TikTok profile link (e.g., https://www.tiktok.com/@username or @username).' };
    }
    return { isValid: true };
  } else {
    // Video URL: must include tiktok.com or vm.tiktok.com or vt.tiktok.com
    const isTikTok = clean.includes('tiktok.com');
    if (!isTikTok) {
      return { isValid: false, message: 'Please enter a valid TikTok video URL (e.g., https://www.tiktok.com/@username/video/123456789...).' };
    }
    return { isValid: true };
  }
};
