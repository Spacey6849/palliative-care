export interface BinData {
  id: string;
  name: string;
  label?: string; // location label / area
  location: { lat: number; lng: number };
  bin_type?: 'private' | 'public' | string | null;
  data: {
    tds: number; // used as a proxy to compute Fill % in current UI
    lastUpdated: Date;
    ph?: number;
    temperature?: number;
    waterLevel?: number;
  };
  status: 'active' | 'warning' | 'critical' | 'offline'; // active=closed, warning=open, critical=full
  history: Array<{
    timestamp: Date;
    tds: number;
    ph?: number;
    temperature?: number;
    waterLevel?: number;
  }>;
}

export function statusColor(status: BinData['status']): string {
  switch (status) {
    case 'active':
      return 'text-green-600 dark:text-green-400';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'critical':
      return 'text-red-600 dark:text-red-400';
    case 'offline':
      return 'text-gray-600 dark:text-gray-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function statusBg(status: BinData['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 dark:bg-green-900/30';
    case 'warning':
      return 'bg-yellow-100 dark:bg-yellow-900/30';
    case 'critical':
      return 'bg-red-100 dark:bg-red-900/30';
    case 'offline':
      return 'bg-gray-100 dark:bg-gray-900/30';
    default:
      return 'bg-gray-100 dark:bg-gray-900/30';
  }
}
