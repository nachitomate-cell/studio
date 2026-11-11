#!/bin/bash
# SOLO rama test/geopush-sim. Compila la app para el simulador (sin firma) y
# prueba el aviso de llegada (GeoPushManager) en tres escenarios:
#   A) permiso "Siempre", app abierta: entrar a la zona -> didEnterRegion -> aviso
#   B) permiso "Siempre", app terminada: entrar -> iOS relanza la app -> aviso
#   C) permiso "Mientras se usa": UNLocationNotificationTrigger pendiente y entrega
# Todo lo que sirve de evidencia queda en sim-out/ (artefactos de Codemagic).
set -uo pipefail

ROOT="${CM_BUILD_DIR:-$(pwd)}"
OUT="$ROOT/sim-out"
mkdir -p "$OUT"
BID="com.clubpatio.app"
FAR="-33.1500,-71.5645"   # ~2 km al sur del outlet
MID="-33.1400,-71.5645"   # ~900 m
IN="-33.1318,-71.5645"    # centro del outlet (radio 250 m)
CFG='{"zonas":[{"id":"outlet","lat":-33.1318,"lng":-71.5645,"radio":250,"titulo":"Prueba simulador: llegaste al outlet","mensaje":"Aviso de llegada de prueba (Codemagic)"}],"esperaMinutos":0,"cooldownHoras":0,"cooldownGlobalHoras":0,"silencio":{"desde":0,"hasta":0},"activo":true}'

# con_tope <segundos> cmd... : corta el comando si se pasa del tope
con_tope() { local t="$1"; shift; "$@" & local pid=$!; ( sleep "$t"; kill -9 $pid 2>/dev/null && echo "[$(date +%H:%M:%S)] [tope] cortado tras ${t}s: $*" >> "$OUT/pasos.log" ) </dev/null >/dev/null 2>&1 & local w=$!; wait $pid; local rc=$?; kill $w 2>/dev/null; return $rc; }
sc() { con_tope 150 xcrun simctl "$@"; }
paso() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$OUT/pasos.log"; }

loc_set() {
  sc location "$1" set "$2" 2>>"$OUT/pasos.log" || sc location "$1" set -- "$2" 2>>"$OUT/pasos.log" || paso "ERROR location set $2"
}
loc_ruta() { # udid velocidad puntos...
  local u="$1" sp="$2"; shift 2
  sc location "$u" start --speed="$sp" --interval=1 "$@" 2>>"$OUT/pasos.log" \
    || sc location "$u" start --speed="$sp" --interval=1 -- "$@" 2>>"$OUT/pasos.log" \
    || paso "ERROR location start $*"
}

volcar() { # udid etiqueta
  local u="$1" et="$2" c
  c=$(sc get_app_container "$u" "$BID" data 2>/dev/null)
  sc io "$u" screenshot "$OUT/$et.png" >/dev/null 2>&1 || paso "sin captura $et"
  if [ -n "$c" ]; then
    [ -f "$c/Documents/geopush-sim.json" ] && cp "$c/Documents/geopush-sim.json" "$OUT/$et-estado.json"
    [ -f "$c/Library/Preferences/$BID.plist" ] && plutil -convert xml1 -o "$OUT/$et-prefs.plist" "$c/Library/Preferences/$BID.plist"
  fi
  paso "volcado $et: $(python3 -c 'import json,sys
try:
  d=json.load(open(sys.argv[1])); print("app=%s ubic=%s avisos=%s regiones=%s pendientes=%s entregados=%s eventos=%s"%(d["app"],d["ubicacion"],d["avisos"],d["regiones"],d["pendientes"],d["entregados"],d["eventos"]))
except Exception as e: print("sin estado.json (%s)"%e)' "$OUT/$et-estado.json" 2>/dev/null)"
}

