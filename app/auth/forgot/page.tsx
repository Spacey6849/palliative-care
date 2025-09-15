"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <main className="min-h-screen px-4 sm:px-5 pb-10 sm:pb-14 flex flex-col items-center justify-center">
        <section className="relative w-full max-w-md mx-auto backdrop-blur-xl rounded-3xl border px-5 py-7 sm:px-9 sm:py-9 overflow-hidden shadow-[0_8px_42px_-6px_rgba(0,0,0,0.55)] border-white/15 bg-white/10">
          <header className="relative mb-6 text-center">
            <h1 className="text-2xl font-bold">Reset Your Password</h1>
            <p className="mt-2 text-sm text-white/70">Enter your email or username and we’ll send a reset link if it matches an account.</p>
          </header>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!id.trim()) { setMsg('Please enter an email or username'); return; }
              try {
                setBusy(true);
                setMsg(null);
                const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: id.trim() }) });
                if (res.ok) {
                  setMsg('If an account exists, a reset link has been sent.');
                } else {
                  let text = 'Password reset is temporarily unavailable. Please try again later.';
                  try {
                    const data = await res.json();
                    if (data?.error) text = data.error;
                  } catch {}
                  setMsg(text);
                }
              } catch {
                setMsg('If an account exists, a reset link has been sent.');
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-5"
          >
            <div>
              <label htmlFor="identifier" className="block text-[13px] font-medium text-white/75 mb-1.5">Email or Username</label>
              <input id="identifier" type="text" required placeholder="you@example.com or username" className="block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition bg-white/10 border border-white/25 focus:border-blue-400/70 placeholder-white/40" value={id} onChange={(e)=>setId(e.target.value)} />
            </div>
            {msg && <p className="text-[12px] text-white/80">{msg}</p>}
            <div className="flex items-center gap-3">
              <button disabled={busy} type="submit" className="inline-flex justify-center items-center rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-50 bg-blue-600 hover:bg-blue-500 text-white">
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={()=>router.push('/auth?mode=login')} className="text-sm underline text-white/80 hover:text-white">Back to login</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
