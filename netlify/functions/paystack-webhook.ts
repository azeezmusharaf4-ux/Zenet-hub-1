import crypto from 'crypto';
import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-paystack-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
    const paystackSecretKey = rawSecretKey ? rawSecretKey.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    const signature = event.headers?.['x-paystack-signature'] || event.headers?.['X-Paystack-Signature'] || '';

    const rawPayload = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {}));

    // Verify HMAC SHA-512 signature if secret key is present
    if (paystackSecretKey && signature) {
      const hash = crypto.createHmac('sha512', paystackSecretKey)
        .update(rawPayload)
        .digest('hex');

      if (hash.toLowerCase() !== signature.toLowerCase()) {
        console.warn('[Netlify Paystack Webhook] Invalid Paystack signature received.');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid HMAC signature' })
        };
      }
    }

    let parsedEvent: any = {};
    try {
      parsedEvent = JSON.parse(rawPayload);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    if (!parsedEvent || !parsedEvent.event) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid event structure' }) };
    }

    console.log(`[Netlify Paystack Webhook] Event Received: ${parsedEvent.event}`);

    if (parsedEvent.event === 'charge.success') {
      const data = parsedEvent.data || {};
      const reference = data.reference || `PAY_${data.id}`;
      const amountNGN = data.amount ? data.amount / 100 : 0;
      const customerEmail = (data.customer?.email || '').trim().toLowerCase();
      const customerCode = data.customer?.customer_code;
      const accountNumber = data.authorization?.account_number || data.dedicated_account?.account_number || data.authorization?.receiver_bank_account_number || '';
      const bankName = data.authorization?.bank || data.dedicated_account?.bank?.name || 'Bank Transfer';

      console.log(`[Netlify Paystack Webhook] Processing charge.success for ₦${amountNGN} (Ref: ${reference}, Customer: ${customerEmail || customerCode})`);

      // Safe metadata parsing
      let metadataObj: any = {};
      if (data.metadata) {
        if (typeof data.metadata === 'string') {
          try {
            metadataObj = JSON.parse(data.metadata);
          } catch (e) {
            console.warn('[Netlify Paystack Webhook] Metadata parse warning:', e);
          }
        } else {
          metadataObj = data.metadata;
        }
      }

      // Extract target user ID
      let targetUserId: string | null = metadataObj.userId || null;
      if (!targetUserId && Array.isArray(metadataObj.custom_fields)) {
        const uField = metadataObj.custom_fields.find((f: any) => f.variable_name === 'user_id' || f.variable_name === 'userId');
        if (uField && uField.value) {
          targetUserId = String(uField.value);
        }
      }

      const db = getDb();
      if (db) {
        try {
          const txDocRef = doc(db, 'wallet_transactions', reference);
          const txSnap = await getDoc(txDocRef);

          if (txSnap.exists()) {
            console.log(`[Netlify Paystack Webhook] Reference ${reference} already credited. Skipping duplicate.`);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ status: 'success', message: 'Transaction already processed (Idempotent)', reference })
            };
          }

          // If targetUserId is not yet found, look up by customerCode
          if (!targetUserId && customerCode) {
            const custCodeQ = query(collection(db, 'users'), where('paystackCustomerCode', '==', customerCode));
            const custCodeSnap = await getDocs(custCodeQ);
            if (!custCodeSnap.empty) {
              targetUserId = custCodeSnap.docs[0].id;
            }
          }

          // If still not found, look up by customer email
          if (!targetUserId && customerEmail) {
            const usersQ = query(collection(db, 'users'), where('email', '==', customerEmail));
            const usersSnap = await getDocs(usersQ);
            if (!usersSnap.empty) {
              targetUserId = usersSnap.docs[0].id;
            } else {
              // Fallback: search across all users case-insensitively
              const allUsersSnap = await getDocs(collection(db, 'users'));
              for (const uDoc of allUsersSnap.docs) {
                const uData = uDoc.data();
                const uEmail = (uData.email || '').toLowerCase().trim();
                if (uEmail === customerEmail) {
                  targetUserId = uDoc.id;
                  break;
                }
              }
            }
          }

          if (targetUserId) {
            const userRef = doc(db, 'users', targetUserId);
            let finalNewBalance = amountNGN;

            await runTransaction(db, async (transaction) => {
              const uSnap = await transaction.get(userRef);
              const curBal = uSnap.exists() ? Number(uSnap.data().walletBalance || 0) : 0;
              finalNewBalance = curBal + amountNGN;

              if (uSnap.exists()) {
                transaction.update(userRef, {
                  walletBalance: finalNewBalance,
                  updatedAt: new Date().toISOString()
                });
              } else {
                transaction.set(userRef, {
                  id: targetUserId,
                  email: customerEmail || '',
                  walletBalance: finalNewBalance,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }, { merge: true });
              }

              transaction.set(txDocRef, {
                id: reference,
                userId: targetUserId,
                userEmail: customerEmail || '',
                amount: amountNGN,
                type: 'deposit',
                method: accountNumber ? 'dedicated_virtual_account' : 'paystack',
                status: 'successful',
                paystackReference: reference,
                description: metadataObj.listingTitle || (accountNumber ? `Paystack Virtual Account Deposit (${bankName})` : 'Paystack Online Deposit'),
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                accountNumber: accountNumber || '',
                bankName: bankName || ''
              });
            });

            console.log(`[Netlify Paystack Webhook] Successfully credited ₦${amountNGN} to User ID ${targetUserId}. New balance: ₦${finalNewBalance}`);
          } else {
            console.warn(`[Netlify Paystack Webhook] Could not match transaction ${reference} to a user profile (email: ${customerEmail}, code: ${customerCode})`);
          }
        } catch (dbErr: any) {
          console.error('[Netlify Paystack Webhook] Firestore error:', dbErr);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'success',
          message: 'Webhook processed successfully.',
          reference,
          customerEmail,
          amount: amountNGN
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ignored', message: `Event ${parsedEvent.event} received` })
    };
  } catch (err: any) {
    console.error('[Netlify Paystack Webhook] Server error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Webhook processing error', details: err.message })
    };
  }
};