copiar_logs() { # udid prefijo
  local u="$1" p="$2" c
  c=$(sc get_app_container "$u" "$BID" data 2>/dev/null)
  [ -n "$c" ] && [ -f "$c/Documents/geopush-sim.log" ] && cp "$c/Documents/geopush-sim.log" "$OUT/$p-app.log"
  con_tope 150 xcrun simctl spawn "$u" log show --last 20m --style compact --info \
    --predicate 'eventMessage CONTAINS "GeoPush"' > "$OUT/$p-log-geopush.txt" 2>&1
  con_tope 150 xcrun simctl spawn "$u" log show --last 20m --style compact --info \
    --predicate 'process == "locationd"' 2>/dev/null \
    | grep -i -E "clubpatio|gp_outlet|fence|region" | tail -n 4000 > "$OUT/$p-log-locationd.txt"
  con_tope 150 xcrun simctl spawn "$u" log show --last 20m --style compact --info \
    --predicate 'process == "usernotificationsd" OR process == "SpringBoard"' 2>/dev/null \
    | grep -i -E "clubpatio|geopush" | tail -n 4000 > "$OUT/$p-log-avisos.txt"
  con_tope 150 xcrun simctl spawn "$u" log show --last 20m --style compact --info \
    --predicate 'process == "runningboardd" OR process == "SpringBoard"' 2>/dev/null \
    | grep -i "clubpatio" | grep -i -E "launch|terminat|background|location" | tail -n 2000 > "$OUT/$p-log-ciclo-app.txt"
}

