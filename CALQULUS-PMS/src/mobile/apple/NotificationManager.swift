import SwiftUI
import UserNotifications

class NotificationManager: ObservableObject, Observable {
    static let shared = NotificationManager()
    
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var notifications: [UNNotification] = []
    
    private let notificationCenter = UNUserNotificationCenter.current()
    
    private init() {
        notificationCenter.delegate = self
        notificationCenter.getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.authorizationStatus = settings.authorizationStatus
            }
        }
    }
    
    func requestAuthorization() {
        let options: UNAuthorizationOptions = [.alert, .sound, .badge]
        notificationCenter.requestAuthorization(options: options) { granted, error in
            DispatchQueue.main.async {
                self.authorizationStatus = granted ? .authorized : .denied
            }
        }
    }
    
    func sendNotification(title: String, body: String, delay: TimeInterval = 0) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = 1
        
        let trigger = delay > 0 ? UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false) : nil
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)
        
        notificationCenter.add(request) { error in
            if let error = error {
                print("Error sending notification: \(error)")
            }
        }
    }
    
    func scheduleNotification(
        title: String,
        body: String,
        date: Date,
        repeats: Bool = false
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = 1
        
        let dateComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: repeats)
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)
        
        notificationCenter.add(request) { error in
            if let error = error {
                print("Error scheduling notification: \(error)")
            }
        }
    }
    
    func cancelAllNotifications() {
        notificationCenter.removeAllPendingNotificationRequests()
        notificationCenter.removeAllDeliveredNotifications()
    }
    
    func getPendingNotifications() async -> [UNNotificationRequest] {
        return await notificationCenter.pendingNotificationRequests()
    }
    
    func getDeliveredNotifications() async -> [UNNotification] {
        return await notificationCenter.deliveredNotifications()
    }
    
    func registerForRemoteNotifications(deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("Device token: \(tokenString)")
        
        // In production, send this token to your backend
        Task {
            await APIClient.shared.registerDeviceToken(tokenString)
        }
    }
    
    func handleRemoteNotification(userInfo: [AnyHashable: Any]) {
        // Handle remote notification payload
        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: String] {
            let title = alert["title"] ?? "CALQULUS RMS"
            let body = alert["body"] ?? ""
            sendNotification(title: title, body: body)
        }
    }
}

extension NotificationManager: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Handle notification tap
        let userInfo = response.notification.request.content.userInfo
        handleNotificationTap(userInfo)
        completionHandler()
    }
    
    private func handleNotificationTap(_ userInfo: [AnyHashable: Any]) {
        // Navigate to appropriate screen based on notification type
        if let type = userInfo["type"] as? String {
            switch type {
            case "payment":
                // Navigate to payment screen
                break
            case "maintenance":
                // Navigate to maintenance screen
                break
            case "lease":
                // Navigate to lease screen
                break
            default:
                break
            }
        }
    }
}
