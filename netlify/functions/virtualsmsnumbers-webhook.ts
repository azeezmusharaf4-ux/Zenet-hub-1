import crypto from 'crypto';
import { getDb, ensureServerAuthenticated, doc, getDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';

/**
 * Netlify Serverless Function for VirtualSMSNumbers Webhook
 * Route: POST /hooks/virtualsmsnumbers -> /.netlify/functions/virtualsmsnumbers-webhook
 */
export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-vsn-signature, X-VSN-Signature, x-vsn-timestamp, X-VSN-Timestamp',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ok', service: 'VirtualSMSNumbers Webhook Gateway' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  try {
    const rawHeaders = event.headers || {};
    const rawSignatureHeader = (
      rawHeaders['x-vsn-signature'] ||
      rawHeaders['X-VSN-Signature'] ||
      rawHeaders['x-signature'] ||
      rawHeaders['X-Signature'] ||
      rawHeaders['x-hub-signature-256'] ||
      ''
    ).toString().trim();

    // 1. Check signature presence: Reject missing signature with 401
    if (!rawSignatureHeader) {
      console.warn('[Netlify VSN Webhook] Rejected: Missing X-VSN-Signature header.');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized: Missing X-VSN-Signature header.' })
      };
    }

    // 2. Check secret presence: Verify using server environment variable VSN_WEBHOOK_SECRET
    const webhookSecret = (process.env.VSN_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      console.warn('[Netlify VSN Webhook] Rejected: VSN_WEBHOOK_SECRET is not configured on server.');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized: Webhook verification secret not configured on server.' })
      };
    }

    // 3. Preserve raw request body
    const rawBodyStr = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {}));

    // 4. Extract timestamp and signature components
    let timestampValue: string | null = null;
    let signatureHash = rawSignatureHeader;

    if (rawSignatureHeader.includes('t=') || rawSignatureHeader.includes('v1=') || rawSignatureHeader.includes('s=')) {
      const parts = rawSignatureHeader.split(/[,;]\s*/);
      for (const part of parts) {
        const [k, ...vArr] = part.split('=');
        const key = k.trim().toLowerCase();
        const val = vArr.join('=').trim();
        if (key === 't') {
          timestampValue = val;
        } else if (key === 'v1' || key === 's' || key === 'sha256') {
          signatureHash = val;
        }
      }
    } else {
      signatureHash = rawSignatureHeader.replace(/^sha256=/i, '').trim();
    }

    // Fallback timestamp from headers
    if (!timestampValue) {
      const tsHeader = (
        rawHeaders['x-vsn-timestamp'] ||
        rawHeaders['X-VSN-Timestamp'] ||
        rawHeaders['x-timestamp'] ||
        rawHeaders['x-webhook-timestamp'] ||
        ''
      ).toString().trim();
      if (tsHeader) {
        timestampValue = tsHeader;
      }
    }

    let parsedBody: any = {};
    try {
      parsedBody = JSON.parse(rawBodyStr || '{}');
      if (!timestampValue && parsedBody) {
        const bodyTs = parsedBody.timestamp || parsedBody.created_at || parsedBody.event_timestamp || parsedBody.time;
        if (bodyTs) {
          timestampValue = String(bodyTs).trim();
        }
      }
    } catch {
      // Body will be validated as JSON below
    }

    // 5. Reject webhook timestamps older than 5 minutes (300 seconds)
    if (timestampValue) {
      let eventTimeMs = 0;
      const numTs = Number(timestampValue);
      if (!isNaN(numTs) && numTs > 0) {
        eventTimeMs = numTs < 1e11 ? numTs * 1000 : numTs;
      } else {
        const parsed = Date.parse(timestampValue);
        if (!isNaN(parsed) && parsed > 0) {
          eventTimeMs = parsed;
        }
      }

      if (eventTimeMs > 0) {
        const ageMs = Date.now() - eventTimeMs;
        const maxAgeMs = 5 * 60 * 1000; // 5 minutes
        if (ageMs > maxAgeMs || ageMs < -maxAgeMs) {
          console.warn(`[Netlify VSN Webhook] Rejected: Timestamp older than 5 minutes (age: ${Math.round(ageMs / 1000)}s).`);
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ success: false, error: 'Unauthorized: Webhook timestamp older than 5 minutes.' })
          };
        }
      }
    }

    // 6. Compute HMAC-SHA256 signature verification
    const cleanSig = signatureHash.trim().toLowerCase();
    const candidatePayloads: string[] = [];
    if (timestampValue) {
      candidatePayloads.push(`${timestampValue}.${rawBodyStr}`);
      candidatePayloads.push(`${timestampValue}${rawBodyStr}`);
    }
    candidatePayloads.push(rawBodyStr);

    let signatureValid = false;
    for (const testPayload of candidatePayloads) {
      const computedHex = crypto.createHmac('sha256', webhookSecret).update(testPayload).digest('hex').toLowerCase();
      if (computedHex.length === cleanSig.length) {
        try {
          if (crypto.timingSafeEqual(Buffer.from(computedHex), Buffer.from(cleanSig))) {
            signatureValid = true;
            break;
          }
        } catch {
          // continue
        }
      }
    }

    if (!signatureValid) {
      console.warn('[Netlify VSN Webhook] Rejected: Invalid HMAC-SHA256 signature.');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized: Invalid signature.' })
      };
    }

    // 7. Parse valid webhook event
    const payload = parsedBody && typeof parsedBody === 'object' ? parsedBody : JSON.parse(rawBodyStr || '{}');
    const eventName = (payload.event || payload.type || payload.action || payload.status || '').toString().toLowerCase();

    console.log(`[Netlify VSN Webhook] Verified event received: "${eventName}"`);

    // 8. Process valid webhook event in Firestore
    await ensureServerAuthenticated();
    const db = getDb();

    if (db) {
      const dataObj = (payload.data && typeof payload.data === 'object') ? payload.data : payload;
      const providerActivationId = (
        dataObj.activation_id ||
        dataObj.activationId ||
        dataObj.id ||
        dataObj.order_id ||
        dataObj.orderId ||
        payload.activation_id ||
        payload.id ||
        ''
      ).toString().trim();

      const code = (dataObj.code || dataObj.otp || dataObj.sms_code || dataObj.smsCode || payload.code || '').toString().trim();
      const smsText = (dataObj.text || dataObj.sms || dataObj.message || payload.text || payload.sms || '').toString().trim();
      const statusUpper = (dataObj.status || payload.status || '').toString().toUpperCase();

      if (providerActivationId) {
        let orderDocId = '';
        let orderData: any = null;

        const qSnap1 = await getDocs(query(collection(db, 'virtual_number_orders'), where('providerOrderId', '==', providerActivationId)));
        if (!qSnap1.empty) {
          orderDocId = qSnap1.docs[0].id;
          orderData = qSnap1.docs[0].data();
        } else {
          const qSnap2 = await getDocs(query(collection(db, 'virtual_number_orders'), where('providerActivationId', '==', providerActivationId)));
          if (!qSnap2.empty) {
            orderDocId = qSnap2.docs[0].id;
            orderData = qSnap2.docs[0].data();
          } else {
            const directSnap = await getDoc(doc(db, 'virtual_number_orders', providerActivationId));
            if (directSnap.exists()) {
              orderDocId = directSnap.id;
              orderData = directSnap.data();
            }
          }
        }

        if (orderDocId && orderData) {
          const nowIso = new Date().toISOString();
          const isSmsReceived = Boolean(code) || eventName.includes('received') || statusUpper === 'RECEIVED' || statusUpper === 'SMS_RECEIVED' || statusUpper === 'SUCCESS' || statusUpper === 'COMPLETED';

          if (isSmsReceived) {
            const updates: Record<string, any> = {
              status: 'RECEIVED',
              receivedAt: nowIso,
              updatedAt: nowIso
            };
            if (code) updates.code = code;
            if (smsText) updates.smsText = smsText;

            await updateDoc(doc(db, 'virtual_number_orders', orderDocId), updates);

            try {
              const pRef = doc(db, 'purchases', orderDocId);
              const pSnap = await getDoc(pRef);
              if (pSnap.exists()) {
                await updateDoc(pRef, {
                  status: 'completed',
                  fulfillmentData: {
                    ...(pSnap.data().fulfillmentData || {}),
                    code: code || pSnap.data().fulfillmentData?.code,
                    smsText: smsText || pSnap.data().fulfillmentData?.smsText,
                    completedAt: nowIso
                  }
                });
              }
            } catch (err: any) {
              console.warn('[Netlify VSN Webhook] Purchases sync notice:', err.message);
            }
          } else if (eventName.includes('expired') || eventName.includes('timeout') || statusUpper === 'EXPIRED') {
            if (!orderData.refunded && orderData.status !== 'RECEIVED' && !orderData.code) {
              const refundAmount = Number(orderData.price || orderData.totalCharge || 0);
              const userRef = doc(db, 'users', orderData.userId);
              const refundTxId = `REF-VSN-${Date.now()}`;

              await runTransaction(db, async (tx) => {
                const uSnap = await tx.get(userRef);
                if (uSnap.exists()) {
                  const curBal = Number(uSnap.data().walletBalance || 0);
                  tx.update(userRef, { walletBalance: curBal + refundAmount });
                }
                tx.update(doc(db, 'virtual_number_orders', orderDocId), {
                  status: 'EXPIRED',
                  refunded: true,
                  refundedAt: nowIso,
                  updatedAt: nowIso
                });
                tx.set(doc(db, 'transactions', refundTxId), {
                  id: refundTxId,
                  userId: orderData.userId,
                  userEmail: orderData.userEmail || '',
                  type: 'refund',
                  amount: refundAmount,
                  currency: 'NGN',
                  status: 'completed',
                  description: `Automatic Refund: Expired Virtual Number activation (${orderDocId})`,
                  metadata: { orderId: orderDocId, providerActivationId, provider: 'VirtualSMSNumbers' },
                  createdAt: nowIso
                });
              });
            } else {
              await updateDoc(doc(db, 'virtual_number_orders', orderDocId), {
                status: 'EXPIRED',
                updatedAt: nowIso
              });
            }
          } else if (eventName.includes('cancel') || statusUpper === 'CANCELLED') {
            await updateDoc(doc(db, 'virtual_number_orders', orderDocId), {
              status: 'CANCELLED',
              updatedAt: nowIso
            });
          }
        }
      }
    }

    // 9. Return HTTP 200 for successfully processed events
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        received: true,
        event: eventName || 'processed'
      })
    };

  } catch (err: any) {
    console.error('[Netlify VSN Webhook] Processing error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error processing webhook' })
    };
  }
};
