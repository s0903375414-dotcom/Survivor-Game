# 🔥 Firebase 後端設定指南

此指南會幫你建立真正的雲端系統，解決帳號消失、存檔不見、排行榜異常的問題！

## 📋 第一步：建立 Firebase 專案

1.  前往 [Firebase Console](https://console.firebase.google.com/)
2.  按 **建立專案** (或新增專案)
3.  輸入專案名稱，例如 `SurvivorGame`
4.  按繼續，關閉 Google Analytics (除非你想要)
5.  按建立專案

## 📱 第二步：註冊應用程式

1.  進入 Firebase 專案後，在 **專案總覽** 頁面，按中間的 **網頁圖示** (</>)
2.  應用程式名稱輸入 `Survivor Game`
3.  **不要**勾選「設定 Firebase Hosting」
4.  按 **註冊應用程式**
5.  複製 `firebaseConfig` 物件的內容

## ⚙️ 第三步：建立設定檔

1.  在遊戲目錄 (`games/survivor_game/`) 建立一個新檔案叫做 `firebase-config.js`
2.  填入以下內容，貼上你複製的設定：

```javascript
// firebase-config.js
const firebaseConfig = {
  // 替換這裡為你 Firebase 提供的設定
  apiKey: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890"
};

// 這行不要改！
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
```

## 🔐 第四步：啟用註冊/登入

1.  在左側選單進入 **Authentication** (驗證方式)
2.  按 **開始使用**
3.  選擇 **電子郵件/密碼**
4.  將第一個開關 (Email/Password) 設為 **啟用**
5.  按 **儲存**

## 📊 第五步：建立 Firestore 資料庫

1.  在左側選單進入 **Firestore Database** (雲端 Firestore)
2.  按 **建立資料庫**
3.  選擇 **開始於測試模式** (安全起見，後續可再調整)
4.  按 **下一步**
5.  選擇地區 (建議選台灣附近的，例如 `asia-east1`)
6.  按 **啟用**

### 設定安全規則 (重要！)

建立資料庫後，進入 **規則** 頁籤，把內容改為：

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 任何人都可以讀寫排行榜 (方便測試)
    match /leaderboard/{document} {
      allow read, write: if true;
    }
    
    // 只有已登入的使用者可以讀寫自己的資料
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

按 **發布**

## 🚀 完成！

重新整理遊戲，你會看到：
- ✅ 註冊/登入系統會使用真正的 Firebase 後端
- ✅ 存檔會自動上傳雲端，換電腦也不怕丟
- ✅ 排行榜會即時同步
- ✅ 帳號永遠不會憑空消失！

## 📝 備註

如果你想使用 **Google 登入**，只要在 Firebase Authentication 中啟用 Google 登入即可，遊戲會自動支援！

**注意**：如果有安全考量，請不要用測試模式太久，建議設定適當的安全規則。
