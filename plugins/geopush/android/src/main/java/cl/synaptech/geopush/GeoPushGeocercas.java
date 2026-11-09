package cl.synaptech.geopush;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Registra las zonas como geocercas DEL SISTEMA (Google Play Services). El
 * sistema vigila la ubicación con su propio presupuesto de batería y despierta
 * a GeofenceReceiver aunque la app esté cerrada: no hay servicio en primer
 * plano ni notificación fija.
 */
final class GeoPushGeocercas {
    static final String TAG = "GeoPush";

    private GeoPushGeocercas() {}

    static boolean tienePermisoUbicacion(Context c) {
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean tienePermisoSegundoPlano(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return tienePermisoUbicacion(c);
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private static PendingIntent pendingIntent(Context c) {
        Intent i = new Intent(c, GeofenceReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        // Android 12+: el sistema rellena el intent con los datos de la geocerca → MUTABLE.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(c, 4711, i, flags);
    }

    /** @return cuántas geocercas se pidieron al sistema (0 si faltan permisos o está apagado). */
    @SuppressLint("MissingPermission")
    static int registrar(Context ctx) {
        Context c = ctx.getApplicationContext();
        GeofencingClient client = LocationServices.getGeofencingClient(c);
        PendingIntent pi = pendingIntent(c);
        client.removeGeofences(pi);

        JSONObject cfg = GeoPushStore.config(c);
        if (cfg == null || !cfg.optBoolean("activo", true)) return 0;
        if (!tienePermisoUbicacion(c) || !tienePermisoSegundoPlano(c)) return 0;

        JSONArray zonas = cfg.optJSONArray("zonas");
        if (zonas == null || zonas.length() == 0) return 0;
        int esperaMs = Math.max(0, cfg.optInt("esperaMinutos", 3)) * 60_000;

        List<Geofence> lista = new ArrayList<>();
        for (int i = 0; i < zonas.length() && lista.size() < 90; i++) {
            JSONObject z = zonas.optJSONObject(i);
            if (z == null || !z.has("lat") || !z.has("lng") || z.optString("id").isEmpty()) continue;
            Geofence.Builder b = new Geofence.Builder()
                .setRequestId(z.optString("id"))
                .setCircularRegion(z.optDouble("lat"), z.optDouble("lng"), (float) Math.max(100, z.optDouble("radio", 200)))
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setNotificationResponsiveness(60_000);
            if (esperaMs > 0) {
                // DWELL: solo avisa si la persona SE QUEDA, no si pasa en auto por la avenida.
                b.setTransitionTypes(Geofence.GEOFENCE_TRANSITION_DWELL).setLoiteringDelay(esperaMs);
            } else {
                b.setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER);
            }
            lista.add(b.build());
        }
        if (lista.isEmpty()) return 0;

        GeofencingRequest req = new GeofencingRequest.Builder()
            // Sin disparo inicial: abrir la app estando ya en el Patio no debe avisar.
            .setInitialTrigger(0)
            .addGeofences(lista)
            .build();
        final int n = lista.size();
        client.addGeofences(req, pi)
            .addOnSuccessListener(v -> Log.i(TAG, "Geocercas registradas: " + n))
            .addOnFailureListener(e -> Log.w(TAG, "No se pudieron registrar las geocercas", e));
        return n;
    }

    static void quitar(Context c) {
        LocationServices.getGeofencingClient(c.getApplicationContext()).removeGeofences(pendingIntent(c.getApplicationContext()));
    }
}
