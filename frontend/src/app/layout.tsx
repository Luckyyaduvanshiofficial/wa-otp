import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/components/themes/font.config';
import { DEFAULT_THEME } from '@/components/themes/theme.config';
import ThemeProvider from '@/components/themes/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '../styles/globals.css';

/*
 * Browser chrome colour (mobile address bar, PWA status bar). Not per-theme —
 * it tracks the default theme, so it is set to Lumen's paper in each register:
 * `oklch(96.5% 0.01 85)` for Daylight, `oklch(13% 0.014 265)` for Night.
 * These are the sRGB conversions of those tokens; if you retune Lumen's paper,
 * recompute them rather than leaving a cool white bar on a near-black page.
 */
const META_THEME_COLORS = {
  light: '#F7F3EC',
  dark: '#05070D'
};

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL) }
    : {}),
  title: {
    default: 'WA OTP — WhatsApp OTP gateway for Indian mini apps',
    template: '%s | WA OTP'
  },
  description:
    'Add phone OTP to your app with two API calls. 500 free WhatsApp OTPs every month, Telegram free forever. India-first, developer-first.'
};

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning data-theme={DEFAULT_THEME} className='overflow-x-clip'>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const match = document.cookie.match(/(^|;\\s*)active_theme=([^;]+)/);
                if (match) {
                  const theme = decodeURIComponent(match[2]);
                  document.documentElement.setAttribute('data-theme', theme);
                }
                // Set meta theme color
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body
        className={cn(
          /*
           * `clip`, not `hidden`. `hidden` makes the box a scroll container,
           * which silently breaks position: sticky/fixed on every descendant
           * (the floating nav pill among them). `clip` clips the paint and
           * leaves the scroll machinery alone.
           */
          'bg-background overflow-x-clip overscroll-none font-sans antialiased',
          fontVariables
        )}
      >
        <NextTopLoader color='var(--primary)' showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers activeThemeValue={DEFAULT_THEME}>
              <Toaster />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
