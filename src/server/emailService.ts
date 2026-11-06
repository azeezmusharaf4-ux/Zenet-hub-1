import nodemailer, { type Transporter } from 'nodemailer';
import { Firestore, doc, getDoc, setDoc } from 'firebase/firestore';

// =========================================================================
// ZENET HUB AUTOMATIC REAL EMAIL NOTIFICATION SYSTEM
// Delivers real branded HTML & Plain Text emails directly to users' Gmail inboxes.
// Supported Providers:
//  1. Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD)
//  2. Resend (RESEND_API_KEY)
//  3. Custom SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE)
//  4. SendGrid / Brevo SMTP
// =========================================================================

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  recipient?: string;
  error?: string;
  alreadySent?: boolean;
}

export interface EmailServiceStatus {
  configured: boolean;
  provider: 'gmail_smtp' | 'resend' | 'custom_smtp' | 'none';
  senderAddress: string;
  missingVariables: string[];
  setupInstructions: string;
}

// Official ZENET HUB Branding and Canonical URLs
export const ZENET_HUB_NAME = 'ZENET HUB';
export const ZENET_HUB_URL = (process.env.VITE_APP_URL || 'https://zenet-hub.com.ng').replace(/\/+$/, '');

// Official Sender Gmail (Sends emails to each user's authentic registered email)
export const OFFICIAL_SENDER_GMAIL = 'Zenethubifficial@gmail.com';

// In-memory set for fast local idempotency deduplication
const inMemorySentKeys = new Set<string>();

/**
 * Validates and retrieves current server-side email credentials
 */
export function getEmailServiceConfig(): {
  provider: 'gmail_smtp' | 'resend' | 'custom_smtp' | 'none';
  fromEmail: string;
  gmailUser: string;
  gmailAppPassword?: string;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
} {
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const rawGmailUser = (process.env.GMAIL_USER || process.env.GMAIL_EMAIL || '').trim();
  const gmailUser = rawGmailUser || OFFICIAL_SENDER_GMAIL;
  const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.GMAIL_PASSWORD || '').trim().replace(/\s+/g, '');

  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = (process.env.SMTP_USER || process.env.SMTP_USERNAME || '').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  let fromEmail = (process.env.EMAIL_FROM || process.env.MAIL_FROM || '').trim();

  // 1. Check Resend
  if (resendApiKey) {
    if (!fromEmail) {
      fromEmail = `ZENET HUB <${OFFICIAL_SENDER_GMAIL}>`;
    }
    return { provider: 'resend', fromEmail, resendApiKey, gmailUser };
  }

  // 2. Check Gmail SMTP
  if (gmailAppPassword) {
    if (!fromEmail) {
      fromEmail = `ZENET HUB <${gmailUser}>`;
    }
    return { provider: 'gmail_smtp', fromEmail, gmailUser, gmailAppPassword };
  }

  // 3. Check Custom SMTP
  if (smtpHost && smtpUser && smtpPass) {
    if (!fromEmail) {
      fromEmail = `ZENET HUB <${smtpUser}>`;
    }
    return { provider: 'custom_smtp', fromEmail, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, gmailUser };
  }

  // Fallback / unconfigured (Awaiting GMAIL_APP_PASSWORD)
  return {
    provider: 'none',
    fromEmail: fromEmail || `ZENET HUB <${OFFICIAL_SENDER_GMAIL}>`,
    gmailUser
  };
}

/**
 * Returns diagnostic status and setup instructions if email keys are missing
 */
export function getEmailServiceStatus(): EmailServiceStatus & { officialSender: string; hasAppPassword: boolean } {
  const config = getEmailServiceConfig();
  const missingVariables: string[] = [];
  const hasAppPassword = Boolean(config.gmailAppPassword);

  if (config.provider === 'none') {
    missingVariables.push('GMAIL_APP_PASSWORD (16-character Google App Password)');

    return {
      configured: false,
      provider: 'none',
      senderAddress: config.fromEmail,
      officialSender: OFFICIAL_SENDER_GMAIL,
      hasAppPassword: false,
      missingVariables,
      setupInstructions:
        `Official Sender is set to: ${OFFICIAL_SENDER_GMAIL}\n\n` +
        `To activate real automatic delivery to your users' Gmail inboxes, add this to your hosting environment (.env):\n` +
        `GMAIL_USER=${OFFICIAL_SENDER_GMAIL}\n` +
        `GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx\n\n` +
        `Where GMAIL_APP_PASSWORD is generated at: https://myaccount.google.com/apppasswords (select "Mail" and "Other (Custom name: ZENET HUB)")\n` +
        `Note: Your account requires 2-Step Verification turned on to generate an App Password.`
    };
  }

  return {
    configured: true,
    provider: config.provider,
    senderAddress: config.fromEmail,
    officialSender: OFFICIAL_SENDER_GMAIL,
    hasAppPassword,
    missingVariables: [],
    setupInstructions: `Email service is live using provider: ${config.provider}. Sender is ${config.fromEmail}. Emails will be delivered to each recipient's registered address.`
  };
}

