// tests/test_gacha.js — 星輝資源系統 + 角色召喚(卡池 v2)單元/集成測試
// 執行:node tests/test_gacha.js
// 覆蓋:角色資料庫完整性、卡池設定、機率邊界、保底(SSR 硬保底 60 / SR 軟保底 10)、
//       限定 UP 50% 與歪後必中、重複角色轉星輝、召喚券消耗、卡池輪換、原子性回滾。
'use strict';
require('../characters_data.js'); // 必須先載入:gacha.js 讀取 global.CHARACTERS
const G = require('../gacha.js');
const DB = global.CHARACTERS || [];

let passed = 0, failed = 0;
function check(name, cond, detail) {
    if (cond) { passed++; console.log('  PASS  ' + name); }
    else { failed++; console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function newState() { return { diamond: 0, warehouse: [], logs: [] }; }

// ================= 角色資料庫完整性(資源載入穩定性) =================
console.log('=== 角色資料庫完整性 ===');
(function () {
    check('角色資料庫載入 17 位角色', DB.length === 17, String(DB.length));
    const ids = DB.map(c => c.id);
    check('角色 id 無重複', new Set(ids).size === 17);
    check('稀有度皆為 N/R/SR/SSR', DB.every(c => ['N', 'R', 'SR', 'SSR'].includes(c.rarity)));
    check('屬性面板齊全(hp/atk/def/spd 皆正數)', DB.every(c => c.stats && [c.stats.hp, c.stats.atk, c.stats.def, c.stats.spd].every(v => typeof v === 'number' && v > 0)));
    check('專屬技能齊全(名稱+描述)', DB.every(c => c.skill && c.skill.name && c.skill.desc));
    check('原創背景故事完整(每位 ≥40 字)與招牌台詞齊全', DB.every(c => typeof c.story === 'string' && c.story.length >= 40 && typeof c.tagline === 'string' && c.tagline.length > 0));
    check('背景故事皆為獨立撰寫(無重複)', new Set(DB.map(c => c.story)).size === 17);
    check('立繪配色與髮型規格齊全', DB.every(c => c.palette && c.palette.hair && c.palette.hairDark && c.palette.eye && c.palette.outfit && c.hairStyle));
    const bySrc = {}; DB.forEach(c => { bySrc[c.source] = (bySrc[c.source] || 0) + 1; });
    check('二創來源《魔法少女的魔女審判》6 位', bySrc.manosaba === 6, JSON.stringify(bySrc));
    check('二創來源《不/存在的你，和我》3 位', bySrc.noexist === 3);
    check('戰術部隊(本作原創)8 位', bySrc.tactical === 8);
    check('限定專屬角色:yuki 與 lilith 僅能透過限定池取得',
        DB.find(c => c.id === 'yuki').limitedOnly === true && DB.find(c => c.id === 'lilith').limitedOnly === true);
    const rar = {}; DB.forEach(c => { rar[c.rarity] = (rar[c.rarity] || 0) + 1; });
    check('稀有度分布 SSR4/SR5/R5/N3', rar.SSR === 4 && rar.SR === 5 && rar.R === 5 && rar.N === 3, JSON.stringify(rar));
})();

// ================= 卡池設定驗證 =================
console.log('=== 卡池設定驗證 ===');
(function () {
    const v = G.validateConfig();
    check('機率池設定合法(總和=100、各池非空、角色庫已載入)', v.ok, JSON.stringify(v));
    const std = G.GACHA_CONFIG.standard.rates;
    check('常駐池機率 N60/R30/SR9/SSR1', std.N === 60 && std.R === 30 && std.SR === 9 && std.SSR === 1, JSON.stringify(std));
    check('限定池機率與常駐池同比例', G.GACHA_CONFIG.limitedBanners.every(b => b.rates.N === 60 && b.rates.R === 30 && b.rates.SR === 9 && b.rates.SSR === 1));
    check('全部卡池 SSR 硬保底 60 抽', G.GACHA_CONFIG.standard.pitySSR === 60 && G.GACHA_CONFIG.limitedBanners.every(b => b.pitySSR === 60));
    check('全部卡池 SR 軟保底 10 抽', G.GACHA_CONFIG.standard.pitySR === 10 && G.GACHA_CONFIG.limitedBanners.every(b => b.pitySR === 10));
    check('每個限定池皆設定 UP 角色', G.GACHA_CONFIG.limitedBanners.every(b => !!b.up) && G.GACHA_CONFIG.limitedBanners.length === 3);
})();

// ================= 星輝增減 =================
console.log('=== 星輝系統單元測試 ===');
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
    const s2 = newState();
    for (let i = 0; i < 150; i++) G.addDiamonds(s2, 1, 'bulk');
    check('日誌超過上限自動修剪(≤上限)', s2.logs.length <= G.GACHA_CONFIG.maxLogEntries, String(s2.logs.length));
})();

