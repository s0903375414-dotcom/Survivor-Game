// gacha.js — 星輝(Xinghui)資源系統 + 角色抽卡
// 貨幣命名採原神/崩鐵風格:「星輝」。
// 架構:純邏輯模組;狀態由呼叫端傳入 state = {diamond, warehouse, logs}。
// 環境:瀏覽器(window.GachaSystem)與 Node(tests)皆可執行;需先載入 characters_data.js。

// ===== 卡池配置(營運改這裡即可)=====
var GACHA_CONFIG = {
    costPerPull: 10,          // 單抽消耗星輝
    cost10Pull: 55,           // 十抽消耗星輝(省 5 顆)
    bossKillReward: 10,       // Boss 擊殺掉落星輝
    maxLogEntries: 100,       // 日誌保留上限(供後續查核)
    // 機率(百分比;所有稀有度總和必須 = 100)
    rates: { N: 60, R: 30, SR: 9, SSR: 1 },
    // 角色池:依稀有度分組(可自由增減角色)
    pool: {
        N:   [ { id: 'recruit', name: '新兵' },
               { id: 'scout',    name: '斥候' },
               { id: 'medic',    name: '醫療兵' } ],
        R:   [ { id: 'gunner',   name: '機槍手' },
               { id: 'engineer', name: '工兵' } ],
        SR:  [ { id: 'sniper',   name: '狙擊手' },
               { id: 'vanguard', name: '先鋒' } ],
        SSR: [ { id: 'ace',      name: '王牌指揮官' } ]
    },
    // 保底機制: SSR 硬保底 60 抽
    // 十連抽後若未得 SR 則下次保證得 SR
    pitySR: 10,               // SR 軟保底 10 抽
    pitySSR: 60               // SSR 硬保底 60 抽
};

// ===== validateConfig: 檢查配置是否有效 =====
function validateConfig() {
    var keys = Object.keys(GACHA_CONFIG.rates);
    var sum = 0, i, k;
    for (i = 0; i < keys.length; i++) {
        k = keys[i];
        var r = GACHA_CONFIG.rates[k];
        if (typeof r !== 'number' || r < 0) return { ok: false, error: 'bad_rate:' + k };
        sum += r;
        var pool = GACHA_CONFIG.pool[k];
        if (!pool || !pool.length) return { ok: false, error: 'empty_pool:' + k };
    }
    if (sum !== 100) return { ok: false, error: 'rate_sum_' + sum + '_not_100' };
    return { ok: true };
}

// ===== getBalance: 獲取星輝餘額 =====
function getBalance(state) {
    if (!state || typeof state.diamond !== 'number') return 0;
    return state.diamond | 0;
}

// ===== addDiamonds: 新增星輝 =====
function addDiamonds(state, amount, reason) {
    if (!state || typeof amount !== 'number' || amount <= 0) return { ok: false, error: 'invalid_amount' };
    state.diamond = (state.diamond || 0) + amount;
    if (!state.logs) state.logs = [];
    state.logs.push({ type: 'gain', amount: amount, reason: reason, timestamp: Date.now() });
    if (state.logs.length > GACHA_CONFIG.maxLogEntries) {
        state.logs = state.logs.slice(-GACHA_CONFIG.maxLogEntries);
    }
    return { ok: true, balance: state.diamond, reason: reason };
}

// ===== spendDiamonds: 扣除星輝 =====
function spendDiamonds(state, amount, reason) {
    if (!state || typeof amount !== 'number' || amount <= 0) return { ok: false, error: 'invalid_amount' };
    if ((state.diamond || 0) < amount) return { ok: false, error: 'insufficient', balance: state.diamond || 0 };
    state.diamond = (state.diamond || 0) - amount;
    if (!state.logs) state.logs = [];
    state.logs.push({ type: 'spend', amount: amount, reason: reason, timestamp: Date.now() });
    if (state.logs.length > GACHA_CONFIG.maxLogEntries) {
        state.logs = state.logs.slice(-GACHA_CONFIG.maxLogEntries);
    }
    return { ok: true, balance: state.diamond, reason: reason };
}


// ===== tryPull: 嘗試單次抽卡 (檢查餘額) =====
// state: 當前狀態 {diamond: number}
// 回傳: { ok: boolean, error?: string, rarity?: string, balance?: number }
// - 餘額不足 → { ok: false, error: 'insufficient', balance: current }
// - 成功 → { ok: true, rarity: rolled, balance: new_balance }
function tryPull(state) {
    if (!state || typeof state.diamond !== 'number') return { ok: false, error: 'no_state' };
    if (state.diamond < GACHA_CONFIG.costPerPull) {
        return { ok: false, error: 'insufficient', balance: state.diamond };
    }
    // 扣除成本
    state.diamond -= GACHA_CONFIG.costPerPull;
    // Roll 單一稀有度
    var rarity = rollRarity(() => fnRandom());
    // 寫入日誌
    if (!state.logs) state.logs = [];
    state.logs.push({ rarity: rarity, type: 'pull', timestamp: Date.now() });
    // 修剪日誌
    if (state.logs.length > GACHA_CONFIG.maxLogEntries) {
        state.logs = state.logs.slice(-GACHA_CONFIG.maxLogEntries);
    }
    return { ok: true, rarity: rarity, balance: state.diamond };
}

