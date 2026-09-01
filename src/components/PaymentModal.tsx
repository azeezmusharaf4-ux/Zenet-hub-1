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

        try {
          initData = await safeApiFetch('/api/paystack/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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

        // Priority 1: Redirect to Official Paystack Hosted Checkout page if authorization_url is provided
        if (initData?.authorization_url) {
          setStepMessage('Redirecting to Paystack Checkout...');
          window.location.href = initData.authorization_url;
          return;
        }

        if (initData?.access_code && initData?.mode === 'live_paystack') {
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
              
              safeApiFetch(`/api/paystack/verify/${encodeURIComponent(actualRef)}?userId=${encodeURIComponent(user.uid)}`)
                .then((verifyData) => {
                  if (verifyData.verified && verifyData.status === 'success') {
                    return onPaymentSuccess({
                      listing,
                      paidAmount: listing.price,
                      currency: currency || 'NGN',
                      paymentGateway: 'paystack',
                      transactionId: actualRef,
                      transferCode: `ZENET-ESCROW-${Math.floor(1000 + Math.random() * 9000)}-PST`,
                      buyerEmail: buyerEmail || user.email || '',
                      buyerName: buyerName || user.displayName || buyerEmail.split('@')[0]
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
        await new Promise((res) => setTimeout(res, 500));

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#05020c]/90 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#100722] border border-[#2b164f] rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto max-h-[92vh] flex flex-col text-purple-100"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="bg-[#090315] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#231242] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-600 p-0.5 shadow-lg shadow-purple-600/30">
              <div className="w-full h-full bg-[#100722] rounded-[14px] flex items-center justify-center text-purple-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                ZENET Wallet & Payment Hub
              </h2>
              <span className="text-[11px] text-purple-300/70 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Guaranteed Escrow Protection
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-purple-300 hover:text-white bg-[#1a0c38] hover:bg-[#281354] border border-[#351a68] rounded-full transition cursor-pointer disabled:opacity-40"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Badges Header Bar */}
        <div className="bg-gradient-to-r from-[#170c33] via-[#1f1042] to-[#140a2c] px-5 py-2.5 border-b border-[#29154c] grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs">
          <div className="flex items-center justify-center gap-1.5 text-purple-200 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Secure Escrow</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-purple-200 font-bold border-x border-[#2d1852] px-2">
            <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>256-Bit SSL Protected</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-purple-200 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Instant Delivery</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs sm:text-sm overflow-y-auto flex-1">
          
          {/* Item Checkout Order Summary */}
          <div className="bg-[#180b36] border border-[#2d1754] p-4 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-purple-600/30 text-purple-300 border border-purple-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                  {listing.category} Account
                </span>
                <span className="text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                  PVA Verified Stock
                </span>
              </div>
              <h3 className="font-bold text-white text-sm sm:text-base line-clamp-1">{listing.title}</h3>
              <p className="text-[11px] text-purple-300/70">
                Seller: <strong className="text-purple-200 font-bold">{listing.sellerName}</strong> • {listing.sellerSalesCount || 12} Completed Escrows
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-purple-300/70 uppercase font-bold block">Order Amount</span>
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
                {currInfo.symbol}{convertedPrice.toLocaleString()}
              </span>
              {currency !== 'NGN' && (
                <span className="text-[10px] text-purple-300/60 block font-medium">
                  (₦{listing.price.toLocaleString()} NGN)
                </span>
              )}
            </div>
          </div>

          {!user && (
            <div className="bg-amber-950/80 border border-amber-500/40 text-amber-200 p-3.5 rounded-2xl flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">Log in to process checkout & store purchase in your order vault.</span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="bg-amber-400 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-full text-xs hover:bg-amber-300 transition cursor-pointer shrink-0"
              >
                Log In
              </button>
            </div>
          )}

          {error && (
            <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* TOP SECTION: WALLET BALANCE CARD */}
          <div className="bg-gradient-to-br from-[#1b0c3c] via-[#261250] to-[#160a33] border border-[#3b1d75] p-4 sm:p-5 rounded-2xl relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                    Your ZENET Fund Wallet
                  </span>
                  {walletBalance >= listing.price ? (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> Ready
                    </span>
                  ) : (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      Needs Funds
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                    ₦{walletBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-purple-300/70">NGN Available</span>
                </div>
              </div>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('wallet')}
                  className={`flex-1 sm:flex-initial text-xs font-extrabold px-4 py-2.5 rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedMethod === 'wallet'
                      ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                      : 'bg-[#291354] hover:bg-[#34186a] text-purple-200 border-[#422084]'
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
              <label className="text-purple-300/90 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-purple-400" />
                Select Payment Method
              </label>
              <span className="text-[11px] text-purple-300/60 font-medium">Official Paystack or Wallet</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* 1. Official Paystack Checkout */}
              <button
                type="button"
                onClick={() => setSelectedMethod('paystack')}
                className={`p-4 rounded-2xl border text-left transition relative cursor-pointer group flex flex-col justify-between ${
                  selectedMethod === 'paystack'
                    ? 'bg-[#241147] border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-600/20'
                    : 'bg-[#150a2b] border-[#29144d] hover:border-cyan-500/40 hover:bg-[#1a0c35]'
                }`}
              >
                <div className="flex items-start justify-between w-full mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                      <Smartphone className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                        <span>Paystack Official Checkout</span>
                        <span className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase">
                          Live Active
                        </span>
                      </h4>
                      <span className="text-[10px] text-cyan-300 font-bold block">Transfer, OPay, Bank, USSD & Card</span>
                    </div>
                  </div>
                  {selectedMethod === 'paystack' ? (
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-purple-300/40 group-hover:text-purple-300 transition shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-purple-300/70 leading-relaxed">
                  Instant Official Paystack Gateway. Choose Transfer, OPay, Bank, USSD, or Card on Paystack's secure modal.
                </p>
              </button>

              {/* 2. ZENET Wallet Balance */}
              <button
                type="button"
                onClick={() => setSelectedMethod('wallet')}
                className={`p-4 rounded-2xl border text-left transition relative cursor-pointer group flex flex-col justify-between ${
                  selectedMethod === 'wallet'
                    ? 'bg-[#241147] border-purple-500 ring-2 ring-purple-500/40 shadow-lg shadow-purple-600/20'
                    : 'bg-[#150a2b] border-[#29144d] hover:border-purple-500/40 hover:bg-[#1a0c35]'
                }`}
              >
                <div className="flex items-start justify-between w-full mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                      <Wallet className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">ZENET Wallet Balance</h4>
                      <span className="text-[10px] text-purple-300 font-bold block">
                        Available: ₦{walletBalance.toLocaleString()} NGN
                      </span>
                    </div>
                  </div>
                  {selectedMethod === 'wallet' ? (
                    <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-purple-300/40 group-hover:text-purple-300 transition shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-purple-300/70 leading-relaxed">
                  Pay instantly using your funded ZENET wallet. Wallet can be top-up funded via Paystack.
                </p>
              </button>

            </div>
          </div>

          {/* PAYMENT DETAILS ACCORDION */}
          {selectedMethod ? (
            <form onSubmit={handlePay} className="space-y-4 pt-2 border-t border-[#251347]">
              
              {/* Option B: Wallet Balance Checkout */}
              {selectedMethod === 'wallet' && (
                <div className="space-y-3 bg-[#170b33] p-4.5 rounded-2xl border border-[#2e1755] animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
                      <Wallet className="w-4 h-4 text-purple-400" />
                      1-Click Wallet Escrow Release
                    </span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold">
                      Instant Release
                    </span>
                  </div>

                  <div className="bg-[#0e071e] p-3.5 rounded-xl border border-[#28134d] space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-[#210e3d] pb-2">
                      <span className="text-purple-300/70">Current Wallet Balance:</span>
                      <span className="font-mono font-extrabold text-white">₦{walletBalance.toLocaleString()} NGN</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[#210e3d] py-1">
                      <span className="text-purple-300/70">Account Price:</span>
                      <span className="font-mono font-extrabold text-amber-300">- ₦{listing.price.toLocaleString()} NGN</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 font-bold">
                      <span className="text-purple-300/90">Remaining Balance:</span>
                      <span className="font-mono text-emerald-400">
                        ₦{Math.max(0, walletBalance - listing.price).toLocaleString()} NGN
                      </span>
                    </div>
                  </div>

                  {/* Buyer Contact Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-purple-300/80 font-semibold mb-1 text-[11px]">Buyer Legal Name *</label>
                      <input
                        type="text"
                        required
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Full Legal Name"
                        className="w-full bg-[#0e071e] text-white p-2.5 rounded-xl border border-[#2e1852] focus:outline-none focus:border-purple-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-purple-300/80 font-semibold mb-1 text-[11px]">Receipt Email *</label>
                      <input
                        type="email"
                        required
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full bg-[#0e071e] text-white p-2.5 rounded-xl border border-[#2e1852] focus:outline-none focus:border-purple-500 text-xs"
                      />
                    </div>
                  </div>

                  {walletBalance < listing.price ? (
                    <div className="bg-amber-950/80 border border-amber-500/50 p-4 rounded-2xl text-amber-200 space-y-3 mt-2">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-white text-xs">Insufficient Wallet Balance</h4>
                          <p className="text-xs text-amber-200/80 leading-relaxed">
                            Your balance is <strong className="font-mono text-white">₦{walletBalance.toLocaleString()} NGN</strong>. You need <strong className="font-mono text-amber-300">₦{(listing.price - walletBalance).toLocaleString()} NGN</strong> more to complete this purchase.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenWallet) onOpenWallet();
                        }}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition"
                      >
                        <PlusCircle className="w-4 h-4 text-black" />
                        <span>Fund Wallet via Paystack</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold py-3.5 rounded-full shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2 mt-2"
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
                <div className="space-y-4 bg-[#170b33] p-4.5 rounded-2xl border border-[#2e1755] animate-in fade-in duration-200">
                  
                  {/* Currency selector header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#251347]">
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
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
                              ? 'bg-cyan-600 text-white border-cyan-400'
                              : 'bg-[#0d061c] text-purple-300/60 border-[#251347] hover:border-cyan-500/30'
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
                      <label className="block text-purple-300/80 font-semibold mb-1 text-[11px]">Buyer Legal Name *</label>
                      <input
                        type="text"
                        required
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Full Legal Name"
                        className="w-full bg-[#0d061c] text-white p-2.5 rounded-xl border border-[#2e1852] focus:outline-none focus:border-purple-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-purple-300/80 font-semibold mb-1 text-[11px]">Receipt Email *</label>
                      <input
                        type="email"
                        required
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full bg-[#0d061c] text-white p-2.5 rounded-xl border border-[#2e1852] focus:outline-none focus:border-purple-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* Allowed Paystack Channels Order */}
                  <div className="space-y-2 bg-[#0d061c] p-3.5 rounded-xl border border-[#261248]">
                    <span className="text-[10px] text-purple-300/80 font-extrabold uppercase tracking-wider block">
                      Paystack Allowed Payment Channels (Strict Order)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#14082c] border border-[#2e1754] p-2.5 rounded-lg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                        <span className="font-bold text-white">Pay with Transfer</span>
                      </div>
                      <div className="bg-[#14082c] border border-[#2e1754] p-2.5 rounded-lg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                        <span className="font-bold text-white">Pay with OPay</span>
                      </div>
                      <div className="bg-[#14082c] border border-[#2e1754] p-2.5 rounded-lg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                        <span className="font-bold text-white">Pay with Bank</span>
                      </div>
                      <div className="bg-[#14082c] border border-[#2e1754] p-2.5 rounded-lg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0">4</span>
                        <span className="font-bold text-white">Pay with USSD</span>
                      </div>
                      <div className="bg-[#14082c] border border-[#2e1754] p-2.5 rounded-lg flex items-center gap-2 sm:col-span-2">
                        <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 font-black text-[10px] flex items-center justify-center shrink-0">5</span>
                        <span className="font-bold text-white">Pay with Card</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit & Cancel Buttons */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isProcessing}
                      className="px-5 py-3 text-purple-300 hover:text-white bg-[#1a0c38] hover:bg-[#271350] border border-[#351a68] rounded-full font-bold text-xs sm:text-sm transition cursor-pointer disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="flex-1 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold py-3.5 rounded-full shadow-xl shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>{stepMessage || 'Opening Paystack Checkout...'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-purple-200" />
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
            <div className="bg-[#14092b] border border-dashed border-[#2d1852] p-6 rounded-2xl text-center space-y-2">
              <Sparkles className="w-6 h-6 text-purple-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Select a Payment Method Above</h4>
              <p className="text-xs text-purple-300/70 max-w-sm mx-auto">
                Choose Paystack Official Checkout or your ZENET Wallet to view secure checkout details.
              </p>
            </div>
          )}

          {/* ESCROW GUARANTEE POLICY FOOTER NOTE */}
          <div className="bg-purple-950/40 border border-purple-500/30 p-3.5 rounded-2xl flex items-start gap-3 text-[11px] text-purple-200/90">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-white block font-bold text-xs">ZENET Hub 100% Escrow Protection</strong>
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
