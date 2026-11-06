import React from 'react';
import { ActiveAppView, CategoryType } from '../types';

interface FooterProps {
  onSelectCategory?: (category: CategoryType) => void;
  onSelectView?: (view: ActiveAppView) => void;
  onOpenContact?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectView,
  onOpenContact
}) => {
  const currentYear = new Date().getFullYear();

  const handleNav = (view: ActiveAppView) => {
    if (onSelectView) {
      onSelectView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleContactClick = () => {
    if (onOpenContact) {
      onOpenContact();
    } else if (onSelectView) {
      onSelectView('support');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.href = 'mailto:Zenethubifficial@gmail.com';
    }
  };

  return (
    <footer className="w-full bg-white border-t border-[#EAE6F8] mt-10 py-6 pb-28 md:pb-8 text-[#64748B] text-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
          <p className="text-center md:text-left text-[11px]">
            © {currentYear} ZENET HUB (<a href="https://zenet-hub.com.ng" className="hover:text-[#5B4DF5]">https://zenet-hub.com.ng</a>). All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-700">
            <button
              onClick={() => handleNav('about')}
              className="hover:text-[#5B4DF5] transition cursor-pointer"
            >
              About Zenet Hub
            </button>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <button
              onClick={() => handleNav('support')}
              className="hover:text-[#5B4DF5] transition cursor-pointer"
            >
              Help & Support
            </button>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <button
              onClick={() => handleNav('privacy-policy')}
              className="hover:text-[#5B4DF5] transition cursor-pointer"
            >
              Privacy Policy
            </button>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <button
              onClick={() => handleNav('terms-of-service')}
              className="hover:text-[#5B4DF5] transition cursor-pointer"
            >
              Terms of Service
            </button>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <button
              onClick={() => handleNav('refund-policy')}
              className="hover:text-[#5B4DF5] transition cursor-pointer"
            >
              Refund Policy
            </button>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <button
              onClick={handleContactClick}
              className="hover:text-[#5B4DF5] transition cursor-pointer text-[#5B4DF5]"
            >
              Contact Us
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

