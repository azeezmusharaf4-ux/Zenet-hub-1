import React from 'react';
import { User } from 'firebase/auth';
import { 
  Home, 
  CreditCard, 
  ShoppingCart, 
  Scroll, 
  LogOut,
  Store,
  Grid,
  Bookmark,
  MessageSquare,
  Gift,
  HelpCircle,
  Settings,
  ShieldCheck,
  Briefcase,
  Wallet,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { UserProfile, ActiveAppView } from '../types';

interface SidebarProps {
  user: User | null;
  userProfile: UserProfile | null;
  activeView: ActiveAppView;
  onSelectView: (view: ActiveAppView) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenCreateListing?: () => void;
  onOpenAdmin?: () => void;
  onOpenSellerDashboard?: () => void;
  onOpenZenetUpdateGenerator?: () => void;
  onLogout: () => void;
  savedCount?: number;
  unreadMessagesCount?: number;
  unreadTicketsCount?: number;
  walletBalance?: number;
  ordersCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  userProfile,
  activeView,
  onSelectView,
  onOpenAuth,
  onOpenAdmin,
  onOpenSellerDashboard,
  onOpenZenetUpdateGenerator,
  onLogout,
  savedCount = 0,
  unreadMessagesCount = 0,
  unreadTicketsCount = 0,
  walletBalance = 0,
  ordersCount = 0
}) => {
  const isOwner = user?.email?.trim().toLowerCase() === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'owner';
  const isAdmin = isOwner || userProfile?.role === 'admin';

  const menuItems = [
    { id: 'marketplace' as ActiveAppView, label: 'Marketplace', icon: ShoppingCart },
    { id: 'profile' as ActiveAppView, label: 'Dashboard', icon: Home },
    { id: 'orders' as ActiveAppView, label: 'Orders & History', icon: Scroll, badge: ordersCount > 0 ? String(ordersCount) : undefined },
    ...(isAdmin ? [{ id: 'messages' as ActiveAppView, label: 'Notifications & Messages', icon: MessageSquare, badge: unreadMessagesCount > 0 ? String(unreadMessagesCount) : undefined }] : []),
    ...(isOwner ? [{ id: 'admin_wallets' as ActiveAppView, label: 'Wallet Override', icon: Wallet, badge: 'OWNER' }] : []),
    { id: 'referrals' as ActiveAppView, label: 'Referrals & Bonuses', icon: Gift },
    { id: 'support' as ActiveAppView, label: 'Support & Tickets', icon: HelpCircle, badge: unreadTicketsCount > 0 ? String(unreadTicketsCount) : undefined },
  ];

  const handleNavClick = (id: ActiveAppView) => {
    onSelectView(id);
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#0c051a] border-r border-[#210f3f] h-screen sticky top-0 z-30 shrink-0 select-none p-4">
      
      {/* Brand Header */}
      <div className="pb-4 mb-3 border-b border-[#210f3f] flex items-center space-x-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 p-0.5 shadow-lg shadow-purple-600/30">
          <div className="w-full h-full bg-[#0c051a] rounded-[14px] flex items-center justify-center">
            <Store className="w-5 h-5 text-purple-300" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="font-black text-base text-white tracking-tight leading-none">
            ZENET HUB
          </span>
          <span className="text-[10px] font-extrabold text-purple-400/60 uppercase tracking-widest block mt-1">
            MARKETPLACE
          </span>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <div className="flex-1 space-y-1.5 py-1 overflow-y-auto scrollbar-none">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between transition cursor-pointer text-xs font-bold ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-white shadow-lg shadow-purple-600/30 font-black'
                  : 'text-purple-200/80 hover:bg-[#180a33] hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-1.5 rounded-xl flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#1a0c38] text-purple-300 border border-[#2d1859]'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold tracking-wide">{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/30 text-white' : 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* ADMIN & SELLER CONTROLS NEAR BOTTOM */}
        {(isAdmin || userProfile?.role === 'seller') && (
          <div className="pt-3 mt-2 border-t border-[#210f3f] space-y-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-purple-400/60 px-3 block">
              {isAdmin ? 'MANAGEMENT & ADMIN' : 'SELLER CONTROL'}
            </span>

            {/* OWNER ONLY: Add Product to Generate Update */}
            {isOwner && onOpenZenetUpdateGenerator && (
              <button
                id="sidebar-add-product-generate-update"
                onClick={onOpenZenetUpdateGenerator}
                className="relative overflow-hidden w-full text-left px-3.5 py-3 rounded-2xl flex items-center space-x-3 transition duration-300 cursor-pointer bg-gradient-to-r from-[#211145] via-[#321669] to-[#1d0b3d] hover:from-[#2a1458] hover:via-[#3e1b82] hover:to-[#250e4f] border border-[#a16eff]/60 text-white shadow-[0_0_15px_rgba(125,76,247,0.3)] hover:shadow-[0_0_22px_rgba(125,76,247,0.5)] group my-1"
              >
                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-40 group-hover:animate-pulse" />
                <div className="p-2 rounded-xl bg-[#1b0d3d] text-amber-300 border border-amber-500/40 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] sm:text-xs font-black text-white tracking-tight block">
                    Add Product to Generate Update
                  </span>
                  <span className="text-[9px] text-purple-300/80 font-semibold block mt-0.5 leading-none">
                    ZENET HUB Update Products
                  </span>
                </div>
                <span className="bg-amber-400 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  OWNER
                </span>
              </button>
            )}

            {onOpenSellerDashboard && (
              isAdmin ? (
                /* Beautiful Deep Blue & Purple Glowing Button for Admin version */
                <button
                  onClick={onOpenSellerDashboard}
                  className="relative overflow-hidden w-full text-left px-3.5 py-3 rounded-2xl flex items-center space-x-3 transition duration-300 cursor-pointer bg-gradient-to-r from-[#101438] via-[#211145] to-[#140b30] hover:from-[#14194c] hover:via-[#2b1759] hover:to-[#1b0f3d] border border-[#5c3bf5]/55 text-white shadow-[0_0_15px_rgba(92,59,245,0.25)] hover:shadow-[0_0_22px_rgba(92,59,245,0.45)] hover:border-[#7c5df7] group"
                >
                  <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-40 group-hover:animate-pulse" />
                  <div className="p-2 rounded-xl bg-[#1b144c] text-blue-300 border border-blue-500/30 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.25)]">
                    <Briefcase className="w-4 h-4 text-[#8ea8ff]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] sm:text-xs font-black text-white tracking-tight block">
                      Seller Dashboard Hub — ADMIN
                    </span>
                    <span className="text-[9px] text-[#909cff] font-semibold block mt-0.5 leading-none">
                      Authorized Admin System
                    </span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5c3bf5] animate-ping shrink-0" />
                </button>
              ) : (
                /* Regular Seller button */
                <button
                  onClick={onOpenSellerDashboard}
                  className="w-full text-left px-3 py-2.5 rounded-2xl flex items-center space-x-3 transition cursor-pointer text-xs font-bold text-purple-200 hover:bg-[#180a33] hover:text-white"
                >
                  <div className="p-1.5 rounded-xl bg-[#1a0c38] text-purple-300 border border-[#2d1859] shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold tracking-wide">
                    Seller Dashboard Hub
                  </span>
                </button>
              )
            )}

            {isOwner && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="w-full text-left px-4 py-2.5 rounded-full flex items-center justify-between space-x-3 transition cursor-pointer bg-[#2b0816] hover:bg-[#3b0c1f] border border-rose-500/70 text-white shadow-lg shadow-rose-950/50 my-1"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <ShieldCheck className="w-5 h-5 text-[#ff3b68] shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate">
                    Admin Control Center
                  </span>
                </div>
                <span className="bg-[#ff2e63] text-black font-black text-[10px] sm:text-[11px] px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider shrink-0 shadow-sm">
                  OWNER
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Logged In User Section */}
      <div className="pt-3 mt-auto border-t border-[#210f3f]">
        {user ? (
          <div className="p-3 bg-[#120726] border border-[#231242] rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="truncate pr-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-purple-300/50">
                  LOGGED IN AS
                </p>
                <p className="text-xs font-extrabold text-white truncate mt-0.5">
                  {user.displayName || userProfile?.displayName || user.email?.split('@')[0]}
                </p>
              </div>

              {isOwner ? (
                <span className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 flex items-center space-x-1 shadow-sm">
                  <ShieldCheck className="w-3 h-3 text-slate-950" />
                  OWNER
                </span>
              ) : isAdmin ? (
                <span className="bg-purple-600 text-white font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 flex items-center space-x-1 shadow-sm">
                  ADMIN
                </span>
              ) : (
                <span className="bg-purple-950 text-purple-300 border border-purple-500/30 font-bold text-[9px] px-2 py-0.5 rounded-md uppercase shrink-0">
                  {userProfile?.role || 'BUYER'}
                </span>
              )}
            </div>

            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-[#1e0e3a] hover:bg-[#2b1354] text-purple-200 hover:text-white rounded-xl border border-[#351963] transition font-bold text-xs cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-purple-400" />
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => onOpenAuth('login')}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold py-3 px-4 rounded-2xl shadow-lg transition cursor-pointer"
          >
            Sign In / Register
          </button>
        )}
      </div>

    </aside>
  );
};
