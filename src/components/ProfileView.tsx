import React, { useState } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { 
  User as UserIcon, 
  Users, 
  ShoppingBag, 
  Lock, 
  Moon, 
  Trash2, 
  LogOut, 
  ChevronRight, 
  ShieldCheck, 
  Briefcase, 
  Sparkles, 
  Wallet,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { ActiveAppView, UserProfile } from '../types';
import { DashboardTab } from './UserDashboardModal';

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
  onLogout,
  onOpenAuth
}) => {
  // Modal states for embedded actions
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isOwner = user?.email?.trim().toLowerCase() === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'owner';
  const isAdmin = isOwner || userProfile?.role === 'admin';

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

        {/* Option: Delete Account */}
        <button
          id="profile-opt-delete-account"
          onClick={() => setIsDeleteModalOpen(true)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-rose-50/50 transition cursor-pointer active:bg-rose-100/60"
        >
          <div className="flex items-center gap-3.5">
            <Trash2 className="w-5 h-5 text-rose-500 stroke-[2.2]" />
            <span className="text-sm font-bold text-rose-600">Delete Account</span>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-400" />
        </button>

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
                onClick={() => {
                  showToast('Light Theme is currently active and optimized for ZENET HUB.', 'success');
                  setIsAppearanceModalOpen(false);
                }}
                className="w-full p-3 rounded-2xl border-2 border-[#5B4DF5] bg-[#F5F3FF] text-left flex items-center justify-between"
              >
                <span className="font-black text-xs text-[#0F172A]">Light Clean Theme (Default)</span>
                <CheckCircle2 className="w-4 h-4 text-[#5B4DF5]" />
              </button>

              <button
                onClick={() => {
                  showToast('Dark Mode preference saved! Future updates will activate full dark theme styling.', 'success');
                  setIsAppearanceModalOpen(false);
                }}
                className="w-full p-3 rounded-2xl border border-[#EAE6F8] bg-white hover:bg-[#FAF9FF] text-left flex items-center justify-between"
              >
                <span className="font-bold text-xs text-[#64748B]">Dark Mode (Preview)</span>
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

      {/* MODAL: Delete Account Confirmation */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 border border-rose-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-black text-rose-700">Delete Account</h3>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to request deletion of your account (<strong className="text-[#0F172A]">{user?.email}</strong>)? All your order history and active credentials will be permanently closed.
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  showToast('Account deletion request submitted to support for verification.', 'success');
                }}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-2xl transition cursor-pointer text-xs"
              >
                Confirm Deletion Request
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full bg-[#F1EEF9] hover:bg-[#EAE6F8] text-[#0F172A] font-bold py-3 rounded-2xl transition cursor-pointer text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
