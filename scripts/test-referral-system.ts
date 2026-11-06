import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { 
  linkReferralCode, 
  processReferralRewardOnDeposit, 
  QUALIFYING_DEPOSIT_THRESHOLD, 
  REFERRAL_REWARD_AMOUNT 
} from '../src/server/referralService.ts';
import fs from 'fs';

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const SERVER_SERVICE_EMAIL = 'zenet-backend-service@zenetmarketplace.internal';
const SERVER_SERVICE_PASSWORD = 'ZenetSecureSystemBackend2026!#';

async function runReferralTestSuite() {
  console.log('========================================================');
  console.log('STARTING AUTOMATED ZENET HUB REFERRAL SYSTEM VERIFICATION');
  console.log('========================================================');

  const configPath = './firebase-applet-config.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  const auth = getAuth(app);

  try {
    await signInWithEmailAndPassword(auth, SERVER_SERVICE_EMAIL, SERVER_SERVICE_PASSWORD);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      await createUserWithEmailAndPassword(auth, SERVER_SERVICE_EMAIL, SERVER_SERVICE_PASSWORD);
    } else {
      throw err;
    }
  }

  const db = getFirestore(app, config.firestoreDatabaseId);

  const timestamp = Date.now();
  const testReferrerUid = `test_referrer_${timestamp}`;
  const testReferredUidB = `test_referred_b_${timestamp}`;
  const testReferredUidC = `test_referred_c_${timestamp}`;
  const testReferralCode = `REF${Math.floor(10000000 + Math.random() * 90000000)}`;

  console.log(`Test Referrer ID: ${testReferrerUid}`);
  console.log(`Test Referral Code: ${testReferralCode}`);

  try {
    // -----------------------------------------------------------
    // SETUP: Create Test Referrer (User A) with ₦0 initial wallet
    // -----------------------------------------------------------
    await setDoc(doc(db, 'users', testReferrerUid), {
      uid: testReferrerUid,
      email: `test_referrer_${timestamp}@example.com`,
      displayName: 'Test Referrer User A',
      referralCode: testReferralCode,
      referralCount: 0,
      totalReferralEarnings: 0,
      walletBalance: 0,
      balance: 0,
      createdAt: new Date().toISOString()
    });

    await setDoc(doc(db, 'wallets', testReferrerUid), {
      userId: testReferrerUid,
      walletBalance: 0,
      balance: 0,
      updatedAt: new Date().toISOString()
    });

    // Create Test Referred User B
    await setDoc(doc(db, 'users', testReferredUidB), {
      uid: testReferredUidB,
      email: `test_user_b_${timestamp}@example.com`,
      displayName: 'Test User B',
      referralCode: `REF${Math.floor(10000000 + Math.random() * 90000000)}`,
      walletBalance: 0,
      createdAt: new Date().toISOString()
    });

    console.log('✓ Initial setup complete: User A (Referrer) initialized with ₦0 balance.');

    // -----------------------------------------------------------
    // TEST 1: Rule 7 — Self-Referral Prevention
    // -----------------------------------------------------------
    console.log('\n--- TEST 1: Self-Referral Protection ---');
    const selfRefResult = await linkReferralCode({
      db,
      newUserId: testReferrerUid,
      referralCode: testReferralCode
    });
    if (!selfRefResult.success) {
      console.log(`✓ PASS: Self-referral was rejected: "${selfRefResult.message}"`);
    } else {
      throw new Error(`FAIL: Self-referral was unexpectedly allowed!`);
    }

    // -----------------------------------------------------------
    // TEST 2: Rule 8 — Referral Linking (User A refers User B)
    // -----------------------------------------------------------
    console.log('\n--- TEST 2: Referral Linking ---');
    const linkResult = await linkReferralCode({
      db,
      newUserId: testReferredUidB,
      newUserEmail: `test_user_b_${timestamp}@example.com`,
      newUserName: 'Test User B',
      referralCode: testReferralCode
    });

    if (!linkResult.success || linkResult.referrerId !== testReferrerUid) {
      throw new Error(`FAIL: Referral linking failed: ${JSON.stringify(linkResult)}`);
    }

    // Verify database record
    const refDocSnap = await getDoc(doc(db, 'referrals', `ref_${testReferredUidB}`));
    if (!refDocSnap.exists() || refDocSnap.data().rewardClaimed !== false) {
      throw new Error(`FAIL: referrals document was not created correctly!`);
    }

    const referrerUserSnap = await getDoc(doc(db, 'users', testReferrerUid));
    if (referrerUserSnap.data()?.referralCount !== 1) {
      throw new Error(`FAIL: Referrer referralCount was not incremented to 1!`);
    }
    console.log(`✓ PASS: User B successfully linked to User A. referrals/ref_${testReferredUidB} status: pending.`);

    // -----------------------------------------------------------
    // TEST 3: Rule 5 — Deposit < ₦1,000 does NOT trigger reward
    // -----------------------------------------------------------
    console.log('\n--- TEST 3: Sub-threshold Deposit (< ₦1,000) ---');
    const sub500Result = await processReferralRewardOnDeposit({
      db,
      depositedUserId: testReferredUidB,
      depositedUserEmail: `test_user_b_${timestamp}@example.com`,
      depositAmount: 500,
      depositReference: `TEST_DEP_500_${timestamp}`
    });

    if (sub500Result.rewarded) {
      throw new Error(`FAIL: ₦500 deposit incorrectly granted a reward!`);
    }

    const refUserAfter500 = await getDoc(doc(db, 'users', testReferrerUid));
    if ((refUserAfter500.data()?.walletBalance || 0) !== 0) {
      throw new Error(`FAIL: Referrer wallet was credited for a ₦500 deposit!`);
    }
    console.log(`✓ PASS: ₦500 deposit correctly rejected: "${sub500Result.reason}". User A wallet balance remains ₦0.`);

    // -----------------------------------------------------------
    // TEST 4: Rules 1, 2, 6, 9 — Qualifying Deposit of ₦1,000 triggers ₦100 reward
    // -----------------------------------------------------------
    console.log('\n--- TEST 4: Qualifying Deposit of ₦1,000 ---');
    const qualifyingResult = await processReferralRewardOnDeposit({
      db,
      depositedUserId: testReferredUidB,
      depositedUserEmail: `test_user_b_${timestamp}@example.com`,
      depositAmount: 1000,
      depositReference: `TEST_DEP_1000_${timestamp}`
    });

    if (!qualifyingResult.rewarded || qualifyingResult.rewardAmount !== 100) {
      throw new Error(`FAIL: Qualifying ₦1,000 deposit did not grant ₦100 reward! ${JSON.stringify(qualifyingResult)}`);
    }

    // Verify Referrer's updated wallet and earnings in database
    const refUserAfter1000 = await getDoc(doc(db, 'users', testReferrerUid));
    const refWalletAfter1000 = await getDoc(doc(db, 'wallets', testReferrerUid));
    const refUserData = refUserAfter1000.data();
    const refWalletData = refWalletAfter1000.data();

    if (refUserData?.walletBalance !== 100 || refWalletData?.walletBalance !== 100) {
      throw new Error(`FAIL: User A wallet balance is not ₦100! (users: ${refUserData?.walletBalance}, wallets: ${refWalletData?.walletBalance})`);
    }
    if (refUserData?.totalReferralEarnings !== 100) {
      throw new Error(`FAIL: User A totalReferralEarnings is not ₦100! (${refUserData?.totalReferralEarnings})`);
    }

    // Verify referral record marked claimed
    const refDocAfter1000 = await getDoc(doc(db, 'referrals', `ref_${testReferredUidB}`));
    if (!refDocAfter1000.exists() || refDocAfter1000.data().rewardClaimed !== true) {
      throw new Error(`FAIL: referrals document was not marked rewardClaimed: true!`);
    }

    // Verify wallet_transactions record exists
    const txDocAfter1000 = await getDoc(doc(db, 'wallet_transactions', `TX-REF-TEST_DEP_1000_${timestamp}`));
    if (!txDocAfter1000.exists() || txDocAfter1000.data().amount !== 100 || txDocAfter1000.data().type !== 'referral_bonus') {
      throw new Error(`FAIL: wallet_transactions audit record was not created accurately!`);
    }

    console.log(`✓ PASS: User A received exactly ₦100 in wallet. New balance: ₦${refUserData.walletBalance}. Audit transaction committed.`);

    // -----------------------------------------------------------
    // TEST 5: Rule 4 — One reward per referred user (Subsequent ₦5,000 deposit)
    // -----------------------------------------------------------
    console.log('\n--- TEST 5: Subsequent Deposit by Same User (One Reward Per User) ---');
    const secondDepositResult = await processReferralRewardOnDeposit({
      db,
      depositedUserId: testReferredUidB,
      depositedUserEmail: `test_user_b_${timestamp}@example.com`,
      depositAmount: 5000,
      depositReference: `TEST_DEP_5000_${timestamp}`
    });

    if (secondDepositResult.rewarded) {
      throw new Error(`FAIL: User B's second deposit generated a duplicate reward!`);
    }

    const refUserAfterSecond = await getDoc(doc(db, 'users', testReferrerUid));
    if (refUserAfterSecond.data()?.walletBalance !== 100) {
      throw new Error(`FAIL: User A wallet was credited again on subsequent deposit! Balance: ${refUserAfterSecond.data()?.walletBalance}`);
    }
    console.log(`✓ PASS: Second deposit of ₦5,000 by User B generated ₦0 extra reward. Reason: "${secondDepositResult.reason}". Balance remains ₦100.`);

    // -----------------------------------------------------------
    // TEST 6: Rule 7 — Idempotency / Parallel Verification Protection
    // -----------------------------------------------------------
    console.log('\n--- TEST 6: Duplicate Verification Call Protection ---');
    const duplicateCallResult = await processReferralRewardOnDeposit({
      db,
      depositedUserId: testReferredUidB,
      depositedUserEmail: `test_user_b_${timestamp}@example.com`,
      depositAmount: 1000,
      depositReference: `TEST_DEP_1000_${timestamp}`
    });

    if (duplicateCallResult.rewarded) {
      throw new Error(`FAIL: Duplicate call for same reference granted extra reward!`);
    }
    console.log(`✓ PASS: Re-processing identical transaction reference safely aborted without duplicate credit.`);

    // -----------------------------------------------------------
    // TEST 7: Rule 3 — Unlimited Referrals (User C also earns ₦100)
    // -----------------------------------------------------------
    console.log('\n--- TEST 7: Unlimited Referrals (User A refers User C) ---');
    await setDoc(doc(db, 'users', testReferredUidC), {
      uid: testReferredUidC,
      email: `test_user_c_${timestamp}@example.com`,
      displayName: 'Test User C',
      walletBalance: 0,
      createdAt: new Date().toISOString()
    });

    const linkCResult = await linkReferralCode({
      db,
      newUserId: testReferredUidC,
      newUserEmail: `test_user_c_${timestamp}@example.com`,
      newUserName: 'Test User C',
      referralCode: testReferralCode
    });

    if (!linkCResult.success) {
      throw new Error(`FAIL: Linking User C failed: ${JSON.stringify(linkCResult)}`);
    }

    const qualifyingCResult = await processReferralRewardOnDeposit({
      db,
      depositedUserId: testReferredUidC,
      depositedUserEmail: `test_user_c_${timestamp}@example.com`,
      depositAmount: 2000,
      depositReference: `TEST_DEP_2000_C_${timestamp}`
    });

    if (!qualifyingCResult.rewarded || qualifyingCResult.rewardAmount !== 100) {
      throw new Error(`FAIL: User C qualifying deposit did not grant ₦100 reward!`);
    }

    const refUserAfterC = await getDoc(doc(db, 'users', testReferrerUid));
    if (refUserAfterC.data()?.walletBalance !== 200 || refUserAfterC.data()?.totalReferralEarnings !== 200) {
      throw new Error(`FAIL: User A wallet balance is not ₦200 after User C! (balance: ${refUserAfterC.data()?.walletBalance}, earnings: ${refUserAfterC.data()?.totalReferralEarnings})`);
    }

    console.log(`✓ PASS: User C's deposit earned User A another ₦100. Total wallet balance: ₦${refUserAfterC.data()?.walletBalance}, Total earnings: ₦${refUserAfterC.data()?.totalReferralEarnings}.`);

    // -----------------------------------------------------------
    // CLEANUP: Remove test documents
    // -----------------------------------------------------------
    console.log('\n--- Cleaning up temporary test records ---');
    await deleteDoc(doc(db, 'users', testReferrerUid));
    await deleteDoc(doc(db, 'wallets', testReferrerUid));
    await deleteDoc(doc(db, 'users', testReferredUidB));
    await deleteDoc(doc(db, 'users', testReferredUidC));
    await deleteDoc(doc(db, 'referrals', `ref_${testReferredUidB}`));
    await deleteDoc(doc(db, 'referrals', `ref_${testReferredUidC}`));
    await deleteDoc(doc(db, 'wallet_transactions', `TX-REF-TEST_DEP_1000_${timestamp}`));
    await deleteDoc(doc(db, 'wallet_transactions', `TX-REF-TEST_DEP_2000_C_${timestamp}`));
    console.log('✓ Cleanup complete.');

    console.log('\n========================================================');
    console.log('ALL 7 TEST SUITES PASSED! 100% COMPLIANT WITH ALL 9 RULES.');
    console.log('========================================================');
    process.exit(0);

  } catch (err: any) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  }
}

runReferralTestSuite();
