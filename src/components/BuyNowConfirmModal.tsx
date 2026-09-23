import React from 'react';
import { AccountListing } from '../types';
import { ShieldCheck, X, ShoppingCart } from 'lucide-react';

interface BuyNowConfirmModalProps {
  listing: AccountListing | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const BuyNowConfirmModal: React.FC<BuyNowConfirmModalProps> = ({
  listing,
  onCancel,
  onConfirm
}) => {
  if (!listing) return null;

  const formattedPrice = `₦${Number(listing.price || 0).toLocaleString()}`;
  const itemName = listing.title || listing.category || 'Product';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div 
        className="bg-white border border-[#EBE7F7] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative my-auto p-6 sm:p-7 text-center space-y-5 animate-in zoom-in-95 duration-150 text-[#0F172A]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-[#64748B] hover:text-[#0F172A] bg-[#F8F7FD] hover:bg-[#F1F0FB] border border-[#EBE7F7] rounded-full transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="w-14 h-14 bg-[#EDE9FE] text-[#5B4DF5] rounded-2xl flex items-center justify-center mx-auto border border-[#DDD6FE] shadow-inner">
          <ShoppingCart className="w-7 h-7 stroke-[2.2]" />
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight leading-snug">
            Are you sure you want to purchase this {itemName} for {formattedPrice}?
          </h2>
          
          {listing.description && (
            <p className="text-xs sm:text-sm text-[#64748B] line-clamp-3 leading-relaxed px-2">
              {listing.description}
            </p>
          )}
        </div>

        {/* Subtle Escrow Guarantee */}
        <div className="bg-[#F8F7FD] border border-[#EBE7F7] py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#5B4DF5]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Protected by ZENET Escrow • Instant Credential Delivery</span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full bg-[#F1F0FB] hover:bg-[#EBE7F7] text-[#475569] font-extrabold py-3 px-4 rounded-xl text-xs sm:text-sm transition cursor-pointer border border-[#E2E8F0]"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            className="w-full bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-black py-3 px-4 rounded-xl text-xs sm:text-sm shadow-md shadow-[#5B4DF5]/25 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            Yes, Purchase
          </button>
        </div>
      </div>
    </div>
  );
};
export default BuyNowConfirmModal;
