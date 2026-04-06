
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'Club Patio',
  description: 'Acumula sellos y obtén recompensas en Patio Curauma',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Club Patio',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="https://picsum.photos/seed/patio-icon/180/180" />
      </head>
      <body className="font-body antialiased selection:bg-accent selection:text-accent-foreground overflow-x-hidden h-full flex flex-col bg-white">
        
        {/* Header fijo con logo optimizado y manejo de safe area superior */}
        <header className="bg-white/95 backdrop-blur-sm shadow-sm py-3 flex justify-center w-full sticky top-0 z-50 pt-safe border-b border-slate-100">
          <img src="/Logo.png" alt="Patio" className="h-10 object-contain" />
        </header>

        <div className="flex-1 overflow-x-hidden">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
