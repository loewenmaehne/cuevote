import SwiftUI

@main
struct CueVoteApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear {
                    // Keep Screen On (Wakefulness)
                    UIApplication.shared.isIdleTimerDisabled = true
                }
        }
    }
}
