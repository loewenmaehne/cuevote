import SwiftUI

struct ContentView: View {
    var body: some View {
        WebView(url: URL(string: "https://cuevote.com")!)
            // Extend to edges (fullscreen feel)
            .ignoresSafeArea(.all) 
            // We might want to keep the top safe area for status bar, or ignore all.
            // Android wrapper uses standard theme but adds flags.
            // Let's stick to default safe area for top to avoid notch issues, but ignore bottom.
    }
}
