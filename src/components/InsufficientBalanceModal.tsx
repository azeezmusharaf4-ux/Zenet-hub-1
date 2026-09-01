import React from 'react';
import { AccountListing } from '../types';
import { 
  X, 
  AlertCircle, 
  Wallet, 
  PlusCircle, 
  ArrowRight,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';

interface InsufficientBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: AccountListing;
  currentBalance: number;
  onOpenFundWallet: () => void;
}

export const InsufficientBalanceModal: React.FC<InsufficientBalanceModalProps> = ({
  isOpen,
  onClose,
  listing,
  currentBalance,
  onOpenFundWallet
}) => {
  if (!isOpen) return null;

  const shortfall = listing.price - currentBalance;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#05020d]/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#120826] border border-[#2e1954] rounded-2xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-purple-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0c051a] px-4 sm:px-6 py-4 border-b border-[#241344] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-950/80 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Insufficient Balance</h3>
              <p className="text-xs text-purple-300/70">Wallet checkout requires more funds</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-purple-300 hover:text-white bg-[#1a0e33] border border-[#2e1850] rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Product detail card */}
          <div className="bg-[#180a2e] border border-[#2d1852] p-4 rounded-xl space-y-2">
            <span className="text-[10px] font-bold text-purple-300/50 uppercase tracking-widest block">Purchasing Account</span>
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm line-clamp-1">{listing.title}</span>
              <span className="font-mono font-black text-purple-200 text-sm shrink-0">₦{listing.price.toLocaleString()}</span>
            </div>
            <span className="text-xs text-purple-300/70 block bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-900/30 w-fit">
              Category: {listing.category}
            </span>
          </div>

          {/* Balance comparison layout */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#160d2b] border border-[#2d1852] p-3 rounded-xl">
              <span className="text-[10px] font-bold text-purple-300/60 uppercase block mb-1">Your Balance</span>
              <span className="font-mono font-black text-white text-base">₦{currentBalance.toLocaleString()}</span>
            </div>
            <div className="bg-rose-950/20 border border-rose-500/20 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-rose-300/70 uppercase block mb-1">Shortfall</span>
              <span className="font-mono font-black text-rose-400 text-base">₦{shortfall.toLocaleString()}</span>
            </div>
          </div>

          {/* Secure Escrow Note */}
          <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-white text-xs">How it works</h4>
              <p className="text-xs text-purple-200/80 leading-relaxed">
                Add at least <strong className="font-mono text-white">₦{shortfall.toLocaleString()}</strong> to your wallet via our instant Paystack gateway to complete this order with 1-click escrow protection.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenFundWallet();
              }}
              className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-black text-sm py-3.5 px-6 rounded-2xl shadow-xl shadow-purple-600/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Fund Wallet with Paystack</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-full bg-[#180a2e] hover:bg-[#220f47] text-purple-300 hover:text-white border border-[#2d1852] font-bold text-xs py-3 rounded-2xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