// ================= Boss 掉落 =================
(function () {
    const s = newState();
    const r1 = G.grantBossReward(s, 'BOSS');
    check('擊殺 Boss → +10 顆星輝', r1.ok && r1.balance === 10 && r1.reward === 10, JSON.stringify(r1));
    check('Boss 掉落寫入日誌(reason=boss_kill)', s.logs.some(l => l.reason === 'boss_kill:BOSS'));
    const r2 = G.grantBossReward(s, 'BOSS');
    check('連續擊殺 Boss 累積(+10 → 20)', r2.ok && r2.balance === 20);
})();

// ================= 機率池抽取(注入固定 rand 驗證邊界) =================
console.log('=== 機率池抽取 ===');
(function () {
    check('rand=0 → 抽中 N(機率區間起點)', G.rollRarity(() => 0) === 'N');
    check('rand=0.599 → N 區間內(60%)', G.rollRarity(() => 0.599) === 'N');
    check('rand=0.61 → R 區間起點', G.rollRarity(() => 0.61) === 'R');
    check('rand=0.95 → SR 區間(90~99)', G.rollRarity(() => 0.95) === 'SR');
    check('rand=0.999 → SSR 區間(99~100)', G.rollRarity(() => 0.999) === 'SSR');
    const c = G.pickCharacter('SSR', () => 0);
    check('角色池抽取回傳角色(指定稀有度)', c && c.rarity === 'SSR', JSON.stringify(c));
    const N = 20000, cnt = { N: 0, R: 0, SR: 0, SSR: 0 };
    let seed = 42;
    const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < N; i++) cnt[G.rollRarity(rng)]++;
    check('20000 次隨機抽取 SSR 比例 ≈ 1%(實測 ' + (cnt.SSR / N * 100).toFixed(2) + '%)', Math.abs(cnt.SSR / N - 0.01) < 0.005);
    check('20000 次隨機抽取 N 比例 ≈ 60%(實測 ' + (cnt.N / N * 100).toFixed(2) + '%)', Math.abs(cnt.N / N - 0.60) < 0.03);
})();

// ================= 抽卡餘額驗證 =================
(function () {
    const s = newState();
    const p1 = G.tryPull(s);
    check('餘額 0 抽卡失敗(insufficient)', !p1.ok && p1.error === 'insufficient' && s.diamond === 0);
    G.addDiamonds(s, 9, 'test');
    const p2 = G.tryPull(s);
    check('餘額 9(<10)抽卡失敗且不扣款', !p2.ok && s.diamond === 9, 'balance=' + s.diamond);
})();

// ================= 抽卡原子性(異常回滾) =================
(function () {
    const s = newState();
    G.addDiamonds(s, 10, 'test');
    let call = 0;
    const boom = () => { if (call++ === 0) throw new Error('injected_failure'); return 0.5; };
    const p = G.tryPull(s, boom);
    check('扣除後流程異常 → 餘額回滾為 10(原子性)', !p.ok && p.error === 'internal' && s.diamond === 10, JSON.stringify(p));
    check('異常回滾後倉庫未發放角色', s.warehouse.length === 0);
})();

// ================= 邊界場景:剛好 10 顆 → 抽卡 → 歸零 =================
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

