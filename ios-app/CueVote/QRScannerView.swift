import SwiftUI
import AVFoundation

struct QRScannerView: UIViewControllerRepresentable {
    var onCodeScanned: (String) -> Void
    @Environment(\.presentationMode) var presentationMode
    
    func makeUIViewController(context: Context) -> ScannerViewController {
        let controller = ScannerViewController()
        controller.delegate = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: ScannerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }
    
    class Coordinator: NSObject, ScannerDelegate {
        let parent: QRScannerView
        
        init(parent: QRScannerView) {
            self.parent = parent
        }
        
        func didScanCode(code: String) {
            parent.onCodeScanned(code)
            parent.presentationMode.wrappedValue.dismiss()
        }
        
        func didFail(error: Error) {
            print("Scanning failed: \(error.localizedDescription)")
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}

protocol ScannerDelegate: AnyObject {
    func didScanCode(code: String)
    func didFail(error: Error)
}

class ScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    weak var delegate: ScannerDelegate?
    var captureSession: AVCaptureSession!
    var previewLayer: AVCaptureVideoPreviewLayer!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        view.backgroundColor = UIColor.black
        captureSession = AVCaptureSession()
        
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else { return }
        let videoInput: AVCaptureDeviceInput
        
        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            delegate?.didFail(error: error)
            return
        }
        
        if (captureSession.canAddInput(videoInput)) {
            captureSession.addInput(videoInput)
        } else {
            delegate?.didFail(error: NSError(domain: "QRScanner", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not add video input"]))
            return
        }
        
        let metadataOutput = AVCaptureMetadataOutput()
        
        if (captureSession.canAddOutput(metadataOutput)) {
            captureSession.addOutput(metadataOutput)
            
            metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            metadataOutput.metadataObjectTypes = [.qr]
        } else {
            delegate?.didFail(error: NSError(domain: "QRScanner", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not add metadata output"]))
            return
        }
        
        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.frame = view.layer.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        
        // Start running on background thread
        DispatchQueue.global(qos: .userInitiated).async {
            self.captureSession.startRunning()
        }
    }
    
    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        if let connection = previewLayer?.connection {
            let currentDevice: UIDevice = UIDevice.current
            let orientation: UIDeviceOrientation = currentDevice.orientation
            let previewLayerConnection : AVCaptureConnection = connection
            
            if previewLayerConnection.isVideoOrientationSupported {
                switch (orientation) {
                case .portrait: updatePreviewLayer(layer: previewLayerConnection, orientation: .portrait)
                case .landscapeRight: updatePreviewLayer(layer: previewLayerConnection, orientation: .landscapeLeft)
                case .landscapeLeft: updatePreviewLayer(layer: previewLayerConnection, orientation: .landscapeRight)
                case .portraitUpsideDown: updatePreviewLayer(layer: previewLayerConnection, orientation: .portraitUpsideDown)
                default: updatePreviewLayer(layer: previewLayerConnection, orientation: .portrait)
                }
            }
        }
        previewLayer?.frame = view.bounds // update frame
    }
    
    private func updatePreviewLayer(layer: AVCaptureConnection, orientation: AVCaptureVideoOrientation) {
        layer.videoOrientation = orientation
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        
        if (captureSession?.isRunning == true) {
            captureSession.stopRunning()
        }
    }
    
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        captureSession.stopRunning()
        
        if let metadataObject = metadataObjects.first {
            guard let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject else { return }
            guard let stringValue = readableObject.stringValue else { return }
            AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
            delegate?.didScanCode(code: stringValue)
        }
    }
    
    override var prefersStatusBarHidden: Bool {
        return true
    }
    
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .all
    }
}
