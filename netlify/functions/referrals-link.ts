import { parseAndVerifyToken, getDb } from './_firebase';
import { linkReferralCode } from '../../src/server/referralService';

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' })
    };
  }

  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const verifiedUser = parseAndVerifyToken(authHeader);
    if (!verifiedUser || !verifiedUser.uid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized: Authentication required.' })
      };
    }

    let body: any = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {}

    const { referralCode, displayName, email } = body;
    if (!referralCode || typeof referralCode !== 'string' || !referralCode.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Referral code is required.' })
      };
    }

    const db = getDb();
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Database service unavailable.' })
      };
    }

    const result = await linkReferralCode({
      db,
      newUserId: verifiedUser.uid,
      newUserEmail: email || verifiedUser.email || '',
      newUserName: displayName || (verifiedUser.email ? verifiedUser.email.split('@')[0] : 'User'),
      referralCode: referralCode.trim()
    });

    return {
      statusCode: result.success ? 200 : 400,
      headers,
      body: JSON.stringify(result)
    };
  } catch (err: any) {
    console.error('[Netlify referrals-link Error]:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err?.message || 'Failed to link referral.' })
    };
  }
};
