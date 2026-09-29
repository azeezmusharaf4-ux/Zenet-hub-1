import React from 'react';
import { Store, PlusCircle, X } from 'lucide-react';

export interface ZenetHeaderProps {
  onGoHome?: () => void;
  isAdmin?: boolean;
  onOpenCreateListing?: () => void;
  user?: any;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
  onClose?: () => void;
  showCloseButton?: boolean;
  isStickyInModal?: boolean;
  className?: string;
}

export const ZenetHeader: React.FC<ZenetHeaderProps> = ({
  onGoHome,
  isAdmin = false,
  onOpenCreateListing,
  user,
  onOpenAuth,
  onClose,
  showCloseButton = false,
  isStickyInModal = false,
  className = ''
}) => {
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onGoHome) {
      onGoHome();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <header 
      id="zenet-global-header"
      className={`${
        isStickyInModal 
          ? 'sticky top-0 z-30 w-full' 
          : 'fixed top-0 left-0 right-0 lg:left-64 z-40'
      } bg-white/95 backdrop-blur-md border-b border-[#EDE9FE] select-none safe-top-header ${className}`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between space-x-2 sm:space-x-4">
        
        {/* Left Side: Brand Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button 
            type="button"
            onClick={handleLogoClick}
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

        {/* Right Section: Auth actions, Admin Actions, or Close Button */}
        <div className="flex items-center space-x-2 shrink-0">
          {isAdmin && onOpenCreateListing && (
            <button
              onClick={onOpenCreateListing}
              className="hidden sm:flex items-center space-x-1.5 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full text-xs font-black transition cursor-pointer shadow-sm shadow-purple-600/20 active:scale-95"
              title="List Product for Sale"
            >
              <PlusCircle className="w-3.5 h-3.5 text-white" />
              <span className="text-white">List Product</span>
            </button>
          )}

          {!user && onOpenAuth && (
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

          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 bg-purple-50/50 hover:bg-purple-100 border border-purple-200 rounded-full transition cursor-pointer shrink-0"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
