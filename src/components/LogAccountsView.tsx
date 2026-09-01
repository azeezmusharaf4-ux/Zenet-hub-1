import React, { useState, useMemo } from 'react';
import { 
  Globe, 
  CreditCard, 
  ArrowLeft, 
  Search, 
  ShoppingCart, 
  Sparkles,
  Layers,
  Database
} from 'lucide-react';
import { UserProfile, AccountListing, CategoryType } from '../types';
import { ListingCard } from './ListingCard';

interface LogAccountsViewProps {
  userProfile: UserProfile;
  walletBalance: number;
  listings: AccountListing[];
  listingsLoading: boolean;
  savedListingIdsSet: Set<string>;
  categoryFilter: CategoryType | 'All';
  onCategoryFilterChange: (cat: CategoryType | 'All') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefreshProfile: () => void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onSelectListing: (listing: AccountListing) => void;
  onContactSeller: (listing: AccountListing) => void;
  onBuyNow: (listing: AccountListing) => void;
  onToggleSave: (listingId: string) => void;
  onViewSellerProfile: (sellerId: string, sellerName: string) => void;
  onDeleteListing?: (listingId: string) => void;
}

const LOG_CATEGORIES: { name: CategoryType | 'All'; label: string; countColor: string }[] = [
  { name: 'All', label: 'All Logs', countColor: 'text-purple-400' },
  { name: 'Facebook', label: 'Facebook Logs', countColor: 'text-blue-400' },
  { name: 'Instagram', label: 'Instagram', countColor: 'text-pink-400' },
  { name: 'TikTok', label: 'TikTok Logs', countColor: 'text-cyan-400' },
  { name: 'Gmail', label: 'Gmail / Google', countColor: 'text-red-400' },
  { name: 'Twitter/X', label: 'Twitter/X', countColor: 'text-slate-200' },
  { name: 'Telegram', label: 'Telegram Logs', countColor: 'text-sky-400' },
  { name: 'Discord', label: 'Discord', countColor: 'text-indigo-400' },
  { name: 'WhatsApp', label: 'WhatsApp', countColor: 'text-emerald-400' },
  { name: 'YouTube', label: 'YouTube Logs', countColor: 'text-rose-500' },
  { name: 'Other', label: 'Other Accounts', countColor: 'text-purple-300' }
];

