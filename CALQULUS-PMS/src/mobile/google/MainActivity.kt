package com.calqulusrms.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.calqulusrms.app.ui.theme.CALQULUS RMSTheme
import com.calqulusrms.app.ui.auth.AuthViewModel
import com.calqulusrms.app.ui.auth.AuthView
import com.calqulusrms.app.ui.dashboard.DashboardView
import com.calqulusrms.app.ui.properties.PropertiesView
import com.calqulusrms.app.ui.tenants.TenantsView
import com.calqulusrms.app.ui.maintenance.MaintenanceView
import com.calqulusrms.app.ui.profile.ProfileView

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setContent {
            CALQULUS RMSTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    CALQULUS RMSApp()
                }
            }
        }
    }
}

@Composable
fun CALQULUS RMSApp() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = viewModel()
    var isAuthenticated by remember { mutableStateOf(authViewModel.isAuthenticated) }
    
    NavHost(
        navController = navController,
        startDestination = if (isAuthenticated) "dashboard" else "auth"
    ) {
        composable("auth") {
            AuthView(
                onAuthSuccess = {
                    isAuthenticated = true
                    navController.navigate("dashboard") {
                        popUpTo("auth") { inclusive = true }
                    }
                }
            )
        }
        
        composable("dashboard") {
            MainTabView(
                navController = navController,
                onSignOut = {
                    authViewModel.signOut()
                    isAuthenticated = false
                    navController.navigate("auth") {
                        popUpTo("dashboard") { inclusive = true }
                    }
                }
            )
        }
    }
}

@Composable
fun MainTabView(
    navController: androidx.navigation.NavController,
    onSignOut: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    
    androidx.compose.material3.TabRow(
        selectedTabIndex = selectedTab
    ) {
        androidx.compose.material3.Tab(
            selected = selectedTab == 0,
            onClick = { selectedTab = 0 },
            text = { androidx.compose.material3.Text("Dashboard") },
            icon = { androidx.compose.material.Icon(Icons.Default.Home, contentDescription = null) }
        )
        androidx.compose.material3.Tab(
            selected = selectedTab == 1,
            onClick = { selectedTab = 1 },
            text = { androidx.compose.material3.Text("Properties") },
            icon = { androidx.compose.material3.Icon(Icons.Default.Business, contentDescription = null) }
        )
        androidx.compose.material3.Tab(
            selected = selectedTab == 2,
            onClick = { selectedTab = 2 },
            text = { androidx.compose.material3.Text("Tenants") },
            icon = { androidx.compose.material3.Icon(Icons.Default.People, contentDescription = null) }
        )
        androidx.compose.material3.Tab(
            selected = selectedTab == 3,
            onClick = { selectedTab = 3 },
            text = { androidx.compose.material3.Text("Maintenance") },
            icon = { androidx.compose.material3.Icon(Icons.Default.Build, contentDescription = null) }
        )
        androidx.compose.material3.Tab(
            selected = selectedTab == 4,
            onClick = { selectedTab = 4 },
            text = { androidx.compose.material3.Text("Profile") },
            icon = { androidx.compose.material3.Icon(Icons.Default.Person, contentDescription = null) }
        )
    }
    
    when (selectedTab) {
        0 -> DashboardView()
        1 -> PropertiesView()
        2 -> TenantsView()
        3 -> MaintenanceView()
        4 -> ProfileView(onSignOut = onSignOut)
    }
}
