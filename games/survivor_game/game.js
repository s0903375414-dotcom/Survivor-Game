const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const hpDisplay = document.getElementById('hp-display');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const xpBarFill = document.getElementById('xp-bar-fill');
const airSupportFill = document.getElementById('air-support-fill');
const gameOverScreen = document.getElementById('game-over-screen');
const startScreen = document.getElementById('start-screen');
const airRaidWarning = document.getElementById('air-raid-warning');
const gameNotification = document.getElementById('game-notification');
const notificationText = document.getElementById('notification-text');
const warningTimerDisplay = document.getElementById('warning-timer');
const finalScoreDisplay = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const startBtn = document.getElementById('start-btn');
const multiplayerBtn = document.getElementById('multiplayer-btn');
const fundsDisplay = document.getElementById('funds-display');
const highestScoreDisplay = document.getElementById('highest-score-display');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const adminClearDataBtn = document.getElementById('admin-clear-data-btn');
const adminViewFeedbackBtn = document.getElementById('admin-view-feedback-btn');

// Login UI Elements
const loginModal = document.getElementById('login-modal');
const loginTriggerBtn = document.getElementById('login-trigger-btn');
const closeLoginBtn = document.getElementById('close-login-btn');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const logoutBtn = document.getElementById('logout-btn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const displayUserName = document.getElementById('display-user-name');
const displayUid = document.getElementById('display-uid');

// Google Login Client ID (請替換為您自己的 Google Client ID)
const GOOGLE_CLIENT_ID = "643599361893-kfpu7q0kcl6gfij0j32engfq2r76g9kg.apps.googleusercontent.com";

// Feedback UI Elements
const feedbackModal = document.getElementById('feedback-modal');
const feedbackTriggerBtn = document.getElementById('feedback-trigger-btn');
const closeFeedbackBtn = document.getElementById('close-feedback-btn');
const feedbackSubmitBtn = document.getElementById('feedback-submit-btn');
const feedbackContentInput = document.getElementById('feedback-content');
const adminFeedbackModal = document.getElementById('admin-feedback-modal');
const adminFeedbackList = document.getElementById('admin-feedback-list');
const closeAdminFeedbackBtn = document.getElementById('close-admin-feedback-btn');
const clearFeedbacksBtn = document.getElementById('clear-feedbacks-btn');

// Level Up UI
const levelupModal = document.getElementById('levelup-modal');
const upgradeOptionsContainer = document.getElementById('upgrade-options');

// In-game Menu UI
const pauseModal = document.getElementById('pause-modal');
const inGameMenuBtn = document.getElementById('in-game-menu-btn');
const resumeBtn = document.getElementById('resume-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const unitModal = document.getElementById('unit-modal');
const unitListContainer = document.getElementById('unit-list');
const closeUnitBtn = document.getElementById('close-unit-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardListPanel = document.getElementById('leaderboard-list-panel');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const lobbyModal = document.getElementById('lobby-modal');
const roomListContainer = document.getElementById('room-list');
const closeLobbyBtn = document.getElementById('close-lobby-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const refreshLobbyBtn = document.getElementById('refresh-lobby-btn');

// Game State
let currentUser = null;
let gameRunning = false;
let isPaused = false;
let score = 0;
let totalKills = 0;
let animationId;
let lastTime = 0;
let screenShake = 0;
let militaryFunds = 0;
let ownedUnits = {};
let equippedUnits = {};
let fundsGainMultiplier = 1;
let mouseDown = false;

// Air Support State
const airSupportConfig = {
    cooldown: 15000, // 15 seconds
    lastUsed: 0,
    active: false,
    strikeCount: 12,
    strikeRadius: 150,
    strikeDamage: 200
};

// Upgrades State
const playerUpgrades = {
    multishot: { level: 0, maxLevel: Infinity, name: '火力網擴張', desc: '同步發射更多彈藥', icon: '🎯' },
    fireRate: { level: 0, maxLevel: Infinity, name: '射控優化', desc: '降低射擊冷卻時間', icon: '⚡' },
    damage: { level: 0, maxLevel: Infinity, name: '高能彈頭', desc: '強化子彈視覺與威力', icon: '📈' },
    speed: { level: 0, maxLevel: Infinity, name: '推進強化', desc: '提升戰術移動速度', icon: '💨' },
    hp: { level: 0, maxLevel: Infinity, name: '修復奈米', desc: '自動修復受損裝甲', icon: '🛡️' }
};

// Audio System
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let musicEnabled = true;
let menuAudio = null;
let gameAudio = null;
let menuGainNode = null;
let gameGainNode = null;

// Resume AudioContext on first click (Autoplay Policy)
const resumeAudio = async () => {
    try {
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
            console.log("AudioContext resumed successfully.");
        }
        // Try to start menu music if it hasn't started yet
        if (musicEnabled && !menuMusicPlaying && !gameRunning) {
            startMenuMusic();
        }
    } catch (err) {
        console.error("AudioContext resume failed:", err);
    }
    window.removeEventListener('mousedown', resumeAudio);
    window.removeEventListener('keydown', resumeAudio);
};
window.addEventListener('mousedown', resumeAudio);
window.addEventListener('keydown', resumeAudio);

const gamePlaylist = ['connect_the_world.ogg']; // Only include existing for stability
let currentTrackIndex = 0;

const menuPlaylist = ['menu_theme.mp3']; // Only include existing for stability
let currentMenuTrackIndex = 0;

function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    switch(type) {
        case 'shoot':
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(400, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
        case 'hit':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(100, now);
            oscillator.frequency.linearRampToValueAtTime(50, now + 0.1);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
        case 'kill':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(200, now);
            oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            oscillator.start(now);
            oscillator.stop(now + 0.2);
            break;
        case 'xp':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, now);
            oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            oscillator.start(now);
            oscillator.stop(now + 0.05);
            break;
        case 'levelup':
            oscillator.type = 'square';
            [440, 554, 659, 880].forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, now + i * 0.1);
                g.gain.setValueAtTime(0.05, now + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.1);
                osc.connect(g);
                g.connect(audioCtx.destination);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.1);
            });
            break;
        case 'explosion':
            // Realistic Explosion using Noise Buffer
            const bufferSize = audioCtx.sampleRate * 1.5; // 1.5 seconds
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(1000, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(10, now + 1);
            
            const noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.8, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(audioCtx.destination);
            noise.start(now);
            break;
        case 'alarm':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(400, now);
            oscillator.frequency.linearRampToValueAtTime(800, now + 0.5);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0.1, now + 0.5);
            gainNode.gain.linearRampToValueAtTime(0, now + 1.0);
            oscillator.start(now);
            oscillator.stop(now + 1.0);
            break;
        case 'jet_flyover':
            const jetOsc = audioCtx.createOscillator();
            const jetGain = audioCtx.createGain();
            const jetFilter = audioCtx.createBiquadFilter();
            
            jetOsc.type = 'sawtooth';
            jetOsc.frequency.setValueAtTime(100, now);
            jetOsc.frequency.exponentialRampToValueAtTime(50, now + 2);
            
            jetFilter.type = 'lowpass';
            jetFilter.frequency.setValueAtTime(200, now);
            jetFilter.frequency.linearRampToValueAtTime(2000, now + 1); // Whoosh in
            jetFilter.frequency.linearRampToValueAtTime(200, now + 2);   // Whoosh out

            jetGain.gain.setValueAtTime(0, now);
            jetGain.gain.linearRampToValueAtTime(0.2, now + 1);
            jetGain.gain.linearRampToValueAtTime(0, now + 2);

            jetOsc.connect(jetFilter);
            jetFilter.connect(jetGain);
            jetGain.connect(audioCtx.destination);
            jetOsc.start(now);
            jetOsc.stop(now + 2);
             break;
    }
}

function playRadioVoice(text) {
    const now = audioCtx.currentTime;
    
    // 1. Radio Static Noise
    const bufferSize = audioCtx.sampleRate * 2.5; // Slightly longer than speech
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.1; // Low volume noise
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    // Bandpass filter for radio effect
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 2);
    gain.gain.linearRampToValueAtTime(0, now + 2.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);

    // 2. Speech
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = 0.9; // Slower, more deliberate
        utterance.pitch = 0.6; // Deep male voice
        
        // Try to find a male voice if possible
        const voices = window.speechSynthesis.getVoices();
        const maleVoice = voices.find(v => v.name.includes('Male') || v.name.includes('David') || v.name.includes('Danny'));
        if (maleVoice) utterance.voice = maleVoice;
        
        window.speechSynthesis.speak(utterance);
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Game Configuration
const config = {
    // Infinite map settings
    gridSize: 100,
    
    // Player settings (同步 SharedConfig)
    playerSpeed: (typeof SharedConfig !== 'undefined') ? SharedConfig.PLAYER.BASE_SPEED : 6,
    fireRate: (typeof SharedConfig !== 'undefined') ? SharedConfig.PLAYER.FIRE_RATE : 150, // ms
    
    // Projectile settings
    projectileSpeed: (typeof SharedConfig !== 'undefined') ? SharedConfig.PLAYER.BULLET_SPEED : 9,
    projectileRadius: 5,
    projectileDamage: (typeof SharedConfig !== 'undefined') ? SharedConfig.PLAYER.BULLET_DAMAGE : 25,
    
    // Enemy settings
    enemySpawnRate: 1000, // ms
};

const unitDefinitions = {
    drone: {
        id: 'drone',
        name: '攻擊無人機中隊',
        desc: '開局即獲得額外火力，每次射擊多一發子彈。',
        cost: 5000,
        icon: '🛸'
    },
    medic: {
        id: 'medic',
        name: '前線醫療小隊',
        desc: '提升最大生命值並在出戰時完全修復裝甲。',
        cost: 4000,
        icon: '⛑️'
    },
    logistics: {
        id: 'logistics',
        name: '後勤補給線',
        desc: '提升軍資獲取效率，戰後可獲得更多軍資。',
        cost: 6000,
        icon: '📦'
    }
};

// Entities
let player;
let projectiles = [];
let enemies = [];
let particles = [];
let xpOrbs = [];
let moneyDrops = [];
let healthPacks = [];
let explosions = [];
let fighterJets = [];
let bombs = [];
let shards = [];

// Targeting System
let targetingState = {
    active: false,
    mode: 'manual', // 'manual' or 'auto'
    x: 0,
    y: 0,
    locked: false
};
let mouseX = 0;
let mouseY = 0;

// Camera
let camera = {
    x: 0,
    y: 0
};

// Event Listeners
window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = true;
    }
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = false;
    }
});

startBtn.addEventListener('click', startGame);
if (multiplayerBtn) {
    multiplayerBtn.addEventListener('click', () => {
        lobbyModal.classList.remove('hidden');
        multiplayer.connect();
    });
}
restartBtn.addEventListener('click', startGame);
menuBtn.addEventListener('click', showMainMenu);

