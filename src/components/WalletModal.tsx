import React, { useState } from 'react';
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
  AlertCircle
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
  const [activeTab, setActiveTab] = useState<'fund' | 'overview' | 'history'>('fund');
  
  // Wallet Funding State
  const [amount, setAmount] = useState<number>(5000);
  const [customAmountStr, setCustomAmountStr] = useState<string>('5000');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#05020d]/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#120826] border border-[#2e1954] rounded-2xl sm:rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-purple-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#0c051a] px-4 sm:px-6 py-4 border-b border-[#241344] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 p-0.5 shadow-md shrink-0">
              <div className="w-full h-full bg-[#0c051a] rounded-[14px] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-purple-300" />
              </div>
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg">Fund Wallet</h3>
              <p className="text-xs text-purple-300/70">Instant Paystack Gateway • Transfer, OPay, Bank & USSD</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-purple-300 hover:text-white bg-[#1a0e33] border border-[#2e1850] rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-[#0e061e] px-4 py-2.5 border-b border-[#241344] flex gap-2 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('fund')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'fund'
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-white font-black shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            Fund Wallet
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-white font-black shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            Balance & Escrow
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 text-white font-black shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            History ({transactions.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">

          {/* TAB 1: FUND WALLET VIA PAYSTACK CHECKOUT */}
          {activeTab === 'fund' && (
            <form onSubmit={handlePaystackCheckout} className="space-y-5 animate-in fade-in duration-150">
              
              {/* CURRENT BALANCE BANNER */}
              <div className="bg-gradient-to-r from-purple-900/40 via-[#180c35] to-indigo-900/40 border border-[#2d1852] p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest block">Your Balance</span>
                  <span className="text-xl font-black text-white font-mono">₦{walletBalance.toLocaleString()} <span className="text-xs text-purple-300/60 font-sans font-normal">NGN</span></span>
                </div>
                <div className="bg-purple-950/80 border border-purple-500/30 text-purple-300 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Escrow Ready</span>
                </div>
              </div>

              {/* SUCCESS MESSAGE */}
              {successMessage && (
                <div className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 p-4 rounded-2xl flex items-start gap-3 shadow-lg animate-in fade-in zoom-in-95">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-emerald-300 text-sm block">Deposit Verified!</span>
                    <p className="text-xs leading-relaxed">{successMessage}</p>
                  </div>
                </div>
              )}

              {/* ERROR MESSAGE */}
              {errorMessage && (
                <div className="bg-rose-950/90 border border-rose-500/50 text-rose-200 p-4 rounded-2xl flex items-start gap-3 shadow-lg animate-in fade-in zoom-in-95">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-rose-300 text-sm block">Funding Notice</span>
                    <p className="text-xs leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* AMOUNT SELECTION */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-purple-200 block">
                  Select or Enter Funding Amount (NGN)
                </label>

                {/* Quick Amount Preset Chips */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {quickAmounts.map((qVal) => (
                    <button
                      key={qVal}
                      type="button"
                      onClick={() => handleSelectQuickAmount(qVal)}
                      className={`py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                        amount === qVal
                          ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white border-purple-400 shadow-md shadow-purple-600/30'
                          : 'bg-[#180b33] hover:bg-[#220f47] text-purple-200 border-[#2d1852]'
                      }`}
                    >
                      ₦{qVal.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Input Box */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-purple-300 text-base font-mono">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={customAmountStr}
                    onChange={handleCustomAmountChange}
                    placeholder="Enter custom amount..."
                    className="w-full bg-[#0c051a] border border-[#2b164f] focus:border-purple-500 text-white font-mono font-black text-lg py-3.5 pl-10 pr-16 rounded-2xl outline-none transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-300/60 uppercase">
                    NGN
                  </span>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isProcessing || !amount || amount < 100}
                className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-black text-sm py-4 px-6 rounded-2xl shadow-xl shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                    <span>{stepMessage || 'Processing Paystack Checkout...'}</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>Fund Wallet Now</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-purple-300/70 pt-1">
                <Lock className="w-3.5 h-3.5 text-purple-400" />
                <span>256-bit Encrypted SSL Gateway powered by Paystack</span>
              </div>

            </form>
          )}

          {/* TAB 2: BALANCE OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Balance Card */}
              <div className="bg-gradient-to-br from-purple-900/40 via-[#180c35] to-indigo-900/40 border border-[#381d6d] p-6 rounded-3xl relative overflow-hidden shadow-xl space-y-3">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-xs uppercase tracking-widest text-purple-300/70 font-bold">Total Wallet Balance</span>
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Escrow Vault Active
                  </span>
                </div>

                <div className="relative z-10">
                  <h2 className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                    ₦{walletBalance.toLocaleString()} <span className="text-base text-purple-300/60 font-sans font-bold">NGN</span>
                  </h2>
                  <p className="text-xs text-purple-300/70 pt-1">
                    Instant Marketplace Checkout • Auto-Deduction on Buy
                  </p>
                </div>

                <div className="pt-2 relative z-10">
                  <button
                    onClick={() => setActiveTab('fund')}
                    className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-extrabold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition cursor-pointer text-xs sm:text-sm"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Fund Wallet via Paystack</span>
                  </button>
                </div>
              </div>

              {/* Escrow Guarantee Callout */}
              <div className="bg-[#170c30]/70 border border-[#2d1952] p-4 rounded-2xl flex items-start gap-3">
                <Lock className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-extrabold text-white text-xs">Wallet Purchase & Escrow Protection</h4>
                  <p className="text-xs text-purple-300/70 leading-relaxed">
                    When you purchase a product on ZENET HUB, funds are safely held in escrow. Digital product credentials are unlocked instantly upon purchase!
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <h4 className="font-extrabold text-white text-sm">Wallet Ledger & Deposits</h4>

              {transactions.length === 0 ? (
                <div className="text-center py-8 text-purple-300/60 text-xs">
                  No wallet transactions recorded yet.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="bg-[#170c30] border border-[#2d1952] p-3.5 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                        tx.type === 'deposit' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-purple-950 text-purple-300 border border-purple-500/30'
                      }`}>
                        {tx.type === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-bold text-white block">{tx.description}</span>
                        <span className="text-[10px] text-purple-300/50 font-mono">{tx.date}</span>
                      </div>
                    </div>

                    <span className={`font-mono font-extrabold text-sm ${
                      tx.type === 'deposit' ? 'text-emerald-400' : 'text-purple-200'
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
