import SwiftUI
import CoreData
import Combine

class OfflineSyncManager: ObservableObject {
    static let shared = OfflineSyncManager()
    
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastSyncDate: Date?
    @Published var pendingChanges: Int = 0
    @Published var isOnline: Bool = true
    
    private let persistentContainer: NSPersistentContainer
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        persistentContainer = NSPersistentContainer(name: "CalqulusRMS")
        persistentContainer.loadPersistentStores { description, error in
            if let error = error {
                print("Core Data error: \(error)")
            }
        }
        
        setupNetworkMonitoring()
    }
    
    var viewContext: NSManagedObjectContext {
        return persistentContainer.viewContext
    }
    
    private func setupNetworkMonitoring() {
        // Monitor network connectivity
        // In production, this would use NWPathMonitor
        isOnline = true
    }
    
    func sync() async {
        guard isOnline else {
            syncStatus = .offline
            return
        }
        
        syncStatus = .syncing
        
        do {
            // Upload pending changes
            try await uploadPendingChanges()
            
            // Download latest data
            try await downloadLatestData()
            
            // Update sync status
            syncStatus = .completed
            lastSyncDate = Date()
            pendingChanges = 0
            
        } catch {
            syncStatus = .failed
            print("Sync error: \(error)")
        }
    }
    
    private func uploadPendingChanges() async throws {
        let pendingChanges = fetchPendingChanges()
        
        for change in pendingChanges {
            try await APIClient.shared.uploadChange(change)
            
            // Mark as synced
            change.isSynced = true
        }
        
        try viewContext.save()
    }
    
    private func downloadLatestData() async throws {
        // Download properties
        let properties = try await APIClient.shared.getProperties()
        
        // Download tenants
        let tenants = try await APIClient.shared.getTenants()
        
        // Download maintenance requests
        let maintenanceRequests = try await APIClient.shared.getMaintenanceRequests()
        
        // Save to local database
        try saveProperties(properties)
        try saveTenants(tenants)
        try saveMaintenanceRequests(maintenanceRequests)
    }
    
    private func fetchPendingChanges() -> [NSManagedObject] {
        let request = NSFetchRequest<NSManagedObject>(entityName: "PendingChange")
        request.predicate = NSPredicate(format: "isSynced == NO")
        
        return try? viewContext.fetch(request) ?? []
    }
    
    private func saveProperties(_ properties: [Property]) throws {
        let fetchRequest = NSFetchRequest<NSManagedObject>(entityName: "Property")
        let existingProperties = try? viewContext.fetch(fetchRequest)
        
        for property in properties {
            if let existing = existingProperties?.first(where: { ($0.value(forKey: "id") as? String) == property.id }) {
                // Update existing
                existing.setValue(property.name, forKey: "name")
                existing.setValue(property.address, forKey: "address")
                existing.setValue(property.units, forKey: "units")
            } else {
                // Create new
                let entity = NSEntityDescription.insertNewObject(forEntityName: "Property", into: viewContext)
                entity.setValue(property.id, forKey: "id")
                entity.setValue(property.name, forKey: "name")
                entity.setValue(property.address, forKey: "address")
                entity.setValue(property.units, forKey: "units")
            }
        }
        
        try viewContext.save()
    }
    
    private func saveTenants(_ tenants: [Tenant]) throws {
        let fetchRequest = NSFetchRequest<NSManagedObject>(entityName: "Tenant")
        let existingTenants = try? viewContext.fetch(fetchRequest)
        
        for tenant in tenants {
            if let existing = existingTenants?.first(where: { ($0.value(forKey: "id") as? String) == tenant.id }) {
                // Update existing
                existing.setValue(tenant.name, forKey: "name")
                existing.setValue(tenant.email, forKey: "email")
                existing.setValue(tenant.unitId, forKey: "unitId")
            } else {
                // Create new
                let entity = NSEntityDescription.insertNewObject(forEntityName: "Tenant", into: viewContext)
                entity.setValue(tenant.id, forKey: "id")
                entity.setValue(tenant.name, forKey: "name")
                entity.setValue(tenant.email, forKey: "email")
                entity.setValue(tenant.unitId, forKey: "unitId")
            }
        }
        
        try viewContext.save()
    }
    
    private func saveMaintenanceRequests(_ requests: [MaintenanceRequest]) throws {
        let fetchRequest = NSFetchRequest<NSManagedObject>(entityName: "MaintenanceRequest")
        let existingRequests = try? viewContext.fetch(fetchRequest)
        
        for request in requests {
            if let existing = existingRequests?.first(where: { ($0.value(forKey: "id") as? String) == request.id }) {
                // Update existing
                existing.setValue(request.title, forKey: "title")
                existing.setValue(request.description, forKey: "description")
                existing.setValue(request.status, forKey: "status")
            } else {
                // Create new
                let entity = NSEntityDescription.insertNewObject(forEntityName: "MaintenanceRequest", into: viewContext)
                entity.setValue(request.id, forKey: "id")
                entity.setValue(request.title, forKey: "title")
                entity.setValue(request.description, forKey: "description")
                entity.setValue(request.status, forKey: "status")
            }
        }
        
        try viewContext.save()
    }
    
    func addPendingChange(type: String, data: Data) {
        let entity = NSEntityDescription.insertNewObject(forEntityName: "PendingChange", into: viewContext)
        entity.setValue(UUID().uuidString, forKey: "id")
        entity.setValue(type, forKey: "type")
        entity.setValue(data, forKey: "data")
        entity.setValue(false, forKey: "isSynced")
        entity.setValue(Date(), forKey: "createdAt")
        
        do {
            try viewContext.save()
            pendingChanges += 1
        } catch {
            print("Error saving pending change: \(error)")
        }
    }
    
    func getLocalProperties() -> [Property] {
        let fetchRequest = NSFetchRequest<NSManagedObject>(entityName: "Property")
        
        guard let entities = try? viewContext.fetch(fetchRequest) else {
            return []
        }
        
        return entities.compactMap { entity in
            guard let id = entity.value(forKey: "id") as? String,
                  let name = entity.value(forKey: "name") as? String,
                  let address = entity.value(forKey: "address") as? String,
                  let units = entity.value(forKey: "units") as? Int else {
                return nil
            }
            
            return Property(id: id, name: name, address: address, units: units)
        }
    }
    
    func getLocalTenants() -> [Tenant] {
        let fetchRequest = NSFetchRequest<NSManagedObject>(entityName: "Tenant")
        
        guard let entities = try? viewContext.fetch(fetchRequest) else {
            return []
        }
        
        return entities.compactMap { entity in
            guard let id = entity.value(forKey: "id") as? String,
                  let name = entity.value(forKey: "name") as? String,
                  let email = entity.value(forKey: "email") as? String,
                  let unitId = entity.value(forKey: "unitId") as? String else {
                return nil
            }
            
            return Tenant(id: id, name: name, email: email, unitId: unitId)
        }
    }
}

enum SyncStatus {
    case idle
    case syncing
    case completed
    case failed
    case offline
}

struct Property: Codable {
    let id: String
    let name: String
    let address: String
    let units: Int
}

struct Tenant: Codable {
    let id: String
    let name: String
    let email: String
    let unitId: String
}

struct MaintenanceRequest: Codable {
    let id: String
    let title: String
    let description: String
    let status: String
}