// Login Logic

function saveUserSession() {
    if (currentUser) {
        localStorage.setItem('survivor_user', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('survivor_user');
    }
}

function handleLogin() {
    // 直接從 DOM 獲取最新數值，確保抓得到內容
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    const username = usernameEl ? usernameEl.value.trim() : '';
    const password = passwordEl ? passwordEl.value.trim() : '';

    if (!username || !password) {
        alert('請輸入帳號與密碼');
        return;
    }

    // Load account database
    const accountsRaw = localStorage.getItem('survivor_accounts');
    let accounts = accountsRaw ? JSON.parse(accountsRaw) : {};

    // Special Case: Dev Account (支援 Dev 與 開發人員)
    if (username === 'Dev' || username === '開發人員' || username === 'Developer' || username === 'Admin') {
        currentUser = { username: '開發團隊', uid: 'DEV_001', isAdmin: true };
        saveUserSession();
        loadMetaProgress();
        updateUserUI();
        loginModal.classList.add('hidden');
        alert(`歡迎回來，${currentUser.username} 指揮官！`);
        renderLeaderboard();
        return;
    }

    // Check if account exists
    if (accounts[username]) {
        // Login Flow
        if (accounts[username].password !== password) {
            alert('錯誤：帳號名已被使用，或是密碼輸入錯誤！');
            return;
        }
        currentUser = accounts[username].user;
    } else {
        // Registration Flow (New Account)
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = ((hash << 5) - hash) + username.charCodeAt(i);
            hash |= 0;
        }
        const uidSuffix = Math.abs(hash % 10000).toString().padStart(4, '0');
        const uid = 'CMD_' + uidSuffix;
        
        currentUser = { username, uid, isAdmin: false };
        accounts[username] = { password, user: currentUser };
        
        // Save to database
        localStorage.setItem('survivor_accounts', JSON.stringify(accounts));
        
        // Force reset progress for NEW account (No reading previous local saves)
        const prefix = `_${username}`;
        localStorage.removeItem(`survivor_funds${prefix}`);
        localStorage.removeItem(`survivor_units_owned${prefix}`);
        localStorage.removeItem(`survivor_units_equipped${prefix}`);
    }
    
    saveUserSession();
    
    // Load meta progress (will be fresh if new account)
    loadMetaProgress(); 
    updateUserUI();
    loginModal.classList.add('hidden');
    
    usernameInput.value = '';
    passwordInput.value = '';
    
    alert(`驗證成功，${currentUser.username} 指揮官已登入！`);
    renderLeaderboard(); 
}

function handleGoogleLogin(response) {
    try {
        // 解碼 Google 提供的 JWT Token
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const googleUser = JSON.parse(jsonPayload);
        console.log("Google 登入成功:", googleUser.name);

        // 生成 UID
        let hash = 0;
        const seed = googleUser.sub || googleUser.email;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        const uidSuffix = Math.abs(hash % 10000).toString().padStart(4, '0');
        const uid = 'GGL_' + uidSuffix;

        currentUser = { 
            username: googleUser.name, 
            uid: uid, 
            isAdmin: false,
            isGoogleUser: true,
            email: googleUser.email,
            picture: googleUser.picture
        };

        saveUserSession();
        loadMetaProgress();
        updateUserUI();
        loginModal.classList.add('hidden');
        
        alert(`Google 登入成功！歡迎回來，${currentUser.username} 指揮官。`);
        renderLeaderboard();
    } catch (err) {
        console.error("Google 登入解析失敗:", err);
        alert("Google 登入失敗，請稍後再試。");
    }
}

// 初始化 Google 登入
function initGoogleLogin() {
    if (typeof google === 'undefined') {
        console.warn("Google SDK 尚未載入，稍後重試...");
        setTimeout(initGoogleLogin, 1000);
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin,
        auto_select: false,
        cancel_on_tap_outside: true,
    });

    google.accounts.id.renderButton(
        document.getElementById("google-login-container"),
        { 
            theme: "outline", 
            size: "large", 
            width: 250,
            text: "signin_with",
            shape: "pill"
        }
    );
}

function handleFeedbackSubmit() {
    const content = feedbackContentInput.value.trim();
    if (!content) {
        alert('請輸入您的意見反饋內容。');
        return;
    }

    // 儲存反饋至本機 (模擬傳送到伺服器)
    const feedbacksRaw = localStorage.getItem('survivor_feedbacks');
    let feedbacks = feedbacksRaw ? JSON.parse(feedbacksRaw) : [];
    
    feedbacks.push({
        user: currentUser ? currentUser.username : '訪客',
        uid: currentUser ? currentUser.uid : 'GUEST',
        content: content,
        time: new Date().toLocaleString()
    });

    localStorage.setItem('survivor_feedbacks', JSON.stringify(feedbacks));
    
    feedbackContentInput.value = '';
    feedbackModal.classList.add('hidden');
    alert('感謝您的意見反饋！我們已收到您的寶貴建議。');
}

function renderAdminFeedbacks() {
    if (!adminFeedbackList) return;
    const feedbacksRaw = localStorage.getItem('survivor_feedbacks');
    const feedbacks = feedbacksRaw ? JSON.parse(feedbacksRaw) : [];
    
    adminFeedbackList.innerHTML = '';
    
    if (feedbacks.length === 0) {
        adminFeedbackList.innerHTML = '<div style="text-align:center; padding: 20px; color: rgba(255,255,255,0.4);">目前尚無任何反饋紀錄。</div>';
        return;
    }

    // 依時間倒序排列
    feedbacks.sort((a, b) => new Date(b.time) - new Date(a.time));

    feedbacks.forEach((fb, index) => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `
            <div class="room-name" title="${fb.uid}">${fb.user}</div>
            <div class="room-players" style="font-size: 10px;">${fb.time}</div>
            <div class="room-status" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${fb.content}
            </div>
            <div class="room-action">
                <button class="small-btn info-btn" onclick="alert('指揮官: ${fb.user}\\n時間: ${fb.time}\\n\\n內容:\\n${fb.content}')">詳情</button>
            </div>
        `;
        adminFeedbackList.appendChild(item);
    });
}

function handleAccountDeletion() {
    if (!currentUser) return;
    
    const usernameToDelete = currentUser.username;
    const confirmMsg = currentUser.isAdmin 
        ? '身為開發人員，確定要註銷目前帳號並清空所有本機數據嗎？' 
        : '確定要註銷帳號嗎？這將刪除所有軍資與戰績紀錄，且無法恢復！';
        
    if (confirm(confirmMsg)) {
        if (currentUser.isAdmin) {
            localStorage.clear(); // Admin clears everything
            alert('所有系統數據已格式化完成。');
        } else {
            // Remove user entries from leaderboard
            let list = loadLeaderboard();
            list = list.filter(entry => entry.name !== usernameToDelete);
            saveLeaderboard(list);

            // Regular user deletion
            const prefix = `_${usernameToDelete}`;
            localStorage.removeItem('survivor_user');
            localStorage.removeItem(`survivor_funds${prefix}`);
            localStorage.removeItem(`survivor_units_owned${prefix}`);
            localStorage.removeItem(`survivor_units_equipped${prefix}`);
            alert('帳號與相關戰績已成功註銷。');
        }
        window.location.reload();
    }
}

function handleAdminClearData() {
    if (!currentUser || !currentUser.isAdmin) return;
    if (confirm('⚠️ 警告：這將刪除包括排行榜、所有使用者紀錄、軍資在內的所有數據！確定執行格式化嗎？')) {
        localStorage.clear();
        alert('數據已全數清空。');
        window.location.reload();
    }
}

function handleLogout() {
    if (confirm('確定要登出嗎？')) {
        currentUser = null;
        saveUserSession();
        
        // 登出後載入訪客（無前綴）的進度
        loadMetaProgress();
        
        updateUserUI();
        renderLeaderboard();
        alert('已成功登出，目前已切換為訪客模式。');
    }
}

function updateUserUI() {
    if (currentUser) {
        displayUserName.textContent = currentUser.username;
        displayUid.textContent = `UID: ${currentUser.uid}`;
        loginTriggerBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        deleteAccountBtn.classList.remove('hidden');
        
        // Load and display current user's highest score
        const list = loadLeaderboard();
        const userBest = list.filter(e => e.name === currentUser.username).sort((a, b) => b.score - a.score)[0];
        if (highestScoreDisplay) {
            highestScoreDisplay.textContent = userBest ? userBest.score.toLocaleString() : '0';
        }

        if (currentUser.isAdmin) {
            adminClearDataBtn.classList.remove('hidden');
            adminViewFeedbackBtn.classList.remove('hidden');
        } else {
            adminClearDataBtn.classList.add('hidden');
            adminViewFeedbackBtn.classList.add('hidden');
        }
    } else {
        displayUserName.textContent = '訪客';
        displayUid.textContent = 'UID: GUEST_0000';
        loginTriggerBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        deleteAccountBtn.classList.add('hidden');
        adminClearDataBtn.classList.add('hidden');
        adminViewFeedbackBtn.classList.add('hidden');
        
        // 訪客也應顯示其最高紀錄
        const list = loadLeaderboard();
        const guestBest = list.filter(e => e.name === '訪客').sort((a, b) => b.score - a.score)[0];
        if (highestScoreDisplay) {
            highestScoreDisplay.textContent = guestBest ? guestBest.score.toLocaleString() : '0';
        }
    }
}

function updateFundsUI() {
    if (fundsDisplay) {
        fundsDisplay.textContent = militaryFunds.toLocaleString();
    }
}

function renderLeaderboard() {
    const list = loadLeaderboard();
    
    // 1. Render for modal
    if (leaderboardList) {
        leaderboardList.innerHTML = '';
        if (!list.length) {
            const empty = document.createElement('div');
            empty.textContent = '目前尚無紀錄，先打出你的第一場戰績吧！';
            leaderboardList.appendChild(empty);
        } else {
            list.forEach((entry, index) => {
                const row = document.createElement('div');
                row.className = 'leaderboard-item';
                row.innerHTML = `
                    <span class="rank">${index + 1}.</span>
                    <span class="name">${entry.name}</span>
                    <span class="score">${entry.score.toLocaleString()}</span>
                `;
                leaderboardList.appendChild(row);
            });
        }
    }

    // 2. Render for main menu panel
    if (leaderboardListPanel) {
        leaderboardListPanel.innerHTML = '';
        if (!list.length) {
            const empty = document.createElement('div');
            empty.style.color = '#888';
            empty.style.fontSize = '12px';
            empty.style.textAlign = 'center';
            empty.style.padding = '20px';
            empty.textContent = '暫無戰績紀錄';
            leaderboardListPanel.appendChild(empty);
        } else {
            list.forEach((entry, index) => {
                const row = document.createElement('div');
                row.className = 'leaderboard-item';
                row.style.padding = '8px 0';
                row.innerHTML = `
                    <span class="rank" style="color: #00ffff; font-weight: bold; width: 25px; display: inline-block;">${index + 1}.</span>
                    <span class="name" style="color: #fff; flex: 1;">${entry.name}</span>
                    <span class="score" style="color: #ffcc00; font-weight: bold;">${entry.score.toLocaleString()}</span>
                `;
                leaderboardListPanel.appendChild(row);
            });
        }
    }
}

