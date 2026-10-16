// tests/test_equipment.js — 角色裝備系統(戰術單位)單元/集成測試
// 執行:node tests/test_equipment.js
// 覆蓋:三類裝備的購買/裝備/卸下/切換、擁有權強制、軍資扣除與不足、
//       加成冪等計算(重複呼叫不累積)、localStorage 被拒環境(隱私模式)降級、
//       存檔持久化 round-trip、損毀存檔一致性修復。
'use strict';
const E = require('../equipment.js');

let passed = 0, failed = 0;
function check(name, cond, detail) {
    if (cond) { passed++; console.log('  PASS  ' + name); }
    else { failed++; console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function newState() { return { funds: 0, owned: {}, equipped: {} }; }
// 模擬 localStorage 被拒(隱私模式/WebView):任何操作直接拋 SecurityError
function deniedStorage() {
    const boom = () => { throw new DOMException('Access denied', 'SecurityError'); };
    return { getItem: boom, setItem: boom, removeItem: boom };
}

console.log('=== 裝備系統:定義與規整 ===');
(function () {
    check('三種裝備類型已定義(drone/medic/logistics)', E.UNIT_DEFS.length === 3 && ['drone', 'medic', 'logistics'].every(id => !!E.defById(id)));
    check('損毀存檔一致性修復:未擁有但裝備中 → 自動卸下', (() => { const s = { funds: 0, owned: {}, equipped: { drone: true } }; E.normalize(s); return s.equipped.drone === false; })());
    check('非數字軍資歸零', E.normalize({ funds: 'abc', owned: {}, equipped: {} }).funds === 0);
})();

console.log('=== 購買流程 ===');
(function () {
    const s = newState(); s.funds = 16000;
    const p1 = E.purchase(s, 'drone');
    check('購買無人機:扣 5000 軍資並自動裝備', p1.ok && s.funds === 11000 && s.owned.drone === true && s.equipped.drone === true);
    const p2 = E.purchase(s, 'medic');
    check('購買醫療小隊:扣 4000 並自動裝備', p2.ok && s.funds === 7000 && s.equipped.medic === true);
    const p3 = E.purchase(s, 'logistics');
    check('購買後勤補給線:扣 6000 並自動裝備', p3.ok && s.funds === 1000 && s.equipped.logistics === true);
    const p4 = E.purchase(s, 'drone');
    check('重複購買被拒絕(already_owned,軍資不變)', !p4.ok && p4.error === 'already_owned' && s.funds === 1000);
    const p5 = (() => { const s2 = newState(); s2.funds = 100; return E.purchase(s2, 'drone'); })();
    check('軍資不足購買被拒(insufficient_funds)', !p5.ok && p5.error === 'insufficient_funds' && p5.cost === 5000);
    const p6 = E.purchase(s, 'unknown');
    check('未知裝備類型被拒絕(unknown_unit)', !p6.ok && p6.error === 'unknown_unit');
})();

console.log('=== 裝備 / 卸下 / 切換 ===');
(function () {
    const s = newState(); s.funds = 5000;
    E.purchase(s, 'drone');
    check('已擁有:切換裝備 → 卸下', E.toggleEquip(s, 'drone').ok && s.equipped.drone === false);
    check('已擁有:再次切換 → 重新裝備', E.toggleEquip(s, 'drone').ok && s.equipped.drone === true);
    check('指定裝備 equip 顯式生效', E.equip(s, 'drone').ok && s.equipped.drone === true);
    check('指定卸下 unequip 顯式生效', E.unequip(s, 'drone').ok && s.equipped.drone === false);
    const t2 = newState(); t2.funds = 5000;
    check('未擁有不得裝備(not_owned)', (() => { const r = E.equip(t2, 'drone'); return !r.ok && r.error === 'not_owned' && !t2.equipped.drone; })());
    check('未擁有不得卸下(not_owned)', (() => { const r = E.unequip(t2, 'drone'); return !r.ok && r.error === 'not_owned'; })());
    check('未擁有不得切換(not_owned)', (() => { const r = E.toggleEquip(t2, 'drone'); return !r.ok && r.error === 'not_owned'; })());
})();

console.log('=== 加成計算(冪等:修復 maxHp 累積缺陷) ===');
(function () {
    const s = newState(); s.funds = 15000;
    E.purchase(s, 'drone'); E.purchase(s, 'medic'); E.purchase(s, 'logistics');
    const b1 = E.computeBonuses(s, { maxHp: 100 });
    check('全裝備加成:multishot=1 / maxHp=150 / funds×1.5 / 滿血開局',
        b1.multishot === 1 && b1.maxHpBonus === 50 && b1.maxHp === 150 && b1.fundsMultiplier === 1.5 && b1.fullHeal === true,
        JSON.stringify(b1));
    const b2 = E.computeBonuses(s, { maxHp: 100 });
    check('重複呼叫加成計算結果不變(冪等,不累積)', b2.maxHp === 150 && b2.multishot === 1 && b2.fundsMultiplier === 1.5);
    const b3 = E.computeBonuses(s, { maxHp: 100 });
    check('三次呼叫仍不變(修復 maxHp += 累積缺陷)', b3.maxHp === 150);
    E.unequip(s, 'medic');
    const b4 = E.computeBonuses(s, { maxHp: 100 });
    check('卸下醫療小隊:maxHp 回到基礎 100', b4.maxHpBonus === 0 && b4.maxHp === 100 && b4.fullHeal === false);
    E.unequip(s, 'logistics');
    check('卸下後勤:軍資倍率回到 1', E.computeBonuses(s).fundsMultiplier === 1);
    E.unequip(s, 'drone');
    check('卸下無人機:multishot 回到 0', E.computeBonuses(s).multishot === 0);
    const empty = E.computeBonuses(newState(), { maxHp: 100 });
    check('無任何裝備:等同裸裝數值', empty.maxHp === 100 && empty.multishot === 0 && empty.fundsMultiplier === 1);
})();

console.log('=== 持久化 round-trip(安全儲存) ===');
(function () {
    const mem = {};
    const memStorage = {
        getItem: k => (k in mem ? mem[k] : null),
        setItem: (k, v) => { mem[k] = String(v); },
        removeItem: k => { delete mem[k]; }
    };
    const s1 = newState(); s1.funds = 12000;
    E.purchase(s1, 'medic');
    check('save 寫入三個 key(funds/owned/equipped)', E.save(s1, { storage: memStorage, prefix: '_測試員' }) === true && Object.keys(mem).length === 3);
    const s2 = newState();
    E.load(s2, { storage: memStorage, prefix: '_測試員' });
    check('load 完整還原:軍資/已擁有/裝備中', s2.funds === 8000 && s2.owned.medic === true && s2.equipped.medic === true);
    const s3 = newState(); s3.equipped.medic = true; // 人工損毀:未擁有卻裝備
    E.load(s3, { storage: memStorage, prefix: '_不存在' }); // 無存檔 → 保持 + normalize 修復
    check('讀取不到存檔時狀態保持合法', s3.equipped.medic === false);
})();

console.log('=== localStorage 被拒環境(隱私模式/WebView)降級 ===');
(function () {
    const s = newState(); s.funds = 9999;
    check('被拒儲存下 save 不拋例外並回傳 false', (() => { try { return E.save(s, { storage: deniedStorage() }) === false; } catch (e) { return false; } })());
    check('被拒儲存下 load 不拋例外且記憶體狀態不變', (() => { try { const before = s.funds; E.load(s, { storage: deniedStorage() }); return s.funds === before; } catch (e) { return false; } })());
    check('被拒儲存下 get 回傳 null(不崩潰)', E.safeStorage(deniedStorage()).get('x') === null);
    check('storage 傳 null(無 localStorage API)不崩潰', E.safeStorage(null).get('x') === null && E.safeStorage(null).set('x', '1') === false);
    check('被拒環境中裝備操作仍可運行(記憶體模式)', (() => { const r = E.purchase(s, 'medic'); return r.ok && s.equipped.medic === true; })());
    check('被拒環境中加成計算仍正常', E.computeBonuses(s, { maxHp: 100 }).maxHp === 150);
})();

console.log('');
console.log('結果:' + passed + ' 通過 / ' + failed + ' 失敗');
process.exit(failed > 0 ? 1 : 0);
