package com.calqulusrms.app

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.IvParameterSpec

class AuthManager(private val context: Context) {
    private val sharedPrefs: SharedPreferences = context.getSharedPreferences("CALQULUS RMSAuth", Context.MODE_PRIVATE)
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    
    var isAuthenticated: Boolean = false
        private set
    
    var currentUser: User? = null
        private set
    
    init {
        checkSession()
    }
    
    fun checkSession() {
        val token = sharedPrefs.getString("auth_token", null)
        if (token != null) {
            // Validate token with backend
            validateToken(token)
        } else {
            isAuthenticated = false
        }
    }
    
    suspend fun signIn(email: String, password: String): Result<User> {
        return try {
            val response = withContext(Dispatchers.IO) {
                APIClient.signIn(email, password)
            }
            
            if (response.accessToken != null) {
                sharedPrefs.edit()
                    .putString("auth_token", response.accessToken)
                    .apply()
                
                currentUser = response.user
                isAuthenticated = true
                Result.success(response.user)
            } else {
                Result.failure(Exception("Authentication failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun signUp(email: String, password: String): Result<User> {
        return try {
            val response = withContext(Dispatchers.IO) {
                APIClient.signUp(email, password)
            }
            
            if (response.accessToken != null) {
                sharedPrefs.edit()
                    .putString("auth_token", response.accessToken)
                    .apply()
                
                currentUser = response.user
                isAuthenticated = true
                Result.success(response.user)
            } else {
                Result.failure(Exception("Registration failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun signOut() {
        sharedPrefs.edit()
            .remove("auth_token")
            .remove("user_email")
            .remove("user_password")
            .apply()
        
        currentUser = null
        isAuthenticated = false
    }
    
    fun authenticateWithBiometrics(
        activity: FragmentActivity,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val biometricManager = BiometricManager.from(context)
        
        when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("CALQULUS RMS Authentication")
                    .setSubtitle("Authenticate to access CALQULUS RMS")
                    .setNegativeButtonText("Cancel")
                    .build()
                
                val biometricPrompt = BiometricPrompt(
                    activity,
                    ContextCompat.getMainExecutor(context),
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            
                            // Check if user has saved credentials
                            val email = sharedPrefs.getString("user_email", null)
                            val password = sharedPrefs.getString("user_password", null)
                            
                            if (email != null && password != null) {
                                activity.lifecycleScope.launch {
                                    val result = signIn(email, password)
                                    if (result.isSuccess) {
                                        onSuccess()
                                    } else {
                                        onError(result.exceptionOrNull()?.message ?: "Authentication failed")
                                    }
                                }
                            } else {
                                onError("No saved credentials found")
                            }
                        }
                        
                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                            onError("Authentication failed")
                        }
                        
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            onError(errString.toString())
                        }
                    }
                )
                
                biometricPrompt.authenticate(promptInfo)
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                onError("Biometric hardware not available")
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                onError("No biometric credentials enrolled")
            }
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> {
                onError("Security update required")
            }
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> {
                onError("Biometric authentication not supported")
            }
            BiometricManager.BIOMETRIC_STATUS_UNKNOWN -> {
                onError("Unknown biometric status")
            }
        }
    }
    
    fun saveCredentials(email: String, password: String) {
        sharedPrefs.edit()
            .putString("user_email", email)
            .putString("user_password", password)
            .apply()
    }
    
    private fun validateToken(token: String) {
        // In production, this would validate the token with the backend
        // For now, we'll simulate it
        isAuthenticated = true
    }
}

data class User(
    val id: String,
    val email: String,
    val role: String,
    val name: String?
)

class AuthViewModel : ViewModel() {
    private lateinit var authManager: AuthManager
    
    val isAuthenticated: Boolean
        get() = authManager.isAuthenticated
    
    val currentUser: User?
        get() = authManager.currentUser
    
    fun init(context: Context) {
        authManager = AuthManager(context)
    }
    
    fun signOut() {
        authManager.signOut()
    }
}
