# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Club Patio Curauma** — a PWA loyalty program for a Chilean shopping/dining club. Members earn stamps via QR scanning, redeem rewards, and receive AI-generated push notifications. Deployed on Vercel; mobile apps built with Capacitor.

## Commands

```bash
# Development (Turbopack, port 9002, accessible on LAN)
npm run dev

# Build for production
npm run build

# Type check only
npm run typecheck

# Lint
npm run lint

# AI/Genkit dev server (separate terminal)
npm run genkit:dev

# Mobile: sync web build to native projects
npx cap sync
```

No test runner is configured.

## Architecture

### Roles & Access
Four roles gate the UI (defined in `src/lib/roles.ts`):
- **Socio** (member) — home page `/`, stamps, rewards, map
- **Emprendedor** (vendor) — `/vendedor`, QR scanner to award points
- **Director** — `/director`, global metrics dashboard
- **Moderador** (master admin) — `/moderador`, full CRUD

Role switching in development is done via `RoleSwitcher` component (bottom-right). The admin email is `ignaciiio.mate@gmail.com`.

### Data Flow
- **Firebase Auth** handles authentication.
- **Firestore** is the primary database — client access via `src/lib/firebase.ts`, server/admin access via `src/lib/firebaseAdmin.ts`.
- **Loyalty points** logic lives in `src/lib/puntos.ts`.
- **Google Wallet** integration: `src/lib/walletSync.ts` + `/api/google-wallet/` routes.
- **Push notifications**: Firebase Cloud Messaging (FCM) tokens managed in `src/lib/fcmTokenManager.ts`; AI-generated notification copy via `src/ai/flows/`.

### AI (Google Genkit)
- Config: `src/ai/` directory, flows in `src/ai/flows/`
- Model: Gemini 2.5 Flash via `@genkit-ai/google-genai`
- Used for persuasive push notification generation
- Requires separate `npm run genkit:dev` process during AI development

### Mobile (Capacitor 7)
- `capacitor.config.ts` configures the native shell pointing to the web app
- Android project in `android/`, iOS in `ios/`
- Plugins in use: Geolocation, Local Notifications, Preferences
- Custom hooks: `useBackgroundGeolocation`, `useGeofencing`

### Scheduled Jobs
- Defined in `vercel.json` as cron jobs hitting `/api/cron/daily-notifications` and `/api/cron/afternoon-notifications`
- Firebase Cloud Functions also exist in `functions/` for additional backend logic

### UI System
- shadcn/ui components in `src/components/ui/` (configured via `components.json`)
- Tailwind CSS 3 with custom theme in `tailwind.config.ts`
- Framer Motion for animations, Embla Carousel for carousels
- Recharts for data visualization in dashboards

### Key Environment Variables
All sensitive config lives in `.env.local` (never committed). Required vars:
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config
- `FIREBASE_ADMIN_*` — Firebase Admin SDK (server-side)
- `NEXT_PUBLIC_BASE_URL` — base URL (e.g. `http://localhost:9002` locally, production domain on Vercel)
- `GOOGLE_WALLET_ISSUER_ID` / `GOOGLE_SERVICE_ACCOUNT_*` — Google Wallet
- `NEXT_PUBLIC_MOD_PIN_ADMIN` / `NEXT_PUBLIC_MOD_PIN_FGC` — admin PINs for moderador access
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` — Web Push

### Vercel Deployment
- Production domain: `clubpatiocurauma.synaptechspa.cl` (Vercel alias `club-patio-curauma.vercel.app` is legacy/deprecated)
- `next.config.ts` has `output: 'export'` commented out — the app runs as a standard Next.js server (not static export) on Vercel
- Image optimization is disabled (`unoptimized: true`)
