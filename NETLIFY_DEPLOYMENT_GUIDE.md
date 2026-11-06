# ZENET Hub — Netlify Production Deployment Guide

This project is fully configured for zero-error deployment to Netlify with full Progressive Web App (PWA) support, Paystack payments, Social Boost SMM services, and OneGridHub Virtual / Service Numbers.

---

## 🚀 Deployment via GitHub / Git Repository (Recommended)

When you connect your GitHub repository to Netlify:

1. **Build & Directory Settings**:
   - **Base directory**: (leave blank or `.`)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions` (auto-detected via `netlify.toml`)

2. **Environment Variables** (Netlify Site Configuration → Environment variables):
   - `PAYSTACK_SECRET_KEY`: Your live Paystack Secret Key (from Paystack Dashboard > Settings > API Keys)
   - `VITE_PAYSTACK_PUBLIC_KEY`: Your live Paystack Public Key (from Paystack Dashboard > Settings > API Keys)
   - `VOIKER_API_KEY`: Your Voiker API key (from Voiker account dashboard)
   - `VOIKER_BASE_URL`: `https://voiker.com/api/v2` (optional, defaults to https://voiker.com/api/v2)
   - `USD_TO_NGN_RATE`: `1650` (or preferred USD/NGN exchange rate)
   - `VSN_API_KEY`: Your VirtualSMSNumbers API key (from virtualsmsnumbers.com dashboard)
   - `EUR_TO_NGN_RATE`: `1750` (or preferred EUR/NGN exchange rate)
   - `GMAIL_USER`: `Zenethubifficial@gmail.com` (Official ZENET HUB sender Gmail)
   - `GMAIL_APP_PASSWORD`: Your 16-character Google App Password
   - `EMAIL_FROM`: `ZENET HUB <Zenethubifficial@gmail.com>`

---

## 💳 Paystack Webhook Configuration

In your **Paystack Dashboard -> Settings -> API Keys & Webhooks**:

Set your **Live Webhook URL** to either of these valid endpoints:
- `https://your-site.netlify.app/api/paystack/webhook`
- or `https://your-site.netlify.app/.netlify/functions/paystack-webhook`

Both endpoints are active, verify the `x-paystack-signature` using HMAC SHA-512, and credit user wallets atomically in Firestore.

---

## 🔐 Firebase Authorized Domains

In your **Firebase Console -> Authentication -> Settings -> Authorized Domains**:
Add your Netlify production domain:
- `your-site.netlify.app`
- (and your custom domain if applicable, e.g., `zenethub.com`)

---

## ⚡ Built-in Resilient Systems

- **Social Boost (SMM - Voiker Provider)**: Direct integration with Voiker (https://voiker.com/api/v2), live automated catalogue synchronization, categorized social platforms (TikTok, Instagram, YouTube, Facebook, Twitter/X, Telegram, WhatsApp, Spotify, Discord, etc.), custom NGN markup rules, atomic wallet deduction, real-time order placement, status tracking, and optional refill/cancel where supported.
- **Service Numbers (Virtual SMS Numbers)**: Multi-server routing via VirtualSMSNumbers integration, real-time pricing and country resolution, instant purchasing, SMS code reception, and cancellation/refunds.
- **Wallet & Transactions**: Real-time balance updates, Paystack deposit verification, idempotent webhook processing, and atomic deductions.
