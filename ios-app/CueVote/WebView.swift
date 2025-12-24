import SwiftUI
import WebKit
import AuthenticationServices

struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        
        // MARK: - Autoplay & Inline Media
        // Allow autoplay without user gesture (Core Requirement)
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        
        // MARK: - User Agent & Detection
        // Appending our identifier so the web app detects the wrapper.
        // This matches the 'CueVoteWrapper' check in MobileRedirectGuard.jsx
        // TEST: Commenting out to see if Google blocks this UA
        // config.applicationNameForUserAgent = "CueVoteWrapper/1.0"
        
        // MARK: - Popup Settings
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        
        // Inject JS Object to match Android's interface (Optional but good for consistency)
        // Matches: typeof window.CueVoteAndroid !== 'undefined'
        let scriptSource = """
            window.CueVoteAndroid = {
                isNative: function() { return true; }
            };
        """
        let script = WKUserScript(source: scriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        config.userContentController.addUserScript(script)
        
        // Message Handler for Native Bridge
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "nativeGoogleLogin")
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        
        // Listen for Native Token Injection
        NotificationCenter.default.addObserver(forName: NSNotification.Name("InjectGoogleToken"), object: nil, queue: .main) { note in
            if let token = note.object as? String {
                let js = "window.handleNativeGoogleLogin && window.handleNativeGoogleLogin('\(token)');"
                webView.evaluateJavaScript(js, completionHandler: nil)
            }
        }
        
        webView.allowsBackForwardNavigationGestures = true
        
        // MARK: - Layout & Appearance
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Load the URL
        // MARK: - Cleaning Cache (Force Update)
        // Aggressively clear cache for debugging
        WKWebsiteDataStore.default().removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: Date(timeIntervalSince1970: 0)) { }

        // Load the URL with cache ignoring policy
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No updates needed for now
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
        var parent: WebView
        var webAuthSession: ASWebAuthenticationSession?

        init(parent: WebView) {
            self.parent = parent
        }

        // MARK: - ASWebAuthenticationPresentationContextProviding
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            return UIApplication.shared.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }

        // MARK: - WKScriptMessageHandler
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "nativeGoogleLogin", let dict = message.body as? [String: Any], let clientId = dict["clientId"] as? String {
                startGoogleSignIn(clientId: clientId)
            }
        }
        
        func startGoogleSignIn(clientId: String) {
            // Using the existing Web Redirect for now.
            // NOTE: If this fails to capture, User must add a Custom Scheme (e.g. com.googleusercontent.apps.CLIENTID)
            // to Google Console and Info.plist, then update this redirectURL.
            let redirectStr = "https://cuevote.com"
            let scope = "email profile openid"
            let authUrlStr = "https://accounts.google.com/o/oauth2/v2/auth?client_id=\(clientId)&redirect_uri=\(redirectStr)&response_type=token&scope=\(scope)"
            
            guard let authUrl = URL(string: authUrlStr) else { return }
            
            // Scheme to watch for. Using 'https' to try capturing the web redirect.
            let callbackScheme = "https"
            
            self.webAuthSession = ASWebAuthenticationSession(url: authUrl, callbackURLScheme: callbackScheme) { callbackURL, error in
                guard error == nil, let callbackURL = callbackURL else {
                    print("Auth Failed: \(String(describing: error))")
                    return
                }
                
                // Parse Token from URL Fragment (#access_token=...)
                if let fragment = callbackURL.fragment, let token = self.extractToken(from: fragment) {
                     self.injectTokenToWeb(token: token)
                }
            }
            
            self.webAuthSession?.presentationContextProvider = self
            self.webAuthSession?.start()
        }
        
        func extractToken(from fragment: String) -> String? {
            let params = fragment.components(separatedBy: "&")
            for param in params {
                let pair = param.components(separatedBy: "=")
                if pair.count == 2, pair[0] == "access_token" {
                    return pair[1]
                }
            }
            return nil
        }
        
        func injectTokenToWeb(token: String) {
            // Broadcast token to be picked up by WebView (which holds the WKWebViewRef)
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: NSNotification.Name("InjectGoogleToken"), object: token)
            }
        }

        // MARK: - WKUIDelegate (Popups)
        // This is called when window.open() is triggered (e.g. Google Sign-In)
        // MARK: - WKUIDelegate (Popups)
        // This is called when window.open() is triggered (e.g. Google Sign-In)
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            
            // DEBUG: Spy on Popup Request
            // We find the rootVC to show "Native: Popup Requested"
            /*
            if let rootVC = UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController {
                 let alert = UIAlertController(title: "Debug", message: "Native: Popup Requested", preferredStyle: .alert)
                 alert.addAction(UIAlertAction(title: "OK", style: .default))
                 rootVC.present(alert, animated: true)
            }
            */
            // Actually, showing an alert MIGHT block the popup presentation logic or cause conflict.
            // Let's rely on the JS Spy first. If JS says "Open" and nothing happens, we know it's here.
            
            // 1. Create a new WebView with the provided configuration
            let popup = WKWebView(frame: .zero, configuration: configuration)
            popup.uiDelegate = self
            popup.navigationDelegate = self
            
            // 2. Wrap it in a ViewController to present it
            let controller = UIViewController()
            controller.view = popup
            controller.modalPresentationStyle = .pageSheet // Or .automatic
            
            // 3. Find the top-most view controller to present from
            // Robust lookup for modern iOS (Scened-based)
            let windowScene = UIApplication.shared.connectedScenes
                .filter { $0.activationState == .foregroundActive }
                .first as? UIWindowScene
            
            let window = windowScene?.windows.first { $0.isKeyWindow } 
                ?? UIApplication.shared.windows.first { $0.isKeyWindow }
            
            if var topController = window?.rootViewController {
                // Determine the true top view controller if others are presented
                while let presented = topController.presentedViewController {
                    topController = presented
                }
                
                topController.present(controller, animated: true, completion: nil)
                self.popupWebView = popup
                self.popupController = controller
                return popup
            }
            
            return nil
        }
        
        // This is called when window.close() is triggered (e.g. Auth finished)
        func webViewDidClose(_ webView: WKWebView) {
            if webView == popupWebView {
                popupController?.dismiss(animated: true, completion: nil)
                popupWebView = nil
                popupController = nil
            }
        }

        // MARK: - WKNavigationDelegate
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // Allow all navigation
            decisionHandler(.allow)
        }
        
        // MARK: - WKUIDelegate (JS Alerts)
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            
            // Find presentation controller
            if let rootVC = UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController {
                rootVC.present(alert, animated: true)
            }
        }
    }
}