function loadLeaderboard() {
    const raw = localStorage.getItem('survivor_leaderboard');
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveLeaderboard(list) {
    localStorage.setItem('survivor_leaderboard', JSON.stringify(list));
}

function recordScoreToLeaderboard(finalScore) {
    if (!finalScore || finalScore <= 0) return;
    const name = currentUser && currentUser.username ? currentUser.username : '訪客';
    const list = loadLeaderboard();
    list.push({ name, score: finalScore, time: Date.now() });
    list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time - b.time;
    });
    const trimmed = list.slice(0, 20);
    saveLeaderboard(trimmed);
    renderLeaderboard(); // Update UI immediately
}

function loadMetaProgress() {
    const prefix = currentUser ? `_${currentUser.username}` : '';
    
    // Dev account special case
    if (currentUser && currentUser.username === '開發團隊') {
        militaryFunds = 9999999;
        ownedUnits = {};
        equippedUnits = {};
        updateFundsUI();
        return;
    }

    const savedFunds = localStorage.getItem(`survivor_funds${prefix}`);
    if (savedFunds) {
        const parsed = parseInt(savedFunds, 10);
        if (!Number.isNaN(parsed)) militaryFunds = parsed;
    } else {
        militaryFunds = 0;
    }

    const savedOwned = localStorage.getItem(`survivor_units_owned${prefix}`);
    if (savedOwned) {
        try {
            ownedUnits = JSON.parse(savedOwned) || {};
        } catch {
            ownedUnits = {};
        }
    } else {
        ownedUnits = {};
    }

    const savedEquipped = localStorage.getItem(`survivor_units_equipped${prefix}`);
    if (savedEquipped) {
        try {
            equippedUnits = JSON.parse(savedEquipped) || {};
        } catch {
            equippedUnits = {};
        }
    } else {
        equippedUnits = {};
    }
    updateFundsUI();
}

function saveMetaProgress() {
    const prefix = currentUser ? `_${currentUser.username}` : '';
    localStorage.setItem(`survivor_funds${prefix}`, String(militaryFunds));
    localStorage.setItem(`survivor_units_owned${prefix}`, JSON.stringify(ownedUnits));
    localStorage.setItem(`survivor_units_equipped${prefix}`, JSON.stringify(equippedUnits));
}

function applyEquippedUnits() {
    fundsGainMultiplier = 1;
    if (equippedUnits.drone) {
        playerUpgrades.multishot.level += 1;
    }
    if (equippedUnits.medic) {
        player.maxHp += 50;
        player.hp = player.maxHp;
        player.updateUI();
    }
    if (equippedUnits.logistics) {
        fundsGainMultiplier = 1.5;
    }
}

function renderUnitShop() {
    if (!unitListContainer) return;
    unitListContainer.innerHTML = '';
    const fundsDisplayModal = document.getElementById('funds-display-modal');
    if (fundsDisplayModal) {
        fundsDisplayModal.textContent = militaryFunds.toLocaleString();
    }
    Object.values(unitDefinitions).forEach(unit => {
        const card = document.createElement('div');
        const owned = !!ownedUnits[unit.id];
        const equipped = !!equippedUnits[unit.id];
        const statusText = owned ? (equipped ? '已購買・裝備中' : '已購買') : `價格：${unit.cost.toLocaleString()} 軍資`;
        const actionLabel = owned ? (equipped ? '卸下' : '裝備') : '購買';
        card.className = 'unit-card';
        if (owned) {
            card.classList.add('unit-card-owned');
        }
        if (equipped) {
            card.classList.add('unit-card-equipped');
        }
        card.innerHTML = `
            <div class="unit-main">
                <div class="unit-icon">${unit.icon}</div>
                <div class="unit-text">
                    <div class="unit-name">${unit.name}</div>
                    <div class="unit-desc">${unit.desc}</div>
                </div>
            </div>
            <div class="unit-footer">
                <div class="unit-status"><span>${statusText}</span></div>
                <button class="small-btn unit-action-btn">${actionLabel}</button>
            </div>
        `;
        const actionBtn = card.querySelector('.unit-action-btn');
        actionBtn.onclick = () => {
            if (!owned) {
                handlePurchaseUnit(unit.id);
            } else {
                toggleEquipUnit(unit.id);
            }
        };
        unitListContainer.appendChild(card);
    });
}

function handlePurchaseUnit(id) {
    const unit = unitDefinitions[id];
    if (!unit) return;
    if (militaryFunds < unit.cost) {
        alert('軍資不足，無法購買此單位。');
        return;
    }
    militaryFunds -= unit.cost;
    ownedUnits[id] = true;
    equippedUnits[id] = true;
    saveMetaProgress();
    updateFundsUI();
    renderUnitShop();
}

function toggleEquipUnit(id) {
    if (!ownedUnits[id]) return;
    equippedUnits[id] = !equippedUnits[id];
    saveMetaProgress();
    renderUnitShop();
}

// Check for saved user on load
function checkSavedUser() {
    console.log("正在檢查儲存的登入狀態...");
    try {
        const saved = localStorage.getItem('survivor_user');
        if (saved && saved !== 'null' && saved !== 'undefined') {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.username) {
                currentUser = parsed;
                console.log("已恢復登入狀態:", currentUser.username);
                loadMetaProgress(); 
            } else {
                currentUser = null;
                loadMetaProgress();
            }
        } else {
            console.log("未發現儲存的登入狀態，以訪客身份執行。");
            currentUser = null;
            loadMetaProgress(); 
        }
    } catch (e) {
        console.error("解析儲存的用戶資料失敗:", e);
        localStorage.removeItem('survivor_user');
        currentUser = null;
        loadMetaProgress();
    }
    updateUserUI(); 
}

// 移除原本底部的分散呼叫，統一由 checkSavedUser 處理初始化
checkSavedUser();
renderLeaderboard(); // 初始渲染排行榜面板

// Hourly leaderboard refresh
setInterval(() => {
    console.log('自動刷新排行榜...');
    renderLeaderboard();
}, 3600000); 

(function setupMenuButtons() {
    const unitConfigBtn = document.getElementById('unit-config-btn');
    if (unitConfigBtn && unitModal) {
        unitConfigBtn.onclick = () => {
            unitModal.classList.remove('hidden');
            renderUnitShop();
        };
    }
    if (closeUnitBtn && unitModal) {
        closeUnitBtn.addEventListener('click', () => {
            unitModal.classList.add('hidden');
        });
    }
    if (closeLeaderboardBtn && leaderboardModal) {
        closeLeaderboardBtn.addEventListener('click', () => {
            leaderboardModal.classList.add('hidden');
        });
    }
    if (closeLobbyBtn && lobbyModal) {
        closeLobbyBtn.addEventListener('click', () => {
            lobbyModal.classList.add('hidden');
        });
    }
    if (createRoomBtn) {
        createRoomBtn.onclick = () => {
            const roomName = prompt('請輸入房間名稱:', '戰區 ' + Math.floor(Math.random() * 100));
            if (roomName) {
                multiplayer.joinRoom(roomName, true);
            }
        };
    }
    if (refreshLobbyBtn) {
        refreshLobbyBtn.onclick = () => multiplayer.requestRoomList();
    }
    
    // Auth & Account Buttons
    if (logoutBtn) logoutBtn.onclick = handleLogout;
    if (deleteAccountBtn) deleteAccountBtn.onclick = handleAccountDeletion;
    if (adminClearDataBtn) adminClearDataBtn.onclick = handleAdminClearData;
    
    // 統一在這裡綁定登入按鈕
    if (authSubmitBtn) {
        authSubmitBtn.onclick = (e) => {
            e.preventDefault(); // 防止可能的表單行為
            handleLogin();
        };
    }
    
    if (loginTriggerBtn) loginTriggerBtn.onclick = () => {
        loginModal.classList.remove('hidden');
        // 每次開啟登入視窗都嘗試渲染一次按鈕，確保容器存在
        initGoogleLogin();
    };
    if (closeLoginBtn) closeLoginBtn.onclick = () => loginModal.classList.add('hidden');
    
    // Google Login (Real)
    initGoogleLogin();
    
    // Feedback
    if (feedbackTriggerBtn) feedbackTriggerBtn.onclick = () => feedbackModal.classList.remove('hidden');
    if (closeFeedbackBtn) closeFeedbackBtn.onclick = () => feedbackModal.classList.add('hidden');
    if (feedbackSubmitBtn) feedbackSubmitBtn.onclick = handleFeedbackSubmit;
    
    // Admin Feedback View
    if (adminViewFeedbackBtn) {
        adminViewFeedbackBtn.onclick = () => {
            adminFeedbackModal.classList.remove('hidden');
            renderAdminFeedbacks();
        };
    }
    if (closeAdminFeedbackBtn) {
        closeAdminFeedbackBtn.onclick = () => adminFeedbackModal.classList.add('hidden');
    }
    if (clearFeedbacksBtn) {
        clearFeedbacksBtn.onclick = () => {
            if (confirm('確定要清空所有收集到的意見反饋嗎？此操作不可恢復。')) {
                localStorage.removeItem('survivor_feedbacks');
                renderAdminFeedbacks();
            }
        };
    }
})();

