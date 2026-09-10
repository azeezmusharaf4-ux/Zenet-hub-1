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
  TrendingUp,
  Cpu
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
    { id: 'server-tool' as ActiveAppView, label: 'Server Tool (Extra Log)', icon: Cpu, badge: 'TOOLS' },
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
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#E9E2FA] h-screen sticky top-0 z-30 shrink-0 select-none p-4">
      
      {/* Brand Header */}
      <div className="pb-4 mb-3 border-b border-[#E9E2FA] flex items-center space-x-3">
        <div className="w-10 h-10 rounded-2xl bg-[#EDE9FE] border border-[#E9E2FA] flex items-center justify-center">
          <Store className="w-5 h-5 text-[#7C3AED]" />
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-base text-[#171329] tracking-tight leading-none">
            ZENET HUB
          </span>
          <span className="text-[10px] font-bold text-[#716B82] uppercase tracking-wider block mt-1">
            MARKETPLACE
          </span>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <div className="flex-1 space-y-1 py-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between transition cursor-pointer text-xs font-semibold ${
                isActive
                  ? 'bg-[#7C3AED] text-white shadow-sm font-bold'
                  : 'text-[#716B82] hover:bg-[#F8F7FF] hover:text-[#171329]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-1.5 rounded-xl flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#F8F7FF] text-[#716B82] border border-[#E9E2FA]'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs tracking-wide">{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/30 text-white' : 'bg-[#EDE9FE] text-[#7C3AED]'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* ADMIN & SELLER CONTROLS NEAR BOTTOM */}
        {(isAdmin || userProfile?.role === 'seller') && (
          <div className="pt-3 mt-2 border-t border-[#E9E2FA] space-y-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#716B82] px-3 block">
              {isAdmin ? 'MANAGEMENT & ADMIN' : 'SELLER CONTROL'}
            </span>

            {/* OWNER ONLY: Add Product to Generate Update */}
            {isOwner && onOpenZenetUpdateGenerator && (
              <button
                id="sidebar-add-product-generate-update"
                onClick={onOpenZenetUpdateGenerator}
                className="w-full text-left px-3 py-2.5 rounded-2xl flex items-center space-x-3 transition cursor-pointer bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA] hover:border-[#C4B5FD] text-[#171329] group my-1"
              >
                <div className="p-1.5 rounded-xl bg-[#EDE9FE] text-[#7C3AED] shrink-0">
                  <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-[#171329] block truncate">
                    Generate Update
                  </span>
                  <span className="text-[9px] text-[#716B82] block leading-none truncate">
                    Update Products
                  </span>
                </div>
                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase shrink-0">
                  OWNER
                </span>
              </button>
            )}

            {onOpenSellerDashboard && (
              <button
                onClick={onOpenSellerDashboard}
                className="w-full text-left px-3 py-2.5 rounded-2xl flex items-center space-x-3 transition cursor-pointer bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA] hover:border-[#C4B5FD] text-[#171329] group"
              >
                <div className="p-1.5 rounded-xl bg-[#EDE9FE] text-[#7C3AED] shrink-0">
                  <Briefcase className="w-4 h-4 text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-[#171329] block truncate">
                    Seller Dashboard
                  </span>
                  <span className="text-[9px] text-[#716B82] block leading-none truncate">
                    {isAdmin ? 'Admin Console' : 'Seller Control'}
                  </span>
                </div>
              </button>
            )}

            {isOwner && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between space-x-3 transition cursor-pointer bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 my-1"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-bold text-rose-900 truncate">
                    Admin Center
                  </span>
                </div>
                <span className="bg-rose-600 text-white font-bold text-[9px] px-2 py-0.5 rounded-full uppercase shrink-0">
                  OWNER
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Logged In User Section */}
      <div className="pt-3 mt-auto border-t border-[#E9E2FA]">
        {user ? (
          <div className="p-3 bg-[#F8F7FF] border border-[#E9E2FA] rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="truncate pr-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#716B82]">
                  LOGGED IN AS
                </p>
                <p className="text-xs font-bold text-[#171329] truncate mt-0.5">
                  {user.displayName || userProfile?.displayName || user.email?.split('@')[0]}
                </p>
              </div>

              {isOwner ? (
                <span className="bg-amber-100 text-amber-800 font-bold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                  <span>OWNER</span>
                </span>
              ) : isAdmin ? (
                <span className="bg-[#EDE9FE] text-[#7C3AED] font-bold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                  ADMIN
                </span>
              ) : (
                <span className="bg-[#EDE9FE] text-[#7C3AED] font-bold text-[9px] px-2 py-0.5 rounded-md uppercase shrink-0">
                  {userProfile?.role || 'BUYER'}
                </span>
              )}
            </div>

            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-white hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#7C3AED] rounded-xl border border-[#E9E2FA] hover:border-[#C4B5FD] transition font-semibold text-xs cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => onOpenAuth('login')}
            className="w-full bg-[#7C3AED] hover:bg-[#5B21B6] text-white text-xs font-bold py-3 px-4 rounded-2xl shadow-sm transition cursor-pointer"
          >
            Sign In / Register
          </button>
        )}
      </div>

    </aside>
  );
};
