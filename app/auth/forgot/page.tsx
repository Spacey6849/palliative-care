"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

export default function ForgotPasswordPage() {
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === 'dark';

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <main className="min-h-screen px-4 sm:px-5 pb-10 sm:pb-14 flex flex-col items-center justify-center">
        <section className={`relative w-full max-w-md mx-auto backdrop-blur-xl rounded-3xl border px-5 py-7 sm:px-9 sm:py-9 overflow-hidden shadow-[0_8px_42px_-6px_rgba(0,0,0,0.35)] ${isDark ? 'border-gray-700/60 bg-gray-900/80' : 'border-gray-200 bg-white/85'}`}>
          <header className="relative mb-6 text-center">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Reset Your Password</h1>
            <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Enter your email or username and we’ll send a reset link if it matches an account.</p>
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
              <label htmlFor="identifier" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-600'}`}>Email or Username</label>
              <input id="identifier" type="text" required placeholder="you@example.com or username" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-gray-800/60 border border-gray-700 focus:border-blue-400/70 placeholder-gray-400 text-gray-100' : 'bg-white border border-gray-300 focus:border-blue-500/60 placeholder-gray-400 text-gray-800'}`} value={id} onChange={(e)=>setId(e.target.value)} />
            </div>
            {msg && <p className={`text-[12px] ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{msg}</p>}
            <div className="flex items-center gap-3">
              <button disabled={busy} type="submit" className={`inline-flex justify-center items-center rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-50 text-white ${isDark ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={()=>router.push('/auth?mode=login')} className={`text-sm underline ${isDark ? 'text-white/80 hover:text-white' : 'text-blue-600 hover:text-blue-500'}`}>Back to login</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
