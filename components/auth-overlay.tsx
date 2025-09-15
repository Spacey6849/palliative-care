"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from './user-context';

type Mode = "login" | "signup";

interface AuthOverlayContextValue {
  openLogin: () => void;
  openSignup: () => void;
  close: () => void;
}

const AuthOverlayContext = createContext<AuthOverlayContextValue | null>(null);

export function useAuthOverlay() {
  const ctx = useContext(AuthOverlayContext);
  if (!ctx) throw new Error("useAuthOverlay must be used within AuthOverlayProvider");
  return ctx;
}

export function AuthOverlayProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [roleChoice, setRoleChoice] = useState<'admin' | 'panchayat'>('panchayat');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Supabase removed; using custom REST endpoints
  const { refresh } = useUser();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const openLogin = useCallback(() => { setMode("login"); setOpen(true); }, []);
  const openSignup = useCallback(() => { setMode("signup"); setRoleChoice('panchayat'); setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);

  // ESC key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  return (
    <AuthOverlayContext.Provider value={{ openLogin, openSignup, close }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.button
              aria-label="Close authentication"
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
            {/* Card */}
            <motion.div
              layout
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 25, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className={`relative w-full ${mode==='signup' ? 'max-w-2xl' : 'max-w-md'} rounded-3xl backdrop-blur-2xl shadow-[0_8px_42px_-6px_rgba(0,0,0,0.55)] px-7 py-8 sm:px-10 sm:py-10 border ${isDark ? 'border-white/20 bg-white/12 text-white' : 'border-gray-200 bg-white/85 text-gray-800'} `}
              role="dialog"
              aria-modal="true"
              aria-label={mode === 'login' ? 'Login form' : 'Signup form'}
            >
              <div className="absolute top-3 right-3">
                <button onClick={close} className={`rounded-full w-8 h-8 flex items-center justify-center transition ${isDark ? 'bg-white/15 hover:bg-white/25 text-white/80 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`} aria-label="Close">✕</button>
              </div>
              <header className="mb-8 text-center">
                <h1 className={`text-3xl font-bold tracking-tight ${isDark ? '' : 'text-gray-900'}`}>{mode === 'login' ? 'Welcome Back!' : 'Create Account'}</h1>
                <p className={`mt-2 text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>{mode === 'login' ? 'Sign in to continue your journey.' : 'Join us and explore the world.'}</p>
              </header>
              <div className="relative min-h-[320px]">
                {/* Login */}
                <form
                  onSubmit={async (e) => { 
                    e.preventDefault();
                    setSubmitting(true); setError(null);
                    // Identifier can be email or username (for panchayat users). For admin it can be 'admin' or admin email.
                    let identifier = (document.getElementById('ov-login-email') as HTMLInputElement)?.value.trim();
                    // Normalize: usernames are stored lowercase; treat email case-insensitively
                    if (identifier) identifier = identifier.toLowerCase();
                    const password = (document.getElementById('ov-login-password') as HTMLInputElement)?.value;
                    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';
                    try {
                      if (roleChoice === 'admin') {
                        if (identifier === 'admin' || identifier === ADMIN_EMAIL) {
                          const resp = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: identifier, password }) });
                          if (!resp.ok) {
                            const j = await resp.json().catch(()=>({error:'Invalid admin credentials'}));
                            setError(j.error || 'Admin auth failed'); setSubmitting(false); return;
                          }
                          try { localStorage.setItem('ecw_admin','1'); } catch {}
                          await refresh(); close(); setSubmitting(false); return;
                        } else {
                          setError('Invalid admin identifier.'); setSubmitting(false); return;
                        }
                      }
                      // Panchayat login
                      const resp = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) });
                      if (!resp.ok) {
                        const j = await resp.json().catch(()=>({error:'Login failed'}));
                        setError(j.error || 'Login failed'); setSubmitting(false); return;
                      }
                      await refresh(); close(); setSubmitting(false);
                    } catch (e:any) {
                      setError(e?.message || 'Login error'); setSubmitting(false); return;
                    }
                  }}
                  className={`space-y-5 transition-opacity duration-300 ${mode === 'login' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}
                  autoComplete="on"
                >
                  <div>
                    <label className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Login As</label>
                    <div className="flex gap-3 text-xs">
                      {(['panchayat','admin'] as const).map(r => (
                        <button type="button" key={r} onClick={()=> setRoleChoice(r)} className={`px-3 py-1.5 rounded-lg border transition ${roleChoice===r? (isDark? 'bg-white/20 border-white/40 text-white':'bg-blue-600 border-blue-600 text-white') : (isDark? 'bg-white/10 border-white/20 text-white/60 hover:text-white/80':'bg-white border-gray-300 text-gray-600 hover:bg-gray-50')}`}>{r === 'panchayat' ? 'Panchayat' : 'Admin'}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="ov-login-email" className={`block text-[13px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Email or Username</label>
                    <input id="ov-login-email" type="text" required placeholder="email or username" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-blue-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-blue-500/60 placeholder-gray-400 text-gray-800'}`} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="ov-login-password" className={`block text-[13px] font-medium ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Password</label>
                      <a href="/auth/forgot" className={`text-[11px] font-medium transition ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500'}`}>Forgot?</a>
                    </div>
                    <input id="ov-login-password" type="password" required placeholder="••••••••" className={`block w-full rounded-xl focus:ring-0 text-sm px-4 py-3 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-blue-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-blue-500/60 placeholder-gray-400 text-gray-800'}`} />
                  </div>
                  {error && <p className={`text-[12px] ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
                  <button disabled={submitting} type="submit" className={`w-full inline-flex justify-center items-center gap-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 text-sm font-medium tracking-wide shadow-lg px-5 py-3 transition ${isDark ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 focus-visible:ring-blue-300/60 text-white shadow-blue-900/30' : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 focus-visible:ring-blue-400/50 text-white shadow-blue-500/30'}`}>{submitting? 'Signing in...' : 'Log In'}</button>
                  <p className={`text-center text-[13px] ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Don&apos;t have an account? <button type="button" onClick={() => setMode('signup')} className={`font-medium underline-offset-4 hover:underline transition ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500'}`}>Sign up</button></p>
                </form>
                {/* Signup */}
                <form
                  onSubmit={async (e) => { 
                    e.preventDefault();
                    setSubmitting(true); setError(null);
                    const fullName = (document.getElementById('ov-signup-name') as HTMLInputElement)?.value;
                    const usernameRaw = (document.getElementById('ov-signup-username') as HTMLInputElement)?.value;
                    const panchayatName = (document.getElementById('ov-signup-panchayat') as HTMLInputElement)?.value;
                    const location = (document.getElementById('ov-signup-location') as HTMLInputElement)?.value;
                    const signupEmail = (document.getElementById('ov-signup-email') as HTMLInputElement)?.value;
                    const phone = (document.getElementById('ov-signup-phone') as HTMLInputElement)?.value;
                    const pw = (document.getElementById('ov-signup-password') as HTMLInputElement)?.value; 
                    const cf = (document.getElementById('ov-signup-confirm') as HTMLInputElement)?.value; 
                    if (pw !== cf) { setError('Passwords do not match'); setSubmitting(false); return; }
                    // Force signup role to panchayat (no admin self-registration)
                    if (roleChoice === 'admin') { setError('Admin registration disabled.'); setSubmitting(false); return; }
                    // Basic phone normalization (remove spaces, dashes, parentheses)
                    const username = usernameRaw.trim().toLowerCase();
                    if (!/^[a-z0-9_\.]{3,24}$/.test(username)) { setError('Username must be 3-24 chars, lowercase letters, numbers, underscore or dot.'); setSubmitting(false); return; }
                    try {
                      const normalizedPhone = phone.replace(/[\s\-()]/g, '');
                      const resp = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: signupEmail, password: pw, username, full_name: fullName, phone: normalizedPhone, panchayat_name: panchayatName, location }) });
                      if (!resp.ok) {
                        const j = await resp.json().catch(()=>({error:'Signup failed'}));
                        setError(j.error || 'Signup failed'); setSubmitting(false); return;
                      }
                      setMode('login');
                    } catch (e:any) {
                      setError(e?.message || 'Signup error');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className={`space-y-5 transition-opacity duration-300 ${mode === 'signup' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}
                  autoComplete="on"
                >
          <div className={`text-[11px] uppercase tracking-wide ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Registering as Panchayat</div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-1">
            <label htmlFor="ov-signup-name" className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Full Name</label>
            <input id="ov-signup-name" type="text" required placeholder="John Doe" className={`block w-full rounded-lg focus:ring-0 text-sm px-3 py-2.5 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                    </div>
                    <div className="sm:col-span-1">
            <label htmlFor="ov-signup-username" className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Username</label>
            <input id="ov-signup-username" type="text" required placeholder="unique name" className={`block w-full rounded-lg focus:ring-0 text-sm px-3 py-2.5 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                    </div>
                    <div className="sm:col-span-1">
            <label htmlFor="ov-signup-panchayat" className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Panchayat Name</label>
            <input id="ov-signup-panchayat" type="text" required placeholder="Greenfield Panchayat" className={`block w-full rounded-lg focus:ring-0 text-sm px-3 py-2.5 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                    </div>
                    <div className="sm:col-span-2">
            <label htmlFor="ov-signup-location" className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Location</label>
            <input id="ov-signup-location" type="text" required placeholder="District / State" className={`block w-full rounded-lg focus:ring-0 text-sm px-3 py-2.5 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                    </div>
                    <div className="sm:col-span-1">
            <label htmlFor="ov-signup-email" className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Email Address</label>
            <input id="ov-signup-email" type="email" required placeholder="you@example.com" className={`block w-full rounded-lg focus:ring-0 text-sm px-3 py-2.5 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                    </div>
                    <div className="sm:col-span-1">
            <label htmlFor="ov-signup-phone" className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Phone Number</label>
            <input id="ov-signup-phone" type="tel" required placeholder="+1 555 123 4567" className={`block w-full rounded-lg focus:ring-0 text-sm px-3 py-2.5 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                    </div>
                    <div className="sm:col-span-1">
            <label htmlFor="ov-signup-password" className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Password</label>
            <input id="ov-signup-password" type="password" required placeholder="••••••••" className={`block w-full rounded-lg focus:ring-0 text-sm px-3 py-2.5 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                    </div>
                    <div className="sm:col-span-1">
            <label htmlFor="ov-signup-confirm" className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-white/75' : 'text-gray-600'}`}>Confirm Password</label>
            <input id="ov-signup-confirm" type="password" required placeholder="••••••••" className={`block w-full rounded-lg focus:ring-0 text-sm px-3 py-2.5 outline-none transition ${isDark ? 'bg-white/10 border border-white/25 focus:border-emerald-400/70 placeholder-white/40' : 'bg-white border border-gray-300 focus:border-emerald-500/60 placeholder-gray-400 text-gray-800'}`} />
                    </div>
                  </div>
          {error && <p className={`text-[12px] ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
          <button disabled={submitting} type="submit" className={`w-full inline-flex justify-center items-center gap-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 text-sm font-medium tracking-wide text-white shadow-lg px-5 py-3 transition ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-300/60 shadow-emerald-900/30' : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-400/50 shadow-emerald-500/30'}`}>{submitting? 'Creating...' : 'Sign Up'}</button>
          <p className={`text-center text-[13px] ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Already have an account? <button type="button" onClick={() => setMode('login')} className={`font-medium underline-offset-4 hover:underline transition ${isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-600 hover:text-emerald-500'}`}>Log in</button></p>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthOverlayContext.Provider>
  );
}
