import { CategoryType } from '../types';

export const ALL_CATEGORIES: CategoryType[] = [
  'All',
  'Facebook',
  'Instagram',
  'TikTok',
  'YouTube',
  'Gmail',
  'Twitter/X',
  'Telegram',
  'WhatsApp',
  'Discord',
  'Reddit',
  'Snapchat',
  'LinkedIn',
  'Pinterest',
  'Threads',
  'Other'
];

export const normalizeCategory = (catStr: string): CategoryType => {
  if (!catStr) return 'Other';
  const lower = catStr.trim().toLowerCase();
  if (lower.includes('facebook') || lower.includes('fb')) return 'Facebook';
  if (lower.includes('instagram') || lower.includes('insta') || lower === 'ig') return 'Instagram';
  if (lower.includes('tiktok') || lower.includes('tok')) return 'TikTok';
  if (lower.includes('youtube') || lower.includes('yt')) return 'YouTube';
  if (lower.includes('gmail') || lower.includes('google') || lower.includes('pva')) return 'Gmail';
  if (lower.includes('twitter') || lower.includes('x') || lower.includes('twitter/x')) return 'Twitter/X';
  if (lower.includes('telegram') || lower.includes('tg')) return 'Telegram';
  if (lower.includes('whatsapp') || lower.includes('wa')) return 'WhatsApp';
  if (lower.includes('discord')) return 'Discord';
  if (lower.includes('reddit')) return 'Reddit';
  if (lower.includes('snapchat') || lower.includes('snap')) return 'Snapchat';
  if (lower.includes('linkedin')) return 'LinkedIn';
  if (lower.includes('pinterest')) return 'Pinterest';
  if (lower.includes('threads')) return 'Threads';
  return 'Other';
};

export const isCategoryMatch = (itemCategory: string | undefined | null, selectedCategory: CategoryType): boolean => {
  if (!selectedCategory || selectedCategory === 'All') return true;
  if (!itemCategory) return selectedCategory === 'Other';
  
  if (itemCategory === selectedCategory) return true;
  if (itemCategory.trim().toLowerCase() === selectedCategory.trim().toLowerCase()) return true;

  const normItem = normalizeCategory(itemCategory);
  const normSelected = normalizeCategory(selectedCategory);
  return normItem === normSelected;
};
