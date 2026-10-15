// characters_data.js — 角色資料庫 + 程序化像素立繪產生器
// 含 9 位同人二創角色（致敬《魔法少女的魔女審判》與《不/存在的你，和我》）+ 8 位戰術部隊角色，共 17 位。
// 二創角色之背景故事為原創改編，僅致敬原作世界觀與人物氣質，尊重原作 IP。
(function (global) {
    'use strict';

    // ===== 角色資料庫 =====
    // rarity: N/R/SR/SSR；limitedOnly: 僅能透過限定卡池取得
    // palette: 立繪配色（髮/眼/衣/靴/膚）；hairStyle: long|twin|short|bun
    var CHARS = [
        // ---------- 同人二創：《魔法少女的魔女審判》（Manosaba） ----------
        {
            id: 'emma', name: '樱羽艾玛', rarity: 'SSR', source: 'manosaba', limitedOnly: false,
            stats: { hp: 90, atk: 14, def: 8, spd: 105 },
            skill: { name: '魔女殺手', desc: '對 Boss 與精英敵人造成 +25% 傷害。' },
            story: '憎恨被討厭的少女。在孤島的審判中倖存後，她把「想喜歡他人」的天賦化為守護之力——被她認定為夥伴的人，永遠不會被拋下。',
            tagline: '想要被喜歡，有什麼不對嗎？',
            palette: { hair: '#f2a7c3', hairDark: '#c77b9e', eye: '#3fae7a', outfit: '#8a5cd6', outfitDark: '#5e3e96', boots: '#3d3552', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'hiro', name: '二阶堂希罗', rarity: 'SR', source: 'manosaba', limitedOnly: false,
            stats: { hp: 95, atk: 12, def: 10, spd: 100 },
            skill: { name: '死亡回溯', desc: '每場戰鬥首次陣亡時，回溯並復活一次（保留 30% HP）。' },
            story: '正義感過剩的優等生。她把「正確與否」當成唯一準尺，卻在審判中學會：真正的正義，是願意為錯判的人低頭道歉。',
            tagline: '不正確的事物，絕不容許。',
            palette: { hair: '#7a3b3b', hairDark: '#572a2a', eye: '#d44a4a', outfit: '#3d3a52', outfitDark: '#2a2839', boots: '#4a4258', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'shelly', name: '橘雪莉', rarity: 'SR', source: 'manosaba', limitedOnly: false,
            stats: { hp: 85, atk: 16, def: 7, spd: 110 },
            skill: { name: '怪力衝擊', desc: '近距離命中時放出衝擊波，擊退範圍內敵人。' },
            story: '自稱名偵探的藍髮少女，單手就能捏碎蘋果。她撲向一切有趣的事，毫無道德觀念——但她的直覺，比任何證據都先一步指向真相。',
            tagline: '推理的答案？早就知道啦！',
            palette: { hair: '#87aad9', hairDark: '#5f7fae', eye: '#182c4f', outfit: '#4069aa', outfitDark: '#2c4a80', boots: '#927393', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'meruru', name: '冰上梅露露', rarity: 'R', source: 'manosaba', limitedOnly: false,
            stats: { hp: 80, atk: 9, def: 9, spd: 95 },
            skill: { name: '治癒之淚', desc: '每波開始時修復 15% 最大 HP。' },
            story: '膽小、愛哭、總是躲在暗處觀察別人的少女。但她的溫柔是真的——連敵人的傷，她都想治癒。',
            tagline: '嗚……大家、不要吵架……',
            palette: { hair: '#bfe3f2', hairDark: '#8fb8cf', eye: '#4a90d9', outfit: '#dcdcf5', outfitDark: '#aaaad0', boots: '#8f9fc0', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'yuki', name: '月代雪', rarity: 'SSR', source: 'manosaba', limitedOnly: true,
            stats: { hp: 92, atk: 15, def: 9, spd: 100 },
            skill: { name: '雪之魔女的寬恕', desc: '命中時 15% 機率凍結敵人 2 秒。' },
            story: '最後的雪之魔女。曾被全世界辜負的她選擇了復仇，又被一句真誠的話留了下來。如今她把凍結時間的力量，用來為夥伴爭取一線生機。',
            tagline: '這一次……我想守護，而不是毀滅。',
            palette: { hair: '#e8eef5', hairDark: '#b9c6d8', eye: '#6f9fd8', outfit: '#2b3a55', outfitDark: '#1d2940', boots: '#4a5570', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'hanna', name: '远野汉娜', rarity: 'R', source: 'manosaba', limitedOnly: false,
            stats: { hp: 82, atk: 10, def: 8, spd: 118 },
            skill: { name: '漂浮', desc: '移動速度 +12%，閃避判定提升。' },
            story: '宛如大小姐的華麗少女，能讓身體輕輕飄浮。她把飄浮當作私密的自由——在地上束縛越多的人，越懂得往天上逃。',
            tagline: '來，帶你飛一次？',
            palette: { hair: '#e3c98f', hairDark: '#b89e66', eye: '#7a5a3a', outfit: '#6a4a7a', outfitDark: '#4e3560', boots: '#8f7a9e', skin: '#f9d1d0' },
            hairStyle: 'twin'
        },
        // ---------- 同人二創：《不/存在的你，和我》（NOexistenceN） ----------
        {
            id: 'lilith', name: '莉莉丝', rarity: 'SSR', source: 'noexist', limitedOnly: true,
            stats: { hp: 88, atk: 14, def: 8, spd: 108 },
            skill: { name: '存在的否定', desc: '受到致命一擊時 25% 機率「取消其存在」，完全無效化。' },
            story: '白髮赤瞳、拒絕被標籤定義的少女。她誕生於某個人的孤獨，卻比任何人都篤定地存在著——存在與否，從來由自己定義。',
            tagline: '存在，由我們自己定義。',
            palette: { hair: '#f2f0f5', hairDark: '#c5c0cf', eye: '#d93a3a', outfit: '#3a2b4a', outfitDark: '#2a2038', boots: '#5a4a70', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'charlotte', name: '夏特露酱', rarity: 'R', source: 'noexist', limitedOnly: false,
            stats: { hp: 78, atk: 10, def: 7, spd: 102 },
            skill: { name: '曼德拉草研究', desc: '掉落物拾取範圍 +40%。' },
            story: '個子小小、面帶微笑的曼德拉草研究員，一邊撰寫美少女遊戲劇本。她相信：只要好好寫下故事，被寫下的人就不會消失。',
            tagline: '下一段劇情，就從這裡開始！',
            palette: { hair: '#c9a06a', hairDark: '#a37e4e', eye: '#5a8a4a', outfit: '#7a9a5a', outfitDark: '#5a7342', boots: '#8f8a6a', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'fuko', name: '弗子酱', rarity: 'SR', source: 'noexist', limitedOnly: false,
            stats: { hp: 84, atk: 13, def: 8, spd: 112 },
            skill: { name: '音遊節奏', desc: '連續命中時射速提升，最高 +20%。' },
            story: '高挑沉默的音遊高手與鍵盤手。她的話不多，但指尖的節奏比任何言語都誠實——↑↑↓↓←→←→BA！',
            tagline: '（沉默地比出勝利手勢）',
            palette: { hair: '#4a4a5f', hairDark: '#33334a', eye: '#9a6adf', outfit: '#35455f', outfitDark: '#25314a', boots: '#5a5a7a', skin: '#f9d1d0' },
            hairStyle: 'bun'
        },
        // ---------- 戰術部隊（本作原創） ----------
        {
            id: 'recruit', name: '新兵', rarity: 'N', source: 'tactical', limitedOnly: false,
            stats: { hp: 75, atk: 8, def: 6, spd: 100 },
            skill: { name: '基礎訓練', desc: '經驗獲取 +5%。' },
            story: '剛下部隊的年輕士兵。沒有什麼特別之處，但每多活一場，就多一分沉穩。',
            tagline: '報告！請多指教！',
            palette: { hair: '#6a7a5f', hairDark: '#4d5a45', eye: '#3a4a35', outfit: '#5a6a4a', outfitDark: '#42503a', boots: '#3a4032', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'scout', name: '斥候', rarity: 'N', source: 'tactical', limitedOnly: false,
            stats: { hp: 72, atk: 9, def: 5, spd: 115 },
            skill: { name: '前線偵察', desc: '視野內敵人被標記，+5% 對標記目標傷害。' },
            story: '走在隊伍最前面的人。她看過最多敵人，也最早學會把恐懼留給身後。',
            tagline: '前面有動靜，跟緊我。',
            palette: { hair: '#8f7a4a', hairDark: '#6d5c38', eye: '#4a3a2a', outfit: '#4a5a3a', outfitDark: '#37452c', boots: '#3a3a2c', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'medic', name: '醫療兵', rarity: 'N', source: 'tactical', limitedOnly: false,
            stats: { hp: 78, atk: 7, def: 7, spd: 98 },
            skill: { name: '戰地急救', desc: '每 30 秒自動回復 3% 最大 HP。' },
            story: '背包裡永遠多帶一份繃帶的人。她救不了所有人，但她沒停止嘗試。',
            tagline: '別動，馬上幫你包紮！',
            palette: { hair: '#a86a6a', hairDark: '#7e4f4f', eye: '#5a3a3a', outfit: '#4a5a6a', outfitDark: '#374552', boots: '#3a404a', skin: '#f9d1d0' },
            hairStyle: 'bun'
        },
        {
            id: 'gunner', name: '機槍手', rarity: 'R', source: 'tactical', limitedOnly: false,
            stats: { hp: 85, atk: 12, def: 8, spd: 92 },
            skill: { name: '彈鏈供給', desc: '射速 +8%。' },
            story: '壓制火力就是她的語言。當她的機槍開口，全場都會安靜下來。',
            tagline: '彈藥充足，掩護我！',
            palette: { hair: '#5a6a7a', hairDark: '#42505c', eye: '#2a3a4a', outfit: '#3a4a5a', outfitDark: '#2c3945', boots: '#323a42', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'engineer', name: '工兵', rarity: 'R', source: 'tactical', limitedOnly: false,
            stats: { hp: 82, atk: 10, def: 10, spd: 96 },
            skill: { name: '槍械保養', desc: '傷害 +6%。' },
            story: '能修好任何東西的雙手。對她來說，保養槍枝和保養隊友的心情是同一件事。',
            tagline: '喀啦、喀啦——好了，如新！',
            palette: { hair: '#7a6a4a', hairDark: '#5c4f38', eye: '#4a3a2a', outfit: '#5a4a3a', outfitDark: '#42382c', boots: '#3a332a', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'sniper', name: '狙擊手', rarity: 'SR', source: 'tactical', limitedOnly: false,
            stats: { hp: 76, atk: 15, def: 6, spd: 100 },
            skill: { name: '精準射擊', desc: '暴擊率 +10%。' },
            story: '在三百公尺外解決問題的人。她的世界很安靜，安靜得只剩下準星與呼吸。',
            tagline: '風速 3，距離 240——命中。',
            palette: { hair: '#4a5a4a', hairDark: '#374537', eye: '#2a3a2a', outfit: '#354535', outfitDark: '#283528', boots: '#2c332c', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'vanguard', name: '先鋒', rarity: 'SR', source: 'tactical', limitedOnly: false,
            stats: { hp: 94, atk: 11, def: 9, spd: 112 },
            skill: { name: '戰術突進', desc: '移動速度 +8%，衝撞傷害 +15%。' },
            story: '第一個衝進戰場的人。不是不怕死——是知道猶豫比子彈更致命。',
            tagline: '跟上！別掉隊！',
            palette: { hair: '#8a4a4a', hairDark: '#6a3737', eye: '#3a2a2a', outfit: '#5a3535', outfitDark: '#452a2a', boots: '#3a2c2c', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'ace', name: '王牌指揮官', rarity: 'SSR', source: 'tactical', limitedOnly: false,
            stats: { hp: 96, atk: 15, def: 10, spd: 106 },
            skill: { name: '戰場直覺', desc: '全屬性 +5%。' },
            story: '打過每一場沒人記得的戰役。軍功章塞滿抽屜，但她只記得帶回來多少名字。',
            tagline: '聽我口令，全體——反擊！',
            palette: { hair: '#c9b45f', hairDark: '#968b45', eye: '#4a3a1a', outfit: '#2a3a5a', outfitDark: '#1e2c45', boots: '#3a3a4a', skin: '#f9d1d0' },
            hairStyle: 'long'
        }
    ];

    var BY_ID = {};
    CHARS.forEach(function (c) { BY_ID[c.id] = c; });

    // ===== 程序化像素立繪產生器（32x40，依角色配色/髮型變化）=====
    var FW = 32, FH = 40;
    var portraitCache = {};

    function px(c, x, y, w, h, color) {
        c.fillStyle = color;
        c.fillRect(x, y, w, h);
    }

    function drawPortrait(c, ch) {
        var P = ch.palette, dir = 0; // 正面
        var cx = 16, top = 4;
        c.clearRect(0, 0, FW, FH);
        // 影子
        c.globalAlpha = 0.25; px(c, 8, 36, 16, 3, '#000'); c.globalAlpha = 1;
        // 髮後層（依髮型）
        var hx = cx - 7;
        if (ch.hairStyle === 'long') {
            px(c, hx - 1, top + 2, 3, 15, P.hairDark);
            px(c, hx + 12, top + 2, 3, 15, P.hairDark);
        } else if (ch.hairStyle === 'twin') {
            px(c, hx - 1, top + 2, 3, 8, P.hairDark);
            px(c, hx + 12, top + 2, 3, 8, P.hairDark);
            px(c, hx - 3, top + 9, 4, 9, P.hair);      // 雙馬尾
            px(c, hx + 13, top + 9, 4, 9, P.hair);
        } else if (ch.hairStyle === 'bun') {
            px(c, hx - 1, top + 2, 3, 10, P.hairDark);
            px(c, hx + 12, top + 2, 3, 10, P.hairDark);
            px(c, hx + 4, top - 5, 6, 5, P.hair);     // 髮髻
        } else { // short
            px(c, hx, top + 1, 14, 11, P.hairDark);
        }
        // 臉
        px(c, hx, top, 14, 12, P.skin);
        px(c, hx, top + 10, 14, 2, '#e4b3b3');
        // 瀏海
        px(c, hx - 1, top - 2, 16, 4, P.hair);
        px(c, hx - 1, top + 2, 16, 2, P.hair);
        // 眼睛
        var ey = top + 5;
        px(c, hx + 3, ey, 2, 3, P.eye);
        px(c, hx + 9, ey, 2, 3, P.eye);
        px(c, hx + 3, ey - 1, 2, 1, '#fff');
        px(c, hx + 9, ey - 1, 2, 1, '#fff');
        // 腮紅
        c.globalAlpha = 0.5;
        px(c, hx + 2, top + 8, 2, 1, '#f2a9a9');
        px(c, hx + 10, top + 8, 2, 1, '#f2a9a9');
        c.globalAlpha = 1;
        // 身體
        var by = top + 12;
        px(c, cx - 6, by, 12, 9, P.outfit);
        px(c, cx - 6, by + 7, 12, 2, P.outfitDark);
        px(c, cx - 2, by, 4, 2, '#fff');              // 白色衣領
        // 手臂
        px(c, cx - 8, by + 1, 3, 7, P.outfit);
        px(c, cx + 5, by + 1, 3, 7, P.outfit);
        px(c, cx - 8, by + 7, 3, 2, P.skin);
        px(c, cx + 5, by + 7, 3, 2, P.skin);
        // 腿
        var ly = by + 9;
        px(c, cx - 5, ly, 4, 6, P.boots);
        px(c, cx + 1, ly, 4, 6, P.boots);
        // 描邊重點
        c.globalAlpha = 0.35;
        px(c, cx - 6, by - 1, 12, 1, '#182c4f');
        px(c, hx - 1, top - 3, 16, 1, '#182c4f');
        c.globalAlpha = 1;
    }

    function getPortrait(id) {
        if (portraitCache[id]) return portraitCache[id];
        var ch = BY_ID[id];
        if (!ch) return null;
        var cv = document.createElement('canvas');
        cv.width = FW; cv.height = FH;
        drawPortrait(cv.getContext('2d'), ch);
        portraitCache[id] = cv;
        return cv;
    }

    function getPortraitDataURL(id, scale) {
        var cv = getPortrait(id);
        if (!cv) return '';
        var sc = scale || 2;
        if (sc === 1) return cv.toDataURL();
        var big = document.createElement('canvas');
        big.width = FW * sc; big.height = FH * sc;
        var c = big.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.drawImage(cv, 0, 0, FW * sc, FH * sc);
        return big.toDataURL();
    }

    global.CHARACTERS = CHARS;
    global.CHAR_BY_ID = BY_ID;
    global.GachaPortraits = { get: getPortrait, dataURL: getPortraitDataURL };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { CHARS: CHARS, BY_ID: BY_ID };
    }
})(typeof window !== 'undefined' ? window : globalThis);
