import { getDb, doc, getDoc, setDoc, updateDoc, collection, getDocs } from './_firebase';
import { runTransaction } from 'firebase/firestore';

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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const db = getDb();
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Database unavailable' })
      };
    }

    let payload: any = {};
    try {
      payload = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    } catch {
      payload = {};
    }

    const { userId, listingId, buyerEmail } = payload;
    if (!userId || !listingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId or listingId parameter.' })
      };
    }

    // Check inventory subcollection pre-fetch
    const invColRef = collection(db, 'listings', listingId, 'inventory');
    let invSnap: any = null;
    try {
      invSnap = await getDocs(invColRef);
    } catch (invErr) {
      console.warn('Inventory subcollection fetch notice:', invErr);
    }
    const hasInventorySubcollection = invSnap && !invSnap.empty;

    let purchaseResult: any = null;

    await runTransaction(db, async (t) => {
      // 1. Fetch user
      const userDocRef = doc(db, 'users', userId);
      const userSnap = await t.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('User profile not found.');
      }
      const userData = userSnap.data() as any;
      const currentBalance = Number(userData.walletBalance || 0);

      // 2. Fetch listing
      const listingDocRef = doc(db, 'listings', listingId);
      const listingSnap = await t.get(listingDocRef);
      if (!listingSnap.exists()) {
        throw new Error('Listing not found.');
      }
      const listingData = listingSnap.data() as any;
      const price = Number(listingData.price || 0);

      if (listingData.status === 'sold') {
        throw new Error('This listing is already sold out.');
      }

      // 3. Balance check
      if (currentBalance < price) {
        throw new Error(`Insufficient wallet balance. Balance: ₦${currentBalance.toLocaleString()}, Price: ₦${price.toLocaleString()}`);
      }

      const txId = `WALLET_TX_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const transferCode = `ZENET-ESCROW-${Math.floor(1000 + Math.random() * 9000)}-WALLET`;
      const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const newBal = currentBalance - price;

      let secureDetails: any = null;
      let remainingStock = 0;

      if (hasInventorySubcollection && invSnap) {
        let targetDocSnap = null;
        let targetDocId = null;
        let availableCount = 0;

        for (const d of invSnap.docs) {
          const liveItemRef = doc(db, 'listings', listingId, 'inventory', d.id);
          const liveItemSnap = await t.get(liveItemRef);
          if (liveItemSnap.exists()) {
            const itemData = liveItemSnap.data() as any;
            const itemStatus = (itemData.status || '').toLowerCase();
            if (itemStatus === 'available' || itemData.status === 'Available') {
              availableCount++;
              if (!targetDocSnap) {
                targetDocSnap = liveItemSnap;
                targetDocId = d.id;
              }
            }
          }
        }

        if (!targetDocSnap || !targetDocId) {
          t.update(listingDocRef, { status: 'sold', stock: 0, stockCount: 0 });
          throw new Error('All accounts in this listing have already been purchased. Stock is 0.');
        }

        const secureRef = doc(db, 'listings', listingId, 'inventory', targetDocId, 'secure', 'details');
        const liveSecureSnap = await t.get(secureRef);
        let secData: any = {};
        if (liveSecureSnap.exists()) {
          secData = liveSecureSnap.data();
        } else {
          secData = targetDocSnap.data();
        }

        secureDetails = {
          inventoryId: targetDocId,
          accountEmail: secData.accountEmail || '',
          accountPassword: secData.accountPassword || '',
          recoveryInfo: secData.recoveryInfo || secData.notes || '',
          backupCodes: secData.backupCodes || secData.twoFactorBackupCodes || secData.twoFactorSecretKey || '',
          twoFactorSecretKey: secData.twoFactorSecretKey || '',
          twoFactorBackupCodes: secData.twoFactorBackupCodes || secData.backupCodes || '',
          additionalInstructions: secData.additionalInstructions || ''
        };

        remainingStock = Math.max(0, availableCount - 1);

        // a. Mark exact inventory account as SOLD
        t.update(targetDocSnap.ref, {
          status: 'Sold',
          soldTo: userId,
          soldToEmail: buyerEmail || userData.email || '',
          orderId: purchaseId,
          soldAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // b. Sync inventory array on listing doc
        let updatedInventoryArray = listingData.inventory;
        if (Array.isArray(updatedInventoryArray)) {
          updatedInventoryArray = updatedInventoryArray.map((invItem: any) => {
            if (invItem.id === targetDocId) {
              return {
                ...invItem,
                status: 'Sold',
                soldTo: userId,
                soldToEmail: buyerEmail || userData.email || '',
                orderId: purchaseId,
                soldAt: new Date().toISOString()
              };
            }
            return invItem;
          });
        }

        // c. Update listing doc
        t.update(listingDocRef, {
          stock: remainingStock,
          stockCount: remainingStock,
          status: remainingStock > 0 ? 'active' : 'sold',
          ...(updatedInventoryArray ? { inventory: updatedInventoryArray } : {})
        });

      } else if (Array.isArray(listingData.inventory) && listingData.inventory.length > 0) {
        const availableIdx = listingData.inventory.findIndex((acc: any) => (acc.status || '').toLowerCase() === 'available' || acc.status === 'Available');
        if (availableIdx === -1) {
          t.update(listingDocRef, { status: 'sold', stock: 0, stockCount: 0 });
          throw new Error('All accounts in this listing have already been purchased. Stock is 0.');
        }

        const targetAcc = listingData.inventory[availableIdx];
        secureDetails = {
          inventoryId: targetAcc.id || `inv_${availableIdx + 1}`,
          accountEmail: targetAcc.accountEmail || '',
          accountPassword: targetAcc.accountPassword || '',
          recoveryInfo: targetAcc.recoveryInfo || targetAcc.notes || '',
          backupCodes: targetAcc.backupCodes || targetAcc.twoFactorBackupCodes || targetAcc.twoFactorSecretKey || '',
          twoFactorSecretKey: targetAcc.twoFactorSecretKey || '',
          twoFactorBackupCodes: targetAcc.twoFactorBackupCodes || targetAcc.backupCodes || '',
          additionalInstructions: targetAcc.additionalInstructions || ''
        };

        const updatedInventory = [...listingData.inventory];
        updatedInventory[availableIdx] = {
          ...targetAcc,
          status: 'Sold',
          soldTo: userId,
          soldToEmail: buyerEmail || userData.email || '',
          orderId: purchaseId,
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

      } else {
        secureDetails = listingData.digitalProductDetails ? {
          accountEmail: listingData.digitalProductDetails.accountEmail || '',
          accountPassword: listingData.digitalProductDetails.accountPassword || '',
          recoveryInfo: listingData.digitalProductDetails.recoveryInfo || '',
          backupCodes: listingData.digitalProductDetails.backupCodes || listingData.digitalProductDetails.twoFactorBackupCodes || '',
          twoFactorSecretKey: listingData.digitalProductDetails.twoFactorSecretKey || '',
          twoFactorBackupCodes: listingData.digitalProductDetails.twoFactorBackupCodes || listingData.digitalProductDetails.backupCodes || '',
          additionalInstructions: listingData.digitalProductDetails.additionalInstructions || ''
        } : undefined;

        remainingStock = 0;
        t.update(listingDocRef, {
          stock: 0,
          stockCount: 0,
          status: 'sold'
        });
      }

      const purchaseRecord = {
        id: purchaseId,
        buyerId: userId,
        buyerEmail: buyerEmail || userData.email || '',
        buyerName: userData.displayName || (userData.email ? userData.email.split('@')[0] : 'Zenet Buyer'),
        sellerId: listingData.sellerId || '',
        sellerEmail: listingData.sellerEmail || '',
        sellerName: listingData.sellerName || 'Market Seller',
        listingId: listingId,
        listingTitle: listingData.title,
        category: listingData.category,
        price: price,
        status: 'escrow_holding',
        escrowStatus: 'held',
        disputeStatus: 'none',
        paymentMethod: 'wallet',
        paystackReference: txId,
        paystackTransferCode: transferCode,
        createdAt: new Date().toISOString(),
        escrowReleaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        ...(secureDetails ? { digitalProductDetails: secureDetails } : {})
      };

      // Create purchase doc
      const purchaseDocRef = doc(db, 'purchases', purchaseId);
      t.set(purchaseDocRef, purchaseRecord);

      // Create transaction log
      const userTxRef = doc(db, 'users', userId, 'transactions', txId);
      t.set(userTxRef, {
        id: txId,
        userId: userId,
        type: 'purchase_escrow',
        amount: price,
        status: 'success',
        description: `Purchased: ${listingData.title} (7-Day Escrow Protected)`,
        timestamp: new Date().toISOString(),
        listingId: listingId,
        reference: txId,
        paystackTransferCode: transferCode,
        balanceAfter: newBal
      });

      // Update buyer wallet balance
      t.update(userDocRef, {
        walletBalance: newBal,
        updatedAt: new Date().toISOString()
      });

      purchaseResult = {
        success: true,
        txId,
        newBalance: newBal,
        purchaseRecord
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(purchaseResult)
    };
  } catch (err: any) {
    console.error('Netlify wallet-purchase error:', err);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Wallet transaction failed.'
      })
    };
  }
};
