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

    // 3. 史萊姆生物種類
    SLIME_TYPES: {
        normal: { color: '#44ff44', speedMult: 1, hpMult: 1, radius: 15, xp: 20 },
        fast:   { color: '#4488ff', speedMult: 1.8, hpMult: 0.6, radius: 12, xp: 30 },
        tank:   { color: '#ff4444', speedMult: 0.6, hpMult: 2.5, radius: 22, xp: 50 },
        elite:  { color: '#aa44ff', speedMult: 1.2, hpMult: 1.8, radius: 20, xp: 100 },
        gold:   { color: '#ffff44', speedMult: 2.5, hpMult: 0.4, radius: 10, xp: 500 },
        boss:   { color: '#ff00ff', speedMult: 1.2, hpMult: 40, radius: 60, xp: 2000 }
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