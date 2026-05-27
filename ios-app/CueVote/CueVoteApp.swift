import SwiftUI

@main
struct CueVoteApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear {
                    // Keep Screen On (Wakefulness)
                    UIApplication.shared.isIdleTimerDisabled = true
                    Self.excludeWebKitDataFromBackup()
                }
        }
    }

    // iCloud Backup pulls WKWebView's storage (Library/WebKit/) by default,
    // which carries the CueVote session token in localStorage. Excluding
    // the directory means a device restore prompts a fresh re-login
    // instead of silently inheriting an active session.
    private static func excludeWebKitDataFromBackup() {
        let fm = FileManager.default
        guard let library = fm.urls(for: .libraryDirectory, in: .userDomainMask).first else { return }
        var webkit = library.appendingPathComponent("WebKit")
        if !fm.fileExists(atPath: webkit.path) {
            try? fm.createDirectory(at: webkit, withIntermediateDirectories: true)
        }
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? webkit.setResourceValues(values)
    }
}