# ---------- Simuladores ----------
RUNTIME=$(xcrun simctl list runtimes -j | python3 -c 'import json,sys
r=[x for x in json.load(sys.stdin)["runtimes"] if x.get("isAvailable") and ".iOS-" in x["identifier"]]
r.sort(key=lambda x:[int(p) for p in x["version"].split(".")])
print(r[-1]["identifier"])')
DTYPE=$(xcrun simctl list runtimes -j | python3 -c 'import json,sys
rt=sys.argv[1]
r=[x for x in json.load(sys.stdin)["runtimes"] if x["identifier"]==rt][0]
t=[d for d in r.get("supportedDeviceTypes",[]) if d.get("productFamily")=="iPhone"]
pref=[d for d in t if d["name"] in ("iPhone 16","iPhone 17","iPhone 15","iPhone 16 Pro","iPhone 17 Pro")]
print((pref or t)[0]["identifier"])' "$RUNTIME")
paso "runtime=$RUNTIME devicetype=$DTYPE xcode=$(xcodebuild -version | head -1)"
UA=$(xcrun simctl create gp-siempre "$DTYPE" "$RUNTIME")
UC=$(xcrun simctl create gp-mientras "$DTYPE" "$RUNTIME")
paso "simulador A/B (Siempre)=$UA  C (Mientras se usa)=$UC"

# ---------- Compilar ----------
paso "compilando para simulador (Debug, sin firma)"
con_tope 1200 xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "id=$UA" -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO build > "$OUT/xcodebuild.log" 2>&1
RC=$?
grep -E "error:|warning: .*GeoPush|BUILD (SUCCEEDED|FAILED)" "$OUT/xcodebuild.log" | tail -n 60
if [ $RC -ne 0 ]; then paso "COMPILACION FALLO ($RC)"; tail -n 80 "$OUT/xcodebuild.log"; exit 1; fi
APP="$ROOT/build/Build/Products/Debug-iphonesimulator/App.app"
[ -d "$APP" ] || { paso "no encuentro $APP"; find build/Build/Products -maxdepth 2 -name "*.app"; exit 1; }
paso "app compilada: $APP"
open -a Simulator >/dev/null 2>&1 || true

# ---------- Escenario A: Siempre, app abierta ----------
U="$UA"
sc boot "$U"; sc bootstatus "$U" -b >/dev/null 2>&1
sc install "$U" "$APP" || { paso "install fallo"; exit 1; }
sc privacy "$U" grant location-always "$BID" 2>>"$OUT/pasos.log" || paso "ERROR grant location-always"
sc privacy "$U" grant notifications "$BID" 2>>"$OUT/pasos.log" && paso "notifications concedido por simctl" || paso "simctl no concede notifications (se usa permiso provisional)"
loc_set "$U" "$FAR"; sleep 5
xcrun simctl spawn "$U" log stream --style compact --level debug \
  --predicate 'eventMessage CONTAINS "GeoPush" OR ((process == "locationd" OR process == "usernotificationsd" OR process == "SpringBoard" OR process == "runningboardd") AND eventMessage CONTAINS[c] "clubpatio")' \
  > "$OUT/AB-logstream.txt" 2>&1 </dev/null &
LSA=$!
paso "A: lanzo la app AFUERA de la zona"
SIMCTL_CHILD_GP_CONFIG="$CFG" SIMCTL_CHILD_GP_PROVISIONAL=1 SIMCTL_CHILD_GP_RESET_EVENTOS=1 \
  sc launch "$U" "$BID" | tee -a "$OUT/pasos.log"
sleep 25
volcar "$U" A0-afuera
paso "A: ruta afuera -> adentro (25 m/s)"
loc_ruta "$U" 25 "$FAR" "$MID" "$IN"
for i in 1 2 3 4 5 6; do sleep 12; sc io "$U" screenshot "$OUT/A1-entrando-$i.png" >/dev/null 2>&1; done
loc_set "$U" "$IN"; sleep 20
volcar "$U" A2-adentro

# ---------- Escenario B: Siempre, app terminada ----------
paso "B: salgo de la zona con la app abierta"
loc_ruta "$U" 25 "$IN" "$MID" "$FAR"; sleep 60
loc_set "$U" "$FAR"; sleep 15
volcar "$U" B0-afuera
paso "B: termino la app (simctl terminate) y vuelvo a entrar"
sc terminate "$U" "$BID"; sleep 8
loc_ruta "$U" 25 "$FAR" "$MID" "$IN"
for i in 1 2 3 4 5 6; do sleep 12; sc io "$U" screenshot "$OUT/B1-entrando-cerrada-$i.png" >/dev/null 2>&1; done
loc_set "$U" "$IN"; sleep 25
c=$(sc get_app_container "$U" "$BID" data)
[ -f "$c/Library/Preferences/$BID.plist" ] && plutil -convert xml1 -o "$OUT/B2-prefs-sin-abrir.plist" "$c/Library/Preferences/$BID.plist"
sc spawn "$U" launchctl list 2>/dev/null | grep -i clubpatio > "$OUT/B2-procesos.txt"
paso "B: procesos de la app tras entrar con la app cerrada: $(cat "$OUT/B2-procesos.txt" | tr '\n' ' ')"
paso "B: abro la app para leer la bitacora"
sc launch "$U" "$BID" | tee -a "$OUT/pasos.log"
sleep 15
volcar "$U" B3-reabierta
kill $LSA 2>/dev/null; pkill -f "log stream" 2>/dev/null
copiar_logs "$U" AB

# ---------- Escenario C: Mientras se usa ----------
U="$UC"
sc boot "$U"; sc bootstatus "$U" -b >/dev/null 2>&1
sc install "$U" "$APP" || { paso "install C fallo"; exit 0; }
sc privacy "$U" grant location "$BID" 2>>"$OUT/pasos.log" || paso "ERROR grant location"
loc_set "$U" "$FAR"; sleep 5
xcrun simctl spawn "$U" log stream --style compact --level debug \
  --predicate 'eventMessage CONTAINS "GeoPush" OR ((process == "locationd" OR process == "usernotificationsd" OR process == "SpringBoard") AND eventMessage CONTAINS[c] "clubpatio")' \
  > "$OUT/C-logstream.txt" 2>&1 </dev/null &
LSC=$!
paso "C: lanzo la app AFUERA con permiso 'mientras se usa'"
SIMCTL_CHILD_GP_CONFIG="$CFG" SIMCTL_CHILD_GP_PROVISIONAL=1 SIMCTL_CHILD_GP_RESET_EVENTOS=1 \
  sc launch "$U" "$BID" | tee -a "$OUT/pasos.log"
sleep 25
volcar "$U" C0-armado
paso "C: mando la app a segundo plano (abro Ajustes) y entro a la zona"
sc launch "$U" com.apple.Preferences >/dev/null 2>&1
loc_ruta "$U" 25 "$FAR" "$MID" "$IN"
for i in 1 2 3 4 5 6; do sleep 12; sc io "$U" screenshot "$OUT/C1-entrando-$i.png" >/dev/null 2>&1; done
loc_set "$U" "$IN"; sleep 20
paso "C: vuelvo a la app (sigue viva) y luego la relanzo para que re-arme y registre"
sc launch "$U" "$BID" >/dev/null; sleep 12
volcar "$U" C2-vuelta
sc terminate "$U" "$BID"; sleep 3
sc launch "$U" "$BID" | tee -a "$OUT/pasos.log"; sleep 15
volcar "$U" C3-relanzada
kill $LSC 2>/dev/null; pkill -f "log stream" 2>/dev/null
copiar_logs "$U" C

pkill -f "log stream" 2>/dev/null
paso "listo"
ls -la "$OUT"
exit 0
