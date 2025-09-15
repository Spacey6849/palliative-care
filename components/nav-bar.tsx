"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useAuthOverlay } from "./auth-overlay";
import { ThemeToggle } from "./theme-toggle";
import { motion } from "framer-motion";
import { useUser } from './user-context';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Menu, X } from 'lucide-react';

type NavLink = {
  href: string; // may contain query string
  label: string;
  accent?: boolean;
  mode?: "login" | "signup"; // for auth links
};

const links: NavLink[] = [
  { href: "/maps", label: "Map" },
  // Setup handled via custom button (still kept for mapping consistency but rendered differently)
  { href: "/setup/wells", label: "Setup" },
  { href: "/auth?mode=login", label: "Login", mode: "login" },
  { href: "/auth?mode=signup", label: "Sign Up", accent: true, mode: "signup" }
];

export function NavBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMode = (searchParams?.get("mode") as "login" | "signup" | null) || "login";
  const { openLogin, openSignup } = useAuthOverlay();
  const router = useRouter();
  const { user, loading, signOut, role } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useTheme();
  const safePathname = pathname ?? '';
  const profileDarkOverride = safePathname === '/profile' && theme === 'dark';

  // Close mobile panel when path changes
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  return (
  <div className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 w-[94%] sm:w-[min(920px,86%)] z-[2000] pointer-events-none">{/* elevated above map */}
      <div className="relative group">
        {/* Glow */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-400/10 via-transparent to-emerald-400/10 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity" />
        <nav className={`pointer-events-auto relative flex items-center justify-between gap-3 sm:gap-5 rounded-2xl sm:rounded-3xl px-4 sm:px-5 h-12 backdrop-blur-2xl border transition-colors
          ${profileDarkOverride ? 'bg-neutral-900/85 supports-[backdrop-filter]:bg-neutral-900/75 border-neutral-700/70 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.80)]' : 'bg-white/95 supports-[backdrop-filter]:bg-white/80 dark:bg-neutral-900/80 supports-[backdrop-filter]:dark:bg-neutral-900/70 border-gray-200 dark:border-neutral-700/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.10)] dark:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.80)]'} `}>
          <div className="flex items-center gap-2 font-semibold tracking-tight text-[15px] select-none">
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-primary dark:via-primary/80 dark:to-primary/60 bg-clip-text text-transparent drop-shadow-sm">EcoWell AI</span>
          </div>
          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1 md:gap-2">
            {links.filter(l => !user || (l.mode !== 'login' && l.mode !== 'signup')).map(l => {
              const basePath = l.href.split("?")[0];
              let active: boolean;
              if (basePath === "/auth") {
                active = safePathname === "/auth" && (l.mode || "login") === currentMode;
              } else if (basePath === "/maps") {
                active = safePathname === "/maps";
              } else if (basePath === "/setup/wells") {
                // Mark active for /setup/wells and any future deeper sub-routes under it.
                active = safePathname === "/setup/wells" || safePathname.startsWith("/setup/wells/");
              } else {
                active = safePathname === basePath;
              }
              const base = "relative px-3 py-2 text-sm font-medium rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";
              const activeClasses = profileDarkOverride ? "text-white bg-white/10 border border-emerald-400/35 shadow-inner ring-1 ring-emerald-400/20" : "text-gray-900 dark:text-white bg-white/70 dark:bg-white/10 border border-emerald-500/40 dark:border-emerald-400/35 shadow-inner ring-1 ring-emerald-500/15 dark:ring-emerald-400/20";
              const normal = l.accent
                ? "text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700"
                : profileDarkOverride ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5";
              // Custom rendering for Setup to ensure navigation always works even if link default prevented.
              if (l.href === '/setup/wells') {
                return (
                  <button
                    key={l.href + l.label}
                    type="button"
                    title="Go to setup"
                    className={`${base} ${active ? activeClasses : normal}`}
                    onClick={(e) => {
                      console.log('Setup button clicked!', { pathname: safePathname, target: '/setup/wells' });
                      try {
                        e.stopPropagation();
                        if (safePathname !== '/setup/wells') {
                          console.log('Navigating to /setup/wells');
                          router.push('/setup/wells');
                        } else {
                          console.log('Already on /setup/wells, refreshing');
                          router.refresh();
                        }
                      } catch (error) {
                        console.error('Navigation error:', error);
                        // Fallback to window location
                        window.location.href = '/setup/wells';
                      }
                    }}
                  >
                    {l.label}
                    {active && (
                      <motion.span layoutId="nav-underline" className="absolute left-3 right-3 -bottom-0.5 h-[3px] rounded-full bg-primary/90" />
                    )}
                  </button>
                );
              }
              return (
                <Link
                  key={l.href + l.label}
                  href={l.href}
                  className={`${base} ${active ? activeClasses : normal}`}
                  prefetch={false}
                  onClick={(e) => {
                    if (l.mode === 'login') { e.preventDefault(); openLogin(); return; }
                    if (l.mode === 'signup') { e.preventDefault(); openSignup(); return; }
                  }}
                >
                  {l.label}
                  {active && !l.accent && (
                    <motion.span layoutId="nav-underline" className="absolute left-3 right-3 -bottom-0.5 h-[3px] rounded-full bg-primary/90" />
                  )}
                </Link>
              );
            })}
            <div className="ml-2 hidden sm:block"><ThemeToggle /></div>
            {/* User menu */}
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" aria-label="Loading user" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`ml-2 flex items-center gap-2 pl-2 pr-3 h-8 rounded-full border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${profileDarkOverride ? 'bg-white/10 hover:bg-white/15 border-white/15 text-gray-300 hover:text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border-black/10 dark:border-white/15 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-[11px] font-semibold text-white shadow-inner">
                      {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                    <span className="max-w-[110px] truncate font-medium">{user.username || user.email}</span>
                    {role && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border backdrop-blur-sm ${role==='admin'?'border-red-400/60 text-red-300 bg-red-500/15 dark:bg-red-500/20':'border-emerald-400/60 text-emerald-300 bg-emerald-500/15 dark:bg-emerald-500/20'}`}>{role}</span>}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Signed in as<br /><span className="font-medium text-foreground text-[11px]">{user.username}</span><br /><span className="text-[10px] text-muted-foreground/80">{user.email}</span></div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push('/profile')} className="cursor-pointer">Profile</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={async () => { await signOut(); router.push('/login'); }} className="cursor-pointer text-red-600 focus:text-red-600">Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {/* Removed extra standalone Login button (link handles auth overlay) */}
          </div>
          {/* Right: theme + signup + mobile menu toggle */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 pl-2 pr-3 h-9 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 text-gray-700 dark:text-gray-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-[11px] font-semibold text-white shadow-inner">
                      {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                    <span className="max-w-[90px] truncate font-medium">{user.username || user.email}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Signed in as<br /><span className="font-medium text-foreground text-[11px]">{user.username}</span><br /><span className="text-[10px] text-muted-foreground/80">{user.email}</span></div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push('/profile')} className="cursor-pointer">Profile</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={async () => { await signOut(); router.push('/login'); }} className="cursor-pointer text-red-600 focus:text-red-600">Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!user && (
              <Link href="/auth?mode=signup" prefetch={false} onClick={(e)=>{e.preventDefault(); openSignup();}} className="inline-flex items-center justify-center h-9 px-3 rounded-xl text-sm font-medium bg-blue-600 text-white shadow hover:bg-blue-500 active:bg-blue-700">Sign Up</Link>
            )}
            <button
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={()=> setMobileOpen(o=>!o)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 transition"
            >{mobileOpen ? <X className="w-5 h-5 text-gray-700 dark:text-gray-200" /> : <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />}</button>
          </div>
          {/* Mobile dropdown panel */}
          <motion.div
            initial={false}
            animate={mobileOpen ? { opacity: 1, y: 0, pointerEvents: 'auto' } : { opacity: 0, y: -6, pointerEvents: 'none' }}
            transition={{ duration: 0.18, ease: [0.16,1,0.3,1] }}
            className={`md:hidden absolute top-full left-0 right-0 mt-2 origin-top rounded-2xl border backdrop-blur-2xl shadow-lg p-3 flex flex-col gap-1 ${profileDarkOverride ? 'border-neutral-700/70 bg-neutral-900/95' : 'border-gray-200/70 dark:border-neutral-700/70 bg-white/95 dark:bg-neutral-900/90'}`}
          >
            {links.map(l => {
              const basePath = l.href.split('?')[0];
              let active: boolean;
              if (basePath === '/auth') {
                active = safePathname === '/auth' && (l.mode || 'login') === currentMode;
              } else if (basePath === '/maps') {
                active = safePathname === '/maps';
              } else if (basePath === '/setup/wells') {
                active = safePathname === '/setup/wells' || safePathname.startsWith('/setup/wells/');
              } else { active = safePathname === basePath; }
              if (l.mode === 'signup') return null; // signup handled separately
              if (user && l.mode === 'login') return null; // hide login if authenticated
              if (!user && (l.mode === 'login')) {
                return (
                  <button
                    key={l.href}
                    onClick={(e)=> { e.preventDefault(); openLogin(); }}
                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${active ? (profileDarkOverride ? 'bg-white/10 text-white' : 'bg-primary/10 text-gray-900 dark:text-white') : (profileDarkOverride ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10')}`}
                  >Login</button>
                );
              }
              if (l.href === '/setup/wells') {
                return (
                  <button
                    key={l.href}
                    onClick={()=> { router.push('/setup/wells'); }}
                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${active ? (profileDarkOverride ? 'bg-white/10 text-white' : 'bg-primary/10 text-gray-900 dark:text-white') : (profileDarkOverride ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10')}`}
                  >Setup</button>
                );
              }
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch={false}
                  onClick={(e)=> {
                    if (l.mode === 'login') { e.preventDefault(); openLogin(); }
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${active ? (profileDarkOverride ? 'bg-white/10 text-white' : 'bg-primary/10 text-gray-900 dark:text-white') : (profileDarkOverride ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10')}`}
                >{l.label}</Link>
              );
            })}
            {user && (
              <button
                onClick={async ()=> { await signOut(); router.push('/login'); }}
                className="mt-1 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-600/10"
              >Sign Out</button>
            )}
          </motion.div>
        </nav>
      </div>
    </div>
  );
}
