import { getDb, ensureServerAuthenticated, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';

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
    const queryListingId = event.queryStringParameters?.listingId || '';
    const queryOrderId = event.queryStringParameters?.orderId || '';

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

      const targetListingId = metadata.listingId || queryListingId || '';
      const targetOrderId = metadata.orderId || queryOrderId || '';
      const isLogPurchase = metadata.type === 'log' || metadata.transactionCategory === 'log' || (metadata.isWalletFunding === false && targetListingId) || (Boolean(targetListingId) && !metadata.isWalletFunding);

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

      await ensureServerAuthenticated();
      const db = getDb();
      let finalVerifiedBalance: number | undefined;

      if (db) {
        try {
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
            }
          }

          // Check if transaction already processed
          const txDocRef = doc(db, 'wallet_transactions', reference);
          const txSnap = await getDoc(txDocRef);

          if (txSnap.exists()) {
            const existingTx = txSnap.data();
            let existingPurchase: any = null;
            if (existingTx.purchaseId) {
              const pDoc = await getDoc(doc(db, 'purchases', existingTx.purchaseId));
              if (pDoc.exists()) {
                existingPurchase = { id: pDoc.id, ...pDoc.data() };
              }
            }

            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                verified: true,
                alreadyProcessed: true,
                status: 'success',
                delivered: Boolean(existingPurchase),
                purchaseRecord: existingPurchase,
                reference: pstData.reference,
                amount: existingTx.amount || amountNaira,
                currency: pstData.currency || 'NGN',
                paidAt: pstData.paid_at || pstData.paidAt,
                channel: pstData.channel,
                buyerEmail: customerEmail,
                userId: targetUid || existingTx.userId,
                gateway: 'paystack'
              })
            };
          }

          // Case A: Direct LOG Account Purchase via Paystack
          if (isLogPurchase && targetListingId && targetUid) {
            const effectiveOrderId = targetOrderId || `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            const transferCode = `ZENET-ESCROW-${Math.floor(1000 + Math.random() * 9000)}-PST`;
            const listingDocRef = doc(db, 'listings', targetListingId);

            let createdPurchaseRecord: any = null;

            await runTransaction(db, async (t) => {
              const uDocRef = doc(db, 'users', String(targetUid));
              const uDocSnap = await t.get(uDocRef);
              const uData = uDocSnap.exists() ? uDocSnap.data() : {};

              const liveListingSnap = await t.get(listingDocRef);
              if (!liveListingSnap.exists()) {
                throw new Error('Listing does not exist');
              }
              const liveListingData = liveListingSnap.data();

              let secureDetails: any = null;
              let remainingStock = 0;

              if (Array.isArray(liveListingData.inventory) && liveListingData.inventory.length > 0) {
                const availableIdx = liveListingData.inventory.findIndex((acc: any) => (acc.status || '').toLowerCase() === 'available' || acc.status === 'Available');
                if (availableIdx !== -1) {
                  const targetAcc = liveListingData.inventory[availableIdx];
                  secureDetails = {
                    inventoryId: targetAcc.id || `inv_${availableIdx + 1}`,
                    accountEmail: targetAcc.accountEmail || targetAcc.email || '',
                    accountPassword: targetAcc.accountPassword || targetAcc.password || '',
                    recoveryInfo: targetAcc.recoveryInfo || targetAcc.notes || '',
                    backupCodes: targetAcc.backupCodes || targetAcc.twoFactorBackupCodes || targetAcc.twoFactorSecretKey || '',
                    twoFactorSecretKey: targetAcc.twoFactorSecretKey || '',
                    twoFactorBackupCodes: targetAcc.twoFactorBackupCodes || targetAcc.backupCodes || '',
                    additionalInstructions: targetAcc.additionalInstructions || ''
                  };

                  const updatedInventory = [...liveListingData.inventory];
                  updatedInventory[availableIdx] = {
                    ...targetAcc,
                    status: 'Sold',
                    soldTo: String(targetUid),
                    soldToEmail: customerEmail || uData.email || '',
                    orderId: effectiveOrderId,
                    soldAt: new Date().toISOString()
                  };

                  const remainingAvailable = updatedInventory.filter((acc: any) => (acc.status || '').toLowerCase() === 'available' || acc.status === 'Available').length;
                  remainingStock = remainingAvailable;

                  t.update(listingDocRef, {
                    inventory: updatedInventory,
                    stock: remainingAvailable,
                    stockCount: remainingAvailable,
                    status: remainingAvailable > 0 ? 'active' : 'sold'
                  });
                }
              }

              if (!secureDetails) {
                secureDetails = liveListingData.digitalProductDetails ? {
                  accountEmail: liveListingData.digitalProductDetails.accountEmail || liveListingData.digitalProductDetails.email || '',
                  accountPassword: liveListingData.digitalProductDetails.accountPassword || liveListingData.digitalProductDetails.password || '',
                  recoveryInfo: liveListingData.digitalProductDetails.recoveryInfo || '',
                  backupCodes: liveListingData.digitalProductDetails.backupCodes || liveListingData.digitalProductDetails.twoFactorBackupCodes || '',
                  twoFactorSecretKey: liveListingData.digitalProductDetails.twoFactorSecretKey || '',
                  twoFactorBackupCodes: liveListingData.digitalProductDetails.twoFactorBackupCodes || '',
                  additionalInstructions: liveListingData.digitalProductDetails.additionalInstructions || ''
                } : undefined;

                remainingStock = 0;
                t.update(listingDocRef, { stock: 0, stockCount: 0, status: 'sold' });
              }

              createdPurchaseRecord = {
                id: purchaseId,
                orderId: effectiveOrderId,
                listingId: targetListingId,
                listingTitle: liveListingData.title,
                price: liveListingData.price,
                paidAmount: amountNaira,
                currency: 'NGN',
                type: 'log',
                category: liveListingData.category || 'Other',
                transactionCategory: 'log',
                sellerId: liveListingData.sellerId || '',
                sellerName: liveListingData.sellerName || 'Seller',
                sellerEmail: liveListingData.sellerEmail || '',
                buyerId: String(targetUid),
                buyerName: metadata.buyerName || uData.displayName || (customerEmail ? customerEmail.split('@')[0] : 'Buyer'),
                buyerEmail: customerEmail || uData.email || '',
                paymentGateway: 'paystack',
                transactionId: reference,
                paystackReference: reference,
                purchasedAt: new Date().toISOString(),
                status: 'escrow_holding',
                transferCode: transferCode,
                imageUrl: liveListingData.imageUrl || '',
                digitalProductDetails: secureDetails
              };

              t.set(doc(db, 'purchases', purchaseId), createdPurchaseRecord);

              t.set(doc(db, 'orders', effectiveOrderId), {
                id: effectiveOrderId,
                orderId: effectiveOrderId,
                type: 'log_account',
                userId: String(targetUid),
                buyerEmail: customerEmail || uData.email || '',
                buyerName: metadata.buyerName || uData.displayName || '',
                listingId: targetListingId,
                listingTitle: liveListingData.title,
                amount: amountNaira,
                currency: 'NGN',
                paymentGateway: 'paystack',
                paystackReference: reference,
                status: 'completed',
                paymentStatus: 'success',
                purchaseId: purchaseId,
                deliveredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }, { merge: true });

              t.set(doc(db, 'wallet_transactions', reference), {
                id: reference,
                reference: reference,
                paystackReference: reference,
                orderId: effectiveOrderId,
                purchaseId: purchaseId,
                userId: String(targetUid),
                userEmail: customerEmail || uData.email || '',
                amount: amountNaira,
                type: 'purchase',
                method: 'paystack_checkout',
                status: 'successful',
                description: `Purchased: ${liveListingData.title}`,
                date: new Date().toISOString().replace('T', ' ').slice(0, 16),
                createdAt: new Date().toISOString()
              });

              if (uDocSnap.exists()) {
                t.update(uDocRef, {
                  totalPurchasesAmount: (uData.totalPurchasesAmount || 0) + amountNaira,
                  updatedAt: new Date().toISOString()
                });
              }
            });

            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                verified: true,
                status: 'success',
                delivered: true,
                purchaseRecord: createdPurchaseRecord,
                reference: pstData.reference || reference,
                amount: amountNaira,
                currency: pstData.currency || 'NGN',
                paidAt: pstData.paid_at || pstData.paidAt,
                channel: pstData.channel,
                buyerEmail: customerEmail,
                userId: String(targetUid),
                gateway: 'paystack'
              })
            };
          }

          // Case B: Wallet Deposit
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
                date: new Date().toISOString().replace('T', ' ').slice(0, 16),
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
