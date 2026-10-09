import React, { useState, useEffect } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  User as UserIcon, 
  Users, 
  ShoppingBag, 
  Lock, 
  Moon, 
  LogOut, 
  ChevronRight, 
  ShieldCheck, 
  Briefcase, 
  Sparkles, 
  Wallet,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  ArrowDownToLine,
  Bell
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { isAuthorizedOwner } from '../lib/authorizedOwners';
import { ActiveAppView, UserProfile } from '../types';
import { useTheme } from '../context/ThemeContext';
import { DashboardTab } from './UserDashboardModal';
import { PaymentNotificationsModal } from './PaymentNotificationsModal';
import { NotificationsModal } from './NotificationsModal';

interface ProfileViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  walletBalance: number;
  ordersCount?: number;
  savedCount?: number;
  unreadMessagesCount?: number;
  onSelectView: (view: ActiveAppView) => void;
  onOpenDashboard: (tab?: DashboardTab) => void;
  onOpenWallet: () => void;
  onOpenAdmin?: () => void;
  onOpenSellerDashboard?: () => void;
  onOpenZenetUpdateGenerator?: () => void;
  onOpenWithdraw?: () => void;
  onLogout: () => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  userProfile,
  walletBalance,
  ordersCount = 0,
  savedCount = 0,
  unreadMessagesCount = 0,
  onSelectView,
  onOpenDashboard,
  onOpenWallet,
  onOpenAdmin,
  onOpenSellerDashboard,
  onOpenZenetUpdateGenerator,
  onOpenWithdraw,
  onLogout,
  onOpenAuth
}) => {
  // Modal states for embedded actions
  const { theme, setTheme } = useTheme();
  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);
  const [isPaymentNotificationsOpen, setIsPaymentNotificationsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingStockCount, setPendingStockCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isOwner = isAuthorizedOwner(user, userProfile);
  const isAdmin = isOwner || userProfile?.role === 'admin';

  // Listen to pending withdrawal notifications count in real-time
  useEffect(() => {
    if (!user || !isAdmin || !db) return;
    const q = query(
      collection(db, 'withdrawal_requests'),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    }, (err) => {
      console.warn('Notice loading pending withdrawals count:', err);
    });
    return () => unsub();
  }, [user?.uid, isAdmin]);

  // Listen to pending stock submissions count for Owner in real-time
  useEffect(() => {
    if (!user || !isOwner || !db) return;
    const q = query(
      collection(db, 'listings'),
      where('approvalStatus', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setPendingStockCount(snapshot.size);
    }, (err) => {
      console.warn('Notice loading pending stock count:', err);
    });
    return () => unsub();
  }, [user?.uid, isOwner]);

  // Listen to unread user notifications count in real-time
  useEffect(() => {
    if (!user || !db) return;
    const targetUids = isOwner ? [user.uid, 'owner'] : [user.uid];
    const q = query(
      collection(db, 'user_notifications'),
      where('userId', 'in', targetUids),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setUnreadNotificationsCount(snapshot.size);
    }, (err) => {
      console.warn('Notice loading unread notifications count:', err);
    });
    return () => unsub();
  }, [user?.uid, isOwner]);

  // Display Name
  const displayName = userProfile?.username || userProfile?.fullName || user?.displayName || user?.email?.split('@')[0] || 'User';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle password reset email
  const handlePasswordReset = async () => {
    if (!user?.email) {
      showToast('No email address associated with this account.', 'error');
      return;
    }
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast(`Password reset link sent to ${user.email}. Check your inbox!`, 'success');
    } catch (err: any) {
      console.error('Password reset error:', err);
      showToast(err?.message || 'Failed to send reset email. Please try again.', 'error');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="w-full max-w-xl sm:max-w-2xl md:max-w-3xl mx-auto space-y-4 sm:space-y-5 animate-in fade-in duration-200 pb-24 md:pb-10 px-1 sm:px-2">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all max-w-[90vw] ${
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

      {/* 1. Page Title */}
      <div className="pt-2">
        <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
          Profile
        </h1>
      </div>

      {/* 2. Top User Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE6F8] shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-[#EDE9FE] border-2 border-[#5B4DF5]/20 flex items-center justify-center text-[#5B4DF5] shrink-0 overflow-hidden shadow-xs">
            {user?.photoURL || userProfile?.photoURL ? (
              <img
                src={user?.photoURL || userProfile?.photoURL}
                alt={displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-[#E0E7FF] flex items-center justify-center">
                <UserIcon className="w-7 h-7 text-[#3B82F6]" />
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-[#0F172A] truncate tracking-tight">
                {displayName}
              </h2>
              {isOwner && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase shrink-0">
                  OWNER
                </span>
              )}
              {!isOwner && isAdmin && (
                <span className="bg-[#EDE9FE] text-[#5B4DF5] border border-[#DDD6FE] font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase shrink-0">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-[#64748B] truncate mt-0.5">
              {user?.email || 'No email provided'}
            </p>
          </div>
        </div>

        {/* Edit Profile Quick Action Button */}
        <button
          id="profile-quick-edit-action-btn"
          onClick={() => onSelectView('edit-profile')}
          className="w-11 h-11 rounded-2xl bg-[#F5F3FF] hover:bg-[#EDE9FE] border border-[#DDD6FE] text-[#5B4DF5] flex items-center justify-center shrink-0 cursor-pointer transition active:scale-95 shadow-xs"
          title="Edit Profile"
          aria-label="Edit Profile"
        >
          <UserCheck className="w-5 h-5" />
        </button>
      </div>

      {/* 3. Main Options Card: Clean list with subtle dividers */}
      <div className="bg-white rounded-3xl border border-[#EAE6F8] shadow-sm divide-y divide-[#F1EEF9] overflow-hidden">
        
        {/* Option: Payment Notifications (Owner & Admin) */}
        {isAdmin && (
          <button
            id="profile-opt-payment-notifications"
            onClick={() => setIsPaymentNotificationsOpen(true)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF] bg-purple-50/40"
          >
            <div className="flex items-center gap-3.5">
              <div className="relative w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 stroke-[2.4]" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse ring-2 ring-white"></span>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0F172A]">🔔 Payment Notifications</span>
                  {pendingCount > 0 && (
                    <span className="text-[10px] font-extrabold bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Review customer withdrawals & confirm payment</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
          </button>
        )}

        {/* Option: Log Approve (Exclusively Owner Stock Approval Center) */}
        {isOwner && (
          <button
            id="profile-opt-log-approve"
            onClick={() => onSelectView('log-approve')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF] bg-amber-50/30"
          >
            <div className="flex items-center gap-3.5">
              <div className="relative w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 stroke-[2.4]" />
                {pendingStockCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse ring-2 ring-white"></span>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0F172A]">Log Approve</span>
                  {pendingStockCount > 0 && (
                    <span className="text-[10px] font-extrabold bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                      {pendingStockCount} pending
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Stock approval center & security review</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full uppercase">
                OWNER
              </span>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </div>
          </button>
        )}

        {/* Option: Notifications (Permanent notification center for all authenticated users) */}
        {user && (
          <button
            id="profile-opt-notifications"
            onClick={() => setIsNotificationsOpen(true)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
          >
            <div className="flex items-center gap-3.5">
              <div className="relative w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 stroke-[2.4]" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse ring-2 ring-white"></span>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0F172A]">Notifications</span>
                  {unreadNotificationsCount > 0 && (
                    <span className="text-[10px] font-extrabold bg-[#5B4DF5] text-white px-2 py-0.5 rounded-full">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Stock submissions, approvals & audit updates</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadNotificationsCount > 0 && (
                <span className="text-xs font-bold text-[#5B4DF5]">
                  [{unreadNotificationsCount}]
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </div>
          </button>
        )}

        {/* Option: Edit Profile */}
        <button
          id="profile-opt-edit"
          onClick={() => onSelectView('edit-profile')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
        >
          <div className="flex items-center gap-3.5">
            <UserIcon className="w-5 h-5 text-[#64748B] stroke-[2.2]" />
            <span className="text-sm font-bold text-[#0F172A]">Edit Profile</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
        </button>

        {/* Option: Referral */}
        <button
          id="profile-opt-referral"
          onClick={() => onSelectView('referrals')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
        >
          <div className="flex items-center gap-3.5">
            <Users className="w-5 h-5 text-[#64748B] stroke-[2.2]" />
            <span className="text-sm font-bold text-[#0F172A]">Referral</span>
          </div>
          <div className="flex items-center gap-2">
            {(userProfile?.totalReferralEarnings || 0) > 0 && (
              <span className="text-[10px] font-extrabold bg-[#EDE9FE] text-[#5B4DF5] px-2 py-0.5 rounded-full">
                ₦{(userProfile?.totalReferralEarnings || 0).toLocaleString()}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
          </div>
        </button>

        {/* Option: Withdraw (Exclusively Owner & Authorized Admins) */}
        {isAdmin && (
          <button
            id="profile-opt-withdraw"
            onClick={() => onOpenWithdraw ? onOpenWithdraw() : onSelectView('withdrawals')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center">
                <ArrowDownToLine className="w-4 h-4 stroke-[2.4]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0F172A]">Withdraw</span>
                  <span className="text-[10px] font-extrabold bg-[#EDE9FE] text-[#5B4DF5] px-1.5 py-0.2 rounded-md">
                    ADMIN
                  </span>
                </div>
                <span className="text-[11px] text-[#64748B] font-medium">Payout earnings to bank account</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#0F172A]">
                ₦{walletBalance.toLocaleString()}
              </span>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </div>
          </button>
        )}

        {/* Option: Order History (moved from bottom nav) */}
        <button
          id="profile-opt-orders"
          onClick={() => onSelectView('orders')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
        >
          <div className="flex items-center gap-3.5">
            <ShoppingBag className="w-5 h-5 text-[#64748B] stroke-[2.2]" />
            <span className="text-sm font-bold text-[#0F172A]">Order History</span>
          </div>
          <div className="flex items-center gap-2">
            {ordersCount > 0 && (
              <span className="text-[10px] font-extrabold bg-[#EDE9FE] text-[#5B4DF5] px-2 py-0.5 rounded-full">
                {ordersCount} orders
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
          </div>
        </button>

        {/* Option: Change Password */}
        <button
          id="profile-opt-password"
          onClick={() => onSelectView('change-password')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
        >
          <div className="flex items-center gap-3.5">
            <Lock className="w-5 h-5 text-[#64748B] stroke-[2.2]" />
            <span className="text-sm font-bold text-[#0F172A]">Change Password</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
        </button>

        {/* Option: Change Appearance */}
        <button
          id="profile-opt-appearance"
          onClick={() => setIsAppearanceModalOpen(true)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
        >
          <div className="flex items-center gap-3.5">
            <Moon className="w-5 h-5 text-[#64748B] stroke-[2.2]" />
            <span className="text-sm font-bold text-[#0F172A]">Change Appearance</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
        </button>

        {/* Admin & Owner Options */}
        {isOwner && onOpenAdmin && (
          <button
            id="profile-opt-admin-center"
            onClick={onOpenAdmin}
            className="w-full px-5 py-4 flex items-center justify-between text-left bg-rose-50/70 hover:bg-rose-100/80 transition cursor-pointer active:bg-rose-200"
          >
            <div className="flex items-center gap-3.5">
              <ShieldCheck className="w-5 h-5 text-rose-600 stroke-[2.2]" />
              <span className="text-sm font-bold text-rose-900">Admin Center</span>
            </div>
            <span className="bg-rose-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
              OWNER
            </span>
          </button>
        )}

        {isAdmin && onOpenSellerDashboard && (
          <button
            id="profile-opt-seller-dashboard"
            onClick={onOpenSellerDashboard}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
          >
            <div className="flex items-center gap-3.5">
              <Briefcase className="w-5 h-5 text-[#5B4DF5] stroke-[2.2]" />
              <span className="text-sm font-bold text-[#0F172A]">Seller Dashboard / Console</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
          </button>
        )}

        {isOwner && onOpenZenetUpdateGenerator && (
          <button
            id="profile-opt-generate-update"
            onClick={onOpenZenetUpdateGenerator}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
          >
            <div className="flex items-center gap-3.5">
              <Sparkles className="w-5 h-5 text-amber-500 stroke-[2.2]" />
              <span className="text-sm font-bold text-[#0F172A]">Generate Update</span>
            </div>
            <span className="bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[9px] px-2 py-0.5 rounded-md uppercase">
              OWNER
            </span>
          </button>
        )}

        {isOwner && (
          <button
            id="profile-opt-wallet-override"
            onClick={() => onSelectView('admin_wallets')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
          >
            <div className="flex items-center gap-3.5">
              <Wallet className="w-5 h-5 text-[#5B4DF5] stroke-[2.2]" />
              <span className="text-sm font-bold text-[#0F172A]">Wallet Override</span>
            </div>
            <span className="bg-[#EDE9FE] text-[#5B4DF5] font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase">
              OWNER
            </span>
          </button>
        )}

        {/* Option: Logout */}
        <button
          id="profile-opt-logout"
          onClick={onLogout}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF9FF] transition cursor-pointer active:bg-[#F3EEFF]"
        >
          <div className="flex items-center gap-3.5">
            <LogOut className="w-5 h-5 text-[#64748B] stroke-[2.2]" />
            <span className="text-sm font-bold text-[#0F172A]">Logout</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
        </button>

      </div>

      {/* MODAL: Appearance Settings */}
      {isAppearanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 border border-[#EAE6F8] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE6F8]">
              <div className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-[#5B4DF5]" />
                <h3 className="text-base font-black text-[#0F172A]">Appearance Mode</h3>
              </div>
              <button 
                onClick={() => setIsAppearanceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F1EEF9] flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  showToast('Light Clean Theme activated.', 'success');
                }}
                className={`w-full p-3 rounded-2xl border-2 text-left flex items-center justify-between cursor-pointer transition ${
                  theme === 'light'
                    ? 'border-[#5B4DF5] bg-[#F5F3FF]'
                    : 'border-[#EAE6F8] bg-white hover:bg-[#FAF9FF]'
                }`}
              >
                <span className={`font-black text-xs ${theme === 'light' ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                  Light Clean Theme (Default)
                </span>
                {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-[#5B4DF5]" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  showToast('Dark Mode activated.', 'success');
                }}
                className={`w-full p-3 rounded-2xl border-2 text-left flex items-center justify-between cursor-pointer transition ${
                  theme === 'dark'
                    ? 'border-[#5B4DF5] bg-[#F5F3FF]'
                    : 'border-[#EAE6F8] bg-white hover:bg-[#FAF9FF]'
                }`}
              >
                <span className={`font-black text-xs ${theme === 'dark' ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                  Dark Mode
                </span>
                {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-[#5B4DF5]" />}
              </button>
            </div>

            <button
              onClick={() => setIsAppearanceModalOpen(false)}
              className="w-full bg-[#EDE9FE] text-[#5B4DF5] font-black py-2.5 rounded-2xl transition cursor-pointer text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Payment Notifications for Admin & Owner */}
      {isPaymentNotificationsOpen && (
        <PaymentNotificationsModal
          isOpen={isPaymentNotificationsOpen}
          onClose={() => setIsPaymentNotificationsOpen(false)}
          user={user}
        />
      )}

      {/* MODAL: Notifications Center */}
      {isNotificationsOpen && (
        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          user={user}
          userProfile={userProfile}
          onOpenLogApprove={() => {
            setIsNotificationsOpen(false);
            onSelectView('log-approve');
          }}
          onOpenSellerDashboard={onOpenSellerDashboard}
        />
      )}

    </div>
  );
};
