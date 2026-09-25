import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { PurchaseRecord, SellerRevenueRecord } from '../types';

export interface RevenueSplitResult {
  grossAmount: number;
  sellerShare: number;
  ownerShare: number;
  sellerPercent: number;
  ownerPercent: number;
}

/**
 * Computes the 70% Seller / 30% Website Owner split
 * Example: ₦2,000 sale -> Seller ₦1,400 (70%), Owner ₦600 (30%)
 */
export function calculateRevenueSplit(grossAmount: number): RevenueSplitResult {
  const gross = Math.max(0, Number(grossAmount) || 0);
  const sellerShare = Math.round(gross * 0.70);
  const ownerShare = gross - sellerShare;
  return {
    grossAmount: gross,
    sellerShare,
    ownerShare,
    sellerPercent: 70,
    ownerPercent: 30
  };
}

/**
 * Permanently saves and updates the 70/30 calculation in Firestore
 * Updates seller_revenues/{sellerId} and users/{sellerId}
 */
export async function recordSellerRevenueInDb(
  purchase: Partial<PurchaseRecord> & { sellerId: string; paidAmount?: number; price?: number }
): Promise<RevenueSplitResult | null> {
  if (!purchase || !purchase.sellerId) return null;

  try {
    const gross = Number(purchase.paidAmount || purchase.price || 0);
    const split = calculateRevenueSplit(gross);
    const targetSellerId = purchase.sellerId;

    const revRef = doc(db, 'seller_revenues', targetSellerId);
    const revSnap = await getDoc(revRef);
    const cur = revSnap.exists() ? (revSnap.data() as SellerRevenueRecord) : null;

    const prevGross = Number(cur?.totalGrossSales) || 0;
    const prevSellerRev = Number(cur?.totalSellerRevenue) || 0;
    const prevOwnerComm = Number(cur?.totalOwnerCommission) || 0;
    const prevCount = Number(cur?.completedSalesCount) || 0;
    const existingSales = Array.isArray(cur?.sales) ? cur!.sales : [];

    const orderId = purchase.id || `ORD_${Date.now()}`;
    // Idempotency: don't double count if this orderId is already recorded
    const alreadyRecorded = existingSales.some((s) => s.orderId === orderId);

    const saleEntry = {
      orderId,
      txId: purchase.transactionId || orderId,
      listingId: purchase.listingId || '',
      listingTitle: purchase.listingTitle || 'Account Listing',
      grossAmount: split.grossAmount,
      sellerShare: split.sellerShare,
      ownerShare: split.ownerShare,
      sellerPercent: 70,
      ownerPercent: 30,
      buyerId: purchase.buyerId || '',
      buyerEmail: purchase.buyerEmail || '',
      paymentGateway: purchase.paymentGateway || 'escrow',
      date: purchase.purchasedAt || new Date().toISOString()
    };

    const newGross = alreadyRecorded ? prevGross : prevGross + split.grossAmount;
    const newSellerRev = alreadyRecorded ? prevSellerRev : prevSellerRev + split.sellerShare;
    const newOwnerComm = alreadyRecorded ? prevOwnerComm : prevOwnerComm + split.ownerShare;
    const newCount = alreadyRecorded ? prevCount : prevCount + 1;
    const updatedSales = alreadyRecorded
      ? existingSales.map((s) => (s.orderId === orderId ? saleEntry : s))
      : [saleEntry, ...existingSales.slice(0, 99)];

    await setDoc(
      revRef,
      {
        sellerId: targetSellerId,
        sellerEmail: purchase.sellerEmail || '',
        totalGrossSales: newGross,
        totalSellerRevenue: newSellerRev,
        totalOwnerCommission: newOwnerComm,
        completedSalesCount: newCount,
        lastSaleAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sales: updatedSales
      },
      { merge: true }
    );

    // Also mirror to user profile
    try {
      const userRef = doc(db, 'users', targetSellerId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        await updateDoc(userRef, {
          sellerTotalRevenue: alreadyRecorded
            ? (Number(uData.sellerTotalRevenue) || newSellerRev)
            : (Number(uData.sellerTotalRevenue) || 0) + split.sellerShare,
          sellerGrossSales: alreadyRecorded
            ? (Number(uData.sellerGrossSales) || newGross)
            : (Number(uData.sellerGrossSales) || 0) + split.grossAmount,
          sellerOwnerFee: alreadyRecorded
            ? (Number(uData.sellerOwnerFee) || newOwnerComm)
            : (Number(uData.sellerOwnerFee) || 0) + split.ownerShare,
          sellerCompletedSales: alreadyRecorded
            ? (Number(uData.sellerCompletedSales) || newCount)
            : (Number(uData.sellerCompletedSales) || 0) + 1,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (uErr) {
      console.warn('User profile revenue mirror notice:', uErr);
    }

    return split;
  } catch (err) {
    console.warn('recordSellerRevenueInDb notice:', err);
    return null;
  }
}

/**
 * Automatically syncs and persists historical sold listings or purchases into seller_revenues/{sellerId}
 * ensuring all seller revenue calculations are permanently stored and accurate.
 */
export async function syncHistoricalSellerRevenue(
  sellerId: string,
  sellerEmail: string,
  soldListings: Array<{ id: string; title: string; price: number; createdAt?: string }>,
  completedPurchases: Array<PurchaseRecord> = []
): Promise<SellerRevenueRecord | null> {
  if (!sellerId) return null;
  try {
    const revRef = doc(db, 'seller_revenues', sellerId);
    const revSnap = await getDoc(revRef);
    const cur = revSnap.exists() ? (revSnap.data() as SellerRevenueRecord) : null;

    const existingSales = Array.isArray(cur?.sales) ? [...cur.sales] : [];
    const recordedOrderIds = new Set(existingSales.map((s) => s.orderId || s.txId));

    let addedGross = 0;
    let addedSellerRev = 0;
    let addedOwnerComm = 0;
    let addedCount = 0;

    // Check purchases
    for (const p of completedPurchases) {
      const orderId = p.id || p.transactionId || `ORD_${Date.now()}`;
      if (!recordedOrderIds.has(orderId)) {
        recordedOrderIds.add(orderId);
        const gross = Number(p.paidAmount || p.price || 0);
        const split = calculateRevenueSplit(gross);
        existingSales.unshift({
          orderId,
          txId: p.transactionId || orderId,
          listingId: p.listingId || '',
          listingTitle: p.listingTitle || 'Account Listing',
          grossAmount: split.grossAmount,
          sellerShare: split.sellerShare,
          ownerShare: split.ownerShare,
          sellerPercent: 70,
          ownerPercent: 30,
          buyerId: p.buyerId || '',
          buyerEmail: p.buyerEmail || '',
          paymentGateway: p.paymentGateway || 'escrow',
          date: p.purchasedAt || new Date().toISOString()
        });
        addedGross += split.grossAmount;
        addedSellerRev += split.sellerShare;
        addedOwnerComm += split.ownerShare;
        addedCount += 1;
      }
    }

    // Check sold listings
    for (const l of soldListings) {
      const pseudoOrderId = `SOLD_LST_${l.id}`;
      if (!recordedOrderIds.has(pseudoOrderId) && !existingSales.some((s) => s.listingId === l.id)) {
        recordedOrderIds.add(pseudoOrderId);
        const gross = Number(l.price || 0);
        const split = calculateRevenueSplit(gross);
        existingSales.push({
          orderId: pseudoOrderId,
          txId: `TX_${l.id}`,
          listingId: l.id,
          listingTitle: l.title || 'Sold Account Listing',
          grossAmount: split.grossAmount,
          sellerShare: split.sellerShare,
          ownerShare: split.ownerShare,
          sellerPercent: 70,
          ownerPercent: 30,
          buyerId: '',
          buyerEmail: '',
          paymentGateway: 'escrow',
          date: l.createdAt || new Date().toISOString()
        });
        addedGross += split.grossAmount;
        addedSellerRev += split.sellerShare;
        addedOwnerComm += split.ownerShare;
        addedCount += 1;
      }
    }

    const currentGross = Number(cur?.totalGrossSales) || 0;
    const currentSellerRev = Number(cur?.totalSellerRevenue) || 0;
    const currentOwnerComm = Number(cur?.totalOwnerCommission) || 0;
    const currentCount = Number(cur?.completedSalesCount) || 0;

    const finalGross = Math.max(currentGross, currentGross + addedGross, existingSales.reduce((s, x) => s + x.grossAmount, 0));
    const finalSellerRev = Math.max(currentSellerRev, currentSellerRev + addedSellerRev, existingSales.reduce((s, x) => s + x.sellerShare, 0));
    const finalOwnerComm = Math.max(currentOwnerComm, currentOwnerComm + addedOwnerComm, existingSales.reduce((s, x) => s + x.ownerShare, 0));
    const finalCount = Math.max(currentCount, currentCount + addedCount, existingSales.length);

    const updatedRecord: SellerRevenueRecord = {
      sellerId,
      sellerEmail: sellerEmail || cur?.sellerEmail || '',
      totalGrossSales: finalGross,
      totalSellerRevenue: finalSellerRev,
      totalOwnerCommission: finalOwnerComm,
      completedSalesCount: finalCount,
      lastSaleAt: cur?.lastSaleAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sales: existingSales.slice(0, 100)
    };

    if (addedCount > 0 || !cur) {
      await setDoc(revRef, updatedRecord, { merge: true });

      try {
        const userRef = doc(db, 'users', sellerId);
        const uSnap = await getDoc(userRef);
        if (uSnap.exists()) {
          await updateDoc(userRef, {
            sellerTotalRevenue: finalSellerRev,
            sellerGrossSales: finalGross,
            sellerOwnerFee: finalOwnerComm,
            sellerCompletedSales: finalCount,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (uErr) {
        console.warn('User doc revenue update notice:', uErr);
      }
    }

    return updatedRecord;
  } catch (err) {
    console.warn('syncHistoricalSellerRevenue notice:', err);
    return null;
  }
}
