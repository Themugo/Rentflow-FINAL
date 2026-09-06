import SwiftUI

@main
struct CalqulusRMSApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var locationManager = LocationManager()
    @StateObject private var notificationManager = NotificationManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(locationManager)
                .environmentObject(notificationManager)
                .onAppear {
                    setupApp()
                }
        }
    }
    
    private func setupApp() {
        // Initialize app services
        notificationManager.requestAuthorization()
        locationManager.requestAuthorization()
        authManager.checkSession()
    }
}

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    
    var body: some View {
        if authManager.isAuthenticated {
            MainTabView()
        } else {
            AuthView()
        }
    }
}

struct MainTabView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "house.fill")
                }
                .tag(0)
            
            PropertiesView()
                .tabItem {
                    Label("Properties", systemImage: "building.2.fill")
                }
                .tag(1)
            
            TenantsView()
                .tabItem {
                    Label("Tenants", systemImage: "person.2.fill")
                }
                .tag(2)
            
            MaintenanceView()
                .tabItem {
                    Label("Maintenance", systemImage: "wrench.fill")
                }
                .tag(3)
            
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
                .tag(4)
        }
    }
}
