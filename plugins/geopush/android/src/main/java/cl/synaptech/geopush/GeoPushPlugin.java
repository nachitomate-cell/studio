package cl.synaptech.geopush;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Puente JS ↔ geocercas nativas. El JS solo configura y pide permisos: el aviso
 * lo publica el lado nativo, aunque la app esté cerrada.
 */
@CapacitorPlugin(
    name = "GeoPush",
    permissions = {
        @Permission(alias = "ubicacion", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "segundoPlano", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = "avisos", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class GeoPushPlugin extends Plugin {

    @Override
    public void load() {
        GeoPushAviso.crearCanal(getContext());
        GeoPushGeocercas.registrar(getContext());
        if (getActivity() != null) revisarToque(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        revisarToque(intent);
    }

    private void revisarToque(Intent intent) {
        if (intent == null || !intent.hasExtra(GeoPushAviso.EXTRA_ZONA)) return;
        String zona = intent.getStringExtra(GeoPushAviso.EXTRA_ZONA);
        intent.removeExtra(GeoPushAviso.EXTRA_ZONA);
        GeoPushStore.registrarEvento(getContext(), zona, "toque");
        JSObject data = new JSObject();
        data.put("zona", zona);
        notifyListeners("toque", data, true);
    }

    // ── Estado ────────────────────────────────────────────────────────────────

    private String estadoAlias(String alias, boolean concedido) {
        if (concedido) return "granted";
        PermissionState s = getPermissionState(alias);
        if (s == PermissionState.DENIED) return "denied";
        return "prompt";
    }

    private JSObject estadoActual() {
        boolean ubic = GeoPushGeocercas.tienePermisoUbicacion(getContext());
        boolean bg = GeoPushGeocercas.tienePermisoSegundoPlano(getContext());
        boolean avisos = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        JSObject r = new JSObject();
        r.put("plataforma", "android");
        r.put("ubicacion", estadoAlias("ubicacion", ubic));
        r.put("segundoPlano", Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ? (ubic ? "granted" : "prompt") : estadoAlias("segundoPlano", bg));
        r.put("avisos", Build.VERSION.SDK_INT < 33 ? (avisos ? "granted" : "denied") : estadoAlias("avisos", avisos));
        JSONObject cfg = GeoPushStore.config(getContext());
        int zonas = cfg != null && cfg.optJSONArray("zonas") != null ? cfg.optJSONArray("zonas").length() : 0;
        r.put("zonas", zonas);
        r.put("activo", cfg != null && cfg.optBoolean("activo", true) && ubic && bg && zonas > 0);
        return r;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        call.resolve(estadoActual());
    }

    // ── Configuración ─────────────────────────────────────────────────────────

    @PluginMethod
    public void configurar(PluginCall call) {
        JSObject cfg = call.getObject("config");
        if (cfg == null) {
            call.reject("Falta config");
            return;
        }
        GeoPushStore.guardarConfig(getContext(), cfg);
        int n = GeoPushGeocercas.registrar(getContext());
        JSObject r = estadoActual();
        r.put("registradas", n);
        call.resolve(r);
    }

    @PluginMethod
    public void apagar(PluginCall call) {
        JSONObject cfg = GeoPushStore.config(getContext());
        if (cfg != null) {
            try {
                cfg.put("activo", false);
                GeoPushStore.guardarConfig(getContext(), cfg);
            } catch (JSONException ignored) {
            }
        }
        GeoPushGeocercas.quitar(getContext());
        call.resolve(estadoActual());
    }

    // ── Permisos (de a un paso, con la explicación en pantalla ANTES de cada uno) ─

    @PluginMethod
    public void pedirPermiso(PluginCall call) {
        String paso = call.getString("paso", "ubicacion");
        if ("avisos".equals(paso)) {
            if (Build.VERSION.SDK_INT < 33) {
                call.resolve(estadoActual());
                return;
            }
            requestPermissionForAlias("avisos", call, "permisoListo");
        } else if ("segundoPlano".equals(paso)) {
            if (!GeoPushGeocercas.tienePermisoUbicacion(getContext())) {
                call.reject("Primero hay que dar la ubicación mientras se usa la app");
                return;
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                permisoListo(call);
                return;
            }
            // Android 11+: el sistema abre la pantalla de ajustes con "Permitir todo el tiempo".
            requestPermissionForAlias("segundoPlano", call, "permisoListo");
        } else {
            requestPermissionForAlias("ubicacion", call, "permisoListo");
        }
    }

    @PermissionCallback
    private void permisoListo(PluginCall call) {
        GeoPushGeocercas.registrar(getContext());
        call.resolve(estadoActual());
    }

    @PluginMethod
    public void abrirAjustes(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    // ── Eventos y prueba ──────────────────────────────────────────────────────

    @PluginMethod
    public void eventos(PluginCall call) {
        JSONArray arr = GeoPushStore.eventos(getContext(), call.getBoolean("limpiar", false));
        JSObject r = new JSObject();
        try {
            r.put("eventos", new JSArray(arr.toString()));
        } catch (JSONException e) {
            r.put("eventos", new JSArray());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void probar(PluginCall call) {
        String zona = call.getString("zona");
        if (zona == null) {
            JSONObject cfg = GeoPushStore.config(getContext());
            JSONArray zs = cfg != null ? cfg.optJSONArray("zonas") : null;
            JSONObject z0 = zs != null ? zs.optJSONObject(0) : null;
            zona = z0 != null ? z0.optString("id") : null;
        }
        if (zona == null) {
            call.reject("No hay zonas configuradas");
            return;
        }
        JSObject r = new JSObject();
        r.put("enviado", GeoPushAviso.avisar(getContext(), zona, true));
        call.resolve(r);
    }
}
