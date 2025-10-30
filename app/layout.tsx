import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { NavBar } from '@/components/nav-bar';
import { AuthOverlayProvider } from '@/components/auth-overlay';
import { UserProvider } from '@/components/user-context';
import { Toaster } from '@/components/ui/toaster';
import AppBackground from '@/components/app-background';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Palliative Care – Remote Patient Monitoring',
  description: 'Real-time palliative care monitoring with vitals, alerts, and interactive mapping',
  viewport: 'width=device-width,initial-scale=1,maximum-scale=1'
};

// Runtime and rendering controls to avoid static prerender issues
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased relative overflow-x-hidden`}>        
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <UserProvider>
            <AuthOverlayProvider>
              <NavBar />
          {/* Global decorative background for selected routes */}
          <AppBackground />
                <main id="app" className="relative z-10 min-h-screen">{children}</main>
              <div id="portal-root" className="relative" />
              <Toaster />
            </AuthOverlayProvider>
          </UserProvider>
        </ThemeProvider>
        <noscript>
          <div style={{padding:'1rem',textAlign:'center',fontSize:'0.85rem'}}>Palliative Care app requires JavaScript for interactive maps and theming.</div>
        </noscript>
      </body>
    </html>
  );
}