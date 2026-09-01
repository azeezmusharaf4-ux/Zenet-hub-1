import React from 'react';
import { CategoryType, FilterState } from '../types';
import { getPlatformConfig } from './PlatformIcon';
import { 
  Globe, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  ArrowUpDown, 
  Search,
  SlidersHorizontal,
  Check,
  Package,
  Layers,
  X
} from 'lucide-react';

interface CategoryFilterProps {
  filters: FilterState;
  onFilterChange: (updated: Partial<FilterState>) => void;
  categoryCounts: Record<CategoryType, number>;
  totalProductsCount: number;
  filteredProductsCount: number;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = React.memo(({
  filters,
  onFilterChange,
  categoryCounts,
  totalProductsCount,
  filteredProductsCount
}) => {
  const [searchValue, setSearchValue] = React.useState(filters.searchQuery);
  const debounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    setSearchValue(filters.searchQuery);
  }, [filters.searchQuery]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      onFilterChange({ searchQuery: val });
    }, 120);
  };

  const handleClearSearch = () => {
    setSearchValue('');
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    onFilterChange({ searchQuery: '' });
  };
  const categories: { name: CategoryType; label: string; icon: string; color: string }[] = [
    { name: 'All', label: 'All Products', icon: '🌐', color: 'from-purple-600/30 to-indigo-600/30 text-purple-200' },
    { name: 'Facebook', label: 'Facebook', icon: '📘', color: 'from-blue-600/30 to-blue-800/30 text-blue-300' },
    { name: 'Instagram', label: 'Instagram', icon: '📸', color: 'from-pink-600/30 to-purple-600/30 text-pink-300' },
    { name: 'TikTok', label: 'TikTok', icon: '🎵', color: 'from-cyan-600/30 to-pink-600/30 text-cyan-300' },
    { name: 'YouTube', label: 'YouTube', icon: '▶️', color: 'from-red-600/30 to-rose-700/30 text-red-300' },
    { name: 'Gmail', label: 'Gmail / PVA', icon: '✉️', color: 'from-rose-600/30 to-red-800/30 text-rose-300' },
    { name: 'Twitter/X', label: 'Twitter / X', icon: '𝕏', color: 'from-sky-600/30 to-blue-700/30 text-sky-300' },
    { name: 'Telegram', label: 'Telegram', icon: '✈️', color: 'from-sky-500/30 to-blue-600/30 text-sky-200' },
    { name: 'WhatsApp', label: 'WhatsApp', icon: '💬', color: 'from-emerald-500/30 to-teal-700/30 text-emerald-300' },
    { name: 'Discord', label: 'Discord', icon: '🎮', color: 'from-indigo-600/30 to-purple-800/30 text-indigo-300' },
    { name: 'Reddit', label: 'Reddit', icon: '🤖', color: 'from-orange-600/30 to-red-600/30 text-orange-300' },
    { name: 'Snapchat', label: 'Snapchat', icon: '👻', color: 'from-yellow-500/30 to-amber-600/30 text-yellow-300' },
    { name: 'LinkedIn', label: 'LinkedIn', icon: '💼', color: 'from-blue-700/30 to-sky-800/30 text-blue-200' },
    { name: 'Pinterest', label: 'Pinterest', icon: '📌', color: 'from-red-500/30 to-pink-700/30 text-red-300' },
    { name: 'Threads', label: 'Threads', icon: '🧵', color: 'from-purple-500/30 to-slate-800/30 text-purple-200' },
    { name: 'Other', label: 'Other', icon: '⚡', color: 'from-emerald-600/30 to-teal-700/30 text-emerald-300' },
  ];

  return (
    <div className="space-y-4 mb-5 w-full max-w-full overflow-hidden">
      
      {/* 1. Compact, Clean Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search products, category or seller..."
          value={searchValue}
          onChange={handleSearchInputChange}
          className="w-full bg-[#120826] text-white placeholder-purple-300/40 text-xs sm:text-sm pl-11 pr-24 py-3.5 rounded-xl border border-[#271448] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition shadow-inner font-medium"
        />
        {searchValue && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-300 hover:text-white bg-[#281549] hover:bg-[#341b5f] px-2.5 py-1 rounded-lg border border-purple-800/60 transition flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* 2. Horizontal Scroll Category Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full max-w-full">
        <div className="flex items-center gap-2 min-w-max">
          {categories.map((cat) => {
            const isSelected = filters.category === cat.name;
            const count = categoryCounts[cat.name] || 0;
            const platformConfig = cat.name !== 'All' ? getPlatformConfig(cat.name) : null;

            return (
              <button
                key={cat.name}
                onClick={() => onFilterChange({ category: cat.name })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  isSelected
                    ? `bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-950/60 font-extrabold`
                    : 'bg-[#140b29] hover:bg-[#1e103b] border-[#29164a] text-purple-300/80 hover:text-white'
                }`}
              >
                {platformConfig ? (
                  <div className="w-4 h-4 shrink-0">
                    {platformConfig.iconSvg}
                  </div>
                ) : (
                  <Globe className="w-4 h-4 text-purple-300 shrink-0" />
                )}
                <span>{cat.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  isSelected 
                    ? 'bg-purple-950 text-purple-200 border border-purple-400/40' 
                    : 'bg-[#20113f] text-purple-300/70'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
});

