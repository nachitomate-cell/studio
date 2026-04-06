import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'Curauma Conecta',
  description: 'Conectando emprendedores en Patio Curauma',
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
        
        {/* Header más compacto con logo reducido */}
        <header className="bg-white shadow-sm p-2 flex justify-center w-full">
          <img src="/Logo.png" alt="Patio Curauma" className="h-12 object-contain" />
        </header>

        {children}
        <Toaster />
      </body>
    </html>
  );
}
