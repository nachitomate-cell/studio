package cl.synaptech.geopush;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * Lo que el aviso necesita saber cuando la app está CERRADA: las zonas, los
 * textos y cuándo se avisó por última vez. Vive en SharedPreferences porque el
 * receptor de la geocerca corre sin WebView y sin JavaScript.
 */
final class GeoPushStore {
    private static final String PREFS = "geopush";
    private static final String K_CONFIG = "config";
    private static final String K_EVENTOS = "eventos";
    private static final String K_ULTIMO_GLOBAL = "ultimoGlobal";
    private static final int MAX_EVENTOS = 50;

    private GeoPushStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void guardarConfig(Context c, JSONObject config) {
        prefs(c).edit().putString(K_CONFIG, config.toString()).apply();
    }

    static JSONObject config(Context c) {
        String s = prefs(c).getString(K_CONFIG, null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    static JSONObject zona(Context c, String id) {
        JSONObject cfg = config(c);
        if (cfg == null) return null;
        JSONArray zonas = cfg.optJSONArray("zonas");
        if (zonas == null) return null;
        for (int i = 0; i < zonas.length(); i++) {
            JSONObject z = zonas.optJSONObject(i);
            if (z != null && id.equals(z.optString("id"))) return z;
        }
        return null;
    }

    static long ultimoAviso(Context c, String zonaId) {
        return prefs(c).getLong("ultimo_" + zonaId, 0L);
    }

    static long ultimoGlobal(Context c) {
        return prefs(c).getLong(K_ULTIMO_GLOBAL, 0L);
    }

    static void marcarAviso(Context c, String zonaId, long ahora) {
        prefs(c).edit().putLong("ultimo_" + zonaId, ahora).putLong(K_ULTIMO_GLOBAL, ahora).apply();
    }

    /** ¿Estamos en horario de silencio? Rango [desde, hasta) en horas locales; puede cruzar medianoche. */
    static boolean enSilencio(JSONObject cfg) {
        JSONObject sil = cfg.optJSONObject("silencio");
        if (sil == null) return false;
        int desde = sil.optInt("desde", -1);
        int hasta = sil.optInt("hasta", -1);
        if (desde < 0 || hasta < 0 || desde == hasta) return false;
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        return desde < hasta ? (h >= desde && h < hasta) : (h >= desde || h < hasta);
    }

    static synchronized void registrarEvento(Context c, String zonaId, String tipo) {
        try {
            JSONArray arr = new JSONArray(prefs(c).getString(K_EVENTOS, "[]"));
            JSONObject ev = new JSONObject();
            ev.put("zona", zonaId);
            ev.put("tipo", tipo);
            ev.put("ts", System.currentTimeMillis());
            arr.put(ev);
            while (arr.length() > MAX_EVENTOS) arr.remove(0);
            prefs(c).edit().putString(K_EVENTOS, arr.toString()).apply();
        } catch (JSONException ignored) {
        }
    }

    static synchronized JSONArray eventos(Context c, boolean limpiar) {
        JSONArray arr;
        try {
            arr = new JSONArray(prefs(c).getString(K_EVENTOS, "[]"));
        } catch (JSONException e) {
            arr = new JSONArray();
        }
        if (limpiar) prefs(c).edit().putString(K_EVENTOS, "[]").apply();
        return arr;
    }
}
