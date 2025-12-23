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
        var popupWebView: WKWebView?
        var popupController: UIViewController?

        init(parent: WebView) {
            self.parent = parent
        }

        // MARK: - WKUIDelegate (Popups)
        // This is called when window.open() is triggered (e.g. Google Sign-In)
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            
            // 1. Create a new WebView with the provided configuration
            let popup = WKWebView(frame: .zero, configuration: configuration)
            popup.uiDelegate = self
            popup.navigationDelegate = self
            
            // 2. Wrap it in a ViewController to present it
            let controller = UIViewController()
            controller.view = popup
            controller.modalPresentationStyle = .pageSheet // Or .automatic
            
            // 3. Find the top-most view controller to present from
            if let rootVC = UIApplication.shared.windows.first?.rootViewController {
                rootVC.present(controller, animated: true, completion: nil)
                self.popupWebView = popup
                self.popupController = controller
            }
            
            return popup
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
    }
}
