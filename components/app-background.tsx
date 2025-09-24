"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import LiquidEther from '@/components/LiquidEther';

export default function AppBackground() {
  const pathname = usePathname();
  const show = pathname === '/home';
  if (!show) return null;
  return (
    <LiquidEther
      // place the canvas behind all content and increase opacity for visibility
      className="fixed inset-0 -z-10 opacity-90"
      mouseForce={48}
      cursorSize={70}
      isViscous
      viscous={28}
      iterationsViscous={24}
      iterationsPoisson={32}
      dt={0.016}
      BFECC
      resolution={0.6}
      autoDemo
      autoSpeed={0.6}
      autoIntensity={1.8}
      listenOnDocument
    />
  );
}
