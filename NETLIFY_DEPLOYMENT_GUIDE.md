# ZENET Hub — Netlify Deployment Guide

This project is fully configured for zero-error deployment to Netlify with full Progressive Web App (PWA) support, Paystack payments, and automated virtual account routing.

---

## 🚀 Option 1: 1-Click Netlify Drop (Easiest & Fastest)

If you want to deploy directly in your browser without Git:

1. Use the pre-built `dist.zip` file included in this project.
2. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)**.
3. Drag and drop the `dist.zip` file (or unzip and drop the `dist` folder) directly onto the Netlify Drop area.
4. Netlify will deploy your website live in seconds!

---

## 🚀 Option 2: Deploy via GitHub / Git Repository (Continuous Deployment)

If you connect your GitHub repository to Netlify:

1. **Build Settings**:
   - **Base directory**: (leave blank)
   - **Build command**: `npm run build` (or `npm run build:client`)
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
2. **Environment Variables** (in Netlify Site Settings -> Environment variables):
   - `PAYSTACK_SECRET_KEY`: Your live/test Paystack secret key (`sk_live_...` or `sk_test_...`)
   - `ONEGRIDHUB_API_KEY`: (Optional) Your OneGridHub API key for virtual numbers
   - `NODE_VERSION`: `20` (already pre-configured in `netlify.toml`)

---

## 📱 Progressive Web App (PWA) Features

- **Install Prompt & Banner**: Android and mobile users can install ZENET Hub directly to their home screens.
- **Offline Resilience**: Service worker (`sw.js`) caches critical static assets and images.
- **App Icons**: 192x192 and 512x512 maskable PNG icons included in `/public/icons/`.
- **Manifest**: Web App Manifest with standalone display mode and `#0f172a` theme color.

---

## 🛠️ Included ZIP Archives

- **`dist.zip`**: The production-ready pre-built static bundle for Netlify Drop.
- **`zenet-hub-pwa.zip`**: Complete source code with all configs (`netlify.toml`, `package.json`, `netlify/functions/`, PWA assets).