/**
 * Verifies live SMTP handshake with mail server
 */
export async function verifySmtpConnection(): Promise<{ ok: boolean; message: string; provider: string; senderAddress: string }> {
  const config = getEmailServiceConfig();
  if (config.provider === 'none') {
    return {
      ok: false,
      provider: 'none',
      senderAddress: config.fromEmail,
      message: `Email provider not active. Official sender is ${OFFICIAL_SENDER_GMAIL}. Set GMAIL_APP_PASSWORD in your server environment to start live delivery.`
    };
  }

  const { transporter } = getTransporter();
  if (!transporter) {
    return {
      ok: false,
      provider: config.provider,
      senderAddress: config.fromEmail,
      message: 'Failed to initialize mail transporter.'
    };
  }

  try {
    await transporter.verify();
    return {
      ok: true,
      provider: config.provider,
      senderAddress: config.fromEmail,
      message: `SMTP connection to ${config.provider} verified successfully! Ready to deliver emails from ${config.fromEmail}.`
    };
  } catch (err: any) {
    return {
      ok: false,
      provider: config.provider,
      senderAddress: config.fromEmail,
      message: `SMTP verification failed: ${err?.message || err}`
    };
  }
}

// Cached Nodemailer transporter
let cachedTransporter: Transporter | null = null;
let lastTransporterConfigKey = '';

function getTransporter(): { transporter: Transporter | null; provider: string; fromEmail: string } {
  const config = getEmailServiceConfig();
  if (config.provider === 'none') {
    return { transporter: null, provider: 'none', fromEmail: config.fromEmail };
  }

  const currentKey = `${config.provider}_${config.gmailUser || ''}_${config.resendApiKey || ''}_${config.smtpHost || ''}`;
  if (cachedTransporter && lastTransporterConfigKey === currentKey) {
    return { transporter: cachedTransporter, provider: config.provider, fromEmail: config.fromEmail };
  }

  try {
    if (config.provider === 'gmail_smtp') {
      cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.gmailUser,
          pass: config.gmailAppPassword
        }
      });
    } else if (config.provider === 'resend') {
      // Resend SMTP connection
      cachedTransporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: config.resendApiKey
        }
      });
    } else if (config.provider === 'custom_smtp') {
      cachedTransporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpSecure || false,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass
        }
      });
    }

    lastTransporterConfigKey = currentKey;
    return { transporter: cachedTransporter, provider: config.provider, fromEmail: config.fromEmail };
  } catch (err: any) {
    console.error('[EmailService] Failed to initialize email transporter:', err?.message || err);
    return { transporter: null, provider: 'none', fromEmail: config.fromEmail };
  }
}

/**
 * Universal HTML Email Layout with ZENET HUB Signature Purple & White Theme
 */
