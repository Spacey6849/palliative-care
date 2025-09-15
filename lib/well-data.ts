export interface WellData {
  id: string;
  name: string;
  // Added: village name for more granular location identification
  village?: string;
  // Panchayat name (from user_wells.panchayat_name)
  panchayatName?: string;
  // Contact number of well owner (users.phone)
  contactNumber?: string;
  location: { lat: number; lng: number };
  data: {
    ph: number;
    tds: number; // Total Dissolved Solids (ppm)
    temperature: number; // Celsius
    waterLevel: number; // meters
    lastUpdated: Date;
  };
  status: 'active' | 'warning' | 'critical' | 'offline';
  history: Array<{
    timestamp: Date;
    ph: number;
    tds: number;
    temperature: number;
    waterLevel: number;
  }>;
}

// Generate 24h of hourly history values around base ranges
export function generateHistory(): WellData['history'] {
  const history: WellData['history'] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    history.push({
      timestamp,
      ph: 7 + (Math.random() * 0.6 - 0.3),
      tds: 340 + (Math.random() * 40 - 20),
      temperature: 26 + (Math.random() * 1.2 - 0.6),
      waterLevel: 42 + (Math.random() * 2 - 1),
    });
  }
  return history;
}

// Only Merces Well retained per user request
export const mockWellData: WellData[] = [
  {
    id: 'well-005',
    name: 'Merces Well',
    location: { lat: 15.488527857031876, lng: 73.85236385002361 },
    data: {
      ph: 7.4,
      tds: 360,
      temperature: 26.2,
      waterLevel: 42.5,
      lastUpdated: new Date(),
    },
    status: 'active',
    history: generateHistory(),
  },
  // Additional nearby demo wells (Merces area)
  {
    id: 'well-006',
    name: 'Merces East Well',
    location: { lat: 15.48915, lng: 73.8552 },
    data: {
      ph: 7.2,
      tds: 350,
      temperature: 26.0,
      waterLevel: 41.8,
      lastUpdated: new Date(),
    },
    status: 'active',
    history: generateHistory(),
  },
  {
    id: 'well-007',
    name: 'Merces South Well',
    location: { lat: 15.4869, lng: 73.85295 },
    data: {
      ph: 6.8,
      tds: 420,
      temperature: 26.4,
      waterLevel: 39.9,
      lastUpdated: new Date(),
    },
    status: 'warning',
    history: generateHistory(),
  },
  {
    id: 'well-008',
    name: 'Merces West Well',
    location: { lat: 15.48805, lng: 73.8499 },
    data: {
      ph: 8.7,
      tds: 540,
      temperature: 27.1,
      waterLevel: 37.4,
      lastUpdated: new Date(),
    },
    status: 'critical',
    history: generateHistory(),
  },
  {
    id: 'well-009',
    name: 'Merces North Well',
    location: { lat: 15.4911, lng: 73.8514 },
    data: {
      ph: 7.5,
      tds: 365,
      temperature: 26.3,
      waterLevel: 43.2,
      lastUpdated: new Date(),
    },
    status: 'active',
    history: generateHistory(),
  },
];

export function getWellStatusColor(status: WellData['status']): string {
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

export function getWellStatusBg(status: WellData['status']): string {
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