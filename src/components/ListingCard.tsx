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
    <div className={`w-full h-full group bg-[#150c2a]/95 hover:bg-[#1a0f34] border border-[#2b184d] hover:border-purple-500/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-purple-950/50 relative overflow-hidden gap-3.5`}>
      
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl group-hover:bg-purple-600/20 transition-all duration-500 pointer-events-none" />

      {/* Top Header Section: Platform Icon Avatar, Title & Seller */}
      <div className="z-10 space-y-2.5">
        
        {/* Top Row: Avatar Icon + Title & Seller */}
        <div className="flex items-start gap-3">
          
          {/* Platform Circle Avatar / Image */}
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ${platformConfig.avatarBg} p-2 shrink-0 shadow-md flex items-center justify-center text-white relative group-hover:scale-105 transition-transform border border-white/10`}>
            {hasCustomScreenshot ? (
              <img 
                src={listing.imageUrl} 
                alt={listing.title} 
                className="w-full h-full rounded-[12px] object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-6 h-6 sm:w-7 sm:h-7 text-white flex items-center justify-center drop-shadow-md">
                {platformConfig.iconSvg}
              </div>
            )}
          </div>

          {/* Title and Seller Handle */}
          <div className="flex-1 min-w-0">
            <h3 
              onClick={() => onSelect(listing)}
              className="text-white font-extrabold text-sm sm:text-base leading-snug hover:text-purple-300 transition cursor-pointer line-clamp-1 tracking-tight"
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
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-300 hover:text-white transition cursor-pointer"
              >
                <span className="truncate max-w-[110px]">{sellerHandle}</span>
                <span title="Verified Seller" className="bg-amber-500/20 text-amber-300 p-0.5 rounded-full border border-amber-400/50 shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              </button>

              <div className="flex items-center gap-0.5 text-amber-300 font-bold text-[11px] shrink-0">
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
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                  : 'bg-[#1e123a] text-purple-300/50 hover:text-purple-200 border-[#2f1a52]'
              }`}
              title={isSaved ? 'Remove Bookmark' : 'Bookmark Item'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-purple-400 text-purple-400' : ''}`} />
            </button>

            {onDelete && canDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(listing.id);
                }}
                className="p-1.5 rounded-xl border border-rose-500/50 bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white transition cursor-pointer"
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
          className="text-xs text-purple-300/70 leading-relaxed cursor-pointer hover:text-purple-200 transition line-clamp-2 min-h-[36px]"
        >
          {listing.description || 'Verified PVA account with instant 2FA transfer and original email access included.'}
        </p>



      </div>

      {/* Middle/Bottom Row: Stock Status & Price */}
      <div className="z-10 pt-2 border-t border-[#231342] space-y-2.5">
        
        {/* Stock & Price Line */}
        <div className="flex items-center justify-between gap-2">
          
          {/* Stock Counter */}
          <div className="flex items-center gap-1.5">
            {isSoldOut ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>0 stock</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{stockCount} in stock</span>
              </span>
            )}
          </div>

          {/* Price */}
          <div className="text-right">
            <span className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
              ₦{Number(listing.price).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons: Preview & Buy Now */}
        <div className="grid grid-cols-2 gap-2 w-full">
          {/* Preview Button */}
          <button
            onClick={() => onSelect(listing)}
            className="w-full flex items-center justify-center gap-1.5 bg-[#20123e] hover:bg-[#2c1954] text-purple-200 hover:text-white font-bold text-xs py-2 px-3 rounded-xl border border-[#361e63] transition cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span>Preview</span>
          </button>

          {/* Buy Button */}
          <button
            onClick={() => {
              if (isSoldOut) return;
              if (onBuyNow) {
                onBuyNow(listing);
              } else {
                onContact(listing);
              }
            }}
            disabled={isSoldOut}
            className={`w-full flex items-center justify-center gap-1.5 font-extrabold text-xs py-2 px-3 rounded-xl transition cursor-pointer ${
              isSoldOut
                ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/30 hover:shadow-purple-600/50 active:scale-[0.98]'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-purple-200" />
            <span>{isSoldOut ? 'Sold Out' : 'Buy'}</span>
          </button>
        </div>

      </div>

    </div>
  );
});
