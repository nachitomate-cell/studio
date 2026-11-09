import Foundation
import CoreLocation
import UserNotifications

/// Geocercas del sistema (CLLocationManager) con aviso local.
///
/// Dos modos según el permiso que dio la persona:
/// - **Siempre**: monitoreo de regiones. iOS despierta (o relanza) la app al
///   entrar en una zona aunque esté cerrada; acá se decide si avisar
///   (silencio, enfriamiento) y se agenda el aviso con unos minutos de espera
///   para no avisarle a quien solo pasa en auto. Si sale antes, se cancela.
/// - **Mientras se usa**: aviso con disparador de ubicación
///   (UNLocationNotificationTrigger). Lo dispara iOS solo, sin despertar la
///   app; se vuelve a armar cada vez que se abre la app, respetando el
///   enfriamiento.
///
/// Tiene que arrancar en `didFinishLaunching` (AppDelegate): cuando iOS relanza
/// la app por una región, el delegado debe existir antes de que llegue el evento.
@objc public class GeoPushManager: NSObject, CLLocationManagerDelegate {
    @objc public static let shared = GeoPushManager()

    private let manager = CLLocationManager()
    private let defaults = UserDefaults.standard
    private let prefijoRegion = "gp_"
    private let prefijoEspera = "geopush_espera_"
    private let prefijoUbicacion = "geopush_loc_"
    private let maxEventos = 50
    private var alCambiarPermiso: [() -> Void] = []

    private override init() {
        super.init()
        manager.delegate = self
    }

    /// Llamar desde AppDelegate.application(_:didFinishLaunchingWithOptions:).
    @objc public func arrancar() {
        // Basta con crear el manager con su delegado: si iOS relanzó la app por una
        // región, el evento llega después de esto.
        _ = manager
        sincronizar()
    }

    // MARK: - Configuración guardada

