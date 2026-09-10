import { getDb, doc, getDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';
import { getEstraLogConfig, normalizeEstraLogServer, queryEstraLog } from './_estralog';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  }

  const queryParams = event.queryStringParameters || {};
  let body: any = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      body = {};
    }
  }

  // Determine action from query, body, or path splat
  const pathParts = (event.path || '').split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const action = (queryParams.action || body.action || (lastPart !== 'service-number-2' ? lastPart : '') || 'servers').toLowerCase();

  const { apiKey } = getEstraLogConfig();
  const db = getDb();

  try {
    // 1. SERVERS
    if (action === 'servers') {
      try {
        const xtraData = await queryEstraLog('servers');
        if (xtraData && xtraData.status === 'success' && Array.isArray(xtraData.servers)) {
          const mapped = xtraData.servers.map((s: any) => ({
            id: String(s.id).toLowerCase(),
            name: s.label || s.name || (s.id.toLowerCase().startsWith('usa') ? `USA ${s.id.slice(3)}` : `All Countries ${s.id.slice(3)}`),
            region: s.region || (s.id.toLowerCase().startsWith('usa') ? 'USA' : 'Global')
          }));
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              provider: 'EstraLogTools',
              hasApiKey: Boolean(apiKey),
              servers: mapped
            })
          };
        }
      } catch (err: any) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            provider: 'EstraLogTools',
            error: `EstraLog Tools connection error: ${err.message}`,
            servers: []
          })
        };
      }
    }

    // 2. COUNTRIES
    if (action === 'countries') {
      const tab = (queryParams.tab || body.tab || 'usa').toString().toLowerCase();
      const rawServer = (queryParams.server || body.server || '').toString();
      const server = normalizeEstraLogServer(rawServer, tab);

      try {
        const xtraData = await queryEstraLog('countries', { server });
        if (xtraData && xtraData.status === 'success' && Array.isArray(xtraData.countries)) {
          let countries = xtraData.countries.map((c: any) => ({
            id: String(c.id),
            name: c.name,
            code: String(c.id) === '187' || c.name.toLowerCase().includes('united states') ? 'US' : 'GLOBAL'
          }));
          if (tab === 'usa' || server.startsWith('usa')) {
            countries = countries.filter(c => c.code === 'US' || c.id === '187' || c.name.toLowerCase().includes('united states'));
          }
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              provider: 'EstraLogTools',
              server,
              hasApiKey: Boolean(apiKey),
              countries
            })
          };
        }
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            provider: 'EstraLogTools',
            server,
            error: xtraData?.message || 'No countries returned from EstraLog Tools API',
            countries: []
          })
        };
      } catch (err: any) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            provider: 'EstraLogTools',
            server,
            error: `EstraLog Tools API error: ${err.message}`,
            countries: []
          })
        };
      }
    }

    // 3. SERVICES
    if (action === 'services') {
      const tab = (queryParams.tab || body.tab || 'usa').toString().toLowerCase();
      const rawServer = (queryParams.server || body.server || '').toString();
      const server = normalizeEstraLogServer(rawServer, tab);
      const country = (queryParams.country || body.country || '').toString();

      if (!country) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Country parameter is required', services: [] })
        };
      }

      try {
        const xtraData = await queryEstraLog('services', { server, country });
        if (xtraData && xtraData.status === 'success' && Array.isArray(xtraData.services)) {
          const services = xtraData.services.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            code: String(s.id)
          }));
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              provider: 'EstraLogTools',
              server,
              country,
              hasApiKey: Boolean(apiKey),
              services
            })
          };
        }
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            provider: 'EstraLogTools',
            server,
            country,
            error: xtraData?.message || 'No services returned from EstraLog Tools API for selected country and server',
            services: []
          })
        };
      } catch (err: any) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            provider: 'EstraLogTools',
            server,
            country,
            error: `EstraLog Tools API error: ${err.message}`,
            services: []
          })
        };
      }
    }

    // 4. PRICE / PRICES
    if (action === 'price' || action === 'prices') {
      const tab = (queryParams.tab || body.tab || 'usa').toString().toLowerCase();
      const rawServer = (queryParams.server || body.server || '').toString();
      const server = normalizeEstraLogServer(rawServer, tab);
      const country = (queryParams.country || body.country || '').toString();
      const service = (queryParams.service || body.service || '').toString();

      if (!country || !service) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Both country and service parameters are required', inStock: false })
        };
      }

      let baseCost = 0;
      let upstreamPriceFound = false;
      let upstreamError = '';

      try {
        const xtraData = await queryEstraLog('price', { server, country, service });
        if (xtraData && xtraData.status === 'success' && xtraData.price) {
          const parsed = parseFloat(xtraData.price);
          if (!isNaN(parsed) && parsed > 0) {
            baseCost = Math.round(parsed);
            upstreamPriceFound = true;
          }
        } else if (xtraData && xtraData.status === 'error') {
          upstreamError = xtraData.message || (xtraData.code ? `Provider code: ${xtraData.code}` : 'Unavailable from EstraLog Tools');
        }
      } catch (err: any) {
        upstreamError = err.message;
      }

      if (!upstreamPriceFound || baseCost <= 0) {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            provider: 'EstraLogTools',
            server,
            country,
            service,
            inStock: false,
            available: false,
            error: upstreamError || 'Service currently out of stock or unavailable on this server route.',
            message: upstreamError || 'Service currently out of stock or unavailable on this server route.',
            providerPrice: null,
            customerPrice: null,
            options: []
          })
        };
      }

      const margin = Math.max(350, Math.round(baseCost * 0.25));
      const customerPrice = Math.ceil((baseCost + margin) / 50) * 50;

      const options = [
        {
          optionId: 'opt_1',
          tierIndex: 1,
          tierName: 'Standard Route',
          carrierTier: 'Carrier Route 1 (Standard)',
          badge: 'Fast',
          description: 'Instant carrier routing',
          customerPrice,
          providerCost: baseCost,
          markup: margin
        },
        {
          optionId: 'opt_2',
          tierIndex: 2,
          tierName: 'PVA Verified Route',
          carrierTier: 'Carrier Route 2 (PVA Verified)',
          badge: 'Best Value',
          description: 'Fresh number pool, 99.4% delivery',
          customerPrice: customerPrice + 350,
          providerCost: baseCost,
          markup: margin + 350,
          isPopular: true
        },
        {
          optionId: 'opt_3',
          tierIndex: 3,
          tierName: 'VIP Direct Carrier',
          carrierTier: 'Carrier Route 3 (VIP Direct)',
          badge: 'Highest Success',
          description: 'Exclusive private carrier slot',
          customerPrice: customerPrice + 750,
          providerCost: baseCost,
          markup: margin + 750
        }
      ];

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          provider: 'EstraLogTools',
          server,
          country,
          service,
          inStock: true,
          available: true,
          providerPrice: baseCost,
          customerPrice: options[0].customerPrice,
          selectedOptionId: 'opt_1',
          options
        })
      };
    }

    // 5. BUY / ORDER
    if (action === 'buy' || action === 'order') {
      const userId = body.userId || queryParams.userId;
      const amount = Number(body.amount || 0);
      const tab = (body.tab || queryParams.tab || 'usa').toString().toLowerCase();
      const rawServer = (body.server || queryParams.server || 'usa1').toString();
      const server = normalizeEstraLogServer(rawServer, tab);
      const countryId = (body.country || queryParams.country || '').toString();
      const serviceId = (body.service || queryParams.service || '').toString();

      if (!userId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'User ID is required to place an order.' })
        };
      }

      if (!countryId || !serviceId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Country and Service IDs are required from EstraLog Tools.' })
        };
      }

      if (amount <= 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Invalid order amount.' })
        };
      }

      if (!db) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Database service is temporarily unavailable.' })
        };
      }

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'User profile not found.' })
        };
      }

      const userData = userSnap.data();
      const currentBalance = userData.walletBalance || 0;
      if (currentBalance < amount) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `Insufficient wallet balance (₦${currentBalance.toLocaleString()}). Required: ₦${amount.toLocaleString()}`
          })
        };
      }

      // Call live EstraLog buy endpoint
      let xtraRes: any = null;
      let isUpstreamAllocated = false;

      try {
        xtraRes = await queryEstraLog('buy', {
          server,
          country: countryId,
          service: serviceId
        }, 'POST');

        if (xtraRes && xtraRes.status === 'success' && xtraRes.order_ref) {
          isUpstreamAllocated = true;
        }
      } catch (err: any) {
        console.warn('[EstraLogTools buy call error]:', err.message);
      }

      // Strictly verify real upstream allocation from EstraLog Tools - no simulated mock numbers
      if (!isUpstreamAllocated || !xtraRes?.phone) {
        const errorMsg = xtraRes?.message || 'EstraLog Tools provider could not allocate a virtual number at this time.';
        const errorCode = xtraRes?.code || '';

        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `EstraLog Tools Provider response: ${errorMsg}${errorCode ? ` (${errorCode})` : ''}. Your wallet balance was not charged.`
          })
        };
      }

      const orderId = `XTRA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const allocatedPhone = String(xtraRes.phone).startsWith('+') ? String(xtraRes.phone) : `+${xtraRes.phone}`;

      await runTransaction(db, async (transaction) => {
        const uDoc = await transaction.get(userRef);
        if (!uDoc.exists()) throw new Error('User profile not found.');
        const uBal = uDoc.data().walletBalance || 0;
        if (uBal < amount) throw new Error('Insufficient wallet balance.');

        transaction.update(userRef, {
          walletBalance: uBal - amount,
          updatedAt: new Date().toISOString()
        });

        const srvName = body.serviceName || xtraRes?.service_name || serviceId;
        const cName = body.countryName || xtraRes?.country_name || (countryId === '187' ? 'United States' : 'Global');

        const orderDocRef = doc(db, 'orders_service_number_2', orderId);
        const orderData = {
          orderId,
          orderRef: xtraRes?.order_ref || null,
          userId,
          userEmail: body.userEmail || userData.email || '',
          provider: 'EstraLogTools',
          server: xtraRes?.server || server,
          country: cName,
          countryId,
          service: srvName,
          serviceId,
          amount,
          wholesaleCost: Number(xtraRes?.price) || Math.round(amount * 0.7),
          status: 'WAITING_FOR_SMS',
          phoneNumber: allocatedPhone,
          code: null,
          smsText: null,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString()
        };
        transaction.set(orderDocRef, orderData);
      });

      const placedOrderDoc = await getDoc(doc(db, 'orders_service_number_2', orderId));
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          provider: 'EstraLogTools',
          message: 'Virtual number allocated successfully from EstraLogTools.',
          orderId,
          order: placedOrderDoc.exists() ? placedOrderDoc.data() : { orderId, phoneNumber: allocatedPhone }
        })
      };
    }

    // 6. STATUS / SMS POLLING
    if (action === 'status' || action === 'sms') {
      const orderId = (queryParams.orderId || queryParams.order_id || body.orderId || body.order_id || '').toString();
      if (!orderId || !db) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Order ID is required.' })
        };
      }
      const orderRef = doc(db, 'orders_service_number_2', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Order not found.' })
        };
      }
      const orderData = snap.data();

      // If upstream orderRef exists and waiting for SMS, check live status on EstraLogTools
      if (orderData.orderRef && orderData.status === 'WAITING_FOR_SMS') {
        try {
          const xtraStatus = await queryEstraLog('status', { order_ref: orderData.orderRef });
          if (xtraStatus && xtraStatus.status === 'success') {
            if (xtraStatus.state === 'completed' && xtraStatus.otp) {
              const updated = {
                status: 'SMS_RECEIVED',
                code: String(xtraStatus.otp),
                smsText: `Your verification code is ${xtraStatus.otp}.`,
                receivedAt: new Date().toISOString()
              };
              await updateDoc(orderRef, updated);
              return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                  success: true,
                  provider: 'EstraLogTools',
                  status: 'SMS_RECEIVED',
                  code: updated.code,
                  smsText: updated.smsText,
                  order: { ...orderData, ...updated }
                })
              };
            } else if (xtraStatus.state === 'cancelled') {
              const refundRef = doc(db, 'users', orderData.userId);
              await runTransaction(db, async (t) => {
                const uDoc = await t.get(refundRef);
                if (uDoc.exists()) {
                  const bal = uDoc.data().walletBalance || 0;
                  t.update(refundRef, { walletBalance: bal + (orderData.amount || 0), updatedAt: new Date().toISOString() });
                }
                t.update(orderRef, { status: 'CANCELLED', cancelledAt: new Date().toISOString() });
              });
              return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                  success: true,
                  provider: 'EstraLogTools',
                  status: 'CANCELLED',
                  message: 'Order cancelled by provider and refunded to wallet.',
                  order: { ...orderData, status: 'CANCELLED' }
                })
              };
            }
          }
        } catch (err: any) {
          console.warn('[EstraLogTools status check notice]:', err.message);
        }
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          provider: 'EstraLogTools',
          status: orderData.status,
          code: orderData.code || '',
          smsText: orderData.smsText || '',
          order: orderData
        })
      };
    }

    // 7. CANCEL
    if (action === 'cancel') {
      const orderId = (body.orderId || body.order_id || queryParams.orderId || queryParams.order_id || '').toString();
      if (!orderId || !db) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Order ID is required.' })
        };
      }
      const orderRef = doc(db, 'orders_service_number_2', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Order not found.' })
        };
      }
      const ord = snap.data();
      if (ord.status === 'SMS_RECEIVED') {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'SMS was already delivered. Order cannot be cancelled.' })
        };
      }
      if (ord.status === 'CANCELLED') {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true, message: 'Order was already cancelled.' })
        };
      }

      if (ord.orderRef) {
        try {
          await queryEstraLog('cancel', { order_ref: ord.orderRef }, 'POST');
        } catch (err: any) {
          console.warn('[EstraLogTools cancel error]:', err.message);
        }
      }

      const refundUserRef = doc(db, 'users', ord.userId);
      await runTransaction(db, async (t) => {
        const uDoc = await t.get(refundUserRef);
        if (uDoc.exists()) {
          const uData = uDoc.data();
          t.update(refundUserRef, {
            walletBalance: (uData.walletBalance || 0) + (ord.amount || 0),
            updatedAt: new Date().toISOString()
          });
        }
        t.update(orderRef, {
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString()
        });
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, provider: 'EstraLogTools', message: 'Order cancelled and refund credited to wallet.' })
      };
    }

    // 8. ORDERS
    if (action === 'orders') {
      const userId = (queryParams.userId || body.userId || '').toString();
      if (!db || !userId) {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true, orders: [] })
        };
      }
      const q = query(collection(db, 'orders_service_number_2'), where('userId', '==', userId));
      const snaps = await getDocs(q);
      const ordersList: any[] = [];
      snaps.forEach(docSnap => ordersList.push(docSnap.data()));
      ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, provider: 'EstraLogTools', orders: ordersList })
      };
    }

    // 9. LIVE BALANCE
    if (action === 'balance' || action === 'provider-balance') {
      try {
        const balData = await queryEstraLog('balance');
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true, provider: 'EstraLogTools', ...balData })
        };
      } catch (err: any) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    // 10. DIGITAL PRODUCTS (EstraLogTools catalog)
    if (action === 'digital-products' || action === 'digital_products') {
      const limit = Number(queryParams.limit || 50);
      const server = (queryParams.server || 'server1').toString();
      try {
        const digiData = await queryEstraLog('digital_products', { limit, server });
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true, provider: 'EstraLogTools', ...digiData })
        };
      } catch (err: any) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, provider: 'EstraLogTools', message: 'EstraLogTools Provider API Ready' })
    };
  } catch (err: any) {
    console.error('[EstraLogTools Service Number error]:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: err.message || 'Internal EstraLogTools Provider error' })
    };
  }
};
