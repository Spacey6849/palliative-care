"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from 'next-themes';
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUser } from '@/components/user-context';

// We instantiate Leaflet manually because we disable interaction; dynamic import helps tree-shaking
// but here we can access it via global import (Leaflet CSS already imported).

export default function AuthPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMode = (searchParams?.get("mode") as "login" | "signup" | null) || "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [submitting, setSubmitting] = useState(false);
  const [binCategory, setBinCategory] = useState<'private'|'public'>('private');
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string>('');
  const [resendBusy, setResendBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success'|'error'|'info', text: string }|null>(null);
  const { refresh } = useUser();
  // forgot password now uses dedicated page /auth/forgot

  // Initialize Leaflet map once and guard against double-init during Fast Refresh or route changes
  useEffect(() => {
    let destroyed = false;
    const el = mapRef.current as any;
    (async () => {
      if (!el || el._mapInited) return;
      const L = await import('leaflet');
      // If a previous Leaflet instance exists on this element, destroy it first
      if (el._leaflet_id && L) {
        try { const existing = el._leaflet_map || null; if (existing && typeof existing.remove === 'function') existing.remove(); } catch {}
      }
      const map = L.map(el, {
        attributionControl: false,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      }).setView([20, 0], 2.2);
      const darkUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      const lightUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const layer = L.tileLayer(isDark ? darkUrl : lightUrl, { maxZoom: 19 });
      layer.addTo(map);
      el._mapInited = true;
      el._leaflet_map = map;
      // Cleanup on unmount to prevent container reuse error
      (el as any)._cleanup = () => { try { map.remove(); } catch {} };
    })();
    return () => {
      destroyed = true;
      try { if (el && el._cleanup) el._cleanup(); } catch {}
    };
  }, [isDark]);

  const switchMode = (next: "login" | "signup") => {
    if (next === mode) return;
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    router.replace(url.pathname + "?" + url.searchParams.toString(), { scroll: false });
    // focus first field after animation
    setTimeout(() => {
      const id = next === 'login' ? 'login-identifier' : 'signup-name';
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.focus();
    }, 180);
  };

  // Keep state in sync if user changes query manually (back/forward buttons)
  useEffect(() => {
  const qp = (searchParams?.get("mode") as "login" | "signup" | null) || "login";
    if (qp !== mode) setMode(qp);
    // Show banners based on verification outcome
  const verified = searchParams?.get('verified');
  const vErr = searchParams?.get('verify_error');
  const resetOk = searchParams?.get('reset');
    if (verified === '1') {
      setNotice({ kind: 'success', text: 'Email verified successfully. You can now log in.' });
      setMode('login');
    } else if (verified === 'already') {
      setNotice({ kind: 'info', text: 'Email already verified. Please log in.' });
      setMode('login');
    } else if (vErr === 'invalid') {
      setNotice({ kind: 'error', text: 'Invalid or expired verification link. You can request a new link.' });
      setMode('login');
    } else if (vErr === 'missing') {
      setNotice({ kind: 'error', text: 'Missing verification token in link.' });
      setMode('login');
    } else if (resetOk === '1') {
      setNotice({ kind: 'success', text: 'Password updated. You can now log in with your new password.' });
      setMode('login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
  <div className={`relative min-h-screen w-full overflow-x-hidden font-sans ${isDark ? 'text-white' : 'text-gray-900'}`}>
      {/* Map Background */}
    <div ref={mapRef} className="absolute inset-0 -z-20 pointer-events-none" />
      {/* Overlays / gradient noise for depth */}
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(0,200,255,0.16),transparent_60%),radial-gradient(circle_at_85%_75%,rgba(0,255,200,0.12),transparent_55%)]" />
  <div className={`absolute inset-0 -z-10 ${isDark ? 'bg-[linear-gradient(rgba(0,0,0,0.62),rgba(0,0,0,0.86))]' : 'bg-[linear-gradient(rgba(255,255,255,0.92),rgba(240,244,248,0.96))]'}`} />
    {/* Vignette for focus */}
    <div className="absolute inset-0 -z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.4)_85%)]" />

  <main className="min-h-screen px-4 sm:px-5 pb-10 sm:pb-14 flex flex-col overflow-y-auto sm:pt-14 sm:items-center sm:justify-center">
    {/* Mobile spacer to offset fixed nav (increased to ensure full clearance) */}
    <div className="h-[76px] sm:hidden shrink-0" aria-hidden />
        <section
          className={`relative w-full max-w-md mt-4 sm:mt-0 mx-auto backdrop-blur-xl rounded-3xl border px-5 py-7 sm:px-9 sm:py-9 overflow-hidden shadow-[0_8px_42px_-6px_rgba(0,0,0,0.55)] ${isDark ? 'border-white/15 bg-white/10' : 'border-gray-200 bg-white/80'} `}
          aria-label="Authentication"
        >
          <header className="relative mb-8 text-center">
            <h1 className={`text-3xl font-bold tracking-tight ${isDark ? '' : 'text-gray-900'}`}>
              {mode === 'login' ? 'Welcome Back!' : 'Create Account'}
            </h1>
            <p className={`mt-2 text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
              {mode === 'login' ? 'Sign in to continue your journey.' : 'Join us and explore the world.'}
            </p>
          </header>

          <div className="relative min-h-[320px]">
            {/* Login Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true); setError(null);
                try {
                  let identifier = (document.getElementById('login-identifier') as HTMLInputElement)?.value.trim();
                  const password = (document.getElementById('login-password') as HTMLInputElement)?.value;
                  if (identifier) identifier = identifier.toLowerCase();
                  const resp = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) });
                  if (!resp.ok) {
                    const j = await resp.json().catch(()=>({error:'Login failed'}));
                    setError(j.error || 'Login failed'); setSubmitting(false); return;
                  }
                  // Ensure user context reflects new session before navigating
                  try { await refresh(); } catch {}
                  router.replace('/maps');
                } catch (e:any) {
                  setError(e?.message || 'Login error');
                } finally {
                  setSubmitting(false);
                }
              }}
              className={`space-y-5 transition-opacity duration-300 ${mode === 'login' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}
              autoComplete="on"
            >
              {notice && (
                <div className={`text-[12px] rounded-lg px-3 py-2 ${notice.kind==='success' ? (isDark?'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30':'bg-emerald-50 text-emerald-700 border border-emerald-200') : notice.kind==='error' ? (isDark?'bg-red-500/15 text-red-200 border border-red-500/30':'bg-red-50 text-red-700 border border-red-200') : (isDark?'bg-blue-500/15 text-blue-200 border border-blue-500/30':'bg-blue-50 text-blue-700 border border-blue-200')}`}>
                  {notice.text}
                </div>
              )}
              <div>
                <label htmlFor="login-identifier" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Email or Username</label>
                <input id="login-identifier" type="text" required placeholder="you@example.com or username" autoComplete="username" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-blue-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-blue-500/60 placeholder-gray-400 text-gray-800'}`} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className={`block text-[13px] font-medium ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Password</label>
                  <a href="/auth/forgot" className={`text-[11px] font-medium transition ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500'}`}>Forgot?</a>
                </div>
                <input id="login-password" type="password" required placeholder="••••••••" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-blue-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-blue-500/60 placeholder-gray-400 text-gray-800'}`} />
              </div>
              {error && <p className={`text-[12px] ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
              <button disabled={submitting} type="submit" className={`w-full inline-flex justify-center items-center gap-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium tracking-wide text-white px-5 py-3 transition focus-visible:outline-none focus-visible:ring-2 shadow-lg ${isDark ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 focus-visible:ring-blue-300/60 shadow-blue-900/30' : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 focus-visible:ring-blue-400/50 shadow-blue-500/30'}`}>{submitting? 'Signing in...' : 'Log In'}</button>
              <p className={`text-center text-[13px] ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Don&apos;t have an account? <button type="button" onClick={()=>switchMode('signup')} className={`font-medium underline-offset-4 hover:underline transition ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500'}`}>Sign up</button></p>
            </form>

            {/* Signup Form */}
            <form
              onSubmit={async (e) => { 
                e.preventDefault();
                setSubmitting(true); setError(null);
                const fullName = (document.getElementById('signup-name') as HTMLInputElement)?.value;
                const usernameRaw = (document.getElementById('signup-username') as HTMLInputElement)?.value;
                const loc = (document.getElementById('signup-location') as HTMLInputElement)?.value;
                const signupEmail = (document.getElementById('signup-email') as HTMLInputElement)?.value;
                const phone = (document.getElementById('signup-phone') as HTMLInputElement)?.value;
                const pw = (document.getElementById('signup-password') as HTMLInputElement)?.value; 
                const cf = (document.getElementById('signup-confirm') as HTMLInputElement)?.value; 
                if (pw !== cf) { setError('Passwords do not match'); setSubmitting(false); return; }
                const username = usernameRaw.trim().toLowerCase();
                if (!/^[a-z0-9_\.]{3,24}$/.test(username)) { setError('Username must be 3-24 chars, lowercase letters, numbers, underscore or dot.'); setSubmitting(false); return; }
                try {
                  const normalizedPhone = phone.replace(/[\s\-()]/g, '');
                  const resp = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: signupEmail, password: pw, username, full_name: fullName, phone: normalizedPhone, location: loc, bin_category: binCategory }) });
                  if (!resp.ok) {
                    const j = await resp.json().catch(()=>({error:'Signup failed'}));
                    setError(j.error || 'Signup failed'); setSubmitting(false); return;
                  }
                  // Show confirmation modal and move to login
                  setConfirmEmail(signupEmail.trim().toLowerCase());
                  setConfirmOpen(true);
                  setMode('login');
                  // Fill the login email field with the signup email for convenience
                  setTimeout(() => {
                    const el = document.getElementById('login-identifier') as HTMLInputElement | null;
                    if (el) el.value = signupEmail.trim().toLowerCase();
                  }, 200);
                } catch (e:any) {
                  setError(e?.message || 'Signup error');
                } finally {
                  setSubmitting(false);
                }
              }}
              className={`transition-opacity duration-300 ${mode === 'signup' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}
              autoComplete="on"
            >
              <div className={`text-[11px] font-semibold tracking-wide mb-2 ${isDark ? 'text-white/55' : 'text-gray-500'}`}>REGISTERING AS CAREGIVER</div>
              <div className="mb-3">
                <label className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Account Type</label>
                <div className="flex gap-2 text-xs">
                  {(['private','public'] as const).map(opt => (
                    <button type="button" key={opt} onClick={()=> setBinCategory(opt)} className={`px-3 py-1.5 rounded-lg border transition ${binCategory===opt? (isDark? 'bg-white/20 border-white/40 text-white':'bg-emerald-600 border-emerald-600 text-white') : (isDark? 'bg-white/10 border-white/20 text-white/60 hover:text-white/80':'bg-white border-gray-300 text-gray-600 hover:bg-gray-50')}`}>{opt==='private'?'Private':'Public'}</button>
                  ))}
                </div>
              </div>
              <div className="grid gap-5 overflow-visible sm:max-h-[calc(100vh-22rem)] sm:overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                <div>
                  <label htmlFor="signup-name" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Full Name</label>
                  <input id="signup-name" type="text" required placeholder="John Doe" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/20 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                </div>
                <div>
                  <label htmlFor="signup-username" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Username</label>
                  <input id="signup-username" type="text" required placeholder="unique name" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/20 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                </div>
                {/* Panchayat field removed per rebrand */}
                <div>
                  <label htmlFor="signup-location" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Location</label>
                  <input id="signup-location" type="text" required placeholder="District / State" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/20 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                </div>
                <div>
                  <label htmlFor="signup-email" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Email Address</label>
                  <input id="signup-email" type="email" required placeholder="you@example.com" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/20 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                </div>
                <div>
                  <label htmlFor="signup-phone" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Phone Number</label>
                  <input id="signup-phone" type="tel" required placeholder="+1 555 123 4567" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/20 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                </div>
                <div>
                  <label htmlFor="signup-password" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Password</label>
                  <input id="signup-password" type="password" required placeholder="••••••••" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/20 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                </div>
                <div>
                  <label htmlFor="signup-confirm" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Confirm Password</label>
                  <input id="signup-confirm" type="password" required placeholder="••••••••" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/20 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                </div>
                {error && <p className={`text-[12px] ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
                <button disabled={submitting} type="submit" className={`mt-2 w-full inline-flex justify-center items-center gap-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium tracking-wide text-white px-5 py-3 transition focus-visible:outline-none focus-visible:ring-2 shadow-lg ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-300/60 shadow-emerald-900/30' : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-400/50 shadow-emerald-500/30'}`}>{submitting? 'Creating...' : 'Sign Up'}</button>
                <p className={`text-center text-[13px] mb-3 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Already have an account? <button type="button" onClick={()=>switchMode('login')} className={`font-medium underline-offset-4 hover:underline transition ${isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-600 hover:text-emerald-500'}`}>Log in</button></p>
              </div>
            </form>
          </div>

          <footer className={`mt-8 pt-6 border-t text-[11px] tracking-wide ${isDark ? 'border-white/10 text-white/45' : 'border-gray-200 text-gray-500'}`}>
            Protected by modern encryption. By continuing you agree to our terms.
          </footer>
        </section>
      </main>

      {/* Email Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className={isDark ? 'bg-neutral-900 text-white border-white/10' : ''}>
          <DialogHeader>
            <DialogTitle>Check your email</DialogTitle>
            <DialogDescription>
              We sent a verification link to <span className="font-medium">{confirmEmail}</span>. Click the link to verify your email, then log in.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <p className={isDark?'text-white/70':'text-gray-600'}>
              Didn&apos;t receive it? You can request a new link.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-3">
            <button
              type="button"
              disabled={resendBusy}
              onClick={async ()=>{
                try {
                  setResendBusy(true);
                  const resp = await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: confirmEmail }) });
                  if (!resp.ok) throw new Error('Failed to resend');
                  setNotice({ kind:'info', text: 'Verification email resent. Please check your inbox.' });
                } catch {
                  setNotice({ kind:'error', text: 'Could not resend verification email. Try again later.' });
                } finally {
                  setResendBusy(false);
                }
              }}
              className={`inline-flex justify-center items-center rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${isDark?'bg-white/10 hover:bg-white/15 border border-white/20':'bg-white hover:bg-gray-50 border border-gray-300 text-gray-800'}`}
            >
              {resendBusy ? 'Resending…' : 'Resend email'}
            </button>
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
              className={`inline-flex justify-center items-center rounded-lg px-4 py-2 text-sm font-medium ${isDark?'bg-blue-600 hover:bg-blue-500 text-white':'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
              Open Gmail
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forgot Password now uses a dedicated page (/auth/forgot) */}
    </div>
  );
}
