import React, { useState, useEffect } from 'react';
import { Copy, Eye, EyeOff, Check, Key, ShieldCheck, FileText, Smartphone, Mail, User, Lock, Layers, HelpCircle, CheckCircle2 } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AccountCredentialsCardProps {
  email?: string;
  password?: string;
  recoveryInfo?: string;
  twoFactorSecret?: string;
  backupCodes?: string;
  instructions?: string;
  className?: string;
  credentials?: Record<string, any> | null;
  details?: Record<string, any> | null;
  listingId?: string;
  purchaseId?: string;
}

interface CredentialField {
  key: string;
  label: string;
  value: string;
  isPassword?: boolean;
  isMultiLine?: boolean;
  icon?: React.ReactNode;
}

export default function AccountCredentialsCard({
  email: propEmail = '',
  password: propPassword = '',
  recoveryInfo: propRecoveryInfo = '',
  twoFactorSecret: propTwoFactorSecret = '',
  backupCodes: propBackupCodes = '',
  instructions: propInstructions = '',
  className = '',
  credentials,
  details,
  listingId,
  purchaseId
}: AccountCredentialsCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [supplementalDetails, setSupplementalDetails] = useState<Record<string, any>>({});

  // Fetch complete listing/inventory credentials if existing purchase had incomplete fields
  useEffect(() => {
    if (!listingId || !db) return;

    let isMounted = true;
    const loadOriginalListingDetails = async () => {
      try {
        const listingSnap = await getDoc(doc(db, 'listings', listingId));
        if (!listingSnap.exists() || !isMounted) return;

        const lData = listingSnap.data();
        let matchedItem: Record<string, any> | null = null;

        const effectiveCreds = credentials || details || {};
        const targetInventoryId = effectiveCreds.inventoryId;
        const targetEmail = (effectiveCreds.accountEmail || effectiveCreds.email || propEmail || '').toLowerCase().trim();

        if (Array.isArray(lData.inventory)) {
          if (targetInventoryId) {
            matchedItem = lData.inventory.find((item: any) => item.id === targetInventoryId) || null;
          }
          if (!matchedItem && purchaseId) {
            matchedItem = lData.inventory.find((item: any) => item.orderId === purchaseId) || null;
          }
          if (!matchedItem && targetEmail) {
            matchedItem = lData.inventory.find((item: any) => (item.accountEmail || item.email || '').toLowerCase().trim() === targetEmail) || null;
          }
        }

        if (!matchedItem && lData.digitalProductDetails) {
          matchedItem = lData.digitalProductDetails;
        }

        if (matchedItem && isMounted) {
          setSupplementalDetails(matchedItem);
        }
      } catch (err) {
        console.warn('Notice loading supplemental credentials:', err);
      }
    };

    loadOriginalListingDetails();
    return () => {
      isMounted = false;
    };
  }, [listingId, purchaseId, credentials, details, propEmail]);

  // Combine all data sources (props, passed credentials, and supplemental details)
  const combined: Record<string, any> = {
    ...supplementalDetails,
    ...(details || {}),
    ...(credentials || {})
  };

  if (propEmail) combined.propEmail = propEmail;
  if (propPassword) combined.propPassword = propPassword;
  if (propRecoveryInfo) combined.propRecoveryInfo = propRecoveryInfo;
  if (propTwoFactorSecret) combined.propTwoFactorSecret = propTwoFactorSecret;
  if (propBackupCodes) combined.propBackupCodes = propBackupCodes;
  if (propInstructions) combined.propInstructions = propInstructions;

  // Extract explicit fields
  const emailVal = (combined.accountEmail || combined.email || combined.propEmail || '').toString().trim();
  const passwordVal = (combined.accountPassword || combined.password || combined.propPassword || '').toString().trim();
  const usernameVal = (combined.username || combined.accountUsername || combined.loginUsername || combined.user || '').toString().trim();
  const recoveryEmailVal = (combined.recoveryEmail || combined.recovery_email || '').toString().trim();
  const phoneVal = (combined.phoneNumber || combined.phone || combined.tel || '').toString().trim();
  const twoFactorVal = (combined.twoFactorSecretKey || combined.twoFactorSecret || combined.twoFactor || combined.totp || combined['2fa'] || combined.secretKey || combined.propTwoFactorSecret || '').toString().trim();
  const backupCodesVal = (combined.backupCodes || combined.twoFactorBackupCodes || combined.backupCode || combined.backup_codes || combined.propBackupCodes || '').toString().trim();
  const recoveryInfoVal = (combined.recoveryInfo || combined.recovery || combined.notes || combined.propRecoveryInfo || '').toString().trim();
  const deliveryValueVal = (combined.delivery_value || combined.deliveryValue || combined.deliveryCode || combined.code || '').toString().trim();
  const instructionsVal = (combined.additionalInstructions || combined.instructions || combined.propInstructions || '').toString().trim();

  // Helper to test if two values are practically identical to avoid redundant duplicates
  const isDuplicateOf = (val: string, otherVals: string[]) => {
    if (!val) return true;
    return otherVals.some(o => o && o.toLowerCase().trim() === val.toLowerCase().trim());
  };

  const fields: CredentialField[] = [];

  // 1. Email
  if (emailVal) {
    fields.push({
      key: 'email',
      label: usernameVal ? 'Login Email' : 'Login Email / Username',
      value: emailVal,
      icon: <Mail className="w-4 h-4 text-[#5B4DF5]" />
    });
  }

  // 2. Username (if configured and distinct from email)
  if (usernameVal && !isDuplicateOf(usernameVal, [emailVal])) {
    fields.push({
      key: 'username',
      label: 'Username',
      value: usernameVal,
      icon: <User className="w-4 h-4 text-[#5B4DF5]" />
    });
  }

  // 3. Password
  if (passwordVal) {
    fields.push({
      key: 'password',
      label: 'Account Password',
      value: passwordVal,
      isPassword: true,
      icon: <Lock className="w-4 h-4 text-[#5B4DF5]" />
    });
  }

  // 4. Recovery Email
  if (recoveryEmailVal && !isDuplicateOf(recoveryEmailVal, [emailVal])) {
    fields.push({
      key: 'recoveryEmail',
      label: 'Recovery Email',
      value: recoveryEmailVal,
      icon: <Mail className="w-4 h-4 text-emerald-600" />
    });
  }

  // 5. 2FA Secret Key
  if (twoFactorVal) {
    fields.push({
      key: 'twoFactorSecretKey',
      label: '2FA Secret Key / Authenticator Code',
      value: twoFactorVal,
      isPassword: true,
      icon: <ShieldCheck className="w-4 h-4 text-purple-600" />
    });
  }

  // 6. Phone Number
  if (phoneVal) {
    fields.push({
      key: 'phoneNumber',
      label: 'Phone Number',
      value: phoneVal,
      icon: <Smartphone className="w-4 h-4 text-sky-600" />
    });
  }

  // 7. Backup Codes
  if (backupCodesVal && !isDuplicateOf(backupCodesVal, [twoFactorVal])) {
    fields.push({
      key: 'backupCodes',
      label: '2FA Backup Codes',
      value: backupCodesVal,
      isMultiLine: backupCodesVal.includes('\n') || backupCodesVal.length > 30,
      icon: <Layers className="w-4 h-4 text-amber-600" />
    });
  }

  // 8. Recovery Info / Notes (if distinct from recoveryEmail and 2FA and phone)
  if (recoveryInfoVal && !isDuplicateOf(recoveryInfoVal, [emailVal, recoveryEmailVal, twoFactorVal, backupCodesVal, phoneVal])) {
    fields.push({
      key: 'recoveryInfo',
      label: 'Recovery Info / Notes',
      value: recoveryInfoVal,
      isMultiLine: recoveryInfoVal.length > 50,
      icon: <HelpCircle className="w-4 h-4 text-indigo-600" />
    });
  }

  // 9. Delivery Value / Raw line (if distinct from email and password)
  if (deliveryValueVal && !isDuplicateOf(deliveryValueVal, [emailVal, passwordVal, `${emailVal} | ${passwordVal}`])) {
    fields.push({
      key: 'delivery_value',
      label: 'Original Delivery Stock Line',
      value: deliveryValueVal,
      isMultiLine: deliveryValueVal.length > 50,
      icon: <Key className="w-4 h-4 text-[#5B4DF5]" />
    });
  }

  // 10. Any other configured login detail field present in the LOG product data
  const excludedKeys = new Set([
    'id', 'inventoryId', 'status', 'soldTo', 'soldToEmail', 'soldAt', 'orderId',
    'updatedAt', 'createdAt', 'buyerId', 'sellerId', 'price', 'currency', 'type',
    '__v', 'listingId', 'purchaseId', 'propEmail', 'propPassword', 'propRecoveryInfo',
    'propTwoFactorSecret', 'propBackupCodes', 'propInstructions', 'accountEmail',
    'email', 'accountPassword', 'password', 'username', 'accountUsername', 'loginUsername',
    'user', 'recoveryEmail', 'recovery_email', 'phoneNumber', 'phone', 'tel',
    'twoFactorSecretKey', 'twoFactorSecret', 'twoFactor', 'totp', '2fa', 'secretKey',
    'backupCodes', 'twoFactorBackupCodes', 'backupCode', 'backup_codes', 'recoveryInfo',
    'recovery', 'notes', 'delivery_value', 'deliveryValue', 'deliveryCode', 'code',
    'additionalInstructions', 'instructions'
  ]);

  Object.entries(combined).forEach(([rawKey, val]) => {
    if (excludedKeys.has(rawKey)) return;
    if (val === null || val === undefined) return;
    const strVal = String(val).trim();
    if (!strVal || strVal === 'null' || strVal === 'undefined') return;

    // Format raw key into clean readable title without unnecessary renaming
    const cleanLabel = rawKey
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, char => char.toUpperCase());

    const isSecret = rawKey.toLowerCase().includes('password') || rawKey.toLowerCase().includes('pass') || rawKey.toLowerCase().includes('secret') || rawKey.toLowerCase().includes('pin');

    fields.push({
      key: rawKey,
      label: cleanLabel,
      value: strVal,
      isPassword: isSecret,
      isMultiLine: strVal.length > 50 || strVal.includes('\n'),
      icon: <Key className="w-4 h-4 text-[#5B4DF5]" />
    });
  });

  // Copy individual field
  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    copyToClipboard(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Copy all credentials at once
  const handleCopyAll = () => {
    const lines: string[] = [];
    fields.forEach(f => {
      lines.push(`${f.label}: ${f.value}`);
    });
    if (instructionsVal) {
      lines.push(`Additional Instructions:\n${instructionsVal}`);
    }
    if (lines.length > 0) {
      copyToClipboard(lines.join('\n'));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  return (
    <div className={`w-full max-w-lg mx-auto p-5 sm:p-6 rounded-3xl bg-white border border-[#EBE7F7] shadow-lg text-[#0F172A] font-sans ${className}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#EBE7F7]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F8F7FD] border border-[#EBE7F7] text-[#5B4DF5] flex items-center justify-center shrink-0 shadow-xs">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#0F172A] tracking-tight">Purchased LOG Login Details</h3>
            <p className="text-xs text-[#64748B]">All configured account credentials and access details</p>
          </div>
        </div>

        {/* Copy All Button */}
        {fields.length > 0 && (
          <button
            type="button"
            onClick={handleCopyAll}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-full flex items-center gap-1.5 transition cursor-pointer border shrink-0 ${
              copiedAll
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-[#F8F7FD] text-[#5B4DF5] border-[#EBE7F7] hover:bg-[#F1F0FB]'
            }`}
            title="Copy all details to clipboard"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span>All Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#5B4DF5]" />
                <span>Copy All</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Login Details Fields */}
      <div className="space-y-4">
        {fields.length === 0 ? (
          <div className="p-4 bg-[#F8F7FD] border border-[#EBE7F7] rounded-2xl text-center text-xs text-[#64748B]">
            No login credentials provided for this item.
          </div>
        ) : (
          fields.map((field) => {
            const isPasswordField = field.isPassword && field.key === 'password';
            const is2FASecret = field.isPassword && field.key === 'twoFactorSecretKey';
            const isMasked = isPasswordField ? !showPassword : is2FASecret ? !showSecretKey : false;
            const isCopied = copiedField === field.key;

            return (
              <div key={field.key}>
                <label className="block text-xs font-bold text-[#64748B] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  {field.icon}
                  <span>{field.label}</span>
                </label>

                {field.isMultiLine ? (
                  <div className="relative">
                    <pre className="w-full bg-[#F8F7FD] border border-[#EBE7F7] hover:border-[#5B4DF5]/40 rounded-2xl p-3.5 text-xs font-mono font-bold text-[#0F172A] whitespace-pre-wrap break-all leading-relaxed shadow-xs pr-12">
                      {field.value}
                    </pre>
                    <button
                      type="button"
                      onClick={() => handleCopy(field.value, field.key)}
                      className={`absolute top-2.5 right-2.5 p-1.5 rounded-xl border transition cursor-pointer ${
                        isCopied
                          ? 'bg-purple-100 border-purple-300 text-[#5B4DF5]'
                          : 'bg-white hover:bg-[#F8F7FD] border-[#EBE7F7] text-[#5B4DF5]'
                      }`}
                      title={`Copy ${field.label}`}
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-600 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="relative flex items-center">
                    <input
                      type={isMasked ? 'password' : 'text'}
                      readOnly
                      value={field.value}
                      className="w-full bg-[#F8F7FD] border border-[#EBE7F7] hover:border-[#5B4DF5]/40 focus:border-[#5B4DF5] focus:bg-white rounded-2xl px-4 py-2.5 text-sm font-mono font-bold text-[#0F172A] focus:outline-none transition pr-22"
                    />

                    <div className="absolute right-2 flex items-center space-x-1">
                      {(isPasswordField || is2FASecret) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPasswordField) setShowPassword(!showPassword);
                            if (is2FASecret) setShowSecretKey(!showSecretKey);
                          }}
                          className="p-1.5 rounded-xl bg-white hover:bg-[#F8F7FD] border border-[#EBE7F7] text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                          title={isMasked ? 'Show' : 'Hide'}
                        >
                          {isMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopy(field.value, field.key)}
                        className={`p-1.5 rounded-xl border transition cursor-pointer ${
                          isCopied
                            ? 'bg-purple-100 border-purple-300 text-[#5B4DF5]'
                            : 'bg-white hover:bg-[#F8F7FD] border-[#EBE7F7] text-[#5B4DF5]'
                        }`}
                        title={`Copy ${field.label}`}
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-600 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Special Instructions (if present) */}
        {instructionsVal && (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#5B4DF5] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#5B4DF5]" />
                <span>Special Transfer / Login Instructions</span>
              </label>
              <button
                type="button"
                onClick={() => handleCopy(instructionsVal, 'instructions')}
                className={`text-[11px] px-2 py-0.5 rounded-lg border font-bold transition cursor-pointer flex items-center gap-1 ${
                  copiedField === 'instructions'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white text-[#5B4DF5] border-[#EBE7F7] hover:bg-[#F8F7FD]'
                }`}
              >
                {copiedField === 'instructions' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'instructions' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="bg-[#F8F7FD] border border-[#EBE7F7] rounded-2xl p-4 text-xs font-medium text-[#0F172A] whitespace-pre-wrap leading-relaxed shadow-xs">
              {instructionsVal}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
