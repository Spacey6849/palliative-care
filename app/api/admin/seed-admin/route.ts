export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Set these in your environment (DO NOT commit real values):
// SUPABASE_SERVICE_ROLE_KEY=... (service role key)
// NEXT_PUBLIC_SUPABASE_URL=... (already present)
// ADMIN_SEED_SECRET=some-long-random-string (shared secret to call this endpoint)

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SEED_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server missing ADMIN_SEED_SECRET' }, { status: 500 });
  }
  const provided = req.headers.get('x-seed-secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = (process.env as Record<string, string | undefined>)["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 });
  }
  const supabaseAdmin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Read admin bootstrap credentials from environment to avoid hardcoding secrets in repo
  const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD in server environment' }, { status: 500 });
  }

  // Check if user exists
  const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existing = users.users.find(u => u.email === ADMIN_EMAIL);
  if (existing) {
    // Ensure confirmed
    if (!existing.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    }
    return NextResponse.json({ status: 'already-exists', id: existing.id, confirmed: true });
  }

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Admin' }
  });
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
  return NextResponse.json({ status: 'created', id: created.user?.id });
}
