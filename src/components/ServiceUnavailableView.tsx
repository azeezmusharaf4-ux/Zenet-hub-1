import React from 'react';
import { ArrowLeft, Clock, ShieldAlert, Phone, TrendingUp } from 'lucide-react';

interface ServiceUnavailableViewProps {
  serviceType: 'service-number' | 'social-boost';
  onBackToMarketplace: () => void;
}

export const ServiceUnavailableView: React.FC<ServiceUnavailableViewProps> = ({
  serviceType,
  onBackToMarketplace
}) => {
  const isNumber = serviceType === 'service-number';
  const title = isNumber ? 'Service Number' : 'Social Boost';
  const message = isNumber
    ? 'Service Number is currently unavailable. Please check back soon.'
    : 'Social Boost is currently unavailable. Please check back soon.';

  return (
    <div className="w-full max-w-3xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
      {/* Top Navigation */}
      <button
        type="button"
        onClick={onBackToMarketplace}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Marketplace</span>
      </button>

      {/* Main Notice Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-xs text-center flex flex-col items-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-[#F8F9FA] border border-[#EDF2F7] flex items-center justify-center text-[#5B4DF5] mb-5 sm:mb-6 shadow-2xs">
          {isNumber ? (
            <Phone className="w-8 h-8 sm:w-10 sm:h-10 text-[#5B4DF5]" />
          ) : (
            <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-[#5B4DF5]" />
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F1F5F9] text-[#475569] text-xs font-semibold uppercase tracking-wider mb-3">
          <Clock className="w-3.5 h-3.5 text-[#64748B]" />
          <span>Temporary Maintenance</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight mb-3">
          {title}
        </h1>

        <p className="text-sm sm:text-base text-[#475569] font-medium max-w-lg mb-8 leading-relaxed">
          {message}
        </p>

        <div className="w-full max-w-md bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl sm:rounded-2xl p-4 text-xs sm:text-sm text-[#64748B] leading-relaxed mb-6 text-left">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-[#5B4DF5] shrink-0 mt-0.5" />
            <span>
              Orders and payments for {title} are currently paused. Your wallet balance is safe and untouched. You can continue using Log Accounts and Marketplace services as normal.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToMarketplace}
          className="w-full max-w-xs h-12 bg-[#5B4DF5] hover:bg-[#4D3EE0] text-white font-bold text-sm rounded-xl sm:rounded-2xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Marketplace</span>
        </button>
      </div>
    </div>
  );
};
