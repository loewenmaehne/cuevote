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
                        ZStack(alignment: .top) {
                            
                            // Scanner View (Full Fill)
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
                            
                            // Drag Handle Area (Overlay)
                            ZStack {
                                Capsule()
                                    .fill(Color.white.opacity(0.8)) // Brighter for visibility on video
                                    .frame(width: 40, height: 5)
                                    .shadow(radius: 2) // Add shadow for contrast
                            }
                            .frame(height: 30) // Tappable / Drag area
                            .frame(maxWidth: .infinity)
                            .padding(.top, 8) // Slight top padding
                        }
                        .frame(height: geometry.size.height * (geometry.size.width > geometry.size.height ? 0.85 : 0.80))
                        .background(Color.black)
                        .cornerRadius(44, corners: [.topLeft, .topRight]) // Update: Rounded corners 44 for borderless look
                        .offset(y: max(0, dragOffset)) // Only allow dragging down
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    if value.translation.height > 0 {
                                        dragOffset = value.translation.height
                                    }
                                }
                                .onEnded { value in
                                    let threshold: CGFloat = 100
                                    let velocity = value.predictedEndTranslation.height
                                    
                                    if value.translation.height > threshold || velocity > threshold {
                                        // Manually animate off-screen
                                        withAnimation(.easeInOut(duration: 0.3)) {
                                            dragOffset = geometry.size.height
                                        }
                                        
                                        // Update state after animation completes
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                            isScanning = false
                                            dragOffset = 0
                                        }
                                    } else {
                                         withAnimation { dragOffset = 0 }
                                    }
                                }
                        )
                        .transition(.move(edge: .bottom))
                        .onAppear {
                            dragOffset = 0 // Reset offset when view appears
                        }
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