// ================= 場景集成:擊殺 Boss → 抽卡 完整流程 =================
console.log('=== 場景集成測試:擊殺 Boss → 抽卡 完整流程 ===');
(function () {
    const s = newState();
    G.grantBossReward(s, 'BOSS');
    G.grantBossReward(s, 'BOSS');
    check('擊殺 2 隻 Boss 累積 20 顆', s.diamond === 20);
    const p1 = G.tryPull(s, () => 0.5);   // N 區間
    check('第 1 次單抽成功(20→10)', p1.ok && s.diamond === 10);
    const p2 = G.tryPull(s, () => 0.65);  // R 區間(與第 1 抽不同稀有度 → 必為不同角色)
    check('第 2 次單抽成功(10→0)', p2.ok && s.diamond === 0);
    check('倉庫累積 2 隻角色', s.warehouse.length === 2, JSON.stringify(s.warehouse.map(w => w.id)));
    check('完整流程日誌齊全(2 筆 boss_kill + 2 筆 gacha_pull)',
        s.logs.filter(l => l.reason === 'boss_kill:BOSS').length === 2 &&
        s.logs.filter(l => l.type === 'gacha_pull').length === 2);
    G.grantBossReward(s, 'BOSS');
    const p3 = G.tryPull(s, () => 0.85); // 固定 R 區間且必為新角色(與前兩抽不同) → 無重複轉換,餘額精確歸零
    check('再擊殺 Boss 後可再抽(0→10→0)', p3.ok && s.diamond === 0);
})();

// ================= 保底機制 =================
console.log('=== 保底機制 ===');
(function () {
    const s = newState();
    G.addDiamonds(s, 1000, 'test');
    const results = [];
    for (let i = 0; i < 60; i++) {
        const r = G.pullBanner(s, 'standard', 1, () => 0.5); // rand=0.5 → 恆 roll N,SSR 只能靠保底
        results.push(r.results[0]);
    }
    check('SSR 硬保底:前 59 抽皆無 SSR', results.slice(0, 59).every(r => r.rarity !== 'SSR'));
    check('SSR 硬保底:第 60 抽必出 SSR', results[59].rarity === 'SSR' && results[59].forcedSsr === true);
    check('SR 軟保底:每 10 抽內必出 SR(第 10/20/30/40/50 抽)', [9, 19, 29, 39, 49].every(i => results[i].rarity === 'SR'));
    check('保底後 pity 計數重置', s.pity.standard.ssrCount === 0);
})();

// ================= 限定 UP 機制(50% 命中 + 歪後必中) =================
console.log('=== 限定 UP 機制 ===');
(function () {
    const s1 = newState();
    G.addDiamonds(s1, 100, 'test');
    G.getBalance(s1); s1.pity.limited.ssrCount = 59; // 下一抽觸發 SSR 硬保底
    const r1 = G.pullBanner(s1, 'lilith', 1, () => 0.5, () => 0.1);
    check('UP 50% 命中(isUpRand<0.5)→ 抽中 UP 角色莉莉絲', r1.ok && r1.results[0].char.id === 'lilith' && r1.results[0].up === true);

    const s2 = newState();
    G.addDiamonds(s2, 200, 'test');
    G.getBalance(s2); s2.pity.limited.ssrCount = 59;
    const r2 = G.pullBanner(s2, 'lilith', 1, () => 0.5, () => 0.9);
    check('UP 歪了(isUpRand≥0.5)→ 抽到非 UP 的 SSR', r2.ok && r2.results[0].char.id !== 'lilith' && r2.results[0].up === false, JSON.stringify(r2.results[0].char && r2.results[0].char.id));
    check('歪後系統標記大保底(guaranteedUp)', s2.pity.limited.guaranteedUp === true);
    s2.pity.limited.ssrCount = 59;
    const r3 = G.pullBanner(s2, 'lilith', 1, () => 0.5, () => 0.9); // 再歪也必中
    check('歪後下一次 SSR 必中 UP 角色', r3.ok && r3.results[0].char.id === 'lilith' && r3.results[0].up === true);
    check('大保底命中後 guaranteedUp 重置', s2.pity.limited.guaranteedUp === false);
})();

// ================= 卡池名單隔離(限定專屬角色) =================
console.log('=== 卡池名單隔離 ===');
(function () {
    const stdPools = G.bannerPool(G.getBanner('standard'));
    check('常駐池不含限定專屬角色(yuki/lilith 被排除)', !stdPools.SSR.some(c => c.limitedOnly) && stdPools.SSR.length === 2, JSON.stringify(stdPools.SSR.map(c => c.id)));
    check('常駐池 SSR 名單 = 艾瑪 + 王牌指揮官', stdPools.SSR.map(c => c.id).sort().join(',') === 'ace,emma');
    check('lilith 限定池包含自家 UP 角色', G.bannerPool(G.getBanner('lilith')).SSR.some(c => c.id === 'lilith'));
    check('yuki 限定池包含自家 UP 角色', G.bannerPool(G.getBanner('yuki')).SSR.some(c => c.id === 'yuki'));
    check('限定池同時含常駐 SSR(歪的時候抽到)', G.bannerPool(G.getBanner('emma')).SSR.some(c => c.id === 'ace'));
})();

