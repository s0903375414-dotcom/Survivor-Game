# Android APK（Survivor Game）

## 編譯

在專案根目錄執行 `build-android.bat`。成功後 APK 位於：

`android/app/build/outputs/apk/debug/app-debug.apk`

這是可直接安裝測試的 debug APK；尚未簽署成 Play 商店發布版。

## 首次啟動：連接遊戲伺服器

遊戲的多人邏輯由 `server.js` 提供，APK 不會在手機內啟動 Node.js 伺服器。第一次開啟 APK 時會詢問伺服器位址，並記住設定。

同一個 Wi-Fi 網路測試：

1. 在電腦專案資料夾執行 `node server.js`，保持視窗開啟。
2. 在 Windows 執行 `ipconfig`，找出目前 Wi-Fi 網卡的 IPv4 位址（不要用 `127.0.0.1`）。
3. 手機連上同一個 Wi-Fi，在 APK 提示輸入 `http://電腦IPv4:8080`，例如 `http://192.168.1.20:8080`。
4. 若 Windows 防火牆詢問是否允許 Node.js 通訊，允許私人網路；若連不上，需允許 TCP 8080 入站。

若使用已部署的伺服器，輸入其 `https://` 網址（會自動改用安全 WebSocket）。

## 自動更新（APK 內建）

APK 內建自動更新機制：啟動後會向遊戲伺服器查詢 `/app/version`，與自身版本比較，
有新版時跳出「發現新版本」視窗，下載後呼起系統安裝器（Android 規定側載 App
最後一定會出現系統安裝確認鈕，無法完全靜默安裝）。

### 發布新版

```
node scripts/release-apk.js <版本號> [更新說明...]
範例: node scripts/release-apk.js 1.2 修正橫向選單顯示
```

腳本會自動：versionName 跳版 → versionCode +1 → 建置 APK → 複製到
`releases/survivor-game.apk` → 更新 `releases/app_release.json`。
電腦端 `node server.js` 保持開啟，同一 Wi-Fi 下的 APK 開啟時就會提示更新。

### 首次安裝更新版

第一次仍需手動把含更新器的 APK 裝進手機一次：
手機瀏覽器直接開 `http://電腦IPv4:8080/releases/survivor-game.apk` 下載安裝
（伺服器靜態功能已可直接下載），之後的版本更新就會走內建流程。

- 首次在 APK 內更新時，Android 8+ 會要求允許「安裝未知應用程式」，
  更新視窗會自動帶你到設定頁，開啟後返回再按一次「立即更新」即可。
- 安裝必須簽章一致：目前使用本機 debug keystore，**換電腦/清掉
  `%USERPROFILE%\.android\debug.keystore` 會導致無法覆蓋安裝**，需先解除安裝
  （本地存檔會一併消失）。
- 電腦未開伺服器或手機不在同網段時，更新檢查會靜默略過，不影響遊戲。

## 注意

- 沒有可連線的遊戲伺服器時，APK 可開啟但多人連線無法使用；不需要在建置前知道伺服器位址。
- Google 登入仍需在 Google Identity Services/Firebase 設定中允許實際使用的來源；原本桌面 OAuth 設定不一定涵蓋 Android WebView。
- 目前 APK 固定橫向顯示，並開啟明文網路權限，以支援區網 `ws://` 測試。正式公開部署建議只使用 HTTPS/WSS。
