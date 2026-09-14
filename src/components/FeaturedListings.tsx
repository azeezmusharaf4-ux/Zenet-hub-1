import React from 'react';
import { AccountListing } from '../types';
import { calculateSellerTrustScore } from '../utils/trustScore';
import { getPlatformConfig } from './PlatformIcon';
import { Sparkles, ShieldCheck, Flame, ChevronRight, Eye, CheckCircle2, Check, Star, Award } from 'lucide-react';

interface FeaturedListingsProps {
  listings: AccountListing[];
  onSelectListing: (listing: AccountListing) => void;
  onContactSeller: (listing: AccountListing) => void;
  onBuyNow?: (listing: AccountListing) => void;
}

export const FeaturedListings: React.FC<FeaturedListingsProps> = React.memo(({
  listings,
  onSelectListing,
  onContactSeller,
  onBuyNow,
}) => {
  const featured = listings.filter((item) => item.featured || item.badges?.includes('Featured'));
  const itemsToDisplay = featured.length > 0 ? featured : listings.slice(0, 3);

  if (itemsToDisplay.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-[#7C3AED] text-white shadow-sm shadow-purple-600/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              Featured Premium Listings
              <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                HOT
              </span>
            </h2>
            <p className="text-xs text-[#475569] font-medium">Hand-verified top tier accounts with instant 2FA transfer</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {itemsToDisplay.map((item) => {
          const platformConfig = getPlatformConfig(item.category);
          const sellerHandle = `@${(item.sellerName || 'seller').toLowerCase().replace(/\s+/g, '_')}`;
          const rawStock = Array.isArray(item.inventory)
            ? item.inventory.filter((acc: any) => acc.status === 'Available' || (acc.status || '').toLowerCase() === 'available').length
            : (item.stockCount !== undefined ? item.stockCount : (item.stock !== undefined ? item.stock : (item.status === 'sold' ? 0 : 1)));
          const isSold = item.status === 'sold' || rawStock <= 0;
          const trustInfo = calculateSellerTrustScore(
            item.sellerSalesCount || 12,
            item.sellerRating || 5.0
          );
          const hasCustomScreenshot = Boolean(
            item.imageUrl && 
            !item.imageUrl.includes('unsplash.com') && 
            !item.imageUrl.includes('images.unsplash')
          );

          return (
            <div
              key={item.id}
              className="group relative bg-white border border-[#DDD6FE] hover:border-[#7C3AED] rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              {/* Top Header Badge */}
              <div className="flex items-center justify-between mb-3.5 z-10 gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-[#EDE9FE] border border-[#C4B5FD] text-[#5B21B6] text-[11px] font-black px-3 py-1 rounded-full shadow-xs">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  Featured Asset
                </span>
                
                <div className="flex items-center gap-2">
                  <span 
                    className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border ${trustInfo.badgeBg} ${trustInfo.badgeBorder} ${trustInfo.badgeText}`}
                    title={trustInfo.summaryText}
                  >
                    <Award className={`w-3.5 h-3.5 ${trustInfo.iconColor}`} />
                    <span>{trustInfo.formattedScore} Trust</span>
                  </span>

                  <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Escrow Verified
                  </span>
                </div>
              </div>

              {/* Image & Title */}
              <div className="z-10">
                <div className={`relative h-32 sm:h-36 w-full rounded-2xl overflow-hidden mb-3.5 ${platformConfig.avatarBg} border border-white/20 flex items-center justify-center`}>
                  {hasCustomScreenshot ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 text-white drop-shadow-md mb-1 group-hover:scale-110 transition-transform">
                        {platformConfig.iconSvg}
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                </div>

                <h3 className="font-black text-[#0F172A] text-base leading-snug line-clamp-2 group-hover:text-[#7C3AED] transition mb-2">
                  {item.title}
                </h3>

                {/* Seller verified badge */}
                <div className="flex items-center justify-between text-xs text-[#475569] mb-3 bg-[#FAF8FE] p-2.5 rounded-xl border border-[#DDD6FE]">
                  <div className="flex items-center gap-1.5 truncate">
                    <div className="w-5 h-5 rounded-full bg-[#7C3AED] text-white flex items-center justify-center font-black text-[10px] shrink-0">
                      {item.sellerName.charAt(0)}
                    </div>
                    <span className="font-bold text-[#0F172A] truncate">{sellerHandle}</span>
                    <span className="bg-amber-100 text-amber-800 p-0.5 rounded-full border border-amber-300 shrink-0" title="Verified Seller">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-amber-500 font-black shrink-0">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{item.sellerRating || 5.0}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Price & Rounded Preview/Buy Buttons */}
              <div className="pt-3 border-t border-[#EDE9FE] flex items-center justify-between gap-2 z-10">
                <div>
                  <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-bold">Buy Price</span>
                  <span className="text-xl font-black text-[#0F172A]">
                    ₦{Number(item.price).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Rounded Preview Button */}
                  <button
                    onClick={() => onSelectListing(item)}
                    className="p-2.5 rounded-full bg-white hover:bg-[#FAF8FE] text-[#0F172A] hover:text-[#7C3AED] border border-[#DDD6FE] hover:border-[#7C3AED] transition cursor-pointer shadow-xs"
                    title="Preview details"
                  >
                    <Eye className="w-4 h-4 text-[#7C3AED]" />
                  </button>

                  {/* Rounded Buy Button */}
                  <button
                    onClick={() => {
                      if (onBuyNow) {
                        onBuyNow(item);
                      } else {
                        onContactSeller(item);
                      }
                    }}
                    disabled={isSold}
                    className="px-4 py-2 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black text-xs transition cursor-pointer flex items-center gap-1 shadow-sm shadow-purple-600/20 hover:scale-105"
                  >
                    <span>{isSold ? 'Sold' : 'Buy Now'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