// Utility Functions
function getDistance(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
}

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Classes
class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.players = new Map();
        this.enemies = [];
        this.bullets = [];
        this.xpOrbs = [];
        this.moneyDrops = [];
        this.healthPacks = [];
        this.active = false;
        this.lastInputSent = 0;
        this.localX = 0;
        this.localY = 0;
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.active = false;
        this.players.clear();
        this.enemies = [];
        this.bullets = [];
        this.xpOrbs = [];
        this.moneyDrops = [];
        this.healthPacks = [];
        if (this.refreshInterval) clearInterval(this.refreshInterval);
    }

    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
        
        try {
            // 使用明確的 IP 位址，有助於解決某些環境下的連線問題
            const qs = new URLSearchParams(location.search);
            const override = qs.get('ws');
            const target = override ? override : ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
            this.socket = new WebSocket(target);
            
            this.socket.onopen = () => {
                console.log('Connected to multiplayer server');
                this.onConnected();
            };

            this.socket.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.type === 'joined') {
                    this.playerId = msg.playerId;
                    this.active = true;
                    // Start at server spawn (0,0)
                    this.localX = 0;
                    this.localY = 0;
                    // Force camera to jump to player immediately
                    camera.x = this.localX - canvas.width / 2;
                    camera.y = this.localY - canvas.height / 2;
                    
                    lobbyModal.classList.add('hidden');
                    startMultiplayer();
                } else if (msg.type === 'state') {
                    this.updateState(msg);
                } else if (msg.type === 'pickup') {
                    if (msg.item === 'xp') playSound('pickup');
                    else if (msg.item === 'health') playSound('heal');
                } else if (msg.type === 'notification') {
                    // 顯示伺服器系統通知
                    showNotification(msg.message);
                } else if (msg.type === 'room_list') {
                    this.renderRoomList(msg.rooms);
                } else if (msg.type === 'game_over') {
                    endGame();
                } else if (msg.type === 'error') {
                    alert('錯誤: ' + msg.message);
                }
            };

            this.socket.onclose = () => {
                this.active = false;
                console.log('Disconnected from multiplayer server');
            };

            this.socket.onerror = () => {
                alert('連線伺服器失敗！請確認 server.js 是否已啟動。');
                this.active = false;
            };
        } catch (e) {
            console.error('Multiplayer connection error:', e);
        }
    }

    requestRoomList() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'get_rooms' }));
        }
    }

    onConnected() {
        this.requestRoomList();
        // Auto-refresh room list every 5 seconds if lobby is open
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            if (!lobbyModal.classList.contains('hidden')) {
                this.requestRoomList();
            }
        }, 5000);
    }

    joinRoom(roomId, create = false) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'join',
                roomId,
                create,
                name: currentUser ? currentUser.username : '訪客'
            }));
        }
    }

    renderRoomList(rooms) {
        if (!roomListContainer) return;
        roomListContainer.innerHTML = '';
        
        rooms.forEach(room => {
            const isFull = room.playerCount >= room.maxPlayers;
            const item = document.createElement('div');
            item.className = 'room-item';
            item.innerHTML = `
                <div class="room-name">${room.id}</div>
                <div class="room-players">${room.playerCount} / ${room.maxPlayers}</div>
                <div class="room-status ${isFull ? 'status-full' : 'status-waiting'}">
                    ${isFull ? '已滿' : '等待中'}
                </div>
                <div class="room-action">
                    <button class="small-btn join-btn" ${isFull ? 'disabled' : ''}>加入</button>
                </div>
            `;
            
            const joinBtn = item.querySelector('.join-btn');
            joinBtn.onclick = () => this.joinRoom(room.id);
            roomListContainer.appendChild(item);
        });
    }

    updateState(state) {
        const currentIds = new Set();
        state.players.forEach(p => {
            currentIds.add(p.id);
            this.players.set(p.id, p);
            
            // 強化平滑同步邏輯 (Soft Reconciliation)
            if (p.id === this.playerId) {
                // 受傷音效觸發 (優化 UI 數值抓取邏輯)
                const currentHpText = hpDisplay ? hpDisplay.textContent : '100';
                const oldHp = parseFloat(currentHpText) || 100;
                if (p.hp < oldHp - 1) playSound('hit');

                // 同步 UI 狀態 (多人模式專屬 UI 同步)
                if (hpDisplay) hpDisplay.textContent = Math.ceil(p.hp);
                if (levelDisplay) levelDisplay.textContent = p.level;
                if (xpBarFill) {
                    const ratio = p.xpToNextLevel > 0 ? (p.xp / p.xpToNextLevel) : 0;
                    xpBarFill.style.width = `${ratio * 100}%`;
                }

                const dist = Math.hypot(this.localX - p.x, this.localY - p.y);
                if (dist > 100) { // 差距過大才進行瞬移校正
                    this.localX = p.x;
                    this.localY = p.y;
                } else if (dist > 1) { // 小差距使用插值平滑，消除抖動
                    this.localX += (p.x - this.localX) * 0.15;
                    this.localY += (p.y - this.localY) * 0.15;
                }
            }
        });
        
        for (let id of this.players.keys()) {
            if (!currentIds.has(id)) this.players.delete(id);
        }

        this.enemies = state.enemies || [];
        this.bullets = state.bullets || [];
        this.xpOrbs = state.xpOrbs || [];
        this.moneyDrops = state.moneyDrops || [];
        this.healthPacks = state.healthPacks || [];
    }

    sendInput() {
        if (!this.active || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        // 1. 本地移動預測 (Client-side Prediction)
        const baseSpeed = config.playerSpeed;
        const dx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        const dy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
        
        if (dx !== 0 || dy !== 0) {
            const length = Math.hypot(dx, dy);
            this.localX += (dx / length) * baseSpeed;
            this.localY += (dy / length) * baseSpeed;
        }

        const now = Date.now();
        
        // 2. 自動射擊音效修復
        if (!this.lastSoundTime) this.lastSoundTime = 0;
        
        // 3. 多人自動瞄準：優先鎖定最近的威脅
        let targetAngle = Math.atan2(mouseY - canvas.height/2, mouseX - canvas.width/2);
        let hasEnemy = false;

        if (this.enemies && this.enemies.length > 0) {
            let closestDist = Infinity;
            let closestEnemy = null;
            this.enemies.forEach(e => {
                const dist = Math.hypot(this.localX - e.x, this.localY - e.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestEnemy = e;
                }
            });
            // 只要地圖上有敵人，就優先鎖定最近的 (範圍擴大到 1000)
            if (closestEnemy && closestDist < 1000) {
                targetAngle = Math.atan2(closestEnemy.y - this.localY, closestEnemy.x - this.localX);
                hasEnemy = true;
            }
        }

        // 決定是否射擊：有敵人或是使用者按下滑鼠
        const isShooting = hasEnemy || mouseDown;

        if (isShooting && now - this.lastSoundTime > config.fireRate) {
            playSound('shoot');
            this.lastSoundTime = now;
        }

        if (now - this.lastInputSent < 16) return; // 60Hz
        
        this.socket.send(JSON.stringify({
            type: 'input',
            dx, dy,
            shooting: isShooting,
            angle: targetAngle
        }));
        this.lastInputSent = now;
    }

    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();

        // 0. 繪製與單人模式一致的背景網格
        this.drawMultiplayerGrid(ctx);

        // 1. Draw XP Orbs (強化發光與呼吸效果)
        this.xpOrbs.forEach(orb => {
            const dx = orb.x - camera.x;
            const dy = orb.y - camera.y;
            const r = 6 + Math.sin(Date.now() / 200) * 1.5;
            
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath();
            ctx.arc(dx, dy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#00ffcc';
            ctx.shadowBlur = 20; // 增加發光強度以同步單人模式視覺
            ctx.shadowColor = '#00ffcc';
            ctx.fill();
            ctx.restore();
        });

        // 2. Draw items (Money, Health)
        this.moneyDrops.forEach(drop => {
            const dx = drop.x - camera.x;
            const dy = drop.y - camera.y;
            const r = 10 + Math.sin(Date.now() / 300) * 2;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ffd700';
            ctx.beginPath();
            ctx.arc(dx, dy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        this.healthPacks.forEach(pack => {
            const dx = pack.x - camera.x;
            const dy = pack.y - camera.y + Math.sin(Date.now() / 400) * 5;
            const r = 12;
            ctx.save();
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(dx, dy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff4444';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff4444';
            ctx.fillRect(dx - r * 0.2, dy - r * 0.6, r * 0.4, r * 1.2);
            ctx.fillRect(dx - r * 0.6, dy - r * 0.2, r * 1.2, r * 0.4);
            ctx.restore();
        });

        // 3. Draw enemies (Slime 動畫與 Variety)
        this.enemies.forEach(e => {
            const dx = e.x - camera.x;
            const dy = e.y - camera.y;
            
            const slimeTypes = {
                normal: { color: '#44ff44', radius: 15 },
                fast: { color: '#4488ff', radius: 12 },
                tank: { color: '#ff4444', radius: 22 },
                elite: { color: '#aa44ff', radius: 20 },
                gold: { color: '#ffff44', radius: 10 },
                boss: { color: '#ff00ff', radius: 60 }
            };
            const config = slimeTypes[e.type] || slimeTypes.normal;
            const r = e.radius || config.radius;

            ctx.save();
            ctx.translate(dx, dy);
            
            // Boss Aura
            if (e.isBoss || e.type === 'boss') {
                const auraSize = r + 15 + Math.sin(Date.now() / 100) * 10;
                const gradient = ctx.createRadialGradient(0, 0, r, 0, 0, auraSize);
                gradient.addColorStop(0, 'rgba(255, 0, 255, 0.5)');
                gradient.addColorStop(1, 'rgba(255, 0, 255, 0)');
                ctx.beginPath();
                ctx.arc(0, 0, auraSize, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            }

            const pulse = Math.sin(Date.now() / 200) * 0.1;
            ctx.scale(1 + pulse, 1 - pulse);

            ctx.beginPath();
            ctx.moveTo(-r, r);
            ctx.quadraticCurveTo(-r, -r, 0, -r);
            ctx.quadraticCurveTo(r, -r, r, r);
            ctx.lineTo(-r, r);
            ctx.fillStyle = config.color;
            ctx.fill();

            // Eyes
            ctx.fillStyle = (e.isBoss || e.type === 'boss') ? '#ff0000' : '#000';
            ctx.beginPath();
            ctx.arc(-r/3, 0, r/6, 0, Math.PI * 2);
            ctx.arc(r/3, 0, r/6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // HP bar
            if (e.hp < e.maxHp) {
                ctx.fillStyle = '#222';
                ctx.fillRect(dx - r, dy - r - 15, r * 2, 6);
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(dx - r, dy - r - 15, (r * 2) * (e.hp / e.maxHp), 6);
            }
        });

        // 4. Draw bullets (與單人模式一致的高級發光效果)
        this.bullets.forEach(b => {
            const dx = b.x - camera.x;
            const dy = b.y - camera.y;
            const r = 6;
            const hue = 180; 

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, r * 3);
            grad.addColorStop(0, `hsla(${hue},100%,85%,1)`);
            grad.addColorStop(0.3, `hsla(${hue},100%,60%,0.8)`);
            grad.addColorStop(1, `hsla(${hue},100%,50%,0)`);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(dx, dy, r * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // 5. Draw players (Neon 光環與高光)
        const drawnIds = new Set();
        this.players.forEach(p => {
            drawnIds.add(p.id);
            const px = (p.id === this.playerId) ? this.localX : p.x;
            const py = (p.id === this.playerId) ? this.localY : p.y;
            
            if (p.id === this.playerId) {
                this.drawSinglePlayer(ctx, { ...p, hp: player.hp, maxHp: player.maxHp }, px, py);
            } else {
                this.drawSinglePlayer(ctx, p, px, py);
            }
        });

        if (!drawnIds.has(this.playerId)) {
            this.drawSinglePlayer(ctx, {
                id: this.playerId,
                name: currentUser ? currentUser.username : '連線中...',
                hp: 100, maxHp: 100
            }, this.localX, this.localY);
        }

        ctx.restore();
    }

    drawMultiplayerGrid(ctx) {
        const gridSize = 100;
        const offsetX = -camera.x % gridSize;
        const offsetY = -camera.y % gridSize;
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        
        for (let x = offsetX; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = offsetY; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    drawSinglePlayer(ctx, p, px, py) {
        const dx = px - camera.x;
        const dy = py - camera.y;
        const color = p.id === this.playerId ? '#00ffff' : '#ff00ff';

        ctx.save();
        // Neon Glow
        ctx.shadowBlur = 25;
        ctx.shadowColor = color;
        
        ctx.beginPath();
        ctx.arc(dx, dy, 20, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner Highlight
        ctx.beginPath();
        ctx.arc(dx - 6, dy - 6, 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
        ctx.restore();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, dx, dy - 35);
        
        const barW = 44;
        const barH = 6;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(dx - barW/2, dy - 55, barW, barH);
        ctx.fillStyle = p.id === this.playerId ? '#00ff00' : '#ff00ff';
        ctx.fillRect(dx - barW/2, dy - 55, barW * (p.hp / (p.maxHp || 100)), barH);
    }
}

const multiplayer = new MultiplayerManager();

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = '#4488ff';
        this.hp = 100;
        this.maxHp = 100;
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;
        this.lastShotTime = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        
        // Add glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        
        // Add inner highlight
        ctx.beginPath();
        ctx.arc(this.x - camera.x - 3, this.y - camera.y - 3, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.closePath();
    }

    update(dt) {
        // Movement
        if (keys.w) this.y -= config.playerSpeed;
        if (keys.s) this.y += config.playerSpeed;
        if (keys.a) this.x -= config.playerSpeed;
        if (keys.d) this.x += config.playerSpeed;

        // Auto Fire
        const now = Date.now();
        if (now - this.lastShotTime > config.fireRate) {
            this.shoot();
            this.lastShotTime = now;
        }
    }

    shoot() {
        // Find nearest enemy
        let nearestEnemy = null;
        let minDistance = Infinity;

        enemies.forEach(enemy => {
            const dist = getDistance(this.x, this.y, enemy.x, enemy.y);
            if (dist < minDistance) {
                minDistance = dist;
                nearestEnemy = enemy;
            }
        });

        if (nearestEnemy) {
            playSound('shoot');
            const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
            
            // Handle multishot
            const bulletCount = 1 + playerUpgrades.multishot.level;
            const spread = 0.2; // radians
            
            for (let i = 0; i < bulletCount; i++) {
                const finalAngle = angle + (i - (bulletCount - 1) / 2) * spread;
                const velocity = {
                    x: Math.cos(finalAngle) * config.projectileSpeed,
                    y: Math.sin(finalAngle) * config.projectileSpeed
                };
                projectiles.push(new Projectile(this.x, this.y, velocity));
            }
        }
    }

    gainXp(amount) {
        playSound('xp');
        this.xp += amount;
        if (this.xp >= this.xpToNextLevel) {
            this.levelUp();
        }
        this.updateUI();
    }

    levelUp() {
        playSound('levelup');
        this.level++;
        this.xp -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.2);
        
        createFloatingText(this.x, this.y, "LEVEL UP!", "#ffff00");
        playRadioVoice("戰術建議：優先強化火力與機動，保持輸出與距離");
        showLevelUpScreen();
    }

    takeDamage(amount) {
        this.hp -= amount;
        screenShake = 10; // Trigger screen shake
        createFloatingText(this.x, this.y, `-${amount}`, "#ff0000");
        this.updateUI();
        if (this.hp <= 0) {
            endGame();
        }
    }

    updateUI() {
        hpDisplay.textContent = Math.floor(this.hp);
        levelDisplay.textContent = this.level;
        const xpPercent = (this.xp / this.xpToNextLevel) * 100;
        xpBarFill.style.width = `${xpPercent}%`;
    }
}

class Projectile {
    constructor(x, y, velocity) {
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.radius = 5;
        this.color = '#00ffff';
        this.history = []; // For trail
        this.maxHistory = 5;
    }

    draw() {
        const lv = playerUpgrades.damage.level;
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        const r = this.radius + lv * 1.2;
        const hue = (180 + lv * 25) % 360;
        const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, r * 1.8);
        grad.addColorStop(0, `hsla(${hue},100%,70%,1)`);
        grad.addColorStop(0.4, `hsla(${hue},100%,50%,0.8)`);
        grad.addColorStop(1, `hsla(${(hue+40)%360},100%,50%,0)`);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        if (this.history.length > 1) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath();
            ctx.moveTo(this.history[0].x - camera.x, this.history[0].y - camera.y);
            for (let i = 1; i < this.history.length; i++) {
                ctx.lineTo(this.history[i].x - camera.x, this.history[i].y - camera.y);
            }
            ctx.strokeStyle = `hsla(${hue},100%,70%,0.6)`;
            ctx.lineWidth = Math.max(1, r * 0.6);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    update() {
        this.history.push({x: this.x, y: this.y});
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        particles.push(new Particle(this.x, this.y, `hsla(${(180 + playerUpgrades.damage.level * 25)%360},100%,70%,0.5)`, {x: 0, y: 0}));
    }
}

class Enemy {
    constructor(x, y, type = 'normal') {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Base stats
        let baseSpeed = Math.random() * 1 + 1;
        let baseHp = 50 + (player.level * 10);
        
        // Slime Variety Palette
        const slimeTypes = {
            normal: { color: '#44ff44', speedMult: 1, hpMult: 1, radius: 15 },    // 綠色：平衡型
            fast: { color: '#4488ff', speedMult: 1.8, hpMult: 0.6, radius: 12 },   // 藍色：高速型
            tank: { color: '#ff4444', speedMult: 0.6, hpMult: 2.5, radius: 22 },   // 紅色：坦克型
            elite: { color: '#aa44ff', speedMult: 1.2, hpMult: 1.8, radius: 20 },  // 紫色：精英型
            gold: { color: '#ffff44', speedMult: 2.5, hpMult: 0.4, radius: 10 }    // 黃色：閃金型
        };

        const config = slimeTypes[type] || slimeTypes.normal;
        this.color = config.color;
        this.speed = baseSpeed * config.speedMult;
        this.hp = baseHp * config.hpMult;
        this.radius = config.radius;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        const r = this.radius;

        ctx.save();
        ctx.translate(drawX, drawY);
        
        // Squish effect based on movement or just constant pulse
        const pulse = Math.sin(Date.now() / 200) * 0.1;
        ctx.scale(1 + pulse, 1 - pulse);

        // Slime body
        ctx.beginPath();
        ctx.moveTo(-r, r);
        ctx.quadraticCurveTo(-r, -r, 0, -r);
        ctx.quadraticCurveTo(r, -r, r, r);
        ctx.lineTo(-r, r);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // Slime highlight
        ctx.beginPath();
        ctx.arc(-r/3, -r/3, r/4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-r/3, 0, r/6, 0, Math.PI * 2);
        ctx.arc(r/3, 0, r/6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }
}

class Boss extends Enemy {
    constructor(x, y) {
        super(x, y, 'elite');
        this.radius = 60;
        
        // Scaling Boss Power based on how many have been killed
        const bossLevel = Math.floor(totalKills / 100);
        this.hp = 2000 + (player.level * 500) + (bossLevel * 1000);
        this.maxHp = this.hp;
        this.speed = 1.2 + (bossLevel * 0.1);
        this.color = '#ff00ff'; 
        this.isBoss = true;
        
        // Skill management
        this.skillTimer = Date.now();
        this.skillCooldown = 3000; // Skill every 3 seconds
        this.currentState = 'normal'; // normal, charging, jumping, shockwave
        this.chargeTime = 0;
        this.jumpTarget = { x: 0, y: 0 };
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        const r = this.radius;

        ctx.save();
        ctx.translate(drawX, drawY);
        
        // Boss Aura (Scales with HP)
        const auraAlpha = 0.2 + (1 - this.hp / this.maxHp) * 0.4;
        const auraSize = r + 10 + Math.sin(Date.now() / 100) * 10;
        const gradient = ctx.createRadialGradient(0, 0, r, 0, 0, auraSize);
        gradient.addColorStop(0, `rgba(255, 0, 255, ${auraAlpha})`);
        gradient.addColorStop(1, 'rgba(255, 0, 255, 0)');
        ctx.beginPath();
        ctx.arc(0, 0, auraSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Skill Warnings
        if (this.currentState === 'charging') {
            ctx.beginPath();
            ctx.arc(0, 0, auraSize * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Boss Body
        const pulse = Math.sin(Date.now() / 150) * 0.15;
        const rageScale = 1 + (1 - this.hp / this.maxHp) * 0.3; // Get bigger when low HP
        ctx.scale((1 + pulse) * rageScale, (1 - pulse) * rageScale);

        ctx.beginPath();
        ctx.moveTo(-r, r);
        ctx.quadraticCurveTo(-r, -r, 0, -r);
        ctx.quadraticCurveTo(r, -r, r, r);
        ctx.lineTo(-r, r);
        ctx.fillStyle = this.color;
        if (this.currentState === 'charging') ctx.fillStyle = '#ff4444';
        ctx.fill();
        
        // Eyes (Glow when charging)
        ctx.fillStyle = this.currentState === 'charging' ? '#fff' : '#ff0000';
        ctx.beginPath();
        ctx.arc(-r/3, -r/10, r/5, 0, Math.PI * 2);
        ctx.arc(r/3, -r/10, r/5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();

        // Boss Health Bar
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.fillStyle = '#222';
        ctx.fillRect(-r, -r - 30, r * 2, 10);
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(-r, -r - 30, (r * 2) * (this.hp / this.maxHp), 10);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(-r, -r - 30, r * 2, 10);
        
        // Boss Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`LV.${Math.floor(totalKills/100) + 1} 墮落史萊姆王`, 0, -r - 40);
        ctx.restore();
    }

    update() {
        const now = Date.now();
        const distToPlayer = getDistance(this.x, this.y, player.x, player.y);

        // Rage Mode: Speed increases as HP drops
        const hpPercent = this.hp / this.maxHp;
        const currentSpeed = this.speed * (1 + (1 - hpPercent) * 0.5);

        if (this.currentState === 'normal') {
            // Basic movement
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(angle) * currentSpeed;
            this.y += Math.sin(angle) * currentSpeed;

            // Check for skill activation
            if (now - this.skillTimer > this.skillCooldown) {
                this.currentState = 'charging';
                this.chargeTime = now;
                playSound('alarm');
            }
        } 
        else if (this.currentState === 'charging') {
            // Shake while charging
            this.x += (Math.random() - 0.5) * 5;
            this.y += (Math.random() - 0.5) * 5;

            if (now - this.chargeTime > 1000) { // Charge for 1 second
                // Decide which skill to use
                if (distToPlayer < 200) {
                    this.currentState = 'shockwave';
                } else {
                    this.currentState = 'jumping';
                    this.jumpTarget = { x: player.x, y: player.y };
                }
                this.skillTimer = now;
            }
        }
        else if (this.currentState === 'jumping') {
            // Dash towards target
            const angle = Math.atan2(this.jumpTarget.y - this.y, this.jumpTarget.x - this.x);
            const jumpSpeed = currentSpeed * 8;
            this.x += Math.cos(angle) * jumpSpeed;
            this.y += Math.sin(angle) * jumpSpeed;

            // Landing check
            if (getDistance(this.x, this.y, this.jumpTarget.x, this.jumpTarget.y) < 20) {
                this.currentState = 'shockwave'; // Land with a shockwave
                screenShake += 15;
                playSound('explosion');
            }
        }
        else if (this.currentState === 'shockwave') {
            // Create AOE particles
            for (let i = 0; i < 20; i++) {
                const angle = (Math.PI * 2 / 20) * i;
                particles.push(new Particle(this.x, this.y, '#ff00ff', {
                    x: Math.cos(angle) * 10,
                    y: Math.sin(angle) * 10
                }));
            }
            // Deal damage if player is close
            if (distToPlayer < 150) {
                player.takeDamage(20);
                screenShake += 10;
            }
            this.currentState = 'normal';
        }
    }
}

class Particle {
    constructor(x, y, color, velocity) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
        this.life = 0.02; // Decay rate
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, 3, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= this.life;
    }
}

class Shard {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.spin = (Math.random() - 0.5) * 0.2;
        this.angle = Math.random() * Math.PI * 2;
        this.size = Math.random() * 6 + 4;
        this.alpha = 1;
        this.decay = 0.02;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x - camera.x, this.y - camera.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.moveTo(-this.size, this.size);
        ctx.lineTo(0, -this.size);
        ctx.lineTo(this.size, this.size);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.spin;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.alpha -= this.decay;
        return this.alpha > 0;
    }
}

class XpOrb {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.radius = 6;
        this.color = '#00ffcc';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }

    update() {
        // Magnet effect when close
        const dist = getDistance(this.x, this.y, player.x, player.y);
        if (dist < 100) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(angle) * 5; // Fast magnet
            this.y += Math.sin(angle) * 5;
        }
    }
}

class MoneyDrop {
    constructor(x, y, amount) {
        this.x = x;
        this.y = y;
        this.amount = amount;
        this.radius = 10;
        this.pulse = Math.random() * Math.PI * 2;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        const r = this.radius + Math.sin(Date.now() / 300 + this.pulse) * 2;
        const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, r);
        grad.addColorStop(0, 'rgba(255, 215, 0, 1)');
        grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

class HealthPack {
    constructor(x, y, heal) {
        this.x = x;
        this.y = y;
        this.heal = heal;
        this.radius = 12;
        this.offset = Math.random() * Math.PI * 2;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y + Math.sin(Date.now() / 400 + this.offset) * 3;
        const r = this.radius;
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-r * 0.2, -r * 0.6, r * 0.4, r * 1.2);
        ctx.fillRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.4);
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.velocity = {x: 0, y: -1};
        this.alpha = 1;
        this.life = 0.02;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x - camera.x, this.y - camera.y);
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= this.life;
    }
}

class Explosion {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.currentRadius = 0;
        this.maxRadius = radius;
        this.alpha = 1;
        this.life = 0.05;
        this.color = '#ffaa00';
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ff4400';
        ctx.fill();
        
        // Outer shockwave
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.currentRadius * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.restore();
    }

    update() {
         this.currentRadius += (this.maxRadius - this.currentRadius) * 0.2;
         this.alpha -= this.life;
         return this.alpha > 0;
     }
 }
 
 class FighterJet {
    constructor(startX, startY, endX, endY) {
        this.x = startX;
        this.y = startY;
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.speed = 15;
        this.progress = 0;
        this.totalDist = getDistance(startX, startY, endX, endY);
        this.angle = Math.atan2(endY - startY, endX - startX);
        this.droppedBombs = false;
        
        // Visuals
        this.size = 30;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(this.angle);
        
        // Jet body (Triangle)
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-15, 15);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-15, -15);
        ctx.closePath();
        ctx.fill();
        
        // Cockpit
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-5, 5);
        ctx.lineTo(-5, -5);
        ctx.closePath();
        ctx.fill();
        
        // Engine glow
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(-25, 5);
        ctx.lineTo(-25, -5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        
        // Shadow
        ctx.save();
        ctx.translate(drawX + 40, drawY + 40); // Offset shadow
        ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-15, 15);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-15, -15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        
        this.progress += this.speed;
        
        // Drop bombs near center of flight path
        if (!this.droppedBombs && this.progress > this.totalDist * 0.3 && this.progress < this.totalDist * 0.7) {
             if (Math.random() < 0.2) { // Chance to drop per frame in zone
                 const bombX = this.x;
                 const bombY = this.y;
                 bombs.push(new Bomb(bombX, bombY, this.x + Math.cos(this.angle)*50, this.y + Math.sin(this.angle)*50)); // Target slightly ahead? No, just drop
             }
        }
        
        return this.progress < this.totalDist + 200; // Keep alive until off screen
    }
}

class Bomb {
    constructor(x, y, targetX, targetY) {
        this.x = x;
        this.y = y;
        this.altitude = 200; // Start high
        this.targetX = x; // Fall straight down relative to world, but visual trick
        this.targetY = y;
        this.velocityZ = -5; // Falling speed
        this.scale = 1.5;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y - this.altitude; // Visual Y position
        
        // Shadow (ground)
        ctx.save();
        ctx.translate(this.x - camera.x, this.y - camera.y);
        ctx.scale(1 - (this.altitude/200), 1 - (this.altitude/200));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        
        // Bomb
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(drawX, drawY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Fins
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(drawX - 2, drawY - 8, 4, 16);
    }

    update() {
        this.altitude += this.velocityZ;
        this.velocityZ -= 0.5; // Gravity
        
        if (this.altitude <= 0) {
            // Explode
            explosions.push(new Explosion(this.x, this.y, airSupportConfig.strikeRadius));
            playSound('explosion');
            screenShake = 15;
            
            // Damage Logic (reused)
            enemies.forEach((enemy) => {
                const dist = getDistance(this.x, this.y, enemy.x, enemy.y);
                if (dist < airSupportConfig.strikeRadius) {
                    enemy.hp -= airSupportConfig.strikeDamage;
                    createParticles(enemy.x, enemy.y, enemy.color, 5);
                    createFloatingText(enemy.x, enemy.y, `-${airSupportConfig.strikeDamage}`, '#ff0000');
                    
                    if (enemy.hp <= 0) {
                        playSound('kill');
                        createParticles(enemy.x, enemy.y, '#ff8800', 8);
                        xpOrbs.push(new XpOrb(enemy.x, enemy.y, 20 + (player.level * 2)));
                        spawnDrops(enemy.x, enemy.y);
                        score += 10;
                        scoreDisplay.textContent = score;
                    }
                }
            });
            return false; // Remove bomb
        }
        return true;
    }
}

 // Game Functions
function init() {
    resizeCanvas();
    // Initialize player at origin (0,0) for infinite map
    player = new Player(0, 0);
    projectiles = [];
    enemies = [];
    particles = [];
    xpOrbs = [];
    moneyDrops = [];
    healthPacks = [];
    explosions = [];
    score = 0;
    totalKills = 0;
    isPaused = false;
    airSupportConfig.lastUsed = 0;
    updateAirSupportUI();
    pauseModal.classList.add('hidden');
    scoreDisplay.textContent = score;
    player.updateUI();
    
    // Reset upgrades
    Object.keys(playerUpgrades).forEach(key => playerUpgrades[key].level = 0);
    
    // Reset config for new game
    config.fireRate = 500;
    config.playerSpeed = 6;
    config.projectileDamage = 25;
    applyEquippedUnits();
}

function togglePause() {
    if (!gameRunning) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        pauseModal.classList.remove('hidden');
        setMusicDuck(true);
    } else {
        pauseModal.classList.add('hidden');
        setMusicDuck(false);
        lastTime = performance.now();
        animate();
    }
}

function updateAirSupportUI() {
    const now = Date.now();
    const timeSinceLast = now - airSupportConfig.lastUsed;
    const progress = Math.min(timeSinceLast / airSupportConfig.cooldown, 1);
    airSupportFill.style.width = `${progress * 100}%`;
    
    if (progress >= 1) {
        airSupportFill.style.background = '#00ffff';
        airSupportFill.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.8)';
    } else {
        airSupportFill.style.background = '#555';
        airSupportFill.style.boxShadow = 'none';
    }
}

function requestAirSupport() {
    const now = Date.now();
    if (now - airSupportConfig.lastUsed < airSupportConfig.cooldown) return;
    
    airSupportConfig.lastUsed = now;
    
    // 1. Voice Request
    playRadioVoice("請求空中火力打擊支援，座標已確認");
    
    // 2. Start Alarm & Countdown UI
    let timeLeft = 5; // Reduced to 5 seconds
    airRaidWarning.classList.remove('hidden');
    warningTimerDisplay.textContent = timeLeft.toFixed(1);
    
    // Activate Targeting Mode
    targetingState.active = true;
    targetingState.locked = false;
    targetingState.mode = 'manual';
    createFloatingText(player.x, player.y - 100, "TACTICAL TARGETING ACTIVE", '#00ffff');
    
    const countdownInterval = setInterval(() => {
        if (!gameRunning || isPaused) return;
        
        timeLeft -= 0.1; // Smoother countdown
        if (timeLeft > 0) {
            warningTimerDisplay.textContent = timeLeft.toFixed(1);
            if (Math.floor(timeLeft * 10) % 10 === 0) playSound('alarm');
        } else {
            clearInterval(countdownInterval);
            airRaidWarning.classList.add('hidden');
            targetingState.active = false;
            launchAirStrike(); // Launch strike at targetingState coordinates
        }
    }, 100);

    // Initial alarm
    playSound('alarm');
}

function launchAirStrike() {
    // 4. Launch Fighters
    playSound('jet_flyover');
    
    // Determine strike center
    let strikeX, strikeY;
    if (targetingState.locked || targetingState.mode === 'manual') {
        strikeX = targetingState.x;
        strikeY = targetingState.y;
    } else {
        // Fallback to player pos
        strikeX = player.x;
        strikeY = player.y;
    }

    // Spawn 3 jets flying across targeting the strike zone
    for(let i=0; i<3; i++) {
            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const distance = canvas.width; // Start off screen
                const startX = strikeX + Math.cos(angle) * distance;
                const startY = strikeY + Math.sin(angle) * distance;
                const endX = strikeX - Math.cos(angle) * distance;
                const endY = strikeY - Math.sin(angle) * distance;
                
                fighterJets.push(new FighterJet(startX, startY, endX, endY));
            }, i * 500);
    }
}

// Event Listeners for pause menu
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        togglePause();
    }
    if (e.code === 'Space' && gameRunning && !isPaused) {
        requestAirSupport();
    }
    if ((e.key === 't' || e.key === 'T') && targetingState.active && !targetingState.locked) {
        targetingState.mode = targetingState.mode === 'manual' ? 'auto' : 'manual';
        playSound('hit');
    }
    if (e.key === 'm' || e.key === 'M') {
        if (musicEnabled) {
            musicEnabled = false;
            stopBackgroundMusic();
            stopMenuMusic();
        } else {
            musicEnabled = true;
            if (gameRunning && !isPaused) {
                startBackgroundMusic();
            } else {
                startMenuMusic();
            }
        }
    }
});

 // Mouse Listener for Targeting
 window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
 });
 
 function isUIInteractive(target) {
    return !!(
        target.closest('.modal') ||
        target.closest('#start-screen') ||
        target.closest('.mini-btn') ||
        target.closest('.action-btn') ||
        target.closest('.small-btn') ||
        target.closest('.info-btn')
    );
 }
 
 window.addEventListener('mousedown', (e) => {
    if (isUIInteractive(e.target)) return;
    mouseDown = true;
    if (targetingState.active && !targetingState.locked && e.button === 0) {
        targetingState.locked = true;
        playSound('shoot');
    }
 });
 
 window.addEventListener('mouseup', () => {
    mouseDown = false;
 });
 
 inGameMenuBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', togglePause);
