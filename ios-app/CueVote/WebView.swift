import SwiftUI
import WebKit
import AuthenticationServices
import CryptoKit

struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        
        let scriptSource = "window.CueVoteAndroid = { isNative: function() { return true; } };"
        let script = WKUserScript(source: scriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        config.userContentController.addUserScript(script)
        
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "nativeGoogleLogin")
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        
        NotificationCenter.default.addObserver(forName: NSNotification.Name("InjectGoogleToken"), object: nil, queue: .main) { note in
            if let token = note.object as? String {
                let js = "window.handleNativeGoogleLogin && window.handleNativeGoogleLogin('\(token)');"
                webView.evaluateJavaScript(js, completionHandler: nil)
            }
        }

        // WKWebsiteDataStore.default().removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: Date(timeIntervalSince1970: 0)) { }

        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if uiView.url?.absoluteString != url.absoluteString {
            let request = URLRequest(url: url)
            uiView.load(request)
        }
    }
    
    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
        var parent: WebView
        var webAuthSession: ASWebAuthenticationSession?
        var codeVerifier: String?

        init(parent: WebView) { self.parent = parent }

        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            return UIApplication.shared.connectedScenes
                .filter { $0.activationState == .foregroundActive }
                .first(where: { $0 is UIWindowScene })
                .flatMap({ $0 as? UIWindowScene })?.windows
                .first(where: { $0.isKeyWindow }) ?? ASPresentationAnchor()
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "nativeGoogleLogin" {
                startGoogleSignInPKCE()
            }
        }
        
        func startGoogleSignInPKCE() {
            // TODO: Enter your iOS Client ID Here
            let iosClientId = "PASTE_YOUR_IOS_CLIENT_ID_HERE"
            
            // Standard Custom Scheme for Google OAuth
            let customScheme = "com.googleusercontent.apps.\(iosClientId)"
            let redirectUri = "\(customScheme):/oauth2callback"
            
            // Safety Check
            if iosClientId.contains("PASTE") {
                print("Please configure iosClientId in WebView.swift")
                return
            }
            
            // Generate PKCE Verifier & Challenge
            let verifier = generateCodeVerifier()
            self.codeVerifier = verifier
            let challenge = generateCodeChallenge(verifier: verifier)
            
            var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
            components.queryItems = [
                URLQueryItem(name: "client_id", value: iosClientId),
                URLQueryItem(name: "redirect_uri", value: redirectUri),
                URLQueryItem(name: "response_type", value: "code"),
                URLQueryItem(name: "scope", value: "email profile openid"),
                URLQueryItem(name: "code_challenge", value: challenge),
                URLQueryItem(name: "code_challenge_method", value: "S256")
            ]
            
            guard let authUrl = components.url else { return }
            
            self.webAuthSession = ASWebAuthenticationSession(url: authUrl, callbackURLScheme: customScheme) { callbackURL, error in
                guard error == nil, let callbackURL = callbackURL else { return }
                
                if let code = self.extractQueryParam(url: callbackURL, param: "code") {
                    self.exchangeCodeForToken(code: code, clientId: iosClientId, redirectUri: redirectUri, verifier: verifier)
                }
            }
            self.webAuthSession?.presentationContextProvider = self
            self.webAuthSession?.start()
        }
        
        func exchangeCodeForToken(code: String, clientId: String, redirectUri: String, verifier: String) {
            let tokenEndpoint = URL(string: "https://oauth2.googleapis.com/token")!
            var request = URLRequest(url: tokenEndpoint)
            request.httpMethod = "POST"
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            
            let bodyParams = [
                "client_id": clientId,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirectUri,
                "code_verifier": verifier
            ]
            
            let bodyString = bodyParams.map { "\($0)=\($1)" }.joined(separator: "&")
            request.httpBody = bodyString.data(using: .utf8)
            
            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                guard let data = data, error == nil else { return }
                
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let accessToken = json["access_token"] as? String {
                    self.injectTokenToWeb(token: accessToken)
                }
            }
            task.resume()
        }
        
        func generateCodeVerifier() -> String {
            var buffer = Array<UInt8>(repeating: 0, count: 32)
            _ = SecRandomCopyBytes(kSecRandomDefault, buffer.count, &buffer)
            return Data(buffer).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
                .trimmingCharacters(in: .whitespaces)
        }

        func generateCodeChallenge(verifier: String) -> String {
            guard let data = verifier.data(using: .ascii) else { return "" }
            let hash = SHA256.hash(data: data)
            return Data(hash).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
                .trimmingCharacters(in: .whitespaces)
        }
        
        func extractQueryParam(url: URL, param: String) -> String? {
            guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                  let items = components.queryItems else { return nil }
            return items.first(where: { $0.name == param })?.value
        }
        
        func injectTokenToWeb(token: String) {
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: NSNotification.Name("InjectGoogleToken"), object: token)
            }
        }
        
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { return nil }
        func webViewDidClose(_ webView: WKWebView) {}
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) { completionHandler() }
    }
}
