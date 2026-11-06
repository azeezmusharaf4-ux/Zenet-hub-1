import {
  sendWelcomeEmail,
  sendLoginNotificationEmail,
  sendWalletDepositSuccessEmail,
  sendVirtualNumberPurchaseEmail,
  sendOtpAvailableNotificationEmail,
  sendRefundSuccessEmail,
  sendProductPurchaseSuccessEmail,
  sendSocialBoostOrderSuccessEmail,
  sendWalletWithdrawalUpdateEmail,
  OFFICIAL_SENDER_GMAIL
} from '../../src/server/emailService';
import { getDb } from './_firebase';

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
    let body: any = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {}

    const { recipientEmail, eventType = 'login', testName = 'ZENET Member' } = body;
    const cleanTo = (recipientEmail || '').trim().toLowerCase();

    if (!cleanTo || !cleanTo.includes('@') || !cleanTo.includes('.')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Please provide a valid recipientEmail address (e.g. your personal Gmail).'
        })
      };
    }

    const db = getDb();
    const testId = `test_${Date.now()}`;
    let deliveryResult = null;

    switch (eventType) {
      case 'welcome':
        deliveryResult = await sendWelcomeEmail({
          to: cleanTo,
          name: testName,
          userId: testId,
          db
        });
        break;

      case 'login':
        deliveryResult = await sendLoginNotificationEmail({
          to: cleanTo,
          name: testName,
          ip: event.headers?.['client-ip'] || event.headers?.['x-forwarded-for'] || '102.89.34.12',
          userAgent: event.headers?.['user-agent'] || 'ZENET PWA Client',
          db
        });
        break;

      case 'deposit':
        deliveryResult = await sendWalletDepositSuccessEmail({
          to: cleanTo,
          name: testName,
          amount: 5000,
          previousBalance: 2500,
          newBalance: 7500,
          reference: `TEST_DEP_${Date.now()}`,
          paymentMethod: 'Paystack Verified Checkout',
          db
        });
        break;

      case 'virtual_number':
        deliveryResult = await sendVirtualNumberPurchaseEmail({
          to: cleanTo,
          name: testName,
          serviceName: 'Telegram',
          country: 'US',
          phoneNumber: '+12025550143',
          amount: 1800,
          orderId: `TEST_VSN_${Date.now()}`,
          db
        });
        break;

      case 'otp':
        deliveryResult = await sendOtpAvailableNotificationEmail({
          to: cleanTo,
          name: testName,
          serviceName: 'WhatsApp',
          country: 'GB',
          phoneNumber: '+447911123456',
          orderId: `TEST_OTP_${Date.now()}`,
          db
        });
        break;

      case 'refund':
        deliveryResult = await sendRefundSuccessEmail({
          to: cleanTo,
          name: testName,
          amount: 1800,
          reason: 'Carrier verification code timeout - Full refund auto-credited to wallet',
          orderId: `TEST_REFUND_${Date.now()}`,
          db
        });
        break;

      case 'product':
        deliveryResult = await sendProductPurchaseSuccessEmail({
          to: cleanTo,
          name: testName,
          productTitle: 'Aged Twitter / X Account (2020 Creation)',
          amount: 6500,
          orderId: `TEST_PROD_${Date.now()}`,
          transactionId: `TX_${Date.now()}`,
          category: 'Log Account',
          db
        });
        break;

      case 'social_boost':
        deliveryResult = await sendSocialBoostOrderSuccessEmail({
          to: cleanTo,
          name: testName,
          serviceName: 'TikTok High Retention Video Views',
          targetUrl: 'https://www.tiktok.com/@zenethub/video/1234567890',
          quantity: 5000,
          amount: 3200,
          orderId: `TEST_BOOST_${Date.now()}`,
          db
        });
        break;

      case 'withdrawal':
        deliveryResult = await sendWalletWithdrawalUpdateEmail({
          to: cleanTo,
          name: testName,
          amount: 15000,
          status: 'completed',
          bankName: 'Access Bank',
          accountNumber: '0123456789',
          reference: `TEST_WTH_${Date.now()}`,
          db
        });
        break;

      default:
        deliveryResult = await sendLoginNotificationEmail({
          to: cleanTo,
          name: testName,
          db
        });
        break;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: deliveryResult?.success || false,
        sender: OFFICIAL_SENDER_GMAIL,
        recipient: cleanTo,
        eventType,
        deliveryResult
      })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err?.message || 'Failed to process test email'
      })
    };
  }
};