export const LogAccountsView: React.FC<LogAccountsViewProps> = ({
  userProfile,
  walletBalance,
  listings,
  listingsLoading,
  savedListingIdsSet,
  categoryFilter,
  onCategoryFilterChange,
  searchQuery,
  onSearchChange,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet,
  onSelectListing,
  onContactSeller,
  onBuyNow,
  onToggleSave,
  onViewSellerProfile,
  onDeleteListing
}) => {

  // Sort and filter listings
  const filteredAndSortedListings = useMemo(() => {
    // 1. Exclude virtual numbers and sold items
    let activeListings = listings.filter(item => item.status !== 'sold');

    // 2. Apply Category Filter
    if (categoryFilter !== 'All') {
      activeListings = activeListings.filter(item => item.category === categoryFilter);
    }
    
    // 3. Apply Search Query Filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      activeListings = activeListings.filter(item => {
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        const matchesCategory = item.category?.toLowerCase().includes(query);
        const matchesSeller = item.sellerName?.toLowerCase().includes(query);
        return matchesTitle || matchesDesc || matchesCategory || matchesSeller;
      });
    }

    // 4. Alphabetical Sorting: Primary by Category Name, Secondary by Product Title
    return [...activeListings].sort((a, b) => {
      const catA = (a.category || '').toLowerCase();
      const catB = (b.category || '').toLowerCase();
      
      if (catA !== catB) {
        return catA.localeCompare(catB);
      }
      
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
  }, [listings, categoryFilter, searchQuery]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    listings.forEach(item => {
      if (item.status !== 'sold') {
        counts[item.category] = (counts[item.category] || 0) + 1;
      }
    });
    return counts;
  }, [listings]);

  return (
    <div className="w-full max-w-full space-y-6">
      
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#210f3f]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMarketplace}
            className="flex items-center gap-2 text-purple-300 hover:text-white font-extrabold text-xs transition bg-[#170c30] px-4 py-2.5 rounded-xl border border-purple-900/30 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>
          
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/20 border border-purple-500/10 text-[11px] font-bold text-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Alphabetically Sorted Inventory Sync</span>
          </div>
        </div>
      </div>

      {/* Headline banner */}
      <div className="space-y-1.5">
        <h3 className="font-black text-white text-lg sm:text-xl flex items-center gap-2 tracking-tight">
          <Database className="w-5 h-5 text-purple-400" />
          <span>Premium Log Accounts Store</span>
        </h3>
        <p className="text-xs text-purple-300/60 leading-relaxed max-w-2xl">
          Instantly buy, preview, or bookmark verified aged logs, developer profiles, and social accounts matching your direct search specifications. Sorted alphabetically by category.
        </p>
      </div>

      {/* Search & Tactical Filtering Tools */}
      <div className="flex flex-col gap-4">
        
        {/* Sleek Search Bar */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-purple-400/50">
            <Search className="w-4.5 h-4.5" />
          </div>
          <input
            type="text"
            placeholder="Search account logs (e.g. 'Aged Facebook', '50K followers Instagram', '2FA Gmail')..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#110724] border border-[#2e1850] focus:border-purple-500/50 text-white placeholder-purple-300/30 text-xs sm:text-sm pl-11 pr-4 py-3 rounded-2xl focus:outline-none transition-all duration-300 shadow-inner"
          />
        </div>

        {/* Horizontal Category Filtering Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {LOG_CATEGORIES.map((cat) => {
            const count = cat.name === 'All' 
              ? listings.filter(item => item.status !== 'sold').length 
              : (categoryCounts[cat.name] || 0);
            
            const isSelected = categoryFilter === cat.name;

            return (
              <button
                key={cat.name}
                onClick={() => onCategoryFilterChange(cat.name)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 border cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/20'
                    : 'bg-[#120824] hover:bg-[#1a0c33] text-purple-300 border-[#281546]'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] font-black bg-black/40 px-1.5 py-0.5 rounded-md ${cat.countColor}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real Inventory Display Grid */}
      {listingsLoading ? (
        <div className="h-64 bg-[#0f0721]/30 border border-dashed border-[#251347] rounded-3xl flex flex-col items-center justify-center gap-3 text-sm text-purple-400 font-bold">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <span>Synchronizing existing accounts inventory...</span>
        </div>
      ) : filteredAndSortedListings.length === 0 ? (
        <div className="bg-[#0f0721]/30 border border-dashed border-[#251347] rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto my-6">
          <ShoppingCart className="w-12 h-12 text-purple-500/40 mx-auto" />
          <div className="space-y-1">
            <h4 className="font-black text-white text-base">No Matching Logs Available</h4>
            <p className="text-xs text-purple-300/60 leading-relaxed">
              There are currently no active listings that match your filter or search query. Try choosing a different category or clearing your search term.
            </p>
          </div>
          <button
            onClick={() => {
              onCategoryFilterChange('All');
              onSearchChange('');
            }}
            className="px-4 py-2 bg-purple-600/15 hover:bg-purple-600/30 text-purple-200 border border-purple-500/20 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredAndSortedListings.map((item) => (
            <ListingCard
              key={item.id}
              listing={item}
              onSelect={onSelectListing}
              onContact={onContactSeller}
              onBuyNow={onBuyNow}
              isSaved={savedListingIdsSet.has(item.id)}
              onToggleSave={onToggleSave}
              onViewSellerProfile={onViewSellerProfile}
              onDelete={onDeleteListing}
              canDelete={userProfile?.role === 'owner' || userProfile?.email?.trim().toLowerCase() === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'admin' || (userProfile?.role === 'seller' && userProfile.uid === item.sellerId)}
            />
          ))}
        </div>
      )}

    </div>
  );
};
