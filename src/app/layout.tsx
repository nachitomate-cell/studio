import type {Metadata, Viewport} from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { NotificationSystem } from "@/components/NotificationSystem";
import { Providers } from "@/components/Providers";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SwUpdateReloader } from "@/components/SwUpdateReloader";
import { HeaderGlobal } from "@/components/HeaderGlobal";

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
        {/* Ambiente de pruebas: el servidor expone el flag al cliente en runtime.
            Se ejecuta ANTES que el bundle, así firebase.ts ya lo ve al inicializar.
            En producción la variable no existe → false → nunca usa emuladores. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__USE_EMULATORS__=${process.env.NEXT_PUBLIC_USE_EMULATORS === "true"};`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Firebase: al entrar por QR o NFC, la primera llamada de auth paga
            DNS + TCP + TLS contra estos hosts. Abriendo la conexión mientras
            se descarga el JS se ahorran unos cientos de ms — en la red saturada
            de una feria es la diferencia entre "instantáneo" y "se quedó pegado". */}
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://securetoken.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firebaseinstallations.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
      </head>
      <body className="font-body antialiased selection:bg-accent selection:text-accent-foreground overflow-x-hidden h-full flex flex-col bg-white">
        {/* Header fijo con logo. Se oculta solo en pantallas de proyección. */}
        <HeaderGlobal />

        <Providers>
          <div className="flex-1">
            {children}
          </div>
        </Providers>
        
        {/* Sistema Global de Notificaciones de Sistema */}
        <NotificationSystem />
        
        {/* Recarga automática cuando el SW se actualiza en background */}
        <SwUpdateReloader />

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
