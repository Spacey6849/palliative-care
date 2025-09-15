import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { NavBar } from '@/components/nav-bar';
import { AuthOverlayProvider } from '@/components/auth-overlay';
import { UserProvider } from '@/components/user-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EcoWell AI – Well Monitoring Dashboard',
  description: 'EcoWell AI: real-time groundwater & well monitoring with interactive mapping',
  icons: {
    icon: '/favicon.ico'
  },
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
              <main id="app" className="relative z-0 min-h-screen">{children}</main>
              <div id="portal-root" className="relative" />
            </AuthOverlayProvider>
          </UserProvider>
        </ThemeProvider>
        <noscript>
          <div style={{padding:'1rem',textAlign:'center',fontSize:'0.85rem'}}>EcoWell AI requires JavaScript for interactive maps and theming.</div>
        </noscript>
      </body>
    </html>
  );
}