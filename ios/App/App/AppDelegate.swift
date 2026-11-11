import UIKit
import Capacitor
import FirebaseCore
import CapacitorGeopushLocal
import CoreLocation
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase (push del Club). Va en código y no en GoogleService-Info.plist
        // para no tener que sumar el archivo al proyecto de Xcode. App iOS
        // registrada en studio-7914495232-557f1 el 08-11-2026.
        if FirebaseApp.app() == nil {
            let opciones = FirebaseOptions(googleAppID: "1:120681935080:ios:229600f6a173297c6bd95d", gcmSenderID: "120681935080")
            opciones.apiKey = "AIzaSyApDXeYdRLOufzRlXtpaBJBXyjIZwfCKgo"
            opciones.projectID = "studio-7914495232-557f1"
            opciones.bundleID = Bundle.main.bundleIdentifier ?? "com.clubpatio.app"
            opciones.storageBucket = "studio-7914495232-557f1.firebasestorage.app"
            FirebaseApp.configure(options: opciones)
        }
        // Geocercas del aviso de llegada: el delegado tiene que existir ANTES de que
        // iOS entregue el evento cuando relanza la app por una región.
        #if targetEnvironment(simulator)
        GeoPushSim.shared.preparar(launchOptions)
        #endif
        GeoPushManager.shared.arrancar()
        #if targetEnvironment(simulator)
        GeoPushSim.shared.arrancarVolcado()
        #endif
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name.init("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - SOLO rama test/geopush-sim (nunca a main): ganchos para probar el
// aviso de llegada en el simulador de iOS desde Codemagic. No toca la lógica de
// GeoPushManager: siembra la config por variable de entorno y vuelca el estado
// (permiso, regiones monitoreadas, avisos pendientes/entregados, bitácora).
#if targetEnvironment(simulator)
final class GeoPushSim: NSObject {
    static let shared = GeoPushSim()
    private let lm = CLLocationManager()
    private var timer: Timer?
    private var lineas = 0

    private var docs: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }

    func preparar(_ launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
        let env = ProcessInfo.processInfo.environment
        let porUbicacion = launchOptions?[.location] != nil
        let estado = UIApplication.shared.applicationState == .background ? "background" : "foreground/inactive"
        anotar("didFinishLaunching launchOptions.location=\(porUbicacion) estado=\(estado) claves=\((launchOptions ?? [:]).keys.map { $0.rawValue })")
        if env["GP_RESET_EVENTOS"] == "1" {
            UserDefaults.standard.removeObject(forKey: "geopush.eventos")
            anotar("bitacora geopush.eventos borrada")
        }
        if let cfg = env["GP_CONFIG"], let data = cfg.data(using: .utf8) {
            UserDefaults.standard.set(data, forKey: "geopush.config")
            anotar("config sembrada: \(cfg)")
        }
    }

    func arrancarVolcado() {
        if ProcessInfo.processInfo.environment["GP_PROVISIONAL"] == "1" {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge, .provisional]) { ok, err in
                self.anotar("permiso de avisos (provisional) ok=\(ok) err=\(err?.localizedDescription ?? "-")")
            }
        }
        volcar("arranque")
        DispatchQueue.main.async {
            self.timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in self?.volcar("tick") }
        }
    }

    private func anotar(_ msg: String) {
        let linea = "\(ISO8601DateFormatter().string(from: Date())) \(msg)"
        NSLog("[GeoPushSim] %@", msg)
        let url = docs.appendingPathComponent("geopush-sim.log")
        if let h = try? FileHandle(forWritingTo: url) {
            h.seekToEndOfFile(); h.write((linea + "\n").data(using: .utf8)!); h.closeFile()
        } else {
            try? (linea + "\n").write(to: url, atomically: true, encoding: .utf8)
        }
    }

    func volcar(_ motivo: String) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { s in
            center.getPendingNotificationRequests { pend in
                center.getDeliveredNotifications { entr in
                    DispatchQueue.main.async {
                        let auth: String
                        switch self.lm.authorizationStatus {
                        case .authorizedAlways: auth = "always"
                        case .authorizedWhenInUse: auth = "whenInUse"
                        case .denied: auth = "denied"
                        case .restricted: auth = "restricted"
                        default: auth = "notDetermined"
                        }
                        let avisos: String
                        switch s.authorizationStatus {
                        case .authorized: avisos = "authorized"
                        case .provisional: avisos = "provisional"
                        case .denied: avisos = "denied"
                        case .notDetermined: avisos = "notDetermined"
                        default: avisos = "otro"
                        }
                        let regiones = self.lm.monitoredRegions.map { r -> String in
                            if let c = r as? CLCircularRegion { return "\(c.identifier)@\(c.center.latitude),\(c.center.longitude)r\(Int(c.radius))" }
                            return r.identifier
                        }.sorted()
                        let pendientes = pend.map { "\($0.identifier)[\($0.trigger.map { String(describing: type(of: $0)) } ?? "inmediato")]" }
                        let entregados = entr.map { "\($0.request.identifier)|\($0.request.content.title)|\(ISO8601DateFormatter().string(from: $0.date))" }
                        let eventos = (UserDefaults.standard.array(forKey: "geopush.eventos") as? [[String: Any]]) ?? []
                        let app = UIApplication.shared.applicationState == .active ? "active" : (UIApplication.shared.applicationState == .background ? "background" : "inactive")
                        let dic: [String: Any] = [
                            "motivo": motivo, "ts": ISO8601DateFormatter().string(from: Date()), "app": app,
                            "ubicacion": auth, "avisos": avisos, "regiones": regiones,
                            "pendientes": pendientes, "entregados": entregados, "eventos": eventos
                        ]
                        if let data = try? JSONSerialization.data(withJSONObject: dic, options: [.prettyPrinted, .sortedKeys]) {
                            try? data.write(to: self.docs.appendingPathComponent("geopush-sim.json"))
                        }
                        self.lineas += 1
                        if motivo != "tick" || self.lineas % 2 == 0 {
                            self.anotar("estado[\(motivo)] app=\(app) ubicacion=\(auth) avisos=\(avisos) regiones=\(regiones) pendientes=\(pendientes) entregados=\(entregados) eventos=\(eventos)")
                        }
                    }
                }
            }
        }
    }
}
#endif
