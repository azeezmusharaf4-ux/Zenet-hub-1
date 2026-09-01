import React from 'react';
import { User } from 'firebase/auth';
import { 
  Store, 
  Menu,
  PlusCircle,
  Sparkles,
  TrendingUp
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
  activeView
}) => {
  const isOwner = userProfile?.role === 'owner' || user?.email === 'azeezmusharaf4@gmail.com';
  const isAdmin = isOwner || userProfile?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-[#0d0718]/95 backdrop-blur-md border-b border-[#23123f] w-full max-w-full overflow-x-hidden select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between space-x-2 sm:space-x-4">
        
        {/* Left Side: Three-line Drawer Trigger (☰) + Brand Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          
          {/* Main Three-line Menu Toggle Button (Mobile/Tablet only) */}
          <button
            onClick={onToggleDrawer}
            className="lg:hidden p-2 sm:p-2.5 text-purple-300 hover:text-white bg-[#190d34] hover:bg-[#25144b] rounded-xl sm:rounded-2xl border border-[#301a58] transition cursor-pointer flex items-center justify-center relative group shrink-0"
            title="Open Menu (☰)"
            aria-label="Open Navigation Drawer"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-purple-300 group-hover:scale-110 transition" />
            {(unreadInquiriesCount > 0 || savedCount > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full ring-2 ring-[#0d0718]" />
            )}
          </button>
 
          {/* Brand Logo */}
          <a href="#" className="flex items-center space-x-2 group shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-500 to-violet-600 p-0.5 shadow-lg shadow-purple-600/30 group-hover:shadow-purple-600/50 transition duration-300">
              <div className="w-full h-full bg-[#0d0718] rounded-[10px] sm:rounded-[14px] flex items-center justify-center">
                <Store className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 group-hover:scale-110 transition duration-300" />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center space-x-1">
                <span className="font-extrabold text-base sm:text-xl tracking-tight bg-gradient-to-r from-white via-purple-100 to-purple-300 bg-clip-text text-transparent">
                  ZENET
                </span>
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase shadow-sm">
                  HUB
                </span>
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold text-purple-300/60 uppercase tracking-widest block -mt-0.5 sm:-mt-1">
                Digital Marketplace
              </span>
            </div>
          </a>
        </div>

        {/* Right Section: Auth actions & Admin Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {isAdmin && (
            <button
              onClick={onOpenCreateListing}
              className="hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full text-xs font-extrabold transition cursor-pointer shadow-md shadow-purple-600/30"
              title="List Product for Sale"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>List Product</span>
            </button>
          )}
 
          {!user && (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => onOpenAuth('login')}
                className="text-xs sm:text-sm text-purple-200 hover:text-white px-3.5 py-1.5 font-bold rounded-full hover:bg-[#1a0e33] border border-transparent hover:border-[#2d1850] transition cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="text-xs sm:text-sm bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 px-3.5 py-1.5 font-bold rounded-full transition cursor-pointer hidden sm:inline"
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
