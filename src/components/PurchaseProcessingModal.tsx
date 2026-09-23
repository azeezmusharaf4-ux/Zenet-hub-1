import React from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

interface PurchaseProcessingModalProps {
  itemName?: string;
  price?: number;
}

export const PurchaseProcessingModal: React.FC<PurchaseProcessingModalProps> = ({
  itemName,
  price
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white border border-[#EBE7F7] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative my-auto p-7 text-center space-y-5 animate-in zoom-in-95 duration-150 text-[#0F172A]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Spinner Icon */}
        <div className="relative inline-block mx-auto">
          <div className="w-16 h-16 bg-[#EDE9FE] rounded-2xl flex items-center justify-center border border-[#DDD6FE] shadow-inner">
            <Loader2 className="w-8 h-8 text-[#5B4DF5] animate-spin stroke-[2.5]" />
          </div>
        </div>

        {/* Loading Text */}
        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-[#0F172A] tracking-tight">
            Processing purchase…
          </h3>
          <p className="text-xs text-[#64748B] leading-relaxed max-w-xs mx-auto">
            {itemName ? `Securing delivery details for ${itemName}...` : 'Securing stock credentials and verifying escrow authorization...'}
          </p>
        </div>

        {/* Status Pill */}
        <div className="bg-[#F8F7FD] border border-[#EBE7F7] py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#5B4DF5]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Hold on while we finalize your order...</span>
        </div>
      </div>
    </div>
  );
};
export default PurchaseProcessingModal;
