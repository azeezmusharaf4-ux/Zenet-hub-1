import React from 'react';
import { CategoryType } from '../types';

interface FooterProps {
  onSelectCategory?: (category: CategoryType) => void;
}

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className="bg-[#0a0514] border-t border-[#23123f] py-8 mt-16 text-purple-300/70 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Bottom copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-purple-300/50 text-[11px]">
          <p>© {new Date().getFullYear()} ZENET Hub. All rights reserved. Powered by Firebase Firestore & Authentication.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-purple-200 cursor-pointer">Terms of Service</span>
            <span className="hover:text-purple-200 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-purple-200 cursor-pointer">Escrow Rules</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

