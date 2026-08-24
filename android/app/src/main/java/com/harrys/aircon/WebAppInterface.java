package com.harrys.aircon;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
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

import androidx.core.content.ContextCompat;
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
     * Identifies that the app is executing inside the native Android APK environment
     */
    @JavascriptInterface
    public boolean isAndroidApp() {
        return true;
    }

    /**
     * Save Base64 file directly to device's public Downloads folder with multi-tier failover:
     * - Tier 1: Android 10+ (API 29+) MediaStore Downloads Scoped Storage
     * - Tier 2: Public External Downloads directory with MediaScanner
     * - Tier 3: App-specific External Storage directory (always 100% permitted without runtime prompts)
     * - Automatic System Notification & Toast feedback
     */
    @JavascriptInterface
    public void saveFile(String base64Data, String filename, String mimeType) {
        if (base64Data == null || filename == null || filename.trim().isEmpty()) {
            Log.e(TAG, "saveFile error: base64Data or filename is empty");
            activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Error: No file data provided to save", Toast.LENGTH_SHORT).show()
            );
            return;
        }

        try {
            // Clean base64 header if present (e.g. data:application/pdf;base64,...)
            String rawBase64 = base64Data.contains(",") ? base64Data.split(",")[1] : base64Data;
            byte[] fileBytes = Base64.decode(rawBase64.trim(), Base64.DEFAULT);

            if (mimeType == null || mimeType.trim().isEmpty()) {
                mimeType = inferMimeType(filename);
            }

            boolean savedSuccessfully = false;
            Uri savedUri = null;
            File savedFile = null;

            // Tier 1: Modern Android 10+ MediaStore Downloads
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    ContentResolver resolver = activity.getContentResolver();
                    ContentValues contentValues = new ContentValues();
                    contentValues.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                    contentValues.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    contentValues.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/HarrysFieldOps");

                    savedUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues);
                    if (savedUri == null) {
                        // Fallback to standard Downloads root
                        contentValues.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        savedUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues);
                    }

                    if (savedUri != null) {
                        try (OutputStream outputStream = resolver.openOutputStream(savedUri)) {
                            if (outputStream != null) {
                                outputStream.write(fileBytes);
                                outputStream.flush();
                                savedSuccessfully = true;
                            }
                        }
                    }
                } catch (Exception mediaStoreEx) {
                    Log.w(TAG, "MediaStore save failed, attempting direct filesystem fallback", mediaStoreEx);
                }
            }

            // Tier 2: Public External Downloads Directory (Android 9 and below or MediaStore fallback)
            if (!savedSuccessfully) {
                try {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File subDir = new File(downloadsDir, "HarrysFieldOps");
                    if (!subDir.exists()) {
                        subDir.mkdirs();
                    }
                    File targetFile = new File(subDir.exists() ? subDir : downloadsDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                        savedSuccessfully = true;
                        savedFile = targetFile;
                    }

                    // Scan file so it displays instantly in Files / Downloads app
                    MediaScannerConnection.scanFile(
                            activity,
                            new String[]{targetFile.getAbsolutePath()},
                            new String[]{mimeType},
                            null
                    );
                } catch (Exception pubDirEx) {
                    Log.w(TAG, "Public directory write failed, falling back to app-specific external storage", pubDirEx);
                }
            }

            // Tier 3: App-specific External Storage (Always 100% permitted across all Android versions)
            if (!savedSuccessfully) {
                try {
                    File appExtDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (appExtDir == null) {
                        appExtDir = activity.getFilesDir();
                    }
                    if (!appExtDir.exists()) {
                        appExtDir.mkdirs();
                    }
                    File targetFile = new File(appExtDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                        savedSuccessfully = true;
                        savedFile = targetFile;
                    }

                    MediaScannerConnection.scanFile(
                            activity,
                            new String[]{targetFile.getAbsolutePath()},
                            new String[]{mimeType},
                            null
                    );
                } catch (Exception appExtEx) {
                    Log.e(TAG, "App-specific external storage write failed", appExtEx);
                }
            }

            if (savedSuccessfully) {
                final String finalName = filename;
                final File finalSavedFile = savedFile;
                final Uri finalSavedUri = savedUri;
                final String finalMime = mimeType;

                activity.runOnUiThread(() -> {
                    Toast.makeText(activity, "Saved to Downloads: " + finalName, Toast.LENGTH_LONG).show();
                    activity.triggerDownloadNotification(finalName, finalSavedFile, finalSavedUri, finalMime);
                });
            } else {
                activity.runOnUiThread(() ->
                        Toast.makeText(activity, "Could not save file to device storage. Please check permissions.", Toast.LENGTH_LONG).show()
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "Fatal error saving file to device", e);
            activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Failed to save file: " + e.getMessage(), Toast.LENGTH_SHORT).show()
            );
        }
    }

    /**
     * Directly open document in external viewer (Drive PDF Viewer, Adobe, Office, etc.)
     */
    @JavascriptInterface
    public void openFile(String base64Data, String filename, String mimeType) {
        try {
            String rawBase64 = base64Data.contains(",") ? base64Data.split(",")[1] : base64Data;
            byte[] fileBytes = Base64.decode(rawBase64.trim(), Base64.DEFAULT);

            if (mimeType == null || mimeType.trim().isEmpty()) {
                mimeType = inferMimeType(filename);
            }

            File cachePath = new File(activity.getCacheDir(), "opened_docs");
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

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(fileUri, mimeType);
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooser = Intent.createChooser(viewIntent, "Open " + filename);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(chooser);
        } catch (Exception e) {
            Log.e(TAG, "Error opening document via Android Intent", e);
            activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Unable to open document: " + e.getMessage(), Toast.LENGTH_SHORT).show()
            );
        }
    }

    /**
     * Direct file sharing via Android Intent Chooser
     */
    @JavascriptInterface
    public void shareFile(String base64Data, String filename, String mimeType, String title) {
        try {
            String rawBase64 = base64Data.contains(",") ? base64Data.split(",")[1] : base64Data;
            byte[] fileBytes = Base64.decode(rawBase64.trim(), Base64.DEFAULT);

            if (mimeType == null || mimeType.trim().isEmpty()) {
                mimeType = inferMimeType(filename);
            }

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
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, title != null ? title : filename);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, title != null ? title : "Share Document");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(chooser);
        } catch (Exception e) {
            Log.e(TAG, "Error sharing file via Android Intent", e);
            activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Share error: " + e.getMessage(), Toast.LENGTH_SHORT).show()
            );
        }
    }

    /**
     * Native Android Print Adapter (invokes Android PrintManager for Print to PDF / Wi-Fi Printers)
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
     * Directly streams generated vector PDF bytes into Android PrintManager (Print to PDF / Network Printers)
     */
    @JavascriptInterface
    public void printPdf(String base64Pdf, String jobTitle) {
        activity.runOnUiThread(() -> {
            try {
                if (base64Pdf == null || base64Pdf.trim().isEmpty()) {
                    printDocument();
                    return;
                }

                String rawBase64 = base64Pdf.contains(",") ? base64Pdf.split(",")[1] : base64Pdf;
                byte[] pdfBytes = Base64.decode(rawBase64.trim(), Base64.DEFAULT);

                File printDir = new File(activity.getCacheDir(), "print_docs");
                if (!printDir.exists()) {
                    printDir.mkdirs();
                }
                String safeTitle = (jobTitle != null && !jobTitle.trim().isEmpty())
                        ? jobTitle.replaceAll("[^a-zA-Z0-9_.-]", "_")
                        : "Harrys_Document";
                File tempPdf = new File(printDir, safeTitle + ".pdf");
                try (FileOutputStream fos = new FileOutputStream(tempPdf)) {
                    fos.write(pdfBytes);
                    fos.flush();
                }

                PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                if (printManager != null) {
                    PrintDocumentAdapter printAdapter = new PrintDocumentAdapter() {
                        @Override
                        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                                             android.os.CancellationSignal cancellationSignal,
                                             LayoutResultCallback callback, Bundle extras) {
                            if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                                callback.onLayoutCancelled();
                                return;
                            }
                            android.print.PrintDocumentInfo info = new android.print.PrintDocumentInfo.Builder(safeTitle + ".pdf")
                                    .setContentType(android.print.PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                                    .setPageCount(android.print.PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                                    .build();
                            callback.onLayoutFinished(info, !newAttributes.equals(oldAttributes));
                        }

                        @Override
                        public void onWrite(android.print.PageRange[] pages,
                                            android.os.ParcelFileDescriptor destination,
                                            android.os.CancellationSignal cancellationSignal,
                                            WriteResultCallback callback) {
                            try (java.io.InputStream input = new java.io.FileInputStream(tempPdf);
                                 java.io.OutputStream output = new java.io.FileOutputStream(destination.getFileDescriptor())) {
                                byte[] buf = new byte[16384];
                                int bytesRead;
                                while ((bytesRead = input.read(buf)) > 0) {
                                    if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                                        callback.onWriteCancelled();
                                        return;
                                    }
                                    output.write(buf, 0, bytesRead);
                                }
                                callback.onWriteFinished(new android.print.PageRange[]{android.print.PageRange.ALL_PAGES});
                            } catch (Exception e) {
                                Log.e(TAG, "Error writing PDF to print spooler", e);
                                callback.onWriteFailed(e.getMessage());
                            }
                        }
                    };

                    printManager.print(
                            safeTitle,
                            printAdapter,
                            new PrintAttributes.Builder()
                                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                    .build()
                    );
                } else {
                    openFile(base64Pdf, safeTitle + ".pdf", "application/pdf");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in printPdf", e);
                openFile(base64Pdf, "Document.pdf", "application/pdf");
            }
        });
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

    private String inferMimeType(String filename) {
        if (filename == null) return "application/octet-stream";
        String lower = filename.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }
}

