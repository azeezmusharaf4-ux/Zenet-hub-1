export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const FALLBACK_BANKS = [
    { id: 1, name: 'OPay Digital Services Limited (OPay)', code: '999992', slug: 'paycom' },
    { id: 2, name: 'PalmPay', code: '999991', slug: 'palmpay' },
    { id: 3, name: 'Moniepoint MFB', code: '50515', slug: 'moniepoint-mfb' },
    { id: 4, name: 'Kuda Bank', code: '50211', slug: 'kuda-bank' },
    { id: 5, name: 'Access Bank', code: '044', slug: 'access-bank' },
    { id: 6, name: 'GTBank (Guaranty Trust Bank)', code: '058', slug: 'guaranty-trust-bank' },
    { id: 7, name: 'Zenith Bank', code: '057', slug: 'zenith-bank' },
    { id: 8, name: 'United Bank for Africa (UBA)', code: '033', slug: 'united-bank-for-africa' },
    { id: 9, name: 'First Bank of Nigeria', code: '011', slug: 'first-bank-of-nigeria' },
    { id: 10, name: 'Fidelity Bank', code: '070', slug: 'fidelity-bank' },
    { id: 11, name: 'Stanbic IBTC Bank', code: '221', slug: 'stanbic-ibtc-bank' },
    { id: 12, name: 'Union Bank of Nigeria', code: '032', slug: 'union-bank-of-nigeria' },
    { id: 13, name: 'Sterling Bank', code: '232', slug: 'sterling-bank' },
    { id: 14, name: 'Wema Bank / ALAT', code: '035', slug: 'wema-bank' },
    { id: 15, name: 'FCMB (First City Monument Bank)', code: '214', slug: 'first-city-monument-bank' },
    { id: 16, name: 'Polaris Bank', code: '076', slug: 'polaris-bank' },
    { id: 17, name: 'Keystone Bank', code: '082', slug: 'keystone-bank' },
    { id: 18, name: 'Ecobank Nigeria', code: '050', slug: 'ecobank-nigeria' },
    { id: 19, name: 'Providus Bank', code: '101', slug: 'providus-bank' },
    { id: 20, name: 'Jaiz Bank', code: '301', slug: 'jaiz-bank' },
    { id: 21, name: 'Taj Bank', code: '302', slug: 'taj-bank' }
  ];

  try {
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
    const paystackSecretKey = rawSecretKey ? rawSecretKey.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (paystackSecretKey) {
      reqHeaders['Authorization'] = `Bearer ${paystackSecretKey}`;
    }

    const resp = await fetch('https://api.paystack.co/bank?country=nigeria&currency=NGN&perPage=100', {
      headers: reqHeaders
    });

    const data: any = await resp.json().catch(() => null);

    if (data && data.status && Array.isArray(data.data)) {
      const banks = data.data
        .filter((b: any) => b.active !== false)
        .map((b: any) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          slug: b.slug
        }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, banks })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, banks: FALLBACK_BANKS })
    };
  } catch (err: any) {
    console.warn('[Netlify Paystack Banks] Notice:', err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, banks: FALLBACK_BANKS })
    };
  }
};
