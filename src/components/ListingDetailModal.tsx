import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AccountListing } from '../types';
import { X, Lock, Trash2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div 
        className="bg-white border border-purple-100 rounded-2xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col text-slate-900 p-4 sm:p-6 gap-4 sm:gap-5 my-auto max-h-[92dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header: Title and Close Cross */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-purple-600 font-bold text-xs uppercase tracking-wider">Preview Product</span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight leading-snug">{current.title}</h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onDelete && canDelete && (
              <button 
                onClick={() => {
                  onDelete(current.id);
                  onClose();
                }}
                className="p-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition cursor-pointer"
                title="Delete this listing"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-purple-50 text-slate-400 hover:text-slate-900 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Short Description */}
        <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-4">
          <p className="text-xs sm:text-sm text-slate-900 leading-relaxed font-normal whitespace-pre-line">
            {shortDescription}
          </p>
        </div>

        {/* Stock & Price info */}
        <div className="grid grid-cols-2 gap-3">
          {/* Price Block */}
          <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-3.5 flex flex-col justify-center">
            <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Price</span>
            <span className="text-lg font-black text-slate-900 font-mono mt-0.5">
              ₦{Number(current.price).toLocaleString()}
            </span>
          </div>

          {/* Stock Block */}
          <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-3.5 flex flex-col justify-center">
            <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Availability</span>
            <span className={`text-xs font-extrabold mt-1 flex items-center gap-1.5 ${isSoldOut ? 'text-slate-500' : 'text-purple-900'}`}>
              <span className={`w-2 h-2 rounded-full ${isSoldOut ? 'bg-slate-400' : 'bg-purple-600 animate-pulse'}`} />
              <span>{isSoldOut ? 'Sold Out' : `${stockCount} in stock`}</span>
            </span>
          </div>
        </div>

         {/* Buttons Grid */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Action Button: Delete Stock if authorized, or Close */}
          {onDelete && canDelete ? (
            <button
              onClick={() => {
                onDelete(current.id);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs py-3 px-4 rounded-2xl border border-purple-200 transition cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Stock</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center bg-purple-50 hover:bg-purple-100 text-purple-900 hover:text-purple-950 font-bold text-xs py-3 px-4 rounded-2xl border border-purple-200 transition cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <span>Close</span>
            </button>
          )}

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
                ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 active:scale-[0.98]'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-purple-100" />
            <span>{isSoldOut ? 'Sold Out' : 'Buy Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
