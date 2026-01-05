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
import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.FrameLayout
import android.view.Gravity
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
// ZXing Imports


import androidx.annotation.Keep

import android.os.Message
import android.app.Dialog
import com.google.android.material.floatingactionbutton.FloatingActionButton

class MainActivity : AppCompatActivity(), QRScannerBottomSheet.QRScanListener {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Keep Screen On
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 1. Setup Layout Container (FrameLayout)
        val container = FrameLayout(this)
        container.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )

        // 2. Create WebView programmatically
        webView = WebView(this)
        // Enable Debugging only in Debug builds
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
        webView.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        
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
            
            // Popup settings
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            
            // Cache settings (Optional, good for PWA feel)
            cacheMode = WebSettings.LOAD_DEFAULT

            // Custom User Agent for detection
            val defaultUserAgent = userAgentString
            val sanitizedUserAgent = defaultUserAgent.replace("; wv", "")
            userAgentString = "$sanitizedUserAgent CueVoteWrapper/1.0"
        }

        // 3. Inject Offline Layout
        val inflater = android.view.LayoutInflater.from(this)
        val offlineView = inflater.inflate(R.layout.layout_offline, container, false)
        offlineView.visibility = android.view.View.GONE
        container.addView(offlineView)
        
        // 4. Inject Loading Layout
        val loadingView = inflater.inflate(R.layout.layout_loading, container, false)
        loadingView.visibility = android.view.View.VISIBLE // Show initially
        container.addView(loadingView)
        
        // Retry Button Logic
        val btnRetry = offlineView.findViewById<android.widget.Button>(R.id.btn_retry)
        btnRetry.setOnClickListener {
            offlineView.visibility = android.view.View.GONE
             loadingView.visibility = android.view.View.VISIBLE // Show loader
            webView.visibility = android.view.View.VISIBLE
            webView.reload()
        }

        // Web Client to keep links internal & Handle Errors
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false 
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Hide Loader when done
                loadingView.visibility = android.view.View.GONE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: android.webkit.WebResourceError?) {
                super.onReceivedError(view, request, error)
                // Show Offline Screen
                runOnUiThread {
                    loadingView.visibility = android.view.View.GONE // Ensure loader is hidden
                    webView.visibility = android.view.View.GONE
                    offlineView.visibility = android.view.View.VISIBLE
                }
            }
        }

        // Web Chrome Client for Popups
        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message?): Boolean {
                val newWebView = WebView(this@MainActivity)
                newWebView.settings.javaScriptEnabled = true
                newWebView.settings.domStorageEnabled = true
                newWebView.settings.userAgentString = view?.settings?.userAgentString
                
                val dialog = Dialog(this@MainActivity)
                dialog.setContentView(newWebView)
                dialog.window?.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)
                dialog.show()
                
                dialog.setOnDismissListener { 
                    newWebView.destroy() 
                }
                
                newWebView.webChromeClient = object : WebChromeClient() {
                    override fun onCloseWindow(window: WebView?) { dialog.dismiss() }
                }
                newWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean { return false }
                }

                val transport = resultMsg?.obj as WebView.WebViewTransport
                transport.webView = newWebView
                resultMsg.sendToTarget()
                return true
            }
        }

        // Inject JS Interface for Detection
        // webView.addJavascriptInterface(...) -> Moved down to have access to FAB

        // Load the production URL
        webView.loadUrl("https://cuevote.com")

        // Add WebView to container
        container.addView(webView)

        // 4. Create Floating Action Button (QR Scan)
        val fab = FloatingActionButton(this)
        val fabParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        )
        // Revert to Bottom Right (Standard)
        fabParams.gravity = Gravity.BOTTOM or Gravity.END 
        fabParams.setMargins(0, 0, 40, 40) // Bottom-Right Margin
        fab.layoutParams = fabParams
        
        // Style the FAB
        fab.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#FF8C00")) // Orange
        // Use custom QR Icon
        fab.setImageResource(R.drawable.ic_qr_code)
        
        // Initially HIDDEN
        fab.visibility = android.view.View.GONE
        
        fab.setOnClickListener {
            startQRScan()
        }

        container.addView(fab)

        // Set Content View
        setContentView(container)
        
        // Pass FAB reference to Interface
        webView.addJavascriptInterface(WebAppInterface(this, fab), "CueVoteAndroid")
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

    private fun startQRScan() {
        val scannerFragment = QRScannerBottomSheet()
        scannerFragment.show(supportFragmentManager, "QRScanner")
    }

    // QRScanListener Implementation
    override fun onScanComplete(contents: String) {
        var finalUrl: String? = null

        // 1. Check if it's a URL
        if (contents.startsWith("http://") || contents.startsWith("https://")) {
            try {
                val uri = android.net.Uri.parse(contents)
                // STRICT SECURITY CHECK
                if (uri.scheme == "https" && (uri.host == "cuevote.com" || uri.host == "www.cuevote.com")) {
                    finalUrl = contents
                } else {
                     android.widget.Toast.makeText(this, "Invalid QR Code: Domain not trusted", android.widget.Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
               // Invalid URI
            }
        }

        finalUrl?.let {
            webView.loadUrl(it)
        }
    }

    override fun onScanCancelled() {
        // Handle cancellation if needed
    }

    // Removed onActivityResult as we don't use IntentIntegrator anymore
}

@Keep
class WebAppInterface(private val mContext: Context, private val fab: FloatingActionButton) {
    @JavascriptInterface
    fun isNative(): Boolean {
        return true
    }

    @JavascriptInterface
    fun toggleQRButton(show: Boolean) {
        // Must run UI updates on Main Thread
        val activity = mContext as? MainActivity
        activity?.runOnUiThread {
            if (show) {
                fab.show()
            } else {
                fab.hide()
            }
        }
    }
}
