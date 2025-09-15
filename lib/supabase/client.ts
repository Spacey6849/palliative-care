import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helpers
const stripQuotes = (v?: string | null) => (v || '').trim().replace(/^['\"]|['\"]$/g, '');
const stripInlineComment = (v: string) => v.replace(/\s+#.*$/, '');

// Resolve env lazily to avoid build-time evaluation/import errors
function resolveUrl(): string {
  // Use bracket access to avoid Next.js compile-time inlining into server bundle
  const rawPub = (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_SUPABASE_URL'];
  const rawSrv = (process.env as Record<string, string | undefined>)['SUPABASE_URL'];
  let url = stripQuotes(rawPub || rawSrv);
  if (!url) return '';
  if (url.endsWith('/')) url = url.replace(/\/+$/, '');
  return url;
}
function resolveAnon(): string {
  // Bracket access prevents bundlers from replacing at build time
  const rawPub = (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const rawSrv = (process.env as Record<string, string | undefined>)['SUPABASE_ANON_KEY'];
  return stripInlineComment(stripQuotes(rawPub || rawSrv));
}
function resolveService(): string {
  return stripInlineComment(stripQuotes((process.env as Record<string, string | undefined>)['SUPABASE_SERVICE_ROLE_KEY']));
}

const URL_PATTERN = /^https:\/\/([a-zA-Z0-9-]+)\.supabase\.(co|in)$/;

// Ensure a single client instance across HMR in dev (server/browser separated)
declare global {
  // eslint-disable-next-line no-var
  var __ecw_sb_client_srv__: SupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __ecw_sb_client_brw__: SupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __ecw_sb_probe_done__: boolean | undefined;
}

function createUniversalClient(): SupabaseClient {
  const url = resolveUrl();
  const anon = resolveAnon();
  const service = resolveService();
  const key = typeof window === 'undefined' ? (service || anon) : anon;

  if (!url) throw new Error('Missing Supabase URL (set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL).');
  if (!key) throw new Error('Missing Supabase key (set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY; or SUPABASE_SERVICE_ROLE_KEY on server).');

  if (!URL_PATTERN.test(url) && process.env.NODE_ENV !== 'production') {
    console.warn('[Supabase] URL does not match expected pattern *.supabase.co ->', url);
  }

  return createClient(url, key, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
      detectSessionInUrl: typeof window !== 'undefined',
    },
    global: { headers: { 'X-Client-Info': typeof window === 'undefined' ? 'ecowell-app/server' : 'ecowell-app/browser' } }
  });
}

// Lazy getter to avoid creating a client at module import time during builds
export function getSupabase(): SupabaseClient {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    if (typeof window === 'undefined') {
      const existing = (globalThis as any).__ecw_sb_client_srv__;
      const client = existing || ((globalThis as any).__ecw_sb_client_srv__ = createUniversalClient());
      devProbeOnce(client);
      return client;
    } else {
      const existing = (globalThis as any).__ecw_sb_client_brw__;
      const client = existing || ((globalThis as any).__ecw_sb_client_brw__ = createUniversalClient());
      devProbeOnce(client);
      return client;
    }
  }
  const client = createUniversalClient();
  return client;
}

// Development-only: run diagnostics once after first client creation
function devProbeOnce(_client: SupabaseClient) {
  if (process.env.NODE_ENV === 'production') return;
  if ((globalThis as any).__ecw_sb_probe_done__) return;
  (globalThis as any).__ecw_sb_probe_done__ = true;
  try {
    const key = typeof window === 'undefined' ? (resolveService() || resolveAnon()) : resolveAnon();
    const url = resolveUrl();
    const m = url.match(/^https:\/\/([a-zA-Z0-9-]+)\.supabase\.(co|in)/);
    const urlRef = m?.[1] ?? 'unknown';
    const payload = (key || '').split('.')[1] || '';
    const json = (typeof window === 'undefined'
      ? (payload ? Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : '{}')
      : (payload ? atob(payload.replace(/-/g, '+').replace(/_/g, '/')) : '{}'));
    const d = JSON.parse(json || '{}');
    const keyRef = d?.ref ?? 'unknown';
    const keyRole = d?.role ?? (typeof window === 'undefined' && resolveService() ? 'service_role' : 'anon');
    const match = urlRef === keyRef;
    // eslint-disable-next-line no-console
    console.log(`[supabase] ${typeof window==='undefined'?'Server':'Browser'} client using ${keyRole} key | url.ref=${urlRef} key.ref=${keyRef} match=${match} key.prefix=${(key||'').slice(0,6)}…`);
  } catch {}

  // Browser: simple health probe
  if (typeof window !== 'undefined') {
    (async () => {
      try {
        const r = await fetch(`${resolveUrl()}/auth/v1/health`, { cache: 'no-store' });
        if (!r.ok) console.warn('[Supabase] Auth health endpoint not OK:', r.status);
      } catch (e) {
        console.warn('[Supabase] Unable to reach auth health endpoint. Check URL / network / DNS.', e);
      }
    })();
  }

  // Server: REST preflight
  if (typeof window === 'undefined') {
    (async () => {
      try {
        const key = resolveService() || resolveAnon();
        const url = `${resolveUrl()}/rest/v1/users?select=id&limit=1`;
        const resp = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' });
        if (!resp.ok) {
          const body = await resp.text().catch(() => '');
          console.warn('[Supabase] REST preflight failed', { status: resp.status, body: body?.slice(0, 200) });
        }
      } catch (e) {
        console.warn('[Supabase] REST preflight error', e);
      }
    })();
  }
}