    func guardarConfig(_ config: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: config) {
            defaults.set(data, forKey: "geopush.config")
        }
    }

    func config() -> [String: Any]? {
        guard let data = defaults.data(forKey: "geopush.config"),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return obj
    }

    private func zonas() -> [[String: Any]] {
        return (config()?["zonas"] as? [[String: Any]]) ?? []
    }

    private func zona(_ id: String) -> [String: Any]? {
        return zonas().first { ($0["id"] as? String) == id }
    }

    private func activo() -> Bool {
        return (config()?["activo"] as? Bool) ?? true
    }

    private func num(_ v: Any?, _ def: Double) -> Double {
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        if let n = v as? NSNumber { return n.doubleValue }
        return def
    }

    // MARK: - Permisos

    var autorizacion: CLAuthorizationStatus {
        return manager.authorizationStatus
    }

    func pedirUbicacion(_ listo: @escaping () -> Void) {
        if autorizacion != .notDetermined { listo(); return }
        alCambiarPermiso.append(listo)
        manager.requestWhenInUseAuthorization()
    }

    func pedirSiempre(_ listo: @escaping () -> Void) {
        if autorizacion != .authorizedWhenInUse { listo(); return }
        alCambiarPermiso.append(listo)
        manager.requestAlwaysAuthorization()
        // iOS puede no mostrar nada (ya preguntó una vez): no dejar la promesa colgada.
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in self?.vaciarEspera() }
    }

    private func vaciarEspera() {
        let pendientes = alCambiarPermiso
        alCambiarPermiso.removeAll()
        pendientes.forEach { $0() }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        sincronizar()
        vaciarEspera()
    }

    // MARK: - Registrar zonas según el permiso

    @discardableResult
    func sincronizar() -> Int {
        // Quitar lo nuestro y volver a poner (idempotente).
        for r in manager.monitoredRegions where r.identifier.hasPrefix(prefijoRegion) {
            manager.stopMonitoring(for: r)
        }
        let lista = zonas()
        guard activo(), !lista.isEmpty else {
            quitarAvisosUbicacion()
            return 0
        }

        switch autorizacion {
        case .authorizedAlways:
            quitarAvisosUbicacion()
            guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return 0 }
            var n = 0
            for z in lista.prefix(18) {
                guard let id = z["id"] as? String else { continue }
                let centro = CLLocationCoordinate2D(latitude: num(z["lat"], 0), longitude: num(z["lng"], 0))
                let radio = min(max(num(z["radio"], 200), 100), manager.maximumRegionMonitoringDistance)
                let region = CLCircularRegion(center: centro, radius: radio, identifier: prefijoRegion + id)
                region.notifyOnEntry = true
                region.notifyOnExit = true
                manager.startMonitoring(for: region)
                n += 1
            }
            return n
        case .authorizedWhenInUse:
            armarAvisosUbicacion(lista)
            return lista.count
        default:
            quitarAvisosUbicacion()
            return 0
        }
    }

    // MARK: - Modo "Siempre": entrada y salida de región

    public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard region.identifier.hasPrefix(prefijoRegion) else { return }
        let id = String(region.identifier.dropFirst(prefijoRegion.count))
        guard let cfg = config(), activo(), zona(id) != nil else { return }
        if let motivo = motivoParaNoAvisar(id, cfg) {
            registrarEvento(id, motivo)
            return
        }
        let espera = max(0, num(cfg["esperaMinutos"], 3)) * 60
        // Reservar el enfriamiento ya; si sale antes de la espera se devuelve.
        defaults.set(defaults.double(forKey: "geopush.ultimo." + id), forKey: "geopush.previo." + id)
        defaults.set(defaults.double(forKey: "geopush.ultimoGlobal"), forKey: "geopush.previoGlobal." + id)
        marcarAviso(id)
        publicar(id, trigger: espera > 0 ? UNTimeIntervalNotificationTrigger(timeInterval: espera, repeats: false) : nil, identificador: prefijoEspera + id) { ok in
            self.registrarEvento(id, ok ? "aviso" : "sin_permiso_avisos")
        }
    }

    public func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard region.identifier.hasPrefix(prefijoRegion) else { return }
        let id = String(region.identifier.dropFirst(prefijoRegion.count))
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { reqs in
            guard reqs.contains(where: { $0.identifier == self.prefijoEspera + id }) else { return }
            // Pasó de largo: no avisar y devolver el enfriamiento.
            center.removePendingNotificationRequests(withIdentifiers: [self.prefijoEspera + id])
            self.defaults.set(self.defaults.double(forKey: "geopush.previo." + id), forKey: "geopush.ultimo." + id)
            self.defaults.set(self.defaults.double(forKey: "geopush.previoGlobal." + id), forKey: "geopush.ultimoGlobal")
            self.registrarEvento(id, "paso_de_largo")
        }
    }

    public func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        NSLog("[GeoPush] Falló el monitoreo de %@: %@", region?.identifier ?? "?", error.localizedDescription)
    }

    // MARK: - Modo "Mientras se usa": disparador de ubicación

    private func armarAvisosUbicacion(_ lista: [[String: Any]]) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { reqs in
            let pendientes = Set(reqs.map { $0.identifier })
            for z in lista.prefix(20) {
                guard let id = z["id"] as? String, let cfg = self.config() else { continue }
                let ident = self.prefijoUbicacion + id
                // Estaba armado y ya no está pendiente → iOS lo mostró con la app cerrada.
                if self.defaults.bool(forKey: "geopush.armado." + id) && !pendientes.contains(ident) {
                    self.defaults.set(false, forKey: "geopush.armado." + id)
                    self.marcarAviso(id)
                    self.registrarEvento(id, "aviso")
                }
                if pendientes.contains(ident) { continue }
                if self.motivoEnfriamiento(id, cfg) != nil { continue }
                let centro = CLLocationCoordinate2D(latitude: self.num(z["lat"], 0), longitude: self.num(z["lng"], 0))
                let region = CLCircularRegion(center: centro, radius: max(self.num(z["radio"], 200), 100), identifier: ident)
                region.notifyOnEntry = true
                region.notifyOnExit = false
                self.publicar(id, trigger: UNLocationNotificationTrigger(region: region, repeats: false), identificador: ident) { ok in
                    if ok { self.defaults.set(true, forKey: "geopush.armado." + id) }
                }
            }
        }
    }

    private func quitarAvisosUbicacion() {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { reqs in
            let ids = reqs.map { $0.identifier }.filter { $0.hasPrefix(self.prefijoUbicacion) }
            center.removePendingNotificationRequests(withIdentifiers: ids)
            for z in self.zonas() {
                if let id = z["id"] as? String { self.defaults.set(false, forKey: "geopush.armado." + id) }
            }
        }
    }

    // MARK: - Reglas

    private func horaLocal() -> Int {
        return Calendar.current.component(.hour, from: Date())
    }

    private func motivoEnfriamiento(_ id: String, _ cfg: [String: Any]) -> String? {
        let ahora = Date().timeIntervalSince1970
        let z = zona(id) ?? [:]
        let cdZona = num(z["cooldownHoras"], num(cfg["cooldownHoras"], 24)) * 3600
        let cdGlobal = num(cfg["cooldownGlobalHoras"], 8) * 3600
        if ahora - defaults.double(forKey: "geopush.ultimo." + id) < cdZona { return "enfriamiento" }
        if ahora - defaults.double(forKey: "geopush.ultimoGlobal") < cdGlobal { return "enfriamiento" }
        return nil
    }

    private func motivoParaNoAvisar(_ id: String, _ cfg: [String: Any]) -> String? {
        if let sil = cfg["silencio"] as? [String: Any] {
            let desde = Int(num(sil["desde"], -1)), hasta = Int(num(sil["hasta"], -1))
            if desde >= 0 && hasta >= 0 && desde != hasta {
                let h = horaLocal()
                let dentro = desde < hasta ? (h >= desde && h < hasta) : (h >= desde || h < hasta)
                if dentro { return "silencio" }
            }
        }
        return motivoEnfriamiento(id, cfg)
    }

    private func marcarAviso(_ id: String) {
        let ahora = Date().timeIntervalSince1970
        defaults.set(ahora, forKey: "geopush.ultimo." + id)
        defaults.set(ahora, forKey: "geopush.ultimoGlobal")
    }

    // MARK: - Publicar

    func publicar(_ id: String, trigger: UNNotificationTrigger?, identificador: String, listo: ((Bool) -> Void)? = nil) {
        guard let z = zona(id) else { listo?(false); return }
        let contenido = UNMutableNotificationContent()
        contenido.title = (z["titulo"] as? String) ?? "Estás en Patio Curauma"
        contenido.body = (z["mensaje"] as? String) ?? "Abre Club Patio y suma sellos en tus locales favoritos."
        contenido.sound = .default
        // cap_extra: así el toque llega al JS por localNotificationActionPerformed.
        contenido.userInfo = ["cap_extra": ["geopushZona": id]]
        if #available(iOS 15.0, *) { contenido.interruptionLevel = .active }
        let req = UNNotificationRequest(identifier: identificador, content: contenido, trigger: trigger)
        UNUserNotificationCenter.current().add(req) { err in
            if let err = err { NSLog("[GeoPush] No se pudo agendar el aviso: %@", err.localizedDescription) }
            listo?(err == nil)
        }
    }

    // MARK: - Bitácora (la lee el JS al abrir la app)

    func registrarEvento(_ zona: String, _ tipo: String) {
        var arr = (defaults.array(forKey: "geopush.eventos") as? [[String: Any]]) ?? []
        arr.append(["zona": zona, "tipo": tipo, "ts": Int64(Date().timeIntervalSince1970 * 1000)])
        if arr.count > maxEventos { arr.removeFirst(arr.count - maxEventos) }
        defaults.set(arr, forKey: "geopush.eventos")
    }

    func eventos(limpiar: Bool) -> [[String: Any]] {
        let arr = (defaults.array(forKey: "geopush.eventos") as? [[String: Any]]) ?? []
        if limpiar { defaults.set([], forKey: "geopush.eventos") }
        return arr
    }
}
