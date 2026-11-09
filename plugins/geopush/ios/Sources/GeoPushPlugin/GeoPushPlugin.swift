import Foundation
import Capacitor
import CoreLocation
import UserNotifications

/// Puente JS ↔ GeoPushManager. El JS configura y pide permisos; el aviso lo
/// publica el lado nativo aunque la app esté cerrada.
@objc(GeoPushPlugin)
public class GeoPushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GeoPushPlugin"
    public let jsName = "GeoPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configurar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "apagar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pedirPermiso", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abrirAjustes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "eventos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "probar", returnType: CAPPluginReturnPromise)
    ]

    private let gp = GeoPushManager.shared

    override public func load() {
        gp.sincronizar()
    }

    private func estadoActual(_ listo: @escaping (JSObject) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let a = self.gp.autorizacion
            var r = JSObject()
            r["plataforma"] = "ios"
            switch a {
            case .authorizedAlways, .authorizedWhenInUse: r["ubicacion"] = "granted"
            case .notDetermined: r["ubicacion"] = "prompt"
            default: r["ubicacion"] = "denied"
            }
            switch a {
            case .authorizedAlways: r["segundoPlano"] = "granted"
            case .authorizedWhenInUse, .notDetermined: r["segundoPlano"] = "prompt"
            default: r["segundoPlano"] = "denied"
            }
            switch s.authorizationStatus {
            case .authorized, .provisional, .ephemeral: r["avisos"] = "granted"
            case .notDetermined: r["avisos"] = "prompt"
            default: r["avisos"] = "denied"
            }
            let zonas = (self.gp.config()?["zonas"] as? [Any])?.count ?? 0
            let encendido = (self.gp.config()?["activo"] as? Bool) ?? true
            r["zonas"] = zonas
            // Con "mientras se usa" también avisa (disparador de ubicación), con menos control.
            r["activo"] = encendido && zonas > 0 && (a == .authorizedAlways || a == .authorizedWhenInUse) && s.authorizationStatus != .denied
            r["modo"] = a == .authorizedAlways ? "siempre" : (a == .authorizedWhenInUse ? "mientras_se_usa" : "ninguno")
            listo(r)
        }
    }

    @objc func estado(_ call: CAPPluginCall) {
        estadoActual { call.resolve($0) }
    }

    @objc func configurar(_ call: CAPPluginCall) {
        guard let cfg = call.getObject("config") else {
            call.reject("Falta config")
            return
        }
        DispatchQueue.main.async {
            self.gp.guardarConfig(cfg as [String: Any])
            let n = self.gp.sincronizar()
            self.estadoActual { r in
                var r = r
                r["registradas"] = n
                call.resolve(r)
            }
        }
    }

    @objc func apagar(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            var cfg = self.gp.config() ?? [:]
            cfg["activo"] = false
            self.gp.guardarConfig(cfg)
            self.gp.sincronizar()
            self.estadoActual { call.resolve($0) }
        }
    }

    @objc func pedirPermiso(_ call: CAPPluginCall) {
        let paso = call.getString("paso") ?? "ubicacion"
        DispatchQueue.main.async {
            switch paso {
            case "avisos":
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
                    self.estadoActual { call.resolve($0) }
                }
            case "segundoPlano":
                self.gp.pedirSiempre {
                    self.gp.sincronizar()
                    self.estadoActual { call.resolve($0) }
                }
            default:
                self.gp.pedirUbicacion {
                    self.gp.sincronizar()
                    self.estadoActual { call.resolve($0) }
                }
            }
        }
    }

    @objc func abrirAjustes(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }

    @objc func eventos(_ call: CAPPluginCall) {
        let lista = gp.eventos(limpiar: call.getBool("limpiar") ?? false)
        let arr: JSArray = lista.map { (JSTypes.coerceDictionaryToJSObject($0) ?? [:]) as JSValue }
        call.resolve(["eventos": arr])
    }

    @objc func probar(_ call: CAPPluginCall) {
        let primera = (gp.config()?["zonas"] as? [[String: Any]])?.first?["id"] as? String
        guard let zona = call.getString("zona") ?? primera else {
            call.reject("No hay zonas configuradas")
            return
        }
        gp.publicar(zona, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false), identificador: "geopush_prueba") { ok in
            if ok { self.gp.registrarEvento(zona, "prueba") }
            call.resolve(["enviado": ok])
        }
    }
}
