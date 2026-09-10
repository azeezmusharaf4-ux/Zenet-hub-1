import React from 'react';
import { CategoryType } from '../types';

interface FooterProps {
  onSelectCategory?: (category: CategoryType) => void;
}

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className="bg-white border-t border-[#E9E2FA] py-8 mt-16 text-[#716B82] text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Bottom copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[#716B82] text-[11px]">
          <p>© {new Date().getFullYear()} ZENET Hub. All rights reserved. Powered by Firebase Firestore & Authentication.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-[#7C3AED] transition cursor-pointer">Terms of Service</span>
            <span className="hover:text-[#7C3AED] transition cursor-pointer">Privacy Policy</span>
            <span className="hover:text-[#7C3AED] transition cursor-pointer">Escrow Rules</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

