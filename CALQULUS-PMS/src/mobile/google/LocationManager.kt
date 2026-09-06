package com.calqulusrms.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class LocationManager(private val context: Context) {
    private val fusedLocationClient: FusedLocationProviderClient = 
        LocationServices.getFusedLocationProviderClient(context)
    
    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let { location ->
                onLocationUpdate?.invoke(location)
            }
        }
    }
    
    var onLocationUpdate: ((Location) -> Unit)? = null
        private set
    
    var currentLocation: Location? = null
        private set
    
    var isTracking = false
        private set
    
    val visitedLocations = mutableListOf<Location>()
    
    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    fun requestLocationUpdates() {
        if (!hasLocationPermission()) {
            return
        }
        
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000)
            .setMinUpdateIntervalMillis(5000)
            .setMinUpdateDistanceMeters(10f)
            .build()
        
        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            null
        )
        
        isTracking = true
    }
    
    fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        isTracking = false
    }
    
    suspend fun getCurrentLocation(): Location? {
        if (!hasLocationPermission()) {
            return null
        }
        
        return try {
            fusedLocationClient.lastLocation.await()
        } catch (e: Exception) {
            null
        }
    }
    
    fun getLocationUpdates(): Flow<Location> = callbackFlow {
        if (!hasLocationPermission()) {
            close()
            return@callbackFlow
        }
        
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000)
            .setMinUpdateIntervalMillis(5000)
            .setMinUpdateDistanceMeters(10f)
            .build()
        
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    trySend(location)
                }
            }
        }
        
        fusedLocationClient.requestLocationUpdates(locationRequest, callback, null)
        
        awaitClose {
            fusedLocationClient.removeLocationUpdates(callback)
        }
    }
    
    fun calculateDistance(destination: android.location.Location): Float? {
        val current = currentLocation ?: return null
        return current.distanceTo(destination)
    }
    
    fun addGeofence(
        latitude: Double,
        longitude: Double,
        radius: Float,
        geofenceId: String
    ) {
        // In production, this would use the GeofencingClient
        // For now, we'll simulate it
    }
    
    fun removeGeofence(geofenceId: String) {
        // In production, this would use the GeofencingClient
        // For now, we'll simulate it
    }
}

suspend fun FusedLocationProviderClient.lastLocation(): Location? = 
    suspendCancellableCoroutine { continuation ->
        lastLocation.addOnSuccessListener { location ->
            continuation.resume(location)
        }.addOnFailureListener { e ->
            continuation.resume(null)
        }
    }
