import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-paystack-signature',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
    const paystackSecretKey = rawSecretKey ? rawSecretKey.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    // Extract reference from query or path
    let reference = event.queryStringParameters?.reference || event.queryStringParameters?.trxref || '';
    if (!reference && event.path) {
      const parts = event.path.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== 'paystack-verify' && last !== 'verify') {
        reference = decodeURIComponent(last);
      }
    }
    if (!reference && event.headers?.['x-forwarded-uri']) {
      const parts = event.headers['x-forwarded-uri'].split('?')[0].split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== 'verify' && last !== 'paystack-verify') {
        reference = decodeURIComponent(last);
      }
    }
    if (!reference && event.rawUrl) {
      try {
        const u = new URL(event.rawUrl);
        reference = u.searchParams.get('reference') || u.searchParams.get('trxref') || '';
      } catch {}
    }
    const queryUserId = event.queryStringParameters?.userId || '';

    if (!reference) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ verified: false, error: 'Transaction reference is missing' })
      };
    }

    if (!paystackSecretKey || !paystackSecretKey.startsWith('sk_')) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          verified: false,
          error: 'PAYSTACK_SECRET_KEY is missing or not configured in Netlify environment variables.'
        })
      };
    }

    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const paystackData: any = await paystackRes.json();

    if (paystackData.status && paystackData.data && paystackData.data.status === 'success') {
      const pstData = paystackData.data;
      const paidAmountKobo = pstData.amount;
      const amountNaira = paidAmountKobo / 100;
      const metadata = pstData.metadata || {};
      const customerEmail = (pstData.customer?.email || '').trim().toLowerCase();
      const customerCode = pstData.customer?.customer_code;

      let targetUid: string | null = metadata.userId || queryUserId || null;
      if (!targetUid && Array.isArray(metadata.custom_fields)) {
        const uField = metadata.custom_fields.find((f: any) => f.variable_name === 'user_id' || f.variable_name === 'userId');
        if (uField && uField.value) {
          targetUid = String(uField.value);
        }
      }

      const expectedAmountNaira = metadata.expectedAmountNaira || metadata.priceNaira;
      if (expectedAmountNaira && Number(expectedAmountNaira) > 0) {
        const expectedKobo = Math.round(Number(expectedAmountNaira) * 100);
        if (paidAmountKobo < expectedKobo) {
          console.error(`[Netlify Paystack Verify] Amount mismatch for ref ${reference}: Paid ₦${amountNaira}, expected ₦${expectedAmountNaira}`);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              verified: false,
              status: 'amount_mismatch',
              error: `Payment amount mismatch: Paid ₦${amountNaira} but expected ₦${expectedAmountNaira}`
            })
          };
        }
      }

      // Update Firestore user wallet & transaction ledger with idempotency
      let finalVerifiedBalance: number | undefined;
      const db = getDb();
      if (db) {
        try {
          const txDocRef = doc(db, 'wallet_transactions', reference);
          const txSnap = await getDoc(txDocRef);

          if (txSnap.exists()) {
            console.log(`[Netlify Paystack Verify] Reference ${reference} already processed in wallet_transactions.`);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                verified: true,
                alreadyProcessed: true,
                status: 'success',
                reference: pstData.reference,
                amount: txSnap.data()?.amount || amountNaira,
                currency: pstData.currency || 'NGN',
                paidAt: pstData.paid_at || pstData.paidAt,
                channel: pstData.channel,
                buyerEmail: customerEmail,
                userId: targetUid || txSnap.data()?.userId,
                gateway: 'paystack'
              })
            };
          }

          // If targetUid is not resolved, search by customer code or email
          if (!targetUid && customerCode) {
            const custCodeQ = query(collection(db, 'users'), where('paystackCustomerCode', '==', customerCode));
            const custCodeSnap = await getDocs(custCodeQ);
            if (!custCodeSnap.empty) {
              targetUid = custCodeSnap.docs[0].id;
            }
          }

          if (!targetUid && customerEmail) {
            const usersQ = query(collection(db, 'users'), where('email', '==', customerEmail));
            const usersSnap = await getDocs(usersQ);
            if (!usersSnap.empty) {
              targetUid = usersSnap.docs[0].id;
            } else {
              const allUsersSnap = await getDocs(collection(db, 'users'));
              for (const uDoc of allUsersSnap.docs) {
                const uEmail = (uDoc.data().email || '').toLowerCase().trim();
                if (uEmail === customerEmail) {
                  targetUid = uDoc.id;
                  break;
                }
              }
            }
          }

          if (targetUid) {
            const uDocRef = doc(db, 'users', String(targetUid));
            const walletDocRef = doc(db, 'wallets', String(targetUid));
            let newBalance = amountNaira;

            await runTransaction(db, async (transaction) => {
              const uDocSnap = await transaction.get(uDocRef);
              const uData = uDocSnap.exists() ? uDocSnap.data() : {};
              const rawBal = uData.walletBalance !== undefined ? uData.walletBalance : uData.balance;
              const currentBal = typeof rawBal === 'number' ? rawBal : (rawBal ? Number(rawBal) : 0);
              newBalance = currentBal + amountNaira;

              if (uDocSnap.exists()) {
                transaction.update(uDocRef, {
                  walletBalance: newBalance,
                  balance: newBalance,
                  lastFundedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
              } else {
                transaction.set(uDocRef, {
                  id: String(targetUid),
                  uid: String(targetUid),
                  email: customerEmail || '',
                  walletBalance: newBalance,
                  balance: newBalance,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }, { merge: true });
              }

              transaction.set(walletDocRef, {
                userId: String(targetUid),
                userEmail: customerEmail || '',
                walletBalance: newBalance,
                balance: newBalance,
                updatedAt: new Date().toISOString()
              }, { merge: true });

              transaction.set(txDocRef, {
                id: reference,
                reference: reference,
                userId: String(targetUid),
                userEmail: customerEmail || '',
                amount: amountNaira,
                previousBalance: currentBal,
                newBalance: newBalance,
                walletBalance: newBalance,
                balance: newBalance,
                type: 'deposit',
                method: 'paystack',
                status: 'successful',
                paystackReference: reference,
                description: metadata.listingTitle || 'Paystack Wallet Deposit',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString()
              });
            });

            finalVerifiedBalance = newBalance;
            console.log(`[Netlify Paystack Verify] Credited ₦${amountNaira} to User ${targetUid}. New Bal: ₦${newBalance}`);
          }
        } catch (creditErr) {
          console.warn('[Netlify Paystack Verify] Wallet credit notice:', creditErr);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          verified: true,
          status: 'success',
          reference: pstData.reference,
          amount: amountNaira,
          newBalance: typeof finalVerifiedBalance !== 'undefined' ? finalVerifiedBalance : amountNaira,
          currency: pstData.currency || 'NGN',
          paidAt: pstData.paid_at || pstData.paidAt,
          channel: pstData.channel,
          buyerEmail: customerEmail,
          userId: targetUid,
          gateway: 'paystack',
          raw: pstData
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          verified: false,
          status: paystackData.data?.status || 'failed',
          error: paystackData.message || 'Payment verification failed on Paystack.'
        })
      };
    }
  } catch (err: any) {
    console.error('[Netlify Paystack Verify] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ verified: false, error: err.message || 'Payment verification error' })
    };
  }
};
