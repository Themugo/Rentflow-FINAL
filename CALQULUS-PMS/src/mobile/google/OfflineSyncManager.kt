package com.calqulusrms.app

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext

class OfflineSyncManager private constructor(private val context: Context) {
    private val database: CALQULUS RMSDatabase = Room.databaseBuilder(
        context,
        CALQULUS RMSDatabase::class.java,
        "calqulusrms.db"
    ).build()
    
    private val _syncStatus = MutableStateFlow<SyncStatus>(SyncStatus.Idle)
    val syncStatus: StateFlow<SyncStatus> = _syncStatus
    
    private val _lastSyncDate = MutableStateFlow<Date?>(null)
    val lastSyncDate: StateFlow<Date?> = _lastSyncDate
    
    private val _pendingChanges = MutableStateFlow(0)
    val pendingChanges: StateFlow<Int> = _pendingChanges
    
    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline
    
    companion object {
        @Volatile
        private var instance: OfflineSyncManager? = null
        
        fun getInstance(context: Context): OfflineSyncManager {
            return instance ?: synchronized(this) {
                instance ?: OfflineSyncManager(context).also { instance = it }
            }
        }
    }
    
    suspend fun sync() {
        if (!_isOnline.value) {
            _syncStatus.value = SyncStatus.Offline
            return
        }
        
        _syncStatus.value = SyncStatus.Syncing
        
        try {
            // Upload pending changes
            uploadPendingChanges()
            
            // Download latest data
            downloadLatestData()
            
            // Update sync status
            _syncStatus.value = SyncStatus.Completed
            _lastSyncDate.value = Date()
            _pendingChanges.value = 0
            
        } catch (e: Exception) {
            _syncStatus.value = SyncStatus.Failed
            println("Sync error: ${e.message}")
        }
    }
    
    private suspend fun uploadPendingChanges() {
        val pendingChanges = database.pendingChangeDao().getPendingChanges()
        
        for (change in pendingChanges) {
            APIClient.uploadChange(change)
            
            // Mark as synced
            change.isSynced = true
            database.pendingChangeDao().update(change)
        }
    }
    
    private suspend fun downloadLatestData() {
        // Download properties
        val properties = APIClient.getProperties()
        
        // Download tenants
        val tenants = APIClient.getTenants()
        
        // Download maintenance requests
        val maintenanceRequests = APIClient.getMaintenanceRequests()
        
        // Save to local database
        saveProperties(properties)
        saveTenants(tenants)
        saveMaintenanceRequests(maintenanceRequests)
    }
    
    private suspend fun saveProperties(properties: List<Property>) {
        val existingProperties = database.propertyDao().getAll()
        
        for (property in properties) {
            val existing = existingProperties.find { it.id == property.id }
            
            if (existing != null) {
                // Update existing
                existing.name = property.name
                existing.address = property.address
                existing.units = property.units
                database.propertyDao().update(existing)
            } else {
                // Create new
                database.propertyDao().insert(property)
            }
        }
    }
    
    private suspend fun saveTenants(tenants: List<Tenant>) {
        val existingTenants = database.tenantDao().getAll()
        
        for (tenant in tenants) {
            val existing = existingTenants.find { it.id == tenant.id }
            
            if (existing != null) {
                // Update existing
                existing.name = tenant.name
                existing.email = tenant.email
                existing.unitId = tenant.unitId
                database.tenantDao().update(existing)
            } else {
                // Create new
                database.tenantDao().insert(tenant)
            }
        }
    }
    
    private suspend fun saveMaintenanceRequests(requests: List<MaintenanceRequest>) {
        val existingRequests = database.maintenanceRequestDao().getAll()
        
        for (request in requests) {
            val existing = existingRequests.find { it.id == request.id }
            
            if (existing != null) {
                // Update existing
                existing.title = request.title
                existing.description = request.description
                existing.status = request.status
                database.maintenanceRequestDao().update(existing)
            } else {
                // Create new
                database.maintenanceRequestDao().insert(request)
            }
        }
    }
    
