package com.harrys.aircon;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class WebAppInterface {
    private static final String TAG = "HarrysWebAppInterface";
    private final MainActivity activity;

    public WebAppInterface(MainActivity activity) {
        this.activity = activity;
    }

    /**
     * Save Base64 file directly to device's public Downloads folder.
     * Supports Android 10+ Scoped Storage (MediaStore.Downloads) and Android 9- FileOutputStream.
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
                ContentResolver resolver = activity.getContentResolver();
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
                        activity,
                        new String[]{targetFile.getAbsolutePath()},
                        new String[]{mimeType},
                        null
                );
            }

            if (savedSuccessfully) {
                activity.runOnUiThread(() ->
                        Toast.makeText(activity, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show()
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "Error saving file to Downloads", e);
            activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Failed to save file: " + e.getMessage(), Toast.LENGTH_SHORT).show()
            );
        }
    }

    /**
     * Native Android Print Adapter (invokes Android PrintManager for Print to PDF / Wi-Fi Printers)
     * Always executed on UI Thread to prevent PrintManager background thread crashes.
     */
    @JavascriptInterface
    public void printDocument() {
        activity.runOnUiThread(() -> {
            try {
                WebView webView = activity.getWebView();
                if (webView == null) return;

                PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
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
                Toast.makeText(activity, "Print error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * Direct file sharing via Android Intent Chooser
     */
    @JavascriptInterface
    public void shareFile(String base64Data, String filename, String mimeType, String title) {
        try {
            String rawBase64 = base64Data.contains(",") ? base64Data.split(",")[1] : base64Data;
            byte[] fileBytes = Base64.decode(rawBase64, Base64.DEFAULT);

            File cachePath = new File(activity.getCacheDir(), "shared_docs");
            if (!cachePath.exists()) {
                cachePath.mkdirs();
            }

            File file = new File(cachePath, filename);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(fileBytes);
                fos.flush();
            }

            Uri fileUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    file
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType != null ? mimeType : "application/octet-stream");
            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, title != null ? title : filename);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            activity.startActivity(Intent.createChooser(shareIntent, title != null ? title : "Share Document"));
        } catch (Exception e) {
            Log.e(TAG, "Error sharing file via Android Intent", e);
            activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Share error: " + e.getMessage(), Toast.LENGTH_SHORT).show()
            );
        }
    }

    /**
     * Show a native Android Toast
     */
    @JavascriptInterface
    public void showToast(String message) {
        if (message != null) {
            activity.runOnUiThread(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
        }
    }
}
