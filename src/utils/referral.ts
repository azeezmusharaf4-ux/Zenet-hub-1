/**
 * Deterministically generates or ensures a referral code in the format REF + 8 digits (e.g. REF94646145)
 */
export function generateUserReferralCode(uid?: string): string {
  if (!uid) {
    const random8 = Math.floor(10000000 + Math.random() * 90000000);
    return `REF${random8}`;
  }
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const codeNum = 10000000 + (positiveHash % 90000000);
  return `REF${codeNum}`;
}
