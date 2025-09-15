"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) setError('Missing reset token. Please use the link from your email.');
  }, [token]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <main className="min-h-screen px-4 sm:px-5 pb-10 sm:pb-14 flex flex-col items-center justify-center">
        <section className="relative w-full max-w-md mx-auto backdrop-blur-xl rounded-3xl border px-5 py-7 sm:px-9 sm:py-9 overflow-hidden shadow-[0_8px_42px_-6px_rgba(0,0,0,0.55)] border-white/15 bg-white/10">
          <header className="relative mb-6 text-center">
            <h1 className="text-2xl font-bold">Create New Password</h1>
            <p className="mt-2 text-sm text-white/70">Enter a strong password and confirm it.</p>
          </header>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (!token) { setError('Missing reset token'); return; }
              if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
              if (password !== confirm) { setError('Passwords do not match'); return; }
              try {
                setBusy(true);
                const resp = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
                if (!resp.ok) {
                  const j = await resp.json().catch(()=>({error:'Reset failed'}));
                  setError(j.error || 'Reset failed'); setBusy(false); return;
                }
                router.replace('/auth?mode=login&reset=1');
              } catch (e:any) {
                setError(e?.message || 'Reset failed');
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-5"
          >
            <div>
              <label htmlFor="new-password" className="block text-[13px] font-medium text-white/75 mb-1.5">New Password</label>
              <input id="new-password" type="password" required placeholder="••••••••" className="block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition bg-white/10 border border-white/25 focus:border-blue-400/70 placeholder-white/40" value={password} onChange={e=>setPassword(e.target.value)} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-[13px] font-medium text-white/75 mb-1.5">Confirm Password</label>
              <input id="confirm-password" type="password" required placeholder="••••••••" className="block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition bg-white/10 border border-white/25 focus:border-blue-400/70 placeholder-white/40" value={confirm} onChange={e=>setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-[12px] text-red-300">{error}</p>}
            <button disabled={busy} type="submit" className="w-full inline-flex justify-center items-center gap-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium tracking-wide text-white px-5 py-3 transition focus-visible:outline-none focus-visible:ring-2 shadow-lg bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-300/60">
              {busy ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
