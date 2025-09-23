# BinLink AI – Smart Bin Management

## Aim

Empower local governments and communities to monitor, manage, and optimize bin collection using live IoT metrics, automated alerts, and AI insights.

## Quick project summary

BinLink is a Next.js + Supabase application that visualizes real-time bin metrics, supports admin/user roles, and sends automated emails for lid-open alerts and report generation. It includes an AI assistant for quick bin queries and a predictive fill chart driven by historical metrics.

## Key features

- Interactive map with live bin markers and popups
- Real-time metrics (fill %, lid open/closed, online/offline)
- Role-based UI (admin vs user); admin filters for Private/Public bins
- AI Chat assistant (Gemini) with structured bin grounding
- Email alerts: verification, password reset, lid-open alerts, manual bin reports
- Realtime subscriptions to update UI without full reloads

## Quickstart (local)

1. Install dependencies

```powershell
npm install
```

2. Copy env template and edit

```powershell
copy .env.example .env.local
notepad .env.local
```

Minimum env values:

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

CRON_SECRET=supersecretvalue
GEMINI_API_KEY=your-gemini-key (optional)
```

3. Run

```powershell
npm run dev
```

Open http://localhost:3000

## Deployment notes

- The app is configured for Netlify; use `netlify.toml` and set the same env vars there.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set for server routes that need elevated access.

## Important paths

- API routes: `app/api/**`
- Map page: `app/maps/page.tsx`
- Sidebar/dashboard: `components/sidebar.tsx`
- Map markers/popups: `components/map-component.tsx`
- Mailer helpers: `lib/mailer.ts`
- Supabase client: `lib/supabase/client.ts`

## Lid-open alerts (cron)

- Endpoint: `GET|POST /api/cron/lid-open-alerts`
- Requires header: `x-cron-secret: $CRON_SECRET`
- Behavior: scans `bin_metrics` for lid_open=true with a recorded_at older than 2 minutes and emails the owner. If `bin_alerts` table exists, the route will use it to backoff (default 30 minutes).

## Sending manual bin reports

- Admins can send a manual report from the dashboard or from the map popup. This calls `POST /api/bins/[id]/send-report` with optional `note`, `reason`, and latest fill/is_open values.

## Predictive Fill

- The “AI Predictive Fill (Monthly)” chart in the dashboard uses the last 30 days of `bin_metrics` for the currently filtered bins to derive a daily average and a smoothed prediction.

## Troubleshooting

- If emails don’t send, verify SMTP settings and check provider logs.
- If metrics appear stale, ensure Supabase realtime is configured and the service role key is correct.

## Contributing

1. Fork and create a feature branch
2. Make changes and open a PR
3. CI runs tests and a Netlify preview deploy

---

## Developer notes

- Cookie: `bl_session` is used for user sessions. Clear cookies when switching environments.
- The app prefers `bin_metrics.bin_id` joins with a fallback on `bin_name` to help during migration.