backToMenuBtn.addEventListener('click', () => {
    isPaused = false;
    gameRunning = false;
    pauseModal.classList.add('hidden');
    showMainMenu();
});

function showLevelUpScreen() {
    gameRunning = false;
    levelupModal.classList.remove('hidden');
    
    upgradeOptionsContainer.innerHTML = '';
    
    // Show all 5 skills for V3.0
    const allUpgrades = Object.keys(playerUpgrades);
    
    allUpgrades.forEach(type => {
        const upgrade = playerUpgrades[type];
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.setAttribute('data-type', type);
        
        // Use a simpler progress bar or just numeric level for infinite levels
        const progressPercent = Math.min((upgrade.level % 10) * 10, 100);
        
        card.innerHTML = `
            <div class="upgrade-icon">${upgrade.icon}</div>
            <div class="upgrade-name">${upgrade.name}</div>
            <div class="upgrade-desc">${upgrade.desc}</div>
            <div class="upgrade-status">
                <div class="status-label">
                    <span>當前效能</span>
                    <span>LV.${upgrade.level}</span>
                </div>
                <div class="level-progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent || 100}%"></div>
                </div>
            </div>
        `;
        
        card.onclick = () => applyUpgrade(type);
        upgradeOptionsContainer.appendChild(card);
    });
}

