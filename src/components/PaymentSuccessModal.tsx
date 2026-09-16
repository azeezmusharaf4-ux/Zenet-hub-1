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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#05020c]/90 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#120826] border border-[#2d1952] rounded-2xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-purple-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Decorative Top Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-purple-500 to-indigo-500"></div>

        {/* Header Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-purple-300 hover:text-white bg-[#1c0f38] border border-[#361d66] rounded-full transition cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-8 text-center space-y-6">

          {/* Animated Success Icon */}
          <div className="relative inline-block">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 shadow-xl shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div className="absolute -top-1 -right-1 bg-purple-600 text-amber-300 p-1 rounded-full shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-extrabold text-[11px] px-3.5 py-1 rounded-full uppercase tracking-wider inline-block">
              Payment Authorized & Escrow Active
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Order Confirmed!
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/80 max-w-sm mx-auto">
              Your payment was processed successfully. Funds are held in ZENET Escrow until account transfer is finalized.
            </p>
          </div>

          {/* Order Details Card */}
          <div className="bg-[#170c30] border border-[#2c184e] p-4 sm:p-5 rounded-3xl text-left space-y-3 shadow-lg">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#281547] text-xs">
              <div>
                <span className="text-[10px] text-purple-300/60 uppercase font-extrabold block">Transaction ID</span>
                <span className="font-mono text-purple-200 font-bold">{order.transactionId || order.id}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-purple-300/60 uppercase font-extrabold block">Gateway</span>
                <span className="font-extrabold text-white uppercase bg-purple-600/30 border border-purple-500/40 px-2.5 py-0.5 rounded-full text-[10px]">
                  {order.paymentGateway || 'Paystack'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-purple-300/60 uppercase font-extrabold block">Account Title</span>
              <p className="font-bold text-white text-sm line-clamp-1">{order.listingTitle}</p>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-purple-300/70">Amount Charged</span>
              <span className="font-black text-lg text-white">
                {order.currency || 'USD'} {Number(order.paidAmount || order.price).toLocaleString()}
              </span>
            </div>

            {/* Delivered Account Credentials & 2FA Information */}
            {credentials && (credentials.accountEmail || credentials.accountPassword || credentials.twoFactorSecretKey || credentials.twoFactorBackupCodes || credentials.backupCodes) && (
              <div className="pt-2">
                <AccountCredentialsCard
                  email={credentials.accountEmail || ''}
                  password={credentials.accountPassword || ''}
                  recoveryInfo={credentials.twoFactorSecretKey || credentials.twoFactorBackupCodes || credentials.backupCodes || credentials.recoveryInfo || ''}
                  instructions={credentials.additionalInstructions || ''}
                />
              </div>
            )}

            {/* Escrow Transfer Token */}
            {order.transferCode && (
              <div className="bg-[#211144] border border-[#371d6f] p-3.5 rounded-2xl space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-extrabold text-amber-300 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Escrow Verification Release Token
                  </span>
                  <span className="text-[10px] text-purple-300/60 font-semibold">Keep Private</span>
                </div>
                
                <div className="flex items-center justify-between bg-[#110724] p-2.5 rounded-xl border border-[#2d1852]">
                  <code className="text-sm font-mono font-black text-white tracking-wider">{order.transferCode}</code>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 bg-[#28154c] hover:bg-[#371d68] text-purple-200 text-xs font-bold px-2.5 py-1 rounded-lg border border-[#3e2175] transition cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Seller Contact Info */}
            <div className="pt-2 border-t border-[#281547] text-xs space-y-1">
              <span className="text-purple-300/60 text-[10px] uppercase font-bold block">Seller Contact Details</span>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-white">{order.sellerName}</span>
                {order.sellerEmail && (
                  <span className="text-purple-300/80 font-mono text-[11px]">{order.sellerEmail}</span>
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
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-3.5 px-5 rounded-full shadow-lg shadow-purple-600/30 transition cursor-pointer text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4.5 h-4.5" />
              <span>View in Buyer Order History</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onContactSeller(orderListing);
              }}
              className="w-full bg-[#1d0e3d] hover:bg-[#2a1455] text-purple-200 border border-[#381c6e] font-bold py-3 px-5 rounded-full transition cursor-pointer text-xs flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span>Send Message / Credentials Inquiry to Seller</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
