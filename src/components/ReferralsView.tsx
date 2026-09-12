import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  ArrowLeft, 
  Gift, 
  Copy, 
  Check, 
  Users, 
  Clock, 
  Coins, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { db } from '../lib/firebase';
import { ReferralRecord, UserProfile } from '../types';

interface ReferralsViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  onBack: () => void;
  onProfileUpdated?: (updated: Partial<UserProfile>) => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

/**
 * Deterministically generates or ensures a referral code in the format REF + 8 digits (e.g. REF94646145)
 */
export function generateUserReferralCode(uid?: string): string {
  if (!uid) {
    const random8 = Math.floor(10000000 + Math.random() * 90000000);
    return `REF${random8}`;
  }
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash) + uid.charCodeAt(i);
    hash = Math.abs(hash | 0);
  }
  const digits = String(hash).padEnd(8, '4').slice(0, 8);
  return `REF${digits}`;
}

export const ReferralsView: React.FC<ReferralsViewProps> = ({
  user,
  userProfile,
  onBack,
  onProfileUpdated,
  onOpenAuth
}) => {
  const [referralsList, setReferralsList] = useState<ReferralRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Compute or generate REF referral code matching REF94646145
  const currentReferralCode = React.useMemo(() => {
    if (userProfile?.referralCode && userProfile.referralCode.startsWith('REF')) {
      return userProfile.referralCode;
    }
    return generateUserReferralCode(user?.uid);
  }, [userProfile?.referralCode, user?.uid]);

  // Persist the REF referral code in Firestore if user is missing one or has an old legacy format
  useEffect(() => {
    if (!user?.uid) return;
    if (!userProfile?.referralCode || !userProfile.referralCode.startsWith('REF')) {
      const generatedCode = generateUserReferralCode(user.uid);
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, { referralCode: generatedCode }, { merge: true })
        .then(() => {
          if (onProfileUpdated) {
            onProfileUpdated({ referralCode: generatedCode });
          }
        })
        .catch((err) => {
          console.warn('Error saving generated referral code to Firestore:', err);
        });
    }
  }, [user?.uid, userProfile?.referralCode, onProfileUpdated]);

  // Real-time Firestore subscription to user's referrals
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'referrals'), where('referrerId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ReferralRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as ReferralRecord);
        });
        list.sort((a, b) => new Date(b.referredAt || 0).getTime() - new Date(a.referredAt || 0).getTime());
        setReferralsList(list);
      },
      (err) => {
        console.warn('Error reading referrals list:', err);
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Copy referral code to clipboard
  const handleCopyCode = () => {
    if (!currentReferralCode) return;
    navigator.clipboard.writeText(currentReferralCode);
    setCopied(true);
    showToast('Referral code copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  // Compute statistics
  const totalCount = Math.max(referralsList.length, userProfile?.referralCount || 0);
  const pendingCount = referralsList.filter((r) => !r.rewardClaimed).length;
  const rewardedCount = referralsList.filter((r) => r.rewardClaimed).length;
  const totalEarnings = userProfile?.totalReferralEarnings || referralsList
    .filter((r) => r.rewardClaimed)
    .reduce((sum, r) => sum + (r.rewardAmount || 100), 0);

  return (
    <div className="w-full max-w-md mx-auto min-h-[calc(100vh-80px)] px-4 sm:px-6 pt-2 pb-24 animate-in fade-in duration-200">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all max-w-[90vw] ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700' 
            : 'bg-rose-950/90 text-rose-200 border-rose-700'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Bar: Back Button & Centered Title */}
      <div className="flex items-center justify-between pt-1 mb-5">
        <button
          type="button"
          id="referrals-back-btn"
          onClick={onBack}
          className="w-11 h-11 rounded-2xl border border-[#E2E8F0] bg-white flex items-center justify-center text-[#0F172A] shadow-xs hover:bg-slate-50 transition cursor-pointer active:scale-95 shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-[#0F172A] stroke-[2.5]" />
        </button>

        <h1 className="text-lg font-bold text-[#0F172A] tracking-tight text-center flex-1 pr-1">
          Referrals
        </h1>

        {/* Optical spacing balance */}
        <div className="w-11 h-11 shrink-0" aria-hidden="true" />
      </div>

      {/* Login Prompt Banner (if guest) */}
      {!user && (
        <div className="mb-5 p-4 rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-between">
          <div className="text-xs text-[#3730A3]">
            <p className="font-bold">Sign in to track your referrals</p>
            <p className="text-[11px] text-[#4F46E5]">Earn ₦100 NGN for each friend who shops.</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth && onOpenAuth('login')}
            className="px-3.5 py-2 bg-[#5B4DF5] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#4E3EE8] cursor-pointer"
          >
            Sign In
          </button>
        </div>
      )}

      {/* 1. Purple Gradient "Your Referral Code" Card */}
      <div className="bg-gradient-to-r from-[#5848F4] via-[#6355F6] to-[#7B61FF] rounded-3xl p-5 sm:p-6 text-white shadow-md shadow-indigo-500/15 mb-5">
        
        {/* Header inside: Gift Icon + Label */}
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-white stroke-[2.2]" />
          <span className="font-semibold text-white text-base">Your Referral Code</span>
        </div>

        {/* Inner Card displaying Code with Copy Icon */}
        <div className="bg-white/20 backdrop-blur-xs rounded-2xl px-5 py-4 flex items-center justify-between border border-white/10 shadow-inner">
          <span className="text-xl sm:text-2xl font-extrabold text-white tracking-wider font-mono select-all">
            {currentReferralCode}
          </span>

          <button
            type="button"
            id="copy-referral-code-btn"
            onClick={handleCopyCode}
            className="text-white hover:text-white/90 p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer active:scale-90"
            title="Copy referral code"
            aria-label="Copy referral code"
          >
            {copied ? (
              <Check className="w-5 h-5 text-emerald-300 stroke-[2.8]" />
            ) : (
              <Copy className="w-5 h-5 text-white stroke-[2.2]" />
            )}
          </button>
        </div>

      </div>

      {/* 2. Statistics Card */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8F0]/80 shadow-2xs mb-5">
        <h2 className="text-base font-bold text-[#0F172A] mb-4">Statistics</h2>

        <div className="grid grid-cols-2 gap-3">
          
          {/* Stat 1: Total */}
          <div className="bg-[#F1F3F9] rounded-2xl p-4 flex flex-col justify-between min-h-[76px]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#5B4DF5] stroke-[2.2]" />
              <span className="text-xs font-semibold text-[#64748B]">Total</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-[#0F172A] mt-2">
              {totalCount}
            </span>
          </div>

          {/* Stat 2: Pending */}
          <div className="bg-[#F1F3F9] rounded-2xl p-4 flex flex-col justify-between min-h-[76px]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#5B4DF5] stroke-[2.2]" />
              <span className="text-xs font-semibold text-[#64748B]">Pending</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-[#0F172A] mt-2">
              {pendingCount}
            </span>
          </div>

          {/* Stat 3: Rewarded */}
          <div className="bg-[#F1F3F9] rounded-2xl p-4 flex flex-col justify-between min-h-[76px]">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#5B4DF5] stroke-[2.8]" />
              <span className="text-xs font-semibold text-[#64748B]">Rewarded</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-[#0F172A] mt-2">
              {rewardedCount}
            </span>
          </div>

          {/* Stat 4: Total Reward */}
          <div className="bg-[#F1F3F9] rounded-2xl p-4 flex flex-col justify-between min-h-[76px]">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#5B4DF5] stroke-[2.2]" />
              <span className="text-xs font-semibold text-[#64748B]">Total Reward</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-[#0F172A] mt-2">
              ₦{totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

        </div>
      </div>

      {/* 3. Referrals Card */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8F0]/80 shadow-2xs min-h-[220px] flex flex-col mb-6">
        <h2 className="text-base font-bold text-[#0F172A] mb-4">Referrals</h2>

        {referralsList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F1F3F9] flex items-center justify-center mb-3">
              <Users className="w-7 h-7 text-[#94A3B8] stroke-[1.8]" />
            </div>
            <p className="text-sm font-medium text-[#94A3B8]">No referrals yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9] space-y-3">
            {referralsList.map((refItem) => (
              <div key={refItem.id} className="pt-3 first:pt-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#EDE9FE] flex items-center justify-center text-[#5B4DF5] font-bold text-xs">
                    {(refItem.referredUserName || refItem.referredUserEmail || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">
                      {refItem.referredUserName || refItem.referredUserEmail?.split('@')[0] || 'Referred Friend'}
                    </p>
                    <p className="text-[10px] text-[#64748B]">
                      {refItem.referredAt ? new Date(refItem.referredAt).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    refItem.rewardClaimed 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                  }`}>
                    {refItem.rewardClaimed ? `Rewarded (+₦${refItem.rewardAmount || 100})` : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
