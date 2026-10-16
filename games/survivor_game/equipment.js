// equipment.js — 戰術單位(角色裝備)系統 v2 — 純邏輯模組
// 修復要點:
//   1) localStorage 全程經 safeStorage 防護(隱私模式/WebView 存取被拒時不再崩潰,僅退化为記憶體模式)
//   2) computeBonuses() 冪等計算:任何時候呼叫,同輸入必同輸出,不再直接累積 player.maxHp
//   3) 裝備一致性:裝備中的單位必須已擁有(normalize 自動修復損毀存檔)
// 架構:純邏輯、無 DOM 耦合;瀏覽器掛載 window.EquipmentSystem,Node 供 tests/test_equipment.js。
(function (global) {
    'use strict';

    var BASE_MAXHP = 100;

    // ===== 單位定義(裝備類型;營運改這裡) =====
    var UNIT_DEFS = [
        { id: 'drone',     cost: 5000, bonus: { multishot: 1 } },
        { id: 'medic',     cost: 4000, bonus: { maxHp: 50, fullHeal: true } },
        { id: 'logistics', cost: 6000, bonus: { fundsMultiplier: 1.5 } }
    ];

    function defById(id) {
        for (var i = 0; i < UNIT_DEFS.length; i++) if (UNIT_DEFS[i].id === id) return UNIT_DEFS[i];
        return null;
    }

    // ===== 狀態規整 + 一致性修復 =====
    function normalize(state) {
        if (!state) state = {};
        if (typeof state.funds !== 'number' || !isFinite(state.funds)) state.funds = 0;
        state.funds = Math.floor(state.funds);
        if (!state.owned || typeof state.owned !== 'object') state.owned = {};
        if (!state.equipped || typeof state.equipped !== 'object') state.equipped = {};
        for (var k in state.equipped) {
            if (state.equipped[k] && !state.owned[k]) state.equipped[k] = false; // 未擁有不得裝備
        }
        return state;
    }

    function isOwned(state, id) { return !!normalize(state).owned[id]; }
    function isEquipped(state, id) { return !!normalize(state).equipped[id]; }

    // ===== 核心操作 =====
    function purchase(state, id) {
        normalize(state);
        var def = defById(id);
        if (!def) return { ok: false, error: 'unknown_unit' };
        if (state.owned[id]) return { ok: false, error: 'already_owned', funds: state.funds };
        if (state.funds < def.cost) return { ok: false, error: 'insufficient_funds', funds: state.funds, cost: def.cost };
        state.funds -= def.cost;
        state.owned[id] = true;
        state.equipped[id] = true; // 購買後自動裝備
        return { ok: true, funds: state.funds, cost: def.cost, autoEquipped: true };
    }

    function equip(state, id) {
        normalize(state);
        if (!state.owned[id]) return { ok: false, error: 'not_owned' };
        state.equipped[id] = true;
        return { ok: true, equipped: true };
    }

    function unequip(state, id) {
        normalize(state);
        if (!state.owned[id]) return { ok: false, error: 'not_owned' };
        state.equipped[id] = false;
        return { ok: true, equipped: false };
    }

    function toggleEquip(state, id) {
        normalize(state);
        if (!state.owned[id]) return { ok: false, error: 'not_owned' };
        state.equipped[id] = !state.equipped[id];
        return { ok: true, equipped: state.equipped[id] };
    }

    // ===== 冪等加成計算:同輸入恆同輸出,重複呼叫不累積 =====
    function computeBonuses(state, baseStats) {
        normalize(state);
        var b = {
            multishot: 0,
            maxHpBonus: 0,
            fundsMultiplier: 1,
            fullHeal: false,
            maxHp: (baseStats && typeof baseStats.maxHp === 'number') ? baseStats.maxHp : BASE_MAXHP
        };
        if (state.equipped.drone) b.multishot = defById('drone').bonus.multishot;
        if (state.equipped.medic) {
            b.maxHpBonus = defById('medic').bonus.maxHp;
            b.fullHeal = true;
        }
        if (state.equipped.logistics) b.fundsMultiplier = defById('logistics').bonus.fundsMultiplier;
        b.maxHp = b.maxHp + b.maxHpBonus;
        return b;
    }

    // ===== 安全儲存(任何例外皆吞掉,回傳 null/false — 隱私模式/WebView 友善) =====
    function safeStorage(storage) {
        var s = (storage === undefined) ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage;
        return {
            get: function (k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } },
            set: function (k, v) { try { if (s) { s.setItem(k, v); return true; } } catch (e) { } return false; },
            remove: function (k) { try { if (s) s.removeItem(k); return true; } catch (e) { return false; } }
        };
    }

    // ===== 持久化(前綴依帳號隔離,與既有 key 完全相容) =====
    function load(state, opts) {
        normalize(state);
        var st = safeStorage(opts && opts.storage);
        var prefix = (opts && opts.prefix) || '';
        var f = st.get('survivor_funds' + prefix);
        if (f !== null) {
            var pf = parseInt(f, 10);
            if (!isNaN(pf)) state.funds = pf;
        }
        try {
            var o = JSON.parse(st.get('survivor_units_owned' + prefix));
            if (o && typeof o === 'object') state.owned = o;
        } catch (e) { /* 損毀存檔保持現值 */ }
        try {
            var q = JSON.parse(st.get('survivor_units_equipped' + prefix));
            if (q && typeof q === 'object') state.equipped = q;
        } catch (e) { /* 損毀存檔保持現值 */ }
        return normalize(state);
    }

    function save(state, opts) {
        normalize(state);
        var st = safeStorage(opts && opts.storage);
        var prefix = (opts && opts.prefix) || '';
        var a = st.set('survivor_funds' + prefix, String(state.funds));
        var b = st.set('survivor_units_owned' + prefix, JSON.stringify(state.owned));
        var c = st.set('survivor_units_equipped' + prefix, JSON.stringify(state.equipped));
        return a && b && c;
    }

    var EquipmentSystem = {
        BASE_MAXHP: BASE_MAXHP,
        UNIT_DEFS: UNIT_DEFS,
        defById: defById,
        normalize: normalize,
        isOwned: isOwned,
        isEquipped: isEquipped,
        purchase: purchase,
        equip: equip,
        unequip: unequip,
        toggleEquip: toggleEquip,
        computeBonuses: computeBonuses,
        safeStorage: safeStorage,
        load: load,
        save: save
    };

    global.EquipmentSystem = EquipmentSystem;
    if (typeof module !== 'undefined' && module.exports) module.exports = EquipmentSystem;
})(typeof window !== 'undefined' ? window : globalThis);
