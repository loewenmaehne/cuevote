import SwiftUI

struct ContentView: View {
    @State private var currentUrl: URL = URL(string: "https://cuevote.com")!
    @State private var isButtonVisible = false // Default hidden
    @State private var isScanning = false
    @State private var reloadKey = UUID()
    
    var body: some View {
        ZStack(alignment: .bottomTrailing) { // Revert to Bottom Right
            WebView(url: currentUrl, reloadKey: reloadKey)
                .ignoresSafeArea()
            
            // Floating Scan Button
            if isButtonVisible {
                Button(action: {
                    isScanning = true
                }) {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 24))
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.orange)
                        .clipShape(Circle())
                        .shadow(radius: 4)
                }
                .padding(30) // Offset from bottom-right (Reverted)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ToggleQRButton"))) { note in
            if let show = note.object as? Bool {
                self.isButtonVisible = show
            }
        }
        .sheet(isPresented: $isScanning) {
            QRScannerView { code in
                // Handle scanned code
                isScanning = false
                
                // FIX: Hide button immediately on successful scan
                self.isButtonVisible = false 
                
                // Force Webview Update even if URL is same
                self.reloadKey = UUID()
                
                if let url = URL(string: code), code.contains("cuevote.com") {
                    // It's a valid URL, load it
                    currentUrl = url
                } else if !code.contains("http") {
                     // It might be just a Room ID (e.g. "synthwave")
                     // Construct the URL
                     if let url = URL(string: "https://cuevote.com/" + code) {
                         currentUrl = url
                     }
                }
            }
            .presentationDetents([.fraction(0.7)]) // 70% Screen Height (iOS 16+)
            .presentationDragIndicator(.visible) // Native drag handle
        }
    }
}
