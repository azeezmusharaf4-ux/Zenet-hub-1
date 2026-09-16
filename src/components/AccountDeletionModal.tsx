import React, { useState, useEffect } from 'react';
import { User, sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Trash2, AlertTriangle, CheckCircle2, Mail, Loader2, X, ExternalLink, ShieldCheck } from 'lucide-react';

interface AccountDeletionModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onDeletionComplete: () => void;
  verifyData?: { reqId: string; token: string } | null;
}

export const AccountDeletionModal: React.FC<AccountDeletionModalProps> = ({
  user,
  isOpen,
  onClose,
  onDeletionComplete,
  verifyData
}) => {
  const [step, setStep] = useState<'confirm' | 'sending' | 'sent' | 'verifying' | 'completed' | 'error'>('confirm');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifiedEmail, setVerifiedEmail] = useState(user?.email || '');

  // If verifyData is supplied (from email verification link in URL), trigger verification automatically
  useEffect(() => {
    if (verifyData && verifyData.reqId && verifyData.token) {
      handleVerifyAndExecute(verifyData.reqId, verifyData.token);
    }
  }, [verifyData]);

  // Handle countdown for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Step 1 -> Send verification link to connected email via secure backend
  const handleRequestDeletion = async () => {
    if (!user || !user.email) {
      setErrorMessage('No active user email detected. Please log in again.');
      setStep('error');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/account/request-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate account deletion request.');
      }

      // Also trigger native Firebase Auth verification email if possible
      try {
        if (auth.currentUser) {
          await sendEmailVerification(auth.currentUser, {
            url: data.confirmationUrl || window.location.origin,
            handleCodeInApp: true
          });
        }
      } catch (fbErr) {
        console.warn('Firebase Auth email verification dispatch note:', fbErr);
      }

      setVerifiedEmail(data.email || user.email);
      setStep('sent');
      setResendCooldown(60);
    } catch (err: any) {
      console.error('Account deletion request failed:', err);
      setErrorMessage(err.message || 'An error occurred while requesting account deletion.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Verify token and automatically execute permanent deletion
  const handleVerifyAndExecute = async (reqId: string, token: string) => {
    setStep('verifying');
    setLoading(true);
    setErrorMessage('');

    try {
      // Step A: Verify single-use token on backend
      const verifyRes = await fetch('/api/account/verify-deletion-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reqId, token })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Verification failed. The link may have expired or is invalid.');
      }

      setVerifiedEmail(verifyData.email || '');

      // Step B: Automatically execute deletion
      const executeRes = await fetch('/api/account/execute-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reqId, token })
      });

      const executeData = await executeRes.json();
      if (!executeRes.ok || !executeData.success) {
        throw new Error(executeData.error || 'Failed to complete permanent account deletion.');
      }

      // Step C: Delete Firebase Auth user if currently logged in
      try {
        if (auth.currentUser) {
          await auth.currentUser.delete();
        }
      } catch (fbErr) {
        console.warn('Firebase Auth client delete note (auth session will be invalidated):', fbErr);
      }

      setStep('completed');
      onDeletionComplete();
    } catch (err: any) {
      console.error('Verification and execution error:', err);
      setErrorMessage(err.message || 'Verification failed or expired. Your account was NOT deleted.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-purple-100 shadow-2xl space-y-5 text-slate-900">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-purple-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              step === 'completed'
                ? 'bg-purple-50 border border-purple-200 text-purple-600'
                : 'bg-purple-50 border border-purple-200 text-purple-600'
            }`}>
              {step === 'completed' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : step === 'sent' ? (
                <Mail className="w-5 h-5" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {step === 'completed'
                  ? 'Account Deleted'
                  : step === 'sent'
                  ? 'Verification Link Sent'
                  : step === 'verifying'
                  ? 'Verifying Email'
                  : 'Delete Account'}
              </h3>
              <p className="text-xs text-slate-500">
                {step === 'completed'
                  ? 'Permanent deletion confirmed'
                  : 'Security & identity verification'}
              </p>
            </div>
          </div>
          {step !== 'verifying' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* STEP 1: INITIAL CONFIRMATION & EXPLANATION */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80 flex items-start gap-3 text-slate-800 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 font-bold mb-1">Account deletion is permanent</strong>
                All your profile information, order history, active listings, wallet balances, and credentials will be permanently erased. This action cannot be reversed.
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Connected Account Email
              </label>
              <div className="p-3.5 rounded-2xl bg-purple-50/40 border border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {user?.email || 'No email attached'}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  Verified ID
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                To prevent accidental or unauthorized deletion, a secure, single-use confirmation link will be sent to this email address. You must verify the link to complete permanent deletion.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestDeletion}
                disabled={loading || !user?.email}
                className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Verification Link</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LINK DISPATCHED */}
        {step === 'sent' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto shadow-xs">
                <Mail className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900">Check Your Inbox</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                We sent a secure, single-use confirmation link to:
              </p>
              <p className="text-xs font-mono font-bold text-purple-900 bg-white/80 py-1.5 px-3 rounded-xl border border-purple-100 inline-block">
                {verifiedEmail}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
              <p className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                Security Safeguards:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>The verification link is single-use and valid for 15 minutes.</li>
                <li>Your passwords and credentials are never included in the link.</li>
                <li>If the link is not verified or expires, your account will NOT be deleted.</li>
              </ul>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleRequestDeletion}
                disabled={loading || resendCooldown > 0}
                className="w-full py-2.5 px-4 rounded-2xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {resendCooldown > 0 ? (
                  <span>Resend link in {resendCooldown}s</span>
                ) : (
                  <span>Resend Verification Link</span>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFYING IN PROGRESS */}
        {step === 'verifying' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900">Verifying Email Token</h4>
              <p className="text-xs text-slate-500">
                Validating one-time authorization and finalizing permanent deletion...
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: COMPLETED DELETION */}
        {step === 'completed' && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900">Account Permanently Deleted</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your ZENET account and all associated profile data have been permanently removed. You have been logged out.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shadow-md"
              >
                Return to Marketplace
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: ERROR OR EXPIRED TOKEN */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-purple-800 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-purple-600" />
                <span>Verification Failed or Expired</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {errorMessage || 'The verification link was invalid, already used, or expired.'}
              </p>
              <div className="mt-2 p-2.5 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-purple-900">
                🛡️ Security Protection: Because verification was not completed, your account was NOT deleted and remains fully active.
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
