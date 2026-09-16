import React from 'react';
import { Home, Wallet, User } from 'lucide-react';
import { ActiveAppView } from '../types';

interface MobileBottomNavProps {
  activeView: ActiveAppView;
  onSelectView: (view: ActiveAppView) => void;
  onOpenWallet: () => void;
  isWalletOpen?: boolean;
  onToggleDrawer?: () => void;
  savedCount?: number;
  ordersCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  onOpenWallet,
  isWalletOpen = false
}) => {
  const isWallet = isWalletOpen || activeView === 'wallet' || activeView === 'deposit-history';
  const isProfile = !isWallet && (activeView === 'profile' || activeView === 'edit-profile' || activeView === 'referrals' || activeView === 'change-password');
  const isHome = !isWallet && !isProfile && (activeView === 'marketplace' || activeView === 'landing');

  return (
    <nav 
      id="zenet-mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EAE6F8] px-4 sm:px-6 pt-2 pb-[max(env(safe-area-inset-bottom,0px),0.625rem)] flex items-center justify-around shadow-[0_-4px_20px_rgba(15,23,42,0.06)] w-full max-w-full overflow-x-hidden"
    >
      {/* 1. Home Tab */}
      <button
        id="mobile-nav-home"
        onClick={() => onSelectView('marketplace')}
        className={`flex items-center justify-center min-h-[44px] transition-all cursor-pointer active:scale-95 ${
          isHome
            ? 'bg-[#5B4DF5] text-white px-5 sm:px-6 py-2 rounded-full font-extrabold text-xs shadow-md shadow-indigo-600/25 space-x-2'
            : 'flex-col items-center justify-center text-[#0F172A] hover:text-[#5B4DF5] px-4 py-1'
        }`}
        aria-label="Home"
      >
        <Home className={`${isHome ? 'w-4 h-4 text-white stroke-[2.5]' : 'w-5 h-5 text-[#0F172A] stroke-[2.2]'}`} />
        {isHome ? (
          <span className="text-xs font-bold text-white whitespace-nowrap">Home</span>
        ) : (
          <span className="text-[11px] font-bold mt-0.5 whitespace-nowrap text-[#0F172A]">Home</span>
        )}
      </button>

      {/* 2. Wallet Tab */}
      <button
        id="mobile-nav-wallet"
        onClick={onOpenWallet}
        className={`flex items-center justify-center min-h-[44px] transition-all cursor-pointer active:scale-95 ${
          isWallet
            ? 'bg-[#5B4DF5] text-white px-5 sm:px-6 py-2 rounded-full font-extrabold text-xs shadow-md shadow-indigo-600/25 space-x-2'
            : 'flex-col items-center justify-center text-[#0F172A] hover:text-[#5B4DF5] px-4 py-1'
        }`}
        aria-label="Wallet"
      >
        <Wallet className={`${isWallet ? 'w-4 h-4 text-white stroke-[2.5]' : 'w-5 h-5 text-[#0F172A] stroke-[2.2]'}`} />
        {isWallet ? (
          <span className="text-xs font-bold text-white whitespace-nowrap">Wallet</span>
        ) : (
          <span className="text-[11px] font-bold mt-0.5 whitespace-nowrap text-[#0F172A]">Wallet</span>
        )}
      </button>

      {/* 3. Profile Tab */}
      <button
        id="mobile-nav-profile"
        onClick={() => onSelectView('profile')}
        className={`flex items-center justify-center min-h-[44px] transition-all cursor-pointer active:scale-95 ${
          isProfile
            ? 'bg-[#5B4DF5] text-white px-5 sm:px-6 py-2 rounded-full font-extrabold text-xs shadow-md shadow-indigo-600/25 space-x-2'
            : 'flex-col items-center justify-center text-[#0F172A] hover:text-[#5B4DF5] px-4 py-1'
        }`}
        aria-label="Profile"
      >
        <User className={`${isProfile ? 'w-4 h-4 text-white stroke-[2.5]' : 'w-5 h-5 text-[#0F172A] stroke-[2.2]'}`} />
        {isProfile ? (
          <span className="text-xs font-bold text-white whitespace-nowrap">Profile</span>
        ) : (
          <span className="text-[11px] font-bold mt-0.5 whitespace-nowrap text-[#0F172A]">Profile</span>
        )}
      </button>
    </nav>
  );
};

