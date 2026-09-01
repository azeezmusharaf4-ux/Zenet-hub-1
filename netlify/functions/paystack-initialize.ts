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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
    const paystackSecretKey = rawSecretKey ? rawSecretKey.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    const rawPub = process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || '';
    let paystackPublicKey = rawPub ? rawPub.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    if (!paystackPublicKey && paystackSecretKey) {
      if (paystackSecretKey.startsWith('sk_live_')) {
        paystackPublicKey = paystackSecretKey.replace('sk_live_', 'pk_live_');
      } else if (paystackSecretKey.startsWith('sk_test_')) {
        paystackPublicKey = paystackSecretKey.replace('sk_test_', 'pk_test_');
      } else if (paystackSecretKey.startsWith('sk_')) {
        paystackPublicKey = paystackSecretKey.replace(/^sk_/, 'pk_');
      }
    }

    if (!paystackSecretKey || !paystackSecretKey.startsWith('sk_')) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'PAYSTACK_SECRET_KEY is missing or not configured in Netlify environment variables.'
        })
      };
    }

    let payload: any = {};
    try {
      payload = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    } catch {
      payload = {};
    }

    const { listingId, listingTitle, priceNaira, buyerEmail, currency, callbackUrl, userId, isWalletFunding } = payload;

    if (!priceNaira || !buyerEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Price and buyer email are required' })
      };
    }

    const reference = `PST_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const amountInKobo = Math.round(Number(priceNaira) * 100);

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: buyerEmail,
        amount: amountInKobo,
        currency: currency || 'NGN',
        reference: reference,
        callback_url: callbackUrl,
        metadata: {
          userId: userId || '',
          isWalletFunding: Boolean(isWalletFunding),
          expectedAmountNaira: Number(priceNaira),
          expectedAmountKobo: amountInKobo,
          listingId: listingId || 'WALLET_FUNDING',
          listingTitle: listingTitle || 'Wallet Funding Deposit',
          buyerEmail
        }
      })
    });

    const paystackData: any = await paystackRes.json();

    if (paystackData.status && paystackData.data) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference: paystackData.data.reference,
          publicKey: paystackPublicKey || '',
          mode: 'live_paystack'
        })
      };
    } else {
      console.error('[Netlify Paystack Initialize Error]', paystackData);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: paystackData.message || 'Paystack checkout session initialization failed.'
        })
      };
    }
  } catch (err: any) {
    console.error('Error in Netlify paystack-initialize:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Paystack initialization failed'
      })
    };
  }
};
