import React from 'react';
import { PurchaseRecord } from '../types';
import { X, CheckCircle2 } from 'lucide-react';
import AccountCredentialsCard from './AccountCredentialsCard';

interface PurchaseDetailsModalProps {
  purchase: PurchaseRecord | null;
  onClose: () => void;
  onOpenDispute?: (purchase: PurchaseRecord) => void;
  onContactSeller?: (sellerId: string, sellerName: string) => void;
}

export const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({
  purchase,
  onClose,
  onOpenDispute
}) => {
  if (!purchase) return null;

  const credentials = purchase.digitalProductDetails;
  const email = credentials?.accountEmail || (purchase as any).accountEmail || '';
  const password = credentials?.accountPassword || (purchase as any).accountPassword || '';
  const recoveryInfo =
    credentials?.recoveryInfo ||
    credentials?.twoFactorSecretKey ||
    credentials?.twoFactorBackupCodes ||
    credentials?.backupCodes ||
    '';
  const instructions = credentials?.additionalInstructions || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button in ZENET HUB Style */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-9 h-9 rounded-full bg-white hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#7C3AED] border border-[#E9E2FA] shadow-md flex items-center justify-center transition cursor-pointer z-10"
          title="Close Modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Simplified High-Contrast Credentials Card */}
        <AccountCredentialsCard
          email={email}
          password={password}
          recoveryInfo={recoveryInfo}
          instructions={instructions}
        />

        {/* Minimalist Bottom Actions Bar in ZENET HUB Style */}
        <div className="mt-3 flex items-center justify-between text-xs text-[#716B82] px-2">
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified Order
          </span>

          <div className="flex items-center gap-2">
            {onOpenDispute && (
              <button
                type="button"
                onClick={() => onOpenDispute(purchase)}
                className="text-[#716B82] hover:text-rose-600 transition cursor-pointer underline text-xs font-medium px-2 py-1"
              >
                Need help?
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs px-4 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseDetailsModal;