function applyUpgrade(type) {
    const upgrade = playerUpgrades[type];
    upgrade.level++;
    
    // Apply stats
    switch(type) {
        case 'multishot':
            // Handled in shoot()
            break;
        case 'fireRate':
            config.fireRate = Math.max(100, 500 * Math.pow(0.8, upgrade.level));
            break;
        case 'damage':
            config.projectileDamage = 25 + (upgrade.level * 15);
            break;
        case 'speed':
            config.playerSpeed = 4 + (upgrade.level * 0.8);
            break;
        case 'hp':
            player.maxHp += 20;
            player.hp = player.maxHp;
            player.updateUI();
            break;
    }
    
    resumeGame();
}

function resumeGame() {
    levelupModal.classList.add('hidden');
    gameRunning = true;
    animate();
}

function spawnEnemy() {
    if (!gameRunning || isPaused) return;

    // Spawn randomly around the player, just outside the view
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.hypot(canvas.width / 2, canvas.height / 2) + 100; 
    
    let x = player.x + Math.cos(angle) * radius;
    let y = player.y + Math.sin(angle) * radius;

    // Randomly pick a slime type based on weights
    const rand = Math.random();
    let type = 'normal';
    if (rand > 0.96) type = 'gold';       // 4% 閃金
    else if (rand > 0.88) type = 'elite'; // 8% 精英
    else if (rand > 0.75) type = 'tank';  // 13% 坦克
    else if (rand > 0.55) type = 'fast';  // 20% 高速
                                         // 其餘 55% 普通

    enemies.push(new Enemy(x, y, type));
}

