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
  onPayDirectWithPaystack?: () => void;
}

export const InsufficientBalanceModal: React.FC<InsufficientBalanceModalProps> = ({
  isOpen,
  onClose,
  listing,
  currentBalance,
  onOpenFundWallet,
  onPayDirectWithPaystack
}) => {
  if (!isOpen) return null;

  const shortfall = listing.price - currentBalance;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-[#EBE7F7] rounded-2xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-[#0F172A]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#F8F7FD] px-4 sm:px-6 py-4 border-b border-[#EBE7F7] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#0F172A] text-base">Insufficient Balance</h3>
              <p className="text-xs text-[#64748B]">Wallet checkout requires more funds</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] bg-white border border-[#EBE7F7] rounded-full transition cursor-pointer shadow-2xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Product detail card */}
          <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-4 rounded-xl space-y-2 shadow-2xs">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block">Purchasing Account</span>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0F172A] text-sm line-clamp-1">{listing.title}</span>
              <span className="font-mono font-black text-[#0F172A] text-sm shrink-0">₦{listing.price.toLocaleString()}</span>
            </div>
            <span className="text-xs text-[#5B4DF5] font-semibold block bg-white px-2.5 py-1 rounded-lg border border-[#EBE7F7] w-fit shadow-2xs">
              Category: {listing.category}
            </span>
          </div>

          {/* Balance comparison layout */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-3 rounded-xl shadow-2xs">
              <span className="text-[10px] font-bold text-[#64748B] uppercase block mb-1">Your Balance</span>
              <span className="font-mono font-black text-[#0F172A] text-base">₦{currentBalance.toLocaleString()}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl shadow-2xs">
              <span className="text-[10px] font-bold text-rose-600 uppercase block mb-1">Shortfall</span>
              <span className="font-mono font-black text-rose-700 text-base">₦{shortfall.toLocaleString()}</span>
            </div>
          </div>

          {/* Secure Escrow Note */}
          <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-[#0F172A] text-xs">How it works</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Add at least <strong className="font-mono text-[#0F172A]">₦{shortfall.toLocaleString()}</strong> to your wallet via our instant Paystack gateway to complete this order with 1-click escrow protection.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {onPayDirectWithPaystack && (
              <button
                onClick={() => {
                  onClose();
                  onPayDirectWithPaystack();
                }}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white font-black text-sm py-3.5 px-6 rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Pay ₦{listing.price.toLocaleString()} with Paystack (Instant Delivery)</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onOpenFundWallet();
              }}
              className="w-full bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-black text-sm py-3.5 px-6 rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Fund Wallet with Paystack</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-full bg-[#F8F7FD] hover:bg-[#F2EFFC] text-[#64748B] hover:text-[#0F172A] border border-[#EBE7F7] font-bold text-xs py-3 rounded-2xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
