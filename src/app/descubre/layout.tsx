import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Descubre el Club Patio Curauma — Premios y Beneficios Gratis',
  description: 'Acumula sellos en los locales de Patio Curauma y canjéalos por premios exclusivos. ¡Regístrate gratis y recibe tu primer sello de regalo!',
  openGraph: {
    title: 'Descubre el Club Patio Curauma',
    description: 'Gana premios comprando en Patio Curauma. ¡Únete gratis hoy!',
    images: ['/Logo3.webp'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#D3B673',
};

export default function DescubreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
