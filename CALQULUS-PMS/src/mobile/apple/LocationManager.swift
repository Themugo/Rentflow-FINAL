import SwiftUI
import CoreLocation
import MapKit

class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    
    @Published var location: CLLocation?
    @Published var region: CLRegion?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var isTracking = false
    @Published var visitedLocations: [CLLocation] = []
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10
    }
    
    func requestAuthorization() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestAlwaysAuthorization()
    }
    
    func startTracking() {
        isTracking = true
        locationManager.startUpdatingLocation()
        locationManager.startMonitoringSignificantLocationChanges()
    }
    
    func stopTracking() {
        isTracking = false
        locationManager.stopUpdatingLocation()
        locationManager.stopMonitoringSignificantLocationChanges()
    }
    
    func getCurrentLocation() async -> CLLocation? {
        return location
    }
    
    func addGeofence(region: CLCircularRegion) {
        locationManager.startMonitoring(for: region)
    }
    
    func removeGeofence(region: CLRegion) {
        locationManager.stopMonitoring(for: region)
    }
    
    // CLLocationManagerDelegate
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        DispatchQueue.main.async {
            self.location = location
            self.visitedLocations.append(location)
            
            // Keep only last 100 locations
            if self.visitedLocations.count > 100 {
                self.visitedLocations.removeFirst()
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        DispatchQueue.main.async {
            self.authorizationStatus = status
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        DispatchQueue.main.async {
            self.region = region
            // Send notification when entering a property region
            NotificationManager.shared.sendNotification(
                title: "Property Entered",
                body: "You have entered a monitored property area"
            )
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        DispatchQueue.main.async {
            self.region = nil
            // Send notification when exiting a property region
            NotificationManager.shared.sendNotification(
                title: "Property Exited",
                body: "You have left a monitored property area"
            )
        }
    }
    
    func calculateDistance(to destination: CLLocationCoordinate2D) -> CLLocationDistance? {
        guard let currentLocation = location else { return nil }
        let destinationLocation = CLLocation(latitude: destination.latitude, longitude: destination.longitude)
        return currentLocation.distance(from: destinationLocation)
    }
    
    func getDirections(to destination: CLLocationCoordinate2D) async -> MKRoute? {
        guard let currentLocation = location else { return nil }
        
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: currentLocation.coordinate))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination))
        request.transportType = .automobile
        
        let directions = MKDirections(request: request)
        
        do {
            let response = try await directions.calculate()
            return response.routes.first
        } catch {
            print("Error calculating directions: \(error)")
            return nil
        }
    }
}