function updateCamera() {
    // Smoother camera follow using linear interpolation (lerp)
    let tx, ty;
    if (multiplayer.active) {
        tx = multiplayer.localX - canvas.width / 2;
        ty = multiplayer.localY - canvas.height / 2;
    } else {
        tx = player.x - canvas.width / 2;
        ty = player.y - canvas.height / 2;
    }
    
    camera.x += (tx - camera.x) * 0.1;
    camera.y += (ty - camera.y) * 0.1;
}

function drawGrid() {
    const gridSize = config.gridSize;
    
    // Draw grid with two layers for depth
    ctx.lineWidth = 1;

    // Layer 1: Subtle dark grid
    ctx.strokeStyle = '#1a2233';
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;

    for (let x = startX; x <= startX + canvas.width + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x - camera.x, 0);
        ctx.lineTo(x - camera.x, canvas.height);
        ctx.stroke();
    }
    for (let y = startY; y <= startY + canvas.height + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y - camera.y);
        ctx.lineTo(canvas.width, y - camera.y);
        ctx.stroke();
    }

    // Layer 2: Glowing nodes at grid intersections
    ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
    for (let x = startX; x <= startX + canvas.width + gridSize; x += gridSize) {
        for (let y = startY; y <= startY + canvas.height + gridSize; y += gridSize) {
            ctx.beginPath();
            ctx.arc(x - camera.x, y - camera.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const velocity = {
            x: (Math.random() - 0.5) * 4,
            y: (Math.random() - 0.5) * 4
        };
        particles.push(new Particle(x, y, color, velocity));
    }
}

function createShards(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        shards.push(new Shard(x, y, color));
    }
}

function spawnDrops(x, y) {
    const base = Math.floor(randomRange(50, 201));
    const amount = Math.floor(base * fundsGainMultiplier);
    if (amount > 0) {
        moneyDrops.push(new MoneyDrop(x, y, amount));
    }
    if (Math.random() < 0.3) {
        const heal = 25 + player.level * 2;
        healthPacks.push(new HealthPack(x, y, heal));
    }
}

function createFloatingText(x, y, text, color) {
    particles.push(new FloatingText(x, y, text, color));
}

function updateTargeting() {
    if (!targetingState.active || targetingState.locked) return;
    
    if (targetingState.mode === 'manual') {
        // Map screen mouse pos to world pos
        targetingState.x = mouseX + camera.x;
        targetingState.y = mouseY + camera.y;
    } else {
        // Auto-Targeting Logic: Find densest cluster
        // Simple heuristic: Find center of all enemies
        if (enemies.length > 0) {
            let sumX = 0, sumY = 0;
            enemies.forEach(e => {
                sumX += e.x;
                sumY += e.y;
            });
            targetingState.x = sumX / enemies.length;
            targetingState.y = sumY / enemies.length;
        } else {
            targetingState.x = player.x;
            targetingState.y = player.y;
        }
    }
}

function drawTargetingReticle() {
    if (!targetingState.active) return;
    
    const drawX = targetingState.x - camera.x;
    const drawY = targetingState.y - camera.y;
    
    ctx.save();
    ctx.translate(drawX, drawY);
    
    // Rotating outer ring
    ctx.rotate(Date.now() / 200);
    ctx.beginPath();
    ctx.arc(0, 0, airSupportConfig.strikeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = targetingState.locked ? '#ff0000' : (targetingState.mode === 'auto' ? '#00ff00' : '#00ffff');
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 10]);
    ctx.stroke();
    
    // Inner crosshair
    ctx.rotate(-Date.now() / 100); // Counter rotate
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();
    
    // Range overlay
    ctx.fillStyle = targetingState.locked ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(0, 0, airSupportConfig.strikeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    
    // Instruction text
    ctx.font = '16px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(targetingState.locked ? "TARGET LOCKED" : "[CLICK] TO LOCK / [T] AUTO-AIM", drawX, drawY - airSupportConfig.strikeRadius - 10);
}