// ================= 重複角色 → 轉星輝 =================
console.log('=== 重複角色轉星輝 ===');
(function () {
    const s = newState();
    G.addDiamonds(s, 100, 'test');
    G.getBalance(s); s.pity.standard.ssrCount = 59;
    const d1 = G.pullBanner(s, 'standard', 1, () => 0.999);
    check('首次獲得 SSR → 新角色(無轉換)', d1.ok && d1.results[0].isNew === true && d1.results[0].dust === 0);
    s.pity.standard.ssrCount = 59;
    const d2 = G.pullBanner(s, 'standard', 1, () => 0.999); // 同 rand → 同角色 → 重複
    check('重複角色 → 自動轉換 5 顆星輝', d2.ok && d2.results[0].isNew === false && d2.results[0].dust === 5);
    check('轉換後餘額 = 前值 - 10 + 5', d2.balance === d1.balance - 10 + 5, String(d2.balance));
    check('倉庫該角色 count 累計為 2', s.warehouse.find(w => w.id === d1.results[0].char.id).count === 2);
    check('重複轉換寫入日誌(dust=5)', s.logs.some(l => l.type === 'gacha_pull' && l.dust === 5));
})();

// ================= 召喚券(道具)消耗 =================
console.log('=== 召喚券消耗 ===');
(function () {
    const s = newState();
    G.addDiamonds(s, 100, 'test');
    G.addTickets(s, 3, 'test');
    const plan = G.planCost(s, 10);
    check('消耗試算:十連 = 3 券 + 70 星輝', plan.ticketsUsed === 3 && plan.xinghuiCost === 70 && plan.affordable === true, JSON.stringify(plan));
    const t1 = G.pullBanner(s, 'standard', 10, () => 0.5);
    check('十連扣 3 券 + 70 星輝(券優先抵扣,重複轉換另計)', t1.ok && t1.ticketsUsed === 3 && t1.xinghuiCost === 70 && s.tickets === 0 && s.diamond === 30 + (t1.dustGained || 0), JSON.stringify({ diamond: s.diamond, dust: t1.dustGained }));
    check('十連回傳 10 筆結果', t1.ok && t1.results.length === 10);
    check('十連重複角色轉換統計(8 重複 × 5 = 40 星輝)', t1.dustGained === 40, String(t1.dustGained));
    const s5 = newState();
    G.addTickets(s5, 5, 'gift');
    const t2 = G.pullBanner(s5, 'standard', 1, () => 0.5);
    check('無星輝也可用召喚券抽卡(不扣餘額)', t2.ok && t2.ticketsUsed === 1 && t2.xinghuiCost === 0 && s5.diamond === 0 && s5.tickets === 4);
})();

// ================= 卡池輪換 =================
console.log('=== 卡池輪換 ===');
(function () {
    const DAY = 86400000, P = 14 * DAY;
    check('輪換 t=0 → yuki 池', G.activeLimitedBanner(0).id === 'yuki');
    check('輪換 t=14天+1ms → lilith 池', G.activeLimitedBanner(P + 1).id === 'lilith');
    check('輪換 t=28天 → emma 池', G.activeLimitedBanner(2 * P).id === 'emma');
    check('輪換 t=42天 → 循環回 yuki 池', G.activeLimitedBanner(3 * P).id === 'yuki');
    check('輪換剩餘時間計算正確', G.rotationRemainMs(5000) === P - 5000, String(G.rotationRemainMs(5000)));
})();

// ================= 舊倉庫格式遷移 =================
(function () {
    const s = { diamond: 5, warehouse: [{ id: 'ace', name: '王牌指揮官', rarity: 'SSR', gainedAt: 123 }], logs: [] };
    G.getBalance(s); // 觸發 normalize
    const w = s.warehouse[0];
    check('舊倉庫遷移:count=1、firstGainedAt=原 gainedAt、舊欄位移除', w.count === 1 && w.firstGainedAt === 123 && w.gainedAt === undefined);
})();

console.log('');
console.log('結果:' + passed + ' 通過 / ' + failed + ' 失敗');
process.exit(failed > 0 ? 1 : 0);
