import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clubpatio.app',
  appName: 'Club Patio',
  webDir: 'out',
  server: {
    // La app carga el sitio en vivo de Vercel: las API routes corren en el servidor
    // y cada deploy web llega a la app sin pasar por la revisión de las tiendas.
    // Lo que SÍ exige una versión nueva en las tiendas: cambios en android/, ios/,
    // plugins/ o en los plugins nativos del package.json.
    url: 'https://clubpatiocurauma.synaptechspa.cl',
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    FirebaseMessaging: {
      // Con la app abierta, el push también se muestra como notificación.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_geopush',
      iconColor: '#C9920A',
    },
  },
};

export default config;