export function buildZenetHtmlEmail({
  recipientName,
  recipientEmail,
  badgeText,
  badgeType = 'purple',
  headline,
  introText,
  detailsTable,
  actionButton,
  securityNote,
  footerNote,
  previewSnippet
}: {
  recipientName?: string;
  recipientEmail: string;
  badgeText: string;
  badgeType?: 'purple' | 'green' | 'amber';
  headline: string;
  introText: string;
  detailsTable?: Array<{ label: string; value: string }>;
  actionButton?: { text: string; url: string };
  securityNote?: string;
  footerNote?: string;
  previewSnippet?: string;
}): string {
  const badgeColors = {
    purple: { bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' },
    green: { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
    amber: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' }
  }[badgeType];

  const detailsRows = (detailsTable || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; color: #64748B; font-weight: 600; border-bottom: 1px solid #F1EDFA;">${item.label}</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #171329; font-weight: 700; text-align: right; border-bottom: 1px solid #F1EDFA;">${item.value}</td>
      </tr>`
    )
    .join('');

  const actionButtonHtml = actionButton
    ? `
    <div style="text-align: center; margin: 28px 0 16px 0;">
      <a href="${actionButton.url}" target="_blank" style="display: inline-block; background-color: #6D28D9; color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 28px; border-radius: 14px; box-shadow: 0 4px 12px rgba(109, 40, 217, 0.25);">
        ${actionButton.text}
      </a>
    </div>`
    : '';

  const securityNoteHtml = securityNote
    ? `
    <div style="margin-top: 24px; padding: 12px 16px; background-color: #FAF8FE; border: 1px solid #E9E2FA; border-radius: 12px; font-size: 12px; color: #64748B; line-height: 1.5;">
      <strong style="color: #6D28D9;">🛡️ Security Notice:</strong> ${securityNote}
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171329;">
  <!-- Gmail & Phone Lock Screen Push Notification Preview Snippet -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0; mso-hide: all;">
    ${(previewSnippet || headline).replace(/"/g, '&quot;')}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #E9E2FA; border-radius: 24px; overflow: hidden; box-shadow: 0 8px 30px rgba(109, 40, 217, 0.05);">
          
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #6D28D9 0%, #4C1D95 100%); padding: 26px 30px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px;">
                      ZENET <span style="background-color: rgba(255, 255, 255, 0.2); padding: 2px 8px; border-radius: 8px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; vertical-align: middle;">HUB</span>
                    </div>
                    <div style="font-size: 11px; color: #DDD6FE; font-weight: 600; margin-top: 4px; letter-spacing: 0.5px;">
                      DIGITAL MARKETPLACE &bull; VIRTUAL NUMBERS &bull; ESCROW
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size: 22px;">⚡</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 28px;">
              
              <!-- Badge -->
              <div style="margin-bottom: 16px;">
                <span style="display: inline-block; background-color: ${badgeColors.bg}; color: ${badgeColors.text}; border: 1px solid ${badgeColors.border}; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 12px; border-radius: 20px;">
                  ${badgeText}
                </span>
              </div>

              <!-- Greeting & Headline -->
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 900; color: #171329; line-height: 1.3; letter-spacing: -0.3px;">
                ${headline}
              </h1>

              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                ${recipientName ? `Hello <strong>${recipientName}</strong>,<br><br>` : ''}${introText}
              </p>

              <!-- Transaction / Detail Table -->
              ${
                detailsTable && detailsTable.length > 0
                  ? `<div style="background-color: #FAF8FE; border: 1px solid #E9E2FA; border-radius: 16px; overflow: hidden; margin: 20px 0;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        ${detailsRows}
                      </table>
                    </div>`
                  : ''
              }

              <!-- Action Button -->
              ${actionButtonHtml}

              <!-- Security Note -->
              ${securityNoteHtml}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF8FE; border-top: 1px solid #E9E2FA; padding: 22px 28px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748B; font-weight: 500;">
                This notification was sent to <strong>${recipientEmail}</strong> for your registered ZENET HUB account on <a href="${ZENET_HUB_URL}" style="color: #6D28D9; text-decoration: none; font-weight: 600;">https://zenet-hub.com.ng</a>.
              </p>
              ${footerNote ? `<p style="margin: 0 0 8px 0; font-size: 11px; color: #64748B;">${footerNote}</p>` : ''}
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                &copy; ${new Date().getFullYear()} ZENET HUB. All rights reserved. Do not reply directly to this automated email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Universal Core Sender with Idempotency & Deduplication
 */
export async function sendZenetEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
  metadata = {},
  db
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const cleanTo = (to || '').trim().toLowerCase();

  // Basic recipient validation
  if (!cleanTo || !cleanTo.includes('@') || !cleanTo.includes('.')) {
    console.warn(`[EmailService] Invalid recipient email passed: "${to}". Skipping send.`);
    return { success: false, recipient: cleanTo, error: 'Invalid recipient email address.' };
  }

  // 1. In-memory duplicate check
  if (idempotencyKey && inMemorySentKeys.has(idempotencyKey)) {
    console.log(`[EmailService] In-memory duplicate email blocked for key: ${idempotencyKey}`);
    return { success: true, alreadySent: true, recipient: cleanTo };
  }

  // 2. Firestore persistent duplicate check
  if (idempotencyKey && db) {
    try {
      const emailRecordRef = doc(db, 'sent_email_notifications', idempotencyKey);
      const emailSnap = await getDoc(emailRecordRef);
      if (emailSnap.exists()) {
        const recordData = emailSnap.data();
        if (recordData?.status === 'sent') {
          console.log(`[EmailService] Firestore persistent duplicate email blocked for key: ${idempotencyKey}`);
          inMemorySentKeys.add(idempotencyKey);
          return { success: true, alreadySent: true, recipient: cleanTo };
        }
      }
    } catch (checkErr: any) {
      console.warn('[EmailService] Firestore duplicate read notice:', checkErr?.message);
    }
  }

  const { transporter, provider, fromEmail } = getTransporter();

  // If email provider is not configured yet, record diagnostic and log instruction
  if (!transporter || provider === 'none') {
    const status = getEmailServiceStatus();
    console.warn(`[EmailService Notice] Email to ${cleanTo} ("${subject}") not dispatched because email provider is not configured in .env.`);
    console.warn(`[EmailService Setup Action Required]: Set GMAIL_USER and GMAIL_APP_PASSWORD, or RESEND_API_KEY in your server environment variables.`);

    // If Firestore is available, record as pending configuration
    if (idempotencyKey && db) {
      try {
        await setDoc(
          doc(db, 'sent_email_notifications', idempotencyKey),
          {
            id: idempotencyKey,
            recipient: cleanTo,
            subject,
            status: 'queued_pending_credentials',
            missingVariables: status.missingVariables,
            metadata,
            attemptedAt: new Date().toISOString()
          },
          { merge: true }
        );
      } catch {}
    }

    return {
      success: false,
      provider: 'none',
      recipient: cleanTo,
      error: 'Email provider not configured on server. Please configure GMAIL_USER and GMAIL_APP_PASSWORD, or RESEND_API_KEY in .env.'
    };
  }

  // 3. Dispatch real email via Nodemailer
  try {
    const info = await transporter.sendMail({
      from: fromEmail,
      to: cleanTo,
      subject,
      text: text || subject,
      html
    });

    console.log(`[EmailService] Real email successfully sent to ${cleanTo}! (Subject: "${subject}", MessageID: ${info.messageId})`);

    if (idempotencyKey) {
      inMemorySentKeys.add(idempotencyKey);
      // Clean up set if too large
      if (inMemorySentKeys.size > 2000) {
        const first = inMemorySentKeys.values().next().value;
        if (first) inMemorySentKeys.delete(first);
      }
    }

    // Record success in Firestore
    if (idempotencyKey && db) {
      try {
        await setDoc(
          doc(db, 'sent_email_notifications', idempotencyKey),
          {
            id: idempotencyKey,
            recipient: cleanTo,
            subject,
            provider,
            messageId: info.messageId,
            status: 'sent',
            metadata,
            sentAt: new Date().toISOString()
          },
          { merge: true }
        );
      } catch (saveErr: any) {
        console.warn('[EmailService] Record save notice:', saveErr?.message);
      }
    }

    return {
      success: true,
      messageId: info.messageId,
      provider,
      recipient: cleanTo
    };
  } catch (sendErr: any) {
    console.error(`[EmailService Error] Failed to send email to ${cleanTo}:`, sendErr?.message || sendErr);
    return {
      success: false,
      provider,
      recipient: cleanTo,
      error: sendErr?.message || 'Email delivery failed'
    };
  }
}

// =========================================================================
// SPECIALIZED TRANSACTION & ACTIVITY EMAIL DISPATCHERS
// =========================================================================

/**
 * 1. User Registration / Welcome Email
 */
export async function sendWelcomeEmail({
  to,
  name,
  userId,
  db
}: {
  to: string;
  name?: string;
  userId?: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const cleanName = name || 'Valued Member';
  const subject = 'Welcome to ZENET HUB ⚡ Your Account is Ready';
  const idempotencyKey = `welcome_${userId || to.toLowerCase().trim()}`;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const previewSnippet = `Welcome to ZENET HUB! Your account is active and verified.`;

  const html = buildZenetHtmlEmail({
    recipientName: cleanName,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'Welcome to ZENET HUB',
    badgeType: 'purple',
    headline: 'Welcome to the Premier Digital Marketplace!',
    introText:
      `We are thrilled to have you with us. Your account is now active and ready. You have instant access to carrier-grade Virtual SMS Numbers, verified social accounts, instant wallet funding, and escrow-protected services on <strong>https://zenet-hub.com.ng</strong>.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB (https://zenet-hub.com.ng)' },
      { label: 'Registered Email', value: to },
      { label: 'Account Status', value: 'Active & Verified' },
      { label: 'Registration Date', value: `${dateStr} • ${timeStr}` }
    ],
    actionButton: {
      text: 'Explore Marketplace Now',
      url: ZENET_HUB_URL
    },
    securityNote:
      'Keep your account password secure. ZENET HUB will never ask for your password or confidential codes via email or message.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Welcome to ZENET HUB, ${cleanName}! Your account with ${to} is now active. Explore Virtual SMS Numbers, Log Accounts, and Marketplace services at ${ZENET_HUB_URL}.`,
    idempotencyKey,
    metadata: { type: 'welcome', userId },
    db
  });
}

/**
 * 2. User Login Security Alert
 */
export async function sendLoginNotificationEmail({
  to,
  name,
  ip,
  userAgent,
  db
}: {
  to: string;
  name?: string;
  ip?: string;
  userAgent?: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const cleanName = name || 'ZENET User';
  const subject = 'New Sign-In to ZENET HUB';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  // One email per login session per minute
  const idempotencyKey = `login_${to.toLowerCase().trim()}_${Math.floor(Date.now() / 60000)}`;

  const previewSnippet = `New sign-in detected for your ZENET HUB account on ${dateStr} at ${timeStr}.`;

  const html = buildZenetHtmlEmail({
    recipientName: cleanName,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'Security Notice',
    badgeType: 'amber',
    headline: 'New Sign-In to ZENET HUB',
    introText:
      `Your ZENET HUB account was successfully accessed on <strong>https://zenet-hub.com.ng</strong>. If this was you, you can safely ignore this notification.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB (https://zenet-hub.com.ng)' },
      { label: 'Account Email', value: to },
      { label: 'Date & Time', value: `${dateStr} • ${timeStr}` },
      ...(ip ? [{ label: 'IP Address', value: ip }] : []),
      ...(userAgent ? [{ label: 'Device / Browser', value: userAgent.slice(0, 48) + (userAgent.length > 48 ? '...' : '') }] : [])
    ],
    actionButton: {
      text: 'Open ZENET HUB',
      url: ZENET_HUB_URL
    },
    securityNote:
      'If you did not initiate this sign-in, please secure your account immediately by changing your password at https://zenet-hub.com.ng and contacting support to protect your funds.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `New Sign-In to ZENET HUB: Your account (${to}) was accessed on ${dateStr} at ${timeStr}. If this was not you, please secure your account immediately at ${ZENET_HUB_URL}.`,
    idempotencyKey,
    metadata: { type: 'login_alert', ip },
    db
  });
}

/**
 * 3. Virtual Number Purchase Confirmation
 */
export async function sendVirtualNumberPurchaseEmail({
  to,
  name,
  serviceName,
  country,
  phoneNumber,
  amount,
  orderId,
  db
}: {
  to: string;
  name?: string;
  serviceName: string;
  country: string;
  phoneNumber: string;
  amount: number;
  orderId: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  const subject = `Order Confirmed: ${serviceName.toUpperCase()} Virtual Number (${cleanPhone})`;
  const idempotencyKey = `vsn_buy_${orderId}`;
  const previewSnippet = `Your ${serviceName} virtual number (${cleanPhone}) has been allocated successfully.`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'Purchase Confirmed',
    badgeType: 'green',
    headline: 'Your Virtual Number is Active & Ready',
    introText: `Your request for a <strong>${serviceName}</strong> virtual number has been successfully processed on <strong>ZENET HUB</strong>. The carrier has allocated your number. You can now use it on the service and watch for your verification code.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Order ID', value: orderId },
      { label: 'Service', value: serviceName },
      { label: 'Country', value: country },
      { label: 'Allocated Number', value: cleanPhone },
      { label: 'Amount Paid', value: `₦${amount.toLocaleString()}` },
      { label: 'Waiting Window', value: 'Up to 20 minutes' }
    ],
    actionButton: {
      text: 'View Number & Wait for OTP',
      url: `${ZENET_HUB_URL}?view=virtual_numbers`
    },
    securityNote:
      'Per our Security & Refund Policy, refund requests unlock after 15 minutes if no SMS code arrives. Once an OTP is received, the order is completed and non-refundable.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Order Confirmed: You purchased a ${serviceName} virtual number (${cleanPhone}) for ₦${amount.toLocaleString()}. Order ID: ${orderId}. View your code at ${ZENET_HUB_URL}?view=virtual_numbers.`,
    idempotencyKey,
    metadata: { type: 'virtual_number_purchase', orderId, phoneNumber },
    db
  });
}

/**
 * 4. OTP Received / Available Notification (Without Exposing OTP in Email!)
 * Requirement: "send an email notification informing them that their OTP is available, without exposing the OTP itself in the email."
 */
export async function sendOtpAvailableNotificationEmail({
  to,
  name,
  serviceName,
  country,
  phoneNumber,
  orderId,
  db
}: {
  to: string;
  name?: string;
  serviceName: string;
  country: string;
  phoneNumber: string;
  orderId: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  const subject = `Your Verification Code for ${serviceName.toUpperCase()} is Ready! ⚡`;
  const idempotencyKey = `vsn_otp_${orderId}`;
  const previewSnippet = `Carrier verification code for your ${serviceName} number is now ready to view in your ZENET HUB dashboard.`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'OTP Available',
    badgeType: 'green',
    headline: `Carrier Code Arrived for ${serviceName}`,
    introText: `Great news! The carrier has delivered an SMS verification code for your number <strong>${cleanPhone}</strong>. For your privacy and account security, the code is waiting safely inside your personal ZENET HUB dashboard.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Service', value: serviceName },
      { label: 'Country', value: country },
      { label: 'Phone Number', value: cleanPhone },
      { label: 'Status', value: 'Code Ready in Dashboard' },
      { label: 'Received At', value: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }
    ],
    actionButton: {
      text: 'View Verification Code',
      url: `${ZENET_HUB_URL}?view=virtual_numbers`
    },
    securityNote:
      'Never share your verification code with anyone. ZENET HUB administrators and agents will never ask you for your SMS code.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Great news! The carrier verification code for your ${serviceName} number (${cleanPhone}) has arrived. For security, please log in to your ZENET HUB dashboard to view and copy your code at ${ZENET_HUB_URL}?view=virtual_numbers.`,
    idempotencyKey,
    metadata: { type: 'otp_available', orderId, phoneNumber },
    db
  });
}

/**
 * 5. Wallet Deposit / Funding Success Email
 */
export async function sendWalletDepositSuccessEmail({
  to,
  name,
  amount,
  previousBalance,
  newBalance,
  reference,
  paymentMethod = 'Paystack',
  date,
  db
}: {
  to: string;
  name?: string;
  amount: number;
  previousBalance?: number;
  newBalance: number;
  reference: string;
  paymentMethod?: string;
  date?: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const subject = `Deposit Confirmed: ₦${amount.toLocaleString()} Credited to Your Wallet`;
  const idempotencyKey = `deposit_${reference}`;
  const previewSnippet = `₦${amount.toLocaleString()} has been verified and credited to your ZENET HUB wallet.`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'Deposit Confirmed',
    badgeType: 'green',
    headline: 'Wallet Successfully Funded!',
    introText: `Your payment of <strong>₦${amount.toLocaleString()}</strong> has been verified and instantly credited to your ZENET HUB wallet on <strong>https://zenet-hub.com.ng</strong>. Your funds are ready for instant checkout.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Amount Credited', value: `₦${amount.toLocaleString()}` },
      ...(previousBalance !== undefined ? [{ label: 'Previous Balance', value: `₦${previousBalance.toLocaleString()}` }] : []),
      { label: 'New Wallet Balance', value: `₦${newBalance.toLocaleString()}` },
      { label: 'Payment Reference', value: reference },
      { label: 'Payment Channel', value: paymentMethod },
      { label: 'Date', value: date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    ],
    actionButton: {
      text: 'Browse Services & Shop',
      url: ZENET_HUB_URL
    },
    securityNote:
      'All transactions on ZENET HUB are protected by our Escrow and Automated Dispute Resolution systems.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Deposit Confirmed: ₦${amount.toLocaleString()} was successfully credited to your ZENET HUB wallet. Your new balance is ₦${newBalance.toLocaleString()}. Reference: ${reference}. Visit ${ZENET_HUB_URL} to shop.`,
    idempotencyKey,
    metadata: { type: 'wallet_deposit', reference, amount, newBalance },
    db
  });
}

/**
 * 6. Refund Success Email
 */
export async function sendRefundSuccessEmail({
  to,
  name,
  amount,
  reason,
  newBalance,
  orderId,
  date,
  db
}: {
  to: string;
  name?: string;
  amount: number;
  reason?: string;
  newBalance?: number;
  orderId?: string;
  date?: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const subject = `Refund Credited: ₦${amount.toLocaleString()} Returned to Your Wallet`;
  const idempotencyKey = `refund_${orderId || Date.now()}`;
  const previewSnippet = `₦${amount.toLocaleString()} has been refunded back to your ZENET HUB wallet.`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'Refund Processed',
    badgeType: 'purple',
    headline: 'Refund Credited to Your Wallet',
    introText: `A refund of <strong>₦${amount.toLocaleString()}</strong> has been successfully returned to your ZENET HUB wallet on <strong>https://zenet-hub.com.ng</strong>.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Refund Amount', value: `₦${amount.toLocaleString()}` },
      { label: 'Reason', value: reason || 'Carrier Waiting Timeout / Cancelled' },
      ...(orderId ? [{ label: 'Order ID / Ref', value: orderId }] : []),
      ...(newBalance !== undefined ? [{ label: 'Current Wallet Balance', value: `₦${newBalance.toLocaleString()}` }] : []),
      { label: 'Date', value: date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    ],
    actionButton: {
      text: 'View Wallet Balance',
      url: `${ZENET_HUB_URL}?view=wallet`
    },
    securityNote:
      'Refunds are credited immediately back to your original ZENET HUB wallet balance with zero deduction fees.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Refund Processed: ₦${amount.toLocaleString()} has been refunded to your ZENET HUB wallet. Order: ${orderId || 'N/A'}. Reason: ${reason || 'Cancelled'}. Check your balance at ${ZENET_HUB_URL}?view=wallet.`,
    idempotencyKey,
    metadata: { type: 'refund', orderId, amount },
    db
  });
}

/**
 * 7. Log Account / Digital Product Purchase Email
 */
export async function sendProductPurchaseSuccessEmail({
  to,
  name,
  productTitle,
  amount,
  orderId,
  transactionId,
  category = 'Log Account',
  db
}: {
  to: string;
  name?: string;
  productTitle: string;
  amount: number;
  orderId: string;
  transactionId?: string;
  category?: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const subject = `Order Confirmed: ${productTitle} (₦${amount.toLocaleString()})`;
  const idempotencyKey = `prod_buy_${orderId}`;
  const previewSnippet = `Your purchase of ${productTitle} was confirmed with 24h escrow protection.`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'Purchase Confirmed',
    badgeType: 'green',
    headline: 'Product Purchased Successfully!',
    introText: `Your purchase of <strong>${productTitle}</strong> was successful on <strong>ZENET HUB</strong>. Your account credentials and delivery files are secured in Escrow and accessible anytime in your account.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Product Name', value: productTitle },
      { label: 'Category', value: category },
      { label: 'Order ID', value: orderId },
      ...(transactionId ? [{ label: 'Transaction ID', value: transactionId }] : []),
      { label: 'Amount Paid', value: `₦${amount.toLocaleString()}` },
      { label: 'Escrow Status', value: 'Protected (24h Window)' }
    ],
    actionButton: {
      text: 'View Account Credentials',
      url: `${ZENET_HUB_URL}?view=history`
    },
    securityNote:
      'Always test account credentials promptly. If you encounter any issue, use the Contact Seller or Escrow Resolution button within 24 hours.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Order Confirmed: You purchased ${productTitle} for ₦${amount.toLocaleString()}. Order ID: ${orderId}. View your delivery details at ${ZENET_HUB_URL}?view=history.`,
    idempotencyKey,
    metadata: { type: 'product_purchase', orderId, productTitle, amount },
    db
  });
}

/**
 * 8. Social Boost / TikTok Promotion Order Email
 */
export async function sendSocialBoostOrderSuccessEmail({
  to,
  name,
  serviceName,
  targetUrl,
  quantity,
  amount,
  orderId,
  db
}: {
  to: string;
  name?: string;
  serviceName: string;
  targetUrl: string;
  quantity: number;
  amount: number;
  orderId: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const subject = `Order Placed: ${serviceName} (${quantity.toLocaleString()} Units)`;
  const idempotencyKey = `boost_buy_${orderId}`;
  const previewSnippet = `Your promotion order for ${serviceName} has been received and queued.`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'Order In Progress',
    badgeType: 'purple',
    headline: 'Your Promotion Order is Processing',
    introText: `Your social media promotion order for <strong>${serviceName}</strong> has been received and queued for delivery on <strong>ZENET HUB</strong>.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Service', value: serviceName },
      { label: 'Quantity', value: quantity.toLocaleString() },
      { label: 'Target Link', value: targetUrl.length > 36 ? targetUrl.slice(0, 36) + '...' : targetUrl },
      { label: 'Amount Paid', value: `₦${amount.toLocaleString()}` },
      { label: 'Order ID', value: orderId },
      { label: 'Status', value: 'Queued / Processing' }
    ],
    actionButton: {
      text: 'Check Order Status',
      url: `${ZENET_HUB_URL}?view=history`
    },
    securityNote:
      'Please keep your account or video public while the order is processing. Do not change username or link until fulfillment is complete.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Order Received: Your promotion order for ${serviceName} (${quantity.toLocaleString()} units) was placed for ₦${amount.toLocaleString()}. Order ID: ${orderId}. Track status at ${ZENET_HUB_URL}?view=history.`,
    idempotencyKey,
    metadata: { type: 'social_boost_order', orderId, serviceName, amount },
    db
  });
}

/**
 * 9. Wallet Withdrawal / Payout Notification Email
 */
export async function sendWalletWithdrawalUpdateEmail({
  to,
  name,
  amount,
  status,
  bankName,
  accountNumber,
  reference,
  date,
  db
}: {
  to: string;
  name?: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'approved' | 'completed' | 'rejected' | 'failed';
  bankName?: string;
  accountNumber?: string;
  reference: string;
  date?: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const statusLabels: Record<string, string> = {
    pending: 'Payout Requested / Pending Review',
    confirmed: 'Payout Confirmed / Processing',
    approved: 'Payout Approved',
    completed: 'Payout Completed & Sent',
    rejected: 'Payout Declined & Refunded to Wallet',
    failed: 'Payout Failed & Refunded to Wallet'
  };

  const subject = status === 'completed'
    ? `Withdrawal Paid: ₦${amount.toLocaleString()} Sent to Your Bank`
    : `Withdrawal Request: ₦${amount.toLocaleString()} (${(statusLabels[status] || status).toUpperCase()})`;

  const idempotencyKey = `withdrawal_${reference}_${status}`;
  const maskedAcc = accountNumber ? `••••${accountNumber.slice(-4)}` : undefined;
  const previewSnippet = `Withdrawal update: ₦${amount.toLocaleString()} is ${statusLabels[status] || status}.`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: status === 'completed' ? 'Payout Sent' : 'Withdrawal Update',
    badgeType: status === 'completed' ? 'green' : status === 'rejected' || status === 'failed' ? 'amber' : 'purple',
    headline: status === 'completed' ? 'Withdrawal Payout Completed!' : 'Withdrawal Status Update',
    introText: status === 'completed'
      ? `Your withdrawal request of <strong>₦${amount.toLocaleString()}</strong> has been approved and sent to your bank account.`
      : `Your withdrawal request of <strong>₦${amount.toLocaleString()}</strong> on ZENET HUB has been updated to <strong>${statusLabels[status] || status}</strong>.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Amount', value: `₦${amount.toLocaleString()}` },
      { label: 'Status', value: statusLabels[status] || status },
      { label: 'Reference ID', value: reference },
      ...(bankName ? [{ label: 'Bank Name', value: bankName }] : []),
      ...(maskedAcc ? [{ label: 'Account Number', value: maskedAcc }] : []),
      { label: 'Date', value: date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    ],
    actionButton: {
      text: 'View Wallet & History',
      url: `${ZENET_HUB_URL}?view=wallet`
    },
    securityNote:
      'Withdrawals are processed directly by ZENET HUB authorized accounting via secure bank transfer channels.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Withdrawal Update: ₦${amount.toLocaleString()} (${statusLabels[status] || status}). Reference: ${reference}. Visit ${ZENET_HUB_URL}?view=wallet for details.`,
    idempotencyKey,
    metadata: { type: 'withdrawal_update', reference, amount, status },
    db
  });
}

