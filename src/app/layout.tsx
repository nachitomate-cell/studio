import type {Metadata, Viewport} from 'next';
import Link from 'next/link';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { NotificationSystem } from "@/components/NotificationSystem";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { Providers } from "@/components/Providers";
import { OfflineBanner } from "@/components/OfflineBanner";

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Club Patio',
  description: 'Acumula sellos y obtén recompensas en Patio Curauma',
  icons: {
    icon: '/Logo2.png',
    apple: '/Logo2.png',
  },
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
    <html lang="es" className={`h-full ${montserrat.variable}`}>
      <head>
        {/* Redirige /emprendedor/* al home cuando la PWA restaura esa URL (iOS).
            dangerouslySetInnerHTML es seguro aquí: el contenido es estático. */}
        <script dangerouslySetInnerHTML={{__html:`(function(){if(window.location.pathname.startsWith('/emprendedor/')&&!document.referrer){window.location.replace('/');}})();`}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
      </head>
      <body className="font-body antialiased selection:bg-accent selection:text-accent-foreground overflow-x-hidden h-full flex flex-col bg-white">
        <SplashScreen />
        
        {/* Header fijo con logo optimizado y manejo de safe area superior */}
        <header className="bg-white/95 backdrop-blur-sm shadow-sm py-3 flex flex-col items-center justify-center w-full sticky top-0 z-50 pt-safe border-b border-slate-100">
          <Link
            href="/"
            className="flex flex-col items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
          >
            <img src="/Logo2.png" alt="Patio" className="h-10 object-contain" />
            <span style={{ fontSize: "10px", letterSpacing: "2px", color: "#666", fontWeight: 600, marginTop: "2px" }}>PATIO CURAUMA</span>
          </Link>
        </header>

        <Providers>
          <div className="flex-1 overflow-x-hidden">
            {children}
          </div>
        </Providers>
        
        {/* Sistema Global de Notificaciones de Sistema */}
        <NotificationSystem />
        
        {/* Oyente global de errores de Firebase */}
        <FirebaseErrorListener />

        <OfflineBanner />
        
        {/* Simulador de Roles flotante — solo en desarrollo */}
        {process.env.NODE_ENV === "development" && <RoleSwitcher />}
        
        <Toaster />
      </body>
    </html>
  );
}
