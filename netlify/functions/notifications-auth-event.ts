import { parseAndVerifyToken, getDb, doc, getDoc } from './_firebase';
import { sendWelcomeEmail, sendLoginNotificationEmail } from '../../src/server/emailService';

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
    if (!verifiedUser || !verifiedUser.email) {
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

    const { event: authEvent, displayName } = body;
    const clientIp = event.headers?.['client-ip'] || event.headers?.['x-forwarded-for'] || '';
    const userAgent = event.headers?.['user-agent'] || '';

    const db = getDb();
    let resolvedName = displayName;
    if (!resolvedName && db) {
      try {
        const uSnap = await getDoc(doc(db, 'users', verifiedUser.uid));
        if (uSnap.exists()) {
          resolvedName = uSnap.data()?.displayName || uSnap.data()?.fullName || uSnap.data()?.username;
        }
      } catch {}
    }

    let deliveryResult = null;

    if (authEvent === 'welcome') {
      deliveryResult = await sendWelcomeEmail({
        to: verifiedUser.email,
        name: resolvedName || undefined,
        userId: verifiedUser.uid,
        db
      });
    } else if (authEvent === 'login') {
      deliveryResult = await sendLoginNotificationEmail({
        to: verifiedUser.email,
        name: resolvedName || undefined,
        ip: clientIp,
        userAgent,
        db
      });
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Unsupported auth event type.' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        event: authEvent,
        recipient: verifiedUser.email,
        delivery: deliveryResult
      })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err?.message || 'Failed to dispatch email notification'
      })
    };
  }
};
