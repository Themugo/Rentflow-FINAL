import SwiftUI
import BackgroundTasks
import CoreData

class BackgroundTaskManager: ObservableObject {
    static let shared = BackgroundTaskManager()
    
    private let syncTaskIdentifier = "com.calqulusrms.sync"
    private let locationTaskIdentifier = "com.calqulusrms.location"
    private let notificationTaskIdentifier = "com.calqulusrms.notifications"
    
    @Published var lastSyncDate: Date?
    @Published var syncStatus: SyncStatus = .idle
    
    private init() {
        registerBackgroundTasks()
    }
    
    func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: syncTaskIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleSyncTask(task as! BGProcessingTask)
        }
        
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: locationTaskIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleLocationTask(task as! BGAppRefreshTask)
        }
        
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: notificationTaskIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleNotificationTask(task as! BGAppRefreshTask)
        }
    }
    
    func scheduleSyncTask() {
        let request = BGProcessingTaskRequest(identifier: syncTaskIdentifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("Sync task scheduled")
        } catch {
            print("Error scheduling sync task: \(error)")
        }
    }
    
    func scheduleLocationTask() {
        let request = BGAppRefreshTaskRequest(identifier: locationTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60) // 5 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("Location task scheduled")
        } catch {
            print("Error scheduling location task: \(error)")
        }
    }
    
    func scheduleNotificationTask() {
        let request = BGAppRefreshTaskRequest(identifier: notificationTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("Notification task scheduled")
        } catch {
            print("Error scheduling notification task: \(error)")
        }
    }
    
    private func handleSyncTask(_ task: BGProcessingTask) {
        syncStatus = .syncing
        
        Task {
            await performSync()
            
            task.setTaskCompleted(success: true)
            
            DispatchQueue.main.async {
                self.syncStatus = .completed
                self.lastSyncDate = Date()
                self.scheduleSyncTask()
            }
        }
    }
    
    private func handleLocationTask(_ task: BGAppRefreshTask) {
        Task {
            await syncLocationData()
            
            task.setTaskCompleted(success: true)
            
            DispatchQueue.main.async {
                self.scheduleLocationTask()
            }
        }
    }
    
    private func handleNotificationTask(_ task: BGAppRefreshTask) {
        Task {
            await checkAndSendNotifications()
            
            task.setTaskCompleted(success: true)
            
            DispatchQueue.main.async {
                self.scheduleNotificationTask()
            }
        }
    }
    
    private func performSync() async {
        // Sync data with backend
        do {
            try await APIClient.shared.syncData()
        } catch {
            print("Error syncing data: \(error)")
        }
    }
    
    private func syncLocationData() async {
        // Sync location data with backend
        do {
            try await APIClient.shared.syncLocationData()
        } catch {
            print("Error syncing location data: \(error)")
        }
    }
    
    private func checkAndSendNotifications() async {
        // Check for pending notifications and send them
        do {
            let notifications = try await APIClient.shared.getPendingNotifications()
            
            for notification in notifications {
                NotificationManager.shared.sendNotification(
                    title: notification.title,
                    body: notification.body
                )
            }
        } catch {
            print("Error checking notifications: \(error)")
        }
    }
}

enum SyncStatus {
    case idle
    case syncing
    case completed
    case failed
}
