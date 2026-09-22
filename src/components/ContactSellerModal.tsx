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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white border border-[#EBE7F7] rounded-2xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-[#0F172A] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-[#F8F7FD] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#EBE7F7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#5B4DF5]" />
            <h2 className="font-extrabold text-[#0F172A] text-base">Contact Seller: {sellerProfile?.displayName || listing.sellerName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] bg-white border border-[#EBE7F7] rounded-full transition cursor-pointer shadow-2xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs sm:text-sm">
          
          {/* Account Summary Banner */}
          <div className="bg-[#F8F7FD] p-4 rounded-2xl border border-[#EBE7F7] flex items-center justify-between gap-3 shadow-2xs">
            <div>
              <span className="text-[10px] font-extrabold text-[#5B4DF5] uppercase tracking-wider">{listing.category}</span>
              <p className="font-bold text-[#0F172A] line-clamp-1">{listing.title}</p>
            </div>
            <span className="text-base font-black text-[#0F172A] shrink-0">₦{Number(listing.price).toLocaleString()}</span>
          </div>

          {!user && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">Log in to send in-app messages to sellers.</span>
              <button
                onClick={onOpenAuth}
                className="bg-amber-500 text-white font-extrabold px-3 py-1 rounded-full text-xs hover:bg-amber-600 transition cursor-pointer shadow-xs"
              >
                Log In
              </button>
            </div>
          )}

          {sent ? (
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="font-extrabold text-[#0F172A] text-base">Inquiry Delivered!</h3>
              <p className="text-[#64748B] text-xs">
                Your message was saved and sent to seller <strong className="text-[#0F172A]">{sellerProfile?.displayName || listing.sellerName}</strong>. You can track replies under your Inquiries tab.
              </p>
              <button
                onClick={onClose}
                className="bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-bold px-5 py-2 rounded-full text-xs transition cursor-pointer shadow-xs"
              >
                Close Window
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">Your Message to Seller</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-[#F8F7FD] text-[#0F172A] p-3 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-extrabold py-3 rounded-full shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Sending Inquiry...' : 'Send In-App Inquiry'}</span>
              </button>
            </form>
          )}

          {/* Direct Instant Contact Section */}
          <div className="pt-4 border-t border-[#EBE7F7] space-y-3">
            <span className="text-[#64748B] text-[11px] font-extrabold uppercase tracking-wider block">
              Direct Social Media Contact:
            </span>

            {!hasContactInfo ? (
              <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-4 rounded-2xl flex items-center gap-3 text-[#64748B] text-xs font-semibold">
                <Info className="w-5 h-5 text-[#5B4DF5] shrink-0" />
                <span>Seller has not provided contact information</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-emerald-50 hover:bg-emerald-100/80 text-emerald-950 border border-emerald-200 p-3 rounded-2xl transition cursor-pointer group shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block text-[10px] font-extrabold uppercase text-emerald-700">WhatsApp</span>
                        <span className="text-xs font-bold text-emerald-950">{rawWhatsapp}</span>
                      </div>
                    </div>
                    <span className="bg-emerald-600 group-hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition shadow-xs flex items-center gap-1.5">
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
                    className="flex items-center justify-between bg-sky-50 hover:bg-sky-100/80 text-sky-950 border border-sky-200 p-3 rounded-2xl transition cursor-pointer group shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 border border-sky-200">
                        <Send className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block text-[10px] font-extrabold uppercase text-sky-700">Telegram</span>
                        <span className="text-xs font-bold text-sky-950">{rawTelegram.startsWith('@') ? rawTelegram : `@${tgUsername}`}</span>
                      </div>
                    </div>
                    <span className="bg-sky-600 group-hover:bg-sky-700 text-white px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition shadow-xs flex items-center gap-1.5">
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
