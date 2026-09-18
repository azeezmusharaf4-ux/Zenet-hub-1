import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { WalletTransaction } from '../types';
import { safeApiFetch, formatPaystackPublicKey } from '../utils/api';
import { 
  X, 
  Wallet, 
  RefreshCw, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  walletBalance: number;
  onAddFunds?: (amount: number, gateway: string, reference?: string) => void;
  transactions: WalletTransaction[];
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  user,
  walletBalance,
  onAddFunds,
  transactions
}) => {
  const [activeTab, setActiveTab] = useState<'fund' | 'history'>('fund');
  
  // Wallet Funding State
  const [amount, setAmount] = useState<number>(5000);
  const [customAmountStr, setCustomAmountStr] = useState<string>('5000');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickAmounts = [1000, 2500, 5000, 10000, 25000, 50000];

  const handleSelectQuickAmount = (val: number) => {
    setAmount(val);
    setCustomAmountStr(val.toString());
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmountStr(rawVal);
    const numVal = parseInt(rawVal || '0', 10);
    setAmount(numVal);
    setErrorMessage('');
    setSuccessMessage('');
  };

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

  const handlePaystackCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setErrorMessage('Please sign in to fund your wallet.');
      return;
    }

    if (!user.email) {
      setErrorMessage('A valid email address is required to open Paystack checkout.');
      return;
    }

    if (!amount || amount < 100) {
      setErrorMessage('Minimum funding amount is ₦100.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsProcessing(true);
    setStepMessage('Initializing official Paystack session...');

    try {
      const returnUrl = window.location.origin + window.location.pathname;
      let initData: any = null;

      try {
        initData = await safeApiFetch('/api/paystack/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingTitle: 'Wallet Deposit',
            priceNaira: amount,
            currency: 'NGN',
            buyerEmail: user.email,
            userId: user.uid,
            isWalletFunding: true,
            callbackUrl: returnUrl
          })
        });
      } catch (fetchErr: any) {
        console.warn('[Paystack Initialize] Backend API request notice:', fetchErr);
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
        setStepMessage('Opening Paystack Checkout...');
        const isScriptLoaded = await loadPaystackScript();

        if (isScriptLoaded && (window as any).PaystackPop) {
          const paystackObj = (window as any).PaystackPop;
          const refToVerify = initData?.reference || `PST_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

          const onPaystackSuccess = function (response: any) {
            setIsProcessing(true);
            setStepMessage('Verifying payment and crediting wallet...');
            const actualRef = response?.reference || response?.trxref || refToVerify;
            
            // Strictly verify via backend endpoint before crediting
            safeApiFetch(`/api/paystack/verify/${encodeURIComponent(actualRef)}?userId=${encodeURIComponent(user.uid)}&isWalletFunding=true`)
              .then((verifyData) => {
                if (verifyData.verified && verifyData.status === 'success') {
                  const credited = verifyData.amount || amount;
                  setSuccessMessage(`Success! ₦${Number(credited).toLocaleString()} NGN has been verified and credited to your wallet.`);
                  if (onAddFunds) {
                    onAddFunds(Number(credited), 'paystack', actualRef);
                  }
                } else {
                  setErrorMessage(verifyData.error || verifyData.message || 'Payment verification failed on Paystack.');
                }
              })
              .catch((err: any) => {
                console.error('Verify API error:', err);
                setErrorMessage(err.message || 'Payment verification failed. If your account was debited, contact support with reference: ' + actualRef);
              })
              .finally(() => {
                setIsProcessing(false);
                setStepMessage('');
              });
          };

          const onPaystackClose = function () {
            setIsProcessing(false);
            setStepMessage('');
          };

          // Standard setup with verified public key
          const handler = paystackObj.setup({
            key: publicKey,
            email: user.email,
            amount: Math.round(amount * 100),
            ref: refToVerify,
            currency: 'NGN',
            channels: ['bank_transfer', 'opay', 'bank', 'ussd', 'card'],
            metadata: {
              userId: user.uid,
              userEmail: user.email,
              isWalletFunding: true,
              expectedAmountNaira: amount,
              custom_fields: [
                { display_name: 'User ID', variable_name: 'user_id', value: user.uid },
                { display_name: 'Funding Type', variable_name: 'funding_type', value: 'wallet_funding' }
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

      // Priority 3: If we have an access code from Paystack session, redirect to checkout.paystack.com
      if (initData?.access_code) {
        setStepMessage('Redirecting to Paystack Checkout...');
        window.location.href = `https://checkout.paystack.com/${initData.access_code}`;
        return;
      }

      if (initData?.error) {
        throw new Error(initData.error);
      }

      throw new Error('Paystack checkout could not be initialized. Please check your internet connection.');
    } catch (err: any) {
      console.error('Paystack funding error:', err);
      setErrorMessage(err.message || 'Could not initialize Paystack checkout.');
      setIsProcessing(false);
      setStepMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden w-full h-full min-h-[100dvh]">
      {/* Inner Container: Full width on mobile, centered and neatly bounded to max-w-xl on desktop so it never gets too big */}
      <div className="w-full max-w-xl mx-auto flex flex-col flex-1 h-full min-h-0 bg-white">
        
        {/* Full-Screen Header */}
        <div className="bg-white px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition cursor-pointer"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#5c5cf6]/10 border border-[#5c5cf6]/20 flex items-center justify-center text-[#5c5cf6] shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">Fund Wallet</h3>
              <p className="text-xs text-slate-500 line-clamp-1">Instant Paystack Gateway • Transfer, OPay, Bank & USSD</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full transition cursor-pointer shrink-0"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-50/80 px-4 sm:px-6 py-2.5 border-b border-slate-100 flex gap-2 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('fund')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'fund'
                ? 'bg-[#5c5cf6] text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            Fund Wallet
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#5c5cf6] text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            History ({transactions.length})
          </button>
        </div>

        {/* Main Body (Smooth Scrollable Area) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">

          {/* TAB 1: FUND WALLET VIA PAYSTACK CHECKOUT */}
          {activeTab === 'fund' && (
            <form onSubmit={handlePaystackCheckout} className="space-y-5 animate-in fade-in duration-150">
              
              {/* CURRENT BALANCE BANNER */}
              <div className="bg-[#5c5cf6]/5 border border-[#5c5cf6]/20 p-4 sm:p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Your Balance</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">₦{walletBalance.toLocaleString()}</span>
                    <span className="text-xs font-semibold text-slate-500">NGN</span>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Escrow Ready</span>
                </div>
              </div>

              {/* SUCCESS MESSAGE */}
              {successMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in zoom-in-95">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-emerald-950 text-sm block">Deposit Verified!</span>
                    <p className="text-xs leading-relaxed text-emerald-800">{successMessage}</p>
                  </div>
                </div>
              )}

              {/* ERROR MESSAGE */}
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in zoom-in-95">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-rose-950 text-sm block">Funding Notice</span>
                    <p className="text-xs leading-relaxed text-rose-800">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* AMOUNT SELECTION */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                  Select or Enter Funding Amount (NGN)
                </label>

                {/* Quick Amount Preset Chips */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5">
                  {quickAmounts.map((qVal) => (
                    <button
                      key={qVal}
                      type="button"
                      onClick={() => handleSelectQuickAmount(qVal)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                        amount === qVal
                          ? 'bg-[#5c5cf6] text-white border-[#5c5cf6] shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      ₦{qVal.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Input Box */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[#5c5cf6] text-lg">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={customAmountStr}
                    onChange={handleCustomAmountChange}
                    placeholder="Enter custom amount..."
                    className="w-full bg-white border border-slate-200 focus:border-[#5c5cf6] focus:ring-2 focus:ring-[#5c5cf6]/20 text-slate-900 font-bold text-base sm:text-lg py-3.5 pl-10 pr-16 rounded-xl outline-none transition shadow-2xs"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                    NGN
                  </span>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isProcessing || !amount || amount < 100}
                className="w-full bg-[#5c5cf6] hover:bg-[#4d4df0] active:bg-[#4342db] text-white font-bold text-base py-3.5 px-6 rounded-xl shadow-sm transition active:scale-[0.99] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4 min-h-[50px]"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    <span>{stepMessage || 'Processing Paystack Checkout...'}</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    <span>Fund Wallet Now</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-1">
                <Lock className="w-3.5 h-3.5 text-[#5c5cf6]" />
                <span>256-bit Encrypted SSL Gateway powered by Paystack</span>
              </div>

            </form>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <h4 className="font-extrabold text-slate-900 text-sm">Wallet Ledger & Deposits</h4>

              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No wallet transactions recorded yet.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 p-3.5 rounded-xl flex items-center justify-between text-xs transition">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                        tx.type === 'deposit' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-600 border border-rose-200'
                      }`}>
                        {tx.type === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{tx.description}</span>
                        <span className="text-[10px] text-slate-400">{tx.date}</span>
                      </div>
                    </div>

                    <span className={`font-mono font-extrabold text-sm ${
                      tx.type === 'deposit' ? 'text-emerald-600' : 'text-slate-900'
                    }`}>
                      {tx.type === 'deposit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
