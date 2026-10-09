import crypto from 'crypto';
import { 
  getDb, 
  ensureServerAuthenticated, 
  parseAndVerifyToken,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  runTransaction 
} from './_firebase';

const generatePermanentWithdrawalId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WID-${rand}`;
};

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Determine sub-action based on path or query
  // Supports /api/withdrawals/request, /api/withdrawals/all-history, /api/withdrawals/confirm-payment, /api/withdrawals/update-status, /api/withdrawals/search-transaction, /api/withdrawals/verify-id
  const pathname = event.path || '';
  const queryAction = event.queryStringParameters?.action || '';
  let subAction = queryAction;
  if (!subAction && pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last !== 'withdrawals' && last !== 'withdrawals-manage') {
      subAction = last;
    }
  }

  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const verifiedUser = parseAndVerifyToken(authHeader);
    if (!verifiedUser) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized. Please sign in.' })
      };
    }

    await ensureServerAuthenticated();
    const db = getDb();
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Database service is currently unavailable.' })
      };
    }

    let payload: any = {};
    if (event.body) {
      try {
        payload = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      } catch {
        payload = {};
      }
    }

    // -------------------------------------------------------------
    // 1. SUBMIT A WITHDRAWAL REQUEST: subAction === 'request'
    // -------------------------------------------------------------
    if (subAction === 'request' || (event.httpMethod === 'POST' && payload.amount && payload.bankName)) {
      const { amount: rawAmount, bankName, bankCode, accountNumber, accountName, notes } = payload;
      const amount = Number(rawAmount);

      if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid withdrawal amount specified.' })
        };
      }

      const MIN_WITHDRAWAL = 5000;
      const MAX_WITHDRAWAL = 100000;

      if (amount < MIN_WITHDRAWAL) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: `Minimum withdrawal is ₦${MIN_WITHDRAWAL.toLocaleString()}.` })
        };
      }

      if (amount > MAX_WITHDRAWAL) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: `Maximum withdrawal per request is ₦${MAX_WITHDRAWAL.toLocaleString()}.` })
        };
      }

      if (!bankName || typeof bankName !== 'string' || !bankName.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Please select a valid bank.' })
        };
      }

      if (!accountNumber || typeof accountNumber !== 'string' || accountNumber.trim().length !== 10) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Please enter a valid 10-digit account number.' })
        };
      }

      if (!accountName || typeof accountName !== 'string' || !accountName.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Account verification required: Paystack verified account name is missing.' })
        };
      }

      const userDocRef = doc(db, 'users', verifiedUser.uid);
      const walletDocRef = doc(db, 'wallets', verifiedUser.uid);

      const now = new Date();
      const isoDate = now.toISOString();
      const dateStr = isoDate.split('T')[0];
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      const monthStr = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const reference = `WREQ-${now.getTime().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      
      const txnRand = crypto.randomBytes(4).toString('hex').toUpperCase();
      const transactionId = `ZN-WTH-TXN-${dateStr.replace(/-/g, '').slice(0, 6)}-${now.getTime().toString(36).toUpperCase()}-${txnRand}`;
      
      const requestDocRef = doc(db, 'withdrawal_requests', reference);
      const txDocRef = doc(db, 'wallet_transactions', `tx_${reference}`);
      const txnIdDocRef = doc(db, 'withdrawal_transaction_ids', transactionId);

      let createdWithdrawalRecord: any = null;
      let finalNewBalance = 0;

      await runTransaction(db, async (transaction) => {
        const existingTxnSnap = await transaction.get(txnIdDocRef);
        if (existingTxnSnap.exists()) {
          throw new Error(`Conflict: Withdrawal Transaction ID ${transactionId} already exists in database.`);
        }

        const uSnap = await transaction.get(userDocRef);
        if (!uSnap.exists()) {
          throw new Error('User record not found.');
        }

        const uData = uSnap.data();
        const currentBalance = typeof uData.walletBalance === 'number'
          ? uData.walletBalance
          : Number(uData.walletBalance || uData.balance || 0);

        if (currentBalance < amount) {
          throw new Error(`Insufficient withdrawable balance. Your available balance is ₦${currentBalance.toLocaleString()}, but you requested ₦${amount.toLocaleString()}.`);
        }

        let withdrawalId = uData.withdrawalId;
        if (!withdrawalId || typeof withdrawalId !== 'string' || !withdrawalId.trim()) {
          withdrawalId = generatePermanentWithdrawalId();
        }

        finalNewBalance = Math.round((currentBalance - amount) * 100) / 100;

        transaction.set(userDocRef, {
          walletBalance: finalNewBalance,
          balance: finalNewBalance,
          withdrawalId,
          updatedAt: isoDate
        }, { merge: true });

        transaction.set(walletDocRef, {
          userId: verifiedUser.uid,
          walletBalance: finalNewBalance,
          balance: finalNewBalance,
          updatedAt: isoDate
        }, { merge: true });

        transaction.set(txnIdDocRef, {
          transactionId,
          category: 'withdrawal',
          reference,
          userId: verifiedUser.uid,
          userEmail: verifiedUser.email || '',
          amount,
          createdAt: isoDate,
          createdDate: dateStr,
          createdTime: timeStr,
          month: monthStr
        });

        createdWithdrawalRecord = {
          id: reference,
          transactionId,
          category: 'withdrawal',
          userId: verifiedUser.uid,
          userName: uData.displayName || uData.username || uData.fullName || (verifiedUser.email ? verifiedUser.email.split('@')[0] : 'User'),
          userEmail: verifiedUser.email || '',
          withdrawalId,
          amount,
          currency: 'NGN',
          bankName: bankName.trim(),
          bankCode: (bankCode || '').trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          status: 'pending',
          createdAt: isoDate,
          createdDate: dateStr,
          createdTime: timeStr,
          month: monthStr,
          reference,
          notes: (notes || '').trim(),
        };

        transaction.set(requestDocRef, createdWithdrawalRecord);

        transaction.set(txDocRef, {
          id: `tx_${reference}`,
          transactionId,
          userId: verifiedUser.uid,
          type: 'withdrawal',
          category: 'withdrawal',
          amount,
          description: `Withdrawal payout requested: ₦${amount.toLocaleString()} to ${bankName.trim()} (${accountNumber.trim()})`,
          date: isoDate,
          status: 'pending',
          reference,
          channel: 'bank_transfer'
        });
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `Withdrawal request for ₦${amount.toLocaleString()} created successfully.`,
          reference,
          transactionId,
          newBalance: finalNewBalance,
          withdrawal: createdWithdrawalRecord
        })
      };
    }

    // -------------------------------------------------------------
    // Helper to check Owner / Admin rights
    // -------------------------------------------------------------
    const checkIsAdminOrOwner = async (): Promise<boolean> => {
      const userDocRef = doc(db, 'users', verifiedUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};
      const email = verifiedUser.email || userData.email || '';
      const isOwner = email === 'azeezmusharaf4@gmail.com' || userData.role === 'admin' || userData.role === 'owner';
      return isOwner;
    };

    // -------------------------------------------------------------
    // 2. GET ALL HISTORY (ADMIN / OWNER): subAction === 'all-history'
    // -------------------------------------------------------------
    if (subAction === 'all-history' || subAction === 'history') {
      const isAdmin = await checkIsAdminOrOwner();
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Forbidden: Access restricted to authorized website Owner & Admins only.' })
        };
      }

      const wCol = collection(db, 'withdrawal_requests');
      const wSnap = await getDocs(wCol);
      const withdrawals = wSnap.docs.map(d => {
        const data = d.data();
        const created = data.createdAt ? new Date(data.createdAt) : new Date(0);
        const dateStr = data.createdDate || (data.createdAt ? data.createdAt.split('T')[0] : '');
        const timeStr = data.createdTime || (data.createdAt ? new Date(data.createdAt).toLocaleTimeString('en-US', { hour12: false }) : '');
        const monthStr = data.month || (created.getTime() > 0 ? created.toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown');
        const transactionId = data.transactionId || data.reference || data.id;
        return {
          id: d.id,
          ...data,
          transactionId,
          category: 'withdrawal',
          createdDate: dateStr,
          createdTime: timeStr,
          month: monthStr
        };
      });

      withdrawals.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          count: withdrawals.length,
          withdrawals
        })
      };
    }

    // -------------------------------------------------------------
    // 3. CONFIRM PAYMENT (ADMIN / OWNER): subAction === 'confirm-payment'
    // -------------------------------------------------------------
    if (subAction === 'confirm-payment') {
      const isAdmin = await checkIsAdminOrOwner();
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Forbidden: Access restricted to authorized website Owner & Admins only.' })
        };
      }

      const { requestId, adminNotes } = payload;
      if (!requestId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing requestId parameter.' })
        };
      }

      let reqDocRef = doc(db, 'withdrawal_requests', requestId);
      let reqSnap = await getDoc(reqDocRef);

      if (!reqSnap.exists()) {
        const q = query(collection(db, 'withdrawal_requests'), where('transactionId', '==', requestId));
        const s = await getDocs(q);
        if (!s.empty) {
          reqDocRef = doc(db, 'withdrawal_requests', s.docs[0].id);
          reqSnap = s.docs[0];
        }
      }

      if (!reqSnap.exists()) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Withdrawal request not found.' })
        };
      }

      const reqData = reqSnap.data();
      const isoDate = new Date().toISOString();
      await updateDoc(reqDocRef, {
        status: 'confirmed',
        confirmedAt: isoDate,
        confirmedBy: verifiedUser.email || 'Owner',
        confirmedByUid: verifiedUser.uid,
        adminNotes: (adminNotes || '').trim(),
        updatedAt: isoDate
      });

      const refKey = reqData.reference || reqSnap.id;
      const txDocRef = doc(db, 'wallet_transactions', refKey.startsWith('tx_') ? refKey : `tx_${refKey}`);
      try {
        await updateDoc(txDocRef, {
          status: 'confirmed',
          updatedAt: isoDate
        });
      } catch (e) {
        // ignore
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Withdrawal payment confirmed.',
          status: 'confirmed',
          confirmedAt: isoDate
        })
      };
    }

    // -------------------------------------------------------------
    // 4. UPDATE STATUS (ADMIN / OWNER): subAction === 'update-status'
    // -------------------------------------------------------------
    if (subAction === 'update-status') {
      const isAdmin = await checkIsAdminOrOwner();
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Forbidden: Access restricted to authorized website Owner & Admins only.' })
        };
      }

      const { requestId, status: newStatus, adminNotes } = payload;
      if (!requestId || !['confirmed', 'approved', 'completed', 'rejected', 'failed'].includes(newStatus)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid request parameters or status.' })
        };
      }

      let reqDocRef = doc(db, 'withdrawal_requests', requestId);
      let reqSnap = await getDoc(reqDocRef);

      if (!reqSnap.exists()) {
        const q = query(collection(db, 'withdrawal_requests'), where('transactionId', '==', requestId));
        const s = await getDocs(q);
        if (!s.empty) {
          reqDocRef = doc(db, 'withdrawal_requests', s.docs[0].id);
          reqSnap = s.docs[0];
        }
      }

      if (!reqSnap.exists()) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Withdrawal request not found.' })
        };
      }

      const reqData = reqSnap.data();
      const previousStatus = reqData.status;

      if (previousStatus === newStatus) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, status: newStatus })
        };
      }

      const isoDate = new Date().toISOString();

      if (['rejected', 'failed'].includes(newStatus) && !['rejected', 'failed'].includes(previousStatus)) {
        const targetUid = reqData.userId;
        const refundAmount = Number(reqData.amount);

        await runTransaction(db, async (transaction) => {
          const uRef = doc(db, 'users', targetUid);
          const wRef = doc(db, 'wallets', targetUid);
          const uSnap = await transaction.get(uRef);

          if (uSnap.exists()) {
            const curBal = Number(uSnap.data().walletBalance ?? uSnap.data().balance ?? 0);
            const newBal = Math.round((curBal + refundAmount) * 100) / 100;
            transaction.set(uRef, { walletBalance: newBal, balance: newBal, updatedAt: isoDate }, { merge: true });
            transaction.set(wRef, { walletBalance: newBal, balance: newBal, updatedAt: isoDate }, { merge: true });
          }

          const refundTxRef = doc(db, 'wallet_transactions', `tx_ref_${requestId}`);
          transaction.set(refundTxRef, {
            id: `tx_ref_${requestId}`,
            userId: targetUid,
            type: 'deposit',
            amount: refundAmount,
            description: `Refund for rejected withdrawal request ${requestId}${adminNotes ? `: ${adminNotes}` : ''}`,
            date: isoDate,
            status: 'completed',
            reference: `REF-${requestId}`,
            channel: 'system_refund'
          });

          transaction.update(reqDocRef, {
            status: 'rejected',
            adminNotes: (adminNotes || '').trim(),
            updatedAt: isoDate,
            updatedBy: verifiedUser.email || 'Admin'
          });
        });
      } else {
        await updateDoc(reqDocRef, {
          status: newStatus,
          adminNotes: (adminNotes || '').trim(),
          updatedAt: isoDate,
          updatedBy: verifiedUser.email || 'Admin'
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `Withdrawal request status updated to ${newStatus}.`,
          status: newStatus
        })
      };
    }

    // -------------------------------------------------------------
    // 5. SEARCH TRANSACTION ID (ADMIN / OWNER): subAction === 'search-transaction'
    // -------------------------------------------------------------
    if (subAction === 'search-transaction') {
      const isAdmin = await checkIsAdminOrOwner();
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Forbidden: Access restricted to authorized website Owner & Admins only.' })
        };
      }

      const { transactionId: rawId } = payload;
      if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Please enter a valid Transaction ID to search.' })
        };
      }

      const cleanId = rawId.trim();
      let matchedDoc: any = null;

      const q1 = query(collection(db, 'withdrawal_requests'), where('transactionId', '==', cleanId));
      const s1 = await getDocs(q1);
      if (!s1.empty) {
        matchedDoc = { id: s1.docs[0].id, ...s1.docs[0].data() };
      }

      if (!matchedDoc) {
        const docSnap = await getDoc(doc(db, 'withdrawal_requests', cleanId));
        if (docSnap.exists()) {
          matchedDoc = { id: docSnap.id, ...docSnap.data() };
        }
      }

      if (!matchedDoc) {
        const q2 = query(collection(db, 'withdrawal_requests'), where('reference', '==', cleanId));
        const s2 = await getDocs(q2);
        if (!s2.empty) {
          matchedDoc = { id: s2.docs[0].id, ...s2.docs[0].data() };
        }
      }

      if (!matchedDoc) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Transaction ID not found.' })
        };
      }

      const created = matchedDoc.createdAt ? new Date(matchedDoc.createdAt) : new Date(0);
      const dateStr = matchedDoc.createdDate || (matchedDoc.createdAt ? matchedDoc.createdAt.split('T')[0] : '');
      const timeStr = matchedDoc.createdTime || (matchedDoc.createdAt ? new Date(matchedDoc.createdAt).toLocaleTimeString('en-US', { hour12: false }) : '');
      const monthStr = matchedDoc.month || (created.getTime() > 0 ? created.toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown');

      const formatted = {
        id: matchedDoc.id,
        ...matchedDoc,
        transactionId: matchedDoc.transactionId || matchedDoc.reference || matchedDoc.id,
        category: 'withdrawal',
        createdDate: dateStr,
        createdTime: timeStr,
        month: monthStr
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, transaction: formatted })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: `Unsupported withdrawal action: ${subAction}` })
    };

  } catch (err: any) {
    console.error('Error in Netlify withdrawals-manage:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Withdrawal processing failed.' })
    };
  }
};
