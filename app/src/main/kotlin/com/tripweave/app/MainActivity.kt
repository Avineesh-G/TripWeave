package com.tripweave.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Dialog
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    private lateinit var mainWebView: WebView
    private var popupDialog: Dialog? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null
    private lateinit var googleSignInClient: GoogleSignInClient
    private var nativeLocationListener: LocationListener? = null
    private var downloadReceiver: BroadcastReceiver? = null

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        pendingGeoCallback?.invoke(pendingGeoOrigin, granted, true)
        pendingGeoCallback = null
        pendingGeoOrigin = null
        if (granted) {
            requestFreshNativeLocation()
        }
    }

        private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            val account: GoogleSignInAccount? = task.getResult(ApiException::class.java)
            if (account != null) {
                val email = account.email ?: ""
                val displayName = account.displayName ?: (account.givenName ?: "Explorer")
                val photoUrl = account.photoUrl?.toString() ?: ""
                val id = account.id ?: ("google-" + System.currentTimeMillis())
                val idToken = account.idToken ?: ""
                notifyAuthSuccess(email, displayName, photoUrl, id, idToken)
                return@registerForActivityResult
            }
        } catch (e: Exception) {
            tryFallbackDeviceAccount(e.localizedMessage ?: "Google Sign-In canceled")
            return@registerForActivityResult
        }
        tryFallbackDeviceAccount("Google Sign-In returned no account")
    }

    private fun tryFallbackDeviceAccount(originalError: String) {
        try {
            val accountManager = android.accounts.AccountManager.get(this)
            val accounts = accountManager.getAccountsByType("com.google")
            if (accounts.isNotEmpty()) {
                val primaryEmail = accounts[0].name
                val name = primaryEmail.substringBefore("@").replace(".", " ")
                    .split(" ")
                    .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
                notifyAuthSuccess(primaryEmail, name, "", "device-" + System.currentTimeMillis(), "")
                return
            }
        } catch (e: Exception) {
            // Permission not granted or restricted
        }
        notifyAuthFailure(originalError)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)

        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        mainWebView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = WebView.OVER_SCROLL_NEVER
        }

        // Dynamic Island & Cutout Inset Bridge to Web layer
        ViewCompat.setOnApplyWindowInsetsListener(mainWebView) { view, insets ->
            val cutout = insets.getInsets(WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.displayCutout()).top
            val density = resources.displayMetrics.density
            val topDp = if (density > 0f) (cutout / density).toInt() else 58
            val safeTopDp = maxOf(topDp, 58)
            view.post {
                mainWebView.evaluateJavascript("document.documentElement.style.setProperty('--native-safe-top', '" + safeTopDp + "px');", null)
            }
            view.setPadding(0, 0, 0, 0)
            insets
        }

        cookieManager.setAcceptThirdPartyCookies(mainWebView, true)
        configureWebSettings(mainWebView.settings)

        // Inject Native Google Auth Bridge
        mainWebView.addJavascriptInterface(AndroidAuthBridge(), "AndroidAuthBridge")
        mainWebView.addJavascriptInterface(AndroidLocationBridge(), "AndroidLocationBridge")

        mainWebView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                return isExternalIntent(url, view)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    view.loadUrl("https://appassets.androidplatform.net/index.html")
                }
            }
        }

        mainWebView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, true)
                } else {
                    pendingGeoCallback = callback
                    pendingGeoOrigin = origin
                    locationPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                }
            }

            @SuppressLint("SetJavaScriptEnabled")
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                val popupWebView = WebView(this@MainActivity)
                configureWebSettings(popupWebView.settings)
                cookieManager.setAcceptThirdPartyCookies(popupWebView, true)

                val dialog = Dialog(this@MainActivity, android.R.style.Theme_DeviceDefault_NoActionBar_Fullscreen).apply {
                    setContentView(popupWebView)
                    setOnDismissListener {
                        popupWebView.destroy()
                        popupDialog = null
                    }
                }
                popupDialog = dialog

                popupWebView.webChromeClient = object : WebChromeClient() {
                    override fun onCloseWindow(window: WebView?) {
                        dialog.dismiss()
                    }
                }

                popupWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        subView: WebView,
                        request: WebResourceRequest
                    ): Boolean {
                        val subUrl = request.url.toString()
                        if (subUrl.startsWith("https://appassets.androidplatform.net")) {
                            dialog.dismiss()
                            mainWebView.loadUrl(subUrl)
                            return true
                        }
                        return false
                    }
                }

                val transport = resultMsg?.obj as? WebView.WebViewTransport
                transport?.webView = popupWebView
                resultMsg?.sendToTarget()
                dialog.show()
                return true
            }

            override fun onCloseWindow(window: WebView?) {
                popupDialog?.dismiss()
            }
        }

        setContentView(mainWebView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (popupDialog?.isShowing == true) {
                    popupDialog?.dismiss()
                } else if (mainWebView.canGoBack()) {
                    mainWebView.goBack()
                } else {
                    finish()
                }
            }
        })

        // Load entry point hosted via WebViewAssetLoader
        mainWebView.loadUrl("https://appassets.androidplatform.net/index.html")
    }

    private fun notifyAuthSuccess(email: String, displayName: String, photoUrl: String, id: String, idToken: String) {
        val json = JSONObject().apply {
            put("success", true)
            put("email", email)
            put("displayName", displayName)
            put("photoUrl", photoUrl)
            put("uid", id)
            put("idToken", idToken)
        }.toString()
        mainWebView.post {
            mainWebView.evaluateJavascript("if (window.onNativeGoogleSignInSuccess) { window.onNativeGoogleSignInSuccess(" + json + "); }", null)
        }
    }

    private fun notifyAuthFailure(error: String) {
        val safeError = JSONObject.quote(error)
        mainWebView.post {
            mainWebView.evaluateJavascript("if (window.onNativeGoogleSignInFailure) { window.onNativeGoogleSignInFailure(" + safeError + "); }", null)
        }
    }

    inner class AndroidAuthBridge {
        @JavascriptInterface
        fun downloadUpdate(apkUrl: String?) {
            runOnUiThread {
                try {
                    val targetUrl = if (apkUrl.isNullOrBlank()) "https://github.com/Avineesh-G/TripWeave/raw/main/TripWeave.apk" else apkUrl
                    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                        data = Uri.parse(targetUrl)
                        flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        @JavascriptInterface
        fun requestGoogleSignIn() {
            runOnUiThread {
                try {
                    googleSignInLauncher.launch(googleSignInClient.signInIntent)
                } catch (e: Exception) {
                    tryFallbackDeviceAccount(e.localizedMessage ?: "Unable to launch Google Sign-In")
                }
            }
        }

        @JavascriptInterface
        fun getDeviceGoogleAccount(): String {
            try {
                val accountManager = android.accounts.AccountManager.get(this@MainActivity)
                val accounts = accountManager.getAccountsByType("com.google")
                if (accounts.isNotEmpty()) {
                    return accounts[0].name
                }
            } catch (e: Exception) {}
            return ""
        }

        @JavascriptInterface
        fun signOut() {
            runOnUiThread {
                googleSignInClient.signOut()
            }
        }

        @JavascriptInterface
        fun isNativeAndroid(): Boolean {
            return true
        }
    }

    inner class AndroidLocationBridge {
        @JavascriptInterface
        fun getDeviceLocation(): String {
            return getBestLocationJson()
        }

        @JavascriptInterface
        fun requestLocationUpdate() {
            runOnUiThread {
                requestFreshNativeLocation()
            }
        }

        @JavascriptInterface
        fun isLocationPermissionGranted(): Boolean {
            return hasLocationPermission()
        }
    }

    @SuppressLint("MissingPermission")
    private fun getBestLocationJson(): String {
        if (!hasLocationPermission()) return ""
        try {
            val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return ""
            val gpsLoc = try {
                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) lm.getLastKnownLocation(LocationManager.GPS_PROVIDER) else null
            } catch (e: Exception) { null }

            val netLoc = try {
                if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) else null
            } catch (e: Exception) { null }

            val bestLoc = when {
                gpsLoc != null && netLoc != null -> {
                    if (gpsLoc.accuracy <= netLoc.accuracy || (System.currentTimeMillis() - gpsLoc.time < 300000)) gpsLoc else netLoc
                }
                gpsLoc != null -> gpsLoc
                netLoc != null -> netLoc
                else -> null
            }

            if (bestLoc != null) {
                return JSONObject().apply {
                    put("latitude", bestLoc.latitude)
                    put("longitude", bestLoc.longitude)
                    put("accuracy", bestLoc.accuracy.toDouble())
                    put("provider", bestLoc.provider)
                    put("time", bestLoc.time)
                }.toString()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return ""
    }

    @SuppressLint("MissingPermission")
    private fun requestFreshNativeLocation() {
        if (!hasLocationPermission()) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
            return
        }

        try {
            val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return

            val bestKnown = getBestLocationJson()
            if (bestKnown.isNotBlank()) {
                mainWebView.post {
                    mainWebView.evaluateJavascript("if (window.onNativeLocationUpdate) { window.onNativeLocationUpdate($bestKnown); }", null)
                }
            }

            nativeLocationListener?.let {
                try { lm.removeUpdates(it) } catch (e: Exception) {}
            }

            val listener = object : LocationListener {
                override fun onLocationChanged(loc: Location) {
                    val json = JSONObject().apply {
                        put("latitude", loc.latitude)
                        put("longitude", loc.longitude)
                        put("accuracy", loc.accuracy.toDouble())
                        put("provider", loc.provider)
                        put("time", loc.time)
                    }.toString()
                    mainWebView.post {
                        mainWebView.evaluateJavascript("if (window.onNativeLocationUpdate) { window.onNativeLocationUpdate($json); }", null)
                    }
                }
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }
            nativeLocationListener = listener

            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1500L, 1f, listener)
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000L, 5f, listener)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }


    private fun downloadAndInstallApk(url: String) {
        try {
            val freshUrl = if (url.contains("?")) "$url&t=${System.currentTimeMillis()}" else "$url?t=${System.currentTimeMillis()}"
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
            if (dm == null) {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(freshUrl)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(intent)
                return
            }

            val destinationFile = File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "TripWeave-Update.apk")
            if (destinationFile.exists()) {
                destinationFile.delete()
            }

            val request = DownloadManager.Request(Uri.parse(freshUrl)).apply {
                setTitle("TripWeave Update")
                setDescription("Downloading latest version...")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationUri(Uri.fromFile(destinationFile))
                setMimeType("application/vnd.android.package-archive")
            }

            val downloadId = dm.enqueue(request)

            downloadReceiver?.let {
                try { unregisterReceiver(it) } catch (e: Exception) {}
            }

            val receiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L) ?: -1L
                    if (id == downloadId) {
                        try {
                            unregisterReceiver(this)
                            downloadReceiver = null
                        } catch (e: Exception) {}

                        installDownloadedApk(destinationFile)
                    }
                }
            }
            downloadReceiver = receiver

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
            }

            mainWebView.post {
                mainWebView.evaluateJavascript("if (typeof showToast === 'function') { showToast('Downloading update in background...'); }", null)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        }
    }

    private fun installDownloadedApk(file: File) {
        if (!file.exists()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!packageManager.canRequestPackageInstalls()) {
                try {
                    val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:$packageName")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(settingsIntent)
                } catch (e: Exception) {}
            }
        }

        try {
            val apkUri = FileProvider.getUriForFile(
                this,
                "$packageName.fileprovider",
                file
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            startActivity(installIntent)
        } catch (e: Exception) {
            e.printStackTrace()
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun configureWebSettings(settings: WebSettings) {
        val isOnline = isNetworkAvailable()
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = if (isOnline) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK
            setGeolocationEnabled(true)
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            allowFileAccess = false
            allowContentAccess = false
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 TripWeaveNative/1.2"
        }
    }

    private fun isExternalIntent(url: String, view: WebView): Boolean {
        val uri = Uri.parse(url)
        val host = uri.host ?: ""
        return if (host.contains("appassets.androidplatform.net") ||
            host.contains("google.com") ||
            host.contains("googleapis.com") ||
            host.contains("firebaseapp.com") ||
            host.contains("gstatic.com") ||
            host.contains("openstreetmap.org") ||
            host.contains("cartocdn.com") ||
            host.contains("wikimedia.org") ||
            host.contains("wikipedia.org") ||
            host.contains("komoot.de") ||
            host.contains("photon.komoot.io")
        ) {
            false
        } else {
            false
        }
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    override fun onDestroy() {
        nativeLocationListener?.let {
            try {
                val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                lm?.removeUpdates(it)
            } catch (e: Exception) {}
        }
        popupDialog?.dismiss()
        mainWebView.destroy()
        super.onDestroy()
    }
}
