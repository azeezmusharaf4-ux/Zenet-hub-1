import { getDb, doc, updateDoc, parseAndVerifyToken } from './_firebase';

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-caller-email, x-admin-email',
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
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const verifiedUser = parseAndVerifyToken(authHeader);

    let payload: any = {};
    try {
      payload = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    } catch {
      payload = {};
    }

    const { targetUid, newRole } = payload;

    if (!targetUid || !newRole) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Target user ID and new role are required' })
      };
    }

    const isVerifiedOwner = verifiedUser && (verifiedUser.email || '').trim().toLowerCase() === 'azeezmusharaf4@gmail.com';
    if (!isVerifiedOwner) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden: Access Denied. Only authenticated Azeezmusharaf4@gmail.com is authorized to manage administrator roles' })
      };
    }

    if (newRole !== 'admin' && newRole !== 'buyer') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid role requested. Roles must be "admin" or "buyer"' })
      };
    }

    const db = getDb();
    if (db) {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, { role: newRole });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `User role updated successfully to ${newRole}`,
        targetUid,
        newRole
      })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Failed to update user role' })
    };
  }
};
