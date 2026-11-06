import { AccountListing } from '../types';

/**
 * Checks if a listing is currently pending approval or not approved for public display.
 * Strict exclusion of any unapproved, reserved, or pending logs.
 */
export const isListingPendingApproval = (item: AccountListing): boolean => {
  if (!item) return false;
  const approvalStatus = (item.approvalStatus || '').toLowerCase();
  const status = (item.status || '').toLowerCase();

  return (
    approvalStatus === 'pending' ||
    approvalStatus === 'rejected' ||
    status === 'pending' ||
    status === 'reserved' ||
    status === 'rejected'
  );
};

/**
 * Checks if a listing is publicly active and available for customer browsing and purchase.
 * Must be approved and active, not sold, and have effective stock > 0.
 */
export const isPublicActiveListing = (item: AccountListing): boolean => {
  if (!item) return false;
  if (isListingPendingApproval(item)) return false;

  const status = (item.status || '').toLowerCase();
  if (status === 'sold') return false;

  // Status must be active or approvalStatus must be approved
  if (status !== 'active' && item.approvalStatus !== 'approved') return false;

  const invAvail = Array.isArray(item.inventory)
    ? item.inventory.filter((acc: any) => (acc.status || '').toLowerCase() !== 'sold').length
    : undefined;
  const stockVal = item.stockCount !== undefined ? item.stockCount : (item.stock !== undefined ? item.stock : 1);
  const effStock = invAvail !== undefined ? invAvail : stockVal;

  return effStock > 0;
};
