// gacha.js — 星輝(Xinghui)資源系統 + 角色抽卡
// 貨幣命名採原神/崩鐵風格:「星輝」。
// 架構:純邏輯模組,不含 DOM/儲存;狀態由呼叫端傳入(state = {diamond, warehouse, logs})。
// 環境:瀏覽器(window.GachaSystem)與 Node(tests/test_gacha.js)皆可執行。
(function (global) {
    'use strict';

    // ===== 抽卡機率池配置(獨立可調,營運改這裡即可)=====
    var GACHA_CONFIG = {
        costPerPull: 10,          // 單抽消耗星輝
        bossKillReward: 10,       // Boss 擊殺掉落星輝
        maxLogEntries: 100,       // 掉落/消費日誌保留上限(供後續查核)
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
        }
    };

    // 設定合法性檢查(機率總和 = 100、每個稀有度都有角色)
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
        if (sum !== 100) return { ok: false, error: 'rates_sum_' + sum };
        if (GACHA_CONFIG.costPerPull <= 0) return { ok: false, error: 'bad_cost' };
        return { ok: true };
    }

    function normalize(state) {
        if (!state) state = {};
        if (typeof state.diamond !== 'number' || !isFinite(state.diamond)) state.diamond = 0;
        if (!Array.isArray(state.warehouse)) state.warehouse = [];
        if (!Array.isArray(state.logs)) state.logs = [];
        return state;
    }

    function pushLog(state, entry) {
        state.logs.push(entry);
        if (state.logs.length > GACHA_CONFIG.maxLogEntries) {
            state.logs = state.logs.slice(-GACHA_CONFIG.maxLogEntries);
        }
    }

    // ===== 星輝餘額操作 =====

    // 即時讀取餘額
    function getBalance(state) {
        normalize(state);
        return state.diamond | 0;
    }

    // 新增星輝(amount 必須為正整數;回傳 {ok, balance, gained} 並寫入日誌)
    function addDiamonds(state, amount, reason) {
        normalize(state);
        if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
            return { ok: false, error: 'invalid_amount', balance: state.diamond };
        }
        var gained = Math.floor(amount);
        state.diamond += gained;
        pushLog(state, { time: Date.now(), type: 'gain', amount: gained, reason: reason || 'unknown' });
        return { ok: true, balance: state.diamond, gained: gained };
    }

    // 扣除星輝(先驗證餘額;不足即失敗,不做任何變動)
    function spendDiamonds(state, amount, reason) {
        normalize(state);
        if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
            return { ok: false, error: 'invalid_amount', balance: state.diamond };
        }
        var cost = Math.floor(amount);
        if (state.diamond < cost) {
            return { ok: false, error: 'insufficient', balance: state.diamond, needed: cost };
        }
        state.diamond -= cost;
        pushLog(state, { time: Date.now(), type: 'spend', amount: -cost, reason: reason || 'unknown' });
        return { ok: true, balance: state.diamond, spent: cost };
    }

    // ===== Boss 擊殺掉落(固定 +10 顆,寫入掉落日誌)=====
    function grantBossReward(state, bossName) {
        var r = addDiamonds(state, GACHA_CONFIG.bossKillReward, 'boss_kill:' + (bossName || 'BOSS'));
        if (r.ok) r.reward = GACHA_CONFIG.bossKillReward;
        return r;
    }

    // ===== 抽卡核心 =====

    // 依機率池抽取稀有度(rand:0~1 隨機數,注入式以便測試)
    function rollRarity(rand) {
        var fn = (typeof rand === 'function') ? rand : Math.random;
        var keys = Object.keys(GACHA_CONFIG.rates);
        var r = fn() * 100;
        for (var i = 0; i < keys.length; i++) {
            r -= GACHA_CONFIG.rates[keys[i]];
            if (r < 0) return keys[i];
        }
        return keys[keys.length - 1];
    }

    // 從指定稀有度的角色池中隨機取一隻
    function pickCharacter(rarity, rand) {
        var fn = (typeof rand === 'function') ? rand : Math.random;
        var pool = GACHA_CONFIG.pool[rarity];
        if (!pool || !pool.length) return null;
        return pool[Math.floor(fn() * pool.length)];
    }

    // 單抽:驗證 → 扣除 → 抽取 → 發放(原子性;任一步失敗即回滾,不產生半套狀態)
    function tryPull(state, rand) {
        normalize(state);
        var before = state.diamond;
        var snapshot = JSON.stringify({ diamond: state.diamond, warehouse: state.warehouse, logs: state.logs });
        try {
            // 1) 驗證 + 扣除(不足即失敗,餘額不變)
            var spend = spendDiamonds(state, GACHA_CONFIG.costPerPull, 'gacha_pull');
            if (!spend.ok) return { ok: false, error: spend.error, balance: before, needed: spend.needed };

            // 2) 依機率池抽取
            var rarity = rollRarity(rand);
            var char = pickCharacter(rarity, rand);

            // 3) 發放至倉庫(角色池未定義視為系統錯誤 → 回滾)
            if (!char) throw new Error('empty_pool:' + rarity);
            state.warehouse.push({ id: char.id, name: char.name, rarity: rarity, gainedAt: Date.now() });
            pushLog(state, { time: Date.now(), type: 'gacha_pull', amount: -GACHA_CONFIG.costPerPull, charId: char.id, charName: char.name, rarity: rarity });

            return { ok: true, character: char, rarity: rarity, balance: state.diamond, gained: char };
        } catch (e) {
            // 原子性保障:任何異常 → 還原為抽卡前快照(鑽石已扣但角色未發放等狀態不會發生)
            var restored = JSON.parse(snapshot);
            state.diamond = restored.diamond;
            state.warehouse = restored.warehouse;
            state.logs = restored.logs;
            return { ok: false, error: 'internal', detail: String(e), balance: state.diamond };
        }
    }

    var GachaSystem = {
        GACHA_CONFIG: GACHA_CONFIG,
        validateConfig: validateConfig,
        getBalance: getBalance,
        addDiamonds: addDiamonds,
        spendDiamonds: spendDiamonds,
        grantBossReward: grantBossReward,
        rollRarity: rollRarity,
        pickCharacter: pickCharacter,
        tryPull: tryPull
    };

    global.GachaSystem = GachaSystem;
    if (typeof module !== 'undefined' && module.exports) module.exports = GachaSystem;
})(typeof window !== 'undefined' ? window : globalThis);
