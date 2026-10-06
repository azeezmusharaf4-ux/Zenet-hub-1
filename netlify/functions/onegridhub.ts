import serverless from 'serverless-http';
import app from '../../server';

/**
 * Netlify Function handler for OneGridHub / VirtualSMSNumbers API
 * Delegates all routes directly to the Express server applet,
 * ensuring consistent VirtualSMSNumbers gateway processing, authentication,
 * and HMAC webhook handling across both local and Netlify serverless environments.
 */
export const handler = serverless(app);
