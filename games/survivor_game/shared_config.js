/**
 * Survivor Game - 戰術指令集 (共享邏輯) v2.0
 * 支援 Browser 與 Node.js 環境
 * 多人模式重新製作：協作機制、三種遊戲模式、完整升級鏈
 */

const SharedConfig = {
    // 1. 基礎遊戲頻率
    FPS: 60,
    TICK_MS: 16,

    // 2. 指揮官基礎屬性
    PLAYER: {
        BASE_SPEED: 6,
        BASE_HP: 100,
        FIRE_RATE: 150,
        BULLET_SPEED: 9,
        BULLET_DAMAGE: 25
    },

    // 3. 戰鬥機械種類
    SLIME_TYPES: {
        normal: { color: '#8899aa', speedMult: 1, hpMult: 1, radius: 25, xp: 20, name: '偵察型多足機', behavior: 'swarm' },
        fast:   { color: '#55aaff', speedMult: 1.8, hpMult: 0.6, radius: 20, xp: 30, name: '突擊型劍足機', behavior: 'dash' },
        tank:   { color: '#ff5544', speedMult: 0.6, hpMult: 3.5, radius: 35, xp: 50, name: '重裝型砲擊機', behavior: 'heavy' },
        elite:  { color: '#aa88ff', speedMult: 1.2, hpMult: 2.0, radius: 30, xp: 100, name: '指揮型作戰機', behavior: 'balanced' },
        gold:   { color: '#ffff44', speedMult: 2.5, hpMult: 0.4, radius: 18, xp: 500, name: '高能補給機', behavior: 'flee' },
        boss:   { color: '#ff00ff', speedMult: 1.2, hpMult: 50, radius: 80, xp: 2000, name: '要塞級：戰術重型機甲', behavior: 'boss' }
    },

    // 4. 戰術邏輯
    BOSS_SPAWN_INTERVAL: 100,
    HEALTH_PACK_HEAL: 30,
    LEVEL_UP_HEAL: 20,

    // 5. 多人模式配置 (NEW in v2.0)
    MULTIPLAYER: {
        // 伺服器限制
        MAX_PLAYERS_PER_ROOM: 8,
        MAX_SERVER_PLAYERS: 20,

        // 復活機制
        RESPAWN_TIME_MS: 10000,
        RESPAWN_INVINCIBLE_MS: 2000,

        // 協作獎勵
        XP_BONUS_PER_PLAYER: 0.1,
        SCORE_BONUS_PER_PLAYER: 0.05,

        // 空中支援
        AIR_SUPPORT_COOLDOWN: 15000,
        AIR_SUPPORT_DAMAGE: 200,
        AIR_SUPPORT_RADIUS: 150,
        AIR_SUPPORT_DELAY: 1500,

        // 升級系統
        UPGRADES: {
            multishot: {
                name: '火力網擴張',
                desc: '同步發射更多彈藥，每級 +1 發',
                icon: '🎯',
                color: '#2266ff'
            },
            fireRate: {
                name: '射控優化',
                desc: '降低射擊冷卻時間，每級 -8%',
                icon: '⚡',
                color: '#ffcc00'
            },
            damage: {
                name: '高能彈頭',
                desc: '強化子彈威力，每級 +15%',
                icon: '📈',
                color: '#ff4444'
            },
            speed: {
                name: '推進強化',
                desc: '提升戰術移動速度，每級 +8%',
                icon: '💨',
                color: '#44ff44'
            },
            hp: {
                name: '修復奈米',
                desc: '提升最大生命值並自動回血，每級 +15% HP',
                icon: '🛡️',
                color: '#00ff88'
            }
        },

        // 遊戲模式
        GAME_MODES: {
            survival: {
                name: '生存模式',
                desc: '無盡的敵人浪潮，堅持越久分數越高',
                icon: '♾️',
                difficultyStart: 1,
                difficultyGrowth: 0.01
            },
            wave: {
                name: '波次模式',
                desc: '逐步推進的波次挑戰，每波完成給予獎勵',
                icon: '🌊',
                difficultyStart: 1,
                difficultyGrowth: 0.02,
                waveCompleteBonus: 100
            },
            boss: {
                name: 'BOSS 挑戰',
                desc: '與要塞級機甲對決，考驗團隊配合',
                icon: '👹',
                difficultyStart: 2,
                difficultyGrowth: 0.005
            }
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedConfig;
}
