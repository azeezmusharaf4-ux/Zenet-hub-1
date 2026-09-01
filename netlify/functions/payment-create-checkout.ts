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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    let payload: any = {};
    try {
      payload = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    } catch {
      payload = {};
    }

    const { listingId, priceNaira, currency, gateway } = payload;

    if (!listingId || !priceNaira) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing listing details' })
      };
    }

    const rates: Record<string, number> = {
      NGN: 1,
      USD: 0.00067,
      EUR: 0.00062,
      GBP: 0.00053
    };

    const targetCurrency = (currency || 'NGN').toUpperCase();
    const convertedAmount = Math.max(1, Math.round((Number(priceNaira) * (rates[targetCurrency] || rates.NGN)) * 100) / 100);
    const transactionId = `TX_PAYSTACK_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        gateway: gateway || 'paystack',
        transactionId,
        amount: convertedAmount,
        currency: targetCurrency,
        mode: 'paystack_checkout',
        message: 'Paystack Payment Gateway Ready'
      })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Payment creation failed' })
    };
  }
};
