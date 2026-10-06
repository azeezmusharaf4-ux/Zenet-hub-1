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
   - `VOIKER_API_KEY`: Your Voiker API key (obtain from https://voiker.com/account/api or your Voiker account dashboard under API settings)
   - `VOIKER_BASE_URL`: `https://voiker.com/api/v2` (defaults to https://voiker.com/api/v2 if omitted)
   - `USD_TO_NGN_RATE`: `1650` (or your preferred exchange rate for converting Voiker USD rates to NGN)
   - `VSN_API_KEY`: Your VirtualSMSNumbers API key
   - `PAYSTACK_SECRET_KEY`: Your live Paystack secret key (`sk_live_...`)
   - `VITE_FIREBASE_PROJECT_ID`: Your Firebase project ID (`ai-studio-zenetmarketplace-7ba093fa-b6fb-4165-994b-445510dd6aa9`)
   - `VITE_FIREBASE_API_KEY`: Your Firebase web API key
   - `VITE_FIREBASE_AUTH_DOMAIN`: `ai-studio-zenetmarketplace-7ba093fa-b6fb-4165-994b-445510dd6aa9.firebaseapp.com`
   - `VITE_FIREBASE_STORAGE_BUCKET`: `ai-studio-zenetmarketplace-7ba093fa-b6fb-4165-994b-445510dd6aa9.appspot.com`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase sender ID
   - `VITE_FIREBASE_APP_ID`: Your Firebase app ID

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
