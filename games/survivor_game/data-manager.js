// 資料管理員 - 統一管理帳號、存檔、排行榜
// 自動偵測 Firebase 是否設定，有就用 Firebase，沒有用回 localStorage

const DataManager = (function() {
    let firebaseAvailable = false;
    let db = null;
    let auth = null;

    // 初始化
    function init() {
        // 檢查是否有 Firebase 設定
        if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
            try {
                initializeFirebase();
                firebaseAvailable = true;
                console.log('✅ Firebase 後端系統已啟用');
            } catch (e) {
                console.warn('⚠️ Firebase 初始化失敗，改用本地存儲');
                firebaseAvailable = false;
            }
        } else {
            console.log('📦 使用本地存儲模式 (尚未設定 Firebase)');
        }
    }

    function initializeFirebase() {
        // 檢查是否已載入 Firebase SDK
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK 尚未載入');
        }
        
        // 初始化應用
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        db = firebase.firestore();
        auth = firebase.auth();
        
        // 監聽登入狀態
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('🔐 已登入 Firebase:', user.email);
                syncFromCloud(); // 登入時自動同步
            } else {
                console.log('🔓 已登出 Firebase');
            }
        });
    }

    // ===== 帳號系統 =====

    async function register(email, password, username) {
        if (firebaseAvailable) {
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // 建立使用者檔案
                await db.collection('users').doc(user.uid).set({
                    username: username,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    funds: 0,
                    highestScore: 0
                });
                
                return {
                    success: true,
                    user: { uid: user.uid, username: username, email: email }
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            // 使用本機註冊系統 (舊版)
            return legacyRegister(email, password, username);
        }
    }

    async function login(email, password) {
        if (firebaseAvailable) {
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
                const userData = userDoc.data();
                
                return {
                    success: true,
                    user: { 
                        uid: userCredential.user.uid, 
                        username: userData.username, 
                        email: email 
                    }
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            return legacyLogin(email, password);
        }
    }

    async function logout() {
        if (firebaseAvailable) {
            await auth.signOut();
        }
    }

    // ===== 存檔系統 =====

    async function saveProgress(data) {
        if (firebaseAvailable && auth.currentUser) {
            try {
                await db.collection('users').doc(auth.currentUser.uid).update({
                    ...data,
                    lastSaved: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('☁️ 存檔已上傳到雲端');
            } catch (e) {
                console.error('雲端存檔失敗', e);
                saveToLocal(data); // 失敗時存到本地備份
            }
        } else {
            saveToLocal(data);
        }
    }

    async function loadProgress() {
        if (firebaseAvailable && auth.currentUser) {
            try {
                const doc = await db.collection('users').doc(auth.currentUser.uid).get();
                if (doc.exists) {
                    return doc.data();
                }
            } catch (e) {
                console.error('讀取雲端存檔失敗', e);
            }
        }
        return loadFromLocal();
    }

    function saveToLocal(data) {
        const prefix = currentUser ? `_${currentUser.username}` : '';
        if (data.funds !== undefined) localStorage.setItem(`survivor_funds${prefix}`, String(data.funds));
        if (data.unitsOwned !== undefined) localStorage.setItem(`survivor_units_owned${prefix}`, JSON.stringify(data.unitsOwned));
        if (data.unitsEquipped !== undefined) localStorage.setItem(`survivor_units_equipped${prefix}`, JSON.stringify(data.unitsEquipped));
    }

    function loadFromLocal() {
        const prefix = currentUser ? `_${currentUser.username}` : '';
        return {
            funds: parseInt(localStorage.getItem(`survivor_funds${prefix}`) || '0'),
            unitsOwned: JSON.parse(localStorage.getItem(`survivor_units_owned${prefix}`) || '{}'),
            unitsEquipped: JSON.parse(localStorage.getItem(`survivor_units_equipped${prefix}`) || '{}')
        };
    }

    async function syncFromCloud() {
        if (!firebaseAvailable || !auth.currentUser) return;
        
        const cloudData = await loadProgress();
        const localData = loadFromLocal();
        
        // 比較並合併 (取最大值)
        const merged = {
            funds: Math.max(cloudData.funds || 0, localData.funds || 0),
            unitsOwned: { ...localData.unitsOwned, ...cloudData.unitsOwned },
            unitsEquipped: { ...localData.unitsEquipped, ...cloudData.unitsEquipped }
        };
        
        // 存回兩邊
        await saveProgress(merged);
        console.log('🔄 資料同步完成');
    }

    // ===== 排行榜系統 =====

    async function submitScore(score) {
        if (firebaseAvailable && auth.currentUser) {
            await db.collection('leaderboard').add({
                username: currentUser.username,
                userId: auth.currentUser.uid,
                score: score,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // 同時更新本地排行榜 (向後相容)
        const localList = loadLocalLeaderboard();
        localList.push({ name: currentUser?.username || '訪客', score: score, time: Date.now() });
        localList.sort((a, b) => b.score - a.score);
        saveLocalLeaderboard(localList.slice(0, 100));
    }

    async function getLeaderboard(limit = 20) {
        if (firebaseAvailable) {
            const snapshot = await db.collection('leaderboard')
                .orderBy('score', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => {
                const d = doc.data();
                return { name: d.username, score: d.score, time: d.timestamp?.toDate?.()?.getTime?.() || 0 };
            });
        }
        
        return loadLocalLeaderboard().slice(0, limit);
    }

    function loadLocalLeaderboard() {
        try {
            const raw = localStorage.getItem('survivor_leaderboard');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function saveLocalLeaderboard(list) {
        localStorage.setItem('survivor_leaderboard', JSON.stringify(list));
    }

    // ===== 舊版相容性函數 =====

    function legacyRegister(email, password, username) {
        // 舊版 localStorage 註冊邏輯
        const v2Raw = localStorage.getItem('survivor_accounts_v2');
        const v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
        
        if (v2Accounts[email]) {
            return { success: false, error: '此信箱已註冊' };
        }
        
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = ((hash << 5) - hash) + username.charCodeAt(i);
            hash |= 0;
        }
        const uidSuffix = Math.abs(hash % 10000).toString().padStart(4, '0');
        const uid = 'CMD_' + uidSuffix;
        
        v2Accounts[email] = {
            password: password,
            user: { username, uid, email }
        };
        
        localStorage.setItem('survivor_accounts_v2', JSON.stringify(v2Accounts));
        
        return { success: true, user: { username, uid, email } };
    }

    function legacyLogin(email, password) {
        const v2Raw = localStorage.getItem('survivor_accounts_v2');
        const v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
        
        if (v2Accounts[email] && v2Accounts[email].password === password) {
            return { success: true, user: v2Accounts[email].user };
        }
        
        // 檢查舊版帳號
        const accRaw = localStorage.getItem('survivor_accounts');
        const accounts = accRaw ? JSON.parse(accRaw) : {};
        if (accounts[email] && accounts[email].password === password) {
            return { success: true, user: accounts[email].user };
        }
        
        return { success: false, error: '帳號或密碼錯誤' };
    }

    // 公開 API
    return {
        init,
        register,
        login,
        logout,
        saveProgress,
        loadProgress,
        submitScore,
        getLeaderboard,
        isFirebaseEnabled: () => firebaseAvailable
    };
})();

// 自動初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DataManager.init());
} else {
    DataManager.init();
}
