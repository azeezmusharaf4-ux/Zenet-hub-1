import React from 'react';
import { ShieldCheck, Lock, Award, CheckCircle2 } from 'lucide-react';

export const SafetyBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-[#FAF8FE] via-[#F5F0FF] to-[#FAF8FE] border-y border-[#EDE9FE] py-2.5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-black text-[#0F172A]">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>ZENET Hub Verified Escrow & Account Protection</span>
        </div>

        <div className="flex items-center gap-6 overflow-x-auto py-0.5 no-scrollbar text-xs">
          <div className="flex items-center gap-1.5 shrink-0 text-[#475569] font-bold">
            <Lock className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>2FA Code Transfer</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-[#475569] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
            <span>100% PVA & Recovery Mail</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-[#475569] font-bold">
            <Award className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Verified Seller Badges</span>
          </div>
        </div>
      </div>
    </div>
  );
};
