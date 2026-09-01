import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AccountListing, UserProfile } from '../types';
import { X, Send, Phone, MessageSquare, Check, AlertCircle, Info, ExternalLink } from 'lucide-react';

interface ContactSellerModalProps {
  user: User | null;
  userProfile: UserProfile | null;
  listing: AccountListing | null;
  onClose: () => void;
  onSendInquiry: (inquiryData: {
    listingId: string;
    listingTitle: string;
    sellerId: string;
    message: string;
  }) => Promise<void>;
  onOpenAuth: () => void;
}

export const ContactSellerModal: React.FC<ContactSellerModalProps> = ({
  user,
  userProfile,
  listing,
  onClose,
  onSendInquiry,
  onOpenAuth
}) => {
  if (!listing) return null;

  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState(
    `Hello ${listing.sellerName},\nI am interested in buying your ${listing.category} account: "${listing.title}" (₦${Number(listing.price).toLocaleString()}).\nIs this listing still available for transfer?`
  );
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function fetchSellerProfile() {
      if (!listing?.sellerId) return;
      try {
        const userRef = doc(db, 'users', listing.sellerId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && isMounted) {
          setSellerProfile(docSnap.data() as UserProfile);
        }
      } catch (e) {
        console.warn('Failed to fetch seller live profile:', e);
      }
    }
    fetchSellerProfile();
    return () => { isMounted = false; };
  }, [listing?.sellerId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    if (!message.trim()) {
      setError('Please write a message.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSendInquiry({
        listingId: listing.id,
        listingTitle: listing.title,
        sellerId: listing.sellerId,
        message: message.trim()
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send inquiry.');
    } finally {
      setLoading(false);
    }
  };

  // Derive WhatsApp and Telegram info
  const rawWhatsapp = sellerProfile?.whatsapp || listing.sellerWhatsapp || '';
  const rawTelegram = sellerProfile?.telegram || listing.sellerTelegram || '';

  const waNumber = rawWhatsapp.replace(/[^0-9]/g, '');
  const waUrl = waNumber ? `https://wa.me/${waNumber}` : null;

  const tgUsername = rawTelegram.replace(/^@/, '').trim();
  const tgUrl = tgUsername ? `https://t.me/${tgUsername}` : null;

  const hasContactInfo = Boolean(waUrl || tgUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#06030c]/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#120826] border border-[#2d1952] rounded-2xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-purple-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-[#0e061e] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#241344] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <h2 className="font-extrabold text-white text-base">Contact Seller: {sellerProfile?.displayName || listing.sellerName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-purple-300 hover:text-white bg-[#1e1039] border border-[#371d67] rounded-full transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs sm:text-sm">
          
          {/* Account Summary Banner */}
          <div className="bg-[#180c33] p-4 rounded-2xl border border-[#2d1a55] flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-extrabold text-purple-300 uppercase tracking-wider">{listing.category}</span>
              <p className="font-bold text-white line-clamp-1">{listing.title}</p>
            </div>
            <span className="text-base font-black text-white shrink-0">₦{Number(listing.price).toLocaleString()}</span>
          </div>

          {!user && (
            <div className="bg-amber-950/80 border border-amber-500/40 text-amber-200 p-3.5 rounded-2xl flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">Log in to send in-app messages to sellers.</span>
              <button
                onClick={onOpenAuth}
                className="bg-amber-400 text-slate-950 font-extrabold px-3 py-1 rounded-full text-xs hover:bg-amber-300 transition cursor-pointer"
              >
                Log In
              </button>
            </div>
          )}

          {sent ? (
            <div className="bg-emerald-950/80 border border-emerald-500/40 p-6 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="font-extrabold text-white text-base">Inquiry Delivered!</h3>
              <p className="text-purple-200/80 text-xs">
                Your message was saved and sent to seller <strong className="text-purple-300">{sellerProfile?.displayName || listing.sellerName}</strong>. You can track replies under your Inquiries tab.
              </p>
              <button
                onClick={onClose}
                className="bg-[#241446] hover:bg-[#321c60] text-white font-bold px-5 py-2 rounded-full text-xs transition cursor-pointer"
              >
                Close Window
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              {error && (
                <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-purple-300/80 font-semibold mb-1">Your Message to Seller</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-[#170c30] text-purple-100 p-3 rounded-2xl border border-[#2e1852] focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold py-3 rounded-full shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Sending Inquiry...' : 'Send In-App Inquiry'}</span>
              </button>
            </form>
          )}

          {/* Direct Instant Contact Section */}
          <div className="pt-4 border-t border-[#241344] space-y-3">
            <span className="text-purple-300/70 text-[11px] font-extrabold uppercase tracking-wider block">
              Direct Social Media Contact:
            </span>

            {!hasContactInfo ? (
              <div className="bg-[#180d33] border border-[#2d1852] p-4 rounded-2xl flex items-center gap-3 text-purple-300/80 text-xs font-semibold">
                <Info className="w-5 h-5 text-purple-400 shrink-0" />
                <span>Seller has not provided contact information</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-200 border border-emerald-500/40 p-3 rounded-2xl transition cursor-pointer group shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block text-[10px] font-extrabold uppercase text-emerald-400">WhatsApp</span>
                        <span className="text-xs font-bold text-white">{rawWhatsapp}</span>
                      </div>
                    </div>
                    <span className="bg-emerald-600 group-hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition shadow-md flex items-center gap-1.5">
                      <span>Chat on WhatsApp</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </a>
                )}

                {tgUrl && (
                  <a
                    href={tgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-sky-950/80 hover:bg-sky-900/90 text-sky-200 border border-sky-500/40 p-3 rounded-2xl transition cursor-pointer group shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/30">
                        <Send className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block text-[10px] font-extrabold uppercase text-sky-400">Telegram</span>
                        <span className="text-xs font-bold text-white">{rawTelegram.startsWith('@') ? rawTelegram : `@${tgUsername}`}</span>
                      </div>
                    </div>
                    <span className="bg-sky-600 group-hover:bg-sky-500 text-white px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition shadow-md flex items-center gap-1.5">
                      <span>Chat on Telegram</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
