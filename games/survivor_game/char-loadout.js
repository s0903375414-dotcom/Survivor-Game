// char-loadout.js — 出擊角色系統（角色庫裝備角色）v1 — 純邏輯模組
// 設計比照 equipment.js：
//   1) localStorage 全程經 safeStorage 防護（隱私模式/WebView 存取被拒時退化為記憶體模式）
//   2) computeCharacterBonuses() 純函式：同輸入恆同輸出（冪等）
//   3) 一致性修復：裝備中的角色必須已獲得（normalize 自動卸下不再擁有的角色）
// 架構：純邏輯、無 DOM 耦合；瀏覽器掛載 window.CharLoadoutSystem，Node 供 tests/test_char_loadout.js。
(function (global) {
    'use strict';

    // ===== 加成公式（數值平衡改這裡） =====
    // hp  → +最大生命：round(hp × 0.4)        （hp 40~100 → +16~40）
    // atk → 傷害倍率：1 + atk × 0.015         （atk 8~20 → +12%~30%）
    // spd → 移速倍率：1 + max(0, spd-90)×0.003（spd 95~120 → +1.5%~9%）
    var HP_RATIO = 0.4;
    var ATK_PER_PCT = 0.015;
    var SPD_BASE = 90;
    var SPD_PER_PCT = 0.003;

    function computeCharacterBonuses(stats) {
        var s = stats || {};
        var hp = Number(s.hp) || 0;
        var atk = Number(s.atk) || 0;
        var spd = Number(s.spd) || 0;
        return {
            maxHpBonus: Math.round(hp * HP_RATIO),
            damageMultiplier: 1 + atk * ATK_PER_PCT,
            speedMultiplier: 1 + Math.max(0, spd - SPD_BASE) * SPD_PER_PCT
        };
    }

    // ===== 狀態規整 + 一致性修復 =====
    function normalize(state, warehouse) {
        if (!state) state = {};
        if (typeof state.equippedId !== 'string' || !state.equippedId) state.equippedId = null;
        var owned = Array.isArray(warehouse) ? warehouse : [];
        if (state.equippedId && !isOwned(state.equippedId, owned)) state.equippedId = null; // 未獲得不得裝備
        return state;
    }

    function isOwned(id, warehouse) {
        var owned = Array.isArray(warehouse) ? warehouse : [];
        for (var i = 0; i < owned.length; i++) {
            if (owned[i] && owned[i].id === id) return true;
        }
        return false;
    }

    // ===== 核心操作 =====
    function equipCharacter(state, warehouse, id) {
        normalize(state, warehouse);
        if (!id || !isOwned(id, warehouse)) return { ok: false, error: 'not_owned' };
        state.equippedId = id;
        return { ok: true, equippedId: id };
    }

    function unequipCharacter(state) {
        if (!state) state = {};
        state.equippedId = null;
        return { ok: true };
    }

    function getEquippedId(state, warehouse) {
        normalize(state, warehouse);
        return state.equippedId || null;
    }

    // ===== 安全儲存（與 equipment.js 相同模式） =====
    function safeStorage(storage) {
        var s = (storage === undefined) ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage;
        return {
            get: function (k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } },
            set: function (k, v) { try { if (s) { s.setItem(k, v); return true; } } catch (e) { } return false; },
            remove: function (k) { try { if (s) s.removeItem(k); return true; } catch (e) { return false; } }
        };
    }

    // ===== 持久化（前綴依帳號隔離，模式與 equipment.js 完全一致） =====
    function load(state, warehouse, opts) {
        if (!state) state = {};
        var st = safeStorage(opts && opts.storage);
        var prefix = (opts && opts.prefix) || '';
        try {
            var o = JSON.parse(st.get('survivor_char_equipped' + prefix));
            if (o && typeof o === 'object') {
                state.equippedId = (typeof o.equippedId === 'string' && o.equippedId) ? o.equippedId : null;
            }
        } catch (e) { /* 損毀存檔保持現值 */ }
        return normalize(state, warehouse);
    }

    function save(state, opts) {
        if (!state) state = {};
        var st = safeStorage(opts && opts.storage);
        var prefix = (opts && opts.prefix) || '';
        return st.set('survivor_char_equipped' + prefix, JSON.stringify({ equippedId: state.equippedId || null }));
    }

    var CharLoadoutSystem = {
        computeCharacterBonuses: computeCharacterBonuses,
        normalize: normalize,
        isOwned: isOwned,
        equipCharacter: equipCharacter,
        unequipCharacter: unequipCharacter,
        getEquippedId: getEquippedId,
        safeStorage: safeStorage,
        load: load,
        save: save
    };

    global.CharLoadoutSystem = CharLoadoutSystem;
    if (typeof module !== 'undefined' && module.exports) module.exports = CharLoadoutSystem;
})(typeof window !== 'undefined' ? window : globalThis);
