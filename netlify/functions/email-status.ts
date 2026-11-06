import { getEmailServiceStatus, verifySmtpConnection } from '../../src/server/emailService';

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
    const status = getEmailServiceStatus();
    const liveSmtpCheck = await verifySmtpConnection();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...status,
        liveSmtpCheck
      })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        configured: false,
        error: err?.message || 'Error checking email status'
      })
    };
  }
};
