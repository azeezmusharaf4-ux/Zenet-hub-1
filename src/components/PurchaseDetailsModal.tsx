import React, { useState } from 'react';
import { PurchaseRecord } from '../types';
import { 
  X, 
  ShieldCheck, 
  ShoppingBag, 
  Key, 
  Copy, 
  Check,
  CheckCircle2, 
  MessageSquare, 
  FileText, 
  AlertTriangle, 
  User, 
  Phone, 
  Send, 
  Clock, 
  Sparkles,
  ExternalLink,
  Lock,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';

interface PurchaseDetailsModalProps {
  purchase: PurchaseRecord | null;
  onClose: () => void;
  onOpenDispute?: (purchase: PurchaseRecord) => void;
  onContactSeller?: (sellerId: string, sellerName: string) => void;
}

export const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({
  purchase,
  onClose,
  onOpenDispute,
  onContactSeller
}) => {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!purchase) return null;

  const credentials = purchase.digitalProductDetails;

  const handleCopyEmail = () => {
    if (credentials?.accountEmail) {
      navigator.clipboard.writeText(credentials.accountEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleCopyPassword = () => {
    if (credentials?.accountPassword) {
      navigator.clipboard.writeText(credentials.accountPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleCopySecretKey = () => {
    const key = credentials?.twoFactorSecretKey;
    if (key) {
      navigator.clipboard.writeText(key);
      setCopiedSecretKey(true);
      setTimeout(() => setCopiedSecretKey(false), 2000);
    }
  };

  const handleCopyBackupCodes = () => {
    const codes = credentials?.twoFactorBackupCodes || credentials?.backupCodes;
    if (codes) {
      navigator.clipboard.writeText(codes);
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    }
  };

  const handleCopyToken = () => {
    if (purchase.transferCode) {
      navigator.clipboard.writeText(purchase.transferCode);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleCopyRef = () => {
    if (purchase.transactionId) {
      navigator.clipboard.writeText(purchase.transactionId);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const formattedDate = new Date(purchase.purchasedAt).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#05020d]/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#120826] border border-[#2e1954] rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-purple-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0c051a] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#241344] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-purple-600 p-0.5 shadow-md">
              <div className="w-full h-full bg-[#0c051a] rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base sm:text-lg">Escrow Order Details</h3>
                <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Verified Purchase
                </span>
              </div>
              <p className="text-xs text-purple-300/60 font-mono">ID: {purchase.id.slice(0, 12)}...</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-purple-300 hover:text-white bg-[#1a0e33] border border-[#2e1850] rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          
          {/* Status Banner */}
          <div className="bg-gradient-to-r from-emerald-950/80 via-[#160c30] to-purple-950/80 border border-emerald-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">Escrow Protection Status</span>
              <h4 className="font-extrabold text-white text-base">
                {purchase.status === 'completed' ? 'Escrow Released to Seller' : 'Funds Safely Held in Escrow Vault'}
              </h4>
              <p className="text-xs text-purple-200/80">
                You have 7 days of full escrow warranty. Seller will not receive payout until verification completes.
              </p>
            </div>
            <div className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-extrabold text-xs px-3.5 py-1.5 rounded-xl shrink-0">
              7-Day Escrow Guarantee
            </div>
          </div>

          {/* Account Details Box */}
          <div className="bg-[#170c30] border border-[#2d1952] p-5 rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center justify-between text-xs text-purple-300/70 pb-2 border-b border-[#281548]">
              <span className="font-bold uppercase text-purple-400">{purchase.category} Account</span>
              <span className="font-mono">{formattedDate}</span>
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-white leading-snug">{purchase.listingTitle}</h4>
              <p className="text-xs text-purple-300/80">
                Purchased via <strong className="text-purple-100 uppercase">{purchase.paymentGateway || 'Paystack'} Gateway</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-[#100722] p-3 rounded-xl border border-[#271348]">
                <span className="text-[10px] uppercase text-purple-300/60 font-bold block">Amount Paid</span>
                <span className="text-base font-black text-white font-mono">
                  {purchase.currency || 'USD'} {Number(purchase.paidAmount || purchase.price).toLocaleString()}
                </span>
              </div>

              <div className="bg-[#100722] p-3 rounded-xl border border-[#271348]">
                <span className="text-[10px] uppercase text-purple-300/60 font-bold block">Price in NGN</span>
                <span className="text-base font-black text-white font-mono">
                  ₦{purchase.price ? purchase.price.toLocaleString() : 'N/A'}
                </span>
              </div>

              <div className="bg-[#100722] p-3 rounded-xl border border-[#271348] col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase text-purple-300/60 font-bold block">Warranty Window</span>
                <span className="text-xs font-extrabold text-emerald-400 block pt-0.5">Active (7 Days)</span>
              </div>
            </div>
          </div>

          {/* Delivered Account Credentials & 2FA Information */}
          {credentials && (credentials.accountEmail || credentials.accountPassword || credentials.twoFactorSecretKey || credentials.twoFactorBackupCodes || credentials.backupCodes) && (
            <div className="bg-[#180938] border border-emerald-500/40 p-5 rounded-2xl space-y-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                      Delivered Login Credentials
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        Released
                      </span>
                    </h4>
                    <p className="text-[11px] text-purple-200/70">
                      Your purchased credentials & security keys. Store them in a safe place.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {credentials.accountEmail && (
                  <div className="bg-[#100624] p-3 rounded-xl border border-[#2e1554] space-y-1">
                    <span className="text-[10px] uppercase font-bold text-purple-300/70 block">Login Email / Username</span>
                    <div className="flex items-center justify-between gap-2">
                      <code className="font-mono font-bold text-white text-xs sm:text-sm select-all truncate">{credentials.accountEmail}</code>
                      <button
                        onClick={handleCopyEmail}
                        className="p-1.5 text-purple-300 hover:text-white bg-[#1e0e3a] hover:bg-[#2c1554] rounded-lg transition cursor-pointer shrink-0"
                        title="Copy Username"
                      >
                        {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {credentials.accountPassword && (
                  <div className="bg-[#100624] p-3 rounded-xl border border-[#2e1554] space-y-1">
                    <span className="text-[10px] uppercase font-bold text-purple-300/70 block">Account Password</span>
                    <div className="flex items-center justify-between gap-2">
                      <code className="font-mono font-bold text-white text-xs sm:text-sm select-all truncate">
                        {showPassword ? credentials.accountPassword : '••••••••••••'}
                      </code>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 text-purple-300 hover:text-white bg-[#1e0e3a] hover:bg-[#2c1554] rounded-lg transition cursor-pointer"
                          title={showPassword ? 'Hide Password' : 'Show Password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={handleCopyPassword}
                          className="p-1.5 text-purple-300 hover:text-white bg-[#1e0e3a] hover:bg-[#2c1554] rounded-lg transition cursor-pointer"
                          title="Copy Password"
                        >
                          {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {(credentials.twoFactorSecretKey || credentials.twoFactorBackupCodes || credentials.backupCodes || credentials.recoveryInfo) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  {credentials.recoveryInfo && (
                    <div className="bg-[#100624] p-3 rounded-xl border border-[#2e1554] space-y-1">
                      <span className="text-[10px] uppercase font-bold text-purple-300/70 block">Recovery Info</span>
                      <p className="font-mono text-purple-100 text-xs break-all">{credentials.recoveryInfo}</p>
                    </div>
                  )}

                  {credentials.twoFactorSecretKey && (
                    <div className="bg-[#100624] p-3 rounded-xl border border-amber-500/30 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-amber-300/90 block">2FA Authenticator Secret Key</span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono font-bold text-amber-200 text-xs break-all select-all">{credentials.twoFactorSecretKey}</code>
                        <button
                          onClick={handleCopySecretKey}
                          className="p-1.5 text-amber-300 hover:text-white bg-[#2a174a] hover:bg-[#381f63] rounded-lg transition cursor-pointer shrink-0"
                          title="Copy 2FA Secret Key"
                        >
                          {copiedSecretKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {(credentials.twoFactorBackupCodes || credentials.backupCodes) && (
                    <div className="bg-[#100624] p-3 rounded-xl border border-purple-500/30 space-y-1 col-span-1 sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-purple-300/70 block">2FA Backup Codes</span>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-purple-100 text-xs break-all whitespace-pre-wrap">{credentials.twoFactorBackupCodes || credentials.backupCodes}</p>
                        <button
                          onClick={handleCopyBackupCodes}
                          className="p-1.5 text-purple-300 hover:text-white bg-[#1e0e3a] hover:bg-[#2c1554] rounded-lg transition cursor-pointer shrink-0"
                          title="Copy 2FA Backup Codes"
                        >
                          {copiedBackupCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {credentials.additionalInstructions && (
                <div className="bg-[#100624] p-3 rounded-xl border border-[#2e1554] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-purple-300/70 block">Seller Takeover Instructions</span>
                  <p className="text-xs text-purple-200/90 leading-relaxed whitespace-pre-wrap">{credentials.additionalInstructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Escrow Release / Credentials Transfer Token */}
          {purchase.transferCode && (
            <div className="bg-[#1f103d] border border-amber-500/40 p-4 rounded-2xl space-y-3 shadow-lg">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-300 shrink-0" />
                <h4 className="font-extrabold text-white text-sm">Escrow Verification & Credentials Release Token</h4>
              </div>

              <p className="text-xs text-purple-200/80 leading-relaxed">
                Provide this unique token to the seller or paste it into the verification portal once you confirm access to the transferred account.
              </p>

              <div className="bg-[#0e071e] p-3 rounded-xl border border-[#371d64] flex items-center justify-between gap-3">
                <code className="text-amber-300 font-mono font-black text-base sm:text-lg tracking-wider">
                  {purchase.transferCode}
                </code>

                <button
                  onClick={handleCopyToken}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedToken ? 'Copied!' : 'Copy Token'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Transaction Reference & Seller Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Seller Info */}
            <div className="bg-[#170c30] border border-[#2d1952] p-4 rounded-2xl space-y-2.5">
              <span className="text-[10px] font-bold uppercase text-purple-300/60 block">Verified Seller</span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                  {purchase.sellerName.charAt(0)}
                </div>
                <div>
                  <h5 className="font-extrabold text-white text-sm">{purchase.sellerName}</h5>
                  <p className="text-xs text-purple-300/70 font-mono truncate">{purchase.sellerEmail || 'Verified Merchant'}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  if (onContactSeller) onContactSeller(purchase.sellerId, purchase.sellerName);
                }}
                className="w-full bg-[#241348] hover:bg-[#321a63] text-purple-200 border border-[#40227d] text-xs font-bold py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <span>Message Seller</span>
              </button>
            </div>

            {/* Transaction Ref */}
            <div className="bg-[#170c30] border border-[#2d1952] p-4 rounded-2xl space-y-2.5">
              <span className="text-[10px] font-bold uppercase text-purple-300/60 block">Payment Audit Trail</span>
              <div className="space-y-1">
                <span className="text-xs text-purple-300/80 block">Transaction Reference:</span>
                <code className="text-xs font-mono font-bold text-white block truncate bg-[#100722] p-2 rounded-lg border border-[#291648]">
                  {purchase.transactionId || 'ZENET-ESCROW-TX-99042'}
                </code>
              </div>

              <button
                onClick={handleCopyRef}
                className="w-full bg-[#1b0d38] hover:bg-[#27134f] text-purple-300 border border-[#351a66] text-xs font-bold py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <Copy className="w-3.5 h-3.5 text-purple-400" />
                <span>{copiedRef ? 'Reference Copied!' : 'Copy Transaction Ref'}</span>
              </button>
            </div>

          </div>

          {/* Action Footer */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#241344]">
            <button
              onClick={() => alert(`Official ZENET Receipt for Order #${purchase.id.slice(0, 8)} downloaded!`)}
              className="bg-[#1f103e] hover:bg-[#2c1757] text-purple-200 border border-[#3f227a] font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-purple-400" />
              <span>Download Invoice / Receipt</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onOpenDispute) onOpenDispute(purchase);
                else alert('Dispute form opened. Our escrow moderators will review your claim within 1 hour.');
              }}
              className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Report Issue / Open Escrow Dispute</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
