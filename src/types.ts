export type CategoryType = 
  | 'All' 
  | 'Facebook' 
  | 'Instagram' 
  | 'TikTok' 
  | 'Gmail' 
  | 'Twitter/X' 
  | 'Telegram' 
  | 'Discord' 
  | 'Reddit' 
  | 'Snapchat' 
  | 'LinkedIn' 
  | 'Pinterest' 
  | 'Threads' 
  | 'WhatsApp' 
  | 'YouTube' 
  | 'Other';

export interface DigitalProductDetails {
  inventoryId?: string;
  accountEmail?: string;
  accountPassword?: string;
  recoveryInfo?: string;
  backupCodes?: string;
  twoFactorSecretKey?: string;
  twoFactorBackupCodes?: string;
  additionalInstructions?: string;
}

export interface InventoryAccountItem {
  id: string;
  listingId?: string;
  accountEmail: string;
  accountPassword?: string;
  recoveryInfo?: string;
  notes?: string;
  backupCodes?: string;
  twoFactorSecretKey?: string;
  twoFactorBackupCodes?: string;
  additionalInstructions?: string;
  status: 'Available' | 'Sold' | 'available' | 'sold';
  soldAt?: string | null;
  soldTo?: string | null;
  soldToEmail?: string | null;
  orderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountListing {
  id: string;
  title: string;
  category: CategoryType;
  price: number; // in NGN
  followers?: string; // e.g. "125.4K", "10K Friends", "2,500 Accounts"
  accountAge?: string; // e.g. "5 Years Old (2019)", "Aged 3+ Yrs"
  pva: boolean; // Phone Verified Account
  monetized?: boolean; // Monetization / Creator Fund enabled
  twoFactor: boolean; // 2FA included / enabled
  warrantyDays: number; // e.g. 7 or 14 days warranty
  description: string;
  sellerId: string;
  creatorId?: string; // Product Creator UID for strict Admin product management control
  createdBy?: string; // Product Creator UID alias
  creatorEmail?: string; // Product Creator Email
  creatorRole?: string; // Product Creator Role
  owner_id?: string; // Product Owner UID for RBAC authorization
  sellerName: string;
  sellerEmail: string;
  sellerWhatsapp?: string;
  sellerTelegram?: string;
  sellerRating?: number; // e.g. 4.9
  sellerSalesCount?: number;
  status: 'active' | 'sold' | 'reserved';
  stock?: number; // e.g. 5 stock remaining
  stockCount?: number; // Calculated count of available inventory
  inventory?: InventoryAccountItem[]; // Array of inventory items
  deliveryTime?: string; // e.g. "Instant (1-5 mins)"
  isVerified?: boolean; // Verified badge
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  featured?: boolean;
  imageUrl?: string;
  images?: string[];
  badges?: string[];
  createdAt: string;
  country?: string;
  niche?: string;
  digitalProductDetails?: DigitalProductDetails;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  fullName?: string;
  phoneNumber?: string;
  photoURL?: string;
  whatsapp?: string;
  telegram?: string;
  bio?: string;
  preferredCurrency?: 'USD' | 'NGN' | 'EUR' | 'GBP' | string;
  emailNotifications?: boolean;
  createdAt: string;
  role?: 'owner' | 'admin' | 'seller' | 'buyer' | 'manager' | 'customer';
  status?: 'active' | 'suspended';
  walletBalance?: number;
  paystackCustomerCode?: string;
  referralCode?: string;
  referredBy?: string;
  totalPurchasesAmount?: number;
  referralRewardClaimed?: boolean;
  referralCount?: number;
  totalReferralEarnings?: number;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUserEmail: string;
  referredUserName?: string;
  referredAt: string;
  totalSpent: number;
  rewardClaimed: boolean;
  rewardAmount: number;
  rewardClaimedAt?: string;
}

export interface SellerReview {
  id: string;
  sellerId: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  listingTitle?: string;
}

export interface PurchaseRecord {
  id: string;
  listingId: string;
  listingTitle: string;
  category: CategoryType;
  price: number;
  paidAmount?: number;
  currency?: string;
  sellerId: string;
  sellerName: string;
  sellerEmail?: string;
  buyerId: string;
  buyerName?: string;
  buyerEmail?: string;
  paymentGateway?: 'paystack' | 'wallet' | 'bank_transfer' | string;
  transactionId?: string;
  purchasedAt: string;
  status: 'completed' | 'escrow_holding' | 'disputed' | string;
  transferCode?: string;
  imageUrl?: string;
  digitalProductDetails?: DigitalProductDetails;
  type?: 'account' | 'virtual_number' | string;
  phoneNumber?: string;
  smsCode?: string;
  orderStatus?: string;
  smsText?: string;
}

export interface Inquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  sellerId: string;
  message: string;
  createdAt: string;
  status: 'unread' | 'read' | 'replied';
  replyMessage?: string;
  repliedAt?: string;
}

export interface ReportItem {
  id: string;
  targetId: string; // listingId or sellerId
  targetTitle: string;
  targetType: 'listing' | 'seller' | 'user';
  reporterId: string;
  reporterEmail: string;
  reporterName: string;
  reason: string;
  details: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
  adminNotes?: string;
}

