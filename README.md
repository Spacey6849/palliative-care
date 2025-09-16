# BinLink AI – Smart Bin Management

## Aim

Empower communities to monitor, manage, and keep public and private bins healthy using real-time data, secure access, and AI-powered insights.

## Description

BinLink AI is a modern web platform for smart bin management. It provides interactive mapping, live bin metrics, secure authentication, and an AI chat assistant to help users monitor public and household garbage bins. Designed for both admins and regular users, BinLink AI streamlines bin monitoring and data-driven collaboration.

## Features

- Real-time bin metrics dashboard (fill %, lid open/closed, online/offline)
- Interactive map with dark/light mode and bin selection
- Secure authentication (custom login, signup, email verification, password reset)
- User and admin roles
- AI-powered chat assistant (Google Gemini)
- Email notifications for verification, password reset, and lid-open alerts (> 2 minutes)
- Responsive, modern UI with accessibility focus
- Netlify deployment with secrets scanning

## Tech Stack

- Next.js 13 (App Router)
- Supabase (database & auth)
- Node.js 20.x
- React, TypeScript
- Tailwind CSS
- Leaflet (maps)
- Nodemailer (SMTP email)
- Netlify (hosting)

## Prerequisites

- Node.js 20.x (LTS)
- npm 9+
- Supabase project (URL + anon key + service role key)
- SMTP credentials for email verification

## Setup (Local)

1. Install dependencies

```bash
npm install
```

2. Copy environment template and fill in values

```bash
copy .env.example .env.local
```

Then edit `.env.local`:

```ini
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-user
SMTP_PASS=your-pass
MAIL_FROM="BinLink <noreply@example.com>"
```

3. Run the app

```bash
npm run dev
```

Open http://localhost:3000

## Deployment (Netlify)

The repo is configured for Netlify using `@netlify/plugin-nextjs` and Node 20.x (LTS).

- `netlify.toml` sets:
  - build.command = `npm run build`
  - publish = `.next`
  - environment: NODE_VERSION=20, NODE_ENV=production, NPM_FLAGS=--force

Required environment variables in Netlify UI (Site settings → Build & deploy → Environment):

- NEXT_PUBLIC_APP_URL (e.g., https://your-site.netlify.app)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
- GEMINI_API_KEY (optional, for chat)
- ADMIN_SEED_SECRET (optional)
- CRON_SECRET (required for lid-open alert endpoint)
- NEXT_PUBLIC_ADMIN_EMAIL (optional, used by login overlay to allow admin login by email)

Notes:

- Supabase client is created lazily (see `lib/supabase/client.ts`) to avoid build-time env evaluation.
- Sensitive API routes are marked dynamic/no-store where needed.
- If a build fails with missing types in production, ensure required `@types/*` packages are regular dependencies (not devDependencies).

### Environment isolation across projects

If you work with multiple Supabase projects or Netlify sites, make sure each environment uses a unique cookie namespace and consistent project ref:

- Keep one `.env.local` per project and avoid mixing refs/keys.
- The app sets a single session cookie `bl_session`. Clear cookies when switching between projects: in the browser DevTools > Application > Cookies.
- Our Supabase client logs a diagnostic line in dev showing URL ref vs Key ref; if they don’t match, update your env vars.
- After changing env values, fully restart the dev server so server routes pick up the new keys.

## Key paths

- API routes: `app/api/**`
- Auth page: `app/auth/page.tsx`
- Supabase client: `lib/supabase/client.ts`
- Mailer: `lib/mailer.ts`

### Lid-open alerts (cron)

Endpoint: `GET or POST /api/cron/lid-open-alerts`

Security: requires header `x-cron-secret: $CRON_SECRET`

Behavior: scans latest `bin_metrics` per bin; when a bin's `lid_open` is true and the last recorded_at is older than 2 minutes, an email is sent to the owner using `sendBinOpenAlertEmail`.

Backoff: if a table `bin_alerts(bin_id uuid primary key, last_alert_at timestamptz)` exists and is accessible, the endpoint rate-limits emails to at most once every 30 minutes per bin. If the table is missing or blocked by RLS, the endpoint still works but may send more frequently depending on your scheduler cadence.

Scheduling: on Netlify or your platform of choice, set a scheduled job (e.g., every 2 minutes) to invoke this endpoint with the secret header.

## Troubleshooting

- Invalid Supabase URL/Key: Double-check `.env*` and Netlify env variables. URL should be like `https://<ref>.supabase.co`.
- 401 from Supabase in server routes: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Netlify; rotate if needed.
- Email not sending: Verify SMTP\_\* and MAIL_FROM. Check provider logs; ports 465/587 commonly used.
- Local Windows: If Netlify CLI packaging fails, rely on Netlify cloud builds via GitHub.
