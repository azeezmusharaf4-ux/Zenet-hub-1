import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { AccountListing, UserProfile } from '../types';
import { safeApiFetch, formatPaystackPublicKey } from '../utils/api';
import { 
  X, 
  CreditCard, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight,
  Check,
  Smartphone,
  Wallet,
  ChevronRight,
  PlusCircle
} from 'lucide-react';

export type PaymentMethodType = 'paystack' | 'wallet';

interface PaymentModalProps {
  user: User | null;
  userProfile: UserProfile | null;
  listing: AccountListing | null;
  onClose: () => void;
  onPaymentSuccess: (orderData: {
    listing: AccountListing;
    paidAmount: number;
    currency: string;
    paymentGateway: string;
    transactionId: string;
    transferCode: string;
    buyerEmail: string;
    buyerName: string;
    purchaseRecord?: any;
  }) => Promise<void>;
  onOpenAuth: () => void;
  walletBalance?: number;
  onOpenWallet?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  user,
  userProfile,
  listing,
  onClose,
  onPaymentSuccess,
  onOpenAuth,
  walletBalance = 0,
  onOpenWallet
}) => {
  if (!listing) return null;

  // Payment Method Selection State (default to Official Paystack)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>('paystack');
  const [currency, setCurrency] = useState<'NGN' | 'USD' | 'EUR' | 'GBP'>('NGN');
  
  const [buyerName, setBuyerName] = useState(
    user?.displayName || userProfile?.displayName || user?.email?.split('@')[0] || ''
  );
  const [buyerEmail, setBuyerEmail] = useState(user?.email || '');

  // Status & Loader
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [error, setError] = useState('');

  // Currency exchange relative to NGN
  const rates: Record<string, { symbol: string; rate: number }> = {
    NGN: { symbol: '₦', rate: 1 },
    USD: { symbol: '$', rate: 0.00067 }, // ~ 1,500 NGN / USD
    EUR: { symbol: '€', rate: 0.00062 },
    GBP: { symbol: '£', rate: 0.00053 }
  };

  const currInfo = rates[currency] || rates.NGN;
  const convertedPrice = currency === 'NGN' 
    ? listing.price 
    : Math.max(1, Math.round((listing.price * currInfo.rate) * 100) / 100);

  // Helper to dynamically load Paystack Inline JS script
  const loadPaystackScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).PaystackPop) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      onOpenAuth();
      return;
    }

    if (!selectedMethod) {
      setError('Please select a payment method to proceed.');
      return;
    }

    if (!buyerEmail || !buyerEmail.includes('@')) {
      setError('Please enter a valid receipt email address.');
      return;
    }

    setIsProcessing(true);
    setError('');

    // BRANCH 1: OFFICIAL PAYSTACK CHECKOUT
    if (selectedMethod === 'paystack') {
      try {
        setStepMessage('Initializing official Paystack checkout session...');
        const returnUrl = window.location.origin + window.location.pathname;
        let initData: any = null;

        const clientOrderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        try {
          initData = await safeApiFetch('/api/paystack/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: clientOrderId,
              listingId: listing.id,
              listingTitle: listing.title,
              priceNaira: listing.price,
              buyerEmail,
              currency: currency || 'NGN',
              userId: user.uid,
              isWalletFunding: false,
              callbackUrl: returnUrl
            })
          });
        } catch (fetchErr: any) {
          console.warn('[Paystack Initialize] Backend request notice:', fetchErr);
        }

        if (initData?.success === false && initData?.error) {
          throw new Error(initData.error);
        }

        const effectiveOrderId = initData?.orderId || clientOrderId;

        // Priority 1: Redirect to Official Paystack Hosted Checkout page if authorization_url is provided
        if (initData?.authorization_url) {
          try {
            sessionStorage.setItem('zenith_pending_paystack_ref', initData.reference);
            sessionStorage.setItem('zenith_pending_listing_id', listing.id);
            sessionStorage.setItem('zenith_pending_order_id', effectiveOrderId);
            localStorage.setItem('zenith_pending_listing_id', listing.id);
            localStorage.setItem('zenith_pending_order_id', effectiveOrderId);
          } catch {}
          setStepMessage('Redirecting to Paystack Checkout...');
          window.location.href = initData.authorization_url;
          return;
        }

        if (initData?.access_code && initData?.mode === 'live_paystack') {
          try {
            sessionStorage.setItem('zenith_pending_paystack_ref', initData.reference);
            sessionStorage.setItem('zenith_pending_listing_id', listing.id);
            sessionStorage.setItem('zenith_pending_order_id', effectiveOrderId);
            localStorage.setItem('zenith_pending_listing_id', listing.id);
            localStorage.setItem('zenith_pending_order_id', effectiveOrderId);
          } catch {}
          setStepMessage('Redirecting to Paystack Checkout...');
          window.location.href = `https://checkout.paystack.com/${initData.access_code}`;
          return;
        }

        // Priority 2: Paystack Inline Popup JS (Only with valid pk_live_ or pk_test_ public key)
        const rawKey = initData?.publicKey || (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || '';
        const publicKey = formatPaystackPublicKey(rawKey);

        if (publicKey) {
          setStepMessage('Opening Paystack Secure Checkout...');
          const isScriptLoaded = await loadPaystackScript();

          if (isScriptLoaded && (window as any).PaystackPop) {
            const paystackObj = (window as any).PaystackPop;
            const refToVerify = initData?.reference || `PST_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

            const onPaystackSuccess = function (response: any) {
              setIsProcessing(true);
              setStepMessage('Payment Confirmed! Unlocking Account Credentials...');
              const actualRef = response?.reference || response?.trxref || refToVerify;
              
              safeApiFetch(`/api/paystack/verify/${encodeURIComponent(actualRef)}?userId=${encodeURIComponent(user.uid)}&orderId=${encodeURIComponent(effectiveOrderId)}&listingId=${encodeURIComponent(listing.id)}`)
                .then((verifyData) => {
                  if (verifyData.verified && verifyData.status === 'success') {
                    const verifiedPaidAmount = Number(verifyData.amount ?? verifyData.purchaseRecord?.paidAmount ?? listing.price);
                    return onPaymentSuccess({
                      listing,
                      paidAmount: verifiedPaidAmount,
                      currency: verifyData.currency || currency || 'NGN',
                      paymentGateway: 'paystack',
                      transactionId: actualRef,
                      transferCode: verifyData.purchaseRecord?.transferCode || `ZENET-ESCROW-${Math.floor(1000 + Math.random() * 9000)}-PST`,
                      buyerEmail: buyerEmail || user.email || '',
                      buyerName: buyerName || user.displayName || buyerEmail.split('@')[0],
                      purchaseRecord: verifyData.purchaseRecord
                    });
                  } else {
                    setError(verifyData.error || verifyData.message || 'Payment verification failed on Paystack.');
                    setIsProcessing(false);
                  }
                })
                .catch((vErr: any) => {
                  console.error('Verify API error:', vErr);
                  setError(vErr.message || 'Payment verification failed. If debited, please contact support with Ref: ' + actualRef);
                  setIsProcessing(false);
                });
            };

            const onPaystackClose = function () {
              setIsProcessing(false);
              setStepMessage('');
            };

            const handler = paystackObj.setup({
              key: publicKey,
              email: buyerEmail,
              amount: Math.round(listing.price * 100),
              ref: refToVerify,
              currency: currency || 'NGN',
              metadata: {
                userId: user.uid,
                userEmail: user.email,
                buyerEmail: buyerEmail,
                listingId: listing.id,
                listingTitle: listing.title,
                expectedAmountNaira: listing.price,
                isWalletFunding: false,
                custom_fields: [
                  { display_name: 'User ID', variable_name: 'user_id', value: user.uid },
                  { display_name: 'Listing ID', variable_name: 'listing_id', value: listing.id }
                ]
              },
              callback: onPaystackSuccess,
              onClose: onPaystackClose
            });

            if (handler && typeof handler.openIframe === 'function') {
              handler.openIframe();
              return;
            }
          }
        }

        // Priority 3: If we have access code, redirect to hosted checkout
        if (initData?.access_code) {
          setStepMessage('Redirecting to Paystack Checkout...');
          window.location.href = `https://checkout.paystack.com/${initData.access_code}`;
          return;
        }

        if (initData?.error) {
          throw new Error(initData.error);
        }

        throw new Error('Paystack checkout could not be opened. Please check your internet connection.');
      } catch (err: any) {
        console.error('Paystack checkout error:', err);
        setError(err.message || 'Could not connect to Paystack.');
        setIsProcessing(false);
        setStepMessage('');
      }
      return;
    }

    // BRANCH 2: WALLET BALANCE CHECKOUT
    if (selectedMethod === 'wallet') {
      if (walletBalance < listing.price) {
        setError(`Insufficient wallet balance (₦${walletBalance.toLocaleString()}). Required: ₦${listing.price.toLocaleString()}.`);
        setIsProcessing(false);
        return;
      }

      try {
        setStepMessage('Securing Funds in ZENET Escrow Vault...');

        const transactionId = `WALLET_TX_${Date.now()}`;
        const transferCode = `ZENET-ESCROW-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        await onPaymentSuccess({
          listing,
          paidAmount: listing.price,
          currency: 'NGN',
          paymentGateway: 'wallet',
          transactionId,
          transferCode,
          buyerEmail,
          buyerName: buyerName || buyerEmail.split('@')[0]
        });

      } catch (err: any) {
        console.error('Wallet payment error:', err);
        setError(err.message || 'Wallet payment processing failed.');
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white border border-[#EBE7F7] rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto max-h-[92vh] flex flex-col text-[#0F172A]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="bg-white px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#EBE7F7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5B4DF5] flex items-center justify-center text-white shadow-sm shadow-[#5B4DF5]/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-[#0F172A] text-base sm:text-lg tracking-tight">
                ZENET Wallet & Payment Hub
              </h2>
              <span className="text-[11px] text-[#64748B] flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Guaranteed Escrow Protection
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-[#64748B] hover:text-[#0F172A] bg-[#F8F7FD] hover:bg-[#F1F0FB] border border-[#EBE7F7] rounded-full transition cursor-pointer disabled:opacity-40"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Badges Header Bar */}
        <div className="bg-[#F8F7FD] px-5 py-2.5 border-b border-[#EBE7F7] grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs">
          <div className="flex items-center justify-center gap-1.5 text-[#0F172A] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Secure Escrow</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[#0F172A] font-bold border-x border-[#EBE7F7] px-2">
            <Lock className="w-3.5 h-3.5 text-[#5B4DF5] shrink-0" />
            <span>256-Bit SSL Protected</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[#0F172A] font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Instant Delivery</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs sm:text-sm overflow-y-auto flex-1">
          
          {/* Item Checkout Order Summary */}
          <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-purple-100 text-[#5B4DF5] border border-purple-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                  {listing.category} Account
                </span>
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                  PVA Verified Stock
                </span>
              </div>
              <h3 className="font-bold text-[#0F172A] text-sm sm:text-base line-clamp-1">{listing.title}</h3>
              <p className="text-[11px] text-[#64748B]">
                Seller: <strong className="text-[#0F172A] font-bold">{listing.sellerName}</strong> • {listing.sellerSalesCount || 12} Completed Escrows
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-[#64748B] uppercase font-bold block">Order Amount</span>
              <span className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight font-mono">
                {currInfo.symbol}{convertedPrice.toLocaleString()}
              </span>
              {currency !== 'NGN' && (
                <span className="text-[10px] text-[#64748B] block font-medium">
                  (₦{listing.price.toLocaleString()} NGN)
                </span>
              )}
            </div>
          </div>

          {!user && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">Log in to process checkout & store purchase in your order vault.</span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="bg-[#5B4DF5] text-white font-extrabold px-3.5 py-1.5 rounded-full text-xs hover:bg-[#4839EB] transition cursor-pointer shrink-0"
              >
                Log In
              </button>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* TOP SECTION: WALLET BALANCE CARD */}
          <div className="bg-white border border-[#EBE7F7] p-4 sm:p-5 rounded-2xl shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#5B4DF5]" />
                  <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                    Your ZENET Fund Wallet
                  </span>
                  {walletBalance >= listing.price ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> Ready
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      Needs Funds
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-[#0F172A] font-mono tracking-tight">
                    ₦{walletBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-[#64748B]">NGN Available</span>
                </div>
              </div>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('wallet')}
                  className={`flex-1 sm:flex-initial text-xs font-extrabold px-4 py-2.5 rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedMethod === 'wallet'
                      ? 'bg-[#5B4DF5] text-white border-[#5B4DF5] shadow-sm shadow-[#5B4DF5]/30'
                      : 'bg-[#F8F7FD] hover:bg-[#F1F0FB] text-[#0F172A] border-[#EBE7F7]'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 text-amber-300" />
                  <span>Use Wallet Balance</span>
                </button>
              </div>
            </div>
          </div>

          {/* LARGE PAYMENT METHOD SELECTION CARDS GRID */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[#0F172A] font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#5B4DF5]" />
                Select Payment Method
              </label>
              <span className="text-[11px] text-[#64748B] font-medium">Official Paystack or Wallet</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* 1. Official Paystack Checkout */}
              <button
                type="button"
                onClick={() => setSelectedMethod('paystack')}
                className={`p-4 rounded-2xl border text-left transition relative cursor-pointer group flex flex-col justify-between ${
                  selectedMethod === 'paystack'
                    ? 'bg-[#F8F7FD] border-[#5B4DF5] ring-2 ring-[#5B4DF5]/20 shadow-md'
                    : 'bg-white border-[#EBE7F7] hover:border-[#5B4DF5]/40 hover:bg-[#F8F7FD]'
                }`}
              >
                <div className="flex items-start justify-between w-full mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
                      <Smartphone className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                        <span>Paystack Official Checkout</span>
                        <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase">
                          Live Active
                        </span>
                      </h4>
                      <span className="text-[10px] text-cyan-700 font-bold block">Transfer, OPay, Bank, USSD & Card</span>
                    </div>
                  </div>
                  {selectedMethod === 'paystack' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#5B4DF5] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#64748B] group-hover:text-[#0F172A] transition shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Instant Official Paystack Gateway. Choose Transfer, OPay, Bank, USSD, or Card on Paystack's secure modal.
                </p>
              </button>

              {/* 2. ZENET Wallet Balance */}
              <button
                type="button"
                onClick={() => setSelectedMethod('wallet')}
                className={`p-4 rounded-2xl border text-left transition relative cursor-pointer group flex flex-col justify-between ${
                  selectedMethod === 'wallet'
                    ? 'bg-[#F8F7FD] border-[#5B4DF5] ring-2 ring-[#5B4DF5]/20 shadow-md'
                    : 'bg-white border-[#EBE7F7] hover:border-[#5B4DF5]/40 hover:bg-[#F8F7FD]'
                }`}
              >
                <div className="flex items-start justify-between w-full mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-[#5B4DF5]">
                      <Wallet className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[#0F172A] text-sm">ZENET Wallet Balance</h4>
                      <span className="text-[10px] text-[#5B4DF5] font-bold block">
                        Available: ₦{walletBalance.toLocaleString()} NGN
                      </span>
                    </div>
                  </div>
                  {selectedMethod === 'wallet' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#5B4DF5] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#64748B] group-hover:text-[#0F172A] transition shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Pay instantly using your funded ZENET wallet. Wallet can be top-up funded via Paystack.
                </p>
              </button>

            </div>
          </div>

          {/* PAYMENT DETAILS ACCORDION */}
          {selectedMethod ? (
            <form onSubmit={handlePay} className="space-y-4 pt-2 border-t border-[#EBE7F7]">
              
              {/* Option B: Wallet Balance Checkout */}
              {selectedMethod === 'wallet' && (
                <div className="space-y-3 bg-[#F8F7FD] p-4.5 rounded-2xl border border-[#EBE7F7] animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#0F172A] flex items-center gap-1.5 uppercase tracking-wider">
                      <Wallet className="w-4 h-4 text-[#5B4DF5]" />
                      1-Click Wallet Escrow Release
                    </span>
                    <span className="text-[10px] bg-purple-100 text-[#5B4DF5] border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                      Instant Release
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#EBE7F7] space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-[#EBE7F7] pb-2">
                      <span className="text-[#64748B]">Current Wallet Balance:</span>
                      <span className="font-mono font-extrabold text-[#0F172A]">₦{walletBalance.toLocaleString()} NGN</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[#EBE7F7] py-1">
                      <span className="text-[#64748B]">Account Price:</span>
                      <span className="font-mono font-extrabold text-amber-600">- ₦{listing.price.toLocaleString()} NGN</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 font-bold">
                      <span className="text-[#0F172A]">Remaining Balance:</span>
                      <span className="font-mono text-emerald-600">
                        ₦{Math.max(0, walletBalance - listing.price).toLocaleString()} NGN
                      </span>
                    </div>
                  </div>

                  {/* Buyer Contact Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[#475569] font-semibold mb-1 text-[11px]">Buyer Legal Name *</label>
                      <input
                        type="text"
                        required
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Full Legal Name"
                        className="w-full bg-white text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[#475569] font-semibold mb-1 text-[11px]">Receipt Email *</label>
                      <input
                        type="email"
                        required
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full bg-white text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs"
                      />
                    </div>
                  </div>

                  {walletBalance < listing.price ? (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 space-y-3 mt-2">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-[#0F172A] text-xs">Insufficient Wallet Balance</h4>
                          <p className="text-xs text-[#475569] leading-relaxed">
                            Your balance is <strong className="font-mono text-[#0F172A]">₦{walletBalance.toLocaleString()} NGN</strong>. You need <strong className="font-mono text-amber-700">₦{(listing.price - walletBalance).toLocaleString()} NGN</strong> more to complete this purchase.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenWallet) onOpenWallet();
                        }}
                        className="w-full bg-[#5B4DF5] hover:bg-[#4839EB] text-white font-extrabold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition"
                      >
                        <PlusCircle className="w-4 h-4 text-white" />
                        <span>Fund Wallet via Paystack</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-[#5B4DF5] hover:bg-[#4839EB] text-white font-extrabold py-3.5 rounded-full shadow-lg shadow-[#5B4DF5]/30 transition cursor-pointer disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2 mt-2"
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>{stepMessage || 'Processing Wallet Payment...'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          <span>Confirm 1-Click Wallet Checkout (₦{listing.price.toLocaleString()})</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Option C: Paystack Gateway */}
              {selectedMethod === 'paystack' && (
                <div className="space-y-4 bg-[#F8F7FD] p-4.5 rounded-2xl border border-[#EBE7F7] animate-in fade-in duration-200">
                  
                  {/* Currency selector header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#EBE7F7]">
                    <span className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-cyan-600" />
                      Paystack Checkout Currency
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 w-full sm:w-auto">
                      {(['NGN', 'USD', 'EUR', 'GBP'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCurrency(c)}
                          className={`py-1 px-2.5 rounded-lg font-extrabold text-[11px] border transition text-center cursor-pointer ${
                            currency === c
                              ? 'bg-[#5B4DF5] text-white border-[#5B4DF5]'
                              : 'bg-white text-[#64748B] border-[#EBE7F7] hover:border-[#5B4DF5]/30'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Buyer Contact & Receipt Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#475569] font-semibold mb-1 text-[11px]">Buyer Legal Name *</label>
                      <input
                        type="text"
                        required
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Full Legal Name"
                        className="w-full bg-white text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[#475569] font-semibold mb-1 text-[11px]">Receipt Email *</label>
                      <input
                        type="email"
                        required
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full bg-white text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs"
                      />
                    </div>
                  </div>

                  {/* Allowed Paystack Channels Order */}
                  <div className="space-y-2 bg-white p-3.5 rounded-xl border border-[#EBE7F7]">
                    <span className="text-[10px] text-[#64748B] font-extrabold uppercase tracking-wider block">
                      Paystack Allowed Payment Channels (Strict Order)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-2.5 rounded-lg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                        <span className="font-bold text-[#0F172A]">Pay with Transfer</span>
                      </div>
                      <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-2.5 rounded-lg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                        <span className="font-bold text-[#0F172A]">Pay with OPay</span>
                      </div>
                      <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-2.5 rounded-lg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-[#5B4DF5] font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                        <span className="font-bold text-[#0F172A]">Pay with Bank</span>
                      </div>
                      <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-2.5 rounded-lg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-black text-[10px] flex items-center justify-center shrink-0">4</span>
                        <span className="font-bold text-[#0F172A]">Pay with USSD</span>
                      </div>
                      <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-2.5 rounded-lg flex items-center gap-2 sm:col-span-2">
                        <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 font-black text-[10px] flex items-center justify-center shrink-0">5</span>
                        <span className="font-bold text-[#0F172A]">Pay with Card</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit & Cancel Buttons */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isProcessing}
                      className="px-5 py-3 text-[#64748B] hover:text-[#0F172A] bg-[#F8F7FD] hover:bg-[#F1F0FB] border border-[#EBE7F7] rounded-full font-bold text-xs sm:text-sm transition cursor-pointer disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="flex-1 bg-[#5B4DF5] hover:bg-[#4839EB] text-white font-extrabold py-3.5 rounded-full shadow-lg shadow-[#5B4DF5]/30 transition cursor-pointer disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>{stepMessage || 'Opening Paystack Checkout...'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-white" />
                          <span>
                            Proceed to Paystack Checkout ({currInfo.symbol}{convertedPrice.toLocaleString()} {currency})
                          </span>
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </form>
          ) : (
            <div className="bg-[#F8F7FD] border border-dashed border-[#EBE7F7] p-6 rounded-2xl text-center space-y-2">
              <Sparkles className="w-6 h-6 text-[#5B4DF5] mx-auto" />
              <h4 className="text-sm font-bold text-[#0F172A]">Select a Payment Method Above</h4>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Choose Paystack Official Checkout or your ZENET Wallet to view secure checkout details.
              </p>
            </div>
          )}

          {/* ESCROW GUARANTEE POLICY FOOTER NOTE */}
          <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-3.5 rounded-2xl flex items-start gap-3 text-[11px] text-[#475569]">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-[#0F172A] block font-bold text-xs">ZENET Hub 100% Escrow Protection</strong>
              <p className="leading-normal">
                Funds remain locked in escrow until account credentials are confirmed by you. Includes 7-day PVA replacement guarantee and 24/7 admin dispute resolution.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
