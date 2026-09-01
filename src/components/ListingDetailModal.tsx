import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AccountListing } from '../types';
import { X, Lock } from 'lucide-react';

interface ListingDetailModalProps {
  listing: AccountListing | null;
  onClose: () => void;
  onContactSeller: (listing: AccountListing) => void;
  onBuyNow?: (listing: AccountListing) => void;
  isSaved: boolean;
  onToggleSave: (listingId: string) => void;
  onViewSellerProfile?: (sellerId: string, sellerName: string) => void;
  onDelete?: (listingId: string) => void;
  canDelete?: boolean;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  onClose,
  onBuyNow,
  onDelete,
  canDelete
}) => {
  const [liveListing, setLiveListing] = useState<AccountListing | null>(listing);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fetch fresh real-time details from Firestore when opened to make sure stock is accurate
  useEffect(() => {
    if (!listing?.id) return;
    setLiveListing(listing);

    async function fetchFreshFirestoreListing() {
      try {
        const docRef = doc(db, 'listings', listing.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLiveListing({ id: docSnap.id, ...docSnap.data() } as AccountListing);
        }
      } catch (error) {
        console.warn('Could not refresh listing directly from Firestore:', error);
      }
    }

    fetchFreshFirestoreListing();
  }, [listing?.id]);

  if (!listing) return null;
  const current = liveListing || listing;

  const inventoryAvailable = Array.isArray(current.inventory)
    ? current.inventory.filter((acc: any) => (acc.status || '').toLowerCase() !== 'sold').length
    : undefined;

  const docStock = current.stockCount !== undefined 
    ? current.stockCount 
    : (current.stock !== undefined ? current.stock : (current.status === 'sold' ? 0 : 1));

  const rawStock = inventoryAvailable !== undefined 
    ? Math.max(inventoryAvailable, docStock) 
    : docStock;

  const isSoldOut = current.status === 'sold' || rawStock <= 0;
  const stockCount = isSoldOut ? 0 : rawStock;

  // Truncate or clean up long description into a neat paragraph
  const shortDescription = current.description 
    ? (current.description.length > 220 ? current.description.substring(0, 220) + '...' : current.description)
    : 'Verified account with instant digital delivery and secure takeover guaranteed.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#07030e]/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#120826] border border-[#2d1952] rounded-2xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col text-purple-100 p-4 sm:p-6 gap-4 sm:gap-5 my-auto max-h-[92dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header: Title and Close Cross */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-purple-400 font-bold text-xs uppercase tracking-wider">Preview Product</span>
            <h2 className="text-xl font-black text-white tracking-tight leading-snug">{current.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-purple-900/30 text-purple-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Short Description */}
        <div className="bg-[#190d33] border border-[#2a174d] rounded-2xl p-4">
          <p className="text-xs text-purple-200/95 leading-relaxed font-normal whitespace-pre-line">
            {shortDescription}
          </p>
        </div>

        {/* Stock & Price info */}
        <div className="grid grid-cols-2 gap-3">
          {/* Price Block */}
          <div className="bg-[#190d33] border border-[#2a174d] rounded-2xl p-3.5 flex flex-col justify-center">
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Price</span>
            <span className="text-lg font-black text-white font-mono mt-0.5">
              ₦{Number(current.price).toLocaleString()}
            </span>
          </div>

          {/* Stock Block */}
          <div className="bg-[#190d33] border border-[#2a174d] rounded-2xl p-3.5 flex flex-col justify-center">
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Availability</span>
            <span className={`text-xs font-extrabold mt-1 flex items-center gap-1.5 ${isSoldOut ? 'text-rose-400' : 'text-emerald-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isSoldOut ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
              <span>{isSoldOut ? 'Sold Out' : `${stockCount} in stock`}</span>
            </span>
          </div>
        </div>

         {/* Buttons Grid */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center bg-[#20123e] hover:bg-[#2c1954] text-purple-200 hover:text-white font-bold text-xs py-3 px-4 rounded-2xl border border-[#361e63] transition cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <span>Close</span>
          </button>

          {/* Buy Button */}
          <button
            onClick={() => {
              if (isSoldOut) return;
              if (onBuyNow) {
                onClose();
                onBuyNow(current);
              }
            }}
            disabled={isSoldOut}
            className={`w-full flex items-center justify-center gap-1.5 font-extrabold text-xs py-3 px-4 rounded-2xl transition cursor-pointer ${
              isSoldOut
                ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 active:scale-[0.98]'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-purple-200" />
            <span>{isSoldOut ? 'Sold Out' : 'Buy Now'}</span>
          </button>
        </div>

        {onDelete && canDelete && (
          <div className="w-full mt-3">
            {confirmDelete ? (
              <div className="bg-rose-950/80 border border-rose-800 rounded-2xl p-3 text-center space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                <p className="text-rose-200 text-xs font-black">
                  Are you absolutely sure you want to permanently delete this product?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onDelete(current.id);
                      onClose();
                    }}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs py-2 rounded-xl cursor-pointer transition shadow"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 bg-[#20123e] hover:bg-[#2c1954] text-purple-200 font-extrabold text-xs py-2 rounded-xl cursor-pointer transition border border-[#361e63]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 hover:text-white font-extrabold text-xs py-3 px-4 rounded-2xl transition cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <span>Delete This Listing</span>
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
