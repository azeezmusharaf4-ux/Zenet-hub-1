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

  try {
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
    const paystackSecretKey = rawSecretKey ? rawSecretKey.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    const account_number = event.queryStringParameters?.account_number || '';
    const bank_code = event.queryStringParameters?.bank_code || '';

    if (!account_number || !bank_code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Account number and bank code are required.' })
      };
    }

    const cleanAcc = String(account_number).trim().replace(/\D/g, '');
    const cleanCode = String(bank_code).trim();

    if (cleanAcc.length !== 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Account number must be exactly 10 digits.' })
      };
    }

    if (!paystackSecretKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'PAYSTACK_SECRET_KEY is not configured on Netlify environment variables.' 
        })
      };
    }

    const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(cleanAcc)}&bank_code=${encodeURIComponent(cleanCode)}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data: any = await resp.json().catch(() => null);

    if (data && data.status && data.data && data.data.account_name) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          account_name: data.data.account_name,
          account_number: data.data.account_number,
          bank_id: data.data.bank_id
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: data?.message || 'Could not verify account name with Paystack. Please check the account number and bank.'
      })
    };
  } catch (err: any) {
    console.error('Error in Netlify paystack-resolve-account:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Failed to verify account details with Paystack.'
      })
    };
  }
};