export interface WalletTransaction {
  id: string;
  userId?: string;
  type: 'deposit' | 'purchase' | 'sale_escrow' | 'escrow_release' | 'withdrawal' | 'referral_bonus';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  reference?: string;
  channel?: string;
}

export type VirtualNumberActivationState = 
  | 'available'
  | 'purchasing'
  | 'waiting_for_sms'
  | 'active'
  | 'sms_received'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed'
  | 'WAITING'
  | 'SMS_RECEIVED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface VirtualNumberOrder {
  orderId: string;
  providerActivationId?: string;
  userId: string;
  userEmail?: string;
  server: string;
  country: string;
  service: string;
  phoneNumber: string;
  status: VirtualNumberActivationState;
  price: number;
  customerPrice?: number;
  providerCost?: number;
  markup?: number;
  isRealOrder?: boolean;
  code?: string;
  smsText?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'owner' | 'admin' | 'user';
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole?: string;
  category: 'product_issue' | 'order_dispute' | 'payment_escrow' | 'delivery' | 'account' | 'report' | 'general' | string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
  adminResponse?: string;
  respondedBy?: string;
  isReadByAdmin?: boolean;
  isReadByUser?: boolean;
  messages?: TicketMessage[];
}

export interface ZenedUpdateProduct {
  id: string;
  name: string;
  price: number; // in NGN
  description: string;
  imageUrl?: string;
  category?: string;
  stock?: number;
  status: 'active' | 'out_of_stock' | 'sold';
  secretDeliveryInfo?: string; // Private info delivered post-purchase
  privateDeliveryLink?: string; // Private delivery URL/link
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ZenedUpdateOrder {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  price: number; // in NGN
  buyerId: string;
  userId?: string;
  buyerEmail: string;
  buyerName: string;
  secretDeliveryInfo: string;
  purchasedAt: string;
  status: 'completed' | string;
  transactionId?: string;
}

export interface SocialBoostService {
  id: string;
  platform: 'TikTok' | 'Instagram' | 'Facebook' | 'YouTube' | 'Twitter/X' | 'Telegram' | 'Spotify' | 'Threads' | 'Other' | string;
  category: string;
  name: string;
  type: 'Followers' | 'Likes' | 'Views' | 'Comments' | 'Shares' | 'Subscribers' | 'Members' | 'Watch Hours' | 'Plays' | 'Reactions' | 'Other' | string;
  ratePer1000: number; // Customer selling price per 1,000 in NGN
  providerRatePer1000?: number; // Upstream provider cost per 1,000 (Owner only)
  markupPer1000?: number; // Margin per 1,000 (Owner only)
  providerServiceId?: string | number; // Provider upstream service ID (Owner only)
  min: number;
  max: number;
  description?: string;
  deliverySpeed?: string;
  refill?: boolean;
  quality?: string;
  isActive: boolean;
  isBestValue?: boolean;
  isCheapest?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputType?: 'link' | 'username' | 'custom_comments';
}

export interface SocialBoostOrder {
  id: string;
  orderId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  platform: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  target: string;
  quantity: number;
  charge: number; // in NGN
  providerCost?: number;
  markup?: number;
  profit?: number;
  providerOrderId?: string;
  status: 'pending' | 'in_progress' | 'processing' | 'completed' | 'partial' | 'canceled' | string;
  startCount?: number;
  remains?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface SocialBoostPricingSettings {
  defaultMarkupPercent: number; // e.g. 45% markup
  minMarkupPer1k: number; // e.g. 350 NGN min markup per 1k
  pricingStyle?: 'natural' | 'clean' | 'tiered';
  platformStatus: Record<string, boolean>;
  disabledServices?: string[];
  curatedServiceIds?: string[]; // IDs of services explicitly approved by Owner
  bestValueServiceIds?: Record<string, string>; // platform -> serviceId for best value pick
  serviceOverrides?: Record<string, {
    customRatePer1000?: number;
    customMarkupPercent?: number;
    enabled?: boolean;
    isBestValue?: boolean;
  }>;
}

export type ActiveAppView = 
  | 'landing'
  | 'marketplace' 
  | 'virtual-numbers'
  | 'virtual-numbers-2'
  | 'log-accounts'
  | 'social-boost'
  | 'social-boost-2'
  | 'zened-update'
  | 'dashboard' 
  | 'categories' 
  | 'orders' 
  | 'wallet' 
  | 'deposit-history'
  | 'seller'
  | 'referrals'
  | 'messages' 
  | 'saved' 
  | 'profile' 
  | 'settings' 
  | 'support'
  | 'admin_wallets';

export interface FilterState {
  category: CategoryType;
  searchQuery: string;
  minPrice: number;
  maxPrice: number;
  pvaOnly: boolean;
  monetizedOnly: boolean;
  twoFactorOnly: boolean;
  countryFilter?: string; // e.g. "Nigeria", "All"
  sortBy: 'newest' | 'price-asc' | 'price-desc' | 'popular';
}

