import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Únete al Club Patio – Gana Premios',
  description: 'Regístrate en Club Patio Curauma, acumula sellos y participa por increíbles premios. ¡Escanea el QR y empieza ya!',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#D3B673',
};

export default function UneteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
