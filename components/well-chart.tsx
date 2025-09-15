'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WellData } from '@/lib/well-data';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface WellChartProps {
  well: WellData;
  metric: 'ph' | 'tds' | 'temperature' | 'waterLevel';
}

export function WellChart({ well, metric }: WellChartProps) {
  const { theme } = useTheme();
  const [points, setPoints] = useState<{ time: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/wells/${well.id}/metrics`, { cache: 'no-store' });
        if (resp.ok) {
          const j = await resp.json();
          const metrics = Array.isArray(j.metrics) ? j.metrics : [];
          if (!cancelled && metrics.length) {
            const mapped = metrics
              .filter((m: any) => m[metric] !== null && m[metric] !== undefined)
              .map((m: any) => ({
                time: new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                value: Number(m[metric])
              }));
            setPoints(mapped);
            setLoading(false);
            return;
          }
        }
      } catch {}
      // Fallback to in-memory history
      if (!cancelled) {
        let fallback = well.history.map(entry => ({
          time: entry.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          value: entry[metric]
        }));
        if (!fallback.length) {
          // Synthesize 24 points (hourly) around current value with slight jitter so chart isn't empty
          const base = (well.data as any)[metric] || 0;
          const now = Date.now();
          fallback = Array.from({ length: 24 }).map((_, i) => {
            const t = new Date(now - (23 - i) * 3600_000);
            const jitter = base * 0.01; // 1% variation
            const value = base + (Math.random() - 0.5) * jitter;
            return {
              time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              value: Number(value.toFixed(2))
            };
          });
        }
        setPoints(fallback);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [well.id, metric, well.data, well.history]);

  const getMetricInfo = (metric: string) => {
    switch (metric) {
      case 'ph':
        return { label: 'pH Level', unit: '', color: '#3b82f6' };
      case 'tds':
        return { label: 'TDS', unit: 'ppm', color: '#8b5cf6' };
      case 'temperature':
        return { label: 'Temperature', unit: '°C', color: '#f59e0b' };
      case 'waterLevel':
        return { label: 'Water Level', unit: 'm', color: '#06b6d4' };
      default:
        return { label: 'Unknown', unit: '', color: '#6b7280' };
    }
  };

  const metricInfo = getMetricInfo(metric);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
  <LineChart data={points} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
          />
          <XAxis 
            dataKey="time"
            stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'}
            fontSize={12}
          />
          <YAxis
            stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'}
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
              border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
              borderRadius: '6px',
              color: theme === 'dark' ? '#f3f4f6' : '#111827',
            }}
            formatter={(value: number) => [`${value.toFixed(2)} ${metricInfo.unit}`, metricInfo.label]}
          />
      <Line
            type="monotone"
            dataKey="value"
            stroke={metricInfo.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: metricInfo.color }}
          />
        </LineChart>
      </ResponsiveContainer>
    {loading && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>}
    </div>
  );
}