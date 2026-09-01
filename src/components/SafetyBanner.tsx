import React from 'react';
import { ShieldCheck, Lock, Award, CheckCircle2 } from 'lucide-react';

export const SafetyBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-purple-950/80 via-[#140b27] to-indigo-950/80 border-y border-[#2a1749] py-3 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-purple-200">
        <div className="flex items-center gap-2 font-bold text-purple-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>ZENET Hub Verified Escrow & Account Protection</span>
        </div>

        <div className="flex items-center gap-6 overflow-x-auto py-0.5 no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0 text-purple-200/90 font-medium">
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <span>2FA Code Transfer</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-purple-200/90 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            <span>100% PVA & Recovery Mail</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-purple-200/90 font-medium">
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span>Verified Seller Badges</span>
          </div>
        </div>
      </div>
    </div>
  );
};
