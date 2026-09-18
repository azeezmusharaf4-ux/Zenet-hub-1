import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface CountryOption {
  id: string;
  name: string;
  code?: string;
}

interface CountrySelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  countries: CountryOption[];
  selectedCountryId: string;
  onSelectCountry: (countryId: string) => void;
  isLoading?: boolean;
}

export const CountrySelectModal: React.FC<CountrySelectModalProps> = ({
  isOpen,
  onClose,
  countries,
  selectedCountryId,
  onSelectCountry,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when modal opens and reset search query
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter countries alphabetically & by search query
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) {
      return [...countries].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    }
    const q = searchQuery.toLowerCase().trim();
    return countries
      .filter((c) => {
        const name = (c.name || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        const code = (c.code || '').toLowerCase();
        return name.includes(q) || id.includes(q) || code.includes(q);
      })
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  }, [countries, searchQuery]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Modal / Bottom-Sheet Container */}
      <div 
        className="bg-white w-full sm:max-w-md md:max-w-lg rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col h-[85vh] sm:h-[80vh] max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Select Country
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fixed Prominent Search Input with standard blue focus outline */}
        <div className="px-5 pb-3 shrink-0 bg-white">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-white border-2 border-sky-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 rounded-2xl pl-11 pr-10 py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 font-normal outline-none transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-slate-100 shrink-0" />

        {/* Scrollable List of Countries */}
        <div 
          className="flex-1 overflow-y-auto px-4 sm:px-5 py-2 space-y-1.5 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
              <span className="text-sm font-medium">Loading countries...</span>
            </div>
          ) : filteredCountries.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              {searchQuery ? `No countries found matching "${searchQuery}"` : 'No countries available'}
            </div>
          ) : (
            filteredCountries.map((country) => {
              const isSelected = selectedCountryId === country.id;
              return (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => {
                    onSelectCountry(country.id);
                    onClose();
                  }}
                  className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-2xl transition cursor-pointer text-left select-none ${
                    isSelected
                      ? 'bg-sky-100/70 border border-sky-200/60'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  {/* Globe icon in soft light blue squircle */}
                  <div className="w-10 h-10 rounded-xl bg-sky-100/70 border border-sky-200/50 flex items-center justify-center shrink-0 text-xl shadow-2xs">
                    🌍
                  </div>

                  {/* Country Name */}
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-900 text-sm sm:text-[15px] truncate block">
                      {country.name || country.id}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Bottom spacer for safe area on mobile */}
        <div className="h-4 shrink-0 bg-white" />
      </div>
    </div>
  );
};
