"use client";
import { useEffect } from 'react';
import { useAuthOverlay } from '@/components/auth-overlay';
import { useUser } from '@/components/user-context';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { openLogin } = useAuthOverlay();
  const { user, loading } = useUser();
  const router = useRouter();
  useEffect(() => { if (!loading && user) router.replace('/maps'); }, [loading, user, router]);
  useEffect(() => { openLogin(); }, [openLogin]);
  return (
    <div className="w-full h-[60vh] flex items-center justify-center text-sm text-muted-foreground">
      Opening login...
    </div>
  );
}
