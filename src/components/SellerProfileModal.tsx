import React, { useState } from 'react';
import { AccountListing, SellerReview, UserProfile } from '../types';
import { calculateSellerTrustScore } from '../utils/trustScore';
import {
  X,
  Star,
  ShieldCheck,
  CheckCircle2,
  MessageSquare,
  ShoppingBag,
  ExternalLink,
  Send,
  UserCheck,
  Award,
  Globe
} from 'lucide-react';

interface SellerProfileModalProps {
  sellerId: string;
  sellerName: string;
  sellerRating?: number;
  sellerSalesCount?: number;
  sellerWhatsapp?: string;
  sellerTelegram?: string;
  listings: AccountListing[];
  reviews?: SellerReview[];
  currentUser?: UserProfile | null;
  onClose: () => void;
  onSelectListing: (listing: AccountListing) => void;
  onAddReview?: (review: Omit<SellerReview, 'id' | 'createdAt'>) => void;
  onContactSeller?: (listing: any) => void;
}

export const SellerProfileModal: React.FC<SellerProfileModalProps> = ({
  sellerId,
  sellerName,
  sellerRating = 4.9,
  sellerSalesCount = 50,
  sellerWhatsapp,
  sellerTelegram,
  listings,
  reviews = [],
  currentUser = null,
  onClose,
  onSelectListing,
  onAddReview,
  onContactSeller,
}) => {
  const [activeTab, setActiveTab] = useState<'listings' | 'reviews'>('listings');
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const sellerListings = listings.filter(
    (item) => item.sellerId === sellerId || item.sellerName.toLowerCase() === sellerName.toLowerCase()
  );

  const sellerReviews = reviews.filter(
    (r) => r.sellerId === sellerId || (r as any).sellerName?.toLowerCase() === sellerName.toLowerCase()
  );

  const avgRating =
    sellerReviews.length > 0
      ? (sellerReviews.reduce((sum, r) => sum + r.rating, 0) / sellerReviews.length).toFixed(1)
      : sellerRating.toFixed(1);

  const trustInfo = calculateSellerTrustScore(
    sellerSalesCount,
    Number(avgRating) || sellerRating
  );

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    onAddReview({
      sellerId,
      reviewerId: currentUser?.uid || 'guest-user',
      reviewerName: currentUser?.displayName || 'Verified Buyer',
      rating: ratingInput,
      comment: commentInput.trim(),
    });

    setCommentInput('');
    setReviewSubmitted(true);
    setTimeout(() => setReviewSubmitted(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-purple-100">
        {/* Header Header Banner */}
        <div className="relative h-32 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 border-b border-slate-800 p-6 flex items-end justify-between">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-950/60 hover:bg-slate-950 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 translate-y-6">
            <div className="w-20 h-20 rounded-2xl bg-slate-950 border-2 border-cyan-500 shadow-xl flex items-center justify-center text-cyan-400 font-extrabold text-2xl uppercase">
              {sellerName.substring(0, 2)}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                {sellerName}
                <span title="Verified Merchant" className="inline-flex items-center">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                </span>
                <span 
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${trustInfo.badgeBg} ${trustInfo.badgeBorder} ${trustInfo.badgeText} flex items-center gap-1 ml-1`}
                  title={trustInfo.summaryText}
                >
                  <Award className={`w-3.5 h-3.5 ${trustInfo.iconColor}`} />
                  {trustInfo.formattedScore} Trust
                </span>
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>Verified Escrow Merchant</span> • 
                <span className="flex items-center gap-1 text-slate-300">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  Nigeria & West Africa
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="pt-10 px-6 pb-6 bg-slate-900 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold block">Merchant Rating</span>
            <div className="flex items-center justify-center gap-1 font-black text-amber-400 text-lg mt-0.5">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{avgRating}</span>
              <span className="text-slate-500 text-xs font-normal">({sellerReviews.length})</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold block">Successful Transfers</span>
            <span className="font-black text-white text-lg mt-0.5 block">{sellerSalesCount}+</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold block">Active Inventory</span>
            <span className="font-black text-cyan-400 text-lg mt-0.5 block">{sellerListings.length} Accounts</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold block">Escrow Guarantee</span>
            <span className="font-extrabold text-emerald-400 text-xs mt-1.5 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              100% Protected
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-6">
          <button
            onClick={() => setActiveTab('listings')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'listings'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Active Listings ({sellerListings.length})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'reviews'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Ratings & Reviews ({sellerReviews.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4">
          {activeTab === 'listings' && (
            <div>
              {sellerListings.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  This seller has no other active listings at the moment.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sellerListings.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectListing(item);
                        onClose();
                      }}
                      className="bg-slate-950 hover:bg-slate-800/80 p-3 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer flex items-center gap-3 group"
                    >
                      <img
                        src={item.imageUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80'}
                        alt={item.title}
                        className="w-16 h-16 rounded-lg object-cover bg-slate-900 shrink-0"
                      />
                      <div className="overflow-hidden flex-1">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase">{item.category}</span>
                        <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-cyan-400 transition">
                          {item.title}
                        </h4>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-black text-white">₦{Number(item.price).toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400">{item.followers || item.accountAge}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {/* Leave a review box */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  Leave a Review for {sellerName}
                </h4>
                {reviewSubmitted && (
                  <div className="p-3 bg-emerald-950/80 border border-emerald-500 text-emerald-300 rounded-lg text-xs font-semibold mb-3">
                    Thank you! Your rating and review have been published.
                  </div>
                )}
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold">Your Rating:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingInput(star)}
                          className="p-1 hover:scale-110 transition cursor-pointer"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= ratingInput
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Share your experience buying from this seller..."
                    className="w-full bg-slate-900 text-slate-200 text-xs sm:text-sm p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
                    required
                  />

                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Review
                  </button>
                </form>
              </div>

              {/* Reviews List */}
              <div className="space-y-3">
                {sellerReviews.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-4">
                    No reviews yet. Be the first to leave a review!
                  </p>
                ) : (
                  sellerReviews.map((rev) => (
                    <div key={rev.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{rev.reviewerName}</span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50 font-semibold">
                            Verified Purchase
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3 h-3 ${
                                idx < rev.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                      <span className="text-[10px] text-slate-500 mt-2 block">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
