package cl.synaptech.geopush;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

/** Arma y publica el aviso local. Decide si corresponde (silencio, enfriamiento). */
final class GeoPushAviso {
    static final String CANAL = "geopush";
    static final String EXTRA_ZONA = "geopush_zona";

    private GeoPushAviso() {}

    static void crearCanal(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel ch = new NotificationChannel(CANAL, "Beneficios cerca del Patio", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Te avisa de tus sellos y premios cuando llegas a Patio Curauma.");
        nm.createNotificationChannel(ch);
    }

    /**
     * @param forzar ignora silencio y enfriamiento (botón "Probar aviso").
     * @return true si se publicó el aviso.
     */
    static boolean avisar(Context ctx, String zonaId, boolean forzar) {
        Context c = ctx.getApplicationContext();
        JSONObject cfg = GeoPushStore.config(c);
        JSONObject z = GeoPushStore.zona(c, zonaId);
        if (cfg == null || z == null) return false;

        long ahora = System.currentTimeMillis();
        if (!forzar) {
            if (!cfg.optBoolean("activo", true)) return false;
            if (GeoPushStore.enSilencio(cfg)) {
                GeoPushStore.registrarEvento(c, zonaId, "silencio");
                return false;
            }
            long cdZona = (long) (z.optDouble("cooldownHoras", cfg.optDouble("cooldownHoras", 24)) * 3_600_000L);
            long cdGlobal = (long) (cfg.optDouble("cooldownGlobalHoras", 8) * 3_600_000L);
            if (ahora - GeoPushStore.ultimoAviso(c, zonaId) < cdZona || ahora - GeoPushStore.ultimoGlobal(c) < cdGlobal) {
                GeoPushStore.registrarEvento(c, zonaId, "enfriamiento");
                return false;
            }
        }
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) {
            GeoPushStore.registrarEvento(c, zonaId, "sin_permiso_avisos");
            return false;
        }

        crearCanal(c);
        Intent abrir = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (abrir == null) return false;
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        abrir.putExtra(EXTRA_ZONA, zonaId);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(c, zonaId.hashCode(), abrir, flags);

        String titulo = z.optString("titulo", "Estás en Patio Curauma");
        String mensaje = z.optString("mensaje", "Abre Club Patio y suma sellos en tus locales favoritos.");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_stat_geopush)
            .setContentTitle(titulo)
            .setContentText(mensaje)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(mensaje))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .setAutoCancel(true)
            .setContentIntent(pi);
        String color = cfg.optString("color", "");
        if (color.startsWith("#")) {
            try {
                b.setColor(android.graphics.Color.parseColor(color));
            } catch (IllegalArgumentException ignored) {
            }
        }
        try {
            NotificationManagerCompat.from(c).notify(9000 + Math.abs(zonaId.hashCode() % 900), b.build());
        } catch (SecurityException e) {
            GeoPushStore.registrarEvento(c, zonaId, "sin_permiso_avisos");
            return false;
        }
        if (!forzar) GeoPushStore.marcarAviso(c, zonaId, ahora);
        GeoPushStore.registrarEvento(c, zonaId, forzar ? "prueba" : "aviso");
        return true;
    }
}
