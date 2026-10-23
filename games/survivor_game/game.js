const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Global State
var gameRunning = false;
var isPaused = false;
var currentUser = null;

// 取得 gameRunning 的安全存取包裝，避免早期載入的暫時性死區
function isGameRunning() {
    try { return !!gameRunning; } catch (e) { return false; }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed', err));
    });
}

// UI Elements
const hpDisplay = document.getElementById('hp-display');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const xpBarFill = document.getElementById('xp-bar-fill');
const airSupportFillNew = document.getElementById('air-support-fill-new');
const skillStatusText = document.getElementById('skill-status-text');
const tacticalSkillOverlay = document.getElementById('tactical-skill-overlay');
const gameOverScreen = document.getElementById('game-over-screen');

// Settings Elements
// ===== 安全 localStorage 存取(隱私模式/WebView 被拒時降級,不崩潰 — 裝備/登入/進度載入根因修復) =====
function lsGet(k) { try { return lsGet(k); } catch (e) { return null; } }
function lsSet(k, v) { try { lsSet(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { lsDel(k); return true; } catch (e) { return false; } }
function lsClear() { try { lsClear(); return true; } catch (e) { return false; } }

const settingsModal = document.getElementById('settings-modal');
const settingsTriggerBtn = document.getElementById('settings-trigger-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const masterVolumeInput = document.getElementById('setting-master-volume');
const musicEnabledCheckbox = document.getElementById('setting-music-enabled');
const sfxEnabledCheckbox = document.getElementById('setting-sfx-enabled');
const autoAimCheckbox = document.getElementById('setting-auto-aim');
const screenShakeCheckbox = document.getElementById('setting-screen-shake');
const showDamageCheckbox = document.getElementById('setting-show-damage');
const particleQualitySelect = document.getElementById('setting-particle-quality');

// Global Settings State
let gameSettings = {
    masterVolume: 70,
    musicEnabled: true,
    sfxEnabled: true,
    autoAim: true,
    screenShake: true,
    showDamage: true,
    particleQuality: 'medium'
};

function loadSettings() {
    const saved = lsGet('survivor_settings');
    if (saved) {
        gameSettings = { ...gameSettings, ...JSON.parse(saved) };
    }
    applySettings();
}

function applySettings() {
    // Sync UI inputs
    if (masterVolumeInput) masterVolumeInput.value = gameSettings.masterVolume;
    if (musicEnabledCheckbox) musicEnabledCheckbox.checked = gameSettings.musicEnabled;
    if (sfxEnabledCheckbox) sfxEnabledCheckbox.checked = gameSettings.sfxEnabled;
    if (autoAimCheckbox) autoAimCheckbox.checked = gameSettings.autoAim;
    if (screenShakeCheckbox) screenShakeCheckbox.checked = gameSettings.screenShake;
    if (showDamageCheckbox) showDamageCheckbox.checked = gameSettings.showDamage;
    if (particleQualitySelect) particleQualitySelect.value = gameSettings.particleQuality;

    // Apply audio settings
    try {
        if (!gameSettings.musicEnabled) {
            stopMenuMusic();
            stopBackgroundMusic();
        } else if (isGameRunning()) {
            startBackgroundMusic();
        } else {
            startMenuMusic();
        }
    } catch (e) {
        // 早期初始化時忽略音樂設定錯誤
    }
}

function saveSettings() {
    gameSettings = {
        masterVolume: parseInt(masterVolumeInput.value),
        musicEnabled: musicEnabledCheckbox.checked,
        sfxEnabled: sfxEnabledCheckbox.checked,
        autoAim: autoAimCheckbox.checked,
        screenShake: screenShakeCheckbox.checked,
        showDamage: showDamageCheckbox.checked,
        particleQuality: particleQualitySelect.value
    };
    lsSet('survivor_settings', JSON.stringify(gameSettings));
    applySettings();
    settingsModal.classList.add('hidden');
    createFloatingText(canvas.width/2, canvas.height/2, t('設定已儲存'), "#00ffff");
}

// 語言切換接線:#setting-language → I18N.setLang() → localStorage + 全域套用
(function () {
    const sel = document.getElementById('setting-language');
    if (!sel) return;
    sel.value = (typeof I18N !== 'undefined') ? I18N.getLang() : 'zh';
    sel.addEventListener('change', () => {
        if (typeof I18N !== 'undefined') I18N.setLang(sel.value);
    });
    // 切換語言時通知動態面板重繪(房間列表等)
    window.onLanguageChange = function () {
        try {
            if (typeof multiplayer !== 'undefined' && multiplayer && typeof lobbyModal !== 'undefined' &&
                lobbyModal && !lobbyModal.classList.contains('hidden') && multiplayer.requestRoomList) {
                multiplayer.requestRoomList();
            }
        } catch (e) { /* 重繪失敗不阻斷 */ }
    };
})();

if (settingsTriggerBtn) {
    settingsTriggerBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
}

if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
}

// 在初始化時讀取設定
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
const adminViewDataBtn = document.getElementById('admin-view-data-btn');
const adminDataModal = document.getElementById('admin-data-modal');
const adminDataList = document.getElementById('admin-data-list');
const closeAdminDataBtn = document.getElementById('close-admin-data-btn');

// Login UI Elements
const loginModal = document.getElementById('login-modal');
const loginTriggerBtn = document.getElementById('login-trigger-btn');
const closeLoginBtn = document.getElementById('close-login-btn');
const guestContinueBtn = document.getElementById('guest-continue-btn');
const logoutBtn = document.getElementById('logout-btn');
const displayUserName = document.getElementById('display-user-name');
const displayUid = document.getElementById('display-uid');

const btnSubmitLogin = document.getElementById('btn-submit-login');
const btnGotoRegister = document.getElementById('btn-goto-register');
const btnRegNext = document.getElementById('btn-reg-next');
const btnBacktoLogin = document.getElementById('btn-backto-login');
const btnRegSubmit = document.getElementById('btn-reg-submit');
const btnRegBack = document.getElementById('btn-reg-back');
const btnSubmitMigration = document.getElementById('btn-submit-migration');
const btnCancelMigration = document.getElementById('btn-cancel-migration');

const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const regEmailInput = document.getElementById('reg-email');
const regPasswordInput = document.getElementById('reg-password');
const regUsernameInput = document.getElementById('reg-username');
const migrateEmailInput = document.getElementById('migrate-email');

const authViewLogin = document.getElementById('auth-view-login');
const authViewRegStep1 = document.getElementById('auth-view-register-step1');
const authViewRegStep2 = document.getElementById('auth-view-register-step2');
const authViewMigration = document.getElementById('auth-view-migration');

// Google Login Client ID (請替換為您自己的 Google Client ID)
const GOOGLE_CLIENT_ID = "643599361893-ss0eobqotk8p53lkpatma6177d10e8dp.apps.googleusercontent.com";

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
const accountSettingsBtn = document.getElementById('account-settings-btn');
const accountSettingsModal = document.getElementById('account-settings-modal');
const closeAccountSettingsBtn = document.getElementById('close-account-settings-btn');
const accountRenameBtn = document.getElementById('account-rename-btn');
const newUsernameInput = document.getElementById('new-username');
const bindingStatus = document.getElementById('binding-status');
const replayTutorialBtn = document.getElementById('replay-tutorial-btn');
const tutorialModal = document.getElementById('tutorial-modal');
const tutorialContinueBtn = document.getElementById('tutorial-continue-btn');
const closeTutorialBtn = document.getElementById('close-tutorial-btn');
const commanderGuide = document.getElementById('commander-guide');
const guideText = document.getElementById('guide-text');
const guideNextBtn = document.getElementById('guide-next-btn');
const guideSkipBtn = document.getElementById('guide-skip-btn');

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

// Initialize Game
window.addEventListener('DOMContentLoaded', () => {
    try {
        loadSettings();
    } catch (e) {
        console.error("Failed to load settings:", e);
    }

    // Attach Mode Selection Listeners
    const selectPcBtn = document.getElementById('select-pc-mode');
    const selectMobileBtn = document.getElementById('select-mobile-mode');
    
    if (selectPcBtn) {
        selectPcBtn.addEventListener('click', () => {
            console.log("PC mode selected");
            setControlMode('pc');
        });
    }
    if (selectMobileBtn) {
        selectMobileBtn.addEventListener('click', () => {
            console.log("Mobile mode selected");
            setControlMode('mobile');
        });
    }
});

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
    multishot: { level: 0, maxLevel: Infinity, name: t('火力網擴張'), desc: t('同步發射更多彈藥'), icon: '🎯' },
    fireRate: { level: 0, maxLevel: Infinity, name: t('射控優化'), desc: t('降低射擊冷卻時間'), icon: '⚡' },
    damage: { level: 0, maxLevel: Infinity, name: t('高能彈頭'), desc: t('強化子彈視覺與威力'), icon: '📈' },
    speed: { level: 0, maxLevel: Infinity, name: t('推進強化'), desc: t('提升戰術移動速度'), icon: '💨' },
    hp: { level: 0, maxLevel: Infinity, name: t('修復奈米'), desc: t('自動修復受損裝甲'), icon: '🛡️' }
};

// Control Mode State
let controlMode = 'pc'; // 'pc' or 'mobile'
const mobileControlsUI = document.getElementById('mobile-controls');
const modePcBtn = document.getElementById('mode-pc-btn');
const modeMobileBtn = document.getElementById('mode-mobile-btn');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
const mobileSkillBtn = document.getElementById('mobile-skill-btn');
const modeSelectionModal = document.getElementById('mode-selection-modal');

let joystickActive = false;
let joystickTouchId = null;
let targetingTouchId = null;
let joystickStartPos = { x: 0, y: 0 };
let joystickCurrentPos = { x: 0, y: 0 };
let joystickVector = { x: 0, y: 0 };

function setControlMode(mode) {
    controlMode = mode;
    const skillKeyLabel = document.getElementById('skill-key-label');
    if (mode === 'mobile') {
        modeMobileBtn.classList.add('active');
        modePcBtn.classList.remove('active');
        if (gameRunning) mobileControlsUI.classList.remove('hidden');
        if (skillKeyLabel) skillKeyLabel.textContent = 'TAP ICON';
    } else {
        modePcBtn.classList.add('active');
        modeMobileBtn.classList.remove('active');
        mobileControlsUI.classList.add('hidden');
        if (skillKeyLabel) skillKeyLabel.textContent = 'SPACE';
    }
    lsSet('survivor_control_mode', mode);
    if (modeSelectionModal) modeSelectionModal.classList.add('hidden');
}

// Initial detection or load from storage
const savedMode = lsGet('survivor_control_mode');
if (savedMode) {
    setControlMode(savedMode);
    if (modeSelectionModal) modeSelectionModal.classList.add('hidden');
} else {
    // 如果沒有存檔，顯示選擇視窗
    if (modeSelectionModal) modeSelectionModal.classList.remove('hidden');
    // 預測模式但暫不設定，等待用戶選擇
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    controlMode = isTouchDevice ? 'mobile' : 'pc';
}

if (modePcBtn) modePcBtn.addEventListener('click', () => setControlMode('pc'));
if (modeMobileBtn) modeMobileBtn.addEventListener('click', () => setControlMode('mobile'));

// Joystick Logic
if (joystickBase) {
    joystickBase.addEventListener('touchstart', (e) => {
        // 搖桿優先處理其區域內的觸控
        const touch = e.changedTouches[0];
        
        joystickActive = true;
        joystickTouchId = touch.identifier;
        const rect = joystickBase.getBoundingClientRect();
        joystickStartPos = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        updateJoystick(touch);
        e.preventDefault();
        e.stopPropagation(); // 防止冒泡到 window 的瞄準邏輯
    }, { passive: false });

    window.addEventListener('touchstart', (e) => {
        // 如果不是搖桿觸控，且正在瞄準，則此觸控可用於瞄準
        if (targetingState.active && !targetingState.locked) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier !== joystickTouchId) {
                    targetingTouchId = touch.identifier;
                    updateTargetingFromTouch(touch);
                    break;
                }
            }
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            
            if (touch.identifier === joystickTouchId) {
                updateJoystick(touch);
                e.preventDefault();
            } else if (targetingState.active && !targetingState.locked) {
                // 如果沒有設定瞄準觸控 ID，或者正是當前觸控 ID，則更新瞄準位置
                if (targetingTouchId === null || touch.identifier === targetingTouchId) {
                    targetingTouchId = touch.identifier;
                    updateTargetingFromTouch(touch);
                    e.preventDefault();
                }
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystickTouchId) {
                joystickActive = false;
                joystickTouchId = null;
                joystickVector = { x: 0, y: 0 };
                joystickStick.style.transform = `translate(-50%, -50%)`;
            } else if (touch.identifier === targetingTouchId) {
                targetingTouchId = null;
            }
        }
    });

    window.addEventListener('touchcancel', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystickTouchId) {
                joystickActive = false;
                joystickTouchId = null;
                joystickVector = { x: 0, y: 0 };
                joystickStick.style.transform = `translate(-50%, -50%)`;
            } else if (touch.identifier === targetingTouchId) {
                targetingTouchId = null;
            }
        }
    });
}

function updateJoystick(touch) {
    const dx = touch.clientX - joystickStartPos.x;
    const dy = touch.clientY - joystickStartPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 50;
    
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);
    
    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;
    
    joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
    
    joystickVector = {
        x: Math.cos(angle) * (clampedDist / maxRadius),
        y: Math.sin(angle) * (clampedDist / maxRadius)
    };
}

function updateTargetingFromTouch(touch) {
    const rect = canvas.getBoundingClientRect();
    const tx = touch.clientX - rect.left;
    const ty = touch.clientY - rect.top;
    targetingState.x = tx + camera.x;
    targetingState.y = ty + camera.y;
}

if (mobileSkillBtn) {
    mobileSkillBtn.addEventListener('touchstart', (e) => {
        if (gameRunning && !isPaused) {
            if (targetingState.active && !targetingState.locked) {
                targetingState.locked = true;
                playSound('shoot');
            } else {
                requestAirSupport();
            }
        }
        e.preventDefault();
        e.stopPropagation(); // 防止冒泡到 window 的瞄準邏輯
    }, { passive: false });
}

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

const gamePlaylist = [
    'In-game music/AnyConv.com__【Estella】PYKAMIA - Fantasia Sonata Estella.ogg',
    'In-game music/AnyConv.com__【Milthm】PYKAMIA - Fantasia Sonata Arcadia.ogg'
];
let currentTrackIndex = 0;

const menuPlaylist = ['menu_theme/独り音 _ 君と恋【フリーBGM・歌】_320k.ogg'];
let currentMenuTrackIndex = 0;

let loginDemoCtx = null;
let loginDemoLastTime = 0;
let loginDemoEntities = [];
let loginDemoAnimationId = null;

let menuBgActive = false;
let menuBgAnimationId = null;
let menuBgLastTime = 0;
let menuBgEntities = [];
let menuBgPlayer = null;

