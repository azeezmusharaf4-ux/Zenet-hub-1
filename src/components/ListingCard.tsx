import React from 'react';
import { AccountListing } from '../types';
import { calculateSellerTrustScore } from '../utils/trustScore';
import { getPlatformConfig } from './PlatformIcon';
import { 
  Bookmark, 
  Lock, 
  Eye, 
  Check, 
  Trash2, 
  Star
} from 'lucide-react';

interface ListingCardProps {
  listing: AccountListing;
  onSelect: (listing: AccountListing) => void;
  onContact: (listing: AccountListing) => void;
  onBuyNow?: (listing: AccountListing) => void;
  isSaved: boolean;
  onToggleSave: (listingId: string) => void;
  onViewSellerProfile?: (sellerId: string, sellerName: string) => void;
  onDelete?: (listingId: string) => void;
  canDelete?: boolean;
}

export const ListingCard: React.FC<ListingCardProps> = React.memo(({
  listing,
  onSelect,
  onContact,
  onBuyNow,
  isSaved,
  onToggleSave,
  onViewSellerProfile,
  onDelete,
  canDelete
}) => {
  const platformConfig = getPlatformConfig(listing.category);
  const sellerHandle = `@${(listing.sellerName || 'seller').toLowerCase().replace(/\s+/g, '')}`;

  // Calculate Seller Trust Score
  const trustInfo = calculateSellerTrustScore(
    listing.sellerSalesCount || 12,
    listing.sellerRating || 4.9
  );

  // Compute available stock count strictly excluding 'Sold' accounts
  const inventoryAvailable = Array.isArray(listing.inventory)
    ? listing.inventory.filter((acc: any) => (acc.status || '').toLowerCase() !== 'sold').length
    : undefined;

  const docStock = listing.stockCount !== undefined 
    ? listing.stockCount 
    : (listing.stock !== undefined ? listing.stock : (listing.status === 'sold' ? 0 : 1));

  // Use maximum of valid available inventory array and explicit stock fields so additions are immediately visible
  const rawStock = inventoryAvailable !== undefined 
    ? Math.max(inventoryAvailable, docStock) 
    : docStock;

  const isSoldOut = listing.status === 'sold' || rawStock <= 0;
  const stockCount = isSoldOut ? 0 : rawStock;

  // Check if image is a real non-generic custom screenshot
  const hasCustomScreenshot = Boolean(
    listing.imageUrl && 
    !listing.imageUrl.includes('unsplash.com') && 
    !listing.imageUrl.includes('images.unsplash')
  );

  return (
    <div className="w-full h-full group bg-white hover:bg-[#FAF8FE] border border-[#DDD6FE] hover:border-[#7C3AED] rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md relative overflow-hidden gap-3.5">
      
      {/* Top Header Section: Platform Icon Avatar, Title & Seller */}
      <div className="z-10 space-y-2.5">
        
        {/* Top Row: Avatar Icon + Title & Seller */}
        <div className="flex items-start gap-3">
          
          {/* Platform Circle Avatar / Image */}
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ${platformConfig.avatarBg} p-2 shrink-0 shadow-sm flex items-center justify-center text-white relative group-hover:scale-105 transition-transform border border-white/20`}>
            {hasCustomScreenshot ? (
              <img 
                src={listing.imageUrl} 
                alt={listing.title} 
                className="w-full h-full rounded-[12px] object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-6 h-6 sm:w-7 sm:h-7 text-white flex items-center justify-center drop-shadow-sm">
                {platformConfig.iconSvg}
              </div>
            )}
          </div>

          {/* Title and Seller Handle */}
          <div className="flex-1 min-w-0">
            <h3 
              onClick={() => onSelect(listing)}
              className="text-[#0F172A] font-black text-sm sm:text-base leading-snug hover:text-[#7C3AED] transition cursor-pointer line-clamp-1 tracking-tight"
              title={listing.title}
            >
              {listing.title}
            </h3>

            {/* Seller Info Row */}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onViewSellerProfile) {
                    onViewSellerProfile(listing.sellerId, listing.sellerName);
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#475569] hover:text-[#7C3AED] transition cursor-pointer"
              >
                <span className="truncate max-w-[110px]">{sellerHandle}</span>
                <span title="Verified Seller" className="bg-amber-100 text-amber-800 p-0.5 rounded-full border border-amber-300 shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              </button>

              <div className="flex items-center gap-0.5 text-amber-500 font-black text-[11px] shrink-0">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{listing.sellerRating || 4.9}</span>
              </div>
            </div>
          </div>

          {/* Save / Bookmark Button & Admin Delete */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(listing.id);
              }}
              className={`p-1.5 rounded-xl border transition cursor-pointer ${
                isSaved
                  ? 'bg-[#EDE9FE] text-[#7C3AED] border-[#C4B5FD]'
                  : 'bg-[#FAF8FE] text-[#64748B] hover:text-[#7C3AED] border-[#DDD6FE]'
              }`}
              title={isSaved ? 'Remove Bookmark' : 'Bookmark Item'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-[#7C3AED] text-[#7C3AED]' : ''}`} />
            </button>

            {onDelete && canDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(listing.id);
                }}
                className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                title="Delete Product"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Short Product Description (Max 2 lines) */}
        <p 
          onClick={() => onSelect(listing)}
          className="text-xs text-[#475569] font-medium leading-relaxed cursor-pointer hover:text-[#0F172A] transition line-clamp-2 min-h-[36px]"
        >
          {listing.description || 'Verified PVA account with instant 2FA transfer and original email access included.'}
        </p>

      </div>

      {/* Middle/Bottom Row: Stock Status & Price */}
      <div className="z-10 pt-2 border-t border-[#EDE9FE] space-y-2.5">
        
        {/* Stock & Price Line */}
        <div className="flex items-center justify-between gap-2">
          
          {/* Stock Counter */}
          <div className="flex items-center gap-1.5">
            {isSoldOut ? (
              <span className="flex items-center gap-1.5 text-xs font-black text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>0 stock</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>{stockCount} in stock</span>
              </span>
            )}
          </div>

          {/* Price */}
          <div className="text-right">
            <span className="text-lg sm:text-xl font-black text-[#0F172A] font-mono tracking-tight">
              ₦{Number(listing.price).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons: Preview & Buy Now */}
        <div className="grid grid-cols-2 gap-2 w-full pt-1">
          {/* Preview Button */}
          <button
            type="button"
            onClick={() => onSelect(listing)}
            className="w-full min-h-[40px] flex items-center justify-center gap-1.5 bg-white hover:bg-[#FAF8FE] text-[#0F172A] font-black text-xs py-2.5 px-2.5 rounded-xl border border-[#DDD6FE] hover:border-[#7C3AED] transition cursor-pointer shadow-xs active:scale-[0.98] whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
            <span>Preview</span>
          </button>

          {/* Buy Button */}
          <button
            type="button"
            onClick={() => {
              if (isSoldOut) return;
              if (onBuyNow) {
                onBuyNow(listing);
              } else {
                onContact(listing);
              }
            }}
            disabled={isSoldOut}
            className={`w-full min-h-[40px] flex items-center justify-center gap-1.5 font-black text-xs py-2.5 px-2.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
              isSoldOut
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm shadow-purple-600/20 active:scale-[0.98]'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-white/90 shrink-0" />
            <span>{isSoldOut ? 'Sold Out' : 'Buy Now'}</span>
          </button>
        </div>

      </div>

    </div>
  );
});
