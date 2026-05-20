/**
 * Survivor Game - 戰術指令集 (共享邏輯)
 * 支援 Browser 與 Node.js 環境
 */

const SharedConfig = {
    // 1. 基礎遊戲頻率
    FPS: 60,
    TICK_MS: 16,

    // 2. 指揮官基礎屬性
    PLAYER: {
        BASE_SPEED: 6,
        BASE_HP: 100,
        FIRE_RATE: 150, // ms
        BULLET_SPEED: 9,
        BULLET_DAMAGE: 25
    },

    // 3. 戰鬥機械種類 (替代原本的史萊姆)
    SLIME_TYPES: {
        normal: { color: '#8899aa', speedMult: 1, hpMult: 1, radius: 25, xp: 20, name: '偵察型多足機', behavior: 'swarm' },
        fast:   { color: '#55aaff', speedMult: 1.8, hpMult: 0.6, radius: 20, xp: 30, name: '突擊型劍足機', behavior: 'dash' },
        tank:   { color: '#ff5544', speedMult: 0.6, hpMult: 3.5, radius: 35, xp: 50, name: '重裝型砲擊機', behavior: 'heavy' },
        elite:  { color: '#aa88ff', speedMult: 1.2, hpMult: 2.0, radius: 30, xp: 100, name: '指揮型作戰機', behavior: 'balanced' },
        gold:   { color: '#ffff44', speedMult: 2.5, hpMult: 0.4, radius: 18, xp: 500, name: '高能補給機', behavior: 'flee' },
        boss:   { color: '#ff00ff', speedMult: 1.2, hpMult: 50, radius: 80, xp: 2000, name: '要塞級：戰術重型機甲', behavior: 'boss' }
    },

    // 4. 戰術邏輯
    BOSS_SPAWN_INTERVAL: 100, // 每 100 擊殺
    HEALTH_PACK_HEAL: 30,
    LEVEL_UP_HEAL: 20
};

// 讓 Node.js 也能讀取
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedConfig;
}