import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'Club Patio',
  description: 'Acumula sellos y obtén recompensas en Patio Curauma',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-accent selection:text-accent-foreground overflow-x-hidden">
        
        {/* Header fijo con logo optimizado */}
        <header className="bg-white shadow-sm py-3 flex justify-center w-full sticky top-0 z-50">
          <img src="/Logo.png" alt="Patio Curauma" className="h-14 object-contain" />
        </header>

        {children}
        <Toaster />
      </body>
    </html>
  );
}
