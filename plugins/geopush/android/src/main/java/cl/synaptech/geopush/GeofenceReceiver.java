package cl.synaptech.geopush;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

/** Lo despierta el sistema al entrar (o quedarse) en una zona, con la app abierta o cerrada. */
public class GeofenceReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent ev = GeofencingEvent.fromIntent(intent);
        if (ev == null) return;
        if (ev.hasError()) {
            Log.w(GeoPushGeocercas.TAG, "Error de geocerca: " + ev.getErrorCode());
            return;
        }
        int t = ev.getGeofenceTransition();
        if (t != Geofence.GEOFENCE_TRANSITION_ENTER && t != Geofence.GEOFENCE_TRANSITION_DWELL) return;
        if (ev.getTriggeringGeofences() == null) return;
        for (Geofence g : ev.getTriggeringGeofences()) {
            // Si se cruzan dos zonas a la vez, el enfriamiento global corta la segunda.
            GeoPushAviso.avisar(context, g.getRequestId(), false);
        }
    }
}
