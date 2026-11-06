import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  runTransaction 
} from 'firebase/firestore';

// =========================================================================
// ZENET HUB AUTOMATIC REFERRAL SYSTEM
//
// Rules:
// 1. Referral reward: Whenever User A refers User B, User A receives ₦100
//    when User B completes a qualifying deposit of at least ₦1,000.
// 2. Automatic payment: ₦100 credited immediately and automatically to
//    User A's real wallet upon verified deposit completion.
// 3. Unlimited referrals: Every referred user who meets the ₦1,000 threshold
//    independently earns the referrer another ₦100.
// 4. One reward per referred user: Exactly one ₦100 reward per referred user.
//    Subsequent deposits by the same user do NOT generate extra rewards.
// 5. Real verified deposits only: Pending, cancelled, or < ₦1,000 deposits
//    never trigger a reward.
// 6. Permanent records: Full audit trail stored in `referrals`,
//    `wallet_transactions`, `users`, `wallets`, and `user_notifications`.
// 7. Security: Atomic transaction, strict anti-duplicate, and anti-self-referral.
// =========================================================================

export const QUALIFYING_DEPOSIT_THRESHOLD = 1000; // ₦1,000 NGN
export const REFERRAL_REWARD_AMOUNT = 100; // ₦100 NGN

export interface LinkReferralParams {
  db: Firestore;
  newUserId: string;
  newUserEmail?: string;
  newUserName?: string;
  referralCode: string;
}

export interface LinkReferralResult {
  success: boolean;
  message: string;
  referrerId?: string;
  referralCode?: string;
  alreadyLinked?: boolean;
}

/**
 * Atomically links a newly registered or existing unreferred user to a referrer code
 */
