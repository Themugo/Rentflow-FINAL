package com.calqulusrms.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class NotificationManager(private val context: Context) {
    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    
    companion object {
        private const val CHANNEL_ID = "calqulusrms_channel"
        private const val CHANNEL_NAME = "CALQULUS RMS Notifications"
        private const val CHANNEL_DESCRIPTION = "Notifications for CALQULUS RMS app"
    }
    
    init {
        createNotificationChannel()
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
            }
            
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    fun sendNotification(
        title: String,
        body: String,
        notificationId: Int = System.currentTimeMillis().toInt()
    ) {
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        
        notificationManager.notify(notificationId, notification)
    }
    
    fun scheduleNotification(
        title: String,
        body: String,
        delayMillis: Long
    ) {
        // In production, this would use AlarmManager or WorkManager
        // For now, we'll simulate it
    }
    
    fun cancelAllNotifications() {
        notificationManager.cancelAll()
    }
    
    fun cancelNotification(notificationId: Int) {
        notificationManager.cancel(notificationId)
    }
    
    fun registerDeviceToken(token: String) {
        // Send device token to backend
        // In production, this would call the API
    }
}

class CALQULUS RMSFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        
        // Send new token to backend
        NotificationManager(this).registerDeviceToken(token)
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        val title = remoteMessage.notification?.title ?: "CALQULUS RMS"
        val body = remoteMessage.notification?.body ?: ""
        
        NotificationManager(this).sendNotification(title, body)
    }
}
