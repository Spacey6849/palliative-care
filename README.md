# EcoWell AI – Smart Well Management

## Aim

Empower communities and panchayats to monitor, manage, and protect groundwater resources using real-time data, secure access, and AI-powered insights.

## Description

EcoWell AI is a modern web platform for smart well management. It provides interactive mapping, live well metrics, secure authentication, and an AI chat assistant to help users make informed decisions about water resources. Designed for both admins and panchayat users, EcoWell AI streamlines well monitoring and data-driven collaboration.

## Features

- Real-time groundwater and well metrics dashboard
- Interactive map with dark/light mode and well selection
- Secure authentication (custom login, signup, email verification, password reset)
- Panchayat and admin roles
- AI-powered chat assistant (Google Gemini)
- Email notifications for verification and password reset
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
MAIL_FROM="EcoWell <noreply@example.com>"
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

Notes:

- Supabase client is created lazily (see `lib/supabase/client.ts`) to avoid build-time env evaluation.
- Sensitive API routes are marked dynamic/no-store where needed.
- If a build fails with missing types in production, ensure required `@types/*` packages are regular dependencies (not devDependencies).

## Key paths

- API routes: `app/api/**`
- Auth page: `app/auth/page.tsx`
- Supabase client: `lib/supabase/client.ts`
- Mailer: `lib/mailer.ts`

## Troubleshooting

- Invalid Supabase URL/Key: Double-check `.env*` and Netlify env variables. URL should be like `https://<ref>.supabase.co`.
- 401 from Supabase in server routes: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Netlify; rotate if needed.
- Email not sending: Verify SMTP\_\* and MAIL_FROM. Check provider logs; ports 465/587 commonly used.
- Local Windows: If Netlify CLI packaging fails, rely on Netlify cloud builds via GitHub.
