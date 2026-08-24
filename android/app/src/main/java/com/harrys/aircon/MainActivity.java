package com.harrys.aircon;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "HarrysMainActivity";
    public static final String DOWNLOAD_CHANNEL_ID = "harrys_downloads_channel";

    private WebView webView;
    private WebAppInterface webAppInterface;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraCaptureUri;

    // Modern ActivityResultLauncher for File Chooser & Camera
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    // Modern ActivityResultLauncher for Runtime Permissions
    private final ActivityResultLauncher<String[]> requestPermissionsLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), permissions -> {
                boolean hasPermission = false;
                for (Boolean isGranted : permissions.values()) {
                    if (Boolean.TRUE.equals(isGranted)) {
                        hasPermission = true;
                    }
                }
                Log.d(TAG, "Permissions result evaluated. Granted at least one: " + hasPermission);
            });

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ensure full sensor auto-rotation for portrait & landscape across all devices
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);

        // 1. Create System Notification Channel for File Downloads
        createNotificationChannel();

        // 2. Initialize Activity Result Launchers
        initActivityLaunchers();

        // 3. Instantiate and attach WebView with MATCH_PARENT for full system resolution coverage
        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);
        setContentView(webView);

        // 4. Configure WebSettings for optimal modern web app execution, resolution scaling & hardware acceleration
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setSupportZoom(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            webSettings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);
        }

        // Enable cookies & mixed content
        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // 5. Expose Native Android JavaScript Interface Bridge
        webAppInterface = new WebAppInterface(this);
        webView.addJavascriptInterface(webAppInterface, "AndroidInterface");

        // 6. Configure WebViewClient for external app routing (WhatsApp, Tel, Mailto)
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return handleCustomUri(uri);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;
                return handleCustomUri(Uri.parse(url));
            }

            private boolean handleCustomUri(Uri uri) {
                if (uri == null) return false;
                String scheme = uri.getScheme();
                if (scheme != null && (scheme.equals("tel") || scheme.equals("mailto") ||
                        scheme.equals("whatsapp") || scheme.equals("https://wa.me") ||
                        (uri.getHost() != null && uri.getHost().contains("wa.me")))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "Error launching external app intent: " + uri, e);
                    }
                }
                return false;
            }
        });

        // 7. Configure WebChromeClient with onShowFileChooser & onPermissionRequest handlers
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                // Cancel any pending callback to prevent WebView deadlock
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                    MainActivity.this.filePathCallback = null;
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent takePictureIntent = null;
                cameraCaptureUri = null;

                // Create camera photo file intent if CAMERA permission is granted
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    try {
                        File photoFile = createImageFile();
                        if (photoFile != null) {
                            cameraCaptureUri = FileProvider.getUriForFile(
                                    MainActivity.this,
                                    getPackageName() + ".fileprovider",
                                    photoFile
                            );
                            takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraCaptureUri);
                            takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        }
                    } catch (Exception ex) {
                        Log.e(TAG, "Error creating camera image file", ex);
                    }
                }

                // Create document/gallery picker intent
                Intent contentSelectionIntent = fileChooserParams != null
                        ? fileChooserParams.createIntent()
                        : new Intent(Intent.ACTION_GET_CONTENT).setType("image/*");

                Intent chooserIntent;
                if (takePictureIntent != null) {
                    chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                    chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
                    chooserIntent.putExtra(Intent.EXTRA_TITLE, "Select Receipt or Take Photo");
                    chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{takePictureIntent});
                } else {
                    chooserIntent = contentSelectionIntent;
                }

                try {
                    fileChooserLauncher.launch(chooserIntent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Error launching file chooser", e);
                    if (MainActivity.this.filePathCallback != null) {
                        MainActivity.this.filePathCallback.onReceiveValue(null);
                        MainActivity.this.filePathCallback = null;
                    }
                    return false;
                }
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    try {
                        request.grant(request.getResources());
                    } catch (Exception e) {
                        Log.e(TAG, "Error granting Web permission request", e);
                    }
                });
            }
        });

        // 8. Configure DownloadListener for standard download URLs
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                if (url.startsWith("blob:") || url.startsWith("data:")) {
                    return;
                }

                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                String cookies = CookieManager.getInstance().getCookie(url);
                request.addRequestHeader("cookie", cookies);
                request.addRequestHeader("User-Agent", userAgent);
                request.setDescription("Downloading file...");
                request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType));
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        URLUtil.guessFileName(url, contentDisposition, mimeType)
                );

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(getApplicationContext(), "Downloading file...", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Log.e(TAG, "Download error:", e);
            }
        });

        // 9. Request runtime permissions on startup
        requestAppPermissions();

        // 10. Load Application
        String appUrl = "http://localhost:3000";
        webView.loadUrl(appUrl);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    DOWNLOAD_CHANNEL_ID,
                    "Document & File Downloads",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications when Quotes, Invoices, and Reports are saved to device");
            channel.enableVibration(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    public void triggerDownloadNotification(String filename, File file, Uri contentUri, String mimeType) {
        try {
            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            Uri uriToOpen = null;

            if (file != null && file.exists()) {
                uriToOpen = FileProvider.getUriForFile(
                        this,
                        getPackageName() + ".fileprovider",
                        file
                );
            } else if (contentUri != null) {
                uriToOpen = contentUri;
            }

            PendingIntent pendingIntent = null;
            if (uriToOpen != null) {
                viewIntent.setDataAndType(uriToOpen, mimeType != null ? mimeType : "*/*");
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }

                pendingIntent = PendingIntent.getActivity(
                        this,
                        (int) System.currentTimeMillis(),
                        Intent.createChooser(viewIntent, "Open " + filename),
                        flags
                );
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, DOWNLOAD_CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("Download Complete")
                    .setContentText(filename + " saved to Downloads")
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH);

            if (pendingIntent != null) {
                builder.setContentIntent(pendingIntent);
            }

            NotificationManagerCompat manager = NotificationManagerCompat.from(this);
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                    || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                manager.notify((int) System.currentTimeMillis(), builder.build());
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not post download notification", e);
        }
    }

    private void initActivityLaunchers() {
        // File Chooser Launcher
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (filePathCallback == null) return;
                    Uri[] results = null;
                    try {
                        if (result.getResultCode() == RESULT_OK) {
                            Intent data = result.getData();
                            if (data != null) {
                                String dataString = data.getDataString();
                                if (dataString != null) {
                                    results = new Uri[]{Uri.parse(dataString)};
                                } else if (data.getClipData() != null) {
                                    int count = data.getClipData().getItemCount();
                                    results = new Uri[count];
                                    for (int i = 0; i < count; i++) {
                                        results[i] = data.getClipData().getItemAt(i).getUri();
                                    }
                                }
                            }

                            // If no data returned from gallery intent, check camera capture URI
                            if (results == null && cameraCaptureUri != null) {
                                results = new Uri[]{cameraCaptureUri};
                            }
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error handling file chooser result", e);
                    } finally {
                        // ALWAYS call onReceiveValue (even with null) to prevent WebView deadlock!
                        filePathCallback.onReceiveValue(results);
                        filePathCallback = null;
                    }
                }
        );
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "JPEG_" + timeStamp + "_";
        File storageDir = getExternalCacheDir() != null ? getExternalCacheDir() : getCacheDir();
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    /**
     * Runtime Permission Request on App Startup
     */
    private void requestAppPermissions() {
        List<String> permissions = new ArrayList<>();

        // Camera & Audio Permissions
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }

        // Notification Permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_AUDIO);
            }
        } else {
            // Android 12 and below
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }

        // Trigger the modern permission launcher if any permissions are pending
        if (!permissions.isEmpty()) {
            requestPermissionsLauncher.launch(permissions.toArray(new String[0]));
        }
    }

    public WebView getWebView() {
        return webView;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (webView != null) {
            webView.requestLayout();
            webView.invalidate();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}

