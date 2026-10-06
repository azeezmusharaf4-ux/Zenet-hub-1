import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  X, 
  ArrowLeft,
  CheckCircle2, 
  Clock, 
  Calendar, 
  Copy, 
  Check, 
  Building2, 
  User as UserIcon, 
  AlertCircle, 
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { getSafeIdToken } from '../lib/firebase';
import { safeApiFetch } from '../utils/api';
import { WithdrawalRequest } from '../types';

interface PaymentNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const PaymentNotificationsModal: React.FC<PaymentNotificationsModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'confirmed' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [adminMemo, setAdminMemo] = useState<{ [key: string]: string }>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchWithdrawals = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getSafeIdToken(user);
      if (!token) return;

      const res = await safeApiFetch('/api/withdrawals/all-history', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res && res.success && Array.isArray(res.withdrawals)) {
        setRequests(res.withdrawals);
        // If an item is currently selected, keep its details updated
        if (selectedRequest) {
          const fresh = res.withdrawals.find((w: WithdrawalRequest) => w.id === selectedRequest.id || w.transactionId === selectedRequest.transactionId);
          if (fresh) setSelectedRequest(fresh);
        }
      }
    } catch (err) {
      console.warn('Error fetching withdrawal notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWithdrawals();
      setActionSuccess(null);
      setActionError(null);
      setSelectedRequest(null);
    }
  }, [isOpen, user?.uid]);

  if (!isOpen) return null;

  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleConfirmPayment = async (request: WithdrawalRequest) => {
    if (!user) return;
    const memo = adminMemo[request.id] || '';
    
    setConfirmingId(request.id);
    setActionSuccess(null);
    setActionError(null);

    try {
      const token = await getSafeIdToken(user);
      if (!token) {
        setActionError('Authentication session expired.');
        setConfirmingId(null);
        return;
      }

      const res = await safeApiFetch('/api/withdrawals/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: request.id || request.transactionId,
          adminNotes: memo
        })
      });

      if (res && res.success) {
        setActionSuccess(`Payment of ₦${request.amount.toLocaleString()} to ${request.accountName} has been confirmed!`);
        
        // Update local state immediately
        const updatedStatus = 'confirmed';
        const updatedNotes = memo || 'Payment confirmed by admin';
        
        setRequests((prev) =>
          prev.map((r) =>
            r.id === request.id || r.transactionId === request.transactionId
              ? { ...r, status: updatedStatus, adminNotes: updatedNotes }
              : r
          )
        );

        if (selectedRequest && (selectedRequest.id === request.id || selectedRequest.transactionId === request.transactionId)) {
          setSelectedRequest((prev) =>
            prev ? { ...prev, status: updatedStatus, adminNotes: updatedNotes } : null
          );
        }
      } else {
        setActionError(res?.error || 'Failed to confirm payment.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error confirming payment.');
    } finally {
      setConfirmingId(null);
    }
  };

  const formatNotificationTime = (createdAt?: string, dateStr?: string, timeStr?: string) => {
    if (!createdAt && !dateStr) return 'Just now';
    try {
      const date = createdAt ? new Date(createdAt) : new Date(`${dateStr} ${timeStr || ''}`);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return dateStr || date.toLocaleDateString();
    } catch {
      return dateStr || 'Recently';
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const confirmedRequests = requests.filter((r) => r.status === 'confirmed' || r.status === 'approved' || r.status === 'completed');
  
  const displayedRequests = 
    filter === 'pending'
      ? pendingRequests
      : filter === 'confirmed'
      ? confirmedRequests
      : requests;

  return (
    <div 
      className="fixed inset-0 z-[160] bg-white md:bg-slate-900/60 md:backdrop-blur-xs flex flex-col md:items-center md:justify-center md:p-4 w-full h-[100dvh] max-h-[100dvh] overflow-hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl mx-auto bg-white border-0 md:border md:border-[#EAE6F8] rounded-none md:rounded-3xl md:shadow-2xl flex flex-col h-full min-h-0 flex-1 md:flex-initial md:h-[88vh] md:max-h-[750px] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* 1. COMPACT HEADER (Clean: 🔔 Notifications)                     */}
        {/* ============================================================== */}
        <div className="px-4 py-3 border-b border-[#F1EEF9] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            {selectedRequest ? (
              <button 
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1 -ml-1 text-[#0F172A] hover:text-[#5B4DF5] rounded-full hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer font-bold text-xs"
                title="Back to notifications list"
              >
                <ArrowLeft className="w-4 h-4 text-[#0F172A]" />
                <span className="hidden xs:inline text-[#64748B]">Back</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={onClose}
                className="p-1 -ml-1 text-[#0F172A] hover:text-[#5B4DF5] rounded-full hover:bg-slate-100 transition cursor-pointer"
                title="Close"
              >
                <ArrowLeft className="w-4 h-4 text-[#0F172A]" />
              </button>
            )}

            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-base leading-none">🔔</span>
              <h3 className="text-sm sm:text-base font-black text-[#0F172A]">Notifications</h3>
              {pendingRequests.length > 0 && !selectedRequest && (
                <span className="bg-[#5B4DF5] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full ml-0.5">
                  {pendingRequests.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchWithdrawals}
              disabled={loading}
              className="p-1.5 text-[#64748B] hover:text-[#5B4DF5] rounded-full hover:bg-slate-100 transition cursor-pointer"
              title="Refresh notifications"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Alerts */}
        {actionSuccess && (
          <div className="mx-4 mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{actionSuccess}</span>
            <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {actionError && (
          <div className="mx-4 mt-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW A: FULL WITHDRAWAL DETAILS (When notification is tapped)   */}
        {/* ============================================================== */}
        {selectedRequest ? (
          <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-4 flex-1 min-h-0 pb-28 md:pb-6 animate-in fade-in duration-150">
            {/* Top Details Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F1EEF9]">
              <div>
                <span className="text-[11px] font-bold text-[#5B4DF5] block uppercase tracking-wider">
                  Withdrawal Request Details
                </span>
                <h4 className="text-base sm:text-lg font-black text-[#0F172A] mt-0.5">
                  ₦{selectedRequest.amount.toLocaleString()} NGN
                </h4>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 ${
                selectedRequest.status === 'pending'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {selectedRequest.status === 'pending' ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{selectedRequest.status === 'pending' ? 'Pending' : 'Confirmed'}</span>
              </span>
            </div>

            {/* Details Breakdown Grid */}
            <div className="bg-[#FAF8FE] border border-[#EDE9FE] rounded-2xl p-4 space-y-3 text-xs">
              {/* Customer Name */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-[#5B4DF5]" />
                  <span>Customer Name:</span>
                </span>
                <span className="font-black text-[#0F172A] text-right">
                  {selectedRequest.userName || 'Customer'}
                </span>
              </div>

              {/* Account Name */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Account Name:</span>
                </span>
                <span className="font-black text-emerald-700 uppercase tracking-tight text-right">
                  {selectedRequest.accountName}
                </span>
              </div>

              {/* Bank */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#5B4DF5]" />
                  <span>Bank:</span>
                </span>
                <span className="font-bold text-[#0F172A] text-right">
                  {selectedRequest.bankName}
                </span>
              </div>

              {/* Account Number */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#5B4DF5]" />
                  <span>Account Number:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-sm text-[#0F172A]">
                    {selectedRequest.accountNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(selectedRequest.accountNumber, `dtl-acc-${selectedRequest.id}`)}
                    className="p-1 rounded text-[#5B4DF5] hover:bg-[#EDE9FE] transition cursor-pointer"
                    title="Copy Account Number"
                  >
                    {copiedKey === `dtl-acc-${selectedRequest.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Withdrawal Amount */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold">Withdrawal Amount:</span>
                <span className="text-sm font-black text-emerald-600">
                  ₦{selectedRequest.amount.toLocaleString()} NGN
                </span>
              </div>

              {/* Transaction ID */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold">Transaction ID:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-xs text-[#5B4DF5]">
                    {selectedRequest.transactionId || selectedRequest.reference || selectedRequest.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(selectedRequest.transactionId || selectedRequest.reference || selectedRequest.id, `dtl-tx-${selectedRequest.id}`)}
                    className="p-1 rounded text-[#5B4DF5] hover:bg-[#EDE9FE] transition cursor-pointer"
                    title="Copy Transaction ID"
                  >
                    {copiedKey === `dtl-tx-${selectedRequest.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Date */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Date:</span>
                </span>
                <span className="font-bold text-[#0F172A]">{selectedRequest.createdDate}</span>
              </div>

              {/* Time */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Time:</span>
                </span>
                <span className="font-bold text-[#0F172A]">{selectedRequest.createdTime}</span>
              </div>

              {/* Current Status */}
              <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                <span className="text-[#64748B] font-semibold">Current Status:</span>
                <span className={`font-black uppercase text-[11px] ${
                  selectedRequest.status === 'pending' ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  {selectedRequest.status === 'pending' ? 'Pending' : 'Confirmed'}
                </span>
              </div>

              {/* Customer Email */}
              {selectedRequest.userEmail && (
                <div className="flex justify-between items-center py-1 border-b border-[#F1EEF9]">
                  <span className="text-[#64748B] font-semibold">Customer Email:</span>
                  <span className="font-medium text-[#0F172A]">{selectedRequest.userEmail}</span>
                </div>
              )}

              {/* Customer Note */}
              {selectedRequest.notes && (
                <div className="py-1">
                  <span className="text-[#64748B] font-semibold block mb-1">Customer Memo:</span>
                  <p className="text-[#0F172A] bg-white p-2.5 rounded-xl border border-[#EDE9FE] font-medium">
                    {selectedRequest.notes}
                  </p>
                </div>
              )}

              {/* Admin Memo */}
              {selectedRequest.adminNotes && (
                <div className="py-1">
                  <span className="text-[#64748B] font-semibold block mb-1">Admin Memo:</span>
                  <p className="text-[#0F172A] bg-white p-2.5 rounded-xl border border-[#EDE9FE] font-medium">
                    {selectedRequest.adminNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Payment Section */}
            {selectedRequest.status === 'pending' ? (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="space-y-1">
                  <h5 className="text-xs font-black text-amber-900">
                    Step 2: Confirm After Manual Bank Transfer
                  </h5>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Transfer <strong>₦{selectedRequest.amount.toLocaleString()}</strong> to <strong>{selectedRequest.accountName}</strong> ({selectedRequest.bankName} - {selectedRequest.accountNumber}). Once you have transferred the funds, click Confirm Payment below.
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Optional transfer reference or memo"
                  value={adminMemo[selectedRequest.id] || ''}
                  onChange={(e) =>
                    setAdminMemo((prev) => ({ ...prev, [selectedRequest.id]: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6F8] bg-white text-xs text-[#0F172A] outline-none focus:border-[#5B4DF5]"
                />

                <button
                  type="button"
                  disabled={confirmingId === selectedRequest.id}
                  onClick={() => handleConfirmPayment(selectedRequest)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {confirmingId === selectedRequest.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Confirming Payment in Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Payment</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Payment Confirmed. Customer status updated to Confirmed.</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedRequest(null)}
              className="w-full py-2.5 rounded-xl border border-[#EAE6F8] bg-[#FAF8FE] hover:bg-[#F3EEFF] text-[#0F172A] font-extrabold text-xs transition cursor-pointer"
            >
              Back to Notifications List
            </button>
          </div>
        ) : (
          /* ============================================================== */
          /* VIEW B: NORMAL NOTIFICATION INBOX LIST                         */
          /* ============================================================== */
          <>
            {/* Compact Filter Tabs */}
            {/* Fixed 3-Column Tabs Row (Never scrolls sideways, always fixed in one horizontal row) */}
            <div className="grid grid-cols-3 w-full border-b border-[#F1EEF9] bg-[#FAF8FE] px-1 sm:px-2 py-1.5 shrink-0 gap-1 select-none">
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`py-1.5 px-0.5 rounded-xl font-black transition flex items-center justify-center gap-1 cursor-pointer text-center text-[10px] sm:text-xs leading-tight ${
                  filter === 'pending'
                    ? 'bg-[#EDE9FE] text-[#5B4DF5] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100/60'
                }`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span className="leading-tight">Pending Payment ({pendingRequests.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilter('confirmed')}
                className={`py-1.5 px-0.5 rounded-xl font-black transition flex items-center justify-center gap-1 cursor-pointer text-center text-[10px] sm:text-xs leading-tight ${
                  filter === 'confirmed'
                    ? 'bg-emerald-50 text-emerald-700 shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100/60'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="leading-tight">Confirmed Paid ({confirmedRequests.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`py-1.5 px-0.5 rounded-xl font-black transition flex items-center justify-center gap-1 cursor-pointer text-center text-[10px] sm:text-xs leading-tight ${
                  filter === 'all'
                    ? 'bg-slate-200 text-[#0F172A] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100/60'
                }`}
              >
                <span className="leading-tight">All Requests ({requests.length})</span>
              </button>
            </div>

            {/* Notification Inbox List */}
            <div className="p-3.5 sm:p-4 overflow-y-auto overscroll-contain touch-pan-y space-y-2 flex-1 min-h-0 pb-28 md:pb-6">
              {loading ? (
                <div className="py-14 text-center text-xs text-[#64748B] font-semibold space-y-2">
                  <div className="w-6 h-6 border-2 border-[#5B4DF5]/20 border-t-[#5B4DF5] rounded-full animate-spin mx-auto"></div>
                  <p>Loading notifications...</p>
                </div>
              ) : displayedRequests.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#FAF8FE] text-[#94A3B8] flex items-center justify-center mx-auto border border-[#EDE9FE]">
                    <span className="text-lg">🔔</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                    {filter === 'pending'
                      ? 'No pending withdrawal notifications'
                      : filter === 'confirmed'
                      ? 'No confirmed notifications yet'
                      : 'No notifications found'}
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    {filter === 'pending'
                      ? 'When a customer requests a withdrawal, it will appear here.'
                      : 'Withdrawal records will appear here as they are processed.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    const customerName = req.userName || (req.userEmail ? req.userEmail.split('@')[0] : 'Customer');
                    const relativeTime = formatNotificationTime(req.createdAt, req.createdDate, req.createdTime);

                    return (
                      <div
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className={`p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 hover:shadow-xs active:scale-[0.99] ${
                          isPending
                            ? 'bg-amber-50/50 border-amber-200/90 hover:bg-amber-50'
                            : 'bg-white border-[#EAE6F8] hover:bg-[#FAF8FE]'
                        }`}
                      >
                        {/* Notification Status Icon */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isPending ? <Clock className="w-4 h-4 stroke-[2.4]" /> : <CheckCircle2 className="w-4 h-4 stroke-[2.4]" />}
                        </div>

                        {/* Short Inbox Preview (Does NOT show full account number) */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="text-xs sm:text-sm font-black text-[#0F172A] truncate">
                              {isPending ? 'New Withdrawal Request' : 'Withdrawal Request Confirmed'}
                            </h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                              isPending ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {isPending ? 'Pending' : 'Confirmed'}
                            </span>
                          </div>

                          <p className="text-xs text-[#334155] font-semibold mt-1 leading-snug">
                            <span className="font-extrabold text-[#0F172A]">{customerName}</span> requested a withdrawal of <span className="font-black text-emerald-600">₦{req.amount.toLocaleString()}</span>.
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5">
                            <span className="font-medium">
                              {relativeTime} • {isPending ? 'Pending' : 'Confirmed'}
                            </span>
                            <span className="text-[#5B4DF5] font-extrabold flex items-center gap-0.5 text-[11px]">
                              <span>View Details</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
