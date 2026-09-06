package com.calqulusrms.app

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class BackgroundTaskManager(private val context: Context) {
    private val workManager = WorkManager.getInstance(context)
    
    companion object {
        private const val SYNC_WORK_NAME = "calqulusrms_sync"
        private const val LOCATION_WORK_NAME = "calqulusrms_location"
        private const val NOTIFICATION_WORK_NAME = "calqulusrms_notifications"
    }
    
    fun scheduleSyncTask() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
        
        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
            15, // repeat interval (minutes)
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .build()
        
        workManager.enqueueUniquePeriodicWork(
            SYNC_WORK_NAME,
            ExistingPeriodicWorkPolicy.REPLACE,
            syncRequest
        )
    }
    
    fun scheduleLocationTask() {
        val locationRequest = PeriodicWorkRequestBuilder<LocationWorker>(
            5, // repeat interval (minutes)
            TimeUnit.MINUTES
        ).build()
        
        workManager.enqueueUniquePeriodicWork(
            LOCATION_WORK_NAME,
            ExistingPeriodicWorkPolicy.REPLACE,
            locationRequest
        )
    }
    
    fun scheduleNotificationTask() {
        val notificationRequest = PeriodicWorkRequestBuilder<NotificationWorker>(
            15, // repeat interval (minutes)
            TimeUnit.MINUTES
        ).build()
        
        workManager.enqueueUniquePeriodicWork(
            NOTIFICATION_WORK_NAME,
            ExistingPeriodicWorkPolicy.REPLACE,
            notificationRequest
        )
    }
    
    fun cancelAllTasks() {
        workManager.cancelAllWork()
    }
    
    fun cancelSyncTask() {
        workManager.cancelUniqueWork(SYNC_WORK_NAME)
    }
    
    fun cancelLocationTask() {
        workManager.cancelUniqueWork(LOCATION_WORK_NAME)
    }
    
    fun cancelNotificationTask() {
        workManager.cancelUniqueWork(NOTIFICATION_WORK_NAME)
    }
}

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        return try {
            withContext(Dispatchers.IO) {
                APIClient.syncData()
            }
            Result.success()
        } catch (e: Exception) {
            Result.failure()
        }
    }
}

class LocationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        return try {
            withContext(Dispatchers.IO) {
                APIClient.syncLocationData()
            }
            Result.success()
        } catch (e: Exception) {
            Result.failure()
        }
    }
}

class NotificationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        return try {
            withContext(Dispatchers.IO) {
                val notifications = APIClient.getPendingNotifications()
                
                for (notification in notifications) {
                    NotificationManager(applicationContext).sendNotification(
                        notification.title,
                        notification.body
                    )
                }
            }
            Result.success()
        } catch (e: Exception) {
            Result.failure()
        }
    }
}
