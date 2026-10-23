package com.survivor.game;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * APK 自動更新插件（僅 Android）：
 * - getVersion            取得目前 APK 的 versionName
 * - downloadAndInstall    下載新版 APK 並呼叫系統安裝器（含進度事件）
 * - openInstallPermission 前往「允許安裝未知應用程式」設定頁（Android 8+）
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void getVersion(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            String versionName = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0).versionName;
            ret.put("version", versionName == null ? "" : versionName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("無法取得目前版本: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("缺少下載網址。");
            return;
        }
        // Android 8+ 必須先取得「安裝未知應用程式」同意，否則無法啟動安裝
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !canRequestPackageInstalls()) {
            JSObject ret = new JSObject();
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }
        final String downloadUrl = url.trim();
        new Thread(() -> {
            try {
                File apk = downloadApk(downloadUrl);
                launchInstaller(apk);
                postResolve(call, "started", true);
            } catch (Exception e) {
                postReject(call, "下載或安裝失敗: " + e.getMessage());
            }
        }, "apk-update-download").start();
    }

    @PluginMethod
    public void openInstallPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Uri uri = Uri.parse("package:" + getContext().getPackageName());
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, uri);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("無法開啟安裝權限設定頁: " + e.getMessage());
        }
    }

    private boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        try {
            return getContext().getPackageManager().canRequestPackageInstalls();
        } catch (Exception e) {
            return false;
        }
    }

    /** 下載 APK 到 cache/updates/，支援重新導向並回報進度事件。 */
    private File downloadApk(String downloadUrl) throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("無法建立下載資料夾。");
        }
        File target = new File(dir, "survivor-game-update.apk");
        if (target.exists()) {
            // noinspection ResultOfMethodCallIgnored
            target.delete();
        }

        HttpURLConnection conn = null;
        String currentUrl = downloadUrl;
        int redirects = 0;
        while (true) {
            conn = (HttpURLConnection) new URL(currentUrl).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(30000);
            int status = conn.getResponseCode();
            if (status >= 300 && status < 400) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || ++redirects > 5) {
                    throw new Exception("重新導向次數過多。");
                }
                currentUrl = new URL(new URL(currentUrl), location).toString();
                continue;
            }
            if (status < 200 || status >= 300) {
                conn.disconnect();
                throw new Exception("伺服器回應 HTTP " + status);
            }
            break;
        }

        long total = conn.getContentLengthLong();
        try (InputStream in = conn.getInputStream();
             OutputStream out = new FileOutputStream(target)) {
            byte[] buf = new byte[8192];
            long done = 0;
            int lastPercent = -1;
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                done += n;
                if (total > 0) {
                    int percent = (int) (done * 100 / total);
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        notifyListeners("downloadProgress", progress);
                    }
                }
            }
        } finally {
            conn.disconnect();
        }
        if (target.length() <= 0) {
            // noinspection ResultOfMethodCallIgnored
            target.delete();
            throw new Exception("下載內容為空。");
        }
        return target;
    }

    /** 以 FileProvider URI 呼起系統套件安裝器。 */
    private void launchInstaller(File apk) throws Exception {
        Uri uri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android-package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private void postResolve(PluginCall call, String key, boolean value) {
        mainHandler.post(() -> {
            JSObject ret = new JSObject();
            ret.put(key, value);
            call.resolve(ret);
        });
    }

    private void postReject(PluginCall call, String message) {
        mainHandler.post(() -> call.reject(message));
    }
}