/**
 * 10. General Wallet Transaction Activity Email (Credit / Debit / Override)
 */
export async function sendWalletTransactionSuccessEmail({
  to,
  name,
  type,
  amount,
  previousBalance,
  newBalance,
  description,
  reference,
  db
}: {
  to: string;
  name?: string;
  type: 'credit' | 'debit' | 'adjustment';
  amount: number;
  previousBalance?: number;
  newBalance: number;
  description: string;
  reference: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const isCredit = type === 'credit';
  const subject = `Wallet ${isCredit ? 'Credit' : 'Activity'}: ₦${amount.toLocaleString()} (${ZENET_HUB_NAME})`;
  const idempotencyKey = `tx_${reference}`;
  const previewSnippet = `Your ZENET HUB wallet has been updated by ₦${amount.toLocaleString()}. New balance: ₦${newBalance.toLocaleString()}.`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: isCredit ? 'Wallet Credited' : 'Wallet Updated',
    badgeType: isCredit ? 'green' : 'purple',
    headline: isCredit ? 'Wallet Credited Successfully!' : 'Wallet Transaction Completed',
    introText: `An account wallet transaction of <strong>₦${amount.toLocaleString()}</strong> has completed on your ZENET HUB account.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Transaction Type', value: isCredit ? 'Credit / Deposit' : 'Debit / Adjustment' },
      { label: 'Amount', value: `₦${amount.toLocaleString()}` },
      ...(previousBalance !== undefined ? [{ label: 'Previous Balance', value: `₦${previousBalance.toLocaleString()}` }] : []),
      { label: 'New Balance', value: `₦${newBalance.toLocaleString()}` },
      { label: 'Description', value: description },
      { label: 'Reference ID', value: reference },
      { label: 'Date', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    ],
    actionButton: {
      text: 'View Wallet Balance',
      url: `${ZENET_HUB_URL}?view=wallet`
    },
    securityNote:
      'All transactions on ZENET HUB are protected by our Escrow and Automated Dispute Resolution systems.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Wallet ${isCredit ? 'Credit' : 'Activity'}: ₦${amount.toLocaleString()}. New Balance: ₦${newBalance.toLocaleString()}. Reference: ${reference}. Details at ${ZENET_HUB_URL}?view=wallet.`,
    idempotencyKey,
    metadata: { type: 'wallet_tx', reference, amount, newBalance },
    db
  });
}