    suspend fun addPendingChange(type: String, data: String) {
        val change = PendingChange(
            id = java.util.UUID.randomUUID().toString(),
            type = type,
            data = data,
            isSynced = false,
            createdAt = System.currentTimeMillis()
        )
        
        database.pendingChangeDao().insert(change)
        _pendingChanges.value = database.pendingChangeDao().getPendingChangesCount()
    }
    
    suspend fun getLocalProperties(): List<Property> {
        return database.propertyDao().getAll()
    }
    
    suspend fun getLocalTenants(): List<Tenant> {
        return database.tenantDao().getAll()
    }
    
    suspend fun getLocalMaintenanceRequests(): List<MaintenanceRequest> {
        return database.maintenanceRequestDao().getAll()
    }
    
    fun setOnlineStatus(online: Boolean) {
        _isOnline.value = online
    }
}

enum class SyncStatus {
    Idle,
    Syncing,
    Completed,
    Failed,
    Offline
}

// Room Database
@androidx.room.Database(
    entities = [
        Property::class,
        Tenant::class,
        MaintenanceRequest::class,
        PendingChange::class
    ],
    version = 1
)
abstract class CALQULUS RMSDatabase : RoomDatabase() {
    abstract fun propertyDao(): PropertyDao
    abstract fun tenantDao(): TenantDao
    abstract fun maintenanceRequestDao(): MaintenanceRequestDao
    abstract fun pendingChangeDao(): PendingChangeDao
}

// Entities
@androidx.room.Entity(tableName = "properties")
data class Property(
    @androidx.room.PrimaryKey val id: String,
    val name: String,
    val address: String,
    val units: Int
)

@androidx.room.Entity(tableName = "tenants")
data class Tenant(
    @androidx.room.PrimaryKey val id: String,
    val name: String,
    val email: String,
    val unitId: String
)

@androidx.room.Entity(tableName = "maintenance_requests")
data class MaintenanceRequest(
    @androidx.room.PrimaryKey val id: String,
    val title: String,
    val description: String,
    val status: String
)

@androidx.room.Entity(tableName = "pending_changes")
data class PendingChange(
    @androidx.room.PrimaryKey val id: String,
    val type: String,
    val data: String,
    var isSynced: Boolean = false,
    val createdAt: Long
)

// DAOs
@androidx.room.Dao
interface PropertyDao {
    @androidx.room.Query("SELECT * FROM properties")
    suspend fun getAll(): List<Property>
    
    @androidx.room.Insert
    suspend fun insert(property: Property)
    
    @androidx.room.Update
    suspend fun update(property: Property)
    
    @androidx.room.Delete
    suspend fun delete(property: Property)
}

@androidx.room.Dao
interface TenantDao {
    @androidx.room.Query("SELECT * FROM tenants")
    suspend fun getAll(): List<Tenant>
    
    @androidx.room.Insert
    suspend fun insert(tenant: Tenant)
    
    @androidx.room.Update
    suspend fun update(tenant: Tenant)
    
    @androidx.room.Delete
    suspend fun delete(tenant: Tenant)
}

@androidx.room.Dao
interface MaintenanceRequestDao {
    @androidx.room.Query("SELECT * FROM maintenance_requests")
    suspend fun getAll(): List<MaintenanceRequest>
    
    @androidx.room.Insert
    suspend fun insert(request: MaintenanceRequest)
    
    @androidx.room.Update
    suspend fun update(request: MaintenanceRequest)
    
    @androidx.room.Delete
    suspend fun delete(request: MaintenanceRequest)
}

@androidx.room.Dao
interface PendingChangeDao {
    @androidx.room.Query("SELECT * FROM pending_changes WHERE isSynced = 0")
    suspend fun getPendingChanges(): List<PendingChange>
    
    @androidx.room.Query("SELECT COUNT(*) FROM pending_changes WHERE isSynced = 0")
    suspend fun getPendingChangesCount(): Int
    
    @androidx.room.Insert
    suspend fun insert(change: PendingChange)
    
    @androidx.room.Update
    suspend fun update(change: PendingChange)
    
    @androidx.room.Delete
    suspend fun delete(change: PendingChange)
}
