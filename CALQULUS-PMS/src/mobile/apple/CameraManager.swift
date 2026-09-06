import SwiftUI
import AVFoundation
import PhotosUI

class CameraManager: NSObject, ObservableObject, AVCapturePhotoCaptureDelegate {
    private let captureSession = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private let videoOutput = AVCaptureVideoDataOutput()
    
    @Published var previewLayer: AVCaptureVideoPreviewLayer?
    @Published var isCameraAvailable = false
    @Published var capturedImage: UIImage?
    @Published var isFlashAvailable = false
    @Published var isFlashOn = false
    
    private var photoCaptureCompletion: ((UIImage?) -> Void)?
    
    override init() {
        super.init()
        setupCamera()
    }
    
    private func setupCamera() {
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            print("Camera not available")
            return
        }
        
        isCameraAvailable = true
        isFlashAvailable = camera.hasFlash
        
        do {
            let input = try AVCaptureDeviceInput(device: camera)
            
            captureSession.sessionPreset = .photo
            captureSession.addInput(input)
            captureSession.addOutput(photoOutput)
            captureSession.addOutput(videoOutput)
            
            photoOutput.isHighResolutionCaptureEnabled = true
            
            let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
            previewLayer.videoGravity = .resizeAspectFill
            self.previewLayer = previewLayer
            
        } catch {
            print("Error setting up camera: \(error)")
        }
    }
    
    func startCamera() {
        DispatchQueue.global(qos: .userInitiated).async {
            self.captureSession.startRunning()
        }
    }
    
    func stopCamera() {
        captureSession.stopRunning()
    }
    
    func switchCamera() {
        guard let currentInput = captureSession.inputs.first as? AVCaptureDeviceInput else { return }
        
        captureSession.beginConfiguration()
        
        captureSession.removeInput(currentInput)
        
        let newPosition: AVCaptureDevice.Position = currentInput.device.position == .back ? .front : .back
        
        guard let newCamera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPosition) else {
            captureSession.commitConfiguration()
            return
        }
        
        do {
            let newInput = try AVCaptureDeviceInput(device: newCamera)
            captureSession.addInput(newInput)
            isFlashAvailable = newCamera.hasFlash
        } catch {
            print("Error switching camera: \(error)")
        }
        
        captureSession.commitConfiguration()
    }
    
    func toggleFlash() {
        guard let camera = AVCaptureDevice.default(for: .video), camera.hasFlash else { return }
        
        do {
            try camera.lockForConfiguration()
            
            if camera.flashMode == .on {
                camera.flashMode = .off
                isFlashOn = false
            } else {
                camera.flashMode = .on
                isFlashOn = true
            }
            
            camera.unlockForConfiguration()
        } catch {
            print("Error toggling flash: \(error)")
        }
    }
    
    func capturePhoto(completion: @escaping (UIImage?) -> Void) {
        photoCaptureCompletion = completion
        
        let settings = AVCapturePhotoSettings()
        
        if isFlashAvailable && isFlashOn {
            settings.flashMode = .on
        }
        
        photoOutput.capturePhoto(with: settings, delegate: self)
    }
    
    // AVCapturePhotoCaptureDelegate
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            print("Error capturing photo: \(error)")
            photoCaptureCompletion?(nil)
            return
        }
        
        if let imageData = photo.fileDataRepresentation(),
           let image = UIImage(data: imageData) {
            DispatchQueue.main.async {
                self.capturedImage = image
                self.photoCaptureCompletion?(image)
            }
        } else {
            photoCaptureCompletion?(nil)
        }
    }
    
    func savePhotoToLibrary(_ image: UIImage) {
        PHPhotoLibrary.shared().performChanges {
            PHAssetChangeRequest.creationRequestForAsset(from: image)
        } completionHandler: { success, error in
            if let error = error {
                print("Error saving photo: \(error)")
            }
        }
    }
    
    func pickImageFromLibrary() -> some View {
        ImagePicker { image in
            self.capturedImage = image
        }
    }
}

struct ImagePicker: UIViewControllerRepresentable {
    let image: (UIImage?) -> Void
    
    func makeUIViewController(context: Context) -> PHPickerViewController {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.selectionLimit = 1
        configuration.filter = .images
        
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: ImagePicker
        
        init(_ parent: ImagePicker) {
            self.parent = parent
        }
        
        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            
            guard let provider = results.first?.itemProvider else { return }
            
            if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { item, error in
                    if let error = error {
                        print("Error loading image: \(error)")
                        return
                    }
                    
                    if let data = item as? Data,
                       let image = UIImage(data: data) {
                        DispatchQueue.main.async {
                            self.parent.image(image)
                        }
                    }
                }
            }
        }
    }
}
