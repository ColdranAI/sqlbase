import './global.css';
import { cn } from '@/lib/utils';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { RootProvider } from 'fumadocs-ui/provider';
import { Geist as createSans } from 'next/font/google';
import { Geist_Mono as createMono } from 'next/font/google';
import type { ReactNode } from 'react';
import { Toaster } from '../components/ui/sonner';
import { TooltipProvider } from '../components/ui/tooltip';
import { ThemeProvider } from './providers/theme';
import { Navbar } from '../components/navbar';

const sans = createSans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: 'variable',
});

const mono = createMono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: 'variable',
});

type LayoutProps = {
  readonly children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => (
  <html
    lang="en"
    className={cn(
      'touch-manipulation scroll-smooth font-sans antialiased dark',
      sans.variable,
      mono.variable
    )}
    suppressHydrationWarning
  >
    <body className="flex min-h-screen flex-col">
      <ThemeProvider>
        <Navbar />
        <RootProvider
          search={{ enabled: false }}
          theme={{
            enabled: false,
          }}
        >
          <TooltipProvider>
            <main className="flex-1">
              {children}
            </main>
          </TooltipProvider>
        </RootProvider>
        <VercelAnalytics />
      </ThemeProvider>
      <Toaster />
    </body>
  </html>
);

export default Layout;
