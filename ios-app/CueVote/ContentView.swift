import SwiftUI

struct ContentView: View {
    @State private var currentUrl: URL = URL(string: "https://cuevote.com")!
    @State private var isScanning = false
    
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            WebView(url: currentUrl)
                .ignoresSafeArea()
            
            // Floating Scan Button
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
            .padding(30) // Offset from bottom-right
        }
        .sheet(isPresented: $isScanning) {
            QRScannerView { code in
                // Handle scanned code
                isScanning = false
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
        }
    }
}
