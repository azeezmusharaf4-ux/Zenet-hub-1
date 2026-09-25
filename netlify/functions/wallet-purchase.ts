import { getDb, ensureServerAuthenticated, doc, getDoc, setDoc, updateDoc, collection, getDocs, parseAndVerifyToken } from './_firebase';
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
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const verifiedUser = parseAndVerifyToken(authHeader);
    if (!verifiedUser) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required. Please log in to complete purchase.' })
      };
    }

    await ensureServerAuthenticated();
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

    const isOwner = (verifiedUser.email || '').trim().toLowerCase() === 'azeezmusharaf4@gmail.com';
    if (verifiedUser.uid !== userId && !isOwner) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden: You cannot initiate purchases for another user account.' })
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
        let targetDocSnap: any = null;
        let targetDocId = null;
        let availableCount = 0;

        // If listing has an inventory array, follow that exact order first
        if (Array.isArray(listingData.inventory) && listingData.inventory.length > 0) {
          for (const invItem of listingData.inventory) {
            const liveItemRef = doc(db, 'listings', listingId, 'inventory', invItem.id);
            const liveItemSnap = await t.get(liveItemRef);
            if (liveItemSnap.exists()) {
              const itemData = liveItemSnap.data() as any;
              const itemStatus = (itemData.status || '').toLowerCase();
              if (itemStatus === 'available' || itemData.status === 'Available') {
                availableCount++;
                if (!targetDocSnap) {
                  targetDocSnap = liveItemSnap;
                  targetDocId = invItem.id;
                }
              }
            }
          }
        }

        // If not found via array order, check subcollection documents
        if (!targetDocSnap) {
          availableCount = 0;
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

        // Merge array item (which has all form-configured fields), doc data, and secure details
        const matchingArrayItem = Array.isArray(listingData.inventory)
          ? listingData.inventory.find((i: any) => i && i.id === targetDocId)
          : null;

        const mergedRawItem: Record<string, any> = {
          ...(matchingArrayItem || {}),
          ...(targetDocSnap.data() || {}),
          ...(secData || {})
        };

        const internalKeys = new Set([
          'id', 'status', 'soldTo', 'soldToEmail', 'soldAt', 'orderId',
          'updatedAt', 'createdAt', 'listingId', 'deleted', 'isSold'
        ]);

        const dynamicDeliveryFields: Record<string, any> = {};
        for (const [k, v] of Object.entries(mergedRawItem)) {
          if (!internalKeys.has(k) && v !== undefined && v !== null && String(v).trim() !== '') {
            dynamicDeliveryFields[k] = v;
          }
        }

        const deliveryFieldsArray = Array.isArray(mergedRawItem.deliveryFields)
          ? mergedRawItem.deliveryFields
          : (Array.isArray(secData?.deliveryFields) ? secData.deliveryFields : null);

        secureDetails = {
          ...dynamicDeliveryFields,
          inventoryId: targetDocId,
          ...(deliveryFieldsArray ? { deliveryFields: deliveryFieldsArray } : {})
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
        const internalKeys = new Set([
          'id', 'status', 'soldTo', 'soldToEmail', 'soldAt', 'orderId',
          'updatedAt', 'createdAt', 'listingId', 'deleted', 'isSold'
        ]);

        const dynamicDeliveryFields: Record<string, any> = {};
        for (const [k, v] of Object.entries(targetAcc || {})) {
          if (!internalKeys.has(k) && v !== undefined && v !== null && String(v).trim() !== '') {
            dynamicDeliveryFields[k] = v;
          }
        }

        const deliveryFieldsArray = Array.isArray(targetAcc.deliveryFields)
          ? targetAcc.deliveryFields
          : null;

        secureDetails = {
          ...dynamicDeliveryFields,
          inventoryId: targetAcc.id || `inv_${availableIdx + 1}`,
          ...(deliveryFieldsArray ? { deliveryFields: deliveryFieldsArray } : {})
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
        const rawDig = listingData.digitalProductDetails || {};
        const internalKeys = new Set([
          'id', 'status', 'soldTo', 'soldToEmail', 'soldAt', 'orderId',
          'updatedAt', 'createdAt', 'listingId', 'deleted', 'isSold'
        ]);

        const dynamicDeliveryFields: Record<string, any> = {};
        for (const [k, v] of Object.entries(rawDig)) {
          if (!internalKeys.has(k) && v !== undefined && v !== null && String(v).trim() !== '') {
            dynamicDeliveryFields[k] = v;
          }
        }

        const deliveryFieldsArray = Array.isArray(rawDig.deliveryFields)
          ? rawDig.deliveryFields
          : null;

        secureDetails = Object.keys(dynamicDeliveryFields).length > 0 ? {
          ...dynamicDeliveryFields,
          ...(deliveryFieldsArray ? { deliveryFields: deliveryFieldsArray } : {})
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
        paidAmount: price,
        currency: 'NGN',
        type: 'log',
        transactionCategory: 'log',
        paymentGateway: 'wallet',
        transactionId: txId,
        purchasedAt: new Date().toISOString(),
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

      // Create global wallet_transactions record
      const globalTxRef = doc(db, 'wallet_transactions', txId);
      t.set(globalTxRef, {
        id: txId,
        reference: txId,
        orderId: purchaseId,
        purchaseId: purchaseId,
        userId: userId,
        userEmail: buyerEmail || userData.email || '',
        amount: price,
        type: 'purchase',
        method: 'wallet',
        status: 'successful',
        description: `Purchased: ${listingData.title}`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        createdAt: new Date().toISOString()
      });

      // Create user subcollection transaction log
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

      // Update buyer wallet balance in users and wallets
      t.update(userDocRef, {
        walletBalance: newBal,
        balance: newBal,
        totalPurchasesAmount: (userData.totalPurchasesAmount || 0) + price,
        updatedAt: new Date().toISOString()
      });

      t.set(doc(db, 'wallets', userId), {
        userId,
        walletBalance: newBal,
        balance: newBal,
        updatedAt: new Date().toISOString()
      }, { merge: true });

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
