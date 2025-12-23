import SwiftUI

struct ContentView: View {
    @State private var logMessage: String = "Ready. Tap Sign In."
    
    var body: some View {
        ZStack(alignment: .top) {
            WebView(url: URL(string: "https://cuevote.com")!, logger: { msg in
                self.logMessage = msg
            })
            // Extend to edges (fullscreen feel)
            .ignoresSafeArea(.all)
            
            // Debug Overlay
            Text(logMessage)
                .font(.caption)
                .foregroundColor(.yellow)
                .padding()
                .background(Color.black.opacity(0.8))
                .cornerRadius(10)
                .padding(.top, 50) // Below notch
        }
    }
}
