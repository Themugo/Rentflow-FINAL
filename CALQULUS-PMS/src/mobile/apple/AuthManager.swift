import SwiftUI
import LocalAuthentication
import Security

class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let keychain = Keychain()
    
    init() {
        checkSession()
    }
    
    func checkSession() {
        isLoading = true
        if let token = keychain.get(key: "auth_token") {
            // Validate token with backend
            validateToken(token)
        } else {
            isAuthenticated = false
            isLoading = false
        }
    }
    
    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            // In production, this would call the Supabase auth API
            let response = try await APIClient.shared.signIn(email: email, password: password)
            
            if let token = response.accessToken {
                keychain.set(key: "auth_token", value: token)
                currentUser = response.user
                isAuthenticated = true
            }
        } catch {
            errorMessage = error.localizedDescription
            isAuthenticated = false
        }
        
        isLoading = false
    }
    
    func signUp(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            // In production, this would call the Supabase auth API
            let response = try await APIClient.shared.signUp(email: email, password: password)
            
            if let token = response.accessToken {
                keychain.set(key: "auth_token", value: token)
                currentUser = response.user
                isAuthenticated = true
            }
        } catch {
            errorMessage = error.localizedDescription
            isAuthenticated = false
        }
        
        isLoading = false
    }
    
    func signOut() {
        keychain.delete(key: "auth_token")
        currentUser = nil
        isAuthenticated = false
    }
    
    func authenticateWithBiometrics() async -> Bool {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            errorMessage = "Biometric authentication not available"
            return false
        }
        
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Authenticate to access CALQULUS RMS"
            )
            
            if success {
                // Check if user has saved credentials
                if let email = keychain.get(key: "user_email"),
                   let password = keychain.get(key: "user_password") {
                    await signIn(email: email, password: password)
                    return true
                }
            }
            
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
    
    func saveCredentials(email: String, password: String) {
        keychain.set(key: "user_email", value: email)
        keychain.set(key: "user_password", value: password)
    }
    
    private func validateToken(_ token: String) {
        // In production, this would validate the token with the backend
        // For now, we'll simulate it
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.isAuthenticated = true
            self.isLoading = false
        }
    }
}

struct User: Codable {
    let id: String
    let email: String
    let role: String
    let name: String?
}

// Keychain wrapper
class Keychain {
    func set(key: String, value: String) {
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess, let data = result as? Data {
            return String(data: data, encoding: .utf8)
        }
        
        return nil
    }
    
    func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}
