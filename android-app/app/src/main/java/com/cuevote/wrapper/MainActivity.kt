package com.cuevote.wrapper

import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep Screen On
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Create WebView programmatically
        webView = WebView(this)
        setContentView(webView)

        // Configure Settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // CRITICAL: Allow autoplay without user gesture
            mediaPlaybackRequiresUserGesture = false 
            
            // Layout settings
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            
            // Cache settings (Optional, good for PWA feel)
            cacheMode = WebSettings.LOAD_DEFAULT

            // Custom User Agent for detection
            userAgentString += " CueVoteWrapper/1.0"
        }

        // Web Client to keep links internal
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                // Return false to let the WebView handle the URL (keep it inside the app)
                return false 
            }
        }

        webView.webChromeClient = WebChromeClient()

        // Load the production URL
        webView.loadUrl("https://cuevote.com")

        // Handle Back Press properly
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }
}
