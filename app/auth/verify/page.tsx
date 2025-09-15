"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function VerifyPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [msg, setMsg] = useState('Verifying your email…');

  useEffect(() => {
  const token = search?.get('token');
    if (!token) {
      router.replace('/auth?mode=login&verify_error=missing');
      return;
    }
    (async () => {
      try {
        const resp = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });
        if (resp.ok) {
          router.replace('/auth?mode=login&verified=1');
        } else if (resp.status === 400) {
          const j = await resp.json().catch(() => ({ error: 'invalid' }));
          const code = j.error === 'Missing token' ? 'missing' : 'invalid';
          router.replace(`/auth?mode=login&verify_error=${code}`);
        } else {
          router.replace('/auth?mode=login&verify_error=invalid');
        }
      } catch {
        setMsg('Unable to reach server. Redirecting…');
        setTimeout(() => router.replace('/auth?mode=login&verify_error=invalid'), 600);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border p-8 text-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl">
        <div className="animate-pulse text-sm text-gray-600 dark:text-white/70">{msg}</div>
      </div>
    </main>
  );
}
