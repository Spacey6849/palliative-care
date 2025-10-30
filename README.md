# Palliative Care – Remote Patient Monitoring

## Aim

Empower local governments and communities to monitor, manage, and optimize bin collection using live IoT metrics, automated alerts, and AI insights.

## Quick project summary

Palliative Care is a Next.js + Supabase application for real-time remote monitoring of patients. It ingests ESP32-based sensor data (MAX30102, DS18B20, DHT11, AD8232, MPU6050), tracks patient geolocation on a Leaflet map, detects emergencies (low SpO2, abnormal heart rate, falls), and provides dashboards, historical trends, alerts, and analytics. It supports role-based access, exportable reports, and AI-assisted insights for caregivers.

## Tech stack

- Frontend: Next.js 13 (App Router), React 18, TypeScript, Tailwind CSS
- Backend: Server-side Next.js API routes, Supabase Postgres (Realtime)
- Database: Supabase Postgres (tables: users, user_bins, bin_metrics, bin_alerts)
- Realtime: Supabase Realtime subscriptions for soft UI refresh
- Mailer: Nodemailer + SMTP
- Mapping & Charts: Leaflet/react-leaflet and Recharts
- AI: Gemini (via server grounding) for the caregiver assistant
- Hosting: Netlify (preview/deploy) or Vercel; keep service-role key server-side

## Key features

- Core Monitoring: HR, SpO2, body temp, room temp/humidity, ECG, fall detection
- Geospatial: interactive map of patient locations with popups and status colors
- Emergency Alerts: automated detection and notifications for critical events
- Dashboard: sidebar patient list with search/filter/sort, last-updated timestamps
- Trends & Analytics: historical vitals charts and aggregate summaries
- Auth & RBAC: user authentication, admin views, protected routes
- Reporting: alerts history and CSV export
- AI: symptom risk hints, anomaly notes, caregiver Q&A

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
# For production, set to your deployed origin (no path): e.g. https://palliativecare.example.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-user
SMTP_PASS=your-pass
MAIL_FROM="Palliative Care <noreply@example.com>"

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

## Alerts (cron)

- Example pattern: `GET|POST /api/cron/emergency-alerts`
- Requires header: `x-cron-secret: $CRON_SECRET`
- Behavior: scans recent vitals for critical thresholds to notify caregivers and backoff appropriately.

## Sending manual patient alerts

- Admins can trigger a manual emergency flag or send a report from the dashboard or map popup.

## Predictive insights

- The dashboard can surface risk trends from recent vitals to help anticipate adverse events.

## Troubleshooting

- If emails don’t send, verify SMTP settings and check provider logs.
- If metrics appear stale, ensure Supabase realtime is configured and the service role key is correct.

## Contributing

1. Fork and create a feature branch
2. Make changes and open a PR
3. CI runs tests and a Netlify preview deploy

---

## Developer notes

- Session cookie and schema details may vary based on your deployment.
