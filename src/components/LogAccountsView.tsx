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
import { isAuthorizedOwner } from '../lib/authorizedOwners';
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
    let activeListings = listings.filter(item => {
      if (item.status === 'sold') return false;
      const invAvail = Array.isArray(item.inventory)
        ? item.inventory.filter((acc: any) => (acc.status || '').toLowerCase() !== 'sold').length
        : undefined;
      const stock = item.stockCount !== undefined ? item.stockCount : (item.stock !== undefined ? item.stock : 1);
      const effectiveStock = invAvail !== undefined ? invAvail : stock;
      return effectiveStock > 0;
    });

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
        const invAvail = Array.isArray(item.inventory)
          ? item.inventory.filter((acc: any) => (acc.status || '').toLowerCase() !== 'sold').length
          : undefined;
        const stock = item.stockCount !== undefined ? item.stockCount : (item.stock !== undefined ? item.stock : 1);
        const effectiveStock = invAvail !== undefined ? invAvail : stock;
        if (effectiveStock > 0) {
          counts[item.category] = (counts[item.category] || 0) + 1;
        }
      }
    });
    return counts;
  }, [listings]);

  return (
    <div className="w-full max-w-full space-y-6">
      
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDE9FE]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMarketplace}
            className="flex items-center gap-2 text-[#0F172A] hover:text-[#7C3AED] font-black text-xs transition bg-white hover:bg-[#FAF8FE] px-4 py-2.5 rounded-xl border border-[#DDD6FE] hover:border-[#7C3AED] cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>
          
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EDE9FE] border border-[#DDD6FE] text-[11px] font-black text-[#7C3AED]">
            <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Alphabetically Sorted Inventory Sync</span>
          </div>
        </div>
      </div>

      {/* Headline banner */}
      <div className="space-y-1.5">
        <h3 className="font-black text-[#0F172A] text-lg sm:text-xl flex items-center gap-2 tracking-tight">
          <Database className="w-5 h-5 text-[#7C3AED]" />
          <span>Premium Log Accounts Store</span>
        </h3>
        <p className="text-xs text-[#475569] font-medium leading-relaxed max-w-2xl">
          Instantly buy, preview, or bookmark verified aged logs, developer profiles, and social accounts matching your direct search specifications. Sorted alphabetically by category.
        </p>
      </div>

      {/* Search & Tactical Filtering Tools */}
      <div className="flex flex-col gap-4">
        
        {/* Sleek Search Bar */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#7C3AED]">
            <Search className="w-4.5 h-4.5" />
          </div>
          <input
            type="text"
            placeholder="Search account logs (e.g. 'Aged Facebook', '50K followers Instagram', '2FA Gmail')..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white border border-[#DDD6FE] focus:border-[#7C3AED] text-[#0F172A] placeholder-[#64748B] text-xs sm:text-sm pl-11 pr-4 py-3 rounded-2xl focus:outline-none transition-all duration-300 shadow-xs font-semibold"
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
                    ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm shadow-purple-600/20 font-black'
                    : 'bg-white hover:bg-[#FAF8FE] text-[#1E192E] hover:text-[#7C3AED] border-[#DDD6FE] shadow-xs'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real Inventory Display Grid */}
      {listingsLoading ? (
        <div className="h-64 bg-white border border-dashed border-[#DDD6FE] rounded-3xl flex flex-col items-center justify-center gap-3 text-sm text-[#7C3AED] font-black shadow-xs">
          <div className="w-8 h-8 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
          <span>Synchronizing existing accounts inventory...</span>
        </div>
      ) : filteredAndSortedListings.length === 0 ? (
        <div className="bg-white border border-dashed border-[#DDD6FE] rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto my-6 shadow-xs">
          <ShoppingCart className="w-12 h-12 text-[#7C3AED]/40 mx-auto" />
          <div className="space-y-1">
            <h4 className="font-black text-[#0F172A] text-base">No Matching Logs Available</h4>
            <p className="text-xs text-[#475569] font-medium leading-relaxed">
              There are currently no active listings that match your filter or search query. Try choosing a different category or clearing your search term.
            </p>
          </div>
          <button
            onClick={() => {
              onCategoryFilterChange('All');
              onSearchChange('');
            }}
            className="px-4 py-2 bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED] border border-[#DDD6FE] text-xs font-black rounded-xl transition cursor-pointer shadow-xs"
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
              canDelete={isAuthorizedOwner(null, userProfile) || userProfile?.role === 'owner' || userProfile?.role === 'admin' || (userProfile?.role === 'seller' && userProfile.uid === item.sellerId)}
            />
          ))}
        </div>
      )}

    </div>
  );
};
