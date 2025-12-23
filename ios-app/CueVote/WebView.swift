import SwiftUI
import WebKit

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
        config.applicationNameForUserAgent = "CueVoteWrapper/1.0"
        
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
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        
        // MARK: - Layout & Appearance
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Load the URL
        webView.load(URLRequest(url: url))
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No updates needed for now
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebView
        
        init(parent: WebView) {
            self.parent = parent
        }
        
        // MARK: - WKUIDelegate (Popups)
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            // Handle popups (like Google OAuth) by loading them in the same view
            // or handling them if they are strictly new windows.
            if let url = navigationAction.request.url {
                webView.load(navigationAction.request)
            }
            return nil
        }
        
        // MARK: - WKNavigationDelegate
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // Handle target="_blank"
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            decisionHandler(.allow)
        }
    }
}
