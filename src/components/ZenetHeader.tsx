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

          {/* Official WhatsApp Action Button */}
          <a
            href="https://wa.me/2349138764755"
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer shrink-0"
            title="Chat on WhatsApp"
            aria-label="WhatsApp"
          >
            <svg 
              viewBox="10 12 155 152" 
              className="w-10 h-10 sm:w-11 sm:h-11 drop-shadow-xs"
              aria-hidden="true"
            >
              <path fill="#fff" d="m12.966 161.238 10.439-38.114a73.42 73.42 0 0 1-9.821-36.772c.017-40.556 33.021-73.55 73.578-73.55 19.681.01 38.154 7.669 52.047 21.572s21.537 32.383 21.53 52.037c-.018 40.553-33.027 73.553-73.578 73.553h-.032c-12.313-.005-24.412-3.094-35.159-8.954z"/>
              <path fill="#25D366" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"/>
              <path fill="#fff" fillRule="evenodd" d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"/>
            </svg>
          </a>

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