function animate() {
    if (!gameRunning || isPaused) return;
    animationId = requestAnimationFrame(animate);
    
    updateCamera();
    updateAirSupportUI();
    updateTargeting();
    checkBossHint();

    // Clear with trail effect? No, clean clear for now
    ctx.fillStyle = 'rgba(26, 26, 26, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply screen shake
    ctx.save();
    if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
        screenShake *= 0.9; // Decay
        if (screenShake < 0.1) screenShake = 0;
    }
    
    drawGrid();

    // Draw Player
    player.update();
    player.draw();

    // Explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        if (!explosions[i].update()) {
            explosions.splice(i, 1);
        } else {
            explosions[i].draw();
        }
    }

    // Fighter Jets
    for (let i = fighterJets.length - 1; i >= 0; i--) {
        if (!fighterJets[i].update()) {
            fighterJets.splice(i, 1);
        } else {
            fighterJets[i].draw();
        }
    }

    // Bombs
    for (let i = bombs.length - 1; i >= 0; i--) {
        if (!bombs[i].update()) {
            bombs.splice(i, 1);
        } else {
            bombs[i].draw();
        }
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.update();
        projectile.draw();

        // Remove projectiles that are far outside the camera view
        const buffer = 200;
        if (projectile.x < camera.x - buffer ||
            projectile.x > camera.x + canvas.width + buffer ||
            projectile.y < camera.y - buffer ||
            projectile.y > camera.y + canvas.height + buffer) {
            projectiles.splice(i, 1);
        }
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        enemy.draw();

        // Collision: Projectile vs Enemy
        for (let j = projectiles.length - 1; j >= 0; j--) {
            const projectile = projectiles[j];
            const dist = getDistance(projectile.x, projectile.y, enemy.x, enemy.y);
            if (dist - enemy.radius - projectile.radius < 0) {
                // Hit!
                playSound('hit');
                createParticles(enemy.x, enemy.y, enemy.color, 3);
                const damage = config.projectileDamage;
                enemy.hp -= damage;
                createFloatingText(enemy.x, enemy.y, `-${damage}`, '#ff4444');
                projectiles.splice(j, 1);

                if (enemy.hp <= 0) {
                    playSound('kill');
                    createParticles(enemy.x, enemy.y, '#ff8800', 12);
                    createShards(enemy.x, enemy.y, enemy.color, 10);
                    screenShake += 8;
                    xpOrbs.push(new XpOrb(enemy.x, enemy.y, 20 + (player.level * 2)));
                    spawnDrops(enemy.x, enemy.y);
                    score += 10;
                    totalKills += 1; // Increment total kills
                    scoreDisplay.textContent = score;

                    // Spawn Boss every 100 kills
                    if (totalKills % 100 === 0 && totalKills > 0) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 600;
                        const bx = player.x + Math.cos(angle) * dist;
                        const by = player.y + Math.sin(angle) * dist;
                        enemies.push(new Boss(bx, by));
                        showNotification("🚨 強力生物特徵已偵測：大型 BOSS 進入戰場！ 🚨");
                        playSound('alarm');
                    }

                    enemies.splice(i, 1);

                    // Boss Special Death Logic: Split into elite slimes
                    if (enemy.isBoss) {
                        playSound('explosion');
                        showNotification("⚠️ BOSS 核心崩解：偵測到多個高能反應！");
                        for (let k = 0; k < 5; k++) {
                            const angle = (Math.PI * 2 / 5) * k;
                            const sx = enemy.x + Math.cos(angle) * 50;
                            const sy = enemy.y + Math.sin(angle) * 50;
                            enemies.push(new Enemy(sx, sy, 'elite'));
                        }
                    }
                    break; // Enemy is gone, stop checking projectiles for it
                }
            }
        }

        // Collision: Player vs Enemy
        if (enemies[i]) { // Check if enemy still exists after projectile collision
            const distPlayer = getDistance(player.x, player.y, enemy.x, enemy.y);
            if (distPlayer - enemy.radius - player.radius < 0) {
                player.takeDamage(10); // Take damage on contact
                // Push enemy back slightly
                const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
                enemy.x += Math.cos(angle) * 20;
                enemy.y += Math.sin(angle) * 20;
            }
        }
    }

    for (let i = xpOrbs.length - 1; i >= 0; i--) {
        const orb = xpOrbs[i];
        orb.update();
        orb.draw();
        const dist = getDistance(player.x, player.y, orb.x, orb.y);
        if (dist - player.radius - orb.radius < 0) {
            player.gainXp(orb.value);
            xpOrbs.splice(i, 1);
        }
    }

    for (let i = moneyDrops.length - 1; i >= 0; i--) {
        const drop = moneyDrops[i];
        drop.draw();
        const dist = getDistance(player.x, player.y, drop.x, drop.y);
        if (dist - player.radius - drop.radius < 0) {
            militaryFunds += drop.amount;
            saveMetaProgress();
            updateFundsUI();
            createFloatingText(drop.x, drop.y, `+${drop.amount} 軍資`, '#ffff00');
            playSound('xp');
            moneyDrops.splice(i, 1);
        }
    }

    for (let i = healthPacks.length - 1; i >= 0; i--) {
        const pack = healthPacks[i];
        pack.draw();
        const dist = getDistance(player.x, player.y, pack.x, pack.y);
        if (dist - player.radius - pack.radius < 0) {
            const missing = player.maxHp - player.hp;
            if (missing > 0) {
                const heal = Math.min(missing, pack.heal);
                player.hp += heal;
                player.updateUI();
                createFloatingText(pack.x, pack.y, `+${heal} HP`, '#00ff66');
                playSound('xp');
            }
            healthPacks.splice(i, 1);
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        if (particle.alpha <= 0) {
            particles.splice(i, 1);
        } else {
            particle.update();
            particle.draw();
        }
    }
    for (let i = shards.length - 1; i >= 0; i--) {
        if (!shards[i].update()) {
            shards.splice(i, 1);
        } else {
            shards[i].draw();
        }
    }

    drawTargetingReticle();

    ctx.restore();
}

let bossHintShown = false;
function showNotification(message) {
    if (!gameNotification || !notificationText) return;
    notificationText.textContent = message;
    gameNotification.classList.remove('hidden');
    gameNotification.classList.add('active');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        gameNotification.classList.remove('active');
        setTimeout(() => gameNotification.classList.add('hidden'), 500);
    }, 5000);
}

function checkBossHint() {
    if (!bossHintShown && player.level >= 5) {
        bossHintShown = true;
        showNotification("戰術建議：Boss 戰臨近，建議集中火力並保持拉扯距離");
        createFloatingText(player.x, player.y - 80, "BOSS INCOMING", "#ff4444");
    }
}

function startGame() {
    init();
    gameRunning = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    startBackgroundMusic();
    animate();
    
    // Enemy Spawner
    if (window.enemyInterval) clearInterval(window.enemyInterval);
    window.enemyInterval = setInterval(spawnEnemy, config.enemySpawnRate);
}

function startMultiplayer() {
    init();
    gameRunning = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    startBackgroundMusic();
    
    // Connect to server (only if not already connected)
    if (!multiplayer.active) {
        multiplayer.connect();
    }
    
    // Simple multiplayer loop
    function multiplayerAnimate() {
        if (!gameRunning) return;
        animationId = requestAnimationFrame(multiplayerAnimate);
        
        updateCamera(); // Update camera follow
        
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        drawGrid();
        
        // Handle network input
        multiplayer.sendInput();
        
        // Draw all networked players, enemies, and bullets
        multiplayer.draw(ctx);
        
        // Return to menu if disconnected
        if (!multiplayer.active && multiplayer.socket && (multiplayer.socket.readyState === WebSocket.CLOSED || multiplayer.socket.readyState === WebSocket.CLOSING)) {
            showMainMenu();
        }
    }
    multiplayerAnimate();
}

function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(window.enemyInterval);
    finalScoreDisplay.textContent = score;
    recordScoreToLeaderboard(score);
    const gainedFunds = Math.floor(score * fundsGainMultiplier);
    if (gainedFunds > 0) {
        militaryFunds += gainedFunds;
        saveMetaProgress();
        updateFundsUI();
    }
    gameOverScreen.classList.remove('hidden');
    stopBackgroundMusic();
    startMenuMusic();
}

function showMainMenu() {
    // 如果遊戲正在運行中返回主選單，先儲存當前進度與分數
    if (gameRunning) {
        if (score > 0) {
            recordScoreToLeaderboard(score);
            const gainedFunds = Math.floor(score * fundsGainMultiplier);
            if (gainedFunds > 0) {
                militaryFunds += gainedFunds;
                saveMetaProgress();
                updateFundsUI();
            }
        }
        updateUserUI(); // 確保最高紀錄顯示已更新
    }

    gameRunning = false;
    // 多人模式退出處理
    if (multiplayer && multiplayer.active) {
        multiplayer.disconnect();
    }
    
    cancelAnimationFrame(animationId);
    clearInterval(window.enemyInterval);
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    
    // Reset background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (unitModal) {
        unitModal.classList.add('hidden');
    }
    stopBackgroundMusic();
    startMenuMusic();
}

// Initial Draw (Background)
resizeCanvas();
ctx.fillStyle = '#1a1a1a';
ctx.fillRect(0, 0, canvas.width, canvas.height);
if (musicEnabled) {
    startMenuMusic();
}


function ensureMenuMusicNode() {
    if (!menuAudio) {
        menuAudio = new Audio(menuPlaylist[currentMenuTrackIndex]);
        menuAudio.onended = () => {
            currentMenuTrackIndex = (currentMenuTrackIndex + 1) % menuPlaylist.length;
            menuAudio.src = menuPlaylist[currentMenuTrackIndex];
            menuAudio.play().catch(err => {
                console.error("Menu music next track failed:", err);
            });
        };
        menuAudio.onerror = (e) => {
            console.error("Menu audio error:", e);
            menuMusicPlaying = false;
        };
        const source = audioCtx.createMediaElementSource(menuAudio);
        menuGainNode = audioCtx.createGain();
        menuGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        source.connect(menuGainNode);
        menuGainNode.connect(audioCtx.destination);
    }
}

function ensureGameMusicNode() {
    if (!gameAudio) {
        gameAudio = new Audio(gamePlaylist[currentTrackIndex]);
        gameAudio.onended = () => {
            currentTrackIndex = (currentTrackIndex + 1) % gamePlaylist.length;
            gameAudio.src = gamePlaylist[currentTrackIndex];
            gameAudio.play().catch(err => {
                console.error("Game music next track failed:", err);
            });
        };
        gameAudio.onerror = (e) => {
            console.error("Game audio error:", e);
        };
        const source = audioCtx.createMediaElementSource(gameAudio);
        gameGainNode = audioCtx.createGain();
        gameGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        source.connect(gameGainNode);
        gameGainNode.connect(audioCtx.destination);
    }
}

let menuMusicPlaying = false;
function startMenuMusic() {
    if (!musicEnabled || menuMusicPlaying) return;
    menuMusicPlaying = true;
    ensureMenuMusicNode();
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    if (menuGainNode) {
        menuGainNode.gain.cancelScheduledValues(now);
        menuGainNode.gain.setValueAtTime(0, now);
        menuGainNode.gain.linearRampToValueAtTime(0.4, now + 2);
    }
    
    menuAudio.play().then(() => {
        console.log("Menu music playing...");
    }).catch(err => {
        console.error("Menu music play error:", err);
        menuMusicPlaying = false;
    });
}

function stopMenuMusic() {
    if (!menuGainNode || !menuAudio || !menuMusicPlaying) return;
    menuMusicPlaying = false;
    const now = audioCtx.currentTime;
    menuGainNode.gain.cancelScheduledValues(now);
    menuGainNode.gain.setValueAtTime(menuGainNode.gain.value, now);
    menuGainNode.gain.linearRampToValueAtTime(0, now + 1.5);
    setTimeout(() => {
        try {
            if (!menuMusicPlaying) menuAudio.pause();
        } catch {}
    }, 1600);
}

function startBackgroundMusic() {
    if (!musicEnabled) return;
    stopMenuMusic();
    ensureGameMusicNode();
    const now = audioCtx.currentTime;
    if (gameGainNode) {
        gameGainNode.gain.cancelScheduledValues(now);
        gameGainNode.gain.setValueAtTime(0, now);
        gameGainNode.gain.linearRampToValueAtTime(0.4, now + 2);
    }
    gameAudio.currentTime = 0;
    gameAudio.play().catch(() => {});
}

function stopBackgroundMusic() {
    if (!gameGainNode || !gameAudio) return;
    const now = audioCtx.currentTime;
    gameGainNode.gain.cancelScheduledValues(now);
    gameGainNode.gain.setValueAtTime(gameGainNode.gain.value, now);
    gameGainNode.gain.linearRampToValueAtTime(0, now + 1.5);
    setTimeout(() => {
        try {
            gameAudio.pause();
        } catch {}
    }, 1600);
}

function setMusicDuck(duck) {
    if (!gameGainNode) return;
    const now = audioCtx.currentTime;
    gameGainNode.gain.cancelScheduledValues(now);
    const target = duck ? 0.2 : 0.4;
    gameGainNode.gain.setValueAtTime(gameGainNode.gain.value, now);
    gameGainNode.gain.linearRampToValueAtTime(target, now + 0.3);
}
