import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SwRegister } from '@/components/layout/SwRegister';
import { fetchBrandSettings } from '@/src/lib/supabase/brand-actions';
import { brand as staticBrand } from '@/src/lib/config/brand';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await fetchBrandSettings();
  const orgName    = brand?.org_name    ?? staticBrand.agency_name;
  const faviconUrl = brand?.favicon_url ?? '/icons/icon-192.svg';

  return {
    title: `${orgName} — Dashboard`,
    description: 'Dashboard interno de seguimiento de proyectos',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: orgName,
    },
    icons: {
      icon: faviconUrl,
      apple: faviconUrl,
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
