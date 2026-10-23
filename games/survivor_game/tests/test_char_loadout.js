'use strict';
// tests/test_char_loadout.js — 出擊角色系統（char-loadout.js）單元測試
const assert = require('node:assert/strict');
const CharLoadoutSystem = require('../char-loadout.js');

let passed = 0;
function ok(label, fn) {
    fn();
    passed++;
    console.log(`  PASS  ${label}`);
}

console.log('=== 出擊角色系統：純函式 ===');

const WAREHOUSE = [
    { id: 'emma', name: '艾瑪', rarity: 'SSR', count: 2 },
    { id: 'hiro', name: '希羅', rarity: 'SR', count: 1 }
];
const EMMMA_STATS = { hp: 90, atk: 14, def: 8, spd: 105 };

ok('加成計算：艾瑪（hp90/atk14/spd105）→ +36 生命 / +21% 傷害 / +4.5% 移速', () => {
    const b = CharLoadoutSystem.computeCharacterBonuses(EMMMA_STATS);
    assert.equal(b.maxHpBonus, 36);
    assert.equal(Math.round((b.damageMultiplier - 1) * 100), 21);
    assert.equal(Math.round((b.speedMultiplier - 1) * 1000) / 10, 4.5);
});

ok('加成計算：極端值不炸（空 stats → 全零加成、倍率 1）', () => {
    const b = CharLoadoutSystem.computeCharacterBonuses(null);
    assert.equal(b.maxHpBonus, 0);
    assert.equal(b.damageMultiplier, 1);
    assert.equal(b.speedMultiplier, 1);
});

ok('加成計算：spd < 90 移速不為負', () => {
    const b = CharLoadoutSystem.computeCharacterBonuses({ hp: 40, atk: 8, def: 3, spd: 70 });
    assert.equal(b.speedMultiplier, 1);
    assert.equal(b.maxHpBonus, 16);
});

ok('裝備：已獲得角色可裝備', () => {
    const st = {};
    const r = CharLoadoutSystem.equipCharacter(st, WAREHOUSE, 'emma');
    assert.equal(r.ok, true);
    assert.equal(st.equippedId, 'emma');
});

ok('裝備：未獲得角色被拒絕（not_owned）', () => {
    const st = {};
    const r = CharLoadoutSystem.equipCharacter(st, WAREHOUSE, 'yuki');
    assert.equal(r.ok, false);
    assert.equal(r.error, 'not_owned');
    assert.equal(st.equippedId, null);
});

ok('裝備：空 id 被拒絕', () => {
    const st = {};
    assert.equal(CharLoadoutSystem.equipCharacter(st, WAREHOUSE, '').ok, false);
});

ok('收回：清除裝備', () => {
    const st = { equippedId: 'emma' };
    const r = CharLoadoutSystem.unequipCharacter(st);
    assert.equal(r.ok, true);
    assert.equal(st.equippedId, null);
});

ok('一致性修復：倉庫移除後裝備自動卸下', () => {
    const st = { equippedId: 'hiro' };
    CharLoadoutSystem.normalize(st, [{ id: 'emma', rarity: 'SSR' }]);
    assert.equal(st.equippedId, null);
});

ok('getEquippedId：回傳規整後的裝備角色', () => {
    assert.equal(CharLoadoutSystem.getEquippedId({ equippedId: 'hiro' }, WAREHOUSE), 'hiro');
    assert.equal(CharLoadoutSystem.getEquippedId({}, WAREHOUSE), null);
});

console.log('=== 出擊角色系統：持久化 ===');

ok('save/load 完整還原（含帳號前綴）', () => {
    const mem = new Map();
    const storage = {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, String(v)),
        removeItem: (k) => mem.delete(k)
    };
    const st = {};
    CharLoadoutSystem.equipCharacter(st, WAREHOUSE, 'emma');
    assert.equal(CharLoadoutSystem.save(st, { storage, prefix: '_tester' }), true);
    const st2 = {};
    CharLoadoutSystem.load(st2, WAREHOUSE, { storage, prefix: '_tester' });
    assert.equal(st2.equippedId, 'emma');
});

ok('load：損毀存檔保持合法狀態不崩潰', () => {
    const storage = { getItem: () => '{{{broken json', setItem: () => {}, removeItem: () => {} };
    const st = {};
    CharLoadoutSystem.load(st, WAREHOUSE, { storage });
    assert.equal(st.equippedId, null);
});

ok('load：存檔中的角色已不在倉庫 → 自動卸下', () => {
    const storage = { getItem: () => JSON.stringify({ equippedId: 'yuki' }), setItem: () => {}, removeItem: () => {} };
    const st = {};
    CharLoadoutSystem.load(st, WAREHOUSE, { storage });
    assert.equal(st.equippedId, null);
});

ok('被拒儲存環境（隱私模式）不拋例外且 save 回傳 false', () => {
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    const st = {};
    CharLoadoutSystem.load(st, WAREHOUSE, { storage });
    assert.equal(st.equippedId, null);
    assert.equal(CharLoadoutSystem.save(st, { storage }), false);
});

console.log(`結果: ${passed} 通過 / 0 失敗`);
