import React from 'react';
import { Store, Grid, Bookmark, ShoppingBag, Menu } from 'lucide-react';
import { ActiveAppView } from '../types';

interface MobileBottomNavProps {
  activeView: ActiveAppView;
  onSelectView: (view: ActiveAppView) => void;
  onToggleDrawer: () => void;
  savedCount: number;
  ordersCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  onToggleDrawer,
  savedCount,
  ordersCount
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E9E2FA] px-1 py-1 flex items-center justify-around shadow-lg w-full max-w-full overflow-x-hidden safe-bottom">
      {/* 1. Marketplace Home */}
      <button
        onClick={() => onSelectView('marketplace')}
        className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeView === 'marketplace'
            ? 'text-[#7C3AED] font-bold'
            : 'text-[#716B82] hover:text-[#171329]'
        }`}
      >
        <Store className={`w-5 h-5 ${activeView === 'marketplace' ? 'text-[#7C3AED]' : 'text-[#716B82]'}`} />
        <span className="text-[10px] mt-0.5">Market</span>
      </button>

      {/* 2. Saved Items */}
      <button
        onClick={() => onSelectView('saved')}
        className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeView === 'saved'
            ? 'text-[#7C3AED] font-bold'
            : 'text-[#716B82] hover:text-[#171329]'
        }`}
      >
        <Bookmark className={`w-5 h-5 ${activeView === 'saved' ? 'text-[#7C3AED] fill-[#7C3AED]/20' : 'text-[#716B82]'}`} />
        <span className="text-[10px] mt-0.5">Saved</span>
        {savedCount > 0 && (
          <span className="absolute top-1 right-2 bg-[#7C3AED] text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {savedCount}
          </span>
        )}
      </button>

      {/* 3. History */}
      <button
        onClick={() => onSelectView('orders')}
        className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeView === 'orders' || activeView === 'history'
            ? 'text-[#7C3AED] font-bold'
            : 'text-[#716B82] hover:text-[#171329]'
        }`}
      >
        <ShoppingBag className={`w-5 h-5 ${activeView === 'orders' || activeView === 'history' ? 'text-[#7C3AED]' : 'text-[#716B82]'}`} />
        <span className="text-[10px] mt-0.5">History</span>
        {ordersCount > 0 && (
          <span className="absolute top-1 right-2 bg-[#7C3AED] text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {ordersCount}
          </span>
        )}
      </button>

      {/* 4. Menu Drawer Toggle */}
      <button
        onClick={onToggleDrawer}
        className="flex flex-col items-center justify-center min-h-[44px] py-1 px-3 text-[#716B82] hover:text-[#171329] transition cursor-pointer"
      >
        <Menu className="w-5 h-5 text-[#716B82]" />
        <span className="text-[10px] mt-0.5">Menu</span>
      </button>
    </nav>
  );
};
