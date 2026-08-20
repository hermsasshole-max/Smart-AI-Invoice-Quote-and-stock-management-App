package com.harrys.aircon;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
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
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "HarrysMainActivity";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraCaptureUri;

    // Modern ActivityResultLauncher for File Chooser & Camera
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    // Modern ActivityResultLauncher for Runtime Permissions
    private ActivityResultLauncher<String[]> permissionLauncher;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Initialize Activity Result Launchers
        initActivityLaunchers();

        // 2. Instantiate and attach WebView
        webView = new WebView(this);
        setContentView(webView);

        // 3. Configure WebSettings for optimal modern web app execution & hardware acceleration
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setSupportZoom(true);
        webSettings.setBuiltInZoomControls(false);
        webSettings.setDisplayZoomControls(false);
        webSettings.setMediaPlaybackRequiresUserGesture(false);

        // Enable cookies & mixed content
        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // 4. Expose Native Android JavaScript Interface Bridge (both on MainActivity instance & WebAppInterface)
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidInterface");

        // 5. Configure WebViewClient for external app routing (WhatsApp, Tel, Mailto)
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

        // 6. Configure WebChromeClient with onShowFileChooser & onPermissionRequest handlers
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

        // 7. Configure DownloadListener for Blob / HTTP URL downloads
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

        // 8. Request runtime permissions on startup
        requestAppPermissions();

        // 9. Load Application
        String appUrl = "http://localhost:3000";
        webView.loadUrl(appUrl);
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

        // Runtime Permissions Launcher
        permissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestMultiplePermissions(),
                resultMap -> {
                    boolean cameraGranted = resultMap.containsKey(Manifest.permission.CAMERA) &&
                            Boolean.TRUE.equals(resultMap.get(Manifest.permission.CAMERA));
                    if (cameraGranted) {
                        Log.i(TAG, "Camera permission granted for receipt scanning");
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

    private void requestAppPermissions() {
        List<String> permissions = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                }
            }
        }

        if (!permissions.isEmpty()) {
            permissionLauncher.launch(permissions.toArray(new String[0]));
        }
    }

    /**
     * Direct JavascriptInterface implementation for maximum compatibility
     */
    @JavascriptInterface
    public void saveFile(String base64Data, String filename, String mimeType) {
        if (base64Data == null || filename == null) {
            Log.e(TAG, "saveFile error: base64Data or filename is null");
            return;
        }

        try {
            String rawBase64 = base64Data.contains(",") ? base64Data.split(",")[1] : base64Data;
            byte[] fileBytes = Base64.decode(rawBase64, Base64.DEFAULT);

            if (mimeType == null || mimeType.isEmpty()) {
                mimeType = "application/octet-stream";
            }

            boolean savedSuccessfully = false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29–35): MediaStore Downloads Collection (No storage permissions needed)
                ContentResolver resolver = getContentResolver();
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                contentValues.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                contentValues.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/HarrysFieldOps");

                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues);
                if (uri != null) {
                    try (OutputStream outputStream = resolver.openOutputStream(uri)) {
                        if (outputStream != null) {
                            outputStream.write(fileBytes);
                            outputStream.flush();
                            savedSuccessfully = true;
                        }
                    }
                }
            } else {
                // Android 9 and below: Direct filesystem writing to public Downloads directory
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                File targetFile = new File(downloadsDir, filename);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                    savedSuccessfully = true;
                }

                // Notify media scanner so file appears immediately in Files app
                MediaScannerConnection.scanFile(
                        this,
                        new String[]{targetFile.getAbsolutePath()},
                        new String[]{mimeType},
                        null
                );
            }

            if (savedSuccessfully) {
                final String finalFilename = filename;
                runOnUiThread(() ->
                        Toast.makeText(MainActivity.this, "Saved to Downloads: " + finalFilename, Toast.LENGTH_LONG).show()
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "Error saving file to Downloads", e);
            runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "Failed to save file: " + e.getMessage(), Toast.LENGTH_SHORT).show()
            );
        }
    }

    @JavascriptInterface
    public void printDocument() {
        runOnUiThread(() -> {
            try {
                if (webView == null) return;
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (printManager != null) {
                    PrintDocumentAdapter printAdapter;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        printAdapter = webView.createPrintDocumentAdapter("Harrys_Document");
                    } else {
                        printAdapter = webView.createPrintDocumentAdapter();
                    }

                    printManager.print(
                            "Harrys_Invoice_Quote",
                            printAdapter,
                            new PrintAttributes.Builder().build()
                    );
                }
            } catch (Exception e) {
                Log.e(TAG, "Error invoking Android PrintManager", e);
                Toast.makeText(MainActivity.this, "Print error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    public WebView getWebView() {
        return webView;
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
