// gacha.js — 星輝(Xinghui)資源系統 + 角色召喚（卡池 v2）
// 貨幣命名採原神/崩鐵風格:「星輝」。
// v2 新增:常駐/限定卡池輪換、稀有度分層機率、單抽/十連、SSR 硬保底 + 十連 SR 保底、
//         限定 UP 大保底、召喚券道具消耗、重複角色轉星輝。
// 架構:純邏輯模組;狀態由呼叫端傳入 state = {diamond, tickets, warehouse, logs, pity}。
// 環境:瀏覽器(window.GachaSystem)與 Node(tests)皆可執行;需先載入 characters_data.js。
(function (global) {
    'use strict';

    var DAY_MS = 86400000;

    // ===== 卡池配置(獨立可調,營運改這裡即可)=====
    var GACHA_CONFIG = {
        costPerPull: 10,          // 單抽消耗星輝
        bossKillReward: 10,       // Boss 擊殺掉落星輝
        dupeToDust: 5,            // 重複角色轉換星輝
        starterTickets: 5,        // 首次初始化贈送召喚券
        maxLogEntries: 150,       // 日誌保留上限(供後續查核)
        // 常駐卡池
        standard: { id: 'standard', kind: 'standard', rates: { N: 60, R: 30, SR: 9, SSR: 1 }, pitySR: 10, pitySSR: 60 },
        // 限定卡池(依時間輪換,UP 角色出現率 50%,歪了下次 SSR 必中 UP)
        limitedBanners: [
            { id: 'yuki',   kind: 'limited', rates: { N: 60, R: 30, SR: 9, SSR: 1 }, pitySR: 10, pitySSR: 60, up: 'yuki' },
            { id: 'lilith', kind: 'limited', rates: { N: 60, R: 30, SR: 9, SSR: 1 }, pitySR: 10, pitySSR: 60, up: 'lilith' },
            { id: 'emma',   kind: 'limited', rates: { N: 60, R: 30, SR: 9, SSR: 1 }, pitySR: 10, pitySSR: 60, up: 'emma' }
        ],
        rotationPeriodDays: 14,   // 限定池輪換週期
        rotationEpochMs: 0
    };

    function charDB() {
        return global.CHARACTERS || null;
    }

    // ===== 狀態規整與遷移 =====
    function normalize(state) {
        if (!state) state = {};
        if (typeof state.diamond !== 'number' || !isFinite(state.diamond)) state.diamond = 0;
        if (typeof state.tickets !== 'number' || !isFinite(state.tickets)) state.tickets = 0;
        if (!Array.isArray(state.warehouse)) state.warehouse = [];
        // 舊版倉庫遷移:{id,name,rarity,gainedAt} → {id,name,rarity,count,firstGainedAt}
        for (var i = 0; i < state.warehouse.length; i++) {
            var w = state.warehouse[i];
            if (typeof w.count !== 'number') w.count = 1;
            if (w.firstGainedAt === undefined) w.firstGainedAt = w.gainedAt || Date.now();
            delete w.gainedAt;
        }
        if (!Array.isArray(state.logs)) state.logs = [];
        if (!state.pity) state.pity = {};
        ['standard', 'limited'].forEach(function (k) {
            var p = state.pity[k];
            if (!p) p = state.pity[k] = {};
            if (typeof p.ssrCount !== 'number') p.ssrCount = 0;
            if (typeof p.srCount !== 'number') p.srCount = 0;
            if (typeof p.guaranteedUp !== 'boolean') p.guaranteedUp = false;
        });
        return state;
    }

    function pushLog(state, entry) {
        state.logs.push(entry);
        if (state.logs.length > GACHA_CONFIG.maxLogEntries) {
            state.logs = state.logs.slice(-GACHA_CONFIG.maxLogEntries);
        }
    }

    // ===== 星輝餘額操作(v1 相容)=====
    function getBalance(state) { normalize(state); return state.diamond | 0; }
    function getTickets(state) { normalize(state); return state.tickets | 0; }

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

    function addTickets(state, n, reason) {
        normalize(state);
        if (typeof n !== 'number' || !isFinite(n) || n <= 0) {
            return { ok: false, error: 'invalid_amount', tickets: state.tickets };
        }
        state.tickets += Math.floor(n);
        pushLog(state, { time: Date.now(), type: 'ticket_gain', amount: Math.floor(n), reason: reason || 'unknown' });
        return { ok: true, tickets: state.tickets };
    }

    function grantBossReward(state, bossName) {
        var r = addDiamonds(state, GACHA_CONFIG.bossKillReward, 'boss_kill:' + (bossName || 'BOSS'));
        if (r.ok) r.reward = GACHA_CONFIG.bossKillReward;
        return r;
    }

    // ===== 卡池架構 =====
    function activeLimitedBanner(now) {
        var t = (typeof now === 'number') ? now : Date.now();
        var period = GACHA_CONFIG.rotationPeriodDays * DAY_MS;
        var idx = Math.floor((t - GACHA_CONFIG.rotationEpochMs) / period) % GACHA_CONFIG.limitedBanners.length;
        if (idx < 0) idx += GACHA_CONFIG.limitedBanners.length;
        return GACHA_CONFIG.limitedBanners[idx];
    }

    function getBanner(id, now) {
        if (id === 'standard') return GACHA_CONFIG.standard;
        if (id === 'limited') return activeLimitedBanner(now);
        var b = GACHA_CONFIG.limitedBanners.filter(function (x) { return x.id === id; })[0];
        return b || GACHA_CONFIG.standard;
    }

    function rotationRemainMs(now) {
        var t = (typeof now === 'number') ? now : Date.now();
        var period = GACHA_CONFIG.rotationPeriodDays * DAY_MS;
        return period - ((t - GACHA_CONFIG.rotationEpochMs) % period);
    }

    // 依卡池組出各稀有度可抽名單(限定專屬角色只在自家 UP 池出現)
    function bannerPool(banner) {
        var db = charDB();
        if (!db) return null;
        var up = banner.up;
        var pools = { N: [], R: [], SR: [], SSR: [] };
        db.forEach(function (c) {
            if (c.limitedOnly && c.id !== up) return;
            if (pools[c.rarity]) pools[c.rarity].push(c);
        });
        return pools;
    }

    function validateConfig() {
        var banners = [GACHA_CONFIG.standard].concat(GACHA_CONFIG.limitedBanners);
        if (!charDB()) return { ok: false, error: 'no_char_db' };
        if (GACHA_CONFIG.costPerPull <= 0) return { ok: false, error: 'bad_cost' };
        for (var i = 0; i < banners.length; i++) {
            var b = banners[i], keys = Object.keys(b.rates), sum = 0, k;
            for (var j = 0; j < keys.length; j++) {
                k = keys[j];
                if (typeof b.rates[k] !== 'number' || b.rates[k] < 0) return { ok: false, error: 'bad_rate:' + b.id + ':' + k };
                sum += b.rates[k];
            }
            if (sum !== 100) return { ok: false, error: 'rates_sum_' + sum + ':' + b.id };
            var pools = bannerPool(b);
            for (var t = 0; t < keys.length; t++) {
                if (!pools[keys[t]] || !pools[keys[t]].length) return { ok: false, error: 'empty_pool:' + b.id + ':' + keys[t] };
            }
            if (!(b.pitySSR > 0) || !(b.pitySR > 0)) return { ok: false, error: 'bad_pity:' + b.id };
        }
        return { ok: true };
    }

    // ===== 抽取核心 =====
    function rollRarity(rand, bannerId) {
        var b = getBanner(bannerId || 'standard');
        var fn = (typeof rand === 'function') ? rand : Math.random;
        var keys = Object.keys(b.rates);
        var r = fn() * 100;
        for (var i = 0; i < keys.length; i++) {
            r -= b.rates[keys[i]];
            if (r <= 0) return keys[i];
        }
        return keys[keys.length - 1];
    }

    function pickCharacter(rarity, rand, banner) {
        var pools = bannerPool(banner || GACHA_CONFIG.standard);
        if (!pools || !pools[rarity] || !pools[rarity].length) return null;
        var fn = (typeof rand === 'function') ? rand : Math.random;
        return pools[rarity][Math.floor(fn() * pools[rarity].length)];
    }

    // 單次抽取(含雙重保底與 UP 判定);發放重複角色 → 轉星輝
    function drawOne(state, banner, rand, isUpRand) {
        var pityKey = banner.kind === 'limited' ? 'limited' : 'standard';
        var pity = state.pity[pityKey];
        var pools = bannerPool(banner);
        var randFn = (typeof rand === 'function') ? rand : Math.random;
        var upRand = (typeof isUpRand === 'function') ? isUpRand : Math.random;

        var rarity, forcedSsr = false, forcedSr = false;
        pity.ssrCount++;
        if (pity.ssrCount >= banner.pitySSR) {
            rarity = 'SSR'; forcedSsr = true;                                   // SSR 硬保底
        } else {
            rarity = rollRarity(randFn, banner.id);
        }
        if (rarity === 'SSR') {
            pity.ssrCount = 0;
        } else if (rarity === 'SR') {
            pity.srCount = 0;
        } else {
            pity.srCount++;
            if (pity.srCount >= banner.pitySR) { rarity = 'SR'; forcedSr = true; pity.srCount = 0; } // 每 10 抽保底 SR+
        }

        var char, gotUp = false;
        if (rarity === 'SSR' && banner.kind === 'limited' && banner.up) {
            if (pity.guaranteedUp || upRand() < 0.5) {                          // UP 大保底 / 50% 命中
                char = pools.SSR.filter(function (c) { return c.id === banner.up; })[0] || null;
                gotUp = !!char;
                pity.guaranteedUp = false;
            } else {
                var others = pools.SSR.filter(function (c) { return c.id !== banner.up; });
                char = others[Math.floor(randFn() * others.length)] || null;
                pity.guaranteedUp = true;                                       // 歪了 → 下次 SSR 必中 UP
            }
        } else {
            var tier = pools[rarity];
            char = tier[Math.floor(randFn() * tier.length)];
        }
        if (!char) throw new Error('draw_failed:' + rarity);

        // 發放(重複 → 轉星輝)
        var isNew = true, dust = 0, i;
        for (i = 0; i < state.warehouse.length; i++) {
            if (state.warehouse[i].id === char.id) { isNew = false; break; }
        }
        if (isNew) {
            state.warehouse.push({ id: char.id, name: char.name, rarity: char.rarity, count: 1, firstGainedAt: Date.now() });
        } else {
            for (i = 0; i < state.warehouse.length; i++) {
                if (state.warehouse[i].id === char.id) {
                    state.warehouse[i].count++;
                    dust = GACHA_CONFIG.dupeToDust;
                    state.diamond += dust;
                    break;
                }
            }
        }
        pushLog(state, {
            time: Date.now(), type: 'gacha_pull', amount: 0,
            bannerId: banner.id, charId: char.id, charName: char.name, rarity: char.rarity,
            isNew: isNew, dust: dust, up: gotUp
        });
        return { char: char, rarity: char.rarity, isNew: isNew, dust: dust, forcedSsr: forcedSsr, forcedSr: forcedSr, up: gotUp };
    }

    // 消耗試算:召喚券優先,不足以星輝補足
    function planCost(state, pulls) {
        normalize(state);
        var ticketsUsed = Math.min(state.tickets | 0, pulls);
        var xinghuiCost = (pulls - ticketsUsed) * GACHA_CONFIG.costPerPull;
        return { ticketsUsed: ticketsUsed, xinghuiCost: xinghuiCost, affordable: state.diamond >= xinghuiCost };
    }

    // 原子性批量抽卡(單抽 = 1、十連 = 10;任何異常回滾快照)
    function pullBanner(state, bannerId, pulls, rand, isUpRand) {
        normalize(state);
        var n = (typeof pulls === 'number' && pulls > 0) ? Math.floor(pulls) : 1;
        var banner = getBanner(bannerId);
        var plan = planCost(state, n);
        if (!plan.affordable) {
            return { ok: false, error: 'insufficient', needed: plan.xinghuiCost, ticketsUsed: plan.ticketsUsed, balance: state.diamond, tickets: state.tickets };
        }
        var snapshot = JSON.stringify({
            diamond: state.diamond, tickets: state.tickets, warehouse: state.warehouse, logs: state.logs, pity: state.pity
        });
        try {
            // 1) 扣除(召喚券優先 + 星輝補足)
            state.tickets -= plan.ticketsUsed;
            if (plan.xinghuiCost > 0) state.diamond -= plan.xinghuiCost;
            pushLog(state, {
                time: Date.now(), type: 'spend', amount: -plan.xinghuiCost, ticketsUsed: plan.ticketsUsed,
                reason: 'gacha_pull', bannerId: banner.id, pulls: n
            });
            // 2) 逐次抽取
            var results = [];
            for (var i = 0; i < n; i++) results.push(drawOne(state, banner, rand, isUpRand));
            // 3) 十連保底:全部皆 N → 最後一發強化為 SR
            if (n === 10 && !results.some(function (r) { return r.rarity === 'SR' || r.rarity === 'SSR'; })) {
                var srPool = bannerPool(banner).SR;
                var pickFn = (typeof rand === 'function') ? rand : Math.random;
                var forcedChar = srPool[Math.floor(pickFn() * srPool.length)];
                var last = results[n - 1];
                // 還原最後一發的倉庫影響,改發 SR
                for (var w = 0; w < state.warehouse.length; w++) {
                    if (state.warehouse[w].id === last.char.id) {
                        if (state.warehouse[w].count > 1) {
                            state.warehouse[w].count--;
                            if (last.dust) state.diamond -= last.dust;
                        } else {
                            state.warehouse.splice(w, 1);
                        }
                        break;
                    }
                }
                var isNew2 = !state.warehouse.some(function (e) { return e.id === forcedChar.id; });
                var dust2 = 0;
                if (isNew2) {
                    state.warehouse.push({ id: forcedChar.id, name: forcedChar.name, rarity: forcedChar.rarity, count: 1, firstGainedAt: Date.now() });
                } else {
                    for (var w2 = 0; w2 < state.warehouse.length; w2++) {
                        if (state.warehouse[w2].id === forcedChar.id) {
                            state.warehouse[w2].count++;
                            dust2 = GACHA_CONFIG.dupeToDust;
                            state.diamond += dust2;
                            break;
                        }
                    }
                }
                state.pity[banner.kind === 'limited' ? 'limited' : 'standard'].srCount = 0;
                results[n - 1] = { char: forcedChar, rarity: forcedChar.rarity, isNew: isNew2, dust: dust2, forcedSsr: false, forcedSr: true, up: false };
            }
            var dustGained = results.reduce(function (s, r) { return s + (r.dust || 0); }, 0);
            return {
                ok: true, bannerId: banner.id, results: results,
                balance: state.diamond, tickets: state.tickets,
                ticketsUsed: plan.ticketsUsed, xinghuiCost: plan.xinghuiCost, dustGained: dustGained,
                pity: { standard: state.pity.standard, limited: state.pity.limited }
            };
        } catch (e) {
            // 原子性保障:任何異常 → 還原快照(扣款未發放/發放未扣款皆不會發生)
            var restored = JSON.parse(snapshot);
            state.diamond = restored.diamond;
            state.tickets = restored.tickets;
            state.warehouse = restored.warehouse;
            state.logs = restored.logs;
            state.pity = restored.pity;
            return { ok: false, error: 'internal', detail: String(e), balance: state.diamond, tickets: state.tickets };
        }
    }

    // v1 相容:單抽(常駐池)
    function tryPull(state, rand) {
        var r = pullBanner(state, 'standard', 1, rand);
        if (!r.ok) return { ok: false, error: r.error, balance: r.balance, needed: r.needed };
        var d = r.results[0];
        return { ok: true, character: d.char, rarity: d.rarity, balance: r.balance, gained: d.char, isNew: d.isNew, dust: d.dust };
    }

    // 十連(bannerId = 'standard' | 'limited')
    function pullTen(state, bannerId, rand, isUpRand) {
        return pullBanner(state, bannerId, 10, rand, isUpRand);
    }

    var GachaSystem = {
        GACHA_CONFIG: GACHA_CONFIG,
        validateConfig: validateConfig,
        getBalance: getBalance,
        getTickets: getTickets,
        addDiamonds: addDiamonds,
        spendDiamonds: spendDiamonds,
        addTickets: addTickets,
        grantBossReward: grantBossReward,
        activeLimitedBanner: activeLimitedBanner,
        getBanner: getBanner,
        rotationRemainMs: rotationRemainMs,
        bannerPool: bannerPool,
        rollRarity: rollRarity,
        pickCharacter: pickCharacter,
        drawOne: drawOne,
        planCost: planCost,
        pullBanner: pullBanner,
        tryPull: tryPull,
        pullTen: pullTen
    };

    global.GachaSystem = GachaSystem;
    if (typeof module !== 'undefined' && module.exports) module.exports = GachaSystem;
})(typeof window !== 'undefined' ? window : globalThis);
