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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d071b]/95 backdrop-blur-md border-t border-[#23123f] px-1 py-1 flex items-center justify-around shadow-2xl w-full max-w-full overflow-x-hidden">
      {/* 1. Marketplace Home */}
      <button
        onClick={() => onSelectView('marketplace')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeView === 'marketplace'
            ? 'text-purple-300 font-extrabold'
            : 'text-purple-300/60 hover:text-purple-200'
        }`}
      >
        <Store className={`w-5 h-5 ${activeView === 'marketplace' ? 'text-purple-400' : ''}`} />
        <span className="text-[10px]">Market</span>
      </button>

      {/* 3. Saved Items */}
      <button
        onClick={() => onSelectView('saved')}
        className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeView === 'saved'
            ? 'text-amber-300 font-extrabold'
            : 'text-purple-300/60 hover:text-purple-200'
        }`}
      >
        <Bookmark className={`w-5 h-5 ${activeView === 'saved' ? 'text-amber-400 fill-amber-400/20' : ''}`} />
        <span className="text-[10px]">Saved</span>
        {savedCount > 0 && (
          <span className="absolute top-0.5 right-2 bg-amber-500 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {savedCount}
          </span>
        )}
      </button>

      {/* 4. Orders */}
      <button
        onClick={() => onSelectView('orders')}
        className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeView === 'orders'
            ? 'text-emerald-300 font-extrabold'
            : 'text-purple-300/60 hover:text-purple-200'
        }`}
      >
        <ShoppingBag className={`w-5 h-5 ${activeView === 'orders' ? 'text-emerald-400' : ''}`} />
        <span className="text-[10px]">Orders</span>
        {ordersCount > 0 && (
          <span className="absolute top-0.5 right-2 bg-emerald-500 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {ordersCount}
          </span>
        )}
      </button>

      {/* 5. Menu Drawer Toggle */}
      <button
        onClick={onToggleDrawer}
        className="flex flex-col items-center gap-1 py-1 px-3 text-purple-300/80 hover:text-white transition cursor-pointer"
      >
        <Menu className="w-5 h-5 text-purple-400" />
        <span className="text-[10px]">Menu</span>
      </button>
    </nav>
  );
};
