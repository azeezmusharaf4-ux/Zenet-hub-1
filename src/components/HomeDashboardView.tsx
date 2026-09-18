import React, { useMemo, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  CreditCard,
  Plus, 
  Users, 
  Phone, 
  TrendingUp, 
  Sparkles, 
  User as UserIcon, 
  ChevronRight, 
  Clock, 
  Inbox,
  ArrowDownLeft,
  CheckCircle2
} from 'lucide-react';
import { ActiveAppView, PurchaseRecord, UserProfile } from '../types';
import { DashboardTab } from './UserDashboardModal';

interface HomeDashboardViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  walletBalance: number;
  purchases: PurchaseRecord[];
  onOpenWallet: () => void;
  onSelectView: (view: ActiveAppView) => void;
  onOpenZenetUpdate: () => void;
  onSelectPurchase: (purchase: PurchaseRecord) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenDashboard: (tab?: DashboardTab) => void;
  onBalanceChange?: (newBalance: number) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  user,
  userProfile,
  walletBalance,
  purchases,
  onOpenWallet,
  onSelectView,
  onOpenZenetUpdate,
  onSelectPurchase,
  onOpenAuth,
  onOpenDashboard,
  onBalanceChange,
}) => {
  // Direct Real-Time Firestore Balance Listener for Instant Dynamic Sync
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const onBalanceChangeRef = React.useRef(onBalanceChange);
  useEffect(() => {
    onBalanceChangeRef.current = onBalanceChange;
  }, [onBalanceChange]);

  useEffect(() => {
    if (!user?.uid || !db) {
      setLiveBalance(null);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const walletDocRef = doc(db, 'wallets', user.uid);

    const unsubscribeUser = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const raw = data?.walletBalance !== undefined ? data?.walletBalance : data?.balance;
          const parsed = typeof raw === 'number' ? raw : (raw ? Number(raw) : 0);
          const safe = isNaN(parsed) ? 0 : parsed;
          setLiveBalance(safe);
          if (onBalanceChangeRef.current) {
            onBalanceChangeRef.current(safe);
          }
        }
      },
      (err) => {
        console.warn('[HomeDashboardView] Real-time user balance listener notice:', err);
      }
    );

    const unsubscribeWallet = onSnapshot(
      walletDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const raw = data?.walletBalance !== undefined ? data?.walletBalance : data?.balance;
          const parsed = typeof raw === 'number' ? raw : (raw ? Number(raw) : 0);
          const safe = isNaN(parsed) ? 0 : parsed;
          setLiveBalance((prev) => (prev === null ? safe : Math.max(prev, safe)));
          if (onBalanceChangeRef.current) {
            onBalanceChangeRef.current(safe);
          }
        }
      },
      () => {
        // Silent fallback if wallets/{userId} not initialized yet
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeWallet();
    };
  }, [user?.uid]);

  // Priority: live real-time listener balance > props.walletBalance > 0
  const currentDisplayBalance = liveBalance !== null ? liveBalance : (walletBalance || 0);

  // 1. Time-aware dynamic greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // 2. User display name from real data
  const displayName = useMemo(() => {
    if (userProfile?.username) return userProfile.username;
    if (userProfile?.fullName) return userProfile.fullName;
    if (user?.displayName) return user.displayName;
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return 'Basit';
  }, [userProfile, user]);

  // 3. Format date for real activity
  const formatActivityDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Recently';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  // 4. Resolve service icon based on purchase record
  const getServiceIcon = (p: PurchaseRecord) => {
    const title = (p.listingTitle || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const type = (p.type || '').toLowerCase();

    if (type.includes('number') || cat.includes('number') || title.includes('sms') || title.includes('number')) {
      return <Phone className="w-5 h-5 text-[#5B4DF5]" />;
    }
    if (type.includes('boost') || cat.includes('boost') || title.includes('boost') || title.includes('followers')) {
      return <TrendingUp className="w-5 h-5 text-[#5B4DF5]" />;
    }
    if (type.includes('update') || cat.includes('update') || title.includes('update')) {
      return <Sparkles className="w-5 h-5 text-[#5B4DF5]" />;
    }
    return <Users className="w-5 h-5 text-[#5B4DF5]" />;
  };

  return (
    <div className="w-full max-w-xl sm:max-w-2xl md:max-w-3xl mx-auto space-y-6 sm:space-y-7 animate-in fade-in duration-200 pb-24 md:pb-8 px-1 sm:px-2">
      
      {/* 1. TOP SECTION: Time-based Greeting & User Profile Avatar */}
      <div className="flex items-center justify-between pt-1">
        <div className="min-w-0 pr-3">
          <p className="text-xs sm:text-sm font-medium text-[#64748B] tracking-normal">
            {greeting}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight mt-0.5 truncate">
            {displayName}
          </h1>
        </div>

        {/* Real Profile Avatar / Account Settings Trigger */}
        <button
          onClick={() => (user ? onSelectView('profile') : onOpenAuth('login'))}
          className="w-12 h-12 sm:w-13 sm:h-13 rounded-full ring-2 ring-[#EDE9FE] bg-[#EDE9FE] flex items-center justify-center overflow-hidden hover:ring-[#5B4DF5] transition-all cursor-pointer shadow-2xs group shrink-0 active:scale-95"
          title={user ? 'Open Profile' : 'Sign In'}
          aria-label="User Profile"
        >
          {userProfile?.photoURL || userProfile?.avatarUrl || user?.photoURL ? (
            <img
              src={userProfile?.photoURL || userProfile?.avatarUrl || user?.photoURL || ''}
              alt={displayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon className="w-6 h-6 text-[#5B4DF5] group-hover:scale-110 transition duration-200" />
          )}
        </button>
      </div>

      {/* 2. WALLET CARD: Premium Indigo-Violet Gradient with Real Balance & Paystack Fund Action */}
      <div className="w-full bg-gradient-to-br from-[#5B4DF5] via-[#6557F6] to-[#7546F8] rounded-[26px] sm:rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden">
        {/* Soft atmospheric glow accents */}
        <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-purple-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-4 sm:space-y-5">
          {/* Header Row: Label + Active Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-white/90 tracking-wide">
              Wallet Balance
            </span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-xs font-semibold border border-white/20 shadow-2xs">
              <CreditCard className="w-3.5 h-3.5 text-white" />
              <span>Active</span>
            </div>
          </div>

          {/* Balance Display (Real user wallet balance in NGN) */}
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
              ₦{Number(currentDisplayBalance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Full-width Add Money Button (Connects directly to Paystack funding modal) */}
          <button
            id="wallet-add-money-btn"
            onClick={onOpenWallet}
            className="w-full py-3.5 sm:py-4 px-4 rounded-2xl bg-white text-[#5B4DF5] hover:bg-slate-50 active:scale-[0.99] font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs transition cursor-pointer group"
          >
            <Plus className="w-4 h-4 stroke-[3] text-[#5B4DF5] group-hover:rotate-90 transition-transform duration-200" />
            <span>Add Money</span>
          </button>
        </div>
      </div>

      {/* 3. QUICK ACTIONS: EXCLUSIVELY THE 4 REAL ZENET HUB SERVICES */}
      <div>
        <div className="flex items-center justify-between mb-3.5 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-[#0F172A] tracking-tight">
            Quick Actions
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {/* Service 1: Social Media Accounts */}
          <button
            id="quick-action-social-accounts"
            onClick={() => onSelectView('log-accounts')}
            className="bg-[#F8F7FD] hover:bg-[#F2EFFC] border border-[#EBE7F7] hover:border-[#5B4DF5]/40 rounded-2xl sm:rounded-[22px] p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-[0.98] min-h-[125px] sm:min-h-[145px]"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-105 group-hover:bg-[#5B4DF5] group-hover:text-white transition-all duration-200 shadow-2xs">
              <Users className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#5B4DF5] transition-colors leading-tight">
              Social Media Accounts
            </span>
            <span className="text-[10px] sm:text-xs text-[#64748B] font-medium mt-1 leading-snug">
              Aged & verified logs
            </span>
          </button>

          {/* Service 2: Service Number */}
          <button
            id="quick-action-service-number"
            onClick={() => onSelectView('virtual-numbers')}
            className="bg-[#F8F7FD] hover:bg-[#F2EFFC] border border-[#EBE7F7] hover:border-[#5B4DF5]/40 rounded-2xl sm:rounded-[22px] p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-[0.98] min-h-[125px] sm:min-h-[145px]"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-105 group-hover:bg-[#5B4DF5] group-hover:text-white transition-all duration-200 shadow-2xs">
              <Phone className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#5B4DF5] transition-colors leading-tight">
              Service Number
            </span>
            <span className="text-[10px] sm:text-xs text-[#64748B] font-medium mt-1 leading-snug">
              Virtual OTP & SMS
            </span>
          </button>

          {/* Service 3: Social Boost */}
          <button
            id="quick-action-social-boost"
            onClick={() => onSelectView('social-boost')}
            className="bg-[#F8F7FD] hover:bg-[#F2EFFC] border border-[#EBE7F7] hover:border-[#5B4DF5]/40 rounded-2xl sm:rounded-[22px] p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-[0.98] min-h-[125px] sm:min-h-[145px]"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-105 group-hover:bg-[#5B4DF5] group-hover:text-white transition-all duration-200 shadow-2xs">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#5B4DF5] transition-colors leading-tight">
              Social Boost
            </span>
            <span className="text-[10px] sm:text-xs text-[#64748B] font-medium mt-1 leading-snug">
              Followers & growth
            </span>
          </button>

          {/* Service 4: ZENET Update */}
          <button
            id="quick-action-zenet-update"
            onClick={onOpenZenetUpdate}
            className="bg-[#F8F7FD] hover:bg-[#F2EFFC] border border-[#EBE7F7] hover:border-[#5B4DF5]/40 rounded-2xl sm:rounded-[22px] p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-[0.98] min-h-[125px] sm:min-h-[145px]"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-105 group-hover:bg-[#5B4DF5] group-hover:text-white transition-all duration-200 shadow-2xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#5B4DF5] transition-colors leading-tight">
              ZENET Update
            </span>
            <span className="text-[10px] sm:text-xs text-[#64748B] font-medium mt-1 leading-snug">
              System files & tools
            </span>
          </button>
        </div>
      </div>

      {/* 4. RECENT ACTIVITIES: REAL USER PURCHASES & TRANSACTIONS ONLY */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-3.5">
          <h2 className="text-lg sm:text-xl font-extrabold text-[#0F172A] tracking-tight">
            Recent Activities
          </h2>
          <button
            onClick={() => onSelectView('orders')}
            className="text-xs sm:text-sm font-bold text-[#5B4DF5] hover:text-[#4338CA] flex items-center gap-1 cursor-pointer transition group"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {purchases && purchases.length > 0 ? (
          <div className="space-y-2.5 sm:space-y-3">
            {purchases.slice(0, 5).map((purchase) => {
              const amount = purchase.paidAmount || purchase.price || 0;
              const isCompleted = purchase.status === 'completed';

              return (
                <div
                  key={purchase.id}
                  onClick={() => onSelectPurchase(purchase)}
                  className="w-full bg-white border border-[#EAE6F8] rounded-2xl sm:rounded-[20px] p-3.5 sm:p-4 flex items-center justify-between shadow-2xs hover:border-[#5B4DF5]/40 hover:shadow-xs transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 pr-2">
                    <div className="w-11 h-11 rounded-2xl bg-[#EDE9FE] flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-[#5B4DF5] group-hover:text-white transition duration-200">
                      {getServiceIcon(purchase)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#5B4DF5] transition-colors truncate">
                        {purchase.listingTitle || 'Service Order'}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[#64748B] flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-[#94A3B8]" />
                          {formatActivityDate(purchase.purchasedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-xs sm:text-sm text-[#0F172A]">
                      ₦{amount.toLocaleString()}
                    </div>
                    <div className="mt-0.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-purple-50 text-[#5B4DF5] border border-[#DDD6FE]'
                        }`}
                      >
                        {isCompleted ? 'Completed' : purchase.status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Clean, elegant empty state when user has no real records yet (as in reference at 0:03) */
          <div className="bg-white border border-[#EAE6F8] rounded-2xl sm:rounded-[22px] p-8 sm:p-10 text-center flex flex-col items-center justify-center shadow-2xs">
            <div className="w-13 h-13 rounded-2xl bg-[#F4F2FC] text-[#5B4DF5] flex items-center justify-center mb-3 shadow-2xs">
              <Inbox className="w-6 h-6 text-[#5B4DF5]" />
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-[#1E293B]">
              No recent activities
            </h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-xs leading-relaxed">
              Your service orders and account purchases will appear here automatically.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
