import SwiftUI

struct ContentView: View {
    @State private var currentUrl: URL = URL(string: "https://cuevote.com")!
    @State private var isButtonVisible = false // Default hidden
    @State private var isScanning = false
    @State private var reloadKey = UUID()
    @State private var dragOffset: CGFloat = 0
    
    @State private var isOffline = false
    @State private var isLoading = true
    
    var body: some View {
        ZStack(alignment: .bottomTrailing) { // Revert to Bottom Right
            WebView(url: currentUrl, isOffline: $isOffline, isLoading: $isLoading, reloadKey: reloadKey)
                .ignoresSafeArea()
            
            // Loading Overlay
            if isLoading {
                ZStack {
                    Color.black.ignoresSafeArea()
                    VStack {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .orange))
                            .scaleEffect(2.0)
                        Text("Loading...")
                            .foregroundColor(.gray)
                            .padding(.top, 20)
                    }
                }
                .transition(.opacity)
            }
            
            // Offline Overlay
            if isOffline {
                ZStack {
                    Color.black
                    VStack(spacing: 20) {
                        Image(systemName: "wifi.slash")
                            .font(.system(size: 50))
                            .foregroundColor(.white)
                        Text("No Internet Connection")
                            .font(.title3)
                            .foregroundColor(.white)
                        Button(action: {
                            // Retry Logic
                            isLoading = true // Show loader again
                            isOffline = false
                            reloadKey = UUID() // Force WebView Re-creation
                        }) {
                            Text("Retry")
                                .font(.title3) // Bigger Font
                                .fontWeight(.bold)
                                .foregroundColor(.black)
                                .padding(.vertical, 16) // More vertical padding
                                .frame(width: 200) // Bigger Width
                                .background(Color.orange)
                                .cornerRadius(12)
                        }
                    }
                }
                .ignoresSafeArea()
            }
            
            // Floating Scan Button
            if isButtonVisible && !isOffline { // Hide button if offline
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
        // Custom Sheet Overlay for Consistent Landscape 90% Height
        .overlay(
            GeometryReader { geometry in
                if isScanning {
                    ZStack(alignment: .bottom) {
                        // Dimmed Background
                        Color.black.opacity(0.4)
                            .ignoresSafeArea()
                            .onTapGesture {
                                withAnimation { isScanning = false }
                            }
                        
                        // Card
                        VStack(spacing: 0) {
                            // Drag Handle Area
                            ZStack {
                                Capsule()
                                    .fill(Color.gray.opacity(0.5))
                                    .frame(width: 40, height: 5)
                            }
                            .frame(height: 30) // Tappable / Drag area
                            .frame(maxWidth: .infinity)
                            .background(Color(UIColor.systemBackground))
                            .cornerRadius(15, corners: [.topLeft, .topRight])
                            
                            // Scanner View
                            QRScannerView { code in
                                isScanning = false
                                self.isButtonVisible = false 
                                self.reloadKey = UUID()
                                
                                if let url = URL(string: code), code.hasPrefix("http") {
                                    // STRICT VALIDATION
                                    if url.scheme == "https" && (url.host == "cuevote.com" || url.host == "www.cuevote.com") {
                                        currentUrl = url
                                    }
                                }
                            }
                        }
                        .frame(height: geometry.size.height * (geometry.size.width > geometry.size.height ? 0.85 : 0.80))
                        .background(Color.black)
                        .cornerRadius(15, corners: [.topLeft, .topRight])
                        .offset(y: max(0, dragOffset)) // Only allow dragging down
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    if value.translation.height > 0 {
                                        dragOffset = value.translation.height
                                    }
                                }
                                .onEnded { value in
                                    if value.translation.height > 100 {
                                        withAnimation { isScanning = false }
                                    }
                                    withAnimation { dragOffset = 0 }
                                }
                        )
                        .transition(.move(edge: .bottom))
                        .offset(y: 0)
                    }
                }
            }

            .ignoresSafeArea() // Fix: Ensure overlay fills entire screen (including notch area in landscape)
        )
        .animation(.spring(), value: isScanning)
    }
}

// Extension for partial rounded corners
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}
