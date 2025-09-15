'use client';

import { Card, CardContent } from '@/components/ui/card';
import { motion, useAnimation } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  icon: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}

export function MetricCard({ label, value, unit, status, icon, onClick, isActive }: MetricCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
  // Subtle tinted surface – keep solid enough in dark mode for contrast
  return 'border-emerald-300/60 dark:border-emerald-400/35 bg-emerald-500/10 dark:bg-emerald-400/10';
      case 'warning':
  return 'border-amber-300/60 dark:border-amber-400/35 bg-amber-500/15 dark:bg-amber-400/10';
      case 'critical':
  return 'border-red-300/60 dark:border-red-400/35 bg-red-500/15 dark:bg-red-400/10';
      default:
  return 'border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/60';
    }
  };

  const getTextColor = (status: string) => {
    switch (status) {
      case 'good':
  return 'text-emerald-700 dark:text-emerald-300';
      case 'warning':
  return 'text-amber-700 dark:text-amber-300';
      case 'critical':
  return 'text-red-700 dark:text-red-300';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  const words = label.toUpperCase().split(/\s+/);
  const stacked = words.length <= 2 && words.join('').length <= 10; // heuristic for compact stacking

  // Animated value (simple count-up when numeric changes)
  const numeric = parseFloat(value.replace(/[^0-9.\-]/g, ''));
  const isNumeric = !Number.isNaN(numeric);
  const prevRef = useRef<number | null>(null);
  const [displayValue, setDisplayValue] = useState<string>(value);
  const controls = useAnimation();

  useEffect(() => {
    if (isNumeric) {
      const start = prevRef.current ?? numeric;
      const end = numeric;
      prevRef.current = end;
      if (start === end) {
        setDisplayValue(value);
        return;
      }
      const duration = 0.8;
      const startTime = performance.now();
      let frame: number;
      const step = (t: number) => {
        const progress = Math.min(1, (t - startTime) / (duration * 1000));
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = start + (end - start) * eased;
        const decimals = value.includes('.') ? Math.min(2, value.split('.')[1].length) : 0;
        setDisplayValue(current.toFixed(decimals));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      return () => cancelAnimationFrame(frame);
    } else {
      setDisplayValue(value);
    }
  }, [value, isNumeric, numeric]);

  // Pulse/icon animation on update
  useEffect(() => {
    controls.start({ scale: [1, 1.15, 1], rotate: [0, -6, 0] }, { duration: 0.6 });
  }, [value, controls]);

  return (
    <motion.div
      whileHover={{ scale: onClick ? 1.02 : 1.01, translateY: onClick ? -3 : -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      tabIndex={0}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? !!isActive : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
            onClick();
        }
      }}
      onClick={onClick}
      className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400/60 rounded-xl ${onClick ? 'cursor-pointer select-none' : ''}`}
    >
      <Card
        className={`group h-28 sm:h-28 ${getStatusColor(status)} border transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden ${isActive ? 'ring-2 ring-emerald-400/60 ring-offset-2' : ''}`}
      >
        {/* animated border glow */}
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-0 group-hover:ring-1 ring-offset-0 ring-white/30 dark:ring-white/5 transition" />
        <CardContent className="relative z-10 p-3 sm:p-3 flex h-full">
          <div className="flex flex-col justify-between w-full">
            <div className="flex items-start space-x-2.5">
              <motion.div
                animate={controls}
                className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-inner ${getTextColor(status)}`}
              >
                {icon}
              </motion.div>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-[10px] font-semibold tracking-wide text-gray-600 dark:text-gray-400 leading-tight ${
                    stacked ? 'flex flex-col' : 'truncate'
                  }`}
                >
                  {stacked ? (
                    words.map(w => <span key={w}>{w}</span>)
                  ) : (
                    <span>{label.toUpperCase()}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="pl-10 -mt-1">
              <p className={`text-xl sm:text-[22px] font-bold leading-none tracking-tight ${getTextColor(status)} select-none`}>                
                <motion.span
                  key={displayValue}
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  {displayValue}
                </motion.span>
                {unit && (
                  <span className="ml-1 text-xs font-medium align-top opacity-80">
                    {unit}
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}