/**
 * 11. Referral Reward Notification Email (Dispatched to Referrer when ₦100 is credited)
 */
export async function sendReferralRewardEmail({
  to,
  name,
  referredUserName,
  amount = 100,
  newBalance,
  qualifyingDepositAmount,
  reference,
  db
}: {
  to: string;
  name?: string;
  referredUserName?: string;
  amount?: number;
  newBalance?: number;
  qualifyingDepositAmount?: number;
  reference: string;
  db?: Firestore | null;
}): Promise<EmailDeliveryResult> {
  const subject = `Referral Bonus Credited: +₦${amount.toLocaleString()} (${ZENET_HUB_NAME})`;
  const idempotencyKey = `ref_reward_${reference}`;
  const previewSnippet = `You earned a ₦${amount.toLocaleString()} referral reward from ${referredUserName || 'a referred friend'}'s deposit!`;

  const html = buildZenetHtmlEmail({
    recipientName: name,
    recipientEmail: to,
    previewSnippet,
    badgeText: 'Referral Reward',
    badgeType: 'green',
    headline: '₦100 Referral Reward Credited!',
    introText: `Congratulations! Your referred friend <strong>${referredUserName || 'a friend'}</strong> just completed a qualifying deposit of <strong>₦${(qualifyingDepositAmount || 1000).toLocaleString()}</strong>. Your <strong>₦${amount.toLocaleString()}</strong> referral bonus has been automatically added to your wallet balance.`,
    detailsTable: [
      { label: 'Website', value: 'ZENET HUB' },
      { label: 'Reward Type', value: 'Referral Bonus' },
      { label: 'Referred Friend', value: referredUserName || 'Referred Friend' },
      { label: 'Bonus Amount', value: `+₦${amount.toLocaleString()}` },
      ...(newBalance !== undefined ? [{ label: 'New Wallet Balance', value: `₦${newBalance.toLocaleString()}` }] : []),
      { label: 'Reference ID', value: reference },
      { label: 'Date', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    ],
    actionButton: {
      text: 'View Referrals & Wallet',
      url: `${ZENET_HUB_URL}?view=referrals`
    },
    securityNote:
      'Keep sharing your referral code to earn unlimited ₦100 rewards for every friend who joins and deposits.'
  });

  return sendZenetEmail({
    to,
    subject,
    html,
    text: `Referral Reward: +₦${amount.toLocaleString()} credited to your wallet from ${referredUserName || 'a referred friend'}'s qualifying deposit! Check your wallet at ${ZENET_HUB_URL}?view=referrals.`,
    idempotencyKey,
    metadata: { type: 'referral_reward', reference, amount, newBalance },
    db
  });
}

