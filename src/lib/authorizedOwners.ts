/**
 * Centralized Authorized Owner Registry for ZENET HUB
 * 
 * Provides authorization checks for website Owner privileges,
 * supporting both the original Owner account and authorized new Owner account(s)
 * without requiring any mutations or migration of existing Firestore records.
 */

export const AUTHORIZED_OWNER_EMAILS: readonly string[] = [
  'azeezmusharaf4@gmail.com', // Original Owner
  'muzenteofficial001@gmail.com', // Authorized Owner (muzente Official)
  'azeezmusharaf@gmail.com',
  'zenet-backend-service@zenetmarketplace.internal',
  'system-backend@zenetmarketplace.app'
];

export const AUTHORIZED_OWNER_UIDS: readonly string[] = [
  'LAn8Lec9ccT6rGEiDdylF8FfPZZ2', // Original Owner UID (owns 26 existing listings)
  '6nTqAgRTFkYoIUmlZwUN52rRmwt2', // Authorized Owner UID
  'SO3NblzYl2cQGoYtxuf58Wq1kOw1',
  '4Ro7kMiKr5bFZFHpMGT5OOzqv5N2',
  'sim-owner-azeez'
];

/**
 * Checks if an email address belongs to an authorized website owner
 */
export function isAuthorizedOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return AUTHORIZED_OWNER_EMAILS.some((ownerEmail) => ownerEmail.toLowerCase() === clean);
}

/**
 * Checks if a Firebase Auth UID belongs to an authorized website owner
 */
export function isAuthorizedOwnerUid(uid?: string | null): boolean {
  if (!uid) return false;
  return AUTHORIZED_OWNER_UIDS.includes(uid);
}

/**
 * Comprehensive check across user object and user profile
 */
export function isAuthorizedOwner(
  user?: { email?: string | null; uid?: string | null } | null,
  profile?: { role?: string; email?: string | null; uid?: string | null } | null
): boolean {
  if (user) {
    if (isAuthorizedOwnerEmail(user.email)) return true;
    if (isAuthorizedOwnerUid(user.uid)) return true;
  }
  if (profile) {
    if (profile.role === 'owner') return true;
    if (isAuthorizedOwnerEmail(profile.email)) return true;
    if (isAuthorizedOwnerUid(profile.uid)) return true;
  }
  return false;
}
