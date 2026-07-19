// 將此檔案重新命名為 firebase-config.js，並填入您的 Firebase 設定
// 到 https://console.firebase.google.com 建立專案後，在「專案設定」找到「應用程式」的 SDK 設定

const firebaseConfig = {
  // TODO: 將以下替換為您 Firebase 專案的實際設定
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 初始化 Firebase (這個檔案只是範本，遊戲會自動偵測是否有正確設定)
console.warn('⚠️ 警告：請建立 firebase-config.js 並填入您的 Firebase 設定');
