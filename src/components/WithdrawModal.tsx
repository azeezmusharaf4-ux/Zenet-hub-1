import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  X, 
  ArrowDownToLine, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertCircle, 
  Building2, 
  Clock, 
  Calendar, 
  History, 
  Wallet,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { db, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch } from '../utils/api';
import { UserProfile, WithdrawalRequest } from '../types';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userProfile: UserProfile | null;
  walletBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

const COMMON_BANKS = [
  'OPay (PayCom)',
  'Moniepoint MFB',
  'PalmPay',
  'Kuda Bank',
  'Access Bank',
  'GTBank (Guaranty Trust Bank)',
  'Zenith Bank',
  'United Bank for Africa (UBA)',
  'First Bank of Nigeria',
  'Fidelity Bank',
  'Stanbic IBTC Bank',
  'Union Bank',
  'Sterling Bank',
  'Wema Bank / ALAT',
  'Other / Custom Bank'
];

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  user,
  userProfile,
  walletBalance,
  onBalanceChange
}) => {
  const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');
  const [withdrawalId, setWithdrawalId] = useState<string>(userProfile?.withdrawalId || '');
  const [amount, setAmount] = useState<string>('5000');
  const [bankName, setBankName] = useState<string>('OPay (PayCom)');
  const [customBank, setCustomBank] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>(userProfile?.displayName || userProfile?.fullName || '');
  const [notes, setNotes] = useState<string>('');

  const [copiedId, setCopiedId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<WithdrawalRequest | null>(null);
  const [myWithdrawals, setMyWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const MIN_WITHDRAWAL = 5000;
  const MAX_WITHDRAWAL = 100000;

  // 1. Fetch or initialize permanent server-generated Withdrawal ID
  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    const fetchWithdrawalIdentity = async () => {
      try {
        const token = await getSafeIdToken(user);
        if (!token) return;

        const res = await safeApiFetch('/api/withdrawals/my-id', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (isMounted && res && res.success && res.withdrawalId) {
          setWithdrawalId(res.withdrawalId);
          if (typeof res.walletBalance === 'number' && res.walletBalance !== walletBalance) {
            onBalanceChange(res.walletBalance);
          }
        }
      } catch (err) {
        console.warn('Error fetching withdrawal ID:', err);
      }
    };

    fetchWithdrawalIdentity();
    return () => { isMounted = false; };
  }, [isOpen, user?.uid]);

  // 2. Real-time private withdrawal history for current user
  useEffect(() => {
    if (!isOpen || !user) return;

    setLoadingHistory(true);
    const q = query(
      collection(db, 'withdrawal_requests'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WithdrawalRequest[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as WithdrawalRequest);
        });
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setMyWithdrawals(list);
        setLoadingHistory(false);
      },
      (err) => {
        console.warn('Error fetching private withdrawals history:', err);
        setLoadingHistory(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen, user?.uid]);

  if (!isOpen) return null;

  const numericAmount = Number(amount) || 0;
  const isBalanceSufficient = walletBalance >= MIN_WITHDRAWAL;
  const isAmountValid = numericAmount >= MIN_WITHDRAWAL && numericAmount <= MAX_WITHDRAWAL && numericAmount <= walletBalance;

  const handleCopyId = () => {
    if (!withdrawalId) return;
    navigator.clipboard?.writeText(withdrawalId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrorMsg(null);

    if (walletBalance < MIN_WITHDRAWAL) {
      setErrorMsg(`Your balance (₦${walletBalance.toLocaleString()}) is below the minimum withdrawal requirement of ₦${MIN_WITHDRAWAL.toLocaleString()}.`);
      return;
    }

    if (numericAmount < MIN_WITHDRAWAL) {
      setErrorMsg(`Minimum withdrawal amount is ₦${MIN_WITHDRAWAL.toLocaleString()}.`);
      return;
    }

    if (numericAmount > MAX_WITHDRAWAL) {
      setErrorMsg(`Maximum withdrawal per request is ₦${MAX_WITHDRAWAL.toLocaleString()}.`);
      return;
    }

    if (numericAmount > walletBalance) {
      setErrorMsg(`Cannot withdraw ₦${numericAmount.toLocaleString()}. Your available balance is ₦${walletBalance.toLocaleString()}.`);
      return;
    }

    const resolvedBank = bankName === 'Other / Custom Bank' ? customBank.trim() : bankName.trim();
    if (!resolvedBank) {
      setErrorMsg('Please specify your bank name.');
      return;
    }

    if (!accountNumber.trim() || accountNumber.trim().length < 8) {
      setErrorMsg('Please enter a valid account number (8-10 digits).');
      return;
    }

    if (!accountName.trim()) {
      setErrorMsg('Please enter the account holder name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = await getSafeIdToken(user);
      if (!token) {
        setErrorMsg('Authentication expired. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const res = await safeApiFetch('/api/withdrawals/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: numericAmount,
          bankName: resolvedBank,
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          notes: notes.trim()
        })
      });

      if (res && res.success) {
        if (typeof res.newBalance === 'number') {
          onBalanceChange(res.newBalance);
        }
        setSuccessReceipt(res.withdrawal);
        setAmount('5000');
        setNotes('');
      } else {
        setErrorMsg(res?.error || 'Failed to submit withdrawal request.');
      }
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      setErrorMsg(err.message || 'Network error occurred while submitting withdrawal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200">Completed</span>;
      case 'approved':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-600 border border-blue-200">Approved</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-600 border border-rose-200">Rejected (Refunded)</span>;
      case 'pending':
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-600 border border-amber-200">Pending Review</span>;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-[#EAE6F8] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F1EEF9] flex items-center justify-between bg-[#FAF9FF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center shadow-xs">
              <ArrowDownToLine className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-[#0F172A]">Owner & Admin Payout</h3>
                <span className="text-[10px] font-extrabold bg-[#5B4DF5] text-white px-2 py-0.5 rounded-full">
                  OFFICIAL
                </span>
              </div>
              <p className="text-xs text-[#64748B] font-medium">Direct wallet earnings withdrawal</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#F1EEF9] bg-[#FAF8FE] px-5 pt-2">
          <button
            type="button"
            onClick={() => { setActiveTab('request'); setSuccessReceipt(null); }}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'request'
                ? 'border-[#5B4DF5] text-[#5B4DF5]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Request Payout</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#5B4DF5] text-[#5B4DF5]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>My Payout History</span>
            {myWithdrawals.length > 0 && (
              <span className="bg-[#EDE9FE] text-[#5B4DF5] text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {myWithdrawals.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'request' ? (
            successReceipt ? (
              // Success Receipt Card
              <div className="space-y-5 text-center py-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-black text-[#0F172A]">Withdrawal Request Submitted!</h4>
                  <p className="text-xs text-[#64748B]">
                    Your payout request has been queued for immediate processing.
                  </p>
                </div>

                <div className="bg-[#FAF8FE] border border-[#EDE9FE] rounded-2xl p-4 text-left space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Reference ID:</span>
                    <span className="font-mono font-black text-[#0F172A]">{successReceipt.id}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Withdrawal ID:</span>
                    <span className="font-mono font-bold text-[#5B4DF5]">{successReceipt.withdrawalId}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Amount:</span>
                    <span className="text-sm font-black text-emerald-600">₦{successReceipt.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Destination Bank:</span>
                    <span className="font-bold text-[#0F172A]">{successReceipt.bankName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Account Number:</span>
                    <span className="font-mono font-bold text-[#0F172A]">{successReceipt.accountNumber}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#64748B] font-semibold">Status:</span>
                    {getStatusBadge(successReceipt.status)}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="flex-1 px-4 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] hover:bg-[#F3EEFF] text-[#0F172A] font-bold text-xs transition cursor-pointer"
                  >
                    View All History
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuccessReceipt(null)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-[#5B4DF5] hover:bg-[#4839EB] text-white font-extrabold text-xs transition cursor-pointer"
                  >
                    Make Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                {/* Available Balance Card */}
                <div className="bg-gradient-to-br from-[#1E192E] to-[#2D2447] text-white rounded-2xl p-4.5 shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200/80 block">
                      Available Withdrawable Balance
                    </span>
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-white block mt-0.5">
                      ₦{walletBalance.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-purple-200/70 font-medium mt-1 block">
                      Limits: Min ₦5,000 • Max ₦100,000 per request
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/15">
                    <Wallet className="w-6 h-6 stroke-[2]" />
                  </div>
                </div>

                {/* Permanent Server-Generated Withdrawal ID */}
                <div className="bg-[#FAF8FE] border border-[#EDE9FE] rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#5B4DF5]" />
                      <span className="text-[11px] font-extrabold text-[#64748B] uppercase tracking-wider">
                        Permanent Withdrawal ID
                      </span>
                    </div>
                    <span className="font-mono font-black text-sm text-[#0F172A] block tracking-wide">
                      {withdrawalId || 'Generating permanent ID...'}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">
                      Server-assigned unique identity; permanently linked to your account.
                    </span>
                  </div>
                  {withdrawalId && (
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#EAE6F8] hover:bg-[#F3EEFF] text-[#5B4DF5] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Copy Withdrawal ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {/* Below Minimum Balance Warning */}
                {!isBalanceSufficient && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Minimum Withdrawal is ₦5,000</p>
                      <p className="text-[11px] text-rose-600 mt-0.5">
                        Your current balance of ₦{walletBalance.toLocaleString()} is below the required ₦5,000 threshold.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Amount Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A] flex justify-between">
                    <span>Withdrawal Amount (₦)</span>
                    <span className="text-[#64748B] font-normal text-[11px]">Min: ₦5,000 | Max: ₦100,000</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-[#64748B]">₦</span>
                    <input
                      type="number"
                      min={5000}
                      max={100000}
                      step={500}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={!isBalanceSufficient || isSubmitting}
                      placeholder="e.g. 5000"
                      className="w-full pl-8 pr-4 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] focus:bg-white focus:border-[#5B4DF5] text-[#0F172A] text-sm font-black outline-none transition disabled:opacity-50"
                      required
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[5000, 10000, 20000, 50000, 100000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        disabled={!isBalanceSufficient || preset > walletBalance}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition border cursor-pointer ${
                          amount === String(preset)
                            ? 'bg-[#5B4DF5] text-white border-[#5B4DF5]'
                            : 'bg-white text-[#64748B] border-[#EAE6F8] hover:border-[#5B4DF5] disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        ₦{preset.toLocaleString()}
                      </button>
                    ))}
                    {walletBalance >= 5000 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(Math.min(walletBalance, 100000)))}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-[#FAF5FF] text-[#5B4DF5] border border-[#DDD6FE] hover:bg-[#EDE9FE] transition cursor-pointer"
                      >
                        Max (₦{Math.min(walletBalance, 100000).toLocaleString()})
                      </button>
                    )}
                  </div>
                </div>

                {/* Bank Details */}
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#5B4DF5]" />
                      <span>Destination Bank Name</span>
                    </label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] focus:bg-white focus:border-[#5B4DF5] text-[#0F172A] text-xs font-bold outline-none transition cursor-pointer"
                    >
                      {COMMON_BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {bankName === 'Other / Custom Bank' && (
                    <input
                      type="text"
                      placeholder="Enter custom bank name"
                      value={customBank}
                      onChange={(e) => setCustomBank(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] focus:bg-white focus:border-[#5B4DF5] text-[#0F172A] text-xs font-semibold outline-none transition"
                      required
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#0F172A]">Account Number</label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="10-digit account no."
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                        disabled={isSubmitting}
                        className="w-full px-3.5 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] focus:bg-white focus:border-[#5B4DF5] text-[#0F172A] text-xs font-bold font-mono outline-none transition"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#0F172A]">Account Holder Name</label>
                      <input
                        type="text"
                        placeholder="Registered account name"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full px-3.5 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] focus:bg-white focus:border-[#5B4DF5] text-[#0F172A] text-xs font-bold outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">Note / Instructions (Optional)</label>
                    <input
                      type="text"
                      placeholder="Optional memo for payout reference"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] focus:bg-white focus:border-[#5B4DF5] text-[#0F172A] text-xs font-medium outline-none transition"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!isBalanceSufficient || !isAmountValid || isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-[#5B4DF5] hover:bg-[#4839EB] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-[#5B4DF5]/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Processing Payout Request...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-4 h-4" />
                      <span>Confirm & Request ₦{numericAmount > 0 ? numericAmount.toLocaleString() : '5,000'}</span>
                    </>
                  )}
                </button>
              </form>
            )
          ) : (
            // Private History Tab
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-[#64748B] font-semibold space-y-2">
                  <div className="w-6 h-6 border-2 border-[#5B4DF5]/20 border-t-[#5B4DF5] rounded-full animate-spin mx-auto"></div>
                  <p>Loading your private withdrawal history...</p>
                </div>
              ) : myWithdrawals.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8FE] text-[#94A3B8] flex items-center justify-center mx-auto border border-[#EDE9FE]">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A]">No withdrawal requests yet</h4>
                  <p className="text-xs text-[#64748B]">
                    Requests you submit will appear here in real-time.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myWithdrawals.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] space-y-2 hover:border-[#5B4DF5]/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-[#0F172A]">{item.id}</span>
                        {getStatusBadge(item.status)}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-sm font-black text-emerald-600">
                          ₦{item.amount.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{item.createdDate}</span>
                          <Clock className="w-3.5 h-3.5 ml-1" />
                          <span>{item.createdTime}</span>
                        </div>
                      </div>
                      <div className="pt-1 border-t border-[#F1EEF9] flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>{item.bankName} • {item.accountNumber}</span>
                        <span className="font-bold text-[#0F172A]">{item.accountName}</span>
                      </div>
                      {item.adminNotes && (
                        <div className="bg-white p-2 rounded-xl border border-[#EAE6F8] text-[10px] text-[#64748B]">
                          <span className="font-bold text-[#0F172A]">Admin memo:</span> {item.adminNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