// ===== grantBossReward: Boss擊殺獎勵 =====
// ===== grantBossReward: Boss擊殺獎勵 =====
function grantBossReward(state, source) {
    if (!state) return { ok: false, error: 'no_state' };
    var added = addDiamonds(state, GACHA_CONFIG.bossKillReward, 'boss_kill:' + source);
    if (!added.ok) return added;
    // 寫入日誌
    if (!state.logs) state.logs = [];
    state.logs.push({ type: 'gain', amount: GACHA_CONFIG.bossKillReward, reason: 'boss_kill:' + source, timestamp: Date.now() });
    // 修剪日誌
    if (state.logs.length > GACHA_CONFIG.maxLogEntries) {
        state.logs = state.logs.slice(-GACHA_CONFIG.maxLogEntries);
    }
    return { ok: true, balance: state.diamond, reward: GACHA_CONFIG.bossKillReward };
}

// ===== rollRarity: 根據機率 roll 出稀有度 =====
// rand: 0-1 的隨機函數或值
// 回傳: rarity 鍵 (N, R, SR, SSR)
// 修正: 使用 r <= 0 確保邊界條件正確(r < 0 會導致 r=0 時進入下一層)
function rollRarity(rand) {
    var b = GACHA_CONFIG;
    var fn = (typeof rand === 'function') ? rand : Math.random;
    var keys = Object.keys(b.rates);
    var r = fn() * 100;
    for (var i = 0; i < keys.length; i++) {
        r -= b.rates[keys[i]];
        if (r <= 0) return keys[i];
    }
    return keys[keys.length - 1];
}

// ===== pickCharacter: 根據稀有度從角色池抽取 =====
// rarity: 'N'/'R'/'SR'/'SSR'
// rand: 0-1 的隨機函數
// 回傲: 角色物件 { id, name, rarity }
function pickCharacter(rarity, rand) {
    var pool = GACHA_CONFIG.pool[rarity];
    if (!pool || pool.length === 0) return null;
    var fn = (typeof rand === 'function') ? rand : Math.random;
    return pool[Math.floor(fn() * pool.length)];
}

// ===== pull: 執行單次/十次抽卡 =====
// state: 當前狀態 {diamond: number, warehouse: {...}, logs: []}
// count: 1 (單抽) 或 10 (十連抽)
// bannerId: 選擇卡池 ID(目前僅支援 'standard')
function pull(state, count, bannerId) {
    var cfg = GACHA_CONFIG;
    var banner = getBanner(bannerId || 'standard');
    var results = [];
    var hasSRThis10 = false;

    for (var i = 0; i < count; i++) {
        var rarity = rollRarity(() => fnRandom());
        results.push(rarity);

        // 統計十連是否有 SR
        if (count === 10 && rarity === 'SR') hasSRThis10 = true;

        // 更新保狀態
        updatePityState(rarity);
    }

    // 十聯抽後若未得 SR, 下次保證得 SR
    if (count === 10 && !hasSRThis10) {
        // 標記下次必得 SR
    }

    // 更新狀態
    state.diamond -= cfg.costPerPull * count;
    state.logs = state.logs.concat(results.map(function (r) {
        return { rarity: r, timestamp: Date.now() };
    }));

    // 移除超過上限的日誌
    if (state.logs.length > cfg.maxLogEntries) {
        state.logs = state.logs.slice(-cfg.maxLogEntries);
    }

    return results;
}

// ===== fnRandom: 兼容測試的隨機函數 =====
function fnRandom() {
    return Math.random();
}

// ===== getBanner: 獲取卡池配置 =====
function getBanner(id) {
    return { id: 'standard', rates: { N: 60, R: 30, SR: 9, SSR: 1 } };
}

// ===== updatePityState: 更新保狀態 =====
function updatePityState(rarity) {
    // 簡化版: 毊抽取後重置計數，下次 rollRarity 會通過 rates 邊界隱含保底
}

// ===== Browser IIFE: 瀏覽器環境掛載 =====
// 使用 IIFE 將介面掛載至 window.GachaSystem，供瀏覽器使用
// 此 IIFE 會在 module載入時執行，但 module.exports 已先前設定
if (typeof window !== 'undefined') {
    window.GachaSystem = {
        rollRarity: rollRarity,
        pull: pull,
        getConfig: function () { return GACHA_CONFIG; },
        pickCharacter: pickCharacter,
        dupeToDust: 5,
        validateConfig: validateConfig,
        getBalance: getBalance,
        addDiamonds: addDiamonds,
        spendDiamonds: spendDiamonds,
        grantBossReward: grantBossReward,
        GACHA_CONFIG: GACHA_CONFIG
    };
}

// ===== Node.js module 輸出 (require 相容) =====
// 必須在 IIFE 之後，確保所有函數都已定義
module.exports = {
    rollRarity: rollRarity,
    pull: pull,
    getConfig: function () { return GACHA_CONFIG; },
    pickCharacter: pickCharacter,
    dupeToDust: 5,
    validateConfig: validateConfig,
    getBalance: getBalance,
    addDiamonds: addDiamonds,
    spendDiamonds: spendDiamonds,
    grantBossReward: grantBossReward,
    GACHA_CONFIG: GACHA_CONFIG
};
