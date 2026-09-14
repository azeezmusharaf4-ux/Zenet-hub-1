import React from 'react';
import { User } from 'firebase/auth';
import { 
  X, 
  Home, 
  ShoppingCart, 
  Scroll, 
  LogOut,
  Store,
  MessageSquare,
  ShieldCheck,
  Briefcase,
  Wallet,
  Sparkles,
  Smartphone,
  Download
} from 'lucide-react';
import { UserProfile, ActiveAppView } from '../types';
import { promptPWAInstall } from './PWAInstallPrompt';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
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
  if (!isOpen) return null;

  const isOwner = user?.email?.trim().toLowerCase() === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'owner';
  const isAdmin = isOwner || userProfile?.role === 'admin';

  const menuItems = [
    { id: 'marketplace' as ActiveAppView, label: 'Marketplace', icon: ShoppingCart },
    { id: 'profile' as ActiveAppView, label: 'Dashboard', icon: Home },
    { id: 'orders' as ActiveAppView, label: 'History', icon: Scroll, badge: ordersCount > 0 ? String(ordersCount) : undefined },
    ...(isAdmin ? [{ id: 'messages' as ActiveAppView, label: 'Notifications & Messages', icon: MessageSquare, badge: unreadMessagesCount > 0 ? String(unreadMessagesCount) : undefined }] : []),
    ...(isOwner ? [{ id: 'admin_wallets' as ActiveAppView, label: 'Wallet Override', icon: Wallet, badge: 'OWNER' }] : []),
  ];

  const handleNavClick = (id: ActiveAppView) => {
    onClose();
    if (id === 'marketplace') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    onSelectView(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex select-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-80 max-w-[85vw] bg-[#FAF8FE] border-r border-[#EDE9FE] h-full shadow-xl flex flex-col z-10 animate-in slide-in-from-left duration-300 p-4 safe-top-drawer">
        
        {/* Drawer Header */}
        <div className="pb-4 mb-3 border-b border-[#EDE9FE] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#7C3AED] shadow-sm shadow-purple-600/20 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base text-[#0F172A] tracking-tight leading-none">
                ZENET HUB
              </span>
              <span className="text-[10px] font-extrabold text-[#7C3AED] uppercase tracking-wider block mt-1">
                MARKETPLACE
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#475569] hover:text-[#7C3AED] bg-white hover:bg-[#EDE9FE] border border-[#DDD6FE] rounded-full transition cursor-pointer shadow-xs"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Navigation */}
        <div className="flex-1 space-y-1.5 py-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between transition cursor-pointer text-xs font-bold ${
                  isActive
                    ? 'bg-[#7C3AED] text-white shadow-sm shadow-purple-600/20 font-black'
                    : 'text-[#1E192E] hover:bg-[#F3EEFF] hover:text-[#7C3AED]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs tracking-wide">{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/30 text-white' : 'bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Quick PWA App Installation Button */}
          <button
            onClick={async () => {
              const installed = await promptPWAInstall();
              if (installed) onClose();
            }}
            className="w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between transition cursor-pointer text-xs font-bold bg-[#EDE9FE] hover:bg-[#DDD6FE] border border-[#C4B5FD] text-[#5B21B6] my-1"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-xl bg-white text-[#7C3AED] border border-[#C4B5FD] shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wide">Install App (PWA)</span>
                <span className="text-[9px] text-[#6D28D9] font-semibold">Add to Home Screen</span>
              </div>
            </div>
            <span className="bg-[#7C3AED] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-1 shadow-sm">
              <Download className="w-2.5 h-2.5" />
              APP
            </span>
          </button>

          {/* ADMIN & SELLER CONTROLS NEAR BOTTOM */}
          {(isAdmin || userProfile?.role === 'seller') && (
            <div className="pt-3 mt-2 border-t border-[#EDE9FE] space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7C3AED] px-3 block">
                {isAdmin ? 'MANAGEMENT & ADMIN' : 'SELLER CONTROL'}
              </span>

              {/* OWNER ONLY: Add Product to Generate Update */}
              {isOwner && onOpenZenetUpdateGenerator && (
                <button
                  id="menu-add-product-generate-update"
                  onClick={() => { onClose(); onOpenZenetUpdateGenerator(); }}
                  className="w-full text-left px-3 py-2.5 rounded-2xl flex items-center gap-3 transition cursor-pointer bg-white hover:bg-[#F5F0FF] border border-[#DDD6FE] hover:border-[#7C3AED] text-[#0F172A] shadow-xs group my-1"
                >
                  <div className="p-1.5 rounded-xl bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE] shrink-0">
                    <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-black text-[#0F172A] block truncate">
                      Generate Update
                    </span>
                    <span className="text-[9px] text-[#64748B] font-semibold block leading-none truncate">
                      Update Products
                    </span>
                  </div>
                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase shrink-0">
                    OWNER
                  </span>
                </button>
              )}

              {onOpenSellerDashboard && (
                <button
                  onClick={() => { onClose(); onOpenSellerDashboard(); }}
                  className="w-full text-left px-3 py-2.5 rounded-2xl flex items-center gap-3 transition cursor-pointer bg-white hover:bg-[#F5F0FF] border border-[#DDD6FE] hover:border-[#7C3AED] text-[#0F172A] shadow-xs group"
                >
                  <div className="p-1.5 rounded-xl bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE] shrink-0">
                    <Briefcase className="w-4 h-4 text-[#7C3AED]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-black text-[#0F172A] block truncate">
                      Seller Dashboard
                    </span>
                    <span className="text-[9px] text-[#64748B] font-semibold block leading-none truncate">
                      {isAdmin ? 'Admin Console' : 'Seller Control'}
                    </span>
                  </div>
                </button>
              )}

              {isOwner && onOpenAdmin && (
                <button
                  onClick={() => { onClose(); onOpenAdmin(); }}
                  className="w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between gap-3 transition cursor-pointer bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 my-1 shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="text-xs font-black text-rose-900 truncate">
                      Admin Center
                    </span>
                  </div>
                  <span className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase shrink-0">
                    OWNER
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Logged In User Section */}
        <div className="pt-3 mt-auto border-t border-[#EDE9FE] pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]">
          {user ? (
            <div className="p-3 bg-white border border-[#DDD6FE] rounded-2xl shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="truncate pr-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#7C3AED]">
                    LOGGED IN AS
                  </p>
                  <p className="text-xs font-black text-[#0F172A] truncate mt-0.5">
                    {user.displayName || userProfile?.displayName || user.email?.split('@')[0]}
                  </p>
                </div>

                {isOwner ? (
                  <span className="bg-amber-100 text-amber-800 border border-amber-300 font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-700" />
                    <span>OWNER</span>
                  </span>
                ) : isAdmin ? (
                  <span className="bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE] font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    ADMIN
                  </span>
                ) : (
                  <span className="bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE] font-black text-[9px] px-2 py-0.5 rounded-md uppercase shrink-0">
                    {userProfile?.role || 'BUYER'}
                  </span>
                )}
              </div>

              <button
                onClick={() => { onClose(); onLogout(); }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#475569] hover:text-[#7C3AED] rounded-xl border border-[#EDE9FE] hover:border-[#DDD6FE] transition font-bold text-xs cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => { onClose(); onOpenAuth('login'); }}
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black py-3 px-4 rounded-2xl shadow-sm shadow-purple-600/20 transition cursor-pointer"
              >
                Sign In / Register
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