function playSound(type) {
    if (!gameSettings.sfxEnabled) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    const masterVol = gameSettings.masterVolume / 100;
    
    switch(type) {
        case 'shoot':
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(400, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0.1 * masterVol, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
        case 'hit':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(100, now);
            oscillator.frequency.linearRampToValueAtTime(50, now + 0.1);
            gainNode.gain.setValueAtTime(0.05 * masterVol, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
        case 'kill':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(200, now);
            oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
            gainNode.gain.setValueAtTime(0.1 * masterVol, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            oscillator.start(now);
            oscillator.stop(now + 0.2);
            break;
        case 'xp':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, now);
            oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gainNode.gain.setValueAtTime(0.05 * masterVol, now);
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
                g.gain.setValueAtTime(0.05 * masterVol, now + i * 0.1);
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
            noiseGain.gain.setValueAtTime(0.8 * masterVol, now);
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
            gainNode.gain.setValueAtTime(0.1 * masterVol, now);
            gainNode.gain.linearRampToValueAtTime(0.1 * masterVol, now + 0.5);
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
    // 遊戲語音已移除，改為系統彈出通知
    showNotification(text);
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
        name: t('攻擊無人機中隊'),
        desc: t('開局即獲得額外火力，每次射擊多一發子彈。'),
        cost: 5000,
        icon: '🛸'
    },
    medic: {
        id: 'medic',
        name: t('前線醫療小隊'),
        desc: t('提升最大生命值並在出戰時完全修復裝甲。'),
        cost: 4000,
        icon: '⛑️'
    },
    logistics: {
        id: 'logistics',
        name: t('後勤補給線'),
        desc: t('提升軍資獲取效率，戰後可獲得更多軍資。'),
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

if (startBtn) {
    startBtn.addEventListener('click', startGame);
}
if (restartBtn) {
    restartBtn.addEventListener('click', startGame);
}
if (menuBtn) {
    menuBtn.addEventListener('click', showMainMenu);
}

// Login Logic

function saveUserSession() {
    if (currentUser) {
        lsSet('survivor_user', JSON.stringify(currentUser));
    } else {
        lsDel('survivor_user');
    }
}

function tutorialKey() {
    if (!currentUser) return null;
    return `survivor_tutorial_done_${currentUser.uid}`;
}

function showTutorialIfNeeded() {
    const k = tutorialKey();
    if (!k) return;
    const done = lsGet(k);
    if (!done && tutorialModal) {
        tutorialModal.classList.remove('hidden');
    }
}

function resetTutorial() {
    const k = tutorialKey();
    if (!k) return;
    lsDel(k);
    if (tutorialModal) {
        tutorialModal.classList.remove('hidden');
    }
    tutorialGuide.active = false;
    tutorialGuide.step = 0;
    if (commanderGuide) {
        commanderGuide.classList.add('hidden');
        commanderGuide.classList.remove('talking');
    }
}

function markTutorialDone() {
    const k = tutorialKey();
    if (!k) return;
    lsSet(k, '1');
    if (tutorialModal) tutorialModal.classList.add('hidden');
    if (commanderGuide) {
        commanderGuide.classList.add('hidden');
        commanderGuide.classList.remove('talking');
    }
}
let tutorialGuide = {
    active: false,
    step: 0,
    lines: [
        t('指揮官，歡迎加入。我是本次行動的導引官，將協助你完成初次部署。'),
        t('基本操作：以鍵盤 WASD 移動，滑鼠指向即可自動射擊。'),
        t('現在進入戰區，熟悉射擊與走位。必要時按下空白鍵呼叫空襲支援。'),
        t('保持距離、持續輸出，注意血量與經驗球。達到升級時選擇系統強化。'),
        t('行動結束後會結算軍資並更新戰績。祝你旗開得勝。')
    ],
    show(text) {
        if (commanderGuide && guideText) {
            guideText.textContent = text;
            commanderGuide.classList.remove('hidden');
            commanderGuide.classList.remove('talking');
            void commanderGuide.offsetWidth;
            commanderGuide.classList.add('talking');
        }
    },
    start() {
        this.active = true;
        this.step = 0;
        this.show(this.lines[this.step]);
    },
    next() {
        if (!this.active) return;
        this.step++;
        if (this.step === 2) {
            showMainMenu();
            startGame();
        }
        if (this.step >= this.lines.length) {
            this.active = false;
            markTutorialDone();
        } else {
            this.show(this.lines[this.step]);
        }
    },
    skip() {
        this.active = false;
        markTutorialDone();
    }
};
function migrateUserProgress(oldName, newName) {
    const bases = ['survivor_funds', 'survivor_units_owned', 'survivor_units_equipped'];
    bases.forEach(b => {
        const oldKey = `${b}_${oldName}`;
        const newKey = `${b}_${newName}`;
        const val = lsGet(oldKey);
        if (val !== null && val !== undefined) {
            lsSet(newKey, val);
            lsDel(oldKey);
        }
    });
}

function isCurrentUserBound() {
    try {
        const raw = lsGet('survivor_google_bindings');
        const bindings = raw ? JSON.parse(raw) : {};
        if (!currentUser) return false;
        const entries = Object.entries(bindings);
        for (const [, v] of entries) {
            if (v && v.username === currentUser.username && v.uid === currentUser.uid) return true;
        }
        return false;
    } catch {
        return false;
    }
}

function updateBindingUI() {
    const bound = isCurrentUserBound();
    if (bindingStatus) {
        bindingStatus.textContent = bound ? t('綁定狀態：已綁定') : t('綁定狀態：未綁定');
    }
    const bindContainer = document.getElementById('google-bind-container');
    if (bindContainer) {
        bindContainer.style.display = bound ? 'none' : 'flex';
    }
}

let tempRegData = { email: '', password: '' };
let tempMigrationData = { username: '', password: '', userObj: null };

function showAuthView(viewName) {
    if (authViewLogin) authViewLogin.classList.add('hidden');
    if (authViewRegStep1) authViewRegStep1.classList.add('hidden');
    if (authViewRegStep2) authViewRegStep2.classList.add('hidden');
    if (authViewMigration) authViewMigration.classList.add('hidden');

    if (viewName === 'login' && authViewLogin) authViewLogin.classList.remove('hidden');
    else if (viewName === 'register-step1' && authViewRegStep1) authViewRegStep1.classList.remove('hidden');
    else if (viewName === 'register-step2' && authViewRegStep2) authViewRegStep2.classList.remove('hidden');
    else if (viewName === 'migration' && authViewMigration) authViewMigration.classList.remove('hidden');
}

// ===== 開發人員名單:阿奇(archie)、滷蛋 =====
var DEV_TEAM_ALIASES = ['阿奇', 'archie', 'Archie', '滷蛋'];
function isDevAccount(user) {
    const u = user || currentUser;
    if (!u) return false;
    if (u.isAdmin) return true;
    return u.username === t('開發團隊') || DEV_TEAM_ALIASES.indexOf(u.username) !== -1;
}

function isUsernameTaken(username) {
    if (['Dev',t('開發人員'),'Developer','Admin',t('開發團隊')].concat(DEV_TEAM_ALIASES).includes(username)) return true;
    
    const accountsRaw = lsGet('survivor_accounts');
    const oldAccounts = accountsRaw ? JSON.parse(accountsRaw) : {};
    if (oldAccounts[username]) return true;
    
    const v2Raw = lsGet('survivor_accounts_v2');
    const v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
    for (const email in v2Accounts) {
        if (v2Accounts[email] && v2Accounts[email].user && v2Accounts[email].user.username === username) {
            return true;
        }
    }
    
    const bindingsRaw = lsGet('survivor_google_bindings');
    const bindings = bindingsRaw ? JSON.parse(bindingsRaw) : {};
    for (const key in bindings) {
        if (bindings[key] && bindings[key].username === username) return true;
    }
    
    return false;
}

function isEmailTaken(email) {
    const v2Raw = lsGet('survivor_accounts_v2');
    const v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
    return !!v2Accounts[email];
}

function handleAccountRename() {
    const newName = (newUsernameInput ? newUsernameInput.value.trim() : '').slice(0, 20);
    if (!currentUser || !newName) { alert(t('請輸入新的名稱')); return; }
    const oldName = currentUser.username;
    if (newName === oldName) { alert(t('名稱未變更')); return; }
    
    if (isUsernameTaken(newName)) {
        alert(t('此名稱已被使用'));
        return;
    }

    if (currentUser.email) {
        const v2Raw = lsGet('survivor_accounts_v2');
        let v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
        if (v2Accounts[currentUser.email]) {
            v2Accounts[currentUser.email].user.username = newName;
            lsSet('survivor_accounts_v2', JSON.stringify(v2Accounts));
        }
    } else {
        // Fallback for old accounts if they bypassed migration
        const raw = lsGet('survivor_accounts');
        let accounts = raw ? JSON.parse(raw) : {};
        if (accounts[oldName]) {
            const pw = accounts[oldName].password;
            accounts[newName] = { password: pw, user: { ...currentUser, username: newName } };
            delete accounts[oldName];
            lsSet('survivor_accounts', JSON.stringify(accounts));
        }
    }

    migrateUserProgress(oldName, newName);
    currentUser.username = newName;
    saveUserSession();
    loadMetaProgress();
    updateUserUI();
    if (accountSettingsModal) accountSettingsModal.classList.add('hidden');
    updateBindingUI();
    alert(isCurrentUserBound() ? t('名稱已更新（已綁定）') : t('名稱已更新'));
}

function handleBtnRegNext() {
    const email = regEmailInput ? regEmailInput.value.trim() : '';
    const password = regPasswordInput ? regPasswordInput.value.trim() : '';
    
    if (!email) { alert(t('請輸入電子郵件')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert(t('請輸入有效的電子郵件格式')); return; }
    if (password.length < 6) { alert(t('密碼請設定至少 6 個字元')); return; }
    
    if (isEmailTaken(email)) {
        alert(t('此信箱已經註冊過帳號，請直接登入或使用其他信箱。'));
        return;
    }
    
    tempRegData.email = email;
    tempRegData.password = password;
    showAuthView('register-step2');
}

function handleBtnRegSubmit() {
    const username = regUsernameInput ? regUsernameInput.value.trim() : '';
    if (!username) { alert(t('請輸入指揮官代號')); return; }
    
    if (isUsernameTaken(username)) {
        alert(t('此指揮官代號已被使用，請更換其他名稱。'));
        return;
    }
    
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) - hash) + username.charCodeAt(i);
        hash |= 0;
    }
    const uidSuffix = Math.abs(hash % 10000).toString().padStart(4, '0');
    const uid = 'CMD_' + uidSuffix;
    
    currentUser = { username, uid, isAdmin: false, email: tempRegData.email };
    
    const v2Raw = lsGet('survivor_accounts_v2');
    let v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
    
    v2Accounts[tempRegData.email] = { password: tempRegData.password, user: currentUser };
    lsSet('survivor_accounts_v2', JSON.stringify(v2Accounts));
    
    tempRegData = { email: '', password: '' };
    
    saveUserSession();
    loadMetaProgress(); 
    updateUserUI();
    loginModal.classList.add('hidden');
    
    if (regEmailInput) regEmailInput.value = '';
    if (regPasswordInput) regPasswordInput.value = '';
    if (regUsernameInput) regUsernameInput.value = '';
    
    alert(tf('註冊成功，{username} 指揮官已建立帳號並登入！', { username: currentUser.username }));
    renderLeaderboard(); 
    showTutorialIfNeeded();
}

function handleBtnSubmitLogin() {
    const emailOrOldId = loginEmailInput ? loginEmailInput.value.trim() : '';
    const password = loginPasswordInput ? loginPasswordInput.value.trim() : '';
    
    if (!emailOrOldId || !password) {
        alert(t('請輸入登入資訊與密碼'));
        return;
    }
    
    if (emailOrOldId === 'Dev' || emailOrOldId === t('開發人員') || emailOrOldId === 'Developer' || emailOrOldId === 'Admin') {
        currentUser = { username: t('開發團隊'), uid: 'DEV_001', isAdmin: true };
        completeLoginFlow();
        return;
    }
    // 開發人員名單:阿奇(archie)、滷蛋 — 以代號登入即取得開發權限(各自保有代號顯示)
    const devMemberUid = { '阿奇': 'DEV_ARCHIE', 'archie': 'DEV_ARCHIE', 'Archie': 'DEV_ARCHIE', '滷蛋': 'DEV_LUDAN' }[emailOrOldId];
    if (devMemberUid) {
        const devName = (emailOrOldId === 'archie' || emailOrOldId === 'Archie') ? '阿奇' : emailOrOldId;
        currentUser = { username: devName, uid: devMemberUid, isAdmin: true };
        completeLoginFlow();
        return;
    }
    
    const v2Raw = lsGet('survivor_accounts_v2');
    const v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
    
    if (v2Accounts[emailOrOldId] && v2Accounts[emailOrOldId].password === password) {
        currentUser = v2Accounts[emailOrOldId].user;
        if (!currentUser.email) currentUser.email = emailOrOldId;
        completeLoginFlow();
        return;
    }
    
    const accountsRaw = lsGet('survivor_accounts');
    const oldAccounts = accountsRaw ? JSON.parse(accountsRaw) : {};
    
    if (oldAccounts[emailOrOldId]) {
        if (oldAccounts[emailOrOldId].password !== password) {
            alert(t('密碼錯誤，請再試一次。'));
            return;
        }
        tempMigrationData = { 
            username: emailOrOldId, 
            password: password, 
            userObj: oldAccounts[emailOrOldId].user 
        };
        showAuthView('migration');
        return;
    }
    
    alert(t('找不到此帳號或信箱，請確認輸入是否有誤。'));
}

function completeLoginFlow() {
    saveUserSession();
    loadMetaProgress(); 
    updateUserUI();
    loginModal.classList.add('hidden');
    
    if (loginEmailInput) loginEmailInput.value = '';
    if (loginPasswordInput) loginPasswordInput.value = '';
    
    alert(tf('登入成功，{username} 指揮官已登入！', { username: currentUser.username }));
    renderLeaderboard(); 
    showTutorialIfNeeded();
}

function handleBtnSubmitMigration() {
    const bindEmail = migrateEmailInput ? migrateEmailInput.value.trim() : '';
    if (!bindEmail) { alert(t('請輸入您的電子郵件')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bindEmail)) { alert(t('請輸入有效的電子郵件格式')); return; }
    
    if (isEmailTaken(bindEmail)) {
        alert(t('此信箱已經綁定過帳號，無法重複綁定。'));
        return;
    }
    
    const v2Raw = lsGet('survivor_accounts_v2');
    let v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
    
    tempMigrationData.userObj.email = bindEmail;
    v2Accounts[bindEmail] = {
        password: tempMigrationData.password,
        user: tempMigrationData.userObj
    };
    
    lsSet('survivor_accounts_v2', JSON.stringify(v2Accounts));
    
    const accountsRaw = lsGet('survivor_accounts');
    let oldAccounts = accountsRaw ? JSON.parse(accountsRaw) : {};
    delete oldAccounts[tempMigrationData.username];
    lsSet('survivor_accounts', JSON.stringify(oldAccounts));
    
    currentUser = tempMigrationData.userObj;
    tempMigrationData = { username: '', password: '', userObj: null };
    
    if (migrateEmailInput) migrateEmailInput.value = '';
    completeLoginFlow();
}

function continueAsGuest() {
    currentUser = null;
    saveUserSession();
    loadMetaProgress();
    updateUserUI();
    loginModal.classList.add('hidden');
    renderLeaderboard();
    alert(t('已使用訪客身份繼續，目前進度將儲存在本機。'));
}

function handleGoogleLogin(response) {
    try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const googleUser = JSON.parse(jsonPayload);
        const bindingsRaw = lsGet('survivor_google_bindings');
        let bindings = bindingsRaw ? JSON.parse(bindingsRaw) : {};
        let hash = 0;
        const seed = googleUser.sub || googleUser.email;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        const uidSuffix = Math.abs(hash % 10000).toString().padStart(4, '0');
        const uid = 'GGL_' + uidSuffix;

        if (accountSettingsModal && !accountSettingsModal.classList.contains('hidden') && currentUser) {
            bindings[seed] = { username: currentUser.username, uid: currentUser.uid };
            lsSet('survivor_google_bindings', JSON.stringify(bindings));
            currentUser = { 
                ...currentUser,
                isGoogleUser: true,
                email: googleUser.email,
                picture: googleUser.picture
            };
            saveUserSession();
            loadMetaProgress();
            updateUserUI();
            accountSettingsModal.classList.add('hidden');
            alert(t('Google 帳號綁定成功'));
            return;
        }
        
        if (bindings[seed] && bindings[seed].username) {
            const boundName = bindings[seed].username;
            const boundUid = bindings[seed].uid || uid;
            let found = false;
            
            const v2Raw = lsGet('survivor_accounts_v2');
            const v2Accounts = v2Raw ? JSON.parse(v2Raw) : {};
            for (const email in v2Accounts) {
                if (v2Accounts[email].user && v2Accounts[email].user.username === boundName) {
                    currentUser = v2Accounts[email].user;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                const accountsRaw = lsGet('survivor_accounts');
                const oldAccounts = accountsRaw ? JSON.parse(accountsRaw) : {};
                if (oldAccounts[boundName]) {
                    currentUser = oldAccounts[boundName].user;
                    found = true;
                }
            }
            
            if (!found) {
                currentUser = { username: boundName, uid: boundUid, isAdmin: false };
            }
            
            currentUser.isGoogleUser = true;
            currentUser.email = googleUser.email;
            currentUser.picture = googleUser.picture;
            
        } else {
            currentUser = { 
                username: googleUser.name, 
                uid: uid, 
                isAdmin: false,
                isGoogleUser: true,
                email: googleUser.email,
                picture: googleUser.picture
            };
        }

        saveUserSession();
        loadMetaProgress();
        updateUserUI();
        loginModal.classList.add('hidden');
        
        alert(tf('Google 登入成功！歡迎回來，{username} 指揮官。', { username: currentUser.username }));
        renderLeaderboard();
        showTutorialIfNeeded();
    } catch (err) {
        console.error(t('Google 登入解析失敗:'), err);
        alert(t('Google 登入失敗，請稍後再試。'));
    }
}

// 初始化 Google 登入
function initGoogleLogin() {
    if (typeof google === 'undefined') {
        console.warn(t('Google SDK 尚未載入，稍後重試...'));
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
    const bindContainer = document.getElementById("google-bind-container");
    if (bindContainer) {
        const bound = isCurrentUserBound();
        bindContainer.style.display = bound ? 'none' : 'flex';
        google.accounts.id.renderButton(
            bindContainer,
            { 
                theme: "outline", 
                size: "large", 
                width: 250,
                text: "signin_with",
                shape: "pill"
            }
        );
    }
}

function handleFeedbackSubmit() {
    const content = feedbackContentInput.value.trim();
    if (!content) {
        alert(t('請輸入您的意見反饋內容。'));
        return;
    }

    // 儲存反饋至本機 (模擬傳送到伺服器)
    const feedbacksRaw = lsGet('survivor_feedbacks');
    let feedbacks = feedbacksRaw ? JSON.parse(feedbacksRaw) : [];
    
    feedbacks.push({
        user: currentUser ? currentUser.username : t('訪客'),
        uid: currentUser ? currentUser.uid : 'GUEST',
        content: content,
        time: new Date().toLocaleString()
    });

    lsSet('survivor_feedbacks', JSON.stringify(feedbacks));
    
    feedbackContentInput.value = '';
    feedbackModal.classList.add('hidden');
    alert(t('感謝您的意見反饋！我們已收到您的寶貴建議。'));
}

function renderAdminFeedbacks() {
    if (!adminFeedbackList) return;
    const feedbacksRaw = lsGet('survivor_feedbacks');
    const feedbacks = feedbacksRaw ? JSON.parse(feedbacksRaw) : [];
    
    adminFeedbackList.innerHTML = '';
    
    if (feedbacks.length === 0) {
        adminFeedbackList.innerHTML = '<div style="text-align:center; padding: 20px; color: rgba(255,255,255,0.4);">' + t('目前尚無任何反饋紀錄。') + '</div>';
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

function renderAdminData() {
    if (!adminDataList) return;
    
    // 獲取所有帳號資料
    const accountsRaw = lsGet('survivor_accounts');
    const accounts = accountsRaw ? JSON.parse(accountsRaw) : {};
    
    const accountsV2Raw = lsGet('survivor_accounts_v2');
    const accountsV2 = accountsV2Raw ? JSON.parse(accountsV2Raw) : {};
    
    adminDataList.innerHTML = '';
    
    // 合併並轉換資料格式
    let allPlayers = [];
    
    // 處理 V1 帳號
    for (const name in accounts) {
        const funds = lsGet(`survivor_funds_${name}`) || 0;
        const score = lsGet(`survivor_highest_score_${name}`) || 0;
        const unitsRaw = lsGet(`survivor_units_owned_${name}`);
        const units = unitsRaw ? Object.keys(JSON.parse(unitsRaw)).length : 0;
        
        allPlayers.push({
            username: name,
            uid: accounts[name].uid || 'V1_LEGACY',
            funds: funds,
            score: score,
            units: units
        });
    }
    
    // 處理 V2 帳號 (Email 綁定)
    for (const email in accountsV2) {
        const user = accountsV2[email].user;
        if (!user) continue;
        
        // 檢查是否已在 V1 處理過
        if (allPlayers.some(p => p.username === user.username)) continue;
        
        const funds = lsGet(`survivor_funds_${user.username}`) || 0;
        const score = lsGet(`survivor_highest_score_${user.username}`) || 0;
        const unitsRaw = lsGet(`survivor_units_owned_${user.username}`);
        const units = unitsRaw ? Object.keys(JSON.parse(unitsRaw)).length : 0;
        
        allPlayers.push({
            username: user.username,
            uid: user.uid,
            funds: funds,
            score: score,
            units: units
        });
    }
    
    if (allPlayers.length === 0) {
        adminDataList.innerHTML = '<div style="text-align:center; padding: 20px; color: rgba(255,255,255,0.4);">' + t('尚無任何指揮官數據。') + '</div>';
        return;
    }

    // 依軍資排序
    allPlayers.sort((a, b) => b.funds - a.funds);

    allPlayers.forEach(p => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `
            <div class="room-name">${p.username}</div>
            <div class="room-players" style="font-size: 10px;">${p.uid}</div>
            <div class="room-status" style="color: #ffff00;">💰 ${p.funds}</div>
            <div class="room-status" style="color: #00ffff;">🏆 ${p.score}</div>
            <div class="room-action">🎖️ ${p.units} 單位</div>
        `;
        adminDataList.appendChild(item);
    });
}

function handleAccountDeletion() {
    if (!currentUser) return;
    
    const usernameToDelete = currentUser.username;
    const confirmMsg = currentUser.isAdmin 
        ? t('身為開發人員，確定要註銷目前帳號並清空所有本機數據嗎？') 
        : t('確定要註銷帳號嗎？這將刪除所有軍資與戰績紀錄，且無法恢復！');
        
    if (confirm(confirmMsg)) {
        if (currentUser.isAdmin) {
            lsClear(); // Admin clears everything
            alert(t('所有系統數據已格式化完成。'));
        } else {
            // Remove user entries from leaderboard
            let list = loadLeaderboard();
            list = list.filter(entry => entry.name !== usernameToDelete);
            saveLeaderboard(list);

            // Regular user deletion
            const prefix = `_${usernameToDelete}`;
            lsDel('survivor_user');
            lsDel(`survivor_funds${prefix}`);
            lsDel(`survivor_units_owned${prefix}`);
            lsDel(`survivor_units_equipped${prefix}`);
            alert(t('帳號與相關戰績已成功註銷。'));
        }
        window.location.reload();
    }
}

function handleAdminClearData() {
    if (!currentUser || !currentUser.isAdmin) return;
    if (confirm(t('⚠️ 警告：這將刪除包括排行榜、所有使用者紀錄、軍資在內的所有數據！確定執行格式化嗎？'))) {
        lsClear();
        alert(t('數據已全數清空。'));
        window.location.reload();
    }
}

function handleLogout() {
    if (confirm(t('確定要登出嗎？'))) {
        currentUser = null;
        saveUserSession();
        
        // 登出後載入訪客（無前綴）的進度
        loadMetaProgress();
        
        updateUserUI();
        renderLeaderboard();
        alert(t('已成功登出，目前已切換為訪客模式。'));
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
            adminViewDataBtn.classList.remove('hidden');
        } else {
            adminClearDataBtn.classList.add('hidden');
            adminViewFeedbackBtn.classList.add('hidden');
            adminViewDataBtn.classList.add('hidden');
        }
    } else {
        displayUserName.textContent = t('訪客');
        displayUid.textContent = 'UID: GUEST_0000';
        loginTriggerBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        deleteAccountBtn.classList.add('hidden');
        adminClearDataBtn.classList.add('hidden');
        adminViewFeedbackBtn.classList.add('hidden');
        adminViewDataBtn.classList.add('hidden');
        
        // 訪客也應顯示其最高紀錄
        const list = loadLeaderboard();
        const guestBest = list.filter(e => e.name === t('訪客')).sort((a, b) => b.score - a.score)[0];
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
            empty.textContent = t('目前尚無紀錄，先打出你的第一場戰績吧！');
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
            empty.textContent = t('暫無戰績紀錄');
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
    const raw = lsGet('survivor_leaderboard');
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveLeaderboard(list) {
    lsSet('survivor_leaderboard', JSON.stringify(list));
}

function recordScoreToLeaderboard(finalScore) {
    if (!finalScore || finalScore <= 0) return;
    const name = currentUser && currentUser.username ? currentUser.username : t('訪客');
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
    loadGachaState(); // 星輝/倉庫/日誌與其他進度一併載入
    
    // Dev account special case
    if (isDevAccount()) {
        militaryFunds = 9999999;
        ownedUnits = {};
        equippedUnits = {};
        updateFundsUI();
        return;
    }

    // 修復:統一走 EquipmentSystem(safeStorage 防護 — 隱私模式/WebView 存取被拒時不再拋例外中斷登入與裝備載入)
    militaryFunds = 0;
    ownedUnits = {};
    equippedUnits = {};
    if (typeof EquipmentSystem !== 'undefined') {
        const st = { funds: 0, owned: {}, equipped: {} };
        EquipmentSystem.load(st, { prefix: prefix });
        militaryFunds = st.funds;
        ownedUnits = st.owned;
        equippedUnits = st.equipped;
    } else {
        const savedFunds = lsGet(`survivor_funds${prefix}`);
        if (savedFunds) {
            const parsed = parseInt(savedFunds, 10);
            if (!Number.isNaN(parsed)) militaryFunds = parsed;
        }
        try { const o = JSON.parse(lsGet(`survivor_units_owned${prefix}`)); if (o && typeof o === 'object') ownedUnits = o; } catch (e) { /* 損毀存檔 */ }
        try { const q = JSON.parse(lsGet(`survivor_units_equipped${prefix}`)); if (q && typeof q === 'object') equippedUnits = q; } catch (e) { /* 損毀存檔 */ }
    }
    updateFundsUI();
}

function initLoginDemo() {
    // Disabled at user request
    if (loginDemoAnimationId) cancelAnimationFrame(loginDemoAnimationId);
}

function loginDemoLoop(timestamp) {
    // Disabled at user request
}

function startMenuBackground() {
    if (menuBgActive) return;
    menuBgActive = true;
    menuBgEntities = [];
    for (let i = 0; i < 12; i++) {
        menuBgEntities.push({
            type: 'slime',
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            r: 10 + Math.random() * 12
        });
    }
    menuBgPlayer = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        angle: -Math.PI / 2
    };
    if (menuBgAnimationId) cancelAnimationFrame(menuBgAnimationId);
    menuBgLastTime = 0;
    menuBgAnimationId = requestAnimationFrame(menuBgLoop);
}

function stopMenuBackground() {
    menuBgActive = false;
    if (menuBgAnimationId) cancelAnimationFrame(menuBgAnimationId);
}

function menuBgLoop(timestamp) {
    if (!menuBgActive) return;
    if (!menuBgLastTime) menuBgLastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - menuBgLastTime) / 1000);
    menuBgLastTime = timestamp;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    if (menuBgPlayer) {
        menuBgPlayer.angle += dt * 0.6;
    }
    let chosen = null;
    if (menuBgPlayer && menuBgEntities.length) {
        chosen = menuBgEntities[Math.floor(timestamp / 800) % menuBgEntities.length];
    }
    menuBgEntities.forEach(e => {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < -100) e.x = canvas.width + 100;
        if (e.x > canvas.width + 100) e.x = -100;
        if (e.y < -100) e.y = canvas.height + 100;
        if (e.y > canvas.height + 100) e.y = -100;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(1.15, 0.85);
        ctx.beginPath();
        ctx.arc(0, 0, e.r, Math.PI, 0, false);
        ctx.arc(0, 0, e.r * 0.85, 0, Math.PI, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(80,255,140,0.8)';
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#00ff88';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,80,40,0.9)';
        ctx.beginPath();
        ctx.arc(-e.r * 0.35, -e.r * 0.15, e.r * 0.2, 0, Math.PI * 2);
        ctx.arc(e.r * 0.1, -e.r * 0.15, e.r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    if (menuBgPlayer) {
        ctx.save();
        ctx.translate(menuBgPlayer.x, menuBgPlayer.y);
        ctx.rotate(menuBgPlayer.angle);
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(-16, 12);
        ctx.lineTo(-16, -12);
        ctx.closePath();
        ctx.fillStyle = 'rgba(66,165,255,0.95)';
        ctx.shadowBlur = 22;
        ctx.shadowColor = '#42a5ff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(46,120,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(-2, 12);
        ctx.lineTo(-18, 22);
        ctx.lineTo(-10, 4);
        ctx.closePath();
        ctx.moveTo(-2, -12);
        ctx.lineTo(-18, -22);
        ctx.lineTo(-10, -4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-6, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,30,70,0.95)';
        ctx.fill();
        if (chosen) {
            const dx = chosen.x - menuBgPlayer.x;
            const dy = chosen.y - menuBgPlayer.y;
            const len = Math.min(220, Math.hypot(dx, dy));
            const bx = Math.cos(menuBgPlayer.angle) * len;
            const by = Math.sin(menuBgPlayer.angle) * len;
            ctx.strokeStyle = 'rgba(0,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }
        ctx.restore();
    }
    menuBgAnimationId = requestAnimationFrame(menuBgLoop);
}

function saveMetaProgress() {
    const prefix = currentUser ? `_${currentUser.username}` : '';
    if (typeof EquipmentSystem !== 'undefined') {
        EquipmentSystem.save({ funds: militaryFunds, owned: ownedUnits, equipped: equippedUnits }, { prefix: prefix });
        return;
    }
    lsSet(`survivor_funds${prefix}`, String(militaryFunds));
    lsSet(`survivor_units_owned${prefix}`, JSON.stringify(ownedUnits));
    lsSet(`survivor_units_equipped${prefix}`, JSON.stringify(equippedUnits));
}

// ===== 星輝(鑽石)角色抽卡系統:玩家資料持久化 + 面板接線 =====
var gachaState = { diamond: 0, tickets: 0, warehouse: [], logs: [], pity: {} };
var gachaActiveBanner = 'standard'; // 'standard' | 'limited'

function gachaStoreKey(suffix) {
    const prefix = currentUser ? `_${currentUser.username}` : '';
    return `survivor_${suffix}${prefix}`;
}

function loadGachaState() {
    // 開發帳號:直接給 9999 星輝 + 99 召喚券方便測試抽卡
    if (isDevAccount()) {
        gachaState = { diamond: 9999, tickets: 99, warehouse: [], logs: [], pity: {} };
        charLoadoutState = { equippedId: null };
        return;
    }
    gachaState = { diamond: 0, tickets: 0, warehouse: [], logs: [], pity: {} };
    let hadSave = false;
    try { const d = parseInt(lsGet(gachaStoreKey('xinghui')), 10); if (!isNaN(d)) { gachaState.diamond = d; hadSave = true; } } catch (e) { /* ignore */ }
    try { const w = JSON.parse(lsGet(gachaStoreKey('warehouse'))); if (Array.isArray(w)) { gachaState.warehouse = w; hadSave = true; } } catch (e) { /* ignore */ }
    try { const l = JSON.parse(lsGet(gachaStoreKey('xinghui_logs'))); if (Array.isArray(l)) gachaState.logs = l; } catch (e) { /* ignore */ }
    try { const tk = parseInt(lsGet(gachaStoreKey('tickets')), 10); if (!isNaN(tk)) gachaState.tickets = tk; } catch (e) { /* ignore */ }
    try { const p = JSON.parse(lsGet(gachaStoreKey('pity'))); if (p && typeof p === 'object') gachaState.pity = p; } catch (e) { /* ignore */ }
    try { if (lsGet(gachaStoreKey('gacha_init'))) hadSave = true; } catch (e) { /* ignore */ }
    // 首次進入遊戲:贈送新手召喚券(starterTickets)
    if (!hadSave && typeof GachaSystem !== 'undefined' && GachaSystem.GACHA_CONFIG.starterTickets > 0) {
        gachaState.tickets = GachaSystem.GACHA_CONFIG.starterTickets;
        try { lsSet(gachaStoreKey('gacha_init'), '1'); } catch (e) { /* ignore */ }
        saveGachaState();
    }
    loadCharLoadoutState();
}

function saveGachaState() {
    try {
        lsSet(gachaStoreKey('xinghui'), String(gachaState.diamond));
        lsSet(gachaStoreKey('tickets'), String(gachaState.tickets));
        lsSet(gachaStoreKey('warehouse'), JSON.stringify(gachaState.warehouse));
        lsSet(gachaStoreKey('xinghui_logs'), JSON.stringify(gachaState.logs));
        lsSet(gachaStoreKey('pity'), JSON.stringify(gachaState.pity));
    } catch (e) { /* localStorage 不可用時忽略 */ }
}

// ===== 出擊角色系統(角色庫):裝備已獲得角色,依屬性獲得生命/傷害/移速加成 =====
var charLoadoutState = { equippedId: null };
let playerCharBonuses = { maxHpBonus: 0, damageMultiplier: 1, speedMultiplier: 1 };

function charLoadoutPrefix() {
    return currentUser ? `_${currentUser.username}` : '';
}

function loadCharLoadoutState() {
    if (typeof CharLoadoutSystem === 'undefined') return;
    CharLoadoutSystem.load(charLoadoutState, gachaState.warehouse, { prefix: charLoadoutPrefix() });
}

function saveCharLoadoutState() {
    if (typeof CharLoadoutSystem === 'undefined') return;
    CharLoadoutSystem.save(charLoadoutState, { prefix: charLoadoutPrefix() });
}

// 冪等:同輸入恆同輸出;裝備角色已不在倉庫時自動回退為零加成
function currentCharBonuses() {
    const none = { maxHpBonus: 0, damageMultiplier: 1, speedMultiplier: 1 };
    if (typeof CharLoadoutSystem === 'undefined') return none;
    const id = CharLoadoutSystem.getEquippedId(charLoadoutState, gachaState.warehouse);
    if (!id || typeof CHAR_BY_ID === 'undefined' || !CHAR_BY_ID[id]) return none;
    return CharLoadoutSystem.computeCharacterBonuses(CHAR_BY_ID[id].stats);
}

// --- 抽卡面板 UI(卡池 v2:常駐/限定分頁、十連、保底進度、動畫結果卡、倉庫) ---
const gachaModal = document.getElementById('gacha-modal');
const gachaOpenBtn = document.getElementById('gacha-btn');
const gachaCloseBtn = document.getElementById('gacha-close-btn');
const gachaBalanceEl = document.getElementById('gacha-balance');
const gachaTicketsEl = document.getElementById('gacha-tickets');
const gachaPullBtn = document.getElementById('gacha-pull-btn');
const gachaPull10Btn = document.getElementById('gacha-pull10-btn');
const gachaResultEl = document.getElementById('gacha-result');
const gachaBannerInfoEl = document.getElementById('gacha-banner-info');
const gachaTabStandardEl = document.getElementById('gacha-tab-standard');
const gachaTabLimitedEl = document.getElementById('gacha-tab-limited');

const GACHA_RARITY_ORDER = { SSR: 0, SR: 1, R: 2, N: 3 };

function gachaPortraitHTML(charId, scale) {
    if (typeof GachaPortraits === 'undefined' || !charId) return '';
    try {
        const url = GachaPortraits.dataURL(charId, scale || 3);
        return url ? '<img class="gacha-card-img" src="' + url + '" alt="">' : '';
    } catch (e) { return ''; }
}

function currentGachaBanner() {
    if (gachaActiveBanner === 'limited') return GachaSystem.activeLimitedBanner();
    return GachaSystem.getBanner('standard');
}

// --- 角色庫(出擊角色)面板:裝備已獲得角色獲得屬性加成 ---
function renderCharLibrary() {
    const grid = document.getElementById('library-grid');
    if (!grid || typeof CharLoadoutSystem === 'undefined') return;
    const bar = document.getElementById('char-loadout-bar');
    const equippedId = CharLoadoutSystem.getEquippedId(charLoadoutState, gachaState.warehouse);
    if (bar) {
        const ch = equippedId && typeof CHAR_BY_ID !== 'undefined' ? CHAR_BY_ID[equippedId] : null;
        if (ch) {
            const b = CharLoadoutSystem.computeCharacterBonuses(ch.stats);
            bar.innerHTML = t('當前出擊角色') + '：<span class="char-loadout-name">' + t(ch.name) + '</span>（' + ch.rarity + '）'
                + '｜' + tf('生命 +{hp}', { hp: b.maxHpBonus })
                + '｜' + tf('傷害 +{d}%', { d: Math.round((b.damageMultiplier - 1) * 100) })
                + '｜' + tf('移速 +{s}%', { s: Math.round((b.speedMultiplier - 1) * 100) });
        } else {
            bar.textContent = t('尚未裝備出擊角色：從下方選擇一名已獲得的角色，即可依其屬性獲得生命／傷害／移速加成。');
        }
    }
    const list = gachaState.warehouse.slice().sort(function (a, b) {
        const ra = (GACHA_RARITY_ORDER[a.rarity] !== undefined) ? GACHA_RARITY_ORDER[a.rarity] : 9;
        const rb = (GACHA_RARITY_ORDER[b.rarity] !== undefined) ? GACHA_RARITY_ORDER[b.rarity] : 9;
        return ra - rb || (b.count || 1) - (a.count || 1);
    });
    const items = list.map(function (c) {
        const ch = (typeof CHAR_BY_ID !== 'undefined') ? CHAR_BY_ID[c.id] : null;
        const equipped = c.id === equippedId;
        const statsLine = ch ? tf('生命 {hp}｜攻擊 {atk}｜速度 {spd}', { hp: ch.stats.hp, atk: ch.stats.atk, spd: ch.stats.spd }) : '';
        const skillLine = (ch && ch.skill && ch.skill.name) ? t(ch.skill.name) : '';
        return '<div class="gacha-own-card library-card rarity-' + c.rarity + (equipped ? ' library-card-equipped' : '') + '" data-char-id="' + c.id + '">'
            + gachaPortraitHTML(c.id, 2)
            + '<div class="gacha-own-name">' + t(c.name) + '</div>'
            + '<div class="gacha-own-rarity">' + c.rarity + ((c.count || 1) > 1 ? ' ×' + c.count : '') + '</div>'
            + (statsLine ? '<div class="library-stats">' + statsLine + '</div>' : '')
            + (skillLine ? '<div class="library-skill">' + t('專屬技能') + '：' + skillLine + '</div>' : '')
            + '<button class="small-btn library-action-btn" data-equip-id="' + c.id + '">' + (equipped ? t('收回') : t('出擊')) + '</button>'
            + '</div>';
    }).join('');
    grid.innerHTML = items || '<span class="library-empty">' + t('尚無角色：擊殺 Boss 取得星輝後，到「角色抽卡」召喚角色') + '</span>';
}

function handleToggleEquipChar(id) {
    if (typeof CharLoadoutSystem === 'undefined') return;
    const equippedId = CharLoadoutSystem.getEquippedId(charLoadoutState, gachaState.warehouse);
    const r = (equippedId === id)
        ? CharLoadoutSystem.unequipCharacter(charLoadoutState)
        : CharLoadoutSystem.equipCharacter(charLoadoutState, gachaState.warehouse, id);
    if (!r.ok) return;
    saveCharLoadoutState();
    renderCharLibrary();
    applyEquippedUnits();
}

function switchLibraryTab(tab) {
    const grid = document.getElementById('library-grid');
    const unitList = document.getElementById('unit-list');
    const tabChars = document.getElementById('library-tab-chars');
    const tabUnits = document.getElementById('library-tab-units');
    const showChars = tab === 'chars';
    if (grid) grid.classList.toggle('hidden', !showChars);
    if (unitList) unitList.classList.toggle('hidden', showChars);
    if (tabChars) tabChars.classList.toggle('active', showChars);
    if (tabUnits) tabUnits.classList.toggle('active', !showChars);
    if (showChars) renderCharLibrary(); else renderUnitShop();
}

function renderGachaPanel() {
    if (!gachaModal || typeof GachaSystem === 'undefined') return;
    const cfg = GachaSystem.GACHA_CONFIG;
    if (gachaBalanceEl) gachaBalanceEl.textContent = String(GachaSystem.getBalance(gachaState));
    if (gachaTicketsEl) gachaTicketsEl.textContent = String(GachaSystem.getTickets(gachaState));
    if (gachaTabStandardEl) gachaTabStandardEl.classList.toggle('active', gachaActiveBanner === 'standard');
    if (gachaTabLimitedEl) gachaTabLimitedEl.classList.toggle('active', gachaActiveBanner === 'limited');
    // 卡池資訊:UP 角色 / 輪換倒數 / 保底進度
    if (gachaBannerInfoEl) {
        const banner = currentGachaBanner();
        const pityKey = (banner.kind === 'limited') ? 'limited' : 'standard';
        const pity = (gachaState.pity && gachaState.pity[pityKey]) || { ssrCount: 0, srCount: 0 };
        let html = '';
        if (banner.kind === 'limited' && banner.up) {
            const upChar = (typeof CHAR_BY_ID !== 'undefined') ? CHAR_BY_ID[banner.up] : null;
            const remainMs = GachaSystem.rotationRemainMs();
            const remainDays = Math.max(0, Math.floor(remainMs / 86400000));
            const remainHrs = Math.max(0, Math.floor((remainMs % 86400000) / 3600000));
            html += '<div class="gacha-up">' + tf('UP 角色：{name}（SSR 有 50% 機率為 UP，歪後下次必中）', { name: upChar ? t(upChar.name) : banner.up }) + '</div>';
            html += '<div class="gacha-rotate">' + tf('本池輪換剩餘約 {d} 天 {h} 小時', { d: remainDays, h: remainHrs }) + '</div>';
        }
        html += '<div class="gacha-pity">' + tf('距離 SSR 保底：{n} 抽（硬保底 {t} 抽）', { n: Math.max(0, banner.pitySSR - (pity.ssrCount || 0)), t: banner.pitySSR })
            + '｜' + tf('距離 SR 保底：{n} 抽', { n: Math.max(0, banner.pitySR - (pity.srCount || 0)) }) + '</div>';
        gachaBannerInfoEl.innerHTML = html;
    }
    // 按鈕文案與可用狀態(召喚券優先扣抵)
    const plan1 = GachaSystem.planCost(gachaState, 1);
    const plan10 = GachaSystem.planCost(gachaState, 10);
    if (gachaPullBtn) {
        gachaPullBtn.textContent = (plan1.ticketsUsed >= 1)
            ? t('單抽（召喚券 ×1）')
            : tf('單抽（{cost} 星輝）', { cost: cfg.costPerPull });
        gachaPullBtn.disabled = !plan1.affordable;
    }
    if (gachaPull10Btn) {
        gachaPull10Btn.textContent = (plan10.ticketsUsed >= 10)
            ? t('十連（召喚券 ×10）')
            : tf('十連（券 ×{tk} + {cost} 星輝）', { tk: plan10.ticketsUsed, cost: plan10.xinghuiCost });
        gachaPull10Btn.disabled = !plan10.affordable;
    }
}

function openGachaPanel() {
    if (!gachaModal || typeof GachaSystem === 'undefined') return;
    if (gachaResultEl) gachaResultEl.innerHTML = '';
    renderGachaPanel();
    gachaModal.classList.remove('hidden');
}

function selectGachaBanner(kind) {
    gachaActiveBanner = kind;
    if (gachaResultEl) gachaResultEl.innerHTML = '';
    renderGachaPanel();
}

function renderGachaResults(results) {
    if (!gachaResultEl) return;
    gachaResultEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'gacha-cards';
    let maxDelay = 0;
    results.forEach(function (r, i) {
        const card = document.createElement('div');
        const delay = Math.min(i * 110, 1210);
        card.className = 'gacha-card rarity-' + r.rarity + ((r.rarity === 'SSR') ? ' ssr-card' : '');
        card.dataset.charId = r.char.id;
        card.style.animationDelay = delay + 'ms';
        if (delay > maxDelay) maxDelay = delay;
        let badges = r.isNew
            ? '<div class="gacha-badge badge-new">' + t('NEW') + '</div>'
            : '<div class="gacha-badge badge-dupe">' + tf('重複 +{d} 星輝', { d: r.dust || 0 }) + '</div>';
        if (r.up) badges += '<div class="gacha-badge badge-up">' + t('UP！') + '</div>';
        card.innerHTML = gachaPortraitHTML(r.char.id, 3)
            + '<div class="gacha-card-name">' + t(r.char.name) + '</div>'
            + '<div class="gacha-card-rarity">' + r.rarity + '</div>' + badges;
        wrap.appendChild(card);
        if (r.rarity === 'SSR') setTimeout(function () { playSound('levelup'); }, delay + 240);
    });
    const newCount = results.filter(function (r) { return r.isNew; }).length;
    const dust = results.reduce(function (s, r) { return s + (r.dust || 0); }, 0);
    const summary = document.createElement('div');
    summary.className = 'gacha-summary';
    summary.style.animationDelay = (maxDelay + 430) + 'ms';
    summary.textContent = (dust > 0)
        ? tf('獲得 {new} 位新角色，重複角色轉化 +{dust} 星輝', { new: newCount, dust: dust })
        : tf('獲得 {new} 位新角色', { new: newCount });
    gachaResultEl.appendChild(wrap);
    gachaResultEl.appendChild(summary);
    if (results.some(function (r) { return r.rarity === 'SSR'; })) {
        const flash = document.createElement('div');
        flash.className = 'gacha-flash';
        gachaResultEl.appendChild(flash);
        setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 1000);
    }
}

function doGachaPull(bannerId, count) {
    if (typeof GachaSystem === 'undefined') return;
    const banner = bannerId || gachaActiveBanner;
    const n = (count === 10) ? 10 : 1;
    const result = GachaSystem.pullBanner(gachaState, banner, n);
    if (!result.ok) {
        if (result.error === 'insufficient') {
            if (n === 1) {
                alert(tf('星輝不足，無法抽卡！單抽需要 {cost} 顆，目前餘額 {balance} 顆。擊殺 Boss 可獲得星輝。', { cost: GachaSystem.GACHA_CONFIG.costPerPull, balance: result.balance }));
            } else {
                alert(tf('星輝不足！十連需 {cost} 顆星輝（召喚券 ×{tk} 抵扣後），目前餘額 {balance} 顆。擊殺 Boss 可獲得星輝。', { cost: result.needed, tk: result.ticketsUsed, balance: result.balance }));
            }
        } else {
            alert(t('抽卡失敗，請稍後再試。'));
        }
        return;
    }
    saveGachaState(); // 原子操作成功後持久化(餘額 + 券 + 倉庫 + 保底 + 日誌)
    playSound('levelup');
    renderGachaResults(result.results);
    renderGachaPanel();
}

if (gachaOpenBtn) gachaOpenBtn.addEventListener('click', openGachaPanel);
if (gachaCloseBtn) gachaCloseBtn.addEventListener('click', () => { if (gachaModal) gachaModal.classList.add('hidden'); });
if (gachaPullBtn) gachaPullBtn.addEventListener('click', () => doGachaPull(gachaActiveBanner, 1));
if (gachaPull10Btn) gachaPull10Btn.addEventListener('click', () => doGachaPull(gachaActiveBanner, 10));
if (gachaTabStandardEl) gachaTabStandardEl.addEventListener('click', () => selectGachaBanner('standard'));
if (gachaTabLimitedEl) gachaTabLimitedEl.addEventListener('click', () => selectGachaBanner('limited'));

// --- 角色詳情面板(放大立繪 / 屬性條 / 專屬技能 / 原創背景故事 / 招牌台詞) ---
const charDetailModal = document.getElementById('char-detail-modal');
const charDetailNameEl = document.getElementById('char-detail-name');
const charDetailPortraitEl = document.getElementById('char-detail-portrait');
const charDetailRarityEl = document.getElementById('char-detail-rarity');
const charDetailStatsEl = document.getElementById('char-detail-stats');
const charDetailSkillEl = document.getElementById('char-detail-skill');
const charDetailStoryEl = document.getElementById('char-detail-story');
const charDetailTaglineEl = document.getElementById('char-detail-tagline');
const charDetailCloseBtn = document.getElementById('char-detail-close-btn');

const CHAR_STAT_MAX = { hp: 100, atk: 20, def: 12, spd: 120 };
const CHAR_STAT_LABELS = { hp: '生命', atk: '攻擊', def: '防禦', spd: '速度' };

function openCharDetail(charId) {
    if (typeof CHAR_BY_ID === 'undefined' || !charDetailModal) return;
    const ch = CHAR_BY_ID[charId];
    if (!ch) return;
    if (charDetailNameEl) charDetailNameEl.textContent = t(ch.name);
    if (charDetailPortraitEl) charDetailPortraitEl.innerHTML = gachaPortraitHTML(ch.id, 5);
    if (charDetailRarityEl) {
        charDetailRarityEl.textContent = ch.rarity;
        charDetailRarityEl.className = 'char-detail-rarity rarity-' + ch.rarity;
    }
    if (charDetailStatsEl) {
        charDetailStatsEl.innerHTML = ['hp', 'atk', 'def', 'spd'].map(function (k) {
            const v = ch.stats[k] || 0, max = CHAR_STAT_MAX[k] || 100;
            const pct = Math.max(4, Math.min(100, Math.round(v / max * 100)));
            return '<div class="char-stat-row"><span class="char-stat-label">' + t(CHAR_STAT_LABELS[k]) + '</span>'
                + '<div class="char-stat-track"><div class="char-stat-fill" style="width:' + pct + '%"></div></div>'
                + '<span class="char-stat-value">' + v + '</span></div>';
        }).join('');
    }
    if (charDetailSkillEl) {
        charDetailSkillEl.innerHTML = '<div class="char-detail-section-title">' + t('專屬技能') + '：' + t(ch.skill.name) + '</div>'
            + '<div class="char-skill-desc">' + t(ch.skill.desc) + '</div>';
    }
    if (charDetailStoryEl) {
        charDetailStoryEl.innerHTML = '<div class="char-detail-section-title">' + t('原創背景故事') + '</div>'
            + '<p class="char-story-text">' + t(ch.story) + '</p>';
    }
    if (charDetailTaglineEl) charDetailTaglineEl.textContent = '『' + t(ch.tagline) + '』';
    charDetailModal.classList.remove('hidden');
}

if (charDetailCloseBtn) charDetailCloseBtn.addEventListener('click', () => { if (charDetailModal) charDetailModal.classList.add('hidden'); });
if (charDetailModal) charDetailModal.addEventListener('click', (e) => { if (e.target === charDetailModal) charDetailModal.classList.add('hidden'); });
const libraryGridEl = document.getElementById('library-grid');
if (libraryGridEl) libraryGridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.library-action-btn');
    if (btn && btn.dataset.equipId) { handleToggleEquipChar(btn.dataset.equipId); return; }
    const card = e.target.closest('.library-card');
    if (card && card.dataset.charId) openCharDetail(card.dataset.charId);
});
if (gachaResultEl) gachaResultEl.addEventListener('click', (e) => {
    const card = e.target.closest('.gacha-card');
    if (card && card.dataset.charId) openCharDetail(card.dataset.charId);
});

function applyEquippedUnits() {
    // 修復:改為冪等重算 — 同輸入恆同輸出,重複呼叫不會再累積 maxHp/multishot;player 未初始化時不崩潰
    if (typeof EquipmentSystem !== 'undefined') {
        const bonus = EquipmentSystem.computeBonuses(
            { funds: militaryFunds, owned: ownedUnits, equipped: equippedUnits },
            { maxHp: EquipmentSystem.BASE_MAXHP }
        );
        fundsGainMultiplier = bonus.fundsMultiplier;
        playerUpgrades.multishot.level = bonus.multishot; // init() 已重置為 0,此處絕對賦值保持冪等
        playerCharBonuses = currentCharBonuses(); // 出擊角色加成:絕對賦值保持冪等
        if (player) {
            player.maxHp = bonus.maxHp + playerCharBonuses.maxHpBonus;
            if (bonus.fullHeal) player.hp = player.maxHp;
            player.updateUI();
        }
        return;
    }
    playerCharBonuses = currentCharBonuses();
    fundsGainMultiplier = 1;
    if (equippedUnits.drone) playerUpgrades.multishot.level += 1;
    if (equippedUnits.medic && player) {
        player.maxHp += 50;
        player.hp = player.maxHp;
        player.updateUI();
    }
    if (equippedUnits.logistics) fundsGainMultiplier = 1.5;
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
        const statusText = owned ? (equipped ? t('已購買・裝備中') : t('已購買')) : tf('價格：{cost} 軍資', { cost: unit.cost.toLocaleString() });
        const actionLabel = owned ? (equipped ? t('卸下') : t('裝備')) : t('購買');
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
    if (typeof EquipmentSystem !== 'undefined') {
        const st = { funds: militaryFunds, owned: ownedUnits, equipped: equippedUnits };
        const r = EquipmentSystem.purchase(st, id);
        militaryFunds = st.funds;
        if (!r.ok) {
            if (r.error === 'insufficient_funds') alert(t('軍資不足，無法購買此單位。'));
            return; // already_owned / unknown_unit 靜默處理
        }
    } else {
        if (militaryFunds < unit.cost) {
            alert(t('軍資不足，無法購買此單位。'));
            return;
        }
        militaryFunds -= unit.cost;
        ownedUnits[id] = true;
        equippedUnits[id] = true;
    }
    saveMetaProgress();
    updateFundsUI();
    renderUnitShop();
}

function toggleEquipUnit(id) {
    if (!ownedUnits[id]) return;
    if (typeof EquipmentSystem !== 'undefined') {
        const st = { funds: militaryFunds, owned: ownedUnits, equipped: equippedUnits };
        const r = EquipmentSystem.toggleEquip(st, id);
        if (!r.ok) return;
    } else {
        equippedUnits[id] = !equippedUnits[id];
    }
    saveMetaProgress();
    renderUnitShop();
}

// Check for saved user on load
function checkSavedUser() {
    console.log(t('正在檢查儲存的登入狀態...'));
    try {
        const saved = lsGet('survivor_user');
        if (saved && saved !== 'null' && saved !== 'undefined') {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.username) {
                currentUser = parsed;
                console.log(t('已恢復登入狀態:'), currentUser.username);
                loadMetaProgress(); 
            } else {
                currentUser = null;
                loadMetaProgress();
            }
        } else {
            console.log(t('未發現儲存的登入狀態，以訪客身份執行。'));
            currentUser = null;
            loadMetaProgress(); 
        }
    } catch (e) {
        console.error(t('解析儲存的用戶資料失敗:'), e);
        lsDel('survivor_user');
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
    console.log(t('自動刷新排行榜...'));
    renderLeaderboard();
}, 3600000); 

(function setupMenuButtons() {
    const unitConfigBtn = document.getElementById('unit-config-btn');
    if (unitConfigBtn && unitModal) {
        unitConfigBtn.onclick = () => {
            unitModal.classList.remove('hidden');
            switchLibraryTab('chars');
            renderUnitShop();
        };
    }
    const libTabCharsBtn = document.getElementById('library-tab-chars');
    const libTabUnitsBtn = document.getElementById('library-tab-units');
    if (libTabCharsBtn) libTabCharsBtn.onclick = () => switchLibraryTab('chars');
    if (libTabUnitsBtn) libTabUnitsBtn.onclick = () => switchLibraryTab('units');
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
            const createModal = document.getElementById('create-room-modal');
            if (createModal) {
                const nameInput = document.getElementById('cr-room-name');
                const maxInput = document.getElementById('cr-max-players');
                const diffInput = document.getElementById('cr-difficulty');
                const modeRadios = document.querySelectorAll('input[name="cr-game-mode"]');
                if (nameInput) nameInput.value = t('戰區 ') + Math.floor(Math.random() * 100);
                if (maxInput) maxInput.value = 4;
                if (diffInput) diffInput.value = 1;
                if (modeRadios && modeRadios[0]) modeRadios[0].checked = true;
                createModal.classList.remove('hidden');
                return;
            }
            const roomName = prompt(t('請輸入房間名稱:'), t('戰區 ') + Math.floor(Math.random() * 100));
            if (!roomName) return;
            const modePrompt = prompt(t('選擇遊戲模式: 1=生存(♾️), 2=波次(🌊), 3=BOSS(👹)'), '1');
            const modeMap = { '1': 'survival', '2': 'wave', '3': 'boss' };
            const gameMode = modeMap[modePrompt || '1'] || 'survival';
            const maxPlayersInput = prompt(t('設定房間最大人數 (2 ~ 8):'), '4');
            const maxPlayers = Math.min(8, Math.max(2, parseInt(maxPlayersInput || '4', 10) || 4));
            const diffInput = prompt(t('設定房間難度倍率 (1 = 標準，建議 0.5 ~ 3):'), '1');
            const difficulty = Math.max(0.2, Math.min(5, parseFloat(diffInput || '1') || 1));
            multiplayer.joinRoom(roomName, true, maxPlayers, difficulty, gameMode);
        };
    }
    const crCancelBtn = document.getElementById('cr-cancel-btn');
    const crConfirmBtn = document.getElementById('cr-confirm-btn');
    if (crCancelBtn) {
        crCancelBtn.onclick = () => {
            const m = document.getElementById('create-room-modal');
            if (m) m.classList.add('hidden');
        };
    }
    if (crConfirmBtn) {
        crConfirmBtn.onclick = () => {
            const nameInput = document.getElementById('cr-room-name');
            const maxInput = document.getElementById('cr-max-players');
            const diffInput = document.getElementById('cr-difficulty');
            const modeRadios = document.querySelectorAll('input[name="cr-game-mode"]:checked');
            const roomName = nameInput ? (nameInput.value || '').trim() : '';
            if (!roomName) { alert(t('請輸入房間名稱')); return; }
            const gameMode = modeRadios && modeRadios[0] ? modeRadios[0].value : 'survival';
            const maxPlayers = Math.min(8, Math.max(2, parseInt(maxInput ? (maxInput.value || '4') : '4', 10) || 4));
            const difficulty = Math.max(0.2, Math.min(5, parseFloat(diffInput ? (diffInput.value || '1') : '1') || 1));
            const m = document.getElementById('create-room-modal');
            if (m) m.classList.add('hidden');
            multiplayer.joinRoom(roomName, true, maxPlayers, difficulty, gameMode);
        };
    }
    const mpResultReplayBtn = document.getElementById('mp-result-replay');
    const mpResultMenuBtn = document.getElementById('mp-result-menu');
    if (mpResultReplayBtn) {
        mpResultReplayBtn.onclick = () => {
            const resultScreen = document.getElementById('multiplayer-result-screen');
            if (resultScreen) resultScreen.classList.add('hidden');
            if (multiplayer.currentRoomId) {
                multiplayer.joinRoom(multiplayer.currentRoomId, false);
                startMultiplayer();
            } else {
                if (lobbyModal) lobbyModal.classList.remove('hidden');
            }
        };
    }
    if (mpResultMenuBtn) {
        mpResultMenuBtn.onclick = () => {
            const resultScreen = document.getElementById('multiplayer-result-screen');
            if (resultScreen) resultScreen.classList.add('hidden');
            showMainMenu();
        };
    }
    if (refreshLobbyBtn) {
        refreshLobbyBtn.onclick = () => multiplayer.requestRoomList();
    }
    if (multiplayerBtn && lobbyModal) {
        multiplayerBtn.onclick = () => {
            lobbyModal.classList.remove('hidden');
            multiplayer.connect();
        };
    }
    
    // Auth & Account Buttons
    if (logoutBtn) logoutBtn.onclick = handleLogout;
    if (deleteAccountBtn) deleteAccountBtn.onclick = handleAccountDeletion;
    if (adminClearDataBtn) adminClearDataBtn.onclick = handleAdminClearData;
    
    // 統一在這裡綁定登入 / 註冊 / 訪客按鈕
    if (btnGotoRegister) btnGotoRegister.onclick = () => showAuthView('register-step1');
    if (btnBacktoLogin) btnBacktoLogin.onclick = () => showAuthView('login');
    if (btnRegBack) btnRegBack.onclick = () => showAuthView('register-step1');
    if (btnCancelMigration) btnCancelMigration.onclick = () => {
        tempMigrationData = { username: '', password: '', userObj: null };
        showAuthView('login');
    };
    
    if (btnSubmitLogin) btnSubmitLogin.onclick = handleBtnSubmitLogin;
    if (btnRegNext) btnRegNext.onclick = handleBtnRegNext;
    if (btnRegSubmit) btnRegSubmit.onclick = handleBtnRegSubmit;
    if (btnSubmitMigration) btnSubmitMigration.onclick = handleBtnSubmitMigration;
    
    if (guestContinueBtn) {
        guestContinueBtn.onclick = (e) => {
            e.preventDefault();
            continueAsGuest();
        };
    }
    
    if (loginTriggerBtn) loginTriggerBtn.onclick = () => {
        loginModal.classList.remove('hidden');
        showAuthView('login'); // 每次開啟都回到登入視窗
        initGoogleLogin();
        initLoginDemo();
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
            if (confirm(t('確定要清空所有收集到的意見反饋嗎？此操作不可恢復。'))) {
                lsDel('survivor_feedbacks');
                renderAdminFeedbacks();
            }
        };
    }
    if (accountSettingsBtn) {
        accountSettingsBtn.onclick = () => {
            if (accountSettingsModal) accountSettingsModal.classList.remove('hidden');
            if (newUsernameInput && currentUser) newUsernameInput.value = currentUser.username || '';
            updateBindingUI();
        };
    }
    if (closeAccountSettingsBtn) {
        closeAccountSettingsBtn.onclick = () => {
            if (accountSettingsModal) accountSettingsModal.classList.add('hidden');
        };
    }
    if (accountRenameBtn) {
        accountRenameBtn.onclick = handleAccountRename;
    }
    if (replayTutorialBtn) {
        replayTutorialBtn.onclick = () => {
            if (!currentUser) {
                alert(t('請先登入帳號後再重新觀看新手教學。'));
                return;
            }
            resetTutorial();
        };
    }
    if (tutorialContinueBtn) {
        tutorialContinueBtn.onclick = () => {
            if (tutorialModal) tutorialModal.classList.add('hidden');
            tutorialGuide.start();
        };
    }
    if (closeTutorialBtn) {
        closeTutorialBtn.onclick = () => {
            if (tutorialModal) tutorialModal.classList.add('hidden');
            tutorialGuide.start();
        };
    }
    if (guideNextBtn) guideNextBtn.onclick = () => tutorialGuide.next();
    if (guideSkipBtn) guideSkipBtn.onclick = () => tutorialGuide.skip();
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
        this.roomId = null;
        this.gameMode = 'survival';
        this.wave = 0;
        this.totalKills = 0;
        
        this.players = new Map();
        this.enemies = [];
        this.bullets = [];
        this.xpOrbs = [];
        this.moneyDrops = [];
        this.healthPacks = [];
        this.airStrikes = [];
        
        this.active = false;
        this.alive = true;
        this.respawnAt = 0;
        
        this.lastInputSent = 0;
        this.localX = 0;
        this.localY = 0;
        
        this.score = 0;
        this.kills = 0;
        this.level = 1;
        this.upgrades = { multishot: 0, fireRate: 0, damage: 0, speed: 0, hp: 0 };
        
        this.airSupportReady = true;
        this.airSupportCooldownEnd = 0;
        this.airSupportTargeting = false;
        
        this.pendingLevelUp = null;
        this.isPaused = false;
        
        this.otherPlayersSmooth = new Map();
        this.gameEnded = false;
    }

    disconnect() {
        if (this.socket) {
            try {
                if (this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ type: 'leave_room' }));
                }
            } catch (e) {}
            this.socket.close();
            this.socket = null;
        }
        this.active = false;
        this.alive = true;
        this.players.clear();
        this.enemies = [];
        this.bullets = [];
        this.xpOrbs = [];
        this.moneyDrops = [];
        this.healthPacks = [];
        this.airStrikes = [];
        this.otherPlayersSmooth.clear();
        this.pendingLevelUp = null;
        this.gameEnded = false;
        this.score = 0;
        this.kills = 0;
        this.level = 1;
        this.upgrades = { multishot: 0, fireRate: 0, damage: 0, speed: 0, hp: 0 };
        
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        if (tacticalSkillOverlay) tacticalSkillOverlay.classList.add('hidden');
        if (airRaidWarning) airRaidWarning.classList.add('hidden');
    }

    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
        
        try {
            const qs = new URLSearchParams(location.search);
            const override = qs.get('ws');
            const target = override ? override : ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
            this.socket = new WebSocket(target);
            
            this.socket.onopen = () => {
                console.log('[Multiplayer v2.0] Connected to tactical server');
                this.onConnected();
            };

            this.socket.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            };

            this.socket.onclose = () => {
                this.active = false;
                console.log('[Multiplayer] Disconnected');
                if (gameRunning && !this.gameEnded) {
                    showNotification(t('⚠️ 與伺服器連線中斷'));
                }
            };

            this.socket.onerror = () => {
                alert(t('連線伺服器失敗！請確認多人伺服器是否已啟動。'));
                this.active = false;
            };
        } catch (e) {
            console.error('[Multiplayer] Connection error:', e);
        }
    }
    
    handleMessage(msg) {
        switch (msg.type) {
            case 'joined':
                this.playerId = msg.playerId;
                this.roomId = msg.roomId;
                this.gameMode = msg.gameMode || 'survival';
                this.wave = msg.wave || 0;
                this.active = true;
                this.gameEnded = false;
                this.alive = true;
                this.localX = 0;
                this.localY = 0;
                this.score = 0;
                this.kills = 0;
                this.level = 1;
                this.upgrades = { multishot: 0, fireRate: 0, damage: 0, speed: 0, hp: 0 };
                this.airSupportReady = true;
                this.airSupportCooldownEnd = 0;
                camera.x = this.localX - canvas.width / 2;
                camera.y = this.localY - canvas.height / 2;
                
                lobbyModal.classList.add('hidden');
                startMultiplayer();
                break;
                
            case 'state':
                this.updateState(msg);
                break;
                
            case 'level_up':
                this.handleLevelUp(msg);
                break;
                
            case 'upgrade_applied':
                this.upgrades[msg.upgradeType] = (this.upgrades[msg.upgradeType] || 0) + 1;
                playSound('levelup');
                break;
                
            case 'air_support_ready':
                this.airSupportReady = true;
                showNotification(t('✈️ 空中支援已就緒'));
                break;
                
            case 'airstrike_incoming':
                this.handleAirstrikeIncoming(msg);
                break;
                
            case 'airstrike_explode':
                this.handleAirstrikeExplode(msg);
                break;
                
            case 'player_death':
                this.handlePlayerDeath(msg);
                break;
                
            case 'player_respawn':
                this.handlePlayerRespawn(msg);
                break;
                
            case 'pickup':
                if (msg.item === 'xp') playSound('xp');
                else if (msg.item === 'health') playSound('hit');
                break;
                
            case 'notification':
                showNotification(msg.key ? tf(msg.key, msg.vars) : msg.message);
                break;
                
            case 'room_list':
                this.renderRoomList(msg.rooms);
                break;
                
            case 'game_end':
                this.handleGameEnd(msg);
                break;
                
            case 'game_over':
                endGame();
                break;
                
            case 'error':
                alert(t('⚠️ 錯誤: ') + (msg.key ? tf(msg.key, msg.vars) : msg.message));
                break;
        }
    }

    requestRoomList() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'get_rooms' }));
        }
    }

    onConnected() {
        this.requestRoomList();
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            if (!lobbyModal.classList.contains('hidden')) {
                this.requestRoomList();
            }
        }, 5000);
    }

    joinRoom(roomId, create = false, maxPlayers, difficulty, gameMode) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const units = equippedUnits || {};
            const payload = {
                type: 'join',
                roomId,
                create,
                name: currentUser ? currentUser.username : t('訪客'),
                units: units
            };
            if (create) {
                payload.maxPlayers = maxPlayers;
                payload.difficulty = difficulty;
                payload.gameMode = gameMode || 'survival';
            }
            this.socket.send(JSON.stringify(payload));
        }
    }

    renderRoomList(rooms) {
        if (!roomListContainer) return;
        roomListContainer.innerHTML = '';
        
        if (rooms.length === 0) {
            roomListContainer.innerHTML = '<div style="text-align:center; padding:30px; color:rgba(255,255,255,0.4);">' + t('目前沒有進行中的房間，點擊「建立新房間」開始！') + '</div>';
            return;
        }
        
        const modes = SharedConfig.MULTIPLAYER.GAME_MODES;
        
        rooms.forEach(room => {
            const isFull = room.playerCount >= room.maxPlayers;
            const modeCfg = modes[room.gameMode] || modes.survival;
            const item = document.createElement('div');
            item.className = 'room-item';
            
            let waveInfo = '';
            if (room.gameMode === 'wave' && room.wave > 0) {
                waveInfo = tf(' · 第{wave}波', { wave: room.wave });
            }
            
            item.innerHTML = `
                <div class="room-name">
                    <span style="font-size:16px;">${modeCfg.icon}</span>
                    <span style="margin-left:6px;">${room.id}</span>
                    <div style="font-size:10px; color:#888; margin-top:2px;">${modeCfg.name}${waveInfo}</div>
                </div>
                <div class="room-players">${room.playerCount} / ${room.maxPlayers}</div>
                <div class="room-status ${isFull ? 'status-full' : 'status-waiting'}">
                    ${isFull ? t('已滿') : t('等待中')}
                </div>
                <div class="room-action">
                    <button class="small-btn join-btn ${isFull ? '' : 'endless-btn'}" ${isFull ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                        ${isFull ? t('已滿') : t('加入')}
                    </button>
                </div>
            `;
            
            const joinBtn = item.querySelector('.join-btn');
            if (!isFull) {
                joinBtn.onclick = () => this.joinRoom(room.id);
            }
            roomListContainer.appendChild(item);
        });
    }

    updateState(state) {
        this.gameMode = state.gameMode || this.gameMode;
        this.wave = state.wave || 0;
        this.totalKills = state.totalKills || 0;
        
        const currentIds = new Set();
        let localPlayerData = null;
        
        state.players.forEach(p => {
            currentIds.add(p.id);
            
            if (p.id === this.playerId) {
                localPlayerData = p;
            } else {
                const smooth = this.otherPlayersSmooth.get(p.id) || { x: p.x, y: p.y };
                smooth.x += (p.x - smooth.x) * 0.2;
                smooth.y += (p.y - smooth.y) * 0.2;
                this.otherPlayersSmooth.set(p.id, smooth);
            }
            
            this.players.set(p.id, p);
        });
        
        for (let id of this.players.keys()) {
            if (!currentIds.has(id)) {
                this.players.delete(id);
                this.otherPlayersSmooth.delete(id);
                if (this.playerAnims) this.playerAnims.delete(id);
            }
        }
        
        if (localPlayerData) {
            const wasAlive = this.alive;
            this.alive = localPlayerData.alive;
            this.respawnAt = localPlayerData.respawnAt || 0;
            this.score = localPlayerData.score || 0;
            this.kills = localPlayerData.kills || 0;
            this.level = localPlayerData.level;
            this.airSupportReady = localPlayerData.airSupportReady;
            this.airSupportCooldownEnd = localPlayerData.airSupportCooldownEnd || 0;
            
            const currentHpText = hpDisplay ? hpDisplay.textContent : '100';
            const oldHp = parseFloat(currentHpText) || 100;
            if (localPlayerData.hp < oldHp - 1 && this.alive) playSound('hit');
            
            if (hpDisplay) hpDisplay.textContent = Math.ceil(Math.max(0, localPlayerData.hp));
            if (levelDisplay) levelDisplay.textContent = localPlayerData.level;
            if (scoreDisplay) scoreDisplay.textContent = this.score;
            if (xpBarFill) {
                const ratio = localPlayerData.xpToNextLevel > 0 ? (localPlayerData.xp / localPlayerData.xpToNextLevel) : 0;
                xpBarFill.style.width = `${Math.min(100, ratio * 100)}%`;
            }
            
            if (this.alive) {
                const dist = Math.hypot(this.localX - localPlayerData.x, this.localY - localPlayerData.y);
                if (dist > 150) {
                    this.localX = localPlayerData.x;
                    this.localY = localPlayerData.y;
                } else if (dist > 60) {
                    this.localX += (localPlayerData.x - this.localX) * 0.15;
                    this.localY += (localPlayerData.y - this.localY) * 0.15;
                }
            }
            
            this.updateAirSupportUI();
        }

        this.enemies = state.enemies || [];
        this.bullets = state.bullets || [];
        this.xpOrbs = state.xpOrbs || [];
        this.healthPacks = state.healthPacks || [];
        this.airStrikes = state.airStrikes || [];
    }
    
    updateAirSupportUI() {
        if (!airSupportFillNew || !skillStatusText) return;
        
        const now = Date.now();
        const cdTotal = SharedConfig.MULTIPLAYER.AIR_SUPPORT_COOLDOWN;
        
        if (this.airSupportReady) {
            airSupportFillNew.style.width = '100%';
            skillStatusText.textContent = 'READY';
            skillStatusText.classList.add('active');
        } else {
            const remaining = Math.max(0, this.airSupportCooldownEnd - now);
            const pct = Math.max(0, 100 - (remaining / cdTotal * 100));
            airSupportFillNew.style.width = `${pct}%`;
            skillStatusText.textContent = `${(remaining/1000).toFixed(1)}s`;
            skillStatusText.classList.remove('active');
        }
    }
    
    handleLevelUp(msg) {
        playSound('levelup');
        
        if (hpDisplay) hpDisplay.textContent = Math.ceil(msg.hp || 100);
        if (levelDisplay) levelDisplay.textContent = msg.level;
        
        this.showUpgradeModal(msg.options || ['multishot', 'fireRate', 'damage']);
    }
    
    showUpgradeModal(options) {
        if (!levelupModal || !upgradeOptionsContainer) return;
        
        isPaused = true;
        this.pendingLevelUp = options;
        
        const upCfg = SharedConfig.MULTIPLAYER.UPGRADES;
        upgradeOptionsContainer.innerHTML = '';
        
        options.forEach(optKey => {
            const cfg = upCfg[optKey];
            if (!cfg) return;
            const currentLvl = this.upgrades[optKey] || 0;
            
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.dataset.type = optKey;
            card.innerHTML = `
                <div class="upgrade-icon" style="color:${cfg.color}; border-color:${cfg.color};">
                    ${cfg.icon}
                </div>
                <div class="upgrade-name">${cfg.name}</div>
                <div class="upgrade-desc">${cfg.desc}</div>
                <div class="upgrade-status">
                    <div class="status-label">
                        <span>等級</span><span>Lv.${currentLvl}</span>
                    </div>
                    <div class="level-progress-bar">
                        <div class="progress-fill" style="background:${cfg.color};"></div>
                    </div>
                </div>
            `;
            card.onclick = () => this.selectUpgrade(optKey);
            upgradeOptionsContainer.appendChild(card);
        });
        
        levelupModal.classList.remove('hidden');
    }
    
    selectUpgrade(upgradeType) {
        if (!this.pendingLevelUp || !this.pendingLevelUp.includes(upgradeType)) return;
        
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'select_upgrade',
                upgradeType: upgradeType
            }));
        }
        
        this.pendingLevelUp = null;
        if (levelupModal) levelupModal.classList.add('hidden');
        isPaused = false;
    }
    
    requestAirSupport() {
        if (!this.active || !this.alive || !this.airSupportReady) return;
        
        if (controlMode === 'pc') {
            this.airSupportTargeting = true;
            showNotification(t('🎯 選擇空襲目標位置（點擊畫面）'));
        } else {
            this.sendAirSupport(this.localX, this.localY);
        }
    }
    
    sendAirSupport(x, y) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'use_air_support',
                x: x,
                y: y
            }));
            this.airSupportReady = false;
            this.airSupportTargeting = false;
            playSound('jet_flyover');
        }
    }
    
    handleAirstrikeIncoming(msg) {
        playSound('alarm');
        if (airRaidWarning) {
            airRaidWarning.classList.remove('hidden');
            const timerEl = warningTimerDisplay;
            if (timerEl) timerEl.textContent = '1.5';
            let t = 1500;
            const iv = setInterval(() => {
                t -= 100;
                if (timerEl) timerEl.textContent = (t/1000).toFixed(1);
                if (t <= 0) {
                    clearInterval(iv);
                    if (airRaidWarning) airRaidWarning.classList.add('hidden');
                }
            }, 100);
        }
        
        this.airStrikes.push({
            x: msg.x,
            y: msg.y,
            startTime: Date.now(),
            exploded: false,
            _incomingOwner: msg.ownerName
        });
    }
    
    handleAirstrikeExplode(msg) {
        playSound('explosion');
        if (gameSettings.screenShake) screenShake = 20;
        
        const x = msg.x - camera.x;
        const y = msg.y - camera.y;
        
        for (let i = 0; i < 30; i++) {
            particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 1,
                color: `hsl(${Math.random()*40 + 10}, 100%, 60%)`,
                size: Math.random() * 8 + 4
            });
        }
    }
    
    handlePlayerDeath(msg) {
        this.alive = false;
        this.respawnAt = msg.respawnAt;
        playSound('explosion');
        
        if (gameSettings.screenShake) screenShake = 30;
        
        const deathScreen = document.getElementById('multiplayer-death-screen');
        const respawnTimer = document.getElementById('respawn-timer');
        const deathScore = document.getElementById('death-score');
        const deathKills = document.getElementById('death-kills');
        const deathLevel = document.getElementById('death-level');
        
        if (deathScore) deathScore.textContent = msg.score || 0;
        if (deathKills) deathKills.textContent = msg.kills || 0;
        if (deathLevel) deathLevel.textContent = msg.level || 1;
        if (deathScreen) deathScreen.classList.remove('hidden');
        
        const updateTimer = () => {
            if (!this.active || this.alive) {
                if (deathScreen) deathScreen.classList.add('hidden');
                return;
            }
            const remaining = Math.max(0, this.respawnAt - Date.now());
            if (respawnTimer) respawnTimer.textContent = `${(remaining/1000).toFixed(1)}s`;
            if (remaining > 0 && !this.alive) {
                requestAnimationFrame(updateTimer);
            }
        };
        updateTimer();
    }
    
    handlePlayerRespawn(msg) {
        this.alive = true;
        this.localX = msg.x;
        this.localY = msg.y;
        this.respawnAt = 0;
        playSound('xp');
        showNotification(t('🔄 已重返戰場！'));
        
        const deathScreen = document.getElementById('multiplayer-death-screen');
        if (deathScreen) deathScreen.classList.add('hidden');
    }
    
    handleGameEnd(msg) {
        this.gameEnded = true;
        endMultiplayerGame(msg);
    }

    sendInput() {
        if (!this.active || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        if (!this.alive || isPaused) return;
        
        const baseSpeed = config.playerSpeed * playerCharBonuses.speedMultiplier * (1 + (this.upgrades.speed * 0.08));
        let dx, dy;
        
        if (controlMode === 'mobile') {
            dx = joystickVector.x;
            dy = joystickVector.y;
        } else {
            dx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
            dy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
        }
        
        if (dx !== 0 || dy !== 0) {
            const length = Math.hypot(dx, dy);
            const moveX = controlMode === 'mobile' ? dx : (dx / length);
            const moveY = controlMode === 'mobile' ? dy : (dy / length);
            this.localX += moveX * baseSpeed;
            this.localY += moveY * baseSpeed;
        }

        const now = Date.now();
        if (!this.lastSoundTime) this.lastSoundTime = 0;
        
        let targetAngle = Math.atan2(mouseY - canvas.height/2, mouseX - canvas.width/2);
        let hasEnemy = false;

        if (gameSettings.autoAim && this.enemies && this.enemies.length > 0) {
            let closestDist = Infinity;
            let closestEnemy = null;
            this.enemies.forEach(e => {
                const dist = Math.hypot(this.localX - e.x, this.localY - e.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestEnemy = e;
                }
            });
            if (closestEnemy && closestDist < 1000) {
                targetAngle = Math.atan2(closestEnemy.y - this.localY, closestEnemy.x - this.localX);
                hasEnemy = true;
            }
        } else if (this.enemies && this.enemies.length > 0) {
            let closestDist = Infinity;
            let closestEnemy = null;
            this.enemies.forEach(e => {
                const dist = Math.hypot(this.localX - e.x, this.localY - e.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestEnemy = e;
                }
            });
            if (closestEnemy && closestDist < 800) {
                hasEnemy = true;
            }
        }

        const isShooting = hasEnemy || mouseDown;
        const effFireRate = Math.max(50, config.fireRate * (1 - this.upgrades.fireRate * 0.08));

        if (isShooting && now - this.lastSoundTime > effFireRate) {
            playSound('shoot');
            this.lastSoundTime = now;
        }

        if (now - this.lastInputSent < 33) return;
        
        this.socket.send(JSON.stringify({
            type: 'input',
            dx, dy,
            shooting: isShooting,
            angle: targetAngle
        }));
        this.lastInputSent = now;
    }
    
    handleCanvasClick(cx, cy) {
        if (this.airSupportTargeting) {
            const wx = cx + camera.x;
            const wy = cy + camera.y;
            this.sendAirSupport(wx, wy);
            return true;
        }
        return false;
    }

    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();

        this.drawMultiplayerGrid(ctx);

        this.xpOrbs.forEach(orb => {
            const dx = orb.x - camera.x;
            const dy = orb.y - camera.y;
            const r = 6 + Math.sin(Date.now() / 200) * 1.5;
            
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath();
            ctx.arc(dx, dy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#00ffcc';
            ctx.shadowBlur = gameSettings.particleQuality === 'low' ? 10 : 20;
            ctx.shadowColor = '#00ffcc';
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
        
        this.airStrikes.forEach(strike => {
            const dx = strike.x - camera.x;
            const dy = strike.y - camera.y;
            const elapsed = Date.now() - strike.startTime;
            const progress = Math.min(1, elapsed / 1500);
            
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            
            if (progress < 1) {
                ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + Math.sin(elapsed/50)*0.3})`;
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.arc(dx, dy, 150, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.strokeStyle = `rgba(255, 100, 0, ${0.8})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(dx, dy - 200);
                ctx.lineTo(dx, dy + 200);
                ctx.moveTo(dx - 200, dy);
                ctx.lineTo(dx + 200, dy);
                ctx.stroke();
            } else {
                const expR = 30 + progress * 120;
                const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, expR);
                grad.addColorStop(0, 'rgba(255, 200, 100, 0.8)');
                grad.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
                grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(dx, dy, expR, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });

        this.enemies.forEach(e => {
            const dx = e.x - camera.x;
            const dy = e.y - camera.y;
            
            if (dx < -200 || dx > canvas.width + 200 || dy < -200 || dy > canvas.height + 200) return;
            
            const typeCfg = SharedConfig.SLIME_TYPES[e.type] || SharedConfig.SLIME_TYPES.normal;
            const color = typeCfg.color;
            const r = e.radius || 25;

            ctx.save();
            ctx.translate(dx, dy);
            
            if (e.isBoss) {
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
            ctx.fillStyle = color;
            if (gameSettings.particleQuality !== 'low') {
                ctx.shadowBlur = 10;
                ctx.shadowColor = color;
            }
            ctx.fill();

            ctx.fillStyle = e.isBoss ? '#ff0000' : '#000';
            ctx.beginPath();
            ctx.arc(-r/3, 0, r/6, 0, Math.PI * 2);
            ctx.arc(r/3, 0, r/6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (e.hp < e.maxHp) {
                ctx.fillStyle = '#222';
                ctx.fillRect(dx - r, dy - r - 15, r * 2, 6);
                ctx.fillStyle = e.isBoss ? '#ff00ff' : '#ff0000';
                ctx.fillRect(dx - r, dy - r - 15, (r * 2) * (e.hp / e.maxHp), 6);
            }
        });

        this.bullets.forEach(b => {
            const dx = b.x - camera.x;
            const dy = b.y - camera.y;
            if (dx < -50 || dx > canvas.width + 50 || dy < -50 || dy > canvas.height + 50) return;
            
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
        
        if (this.airSupportTargeting) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 100, 0, 0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 150, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(mouseX - 30, mouseY);
            ctx.lineTo(mouseX + 30, mouseY);
            ctx.moveTo(mouseX, mouseY - 30);
            ctx.lineTo(mouseX, mouseY + 30);
            ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        const drawnIds = new Set();
        // 每幀計算一次 dt,供角色精靈動畫共用
        const __nowMs = performance.now();
        this._spriteDt = Math.min(0.05, (__nowMs - (this._lastSpriteTs || __nowMs)) / 1000);
        this._lastSpriteTs = __nowMs;

        this.players.forEach(p => {
            drawnIds.add(p.id);
            
            let px, py;
            if (p.id === this.playerId) {
                px = this.alive ? this.localX : (p.x || 0);
                py = this.alive ? this.localY : (p.y || 0);
            } else {
                const smooth = this.otherPlayersSmooth.get(p.id);
                px = smooth ? smooth.x : p.x;
                py = smooth ? smooth.y : p.y;
            }
            
            this.drawSinglePlayer(ctx, p, px, py);
        });

        if (!drawnIds.has(this.playerId)) {
            this.drawSinglePlayer(ctx, {
                id: this.playerId,
                name: currentUser ? currentUser.username : t('連線中...'),
                hp: 100, maxHp: 100,
                alive: true
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
        const isLocal = p.id === this.playerId;
        const color = isLocal ? '#00ffff' : '#ff00ff';
        const isAlive = p.alive !== false;

        // 角色精靈(character.js):本地與遠端玩家共用像素動畫,每玩家獨立狀態機
        if (typeof CharacterAnim === 'function') {
            const dt = this._spriteDt || 0.016;
            if (!this.playerAnims) this.playerAnims = new Map();
            let st = this.playerAnims.get(p.id);
            if (!st) { st = { anim: new CharacterAnim(), lastX: px, lastY: py, wasAlive: isAlive }; this.playerAnims.set(p.id, st); }
            st.vx = px - st.lastX; st.vy = py - st.lastY;
            st.lastX = px; st.lastY = py;
            if (st.wasAlive !== isAlive) st.anim.reset(); // 死亡↔復活轉換時重置狀態機(解鎖死亡鎖定)
            st.wasAlive = isAlive;
            const moving = Math.abs(st.vx) + Math.abs(st.vy) > 0.5;
            st.anim.update(dt, moving, false, !isAlive);
            st.anim.dirIndex(st.vx, st.vy);
            ctx.save();
            if (!isAlive) ctx.globalAlpha = 0.3;
            ctx.shadowBlur = 18;
            ctx.shadowColor = color;
            st.anim.draw(ctx, px, py, camera, 1.25, moving);
            ctx.restore();
        } else {
            // fallback:character.js 未載入時沿用圓圈繪製
            ctx.save();

            if (!isAlive) {
                ctx.globalAlpha = 0.3;
            }

            ctx.shadowBlur = 25;
            ctx.shadowColor = color;

            ctx.beginPath();
            ctx.arc(dx, dy, 20, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(dx - 6, dy - 6, 7, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
            ctx.restore();
        }
        
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        
        let nameTag = p.name;
        if (isLocal) nameTag += t(' (你)');
        ctx.fillText(nameTag, dx, dy - 35);
        
        const barW = 50;
        const barH = 6;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(dx - barW/2, dy - 55, barW, barH);
        
        const hpRatio = Math.max(0, (p.hp || 0) / (p.maxHp || 100));
        ctx.fillStyle = isLocal ? '#00ff00' : '#ff00ff';
        ctx.fillRect(dx - barW/2, dy - 55, barW * hpRatio, barH);
        
        if (!isAlive && isLocal) {
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(t('💀 陣亡'), dx, dy - 70);
        }
        
        if (p.level && p.level > 1) {
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(`Lv.${p.level}`, dx, dy + 38);
        }
        ctx.restore();
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
        this.diamond = (typeof GachaSystem !== 'undefined') ? GachaSystem.getBalance(gachaState) : 0;  // 星輝餘額即時讀取
        this.lastShotTime = 0;
        // === 可互動角色系統:動畫狀態機 ===
        this.anim = new CharacterAnim();
        this.prevX = x;
        this.prevY = y;
        this.aimAngle = 0;
        this.lastHurtAt = 0;
    }

    draw() {
        // === 角色 sprite 動畫繪製(橘雪莉配色程序化 sprite sheet)===
        this.anim.draw(ctx, this.x, this.y, camera, 1, this.anim.state === 'run');
        // 保留原有光暈效果:在角色下方畫光環
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y + 14, this.radius + 2, 0, Math.PI * 2, false);
        ctx.fillStyle = 'rgba(68, 136, 255, 0.10)';
        ctx.shadowBlur = 14;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
        // 瞄準指示(槍口小圓點,依射擊方向)
        const gx = this.x - camera.x + Math.cos(this.aimAngle) * (this.radius + 8);
        const gy = this.y - camera.y + Math.sin(this.aimAngle) * (this.radius + 8);
        ctx.beginPath();
        ctx.arc(gx, gy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff';
        ctx.fill();
    }

    updateAnim(dt) {
        const vx = this.x - this.prevX;
        const vy = this.y - this.prevY;
        const moving = (vx !== 0 || vy !== 0);
        const hurt = (Date.now() - this.lastHurtAt < 300);
        this.anim.update(dt, moving, hurt, false);
        if (moving) this.anim.dirIndex(vx, vy);
        this.prevX = this.x;
        this.prevY = this.y;
    }

    update(dt) {
        // Movement（出擊角色移速加成:冪等套用）
        const moveSpeed = config.playerSpeed * playerCharBonuses.speedMultiplier;
        if (controlMode === 'mobile') {
            this.x += joystickVector.x * moveSpeed;
            this.y += joystickVector.y * moveSpeed;
        } else {
            if (keys.w) this.y -= moveSpeed;
            if (keys.s) this.y += moveSpeed;
            if (keys.a) this.x -= moveSpeed;
            if (keys.d) this.x += moveSpeed;
        }

        // Auto Fire
        const now = Date.now();
        if (now - this.lastShotTime > config.fireRate) {
            this.shoot();
            this.lastShotTime = now;
        }
        // 動畫狀態機更新(dt 以 60fps 幀間近似;animate() 無 dt 傳遞)
        this.updateAnim(1 / 60);
    }

    shoot() {
        // Find nearest enemy
        let nearestEnemy = null;
        let minDistance = Infinity;

        // 只有在自動瞄準開啟時才尋找最近敵人，否則向鼠標方向射擊
        if (gameSettings.autoAim || controlMode === 'mobile') {
            enemies.forEach(enemy => {
                const dist = getDistance(this.x, this.y, enemy.x, enemy.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestEnemy = enemy;
                }
            });
        }

        let angle;
        if (nearestEnemy) {
            angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
        } else if (controlMode === 'pc') {
            // PC 模式且關閉自動瞄準或沒敵人時，朝向鼠標
            angle = Math.atan2(mouseY + camera.y - this.y, mouseX + camera.x - this.x);
        } else {
            // 移動端若沒敵人則不射擊或朝向移動方向 (此處選擇不射擊)
            return;
        }

        playSound('shoot');
        this.aimAngle = angle;
        
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
        playRadioVoice(t('戰術建議：優先強化火力與機動，保持輸出與距離'));
        showLevelUpScreen();
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.lastHurtAt = Date.now();   // 觸發受擊動畫
        if (gameSettings.screenShake) {
            screenShake = 10; // Trigger screen shake
        }
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

function drawEnemyEntity(ctx, x, y, type, radius, hp, maxHp, isBoss, angle) {
    const drawX = x - camera.x;
    const drawY = y - camera.y;
    const r = radius;
    const time = Date.now() / 1000;
    const config = SharedConfig.SLIME_TYPES[type] || SharedConfig.SLIME_TYPES.normal;
    const color = config.color;

    ctx.save();
    ctx.translate(drawX, drawY);

    if (isBoss || type === 'boss') {
        // Boss Aura (Scales with HP)
        const auraAlpha = 0.2 + (1 - hp / maxHp) * 0.4;
        const auraSize = r + 20 + Math.sin(time * 5) * 15;
        const gradient = ctx.createRadialGradient(0, 0, r, 0, 0, auraSize);
        gradient.addColorStop(0, `rgba(255, 0, 255, ${auraAlpha})`);
        gradient.addColorStop(1, 'rgba(255, 0, 255, 0)');
        ctx.beginPath();
        ctx.arc(0, 0, auraSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    ctx.rotate(angle);

    // Walking animation (Legs)
    const walkCycle = (x + y) * 0.05; // Use position for consistent walk cycle across frames
    const legMovement = Math.sin(time * 10 + walkCycle) * (isBoss ? 20 : 15);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = isBoss ? 8 : 4;
    
    const legCount = (isBoss || type === 'boss') ? 8 : (type === 'tank' ? 6 : 4);
    for (let i = 0; i < legCount; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / legCount) * i);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.9, r * 0.9 + (i % 2 === 0 ? legMovement : -legMovement));
        ctx.stroke();
        ctx.restore();
    }

    // Main Body
    const bodyPulse = Math.sin(time * 5) * (isBoss ? 5 : 2);
    const rageScale = (isBoss || type === 'boss') ? (1 + (1 - hp / maxHp) * 0.3) : 1;
    ctx.scale(rageScale, rageScale);

    ctx.shadowBlur = isBoss ? 30 : 15;
    ctx.shadowColor = color;

    ctx.fillStyle = (isBoss || type === 'boss') ? '#111' : '#222';
    ctx.beginPath();
    if (type === 'normal') {
        ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
    } else if (type === 'fast') {
        ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.8, -r * 0.8); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r * 0.8, r * 0.8);
    } else if (type === 'tank') {
        for(let i=0; i<6; i++) {
            const a = (Math.PI * 2 / 6) * i;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
    } else if (isBoss || type === 'boss') {
        for(let i=0; i<8; i++) {
            const a = (Math.PI * 2 / 8) * i;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
    } else {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = isBoss ? 4 : 2;
    ctx.stroke();

    // Core
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3 + bodyPulse, 0, Math.PI * 2);
    ctx.fill();

    // Sensors
    ctx.fillStyle = '#fff';
    if (isBoss || type === 'boss') {
        ctx.beginPath();
        ctx.arc(r * 0.5, -r * 0.2, r * 0.1, 0, Math.PI * 2);
        ctx.arc(r * 0.5, r * 0.2, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.arc(r * 0.4, 0, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // HP Bar
    if (hp < maxHp) {
        const barW = r * 2;
        const barH = isBoss ? 15 : 6;
        const barY = -r - (isBoss ? 40 : 15);
        ctx.fillStyle = '#222';
        ctx.fillRect(drawX - r, drawY + barY, barW, barH);
        ctx.fillStyle = color;
        ctx.fillRect(drawX - r, drawY + barY, barW * (hp / maxHp), barH);
        if (isBoss) {
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(drawX - r, drawY + barY, barW, barH);
        }
    }
}

class Enemy {
    constructor(x, y, type = 'normal') {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Base stats
        let baseSpeed = Math.random() * 0.5 + 1.2;
        let baseHp = 50 + (player.level * 12);
        
        // Use config from shared_config
        const config = SharedConfig.SLIME_TYPES[type] || SharedConfig.SLIME_TYPES.normal;
        this.color = config.color;
        this.speed = baseSpeed * config.speedMult;
        this.hp = baseHp * config.hpMult;
        this.radius = config.radius;
        this.name = config.name;
        
        // Animation states
        this.walkCycle = Math.random() * Math.PI * 2;
        this.angle = 0;
    }

    draw() {
        drawEnemyEntity(ctx, this.x, this.y, this.type, this.radius, this.hp, this.maxHp, false, this.angle);
    }

    update() {
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }
}

class Boss extends Enemy {
    constructor(x, y) {
        super(x, y, 'boss');
        this.radius = 80;
        
        // Scaling Boss Power
        const bossLevel = Math.floor(totalKills / 100);
        const config = SharedConfig.SLIME_TYPES.boss;
        this.hp = 2000 + (player.level * 500) + (bossLevel * 1000);
        this.maxHp = this.hp;
        this.speed = config.speedMult + (bossLevel * 0.1);
        this.color = config.color; 
        this.isBoss = true;
        
        // Skill management
        this.skillTimer = Date.now();
        this.skillCooldown = 3000;
        this.currentState = 'normal';
        this.chargeTime = 0;
        this.jumpTarget = { x: 0, y: 0 };
    }

    draw() {
        drawEnemyEntity(ctx, this.x, this.y, 'boss', this.radius, this.hp, this.maxHp, true, this.angle);
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
                if (gameSettings.screenShake) {
                    screenShake += 10;
                }
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
        if (this.text.includes('-') && !gameSettings.showDamage) return;
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
            if (gameSettings.screenShake) {
                screenShake = 15;
            }
            
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
    fighterJets = [];
    bombs = [];
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
        if (gameSettings.musicEnabled) {
            setMusicDuck(false);
        } else {
            stopBackgroundMusic();
        }
        lastTime = performance.now();
        animate();
    }
}

function updateAirSupportUI() {
    const now = Date.now();
    const timeSinceLast = now - airSupportConfig.lastUsed;
    const progress = Math.min(timeSinceLast / airSupportConfig.cooldown, 1);
    
    if (airSupportFillNew) {
        airSupportFillNew.style.width = `${progress * 100}%`;
    }
    
    if (skillStatusText) {
        if (progress >= 1) {
            if (!skillStatusText.classList.contains('active')) {
                skillStatusText.classList.add('active');
                skillStatusText.textContent = 'READY';
                // 只有在剛好冷卻完的一瞬間播放提示音 (可選)
            }
        } else {
            skillStatusText.classList.remove('active');
            const remaining = Math.ceil((airSupportConfig.cooldown - timeSinceLast) / 1000);
            skillStatusText.textContent = `${remaining}S`;
        }
    }
}

function requestAirSupport() {
    const now = Date.now();
    if (now - airSupportConfig.lastUsed < airSupportConfig.cooldown) return;
    
    airSupportConfig.lastUsed = now;
    
    // 1. Voice Request
    playRadioVoice(t('請求空中火力打擊支援，座標已確認'));
    
    // 2. Start Alarm & Countdown UI
    let timeLeft = 5; // Reduced to 5 seconds
    airRaidWarning.classList.remove('hidden');
    warningTimerDisplay.textContent = timeLeft.toFixed(1);
    
    // Activate Targeting Mode
    targetingState.active = true;
    targetingState.locked = false;
    targetingState.mode = 'manual';
    targetingState.x = player.x;
    targetingState.y = player.y;
    createFloatingText(player.x, player.y - 100, "TACTICAL TARGETING ACTIVE", '#00ffff');
    
    const countdownInterval = setInterval(() => {
        if (!gameRunning) {
            clearInterval(countdownInterval);
            if (airRaidWarning) airRaidWarning.classList.add('hidden');
            targetingState.active = false;
            return;
        }
        if (isPaused) return;
        
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
        if (multiplayer.active) {
            multiplayer.requestAirSupport();
        } else {
            requestAirSupport();
        }
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
        target.closest('.info-btn') ||
        target.closest('.mode-option')
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
    // 不要在這裡設為 false，讓 showMainMenu 內部處理
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
        if (controlMode === 'pc') {
            // Map screen mouse pos to world pos
            targetingState.x = mouseX + camera.x;
            targetingState.y = mouseY + camera.y;
        }
        // 在移動端，x/y 會透過 touch 事件直接更新，所以這裡不需要覆蓋
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
    AIAdvisor.checkAndAdvise();

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
                const damage = Math.max(1, Math.round(config.projectileDamage * playerCharBonuses.damageMultiplier));
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
                    
                    // 星輝獎勵:擊殺 Boss 掉落 10 顆(同步更新玩家資料 + 掉落日誌)
                    if (enemy.isBoss && typeof GachaSystem !== 'undefined') {
                        const bossName = enemy.type || 'BOSS';
                        const reward = GachaSystem.grantBossReward(gachaState, bossName);
                        if (reward.ok) {
                            saveGachaState();
                            player.diamond = GachaSystem.getBalance(gachaState); // 戰局內即時同步
                            showNotification(tf('擊殺 {boss}，獲得 {count} 顆星輝！', { boss: bossName, count: reward.reward }));
                        }
                    }
                    
                    scoreDisplay.textContent = score;

                    // Spawn Boss every 100 kills
                    if (totalKills % 100 === 0 && totalKills > 0) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 600;
                        const bx = player.x + Math.cos(angle) * dist;
                        const by = player.y + Math.sin(angle) * dist;
                        enemies.push(new Boss(bx, by));
                        showNotification(t('🚨 強力生物特徵已偵測：大型 BOSS 進入戰場！ 🚨'));
                        playSound('alarm');
                    }

                    enemies.splice(i, 1);

                    // Boss Special Death Logic: Split into elite slimes
                    if (enemy.isBoss) {
                        playSound('explosion');
                        showNotification(t('⚠️ BOSS 核心崩解：偵測到多個高能反應！'));
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
            createFloatingText(drop.x, drop.y, tf('+{amount} 軍資', { amount: drop.amount }), '#ffff00');
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
    notificationText.textContent = t(message);
    gameNotification.classList.remove('hidden');
    gameNotification.classList.add('active');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        gameNotification.classList.remove('active');
        setTimeout(() => gameNotification.classList.add('hidden'), 500);
    }, 5000);
}

const AIAdvisor = {
    lastAdviceTime: 0,
    cooldown: 15000,
    
    checkAndAdvise: function() {
        const now = Date.now();
        if (now - this.lastAdviceTime < this.cooldown) return;

        let messages = [];

        if (player.hp < player.maxHp * 0.3) {
            messages.push(t('戰術分析：裝甲受損嚴重！建議暫避鋒芒，尋找周圍的維修包補給！'));
            messages.push(t('警告：生命值低下！立刻使用機動躲避，等待空襲冷卻！'));
        }

        let enemiesNear = 0;
        for (const e of enemies) {
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            if (dx*dx + dy*dy < 500 * 500) enemiesNear++;
        }
        
        if (enemiesNear > 25) {
            messages.push(t('戰場掃描：偵測到大量敵軍包圍！優先將砲火集中於突圍缺口！'));
            messages.push(t('戰術建議：敵方密度過高，請盡速施展戰術走位拉開距離！'));
            if (airSupportTimer <= 0) {
                 messages.push(t('系統提示：空襲支援已就緒，正是投彈清場的最佳時機！'));
            }
        }

        if (militaryFunds > 1500 && Object.keys(equippedUnits).length < 5) {
            messages.push(t('後勤提示：指揮官，您的軍費已十分充足，請隨時準備呼叫支援兵裝！'));
        }

        if (player.level >= 5 && player.level < 10 && !bossHintShown) {
             bossHintShown = true;
             messages.push(t('戰鬥預警：前線雷達發現未知強大能量源正在接近，請保持警戒！'));
             createFloatingText(player.x, player.y - 80, "BOSS INCOMING", "#ff4444");
        }
        
        if (messages.length === 0 && Math.random() > 0.8) {
            const generalTips = [
                t('戰場資訊：保持移動能有效降低受擊機率，尋找安全的輸出位置！'),
                t('裝備提示：適時搭配不同的武器部件，才能在蟲海中殺出重圍！'),
                t('系統建議：如果覺得吃力，可以回到大廳透過裝備庫強化基礎屬性。'),
                t('核心提示：留意戰場上隨機掉落的補給晶體，累積能量以獲得等級優勢！'),
                t('戰術建議：優先強化火力與機動，保持輸出與距離！')
            ];
            messages.push(generalTips[Math.floor(Math.random() * generalTips.length)]);
        }

        if (messages.length > 0) {
            const advice = messages[Math.floor(Math.random() * messages.length)];
            showNotification(advice);
            this.lastAdviceTime = now;
        }
    }
};

function startGame() {
    stopMenuBackground();
    init();
    gameRunning = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    if (tacticalSkillOverlay) tacticalSkillOverlay.classList.remove('hidden');
    if (controlMode === 'mobile') mobileControlsUI.classList.remove('hidden');
    startBackgroundMusic();
    animate();
    
    // Enemy Spawner
    if (window.enemyInterval) clearInterval(window.enemyInterval);
    window.enemyInterval = setInterval(spawnEnemy, config.enemySpawnRate);
}

function multiplayerCanvasClickHandler(e) {
    if (!multiplayer.active) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    multiplayer.handleCanvasClick(cx, cy);
}

function startMultiplayer() {
    stopMenuBackground();
    init();
    gameRunning = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    if (tacticalSkillOverlay) tacticalSkillOverlay.classList.remove('hidden');
    if (controlMode === 'mobile') mobileControlsUI.classList.remove('hidden');
    startBackgroundMusic();
    
    canvas.addEventListener('click', multiplayerCanvasClickHandler);
    
    // Connect to server (only if not already connected)
    if (!multiplayer.active) {
        multiplayer.connect();
    }
    
    function multiplayerAnimate() {
        if (!gameRunning) return;
        animationId = requestAnimationFrame(multiplayerAnimate);
        
        updateCamera();
        updateTargeting();
        
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        if (screenShake > 0) {
            const dx = (Math.random() - 0.5) * screenShake;
            const dy = (Math.random() - 0.5) * screenShake;
            ctx.translate(dx, dy);
            screenShake *= 0.9;
            if (screenShake < 0.1) screenShake = 0;
        }
        
        drawGrid();
        
        multiplayer.sendInput();
        
        multiplayer.draw(ctx);
        
        for (let i = explosions.length - 1; i >= 0; i--) {
            if (!explosions[i].update()) {
                explosions.splice(i, 1);
            } else {
                explosions[i].draw();
            }
        }
        
        for (let i = fighterJets.length - 1; i >= 0; i--) {
            if (!fighterJets[i].update()) {
                fighterJets.splice(i, 1);
            } else {
                fighterJets[i].draw();
            }
        }
        
        for (let i = bombs.length - 1; i >= 0; i--) {
            if (!bombs[i].update()) {
                bombs.splice(i, 1);
            } else {
                bombs[i].draw();
            }
        }
        
        for (let i = particles.length - 1; i >= 0; i--) {
            if (!particles[i].update()) {
                particles.splice(i, 1);
            } else {
                particles[i].draw();
            }
        }
        
        for (let i = shards.length - 1; i >= 0; i--) {
            if (!shards[i].update()) {
                shards.splice(i, 1);
            } else {
                shards[i].draw();
            }
        }
        
        ctx.restore();
        
        drawTargetingReticle();
        
        if (!multiplayer.active && multiplayer.socket && (multiplayer.socket.readyState === WebSocket.CLOSED || multiplayer.socket.readyState === WebSocket.CLOSING)) {
            showMainMenu();
        }
    }
    multiplayerAnimate();
}

function endMultiplayerGame(msg) {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(window.enemyInterval);
    if (tacticalSkillOverlay) tacticalSkillOverlay.classList.add('hidden');
    if (airRaidWarning) airRaidWarning.classList.add('hidden');
    mobileControlsUI.classList.add('hidden');
    canvas.removeEventListener('click', multiplayerCanvasClickHandler);
    
    const results = (msg.results || []).slice().sort((a, b) => b.score - a.score);
    const localResult = results.find(r => r.id === multiplayer.playerId);
    const finalScore = localResult ? localResult.score : 0;
    
    recordScoreToLeaderboard(finalScore);
    
    let logisticsMult = 1;
    if (localResult && localResult.units && localResult.units.logistics) {
        logisticsMult = 1.2;
    }
    const gainedFunds = Math.floor(finalScore * fundsGainMultiplier * logisticsMult);
    if (gainedFunds > 0) {
        militaryFunds += gainedFunds;
        saveMetaProgress();
        updateFundsUI();
    }
    
    const resultScreen = document.getElementById('multiplayer-result-screen');
    if (resultScreen) {
        const listEl = document.getElementById('multiplayer-result-list');
        const scoreEl = document.getElementById('multiplayer-result-score');
        const fundsEl = document.getElementById('multiplayer-result-funds');
        if (listEl) {
            listEl.innerHTML = '';
            results.forEach((r, idx) => {
                const rank = idx + 1;
                const isSelf = r.id === multiplayer.playerId;
                const row = document.createElement('div');
                row.className = 'result-row' + (isSelf ? ' result-self' : '');
                row.innerHTML = `
                    <div class="result-rank">${rank}</div>
                    <div class="result-name">${r.name || t('指揮官')}${isSelf ? t(' (你)') : ''}</div>
                    <div class="result-score">${r.score || 0}</div>
                    <div class="result-kills">${r.kills || 0} 擊殺</div>
                    <div class="result-level">Lv.${r.level || 1}</div>
                `;
                listEl.appendChild(row);
            });
        }
        if (scoreEl) scoreEl.textContent = finalScore;
        if (fundsEl) fundsEl.textContent = gainedFunds;
        resultScreen.classList.remove('hidden');
    }
    
    stopBackgroundMusic();
    startMenuMusic();
}

function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(window.enemyInterval);
    if (tacticalSkillOverlay) tacticalSkillOverlay.classList.add('hidden');
    if (airRaidWarning) airRaidWarning.classList.add('hidden');
    mobileControlsUI.classList.add('hidden');
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
            console.log(t('主動返回選單：儲存分數'), score);
            recordScoreToLeaderboard(score);
            const gainedFunds = Math.floor(score * fundsGainMultiplier);
            if (gainedFunds > 0) {
                militaryFunds += gainedFunds;
                saveMetaProgress();
                updateFundsUI();
            }
        }
    }

    gameRunning = false;
    // 多人模式退出處理
    if (multiplayer && multiplayer.active) {
        multiplayer.disconnect();
    }
    
    cancelAnimationFrame(animationId);
    clearInterval(window.enemyInterval);
    if (tacticalSkillOverlay) tacticalSkillOverlay.classList.add('hidden');
    if (airRaidWarning) airRaidWarning.classList.add('hidden');
    mobileControlsUI.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    
    // 確保 UI 更新 (最高紀錄等)
    updateUserUI();
    renderLeaderboard();
    
    // Reset background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (unitModal) {
        unitModal.classList.add('hidden');
    }
    startMenuBackground();
    stopBackgroundMusic();
    startMenuMusic();
}

// 實作頁面重新整理前的自動儲存機制
window.addEventListener('beforeunload', () => {
    if (gameRunning && score > 0) {
        console.log(t('頁面重新整理：緊急儲存分數'), score);
        recordScoreToLeaderboard(score);
        const gainedFunds = Math.floor(score * fundsGainMultiplier);
        if (gainedFunds > 0) {
            militaryFunds += gainedFunds;
            saveMetaProgress();
        }
    }
});


function ensureMenuMusicNode() {
    if (!menuAudio) {
        menuAudio = new Audio(encodeURI(menuPlaylist[currentMenuTrackIndex]));
        menuAudio.crossOrigin = 'anonymous';
        menuAudio.preload = 'auto';
        menuAudio.volume = 1.0;
        menuAudio.onended = () => {
            currentMenuTrackIndex = (currentMenuTrackIndex + 1) % menuPlaylist.length;
            menuAudio.src = encodeURI(menuPlaylist[currentMenuTrackIndex]);
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
        gameAudio = new Audio(encodeURI(gamePlaylist[currentTrackIndex]));
        gameAudio.crossOrigin = 'anonymous';
        gameAudio.preload = 'auto';
        gameAudio.volume = 1.0;
        gameAudio.onended = () => {
            currentTrackIndex = (currentTrackIndex + 1) % gamePlaylist.length;
            gameAudio.src = encodeURI(gamePlaylist[currentTrackIndex]);
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
        menuGainNode.gain.linearRampToValueAtTime(0.6, now + 1.5);
    }
    
    (menuAudio.play ? menuAudio.play() : Promise.resolve()).then(() => {
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
        gameGainNode.gain.linearRampToValueAtTime(0.6, now + 1.5);
    }
    gameAudio.currentTime = 0;
    (gameAudio.play ? gameAudio.play() : Promise.resolve()).catch((e) => {
        console.error("Game music play error:", e);
    });
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

resizeCanvas();
startMenuBackground();
if (musicEnabled) {
    startMenuMusic();
}
