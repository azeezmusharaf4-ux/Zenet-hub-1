import React from 'react';
import { User } from 'firebase/auth';
import { 
  Store, 
  PlusCircle 
} from 'lucide-react';
import { UserProfile } from '../types';
import { DashboardTab } from './UserDashboardModal';

interface NavbarProps {
  user: User | null;
  userProfile: UserProfile | null;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenCreateListing: () => void;
  onOpenDashboard: (tab?: DashboardTab) => void;
  onOpenSellerDashboard?: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  savedCount: number;
  unreadInquiriesCount: number;
  onToggleDrawer: () => void;
  walletBalance?: number;
  onOpenWallet?: () => void;
  onOpenZenetUpdate?: () => void;
  onOpenSocialBoost?: () => void;
  activeView?: string;
  onGoHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  userProfile,
  onOpenAuth,
  onOpenCreateListing,
  savedCount,
  unreadInquiriesCount,
  onToggleDrawer,
  onOpenZenetUpdate,
  onOpenSocialBoost,
  activeView,
  onGoHome
}) => {
  const isOwner = userProfile?.role === 'owner' || user?.email === 'azeezmusharaf4@gmail.com';
  const isAdmin = isOwner || userProfile?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#EDE9FE] w-full max-w-full overflow-x-hidden select-none safe-top-header">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between space-x-2 sm:space-x-4">
        
        {/* Left Side: Brand Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* Brand Logo with reset to homepage */}
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (onGoHome) onGoHome();
            }}
            className="flex items-center space-x-2.5 group shrink-0 text-left cursor-pointer"
            title="ZENET HUB Homepage"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#7C3AED] shadow-sm shadow-purple-600/20 flex items-center justify-center group-hover:scale-105 transition duration-200">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-base sm:text-xl tracking-tight text-[#0F172A]">
                  ZENET
                </span>
                <span className="bg-[#7C3AED] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase">
                  HUB
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-extrabold text-[#7C3AED] uppercase tracking-wider block -mt-0.5">
                Digital Marketplace
              </span>
            </div>
          </button>
        </div>

        {/* Right Section: Auth actions & Admin Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {isAdmin && (
            <button
              onClick={onOpenCreateListing}
              className="hidden sm:flex items-center space-x-1.5 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full text-xs font-black transition cursor-pointer shadow-sm shadow-purple-600/20 active:scale-95"
              title="List Product for Sale"
            >
              <PlusCircle className="w-3.5 h-3.5 text-white" />
              <span className="text-white">List Product</span>
            </button>
          )}
 
          {!user && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="text-xs sm:text-sm text-[#0F172A] hover:text-[#7C3AED] px-4 py-2 font-black rounded-full hover:bg-[#F5F0FF] border border-[#DDD6FE] transition cursor-pointer shadow-xs"
              >
                Log In
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="text-xs sm:text-sm bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 font-black rounded-full transition cursor-pointer shadow-sm shadow-purple-600/20"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