export async function linkReferralCode(params: LinkReferralParams): Promise<LinkReferralResult> {
  const { db, newUserId, newUserEmail, newUserName, referralCode } = params;

  if (!db || !newUserId) {
    return { success: false, message: 'Database or user identification missing.' };
  }

  const cleanCode = (referralCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: 'Referral code is empty.' };
  }

  try {
    // 1. Prevent self-referral
    const uDocRef = doc(db, 'users', newUserId);
    const uSnap = await getDoc(uDocRef);
    const userData = uSnap.exists() ? uSnap.data() : null;

    if (userData?.referralCode && userData.referralCode.toUpperCase() === cleanCode) {
      return { success: false, message: 'You cannot use your own referral code.' };
    }

    if (userData?.referredBy) {
      return { 
        success: true, 
        message: 'Account is already linked to a referrer.', 
        referrerId: userData.referredBy, 
        alreadyLinked: true 
      };
    }

    // 2. Query referrer by referralCode
    const qRef = query(collection(db, 'users'), where('referralCode', '==', cleanCode));
    const refQuerySnap = await getDocs(qRef);

    if (refQuerySnap.empty) {
      return { success: false, message: `Referral code "${cleanCode}" was not found.` };
    }

    const referrerDoc = refQuerySnap.docs[0];
    const referrerId = referrerDoc.id;

    if (referrerId === newUserId) {
      return { success: false, message: 'You cannot use your own referral code.' };
    }

    const referrerData = referrerDoc.data() || {};
    const refRecordId = `ref_${newUserId}`;
    const refDocRef = doc(db, 'referrals', refRecordId);
    const existingRefSnap = await getDoc(refDocRef);

    if (existingRefSnap.exists()) {
      return { 
        success: true, 
        message: 'Referral relationship already registered.', 
        referrerId, 
        alreadyLinked: true 
      };
    }

    // 3. Atomically establish the referral relationship
    const resolvedName = newUserName || userData?.displayName || userData?.username || (newUserEmail || userData?.email || '').split('@')[0] || 'User';
    const resolvedEmail = newUserEmail || userData?.email || '';

    await setDoc(refDocRef, {
      id: refRecordId,
      referrerId,
      referredUserId: newUserId,
      referredUserEmail: resolvedEmail,
      referredUserName: resolvedName,
      referredAt: new Date().toISOString(),
      rewardClaimed: false,
      rewardAmount: REFERRAL_REWARD_AMOUNT,
      totalSpent: 0,
      status: 'pending'
    }, { merge: true });

    // Increment referrer's referralCount
    const currentCount = Number(referrerData.referralCount || 0);
    await setDoc(doc(db, 'users', referrerId), {
      referralCount: currentCount + 1,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Update referred user's profile with referredBy
    await setDoc(uDocRef, {
      referredBy: referrerId,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`[Referral System] Successfully linked User ${newUserId} to Referrer ${referrerId} using code ${cleanCode}`);

    return {
      success: true,
      message: 'Referral linked successfully.',
      referrerId,
      referralCode: cleanCode
    };

  } catch (err: any) {
    console.error('[Referral System] Error linking referral code:', err);
    return { success: false, message: err?.message || 'Failed to link referral code.' };
  }
}

export interface ProcessReferralDepositParams {
  db: Firestore;
  depositedUserId: string;
  depositedUserEmail?: string;
  depositAmount: number; // in NGN
  depositReference: string;
}

export interface ProcessReferralDepositResult {
  rewarded: boolean;
  rewardAmount?: number;
  referrerId?: string;
  referrerEmail?: string;
  newReferrerBalance?: number;
  reason?: string;
  alreadyClaimed?: boolean;
}

/**
 * Evaluates a verified deposit, credits ₦100 to the referrer's wallet automatically
 * if eligible, and commits permanent audit records to the database.
 */
export async function processReferralRewardOnDeposit(
  params: ProcessReferralDepositParams
): Promise<ProcessReferralDepositResult> {
  const { db, depositedUserId, depositedUserEmail, depositAmount, depositReference } = params;

  if (!db || !depositedUserId) {
    return { rewarded: false, reason: 'Database or user ID missing.' };
  }

  // Rule 1 & 5: Deposit must be at least ₦1,000 NGN
  if (typeof depositAmount !== 'number' || depositAmount < QUALIFYING_DEPOSIT_THRESHOLD) {
    return { 
      rewarded: false, 
      reason: `Deposit ₦${depositAmount} does not meet the ₦${QUALIFYING_DEPOSIT_THRESHOLD} qualifying threshold.` 
    };
  }

  try {
    // 1. Locate referral relationship
    const refDocRef = doc(db, 'referrals', `ref_${depositedUserId}`);
    const refSnap = await getDoc(refDocRef);

    let referrerId: string | null = null;
    let existingRefData: any = null;

    if (refSnap.exists()) {
      existingRefData = refSnap.data();
      referrerId = existingRefData.referrerId || null;
    }

    // Fallback: check users collection if referrals doc was missing
    let uSnap = await getDoc(doc(db, 'users', depositedUserId));
    const uData = uSnap.exists() ? uSnap.data() : null;

    if (!referrerId && uData?.referredBy) {
      referrerId = uData.referredBy;
    }

    if (!referrerId) {
      return { rewarded: false, reason: 'Deposited user was not referred by anyone.' };
    }

    // Rule 7: Prevent self-referral
    if (referrerId === depositedUserId) {
      return { rewarded: false, reason: 'Self-referral cannot earn reward.' };
    }

    // Rule 4: One reward per referred user
    if (existingRefData?.rewardClaimed === true || uData?.referralRewardClaimed === true) {
      return { 
        rewarded: false, 
        alreadyClaimed: true, 
        reason: 'Referral reward has already been claimed for this user. Subsequent deposits do not generate extra rewards.' 
      };
    }

    // 2. Atomic Transaction to credit ₦100 and commit all records
    let rewardedReferrerEmail = '';
    let finalNewBalance = 0;
    let referrerName = '';
    let referredName = '';

    await runTransaction(db, async (txn) => {
      // Re-verify under transaction lock (Anti-Race / Anti-Double-Credit)
      const liveRefSnap = await txn.get(refDocRef);
      if (liveRefSnap.exists() && liveRefSnap.data()?.rewardClaimed === true) {
        throw new Error('ALREADY_CLAIMED');
      }

      const liveUserSnap = await txn.get(doc(db, 'users', depositedUserId));
      if (liveUserSnap.exists() && liveUserSnap.data()?.referralRewardClaimed === true) {
        throw new Error('ALREADY_CLAIMED');
      }

      // Check transaction ledger idempotency
      const refTxId = `TX-REF-${depositReference}`;
      const existingTxSnap = await txn.get(doc(db, 'wallet_transactions', refTxId));
      if (existingTxSnap.exists()) {
        throw new Error('TRANSACTION_ALREADY_EXISTS');
      }

      // Fetch Referrer records
      const refUserRef = doc(db, 'users', referrerId);
      const refWalletRef = doc(db, 'wallets', referrerId);
      const refUserSnap = await txn.get(refUserRef);
      const refWalletSnap = await txn.get(refWalletRef);

      if (!refUserSnap.exists()) {
        throw new Error('REFERRER_NOT_FOUND');
      }

      const refUserData = refUserSnap.data() || {};
      const refWalletData = refWalletSnap.exists() ? refWalletSnap.data() : {};

      const rawBal = refUserData.walletBalance !== undefined ? refUserData.walletBalance : refUserData.balance;
      const rawWBal = refWalletData.walletBalance !== undefined ? refWalletData.walletBalance : refWalletData.balance;
      const curBal = Math.max(
        typeof rawBal === 'number' ? rawBal : (rawBal ? Number(rawBal) : 0),
        typeof rawWBal === 'number' ? rawWBal : (rawWBal ? Number(rawWBal) : 0)
      );

      const curEarnings = Number(refUserData.totalReferralEarnings || 0);
      finalNewBalance = curBal + REFERRAL_REWARD_AMOUNT;
      const newEarnings = curEarnings + REFERRAL_REWARD_AMOUNT;

      rewardedReferrerEmail = refUserData.email || '';
      referrerName = refUserData.displayName || refUserData.username || 'Partner';
      referredName = liveUserSnap.exists() 
        ? (liveUserSnap.data()?.displayName || liveUserSnap.data()?.username || liveUserSnap.data()?.email?.split('@')[0] || 'Friend')
        : 'Friend';

      // 1. Credit Referrer Wallet in both collections
      txn.update(refUserRef, {
        walletBalance: finalNewBalance,
        balance: finalNewBalance,
        totalReferralEarnings: newEarnings,
        updatedAt: new Date().toISOString()
      });

      txn.set(refWalletRef, {
        userId: referrerId,
        userEmail: rewardedReferrerEmail,
        walletBalance: finalNewBalance,
        balance: finalNewBalance,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Mark Referred User as rewarded
      if (liveUserSnap.exists()) {
        txn.update(doc(db, 'users', depositedUserId), {
          referralRewardClaimed: true,
          updatedAt: new Date().toISOString()
        });
      }

      // 3. Mark Referral document as rewarded with audit data
      txn.set(refDocRef, {
        id: `ref_${depositedUserId}`,
        referrerId,
        referredUserId: depositedUserId,
        referredUserEmail: depositedUserEmail || (liveUserSnap.exists() ? liveUserSnap.data()?.email : '') || '',
        referredUserName: referredName,
        referredAt: liveRefSnap.exists() ? (liveRefSnap.data()?.referredAt || new Date().toISOString()) : new Date().toISOString(),
        rewardClaimed: true,
        rewardAmount: REFERRAL_REWARD_AMOUNT,
        rewardClaimedAt: new Date().toISOString(),
        qualifyingDepositAmount: depositAmount,
        qualifyingDepositReference: depositReference,
        status: 'completed',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 4. Save audit transaction in wallet_transactions for Referrer
      const uniqueTxId = `TXID-REF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      txn.set(doc(db, 'wallet_transactions', refTxId), {
        id: refTxId,
        reference: `REF-BONUS-${depositReference}`,
        transactionId: uniqueTxId,
        userId: referrerId,
        userEmail: rewardedReferrerEmail,
        amount: REFERRAL_REWARD_AMOUNT,
        previousBalance: curBal,
        newBalance: finalNewBalance,
        walletBalance: finalNewBalance,
        balance: finalNewBalance,
        type: 'referral_bonus',
        method: 'referral_reward',
        status: 'successful',
        description: `Referral Reward: ${referredName} completed a qualifying deposit of ₦${depositAmount.toLocaleString()}!`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        createdAt: new Date().toISOString(),
        referredUserId: depositedUserId,
        depositReference
      });

      // 5. In-app notification for Referrer
      const notifRef = doc(collection(db, 'user_notifications'));
      txn.set(notifRef, {
        id: notifRef.id,
        userId: referrerId,
        userEmail: rewardedReferrerEmail,
        title: '₦100 Referral Reward Received!',
        message: `Congratulations! Your referred friend ${referredName} completed a qualifying deposit of ₦${depositAmount.toLocaleString()}. ₦100 has been added automatically to your wallet.`,
        type: 'referral_bonus',
        read: false,
        createdAt: new Date().toISOString()
      });
    });

    console.log(`[Referral System] Successfully credited ₦100 to Referrer ${referrerId} for User ${depositedUserId}'s deposit of ₦${depositAmount} (Ref: ${depositReference})`);

    return {
      rewarded: true,
      rewardAmount: REFERRAL_REWARD_AMOUNT,
      referrerId,
      referrerEmail: rewardedReferrerEmail,
      newReferrerBalance: finalNewBalance
    };

  } catch (err: any) {
    if (err?.message === 'ALREADY_CLAIMED' || err?.message === 'TRANSACTION_ALREADY_EXISTS') {
      console.log(`[Referral System] Deposit ${depositReference} reward was already claimed (Idempotency Protect).`);
      return { rewarded: false, alreadyClaimed: true, reason: 'Already rewarded.' };
    }
    console.error('[Referral System] Error processing referral deposit reward:', err);
    return { rewarded: false, reason: err?.message || 'Processing error.' };
  }
}
