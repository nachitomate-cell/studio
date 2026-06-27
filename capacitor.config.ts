
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clubpatio.app',
  appName: 'Club Patio',
  webDir: 'out',
  server: {
    // Carga el sitio live de Vercel — las API routes funcionan en el servidor
    // Para build APK offline: eliminar esta línea, habilitar output:'export' en next.config.ts y hacer npm run build
    url: 'https://clubpatiocurauma.synaptechspa.cl',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;
