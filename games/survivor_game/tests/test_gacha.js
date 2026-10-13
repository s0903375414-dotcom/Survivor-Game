// tests/test_gacha.js — 星輝資源系統 + 角色抽卡 單元/集成測試
// 執行:node tests/test_gacha.js(離開遊戲目錄 games/survivor_game 後:node tests/test_gacha.js)
'use strict';
const G = require('../gacha.js');

let passed = 0, failed = 0;
function check(name, cond, detail) {
    if (cond) { passed++; console.log('  PASS  ' + name); }
    else { failed++; console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function newState() { return { diamond: 0, warehouse: [], logs: [] }; }

console.log('=== 星輝系統單元測試 ===');

// --- 設定驗證 ---
(function () {
    const v = G.validateConfig();
    check('機率池設定合法(總和=100、各池非空)', v.ok, JSON.stringify(v));
})();

// --- 鑽石增減 ---
(function () {
    const s = newState();
    check('初始餘額為 0', G.getBalance(s) === 0);
    const a1 = G.addDiamonds(s, 10, 'test');
    check('新增 10 顆 → 餘額 10', a1.ok && a1.balance === 10, JSON.stringify(a1));
    const a2 = G.addDiamonds(s, -5, 'test');
    check('負數新增被拒絕(餘額不變)', !a2.ok && s.diamond === 10);
    const a3 = G.addDiamonds(s, 0, 'test');
    check('零新增被拒絕', !a3.ok && s.diamond === 10);
    const sp1 = G.spendDiamonds(s, 3, 'test');
    check('扣除 3 顆 → 餘額 7', sp1.ok && sp1.balance === 7, JSON.stringify(sp1));
    const sp2 = G.spendDiamonds(s, 8, 'test');
    check('餘額不足扣除失敗(餘額仍 7)', !sp2.ok && sp2.error === 'insufficient' && s.diamond === 7);
    check('新增/扣除均寫入日誌(供查核)', s.logs.filter(l => l.type === 'gain').length === 1 && s.logs.filter(l => l.type === 'spend').length === 1);
    // 日誌上限
    const s2 = newState();
    for (let i = 0; i < 150; i++) G.addDiamonds(s2, 1, 'bulk');
    check('日誌超過上限自動修剪(≤100)', s2.logs.length <= G.GACHA_CONFIG.maxLogEntries, String(s2.logs.length));
})();

// --- Boss 掉落 ---
(function () {
    const s = newState();
    const r1 = G.grantBossReward(s, 'BOSS');
    check('擊殺 Boss → +10 顆星輝', r1.ok && r1.balance === 10 && r1.reward === 10, JSON.stringify(r1));
    check('Boss 掉落寫入日誌(reason=boss_kill)', s.logs.some(l => l.reason === 'boss_kill:BOSS'));
    const r2 = G.grantBossReward(s, 'BOSS');
    check('連續擊殺 Boss 累積(+10 → 20)', r2.ok && r2.balance === 20);
})();

// --- 機率池抽取(注入固定 rand 驗證邊界)---
(function () {
    let calls = 0;
    check('rand=0 → 抽中 N(機率區間起點)', G.rollRarity(() => 0) === 'N');
    check('rand=0.599 → N 區間內(60%)', G.rollRarity(() => 0.599) === 'N');
    check('rand=0.61 → R 區間起點', G.rollRarity(() => 0.61) === 'R');
    check('rand=0.95 → SR 區間(90~99)', G.rollRarity(() => 0.95) === 'SR');
    check('rand=0.999 → SSR 區間(99~100)', G.rollRarity(() => 0.999) === 'SSR');
    const c = G.pickCharacter('SSR', () => 0);
    check('角色池抽取回傳角色', c && c.id === 'ace', JSON.stringify(c));
    // 大樣本分布合理性
    const N = 20000, cnt = { N: 0, R: 0, SR: 0, SSR: 0 };
    let seed = 42;
    const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < N; i++) cnt[G.rollRarity(rng)]++;
    check('20000 次隨機抽取 SSR 比例 ≈ 1%(實測 ' + (cnt.SSR / N * 100).toFixed(2) + '%)', Math.abs(cnt.SSR / N - 0.01) < 0.005);
    check('20000 次隨機抽取 N 比例 ≈ 60%(實測 ' + (cnt.N / N * 100).toFixed(2) + '%)', Math.abs(cnt.N / N - 0.60) < 0.03);
})();

// --- 抽卡餘額驗證 ---
(function () {
    const s = newState();
    const p1 = G.tryPull(s);
    check('餘額 0 抽卡失敗(insufficient)', !p1.ok && p1.error === 'insufficient' && s.diamond === 0);
    G.addDiamonds(s, 9, 'test');
    const p2 = G.tryPull(s);
    check('餘額 9(<10)抽卡失敗且不扣款', !p2.ok && s.diamond === 9, 'balance=' + s.diamond);
})();

// --- 抽卡原子性(異常回滾)---
(function () {
    const s = newState();
    G.addDiamonds(s, 10, 'test');
    let call = 0;
    // rand 第一次用於 rollRarity → 直接拋出例外,模擬扣除後系統錯誤
    const boom = () => { if (call++ === 0) throw new Error('injected_failure'); return 0.5; };
    const p = G.tryPull(s, boom);
    check('扣除後流程異常 → 餘額回滾為 10(原子性)', !p.ok && p.error === 'internal' && s.diamond === 10, JSON.stringify(p));
    check('異常回滾後倉庫未發放角色', s.warehouse.length === 0);
})();

// --- 邊界場景:剛好 10 顆 → 抽卡 → 歸零 ---
(function () {
    const s = newState();
    G.addDiamonds(s, 10, 'test');
    const p = G.tryPull(s);
    check('剛好持有 10 顆 → 單抽成功', p.ok, JSON.stringify(p));
    check('抽卡後星輝歸零', p.balance === 0 && s.diamond === 0);
    check('角色已發放至倉庫', s.warehouse.length === 1 && !!s.warehouse[0].rarity);
    const p2 = G.tryPull(s);
    check('歸零後再抽 → 失敗(餘額不足提示條件)', !p2.ok && p2.error === 'insufficient');
})();

console.log('=== 場景集成測試:擊殺 Boss → 抽卡 完整流程 ===');
(function () {
    const s = newState();
    // 連續擊殺 2 隻 Boss → 20 顆
    G.grantBossReward(s, 'BOSS');
    G.grantBossReward(s, 'BOSS');
    check('擊殺 2 隻 Boss 累積 20 顆', s.diamond === 20);
    const p1 = G.tryPull(s);
    check('第 1 次單抽成功(20→10)', p1.ok && s.diamond === 10);
    const p2 = G.tryPull(s);
    check('第 2 次單抽成功(10→0)', p2.ok && s.diamond === 0);
    check('倉庫累積 2 隻角色', s.warehouse.length === 2);
    check('完整流程日誌齊全(2 筆 boss_kill + 2 筆 gacha_pull)',
        s.logs.filter(l => l.reason === 'boss_kill:BOSS').length === 2 &&
        s.logs.filter(l => l.type === 'gacha_pull').length === 2);
    // 第 3 隻 Boss 後又可抽
    G.grantBossReward(s, 'BOSS');
    const p3 = G.tryPull(s);
    check('再擊殺 Boss 後可再抽(0→10→0)', p3.ok && s.diamond === 0);
})();

console.log('');
console.log('結果:' + passed + ' 通過 / ' + failed + ' 失敗');
process.exit(failed > 0 ? 1 : 0);
