package com.calqulusrms.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraManager(private val context: Context) {
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null
    private var preview: Preview? = null
    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    
    var isCameraAvailable = false
        private set
    
    var isFlashAvailable = false
        private set
    
    var isFlashOn = false
        private set
    
    var lensFacing = CameraSelector.LENS_FACING_BACK
        private set
    
    fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    suspend fun startCamera(
        lifecycleOwner: LifecycleOwner,
        previewView: androidx.camera.view.PreviewView
    ): Boolean {
        return try {
            cameraProvider = ProcessCameraProvider.getInstance(context).await()
            isCameraAvailable = true
            
            preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }
            
            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()
            
            val cameraSelector = CameraSelector.Builder()
                .requireLensFacing(lensFacing)
                .build()
            
            cameraProvider?.unbindAll()
            
            cameraProvider?.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                preview,
                imageCapture
            )
            
            // Check flash availability
            val cameraInfo = cameraProvider?.availableCameraInfos?.firstOrNull()
            isFlashAvailable = cameraInfo?.hasFlashUnit() == true
            
            true
        } catch (e: Exception) {
            false
        }
    }
    
    fun stopCamera() {
        cameraProvider?.unbindAll()
        cameraExecutor.shutdown()
    }
    
    fun switchCamera() {
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }
    }
    
    fun toggleFlash() {
        if (!isFlashAvailable) return
        
        isFlashOn = !isFlashOn
        
        imageCapture?.flashMode = if (isFlashOn) {
            ImageCapture.FLASH_MODE_ON
        } else {
            ImageCapture.FLASH_MODE_OFF
        }
    }
    
    suspend fun capturePhoto(): File? = suspendCancellableCoroutine { continuation ->
        val imageCapture = imageCapture ?: run {
            continuation.resume(null)
            return@suspendCancellableCoroutine
        }
        
        val photoFile = File(
            context.cacheDir,
            "photo_${System.currentTimeMillis()}.jpg"
        )
        
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()
        
        imageCapture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    continuation.resume(photoFile)
                }
                
                override fun onError(exception: ImageCaptureException) {
                    continuation.resume(null)
                }
            }
        )
    }
    
    fun savePhotoToLibrary(photoFile: File) {
        // In production, this would save the photo to the device's photo library
        // For now, we'll simulate it
    }
}

suspend fun ProcessCameraProvider.await(): ProcessCameraProvider = 
    suspendCancellableCoroutine { continuation ->
        getAsync { continuation.resume(it) }
    }
