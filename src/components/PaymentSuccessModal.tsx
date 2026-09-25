import React, { useState } from 'react';
import { PurchaseRecord } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  ShoppingBag, 
  Layers
} from 'lucide-react';

interface PaymentSuccessModalProps {
  order: PurchaseRecord | null;
  onClose: () => void;
  onOpenOrderHistory: () => void;
  onContactSeller?: (listing: any) => void;
}

// Internal fields that should never be shown as customer delivery fields
const INTERNAL_METADATA_KEYS = new Set([
  'id',
  'inventoryid',
  'listingid',
  'orderid',
  'status',
  'issold',
  'soldto',
  'soldtoemail',
  'soldat',
  'createdat',
  'updatedat',
  'deleted',
  'buyerid',
  'sellerid',
  'price',
  'paidamount',
  'currency',
  'type',
  'transactioncategory',
  'paymentgateway',
  'transactionid',
  'transfercode',
  '__v',
  'propemail',
  'proppassword',
  'proprecoveryinfo',
  'proptwofactorsecret',
  'propbackupcodes',
  'propinstructions'
]);

function formatDynamicLabel(key: string): string {
  // If key already contains spaces, slashes, or dashes, preserve the exact label as entered
  if (key.includes(' ') || key.includes('/') || key.includes('-')) {
    return key;
  }
  const lower = key.toLowerCase();
  if (lower === 'accountemail' || lower === 'email' || lower === 'login') return 'Gmail/Login';
  if (lower === 'accountpassword' || lower === 'password' || lower === 'pass') return 'Password';
  if (lower === 'recoveryemail' || lower === 'recovery_email') return 'Recovery Email';
  if (lower === 'recoveryinfo' || lower === 'recovery') return 'Recovery Info';
  if (lower === 'twofactorsecretkey' || lower === 'twofactorsecret' || lower === 'twofactor' || lower === 'totp' || lower === '2fa') return 'Two-Factor Authenticator';
  if (lower === 'twofactorbackupcodes' || lower === 'backupcodes' || lower === 'backupcode') return '2FA Backup Codes';
  if (lower === 'additionalinstructions' || lower === 'instructions') return 'Additional Instructions';
  if (lower === 'phonenumber' || lower === 'phone') return 'Phone Number';
  if (lower === 'delivery_value' || lower === 'deliveryvalue') return 'Delivery Line';
  if (lower === 'notes' || lower === 'note') return 'Notes';

  // Any custom field: turn camelCase, snake_case into clean readable Title Case
  return key
    .replace(/[_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function isSensitiveField(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes('pass') || lower.includes('secret') || lower.includes('pin') || lower.includes('token') || lower.includes('key');
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  order,
  onClose,
  onOpenOrderHistory
}) => {
  if (!order) return null;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const credentials = order.digitalProductDetails || {};

  // Extract all configured delivery fields dynamically in the exact order received
  const deliveryFields: { key: string; label: string; value: string; isSensitive: boolean }[] = [];
  const seenValues = new Set<string>();

  // 1. If explicit deliveryFields array was saved on the stock item, prioritize it to guarantee EXACT order and labels!
  if (Array.isArray(credentials.deliveryFields) && credentials.deliveryFields.length > 0) {
    credentials.deliveryFields.forEach((field: any, idx: number) => {
      if (!field) return;
      const label = (field.label || field.name || field.key || `Field ${idx + 1}`).trim();
      const val = field.value !== undefined && field.value !== null ? String(field.value).trim() : '';
      if (!val || val === 'null' || val === 'undefined') return;
      deliveryFields.push({
        key: field.key || `field_${idx}_${label}`,
        label,
        value: val,
        isSensitive: isSensitiveField(label)
      });
      seenValues.add(val.toLowerCase());
    });
  }

  // 2. Iterate over all keys of credentials for any remaining configured fields
  Object.entries(credentials).forEach(([key, val]) => {
    if (!key || INTERNAL_METADATA_KEYS.has(key.toLowerCase()) || key === 'deliveryFields') return;
    if (val === null || val === undefined) return;
    const strVal = String(val).trim();
    if (!strVal || strVal === 'null' || strVal === 'undefined') return;

    // Skip if already included via deliveryFields array with exact same value
    if (seenValues.has(strVal.toLowerCase())) return;

    // Check if delivery_value is a duplicate of login|pass or single value already shown
    if (key.toLowerCase() === 'delivery_value') {
      const email = credentials.accountEmail || credentials.email || '';
      const pass = credentials.accountPassword || credentials.password || '';
      if (email && (strVal === email || strVal === `${email} | ${pass}` || strVal === `${email}:${pass}`)) {
        return;
      }
    }

    // Avoid duplicate notes if recoveryInfo and notes have identical values
    if (key.toLowerCase() === 'notes' && credentials.recoveryInfo && credentials.recoveryInfo === val) {
      return;
    }

    deliveryFields.push({
      key,
      label: formatDynamicLabel(key),
      value: strVal,
      isSensitive: isSensitiveField(key)
    });
    seenValues.add(strVal.toLowerCase());
  });

  const handleCopySingle = (key: string, value: string) => {
    copyToClipboard(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAll = () => {
    const lines = deliveryFields.map(f => `${f.label}: ${f.value}`);
    copyToClipboard(lines.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const toggleReveal = (key: string) => {
    setRevealedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const displayPrice = Number(
    order.paidAmount !== undefined && order.paidAmount !== null && !isNaN(Number(order.paidAmount))
      ? order.paidAmount
      : order.price
  ).toLocaleString();

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-[#EBE7F7] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative my-auto animate-in zoom-in-95 duration-200 text-[#0F172A] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Bar */}
        <div className="h-2 bg-[#5B4DF5] w-full shrink-0" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#64748B] hover:text-[#0F172A] bg-[#F8F7FD] hover:bg-[#F1F0FB] border border-[#EBE7F7] rounded-full transition cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7 overflow-y-auto space-y-5">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-sm animate-bounce">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] sm:text-[11px] px-3 py-0.5 rounded-full uppercase tracking-wider inline-block">
              Payment Confirmed • Delivery Ready
            </span>

            <h2 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
              Purchase Successful!
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Your order has been completed and verified.
            </p>
          </div>

          {/* Clean Verified Purchase Price Card */}
          <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#64748B] uppercase font-black block tracking-wider">
                Purchased Item
              </span>
              <p className="text-sm font-black text-[#0F172A] line-clamp-1">
                {order.listingTitle || 'Product'}
              </p>
            </div>
            <div className="text-right pl-3">
              <span className="text-[10px] text-[#64748B] uppercase font-black block tracking-wider">
                Purchase Price
              </span>
              <span className="text-lg sm:text-xl font-black text-[#5B4DF5]">
                ₦{displayPrice}
              </span>
            </div>
          </div>

          {/* Configured Delivery Information Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#5B4DF5]" />
                <h3 className="text-xs font-black uppercase text-[#0F172A] tracking-wider">
                  Delivered Account Information
                </h3>
              </div>
              {deliveryFields.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="text-[11px] font-bold text-[#5B4DF5] hover:text-[#4838EE] flex items-center gap-1 cursor-pointer bg-[#EDE9FE] px-2.5 py-1 rounded-lg border border-[#DDD6FE] transition"
                >
                  {copiedAll ? <Check className="w-3 h-3 text-emerald-600 stroke-[3]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAll ? 'All Copied!' : 'Copy All'}</span>
                </button>
              )}
            </div>

            {deliveryFields.length === 0 ? (
              <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-4 rounded-2xl text-center text-xs text-[#64748B]">
                Credentials delivered. Please check your buyer orders history for full details.
              </div>
            ) : (
              <div className="space-y-2.5">
                {deliveryFields.map((field) => {
                  const isRevealed = revealedKeys[field.key] || !field.isSensitive;
                  const isCopied = copiedKey === field.key;
                  const isLong = field.value.length > 45 || field.value.includes('\n');

                  return (
                    <div 
                      key={field.key} 
                      className="bg-white border border-[#EBE7F7] p-3 rounded-2xl space-y-1.5 shadow-2xs hover:border-[#5B4DF5]/40 transition"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-[#64748B] uppercase tracking-wider text-[10px]">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {field.isSensitive && (
                            <button
                              type="button"
                              onClick={() => toggleReveal(field.key)}
                              className="text-[#64748B] hover:text-[#0F172A] transition cursor-pointer text-[10px] flex items-center gap-1 font-semibold"
                            >
                              {isRevealed ? (
                                <>
                                  <EyeOff className="w-3 h-3" />
                                  <span>Hide</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3" />
                                  <span>Reveal</span>
                                </>
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopySingle(field.key, field.value)}
                            className="text-[#5B4DF5] hover:text-[#4838EE] font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="bg-[#F8F7FD] p-2.5 rounded-xl border border-[#EBE7F7]">
                        <div className={`font-mono text-xs text-[#0F172A] font-semibold break-all select-all ${isLong ? 'whitespace-pre-wrap' : ''}`}>
                          {isRevealed ? field.value : '••••••••••••••••••••'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-[#F1F0FB] hover:bg-[#EBE7F7] text-[#475569] font-extrabold py-3 px-4 rounded-xl text-xs sm:text-sm transition cursor-pointer border border-[#E2E8F0] order-2 sm:order-1"
            >
              Done
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOrderHistory();
              }}
              className="w-full bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-black py-3 px-4 rounded-xl text-xs sm:text-sm shadow-md shadow-[#5B4DF5]/25 transition cursor-pointer flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>View in Order History</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default PaymentSuccessModal;
