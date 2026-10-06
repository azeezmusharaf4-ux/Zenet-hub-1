import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  X, 
  ArrowLeft,
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
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Ban
} from 'lucide-react';
import { db, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch } from '../utils/api';
import { UserProfile, WithdrawalRequest } from '../types';
import { isAuthorizedOwner } from '../lib/authorizedOwners';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userProfile: UserProfile | null;
  walletBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

interface PaystackBank {
  id: number | string;
  name: string;
  code: string;
  slug?: string;
}

const FALLBACK_PAYSTACK_BANKS: PaystackBank[] = [
  { id: 1, name: 'OPay (PayCom)', code: '999992', slug: 'paycom' },
  { id: 2, name: 'PalmPay', code: '999991', slug: 'palmpay' },
  { id: 3, name: 'Moniepoint MFB', code: '50515', slug: 'moniepoint-mfb' },
  { id: 4, name: 'Kuda Bank', code: '50211', slug: 'kuda-bank' },
  { id: 5, name: 'Access Bank', code: '044', slug: 'access-bank' },
  { id: 6, name: 'GTBank (Guaranty Trust Bank)', code: '058', slug: 'guaranty-trust-bank' },
  { id: 7, name: 'Zenith Bank', code: '057', slug: 'zenith-bank' },
  { id: 8, name: 'United Bank for Africa (UBA)', code: '033', slug: 'united-bank-for-africa' },
  { id: 9, name: 'First Bank of Nigeria', code: '011', slug: 'first-bank-of-nigeria' },
  { id: 10, name: 'Fidelity Bank', code: '070', slug: 'fidelity-bank' },
  { id: 11, name: 'Stanbic IBTC Bank', code: '221', slug: 'stanbic-ibtc-bank' },
  { id: 12, name: 'Union Bank of Nigeria', code: '032', slug: 'union-bank-of-nigeria' },
  { id: 13, name: 'Sterling Bank', code: '232', slug: 'sterling-bank' },
  { id: 14, name: 'Wema Bank / ALAT', code: '035', slug: 'wema-bank' },
  { id: 15, name: 'FCMB (First City Monument Bank)', code: '214', slug: 'first-city-monument-bank' },
  { id: 16, name: 'Polaris Bank', code: '076', slug: 'polaris-bank' },
  { id: 17, name: 'Keystone Bank', code: '082', slug: 'keystone-bank' },
  { id: 18, name: 'Ecobank Nigeria', code: '050', slug: 'ecobank-nigeria' },
  { id: 19, name: 'Providus Bank', code: '101', slug: 'providus-bank' },
  { id: 20, name: 'Jaiz Bank', code: '301', slug: 'jaiz-bank' },
  { id: 21, name: 'Taj Bank', code: '302', slug: 'taj-bank' }
];

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  user,
  userProfile,
  walletBalance,
  onBalanceChange
}) => {
  const isOwnerOrAdmin = isAuthorizedOwner(user, userProfile) || userProfile?.role === 'admin' || userProfile?.role === 'owner';
  
  const [activeTab, setActiveTab] = useState<'request' | 'history' | 'all-history'>('request');
  const [amount, setAmount] = useState<string>('5000');
  
  // Paystack Banks & Account Verification state
  const [banks, setBanks] = useState<PaystackBank[]>(FALLBACK_PAYSTACK_BANKS);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [selectedBank, setSelectedBank] = useState<PaystackBank | null>(FALLBACK_PAYSTACK_BANKS[0]);
  const [bankSearchQuery, setBankSearchQuery] = useState<string>('');
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);

  const [accountNumber, setAccountNumber] = useState<string>('');
  const [verifiedAccountName, setVerifiedAccountName] = useState<string | null>(null);
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [accountResolveError, setAccountResolveError] = useState<string | null>(null);

  const [notes, setNotes] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<WithdrawalRequest | null>(null);

  // Private History for Current User
  const [myWithdrawals, setMyWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // All Real Withdrawal Transactions History (Owner / Admin)
  const [allTransactions, setAllTransactions] = useState<WithdrawalRequest[]>([]);
  const [loadingAllHistory, setLoadingAllHistory] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Confirm / Search Transaction ID state
  const [searchTxId, setSearchTxId] = useState<string>('');
  const [isSearchingTx, setIsSearchingTx] = useState(false);
  const [searchResult, setSearchResult] = useState<WithdrawalRequest | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected Transaction for Full Details View
  const [selectedTxDetails, setSelectedTxDetails] = useState<WithdrawalRequest | null>(null);

  const MIN_WITHDRAWAL = 5000;
  const MAX_WITHDRAWAL = 100000;

  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. Fetch Banks List from connected Paystack API
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const loadPaystackBanks = async () => {
      setLoadingBanks(true);
      try {
        const res = await safeApiFetch('/api/paystack/banks');
        if (isMounted && res && res.success && Array.isArray(res.banks) && res.banks.length > 0) {
          setBanks(res.banks);
          if (!selectedBank) {
            const defaultBank = res.banks.find((b: any) => b.name.toLowerCase().includes('opay') || b.code === '999992') || res.banks[0];
            setSelectedBank(defaultBank);
          }
        }
      } catch (err) {
        console.warn('Paystack banks fetch notice, using fallback catalog:', err);
      } finally {
        if (isMounted) setLoadingBanks(false);
      }
    };

    loadPaystackBanks();
    return () => { isMounted = false; };
  }, [isOpen]);

  // Filter banks by search query
  const filteredBanks = useMemo(() => {
    const q = bankSearchQuery.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter(b => b.name.toLowerCase().includes(q) || b.code.includes(q));
  }, [banks, bankSearchQuery]);

  // 2. Resolve / Verify Bank Account Details using connected Paystack API
  const resolveAccount = async (accNum: string, bankCode: string) => {
    const cleanAcc = accNum.trim().replace(/\D/g, '');
    const cleanCode = bankCode.trim();

    if (cleanAcc.length !== 10 || !cleanCode) {
      setVerifiedAccountName(null);
      return;
    }

    setIsResolvingAccount(true);
    setAccountResolveError(null);
    setVerifiedAccountName(null);

    try {
      const res = await safeApiFetch(`/api/paystack/resolve-account?account_number=${encodeURIComponent(cleanAcc)}&bank_code=${encodeURIComponent(cleanCode)}`);
      if (res && res.success && res.account_name) {
        setVerifiedAccountName(res.account_name);
        setAccountResolveError(null);
      } else {
        setVerifiedAccountName(null);
        setAccountResolveError(res?.error || 'Could not verify account name with Paystack. Please check the account number and bank.');
      }
    } catch (err: any) {
      setVerifiedAccountName(null);
      setAccountResolveError(err?.message || 'Could not verify account name with Paystack. Please check the account number and bank.');
    } finally {
      setIsResolvingAccount(false);
    }
  };

  // Auto-resolve account when 10 digits are reached and bank is selected
  useEffect(() => {
    if (!isOpen) return;
    const cleanAcc = accountNumber.trim().replace(/\D/g, '');
    if (cleanAcc.length === 10 && selectedBank?.code) {
      const timer = setTimeout(() => {
        resolveAccount(cleanAcc, selectedBank.code);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setVerifiedAccountName(null);
      setAccountResolveError(null);
    }
  }, [accountNumber, selectedBank?.code, isOpen]);

  // 3. Fetch All Real Withdrawal Transactions History (Owner / Admin)
  const fetchAllHistory = async () => {
    if (!user || !isOwnerOrAdmin) return;
    setLoadingAllHistory(true);
    try {
      const token = await getSafeIdToken(user);
      if (!token) return;

      const res = await safeApiFetch('/api/withdrawals/all-history', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res && res.success && Array.isArray(res.withdrawals)) {
        setAllTransactions(res.withdrawals);
      }
    } catch (err) {
      console.warn('Error fetching all withdrawal transactions history:', err);
    } finally {
      setLoadingAllHistory(false);
    }
  };

  // 4. Admin Mark as Completed or Reject / Fail
  const handleAdminUpdateStatus = async (requestId: string, newStatus: 'completed' | 'rejected' | 'failed', memo?: string) => {
    if (!user || !isOwnerOrAdmin) return;
    setUpdatingStatusId(requestId);
    try {
      const token = await getSafeIdToken(user);
      if (!token) return;

      const res = await safeApiFetch('/api/withdrawals/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId,
          status: newStatus,
          adminNotes: memo || (newStatus === 'completed' ? 'Payout processed successfully' : 'Payout request declined and refunded')
        })
      });

      if (res && res.success) {
        // Update local items
        setAllTransactions(prev => prev.map(t => (t.id === requestId || t.transactionId === requestId ? { ...t, status: newStatus } : t)));
        if (selectedTxDetails && (selectedTxDetails.id === requestId || selectedTxDetails.transactionId === requestId)) {
          setSelectedTxDetails(prev => prev ? { ...prev, status: newStatus } : null);
        }
        if (searchResult && (searchResult.id === requestId || searchResult.transactionId === requestId)) {
          setSearchResult(prev => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // 5. Confirm / Search Transaction ID
  const handleSearchTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = searchTxId.trim();
    if (!cleanId) {
      setSearchError('Please enter a Transaction ID.');
      return;
    }

    if (!user) return;

    setSearchError(null);
    setSearchResult(null);
    setIsSearchingTx(true);

    try {
      const token = await getSafeIdToken(user);
      if (!token) {
        setSearchError('Session expired. Please log in.');
        setIsSearchingTx(false);
        return;
      }

      const res = await safeApiFetch('/api/withdrawals/search-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId: cleanId })
      });

      if (res && res.success && res.transaction) {
        setSearchResult(res.transaction);
      } else {
        setSearchError(res?.error || 'Transaction ID not found.');
      }
    } catch (err: any) {
      setSearchError('Transaction ID not found.');
    } finally {
      setIsSearchingTx(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'all-history' && isOwnerOrAdmin) {
      fetchAllHistory();
    }
  }, [isOpen, activeTab, isOwnerOrAdmin]);

  // 6. Real-time private withdrawal history for current user
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

  // 7. Submit Withdrawal Request (Creates Pending Real Record)
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrorMsg(null);

    if (accountNumber.trim().length !== 10) {
      setErrorMsg('Please enter a valid 10-digit bank account number.');
      return;
    }

    if (!selectedBank) {
      setErrorMsg('Please select your destination bank from the Paystack list.');
      return;
    }

    if (!verifiedAccountName) {
      setErrorMsg('Account verification required: Paystack could not verify the account details. Please check the bank and account number.');
      return;
    }

    if (walletBalance < MIN_WITHDRAWAL) {
      setErrorMsg(`Your balance (₦${walletBalance.toLocaleString()}) is below the minimum withdrawal threshold of ₦${MIN_WITHDRAWAL.toLocaleString()}.`);
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
          bankName: selectedBank.name,
          bankCode: selectedBank.code,
          accountNumber: accountNumber.trim(),
          accountName: verifiedAccountName.trim(),
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
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-600 border border-blue-200">Approved</span>;
      case 'rejected':
      case 'failed':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-600 border border-rose-200">Rejected (Refunded)</span>;
      case 'pending':
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-600 border border-amber-200">Pending</span>;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 md:z-[120] bg-white md:bg-black/60 md:backdrop-blur-xs flex flex-col md:items-center md:justify-center md:p-4 w-full h-[100dvh] max-h-[100dvh] overflow-hidden animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg mx-auto flex-1 flex flex-col h-full min-h-0 bg-white rounded-none border-0 md:rounded-3xl md:border md:border-[#EAE6F8] md:shadow-2xl md:max-h-[90vh] md:flex-initial overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with prominent Top-Left Back Button */}
        <div className="px-4 sm:px-6 py-3 border-b border-[#F1EEF9] flex items-center justify-between bg-white shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 text-[#0F172A] hover:text-[#5B4DF5] rounded-full hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer font-bold"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#0F172A]" />
              <span className="text-xs font-bold text-[#64748B] hidden xs:inline">Back</span>
            </button>
            <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center shadow-xs shrink-0 ml-0.5">
              <ArrowDownToLine className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-[#0F172A] leading-tight">Owner & Admin Payout</h3>
                <span className="text-[10px] font-extrabold bg-[#5B4DF5] text-white px-2 py-0.5 rounded-full">
                  OFFICIAL
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] font-medium hidden sm:block">Paystack verified withdrawal system</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#F1EEF9] bg-[#FAF8FE] px-3 sm:px-6 pt-2 shrink-0 overflow-x-auto no-scrollbar gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab('request'); setSuccessReceipt(null); }}
            className={`px-3 sm:px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'request'
                ? 'border-[#5B4DF5] text-[#5B4DF5]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Request Payout</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-[#5B4DF5] text-[#5B4DF5]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>My Payout History</span>
            {myWithdrawals.length > 0 && (
              <span className="bg-[#EDE9FE] text-[#5B4DF5] text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {myWithdrawals.length}
              </span>
            )}
          </button>
          {isOwnerOrAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('all-history')}
              className={`px-3 sm:px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'all-history'
                  ? 'border-[#5B4DF5] text-[#5B4DF5]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Withdrawal Transaction History</span>
              {allTransactions.length > 0 && (
                <span className="bg-[#5B4DF5] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {allTransactions.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Modal Body - Vertically scrollable with bottom padding to ensure submit button is reachable */}
        <div className="p-4 sm:p-5 pb-28 md:pb-6 overflow-y-auto space-y-4 flex-1 w-full max-w-full">
          {activeTab === 'request' ? (
            successReceipt ? (
              // Success Receipt Card (Pending Status)
              <div className="space-y-4 text-center py-2 animate-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-[#0F172A]">Withdrawal Request Pending</h4>
                  <p className="text-xs text-[#64748B]">
                    Your payout has been submitted and is currently <strong className="text-amber-600">Pending</strong> admin processing.
                  </p>
                </div>

                <div className="bg-[#FAF8FE] border border-[#EDE9FE] rounded-2xl p-4 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Transaction ID:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-[#5B4DF5]">
                        {successReceipt.transactionId || successReceipt.reference || successReceipt.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(successReceipt.transactionId || successReceipt.reference || successReceipt.id, 'receipt-tx')}
                        className="p-1 rounded-md text-[#5B4DF5] hover:bg-[#EDE9FE] transition cursor-pointer"
                        title="Copy Transaction ID"
                      >
                        {copiedKey === 'receipt-tx' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Category:</span>
                    <span className="text-[10px] font-black bg-[#EDE9FE] text-[#5B4DF5] px-2 py-0.5 rounded-full uppercase">
                      Withdrawal Transaction
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Date & Time:</span>
                    <span className="font-bold text-[#0F172A]">
                      {successReceipt.createdDate} • {successReceipt.createdTime}
                    </span>
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
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Verified Account Name:</span>
                    <span className="font-bold text-emerald-700 uppercase">{successReceipt.accountName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#64748B] font-semibold">Status:</span>
                    {getStatusBadge(successReceipt.status)}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab(isOwnerOrAdmin ? 'all-history' : 'history')}
                    className="flex-1 px-4 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] hover:bg-[#F3EEFF] text-[#0F172A] font-bold text-xs transition cursor-pointer"
                  >
                    {isOwnerOrAdmin ? 'View Transaction History' : 'View My History'}
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
              <form onSubmit={handleSubmitWithdrawal} className="space-y-3.5">
                {/* Compact Available Withdrawable Balance Card (Reduced size to save space) */}
                <div className="bg-[#FAF8FE] border border-[#EDE9FE] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-extrabold text-[#5B4DF5] uppercase tracking-wider block">
                        Available Withdrawable Balance
                      </span>
                      <span className="bg-[#EDE9FE] text-[#5B4DF5] text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        LIVE
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-black tracking-tight text-[#0F172A]">
                        ₦{walletBalance.toLocaleString()}
                      </span>
                      <span className="text-[11px] font-bold text-[#64748B]">NGN</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-medium mt-0.5 block">
                      Limits: Min ₦5,000 • Max ₦100,000 per request
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center shrink-0 shadow-xs">
                    <Wallet className="w-4 h-4 stroke-[2.2]" />
                  </div>
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

                {/* 1. Account Number Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A] flex justify-between">
                    <span>Account Number</span>
                    <span className="text-[#64748B] font-normal text-[11px]">10-digit NUBAN</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Enter 10-digit account number"
                      value={accountNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setAccountNumber(val);
                        setVerifiedAccountName(null);
                        setAccountResolveError(null);
                      }}
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] focus:bg-white focus:border-[#5B4DF5] text-[#0F172A] text-sm font-bold font-mono outline-none transition"
                      required
                    />
                    {accountNumber.length > 0 && accountNumber.length < 10 && (
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {10 - accountNumber.length} digits left
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Bank Field (Searchable Paystack Bank Selector) */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#5B4DF5]" />
                      <span>Bank</span>
                    </span>
                    <span className="text-[10px] text-[#64748B] font-semibold">
                      {loadingBanks ? 'Loading banks...' : 'Paystack Supported Banks'}
                    </span>
                  </label>

                  {/* Selector Trigger */}
                  <div 
                    onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                    className="w-full px-3.5 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] hover:bg-white focus-within:border-[#5B4DF5] text-[#0F172A] text-xs font-bold transition cursor-pointer flex items-center justify-between shadow-2xs"
                  >
                    <span className={selectedBank ? "text-[#0F172A] font-extrabold" : "text-[#94A3B8]"}>
                      {selectedBank ? selectedBank.name : "Click to search & select your bank..."}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#64748B] transition-transform duration-200 ${isBankDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Searchable Dropdown Popup */}
                  {isBankDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl border border-[#EAE6F8] shadow-xl overflow-hidden p-2 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type bank name (e.g. Access, OPay, GTBank)..."
                          value={bankSearchQuery}
                          onChange={(e) => setBankSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#FAF8FE] border border-[#EDE9FE] focus:border-[#5B4DF5] text-xs font-bold text-[#0F172A] outline-none"
                        />
                      </div>

                      <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {filteredBanks.length === 0 ? (
                          <div className="py-6 text-center text-xs text-[#94A3B8] font-medium">
                            No matching bank found for "{bankSearchQuery}"
                          </div>
                        ) : (
                          filteredBanks.map((b) => {
                            const isSelected = selectedBank?.code === b.code;
                            return (
                              <button
                                key={`${b.code}-${b.id || b.name}`}
                                type="button"
                                onClick={() => {
                                  setSelectedBank(b);
                                  setBankSearchQuery(b.name);
                                  setIsBankDropdownOpen(false);
                                  setVerifiedAccountName(null);
                                  setAccountResolveError(null);
                                }}
                                className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                                  isSelected ? 'bg-[#EDE9FE] text-[#5B4DF5]' : 'hover:bg-[#FAF8FE] text-[#0F172A]'
                                }`}
                              >
                                <span>{b.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#5B4DF5]" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Account Verification Display / Trigger */}
                {isResolvingAccount && (
                  <div className="p-3 rounded-2xl bg-[#FAF8FE] border border-[#EDE9FE] flex items-center gap-2.5 text-xs text-[#5B4DF5] font-bold animate-in fade-in">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#5B4DF5]" />
                    <span>Verifying account with Paystack...</span>
                  </div>
                )}

                {/* Account Verified Card */}
                {verifiedAccountName && !isResolvingAccount && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-xs space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Account Verified via Paystack</span>
                      </div>
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        VERIFIED
                      </span>
                    </div>
                    <div className="space-y-1 text-[#0F172A]">
                      <div className="flex justify-between">
                        <span className="text-[#64748B] font-semibold">Account Number:</span>
                        <span className="font-mono font-bold">{accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B] font-semibold">Bank:</span>
                        <span className="font-bold">{selectedBank?.name}</span>
                      </div>
                      <div className="flex justify-between items-center pt-0.5 border-t border-emerald-100">
                        <span className="text-[#64748B] font-semibold">Account Name:</span>
                        <span className="font-black text-emerald-700 uppercase tracking-tight">{verifiedAccountName}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Account Verification Error Banner */}
                {accountResolveError && !isResolvingAccount && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Account Verification Failed</p>
                      <p className="text-[11px] text-rose-600 mt-0.5">
                        {accountResolveError}
                      </p>
                    </div>
                  </div>
                )}

                {/* Manual Verify Account Button (if account entered but not resolved) */}
                {accountNumber.length === 10 && selectedBank && !verifiedAccountName && !isResolvingAccount && !accountResolveError && (
                  <button
                    type="button"
                    onClick={() => resolveAccount(accountNumber, selectedBank.code)}
                    className="w-full py-2.5 rounded-xl bg-[#EDE9FE] hover:bg-[#E0DAFD] text-[#5B4DF5] text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Account Details with Paystack</span>
                  </button>
                )}

                {/* 4. Withdrawal Amount Field (Only active after verification) */}
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
                      disabled={!verifiedAccountName || !isBalanceSufficient || isSubmitting}
                      placeholder="e.g. 5000"
                      className="w-full pl-8 pr-4 py-3 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] focus:bg-white focus:border-[#5B4DF5] text-[#0F172A] text-sm font-black outline-none transition disabled:opacity-50"
                      required
                    />
                  </div>
                  {!verifiedAccountName && (
                    <p className="text-[11px] text-[#64748B] italic">
                      Please enter and verify your Account Number & Bank above to enter withdrawal amount.
                    </p>
                  )}
                </div>

                {/* Optional Note Memo */}
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

                {/* Submit Button (Withdraw) */}
                <button
                  type="submit"
                  disabled={!verifiedAccountName || !isBalanceSufficient || !isAmountValid || isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-[#5B4DF5] hover:bg-[#4839EB] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-[#5B4DF5]/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Submitting Withdrawal Request...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-4 h-4" />
                      <span>Withdraw ₦{numericAmount > 0 ? numericAmount.toLocaleString() : '5,000'}</span>
                    </>
                  )}
                </button>
              </form>
            )
          ) : activeTab === 'all-history' && isOwnerOrAdmin ? (
            // ==========================================
            // ADMIN / OWNER: WITHDRAWAL TRANSACTION HISTORY & CONFIRM/SEARCH ID
            // ==========================================
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Confirm / Search Transaction ID Box */}
              <div className="bg-[#FAF8FE] border border-[#EDE9FE] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center">
                    <Search className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-[#0F172A]">
                      Confirm / Search Transaction ID
                    </h4>
                    <p className="text-[11px] text-[#64748B]">
                      Enter or paste any unique Withdrawal Transaction ID to confirm its authenticity.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSearchTransaction} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchTxId}
                      onChange={(e) => {
                        setSearchTxId(e.target.value);
                        if (searchError) setSearchError(null);
                      }}
                      placeholder="e.g. ZN-WTH-TXN-..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6F8] bg-white focus:border-[#5B4DF5] text-xs font-mono font-bold text-[#0F172A] outline-none transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingTx || !searchTxId.trim()}
                    className="px-4 py-2.5 bg-[#5B4DF5] hover:bg-[#4839EB] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isSearchingTx ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Search / Confirm</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Search Error - Clearly show "Transaction ID not found." */}
                {searchError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>Transaction ID not found.</span>
                  </div>
                )}

                {/* Search Result Display */}
                {searchResult && (
                  <div className="p-4 rounded-2xl bg-white border border-[#EDE9FE] shadow-sm space-y-3 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-[#F1EEF9]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-black text-emerald-700">Verified Transaction Found</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-[#EDE9FE] text-[#5B4DF5] px-2 py-0.5 rounded-full">
                        Withdrawal Transaction
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-[#64748B] block font-semibold">Transaction ID:</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-black text-xs text-[#5B4DF5]">
                            {searchResult.transactionId || searchResult.reference || searchResult.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(searchResult.transactionId || searchResult.reference || searchResult.id, 'search-tx')}
                            className="p-1 text-[#64748B] hover:text-[#5B4DF5] rounded transition cursor-pointer"
                            title="Copy Transaction ID"
                          >
                            {copiedKey === 'search-tx' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-[#64748B] block font-semibold">Amount:</span>
                        <span className="text-sm font-black text-emerald-600">
                          ₦{searchResult.amount.toLocaleString()} NGN
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-[#64748B] block font-semibold">Date & Time:</span>
                        <span className="font-bold text-[#0F172A]">
                          {searchResult.createdDate} • {searchResult.createdTime}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-[#64748B] block font-semibold">Customer / Requester:</span>
                        <span className="font-bold text-[#0F172A] truncate block">
                          {searchResult.userName || searchResult.userEmail}
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-[11px] text-[#64748B] block font-semibold">Destination Details:</span>
                        <span className="font-bold text-[#0F172A]">
                          {searchResult.bankName} • {searchResult.accountNumber} ({searchResult.accountName})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#64748B] font-semibold">Status:</span>
                        {getStatusBadge(searchResult.status)}
                      </div>
                    </div>

                    {/* Admin Action Buttons for Search Result */}
                    {searchResult.status === 'pending' && (
                      <div className="pt-2 border-t border-[#F1EEF9] flex items-center gap-2">
                        <button
                          type="button"
                          disabled={updatingStatusId === searchResult.id}
                          onClick={() => handleAdminUpdateStatus(searchResult.id, 'completed')}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark as Completed</span>
                        </button>
                        <button
                          type="button"
                          disabled={updatingStatusId === searchResult.id}
                          onClick={() => handleAdminUpdateStatus(searchResult.id, 'rejected')}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Reject & Refund</span>
                        </button>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-[#F1EEF9]">
                      <button
                        type="button"
                        onClick={() => setSelectedTxDetails(searchResult)}
                        className="text-xs font-bold text-[#5B4DF5] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Full Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchResult(null)}
                        className="text-xs font-bold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* All Real Withdrawal Transactions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-[#0F172A]">
                      All Withdrawal Transactions
                    </h4>
                    <span className="bg-[#EDE9FE] text-[#5B4DF5] text-[10px] font-black px-2 py-0.5 rounded-full">
                      {allTransactions.length} Real Records
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchAllHistory}
                    disabled={loadingAllHistory}
                    className="p-1.5 text-[#64748B] hover:text-[#5B4DF5] rounded-lg hover:bg-[#FAF8FE] transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
                    title="Refresh Transactions"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAllHistory ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>

                {loadingAllHistory ? (
                  <div className="py-12 text-center text-xs text-[#64748B] font-semibold space-y-2 bg-[#FAF8FE] rounded-2xl border border-[#EDE9FE]">
                    <div className="w-6 h-6 border-2 border-[#5B4DF5]/20 border-t-[#5B4DF5] rounded-full animate-spin mx-auto"></div>
                    <p>Loading real withdrawal transactions from database...</p>
                  </div>
                ) : allTransactions.length === 0 ? (
                  <div className="py-12 text-center space-y-2 bg-[#FAF8FE] rounded-2xl border border-[#EDE9FE]">
                    <div className="w-12 h-12 rounded-2xl bg-white text-[#94A3B8] flex items-center justify-center mx-auto border border-[#EDE9FE]">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h5 className="text-sm font-bold text-[#0F172A]">No withdrawal transactions found</h5>
                    <p className="text-xs text-[#64748B]">
                      When withdrawals are submitted, their permanent unique records will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {allTransactions.map((tx) => {
                      const displayTxId = tx.transactionId || tx.reference || tx.id;
                      const isPending = tx.status === 'pending';
                      return (
                        <div
                          key={tx.id}
                          onClick={() => setSelectedTxDetails(tx)}
                          className="p-3.5 rounded-2xl border border-[#EAE6F8] bg-[#FAF8FE] space-y-2 hover:border-[#5B4DF5]/40 hover:bg-[#F9F7FE] transition cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-xs font-black text-[#5B4DF5] truncate">
                                {displayTxId}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(displayTxId, `tx-${tx.id}`);
                                }}
                                className="p-1 text-[#64748B] hover:text-[#5B4DF5] rounded transition shrink-0"
                                title="Copy Transaction ID"
                              >
                                {copiedKey === `tx-${tx.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {getStatusBadge(tx.status)}
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-sm font-black text-emerald-600">
                              ₦{tx.amount.toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-medium">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{tx.createdDate}</span>
                              <Clock className="w-3.5 h-3.5 ml-1" />
                              <span>{tx.createdTime}</span>
                            </div>
                          </div>

                          <div className="pt-1 border-t border-[#F1EEF9] flex items-center justify-between text-[11px] text-[#64748B]">
                            <span className="truncate">
                              {tx.bankName} • {tx.accountNumber}
                            </span>
                            <span className="font-bold text-[#0F172A] shrink-0 ml-2">
                              {tx.accountName}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-0.5">
                            <span>Customer: {tx.userName || tx.userEmail}</span>
                            <span className="text-[#5B4DF5] font-semibold flex items-center gap-0.5">
                              <span>Full details</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>

                          {/* Quick Admin Actions on Card if Pending */}
                          {isPending && (
                            <div 
                              className="pt-2 border-t border-[#F1EEF9] flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={updatingStatusId === tx.id}
                                onClick={() => handleAdminUpdateStatus(tx.id, 'completed')}
                                className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Mark Completed</span>
                              </button>
                              <button
                                type="button"
                                disabled={updatingStatusId === tx.id}
                                onClick={() => handleAdminUpdateStatus(tx.id, 'rejected')}
                                className="flex-1 py-1.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Reject & Refund</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
                        <span className="font-mono text-xs font-black text-[#5B4DF5]">{item.transactionId || item.id}</span>
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

        {/* Full Details Modal for Selected Transaction */}
        {selectedTxDetails && (
          <div 
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setSelectedTxDetails(null)}
          >
            <div 
              className="bg-white border border-[#EAE6F8] rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#F1EEF9]">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center">
                    <FileText className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-[#0F172A]">
                      Withdrawal Transaction Details
                    </h3>
                    <span className="text-[11px] font-bold text-[#5B4DF5]">
                      Category: Withdrawal Transaction
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTxDetails(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#FAF8FE] border border-[#EDE9FE] rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Transaction ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-[#5B4DF5]">
                      {selectedTxDetails.transactionId || selectedTxDetails.reference || selectedTxDetails.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedTxDetails.transactionId || selectedTxDetails.reference || selectedTxDetails.id, 'modal-tx')}
                      className="p-1 text-[#5B4DF5] hover:bg-[#EDE9FE] rounded transition cursor-pointer"
                      title="Copy Transaction ID"
                    >
                      {copiedKey === 'modal-tx' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Category:</span>
                  <span className="text-[10px] font-black bg-[#EDE9FE] text-[#5B4DF5] px-2 py-0.5 rounded-full uppercase">
                    Withdrawal Transaction
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Amount:</span>
                  <span className="text-base font-black text-emerald-600">
                    ₦{selectedTxDetails.amount.toLocaleString()} NGN
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Status:</span>
                  {getStatusBadge(selectedTxDetails.status)}
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Date:</span>
                  <span className="font-bold text-[#0F172A]">{selectedTxDetails.createdDate}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Time:</span>
                  <span className="font-bold text-[#0F172A]">{selectedTxDetails.createdTime}</span>
                </div>

                {selectedTxDetails.month && (
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Month:</span>
                    <span className="font-bold text-[#0F172A]">{selectedTxDetails.month}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Destination Bank:</span>
                  <span className="font-bold text-[#0F172A]">{selectedTxDetails.bankName}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Account Number:</span>
                  <span className="font-mono font-bold text-[#0F172A]">{selectedTxDetails.accountNumber}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Verified Account Name:</span>
                  <span className="font-bold text-emerald-700 uppercase">{selectedTxDetails.accountName}</span>
                </div>

                {selectedTxDetails.userName && (
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">Customer / User:</span>
                    <span className="font-bold text-[#0F172A]">{selectedTxDetails.userName}</span>
                  </div>
                )}

                {selectedTxDetails.userEmail && (
                  <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold">User Email:</span>
                    <span className="font-medium text-[#0F172A]">{selectedTxDetails.userEmail}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Internal Reference:</span>
                  <span className="font-mono text-[#64748B] text-[11px]">{selectedTxDetails.reference || selectedTxDetails.id}</span>
                </div>

                {selectedTxDetails.notes && (
                  <div className="py-1 border-b border-[#F1EEF9]">
                    <span className="text-[#64748B] font-semibold block mb-0.5">Notes:</span>
                    <p className="text-[#0F172A] bg-white p-2 rounded-xl border border-[#EDE9FE]">
                      {selectedTxDetails.notes}
                    </p>
                  </div>
                )}

                {selectedTxDetails.adminNotes && (
                  <div className="py-1">
                    <span className="text-[#64748B] font-semibold block mb-0.5">Admin Memo:</span>
                    <p className="text-[#0F172A] bg-white p-2 rounded-xl border border-[#EDE9FE]">
                      {selectedTxDetails.adminNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Admin Actions inside Full Details Modal */}
              {isOwnerOrAdmin && selectedTxDetails.status === 'pending' && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={updatingStatusId === selectedTxDetails.id}
                    onClick={() => handleAdminUpdateStatus(selectedTxDetails.id, 'completed')}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as Completed</span>
                  </button>
                  <button
                    type="button"
                    disabled={updatingStatusId === selectedTxDetails.id}
                    onClick={() => handleAdminUpdateStatus(selectedTxDetails.id, 'rejected')}
                    className="flex-1 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Reject & Refund</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedTxDetails(null)}
                className="w-full py-3 bg-[#5B4DF5] hover:bg-[#4839EB] text-white font-extrabold text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
