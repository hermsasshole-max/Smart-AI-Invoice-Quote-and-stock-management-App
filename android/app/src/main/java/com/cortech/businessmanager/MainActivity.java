package com.cortech.businessmanager;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "CorTechBridge";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupAndroidBridge();
    }

    @Override
    protected void onStart() {
        super.onStart();
        setupAndroidBridge();
    }

    private void setupAndroidBridge() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setDatabaseEnabled(true);
                webView.addJavascriptInterface(new AndroidBridge(this, webView), "AndroidInterface");
                Log.d(TAG, "AndroidInterface successfully attached to WebView");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting up Android bridge: " + e.getMessage(), e);
        }
    }

    public static class AndroidBridge {
        private final Context context;
        private final WebView webView;
        private final Handler mainHandler;

        public AndroidBridge(Context context, WebView webView) {
            this.context = context;
            this.webView = webView;
            this.mainHandler = new Handler(Looper.getMainLooper());
        }

        private byte[] decodeBase64(String base64Data) {
            if (base64Data == null || base64Data.isEmpty()) return new byte[0];
            int commaIdx = base64Data.indexOf(',');
            String raw = commaIdx >= 0 ? base64Data.substring(commaIdx + 1) : base64Data;
            return Base64.decode(raw, Base64.DEFAULT);
        }

        @JavascriptInterface
        public boolean saveFile(String base64Data, String filename, String mimeType) {
            try {
                byte[] bytes = decodeBase64(base64Data);
                if (bytes.length == 0) return false;

                if (mimeType == null || mimeType.isEmpty()) {
                    mimeType = filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
                }

                boolean success = false;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/CorTech");

                    Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(bytes);
                                os.flush();
                                success = true;
                            }
                        }
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File folder = new File(downloadsDir, "CorTech");
                    if (!folder.exists()) folder.mkdirs();
                    File file = new File(folder, filename);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(bytes);
                        fos.flush();
                        success = true;
                    }
                }

                final boolean finalSuccess = success;
                mainHandler.post(() -> {
                    if (finalSuccess) {
                        Toast.makeText(context, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(context, "Could not save " + filename, Toast.LENGTH_SHORT).show();
                    }
                });

                return success;
            } catch (Exception e) {
                Log.e(TAG, "saveFile error: " + e.getMessage(), e);
                mainHandler.post(() -> Toast.makeText(context, "Save error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                return false;
            }
        }

        @JavascriptInterface
        public boolean shareFile(String base64Data, String filename, String mimeType, String title) {
            try {
                byte[] bytes = decodeBase64(base64Data);
                if (bytes.length == 0) return false;

                if (mimeType == null || mimeType.isEmpty()) {
                    mimeType = filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
                }

                File cacheDir = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
                File sharedDir = new File(cacheDir, "shared_docs");
                if (!sharedDir.exists()) sharedDir.mkdirs();

                File file = new File(sharedDir, filename);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(bytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);

                mainHandler.post(() -> {
                    try {
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType(mimeType);
                        shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                        shareIntent.putExtra(Intent.EXTRA_SUBJECT, title != null ? title : filename);
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent chooser = Intent.createChooser(shareIntent, title != null ? title : "Share Document");
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(chooser);
                    } catch (Exception ex) {
                        Log.e(TAG, "Launching share intent failed: " + ex.getMessage(), ex);
                        Toast.makeText(context, "Share error: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });

                return true;
            } catch (Exception e) {
                Log.e(TAG, "shareFile error: " + e.getMessage(), e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean openFile(String base64Data, String filename, String mimeType) {
            try {
                byte[] bytes = decodeBase64(base64Data);
                if (bytes.length == 0) return false;

                if (mimeType == null || mimeType.isEmpty()) {
                    mimeType = filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
                }

                File cacheDir = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
                File file = new File(cacheDir, filename);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(bytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);

                mainHandler.post(() -> {
                    try {
                        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                        viewIntent.setDataAndType(contentUri, mimeType);
                        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        Intent chooser = Intent.createChooser(viewIntent, "Open Document");
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(chooser);
                    } catch (Exception ex) {
                        Log.e(TAG, "openFile view intent failed: " + ex.getMessage(), ex);
                        Toast.makeText(context, "No app available to open this document", Toast.LENGTH_SHORT).show();
                    }
                });

                return true;
            } catch (Exception e) {
                Log.e(TAG, "openFile error: " + e.getMessage(), e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean printPdf(String base64Data, String title) {
            try {
                byte[] bytes = decodeBase64(base64Data);
                if (bytes.length == 0) return false;

                File cacheDir = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
                File tempPdf = new File(cacheDir, "temp_print_doc.pdf");
                try (FileOutputStream fos = new FileOutputStream(tempPdf)) {
                    fos.write(bytes);
                    fos.flush();
                }

                mainHandler.post(() -> {
                    try {
                        PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                        if (printManager == null) {
                            Toast.makeText(context, "Print service not available on this device", Toast.LENGTH_SHORT).show();
                            return;
                        }

                        final String jobName = (title != null && !title.isEmpty()) ? title : "CorTech Document";

                        PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                            @Override
                            public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                                if (cancellationSignal.isCanceled()) {
                                    callback.onLayoutCancelled();
                                    return;
                                }
                                PrintDocumentInfo info = new PrintDocumentInfo.Builder(jobName)
                                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                                        .build();
                                callback.onLayoutFinished(info, true);
                            }

                            @Override
                            public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
                                try (InputStream input = new FileInputStream(tempPdf);
                                     OutputStream output = new FileOutputStream(destination.getFileDescriptor())) {
                                    byte[] buf = new byte[8192];
                                    int bytesRead;
                                    while ((bytesRead = input.read(buf)) > 0) {
                                        if (cancellationSignal.isCanceled()) {
                                            callback.onWriteCancelled();
                                            return;
                                        }
                                        output.write(buf, 0, bytesRead);
                                    }
                                    callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                                } catch (Exception e) {
                                    Log.e(TAG, "onWrite print error: " + e.getMessage(), e);
                                    callback.onWriteFailed(e.getMessage());
                                }
                            }
                        };

                        printManager.print(jobName, adapter, new PrintAttributes.Builder().build());
                    } catch (Exception ex) {
                        Log.e(TAG, "printPdf execution failed: " + ex.getMessage(), ex);
                        Toast.makeText(context, "Print spooler error: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });

                return true;
            } catch (Exception e) {
                Log.e(TAG, "printPdf error: " + e.getMessage(), e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean printDocument() {
            mainHandler.post(() -> {
                try {
                    PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                    if (printManager != null && webView != null) {
                        PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("CorTech Document");
                        printManager.print("CorTech Document", adapter, new PrintAttributes.Builder().build());
                    }
                } catch (Exception e) {
                    Log.e(TAG, "printDocument failed: " + e.getMessage(), e);
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean openUrl(String url) {
            try {
                if (url == null || url.isEmpty()) return false;
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                Log.e(TAG, "openUrl failed: " + e.getMessage(), e);
                return false;
            }
        }

        @JavascriptInterface
        public void showToast(String message) {
            mainHandler.post(() -> Toast.makeText(context, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }
    }
}
