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
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.app.UiModeManager
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest

import androidx.annotation.Keep

import android.os.Message
import android.app.Dialog
import com.google.android.material.floatingactionbutton.FloatingActionButton

class MainActivity : AppCompatActivity(), QRScannerBottomSheet.QRScanListener {

    private lateinit var webView: WebView
    private lateinit var fab: FloatingActionButton
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var wasOffline = false
    private var reconnectHandler: android.os.Handler? = null
    private var reconnectRunnable: Runnable? = null

    // Whether this device has any camera (front, back, or external/USB). Since the TV
    // change relaxed the camera uses-features to required="false", the app also installs
    // on camera-less devices (Android TV, some Wi-Fi tablets). The QR scanner needs a live
    // camera, so it must be suppressed on these devices rather than opening a dead preview.
    // Evaluated once — camera hardware does not change at runtime.
    private val hasCamera: Boolean by lazy {
        packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
    }

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
            
            cacheMode = WebSettings.LOAD_DEFAULT

            // Custom User Agent for detection
            val defaultUserAgent = userAgentString
            val sanitizedUserAgent = defaultUserAgent.replace("; wv", "")
            val uiModeManager = getSystemService(Context.UI_MODE_SERVICE) as UiModeManager
            val isTelevision = uiModeManager.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION
            val tvSuffix = if (isTelevision) " AndroidTV" else ""
            userAgentString = "$sanitizedUserAgent CueVoteWrapper/1.0$tvSuffix"
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
                if (request?.isForMainFrame != true) return
                runOnUiThread {
                    loadingView.visibility = android.view.View.GONE
                    webView.visibility = android.view.View.GONE
                    offlineView.visibility = android.view.View.VISIBLE
                }
            }
        }

        // Web Chrome Client for Popups
        //
        // Popups are intercepted: cuevote.com targets stay in this WebView,
        // everything else (legal links, YouTube, Google docs) is handed to
        // the system browser. Previously every popup landed in a full-screen
        // dialog WebView that would happily load any URL — a compromised
        // first-party page could have used it to load an attacker-controlled
        // origin with the CueVoteWrapper user-agent in front of the user.
        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message?): Boolean {
                // Throw-away WebView whose only purpose is to surface the
                // popup's target URL via shouldOverrideUrlLoading, then route
                // it. WebView is never attached to the view hierarchy and is
                // destroyed once we've decided what to do with the URL.
                val captureWebView = WebView(this@MainActivity)
                captureWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                        val url = request?.url
                        if (url != null) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, url)
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                this@MainActivity.startActivity(intent)
                            } catch (_: Exception) {
                                // No browser installed — silently drop.
                            }
                        }
                        captureWebView.destroy()
                        return true
                    }
                }
                val transport = resultMsg?.obj as? WebView.WebViewTransport
                transport?.webView = captureWebView
                resultMsg?.sendToTarget()
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
        fab = FloatingActionButton(this)
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
        
        // Pass WebView and FAB reference to Interface
        webView.addJavascriptInterface(WebAppInterface(this, webView, fab, hasCamera), "CueVoteAndroid")
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

        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        reconnectHandler = android.os.Handler(mainLooper)
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    if (::webView.isInitialized) {
                        offlineView.visibility = android.view.View.GONE
                        webView.visibility = android.view.View.VISIBLE
                        // Only reconnect if we were actually offline, debounced
                        if (wasOffline) {
                            wasOffline = false
                            reconnectRunnable?.let { reconnectHandler?.removeCallbacks(it) }
                            val runnable = Runnable {
                                webView.evaluateJavascript("window.cuevoteReconnect && window.cuevoteReconnect()", null)
                            }
                            reconnectRunnable = runnable
                            reconnectHandler?.postDelayed(runnable, 1000)
                        }
                    }
                }
            }
            override fun onLost(network: Network) {
                runOnUiThread {
                    // Only show offline if no other network is available
                    val activeNetwork = cm.activeNetwork
                    val capabilities = activeNetwork?.let { cm.getNetworkCapabilities(it) }
                    if (capabilities == null || !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                        wasOffline = true
                        if (::webView.isInitialized) {
                            offlineView.visibility = android.view.View.VISIBLE
                        }
                    }
                }
            }
        }
        cm.registerNetworkCallback(request, networkCallback!!)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
            webView.evaluateJavascript("window.cuevoteReconnect && window.cuevoteReconnect()", null)
        }
    }

    override fun onPause() {
        super.onPause()
        if (::webView.isInitialized) {
            webView.onPause()
        }
    }

    override fun onDestroy() {
        reconnectRunnable?.let { reconnectHandler?.removeCallbacks(it) }
        reconnectHandler = null
        networkCallback?.let {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            cm.unregisterNetworkCallback(it)
        }
        super.onDestroy()
    }

    private fun startQRScan() {
        // Defensive: the FAB is already withheld from camera-less devices (see
        // WebAppInterface.toggleQRButton), so this path should be unreachable there. If it
        // is somehow reached, no-op instead of opening the scanner against hardware that
        // does not exist. Deliberately no user-facing string — the wrapper has no native
        // i18n, and all localized copy lives in the web layer's translation system.
        if (!hasCamera) {
            android.util.Log.w("CueVote", "QR scan requested on a device without a camera; ignoring")
            return
        }
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
            // webView.loadUrl triggers a full page reload, which tears down the JS
            // context before the Lobby useEffect cleanup can call toggleQRButton(false).
            // Hide the FAB from Kotlin so it doesn't linger over the room view.
            fab.hide()
            webView.loadUrl(it)
        }
    }

    override fun onScanCancelled() {
        // Handle cancellation if needed
    }

    // Removed onActivityResult as we don't use IntentIntegrator anymore
}

@Keep
class WebAppInterface(
    private val mContext: Context,
    private val webView: WebView,
    private val fab: FloatingActionButton,
    private val hasCamera: Boolean
) {
    @JavascriptInterface
    fun isNative(): Boolean {
        return true
    }

    @JavascriptInterface
    fun toggleQRButton(show: Boolean) {
        val activity = mContext as? MainActivity ?: return
        activity.runOnUiThread {
            val currentUrl = webView.url
            val uri = try {
                if (currentUrl.isNullOrBlank()) null else android.net.Uri.parse(currentUrl)
            } catch (e: Exception) {
                null
            }
            val host = uri?.host ?: ""
            if (host != "cuevote.com" && host != "www.cuevote.com") {
                return@runOnUiThread
            }

            // Only surface the scan button where a camera exists. The web layer requests it
            // without knowing the hardware; withholding it here keeps camera-less devices
            // (Android TV, some tablets) from opening a scanner that cannot work — and adds
            // no native string, so the wrapper's lack of i18n is not a concern.
            if (show && hasCamera) {
                fab.show()
            } else {
                fab.hide()
            }
        }
    }
}
