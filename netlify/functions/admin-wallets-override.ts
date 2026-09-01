import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from './_firebase';

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-caller-email, x-admin-email',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let body: any = {};
    if (typeof event.body === 'string') {
      try {
        body = JSON.parse(event.body);
      } catch {
        body = {};
      }
    } else if (event.body) {
      body = event.body;
    }

    const callerEmail = body.callerEmail || event.queryStringParameters?.callerEmail || event.headers?.['x-caller-email'] || event.headers?.['x-admin-email'] || '';
    const targetUid = body.targetUid || event.queryStringParameters?.targetUid || '';
    const targetEmail = body.targetEmail || event.queryStringParameters?.targetEmail || '';
    const action = body.action || event.queryStringParameters?.action || 'set';
    const amount = body.amount !== undefined ? body.amount : event.queryStringParameters?.amount;
    const reason = (body.reason || event.queryStringParameters?.reason || 'Manual Admin Wallet Balance Override').trim();

    const normalizedCaller = (callerEmail || '').trim().toLowerCase();
    const isAuthorizedOwner = normalizedCaller === 'azeezmusharaf4@gmail.com';

    if (!isAuthorizedOwner) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Forbidden: Access Denied. Only the verified Owner (Azeezmusharaf4@gmail.com) is authorized to access the Admin Wallet Override tool.'
        })
      };
    }

    if (!targetUid && !targetEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Target user ID or email is required for wallet balance override.'
        })
      };
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'A valid non-negative amount must be specified.'
        })
      };
    }

    if (!['set', 'add', 'deduct'].includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid action specified. Must be "set", "add", or "deduct".'
        })
      };
    }

    const db = getDb();
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database service is not initialized.'
        })
      };
    }

    let resolvedUid = targetUid;
    let targetUserData: any = null;

    if (resolvedUid) {
      const userRef = doc(db, 'users', resolvedUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        targetUserData = userSnap.data();
      }
    }

    if (!targetUserData && targetEmail) {
      const normalizedTargetEmail = targetEmail.trim().toLowerCase();
      const usersQ = query(collection(db, 'users'), where('email', '==', normalizedTargetEmail));
      const usersSnap = await getDocs(usersQ);
      if (!usersSnap.empty) {
        resolvedUid = usersSnap.docs[0].id;
        targetUserData = usersSnap.docs[0].data();
      }
    }

    if (!resolvedUid) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Target user could not be found in Firestore database.'
        })
      };
    }

    const previousBalance = Number(targetUserData?.walletBalance) || 0;
    let newBalance = previousBalance;

    if (action === 'set') {
      newBalance = numericAmount;
    } else if (action === 'add') {
      newBalance = previousBalance + numericAmount;
    } else if (action === 'deduct') {
      newBalance = Math.max(0, previousBalance - numericAmount);
    }

    const userDocRef = doc(db, 'users', resolvedUid);
    const resolvedEmail = targetUserData?.email || targetEmail || '';

    if (targetUserData) {
      await updateDoc(userDocRef, {
        walletBalance: newBalance,
        lastWalletOverrideAt: new Date().toISOString(),
        lastWalletOverrideBy: 'Azeezmusharaf4@gmail.com'
      });
    } else {
      await setDoc(userDocRef, {
        uid: resolvedUid,
        walletBalance: newBalance,
        email: resolvedEmail,
        createdAt: new Date().toISOString(),
        lastWalletOverrideAt: new Date().toISOString(),
        lastWalletOverrideBy: 'Azeezmusharaf4@gmail.com'
      }, { merge: true });
    }

    const txId = `OVERRIDE_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const txDocRef = doc(db, 'wallet_transactions', txId);

    await setDoc(txDocRef, {
      id: txId,
      userId: resolvedUid,
      userEmail: resolvedEmail,
      amount: Math.abs(newBalance - previousBalance),
      previousBalance,
      newBalance,
      action,
      type: action === 'deduct' ? 'deduction' : 'deposit',
      method: 'admin_wallet_override',
      status: 'successful',
      adminEmail: 'Azeezmusharaf4@gmail.com',
      reason: reason || 'Manual Admin Wallet Balance Override',
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully overridden wallet balance for ${resolvedEmail || resolvedUid}. Updated from ₦${previousBalance.toLocaleString()} to ₦${newBalance.toLocaleString()}.`,
        targetUid: resolvedUid,
        targetEmail: resolvedEmail,
        previousBalance,
        newBalance,
        action,
        amount: numericAmount,
        txId
      })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Internal error processing admin wallet override'
      })
    };
  }
};
