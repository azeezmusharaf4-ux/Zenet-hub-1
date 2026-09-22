import React, { useState } from 'react';
import { AccountListing, PurchaseRecord } from '../types';
import AccountCredentialsCard from './AccountCredentialsCard';
import { copyToClipboard } from '../utils/clipboard';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink, 
  MessageSquare, 
  ShoppingBag, 
  ArrowRight, 
  Sparkles, 
  Lock, 
  Globe, 
  X,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';

interface PaymentSuccessModalProps {
  order: PurchaseRecord | null;
  onClose: () => void;
  onOpenOrderHistory: () => void;
  onContactSeller: (listing: AccountListing) => void;
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  order,
  onClose,
  onOpenOrderHistory,
  onContactSeller
}) => {
  if (!order) return null;

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const credentials = order.digitalProductDetails;

  const handleCopyCode = () => {
    if (order.transferCode) {
      copyToClipboard(order.transferCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopyEmail = () => {
    if (credentials?.accountEmail) {
      copyToClipboard(credentials.accountEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleCopyPassword = () => {
    if (credentials?.accountPassword) {
      copyToClipboard(credentials.accountPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleCopySecretKey = () => {
    const key = credentials?.twoFactorSecretKey;
    if (key) {
      copyToClipboard(key);
      setCopiedSecretKey(true);
      setTimeout(() => setCopiedSecretKey(false), 2000);
    }
  };

  const handleCopyBackupCodes = () => {
    const codes = credentials?.twoFactorBackupCodes || credentials?.backupCodes;
    if (codes) {
      copyToClipboard(codes);
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    }
  };

  const orderListing: AccountListing = {
    id: order.listingId,
    title: order.listingTitle,
    category: order.category,
    price: order.price,
    pva: true,
    twoFactor: true,
    warrantyDays: 7,
    description: 'Purchased item',
    sellerId: order.sellerId,
    sellerName: order.sellerName,
    sellerEmail: order.sellerEmail || '',
    status: 'sold',
    createdAt: new Date().toISOString()
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white border border-[#EBE7F7] rounded-2xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-[#0F172A] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Decorative Top Accent Bar */}
        <div className="h-2 bg-[#5B4DF5]"></div>

        {/* Header Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#64748B] hover:text-[#0F172A] bg-[#F8F7FD] hover:bg-[#F1F0FB] border border-[#EBE7F7] rounded-full transition cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-8 text-center space-y-6 overflow-y-auto">

          {/* Animated Success Icon */}
          <div className="relative inline-block">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-sm shadow-emerald-500/10 animate-bounce">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div className="absolute -top-1 -right-1 bg-[#5B4DF5] text-white p-1 rounded-full shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[11px] px-3.5 py-1 rounded-full uppercase tracking-wider inline-block">
              Payment Authorized & Escrow Active
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
              Order Confirmed!
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-sm mx-auto">
              Your payment was processed successfully. Funds are held in ZENET Escrow until account transfer is finalized.
            </p>
          </div>

          {/* Order Details Card */}
          <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-4 sm:p-5 rounded-3xl text-left space-y-3 shadow-xs">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#EBE7F7] text-xs">
              <div>
                <span className="text-[10px] text-[#64748B] uppercase font-extrabold block">Transaction ID</span>
                <span className="font-mono text-[#0F172A] font-bold">{order.transactionId || order.id}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#64748B] uppercase font-extrabold block">Gateway</span>
                <span className="font-extrabold text-[#5B4DF5] uppercase bg-purple-100 border border-purple-200 px-2.5 py-0.5 rounded-full text-[10px]">
                  {order.paymentGateway || 'Paystack'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-[#64748B] uppercase font-extrabold block">Account Title</span>
              <p className="font-bold text-[#0F172A] text-sm line-clamp-1">{order.listingTitle}</p>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-[#64748B]">Amount Charged</span>
              <span className="font-black text-lg text-[#0F172A]">
                {order.currency || 'USD'} {Number(order.paidAmount || order.price).toLocaleString()}
              </span>
            </div>

            {/* Delivered Account Credentials & 2FA Information */}
            {credentials && (
              <div className="pt-2">
                <AccountCredentialsCard
                  credentials={credentials}
                  listingId={order.listingId}
                  purchaseId={order.id}
                  email={credentials.accountEmail || (credentials as any).email || ''}
                  password={credentials.accountPassword || (credentials as any).password || ''}
                  recoveryInfo={credentials.recoveryInfo || ''}
                  twoFactorSecret={credentials.twoFactorSecretKey || credentials.twoFactorSecret || ''}
                  backupCodes={credentials.twoFactorBackupCodes || credentials.backupCodes || ''}
                  instructions={credentials.additionalInstructions || (credentials as any).instructions || ''}
                />
              </div>
            )}

            {/* Escrow Transfer Token */}
            {order.transferCode && (
              <div className="bg-white border border-[#EBE7F7] p-3.5 rounded-2xl space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-extrabold text-amber-700 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    Escrow Verification Release Token
                  </span>
                  <span className="text-[10px] text-[#64748B] font-semibold">Keep Private</span>
                </div>
                
                <div className="flex items-center justify-between bg-[#F8F7FD] p-2.5 rounded-xl border border-[#EBE7F7]">
                  <code className="text-sm font-mono font-black text-[#0F172A] tracking-wider">{order.transferCode}</code>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 bg-white hover:bg-[#F8F7FD] text-[#5B4DF5] text-xs font-bold px-2.5 py-1 rounded-lg border border-[#EBE7F7] transition cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Seller Contact Info */}
            <div className="pt-2 border-t border-[#EBE7F7] text-xs space-y-1">
              <span className="text-[#64748B] text-[10px] uppercase font-bold block">Seller Contact Details</span>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#0F172A]">{order.sellerName}</span>
                {order.sellerEmail && (
                  <span className="text-[#64748B] font-mono text-[11px]">{order.sellerEmail}</span>
                )}
              </div>
            </div>

          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenOrderHistory();
              }}
              className="w-full bg-[#5B4DF5] hover:bg-[#4839EB] text-white font-black py-3.5 px-5 rounded-full shadow-lg shadow-[#5B4DF5]/30 transition cursor-pointer text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4.5 h-4.5" />
              <span>View in Buyer Order History</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onContactSeller(orderListing);
              }}
              className="w-full bg-[#F8F7FD] hover:bg-[#F1F0FB] text-[#0F172A] border border-[#EBE7F7] font-bold py-3 px-5 rounded-full transition cursor-pointer text-xs flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-[#5B4DF5]" />
              <span>Send Message / Credentials Inquiry to Seller</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
