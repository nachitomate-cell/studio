import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { NotificationSystem } from "@/components/NotificationSystem";
import { SplashScreen } from "@/components/ui/SplashScreen";

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
  themeColor: '#D3B673',
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
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
      </head>
      <body className="font-body antialiased selection:bg-accent selection:text-accent-foreground overflow-x-hidden h-full flex flex-col bg-white">
        <SplashScreen />
        
        {/* Header fijo con logo optimizado y manejo de safe area superior */}
        <header className="bg-white/95 backdrop-blur-sm shadow-sm py-3 flex justify-center w-full sticky top-0 z-50 pt-safe border-b border-slate-100">
          <img src="/Logo.png" alt="Patio" className="h-10 object-contain" />
        </header>

        <div className="flex-1 overflow-x-hidden">
          {children}
        </div>
        
        {/* Sistema Global de Notificaciones de Sistema */}
        <NotificationSystem />
        
        {/* Oyente global de errores de Firebase */}
        <FirebaseErrorListener />
        
        {/* Simulador de Roles flotante — solo en desarrollo */}
        {process.env.NODE_ENV === "development" && <RoleSwitcher />}
        
        <Toaster />
      </body>
    </html>
  );
}
