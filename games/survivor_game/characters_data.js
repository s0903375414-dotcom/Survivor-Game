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
            story: '在故鄉的小鎮上，她是最不受歡迎的孩子——被人討厭、被人排擠，連一句解釋的機會都沒有。直到那場孤島的審判，把她與一群同樣背負著「罪名」的少女困在一起。憎恨本可以輕易吞掉她，她卻在審判長桌的最後一夜發現：自己真正想要的，從來不是被原諒，而是去喜歡別人的勇氣。倖存之後，她把這份天賦磨成了守護之力——被艾瑪認定為夥伴的人，無論戰場多麼絕望，永遠不會被拋下。而踐踏他人之心的「魔女」，從來沒有在她的審判裡站著離開過。',
            tagline: '想要被喜歡，有什麼不對嗎？',
            palette: { hair: '#f2a7c3', hairDark: '#c77b9e', eye: '#3fae7a', outfit: '#8a5cd6', outfitDark: '#5e3e96', boots: '#3d3552', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'hiro', name: '二阶堂希罗', rarity: 'SR', source: 'manosaba', limitedOnly: false,
            stats: { hp: 95, atk: 12, def: 10, spd: 100 },
            skill: { name: '死亡回溯', desc: '每場戰鬥首次陣亡時，回溯並復活一次（保留 30% HP）。' },
            story: '成績第一、禮儀滿分、糾察隊臂章從不離身——希羅的人生是用「正確」砌出來的。她深信世界是一座法庭，凡事都該有判決。然而在孤島的審判中，她親眼看著自己引以為傲的「正確」壓垮了一個無辜的人。那一晚她第一次失眠，也是第一次道歉。如今她依然穿著整齊、腰背筆直，只是準尺換了：真正的正義，是先審判自己。據說她曾在墜落的前一秒，硬生生把時間倒轉了回去——沒有人知道真相，她只說「紀錄就是這樣寫的」。',
            tagline: '不正確的事物，絕不容許。',
            palette: { hair: '#7a3b3b', hairDark: '#572a2a', eye: '#d44a4a', outfit: '#3d3a52', outfitDark: '#2a2839', boots: '#4a4258', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'shelly', name: '橘雪莉', rarity: 'SR', source: 'manosaba', limitedOnly: false,
            stats: { hp: 85, atk: 16, def: 7, spd: 110 },
            skill: { name: '怪力衝擊', desc: '近距離命中時放出衝擊波，擊退範圍內敵人。' },
            story: '自稱「名偵探」，實際上推理環節永遠跳過、直接跳到「兇手就是你！」的藍髮少女。力氣大到單手捏碎蘋果，道德觀念則約等於零——偷看日記？她會一邊啃著順來的點心一邊告訴你這叫「調查」。但在孤島審判裡，當所有證據都指向同一個錯誤答案時，第一個喊出「不對勁」的也是她。她的直覺比任何邏輯都快，而她的怪力，剛好用來把直覺砸進現實。',
            tagline: '推理的答案？早就知道啦！',
            palette: { hair: '#87aad9', hairDark: '#5f7fae', eye: '#182c4f', outfit: '#4069aa', outfitDark: '#2c4a80', boots: '#927393', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'meruru', name: '冰上梅露露', rarity: 'R', source: 'manosaba', limitedOnly: false,
            stats: { hp: 80, atk: 9, def: 9, spd: 95 },
            skill: { name: '治癒之淚', desc: '每波開始時修復 15% 最大 HP。' },
            story: '眼淚很多、膽子很小、說話總是黏在一起。梅露露從小就習慣躲在角落——觀察別人的表情，比面對自己的情緒容易得多。孤島審判開始時，她是第一個哭出來的，也是最後一個放棄別人的。她偷偷記下每個人傷口的位置，趁沒有人看見的夜裡替大家換藥。連敵人的傷她都想治癒——因為她比誰都清楚，疼痛從來不會分辨立場。',
            tagline: '嗚……大家、不要吵架……',
            palette: { hair: '#bfe3f2', hairDark: '#8fb8cf', eye: '#4a90d9', outfit: '#dcdcf5', outfitDark: '#aaaad0', boots: '#8f9fc0', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'yuki', name: '月代雪', rarity: 'SSR', source: 'manosaba', limitedOnly: true,
            stats: { hp: 92, atk: 15, def: 9, spd: 100 },
            skill: { name: '雪之魔女的寬恕', desc: '命中時 15% 機率凍結敵人 2 秒。' },
            story: '雪之魔女一族最後的倖存者。世界先背叛了她——村落、法庭、乃至她曾深信的人，都把她的溫柔當成冰冷的罪證。於是她真的讓世界結了冰，讓所有傷害過她的人停在原地。直到有一個人不求饒、不辯解，只是對她說了一句真話。那句話花了很久才融化她，卻比任何火焰都有效。如今她仍會凍結時間——只是這一次，是為了替身後的夥伴擋下那一發子彈。',
            tagline: '這一次……我想守護，而不是毀滅。',
            palette: { hair: '#e8eef5', hairDark: '#b9c6d8', eye: '#6f9fd8', outfit: '#2b3a55', outfitDark: '#1d2940', boots: '#4a5570', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'hanna', name: '远野汉娜', rarity: 'R', source: 'manosaba', limitedOnly: false,
            stats: { hp: 82, atk: 10, def: 8, spd: 118 },
            skill: { name: '漂浮', desc: '移動速度 +12%，閃避判定提升。' },
            story: '豪宅、家教、鋼琴課、儀態訓練——漢娜的每一天都被安排到以分鐘計。唯一沒被安排的，是清晨醒來時發現自己浮在天花板下的那三秒鐘。飄浮是她的秘密，也是她僅有的自由：地上的規矩越多，天空的吸引力就越大。後來她索性把這份天賦練成了本領——「來，帶你飛一次？」她對每個願意抬頭看的人這麼說。',
            tagline: '來，帶你飛一次？',
            palette: { hair: '#e3c98f', hairDark: '#b89e66', eye: '#7a5a3a', outfit: '#6a4a7a', outfitDark: '#4e3560', boots: '#8f7a9e', skin: '#f9d1d0' },
            hairStyle: 'twin'
        },
        // ---------- 同人二創：《不/存在的你，和我》（NOexistenceN） ----------
        {
            id: 'lilith', name: '莉莉丝', rarity: 'SSR', source: 'noexist', limitedOnly: true,
            stats: { hp: 88, atk: 14, def: 8, spd: 108 },
            skill: { name: '存在的否定', desc: '受到致命一擊時 25% 機率「取消其存在」，完全無效化。' },
            story: '某個人在最孤獨的夜晚，於腦海深處描繪出的少女——白髮赤瞳，語氣篤定得不像一個「誕生不久」的存在。她不喜歡被標籤定義：「與其用辭彙框住我，不如用我們一起經歷的回憶來記得我。」她誕生於孤獨，卻比任何人都堅定地主張自己的存在；當世界說她不存在，她便笑著反問：「那麼，現在和你說話的又是誰呢？」致命一擊落在她身上時，有四分之一的機率，她會輕輕把那次攻擊「取消」——彷彿在說，存在與否，從來不由敵人定義。',
            tagline: '存在，由我們自己定義。',
            palette: { hair: '#f2f0f5', hairDark: '#c5c0cf', eye: '#d93a3a', outfit: '#3a2b4a', outfitDark: '#2a2038', boots: '#5a4a70', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'charlotte', name: '夏特露酱', rarity: 'R', source: 'noexist', limitedOnly: false,
            stats: { hp: 78, atk: 10, def: 7, spd: 102 },
            skill: { name: '曼德拉草研究', desc: '掉落物拾取範圍 +40%。' },
            story: '個子小小、永遠面帶微笑的研究員，主修曼德拉草——一種傳說中會因尖叫而奪走聽者性命的植物，她卻總能讓它們安安靜靜地開花。閒暇時她撰寫美少女遊戲劇本，字字斟酌。她有一個固執的信念：只要好好地把一個人寫進故事裡，那個人就永遠不會真正消失。所以她的劇本裡沒有路人，每個登場角色都有一段完整的過去——包括正在讀這段文字的你。順帶一提，戰場上任何被遺落的物資都逃不過她的眼睛，那是照顧植物練出來的觀察力。',
            tagline: '下一段劇情，就從這裡開始！',
            palette: { hair: '#c9a06a', hairDark: '#a37e4e', eye: '#5a8a4a', outfit: '#7a9a5a', outfitDark: '#5a7342', boots: '#8f8a6a', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'fuko', name: '弗子酱', rarity: 'SR', source: 'noexist', limitedOnly: false,
            stats: { hp: 84, atk: 13, def: 8, spd: 112 },
            skill: { name: '音遊節奏', desc: '連續命中時射速提升，最高 +20%。' },
            story: '高挑、沉默、耳機幾乎焊在頭上。弗子酱不擅長用言語表達，乾脆把所有想說的話都交給了節奏——鍵盤與音遊控制器是她的第二副聲帶。她的曲目清單按心情分類，全破紀錄多到懶得數；傳說她在最難的那首歌裡達成過理論值，但沒有人親眼看過，因為她從不重播。連續命中時，她的射擊會跟著節拍越打越快——↑↑↓↓←→←→BA，這是她唯一願意開口確認的通關密語。',
            tagline: '（沉默地比出勝利手勢）',
            palette: { hair: '#4a4a5f', hairDark: '#33334a', eye: '#9a6adf', outfit: '#35455f', outfitDark: '#25314a', boots: '#5a5a7a', skin: '#f9d1d0' },
            hairStyle: 'bun'
        },
        // ---------- 戰術部隊（本作原創） ----------
        {
            id: 'recruit', name: '新兵', rarity: 'N', source: 'tactical', limitedOnly: false,
            stats: { hp: 75, atk: 8, def: 6, spd: 100 },
            skill: { name: '基礎訓練', desc: '經驗獲取 +5%。' },
            story: '剛下部隊的年輕士兵，裝備是全新的，緊張也是。第一次交火時她連保險都忘記開，被子彈擦過鋼盔的瞬間才學會呼吸。沒有什麼驚人的天賦，但她比誰都認真地寫訓練筆記——每多活一場戰鬥，字跡就沉穩一分。她相信總有一天，這本筆記會變成下一個新兵的教科書。',
            tagline: '報告！請多指教！',
            palette: { hair: '#6a7a5f', hairDark: '#4d5a45', eye: '#3a4a35', outfit: '#5a6a4a', outfitDark: '#42503a', boots: '#3a4032', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'scout', name: '斥候', rarity: 'N', source: 'tactical', limitedOnly: false,
            stats: { hp: 72, atk: 9, def: 5, spd: 115 },
            skill: { name: '前線偵察', desc: '視野內敵人被標記，+5% 對標記目標傷害。' },
            story: '她走在隊伍的最前面，看過最多的敵影，也最早學會把恐懼留給身後。地圖上沒有的路是她畫出來的，地雷埋在哪裡她用直覺猜——而且九成會猜中。「前面有動靜，跟緊我。」她說這句話時從不回頭：回頭的人會猶豫，而猶豫會傳染。',
            tagline: '前面有動靜，跟緊我。',
            palette: { hair: '#8f7a4a', hairDark: '#6d5c38', eye: '#4a3a2a', outfit: '#4a5a3a', outfitDark: '#37452c', boots: '#3a3a2c', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'medic', name: '醫療兵', rarity: 'N', source: 'tactical', limitedOnly: false,
            stats: { hp: 78, atk: 7, def: 7, spd: 98 },
            skill: { name: '戰地急救', desc: '每 30 秒自動回復 3% 最大 HP。' },
            story: '背包裡永遠多帶一份繃帶、一份止痛劑，和一份也許永遠用不上的僥倖。她在砲火裡數過最多的不是擊殺，而是脈搏。她救不了所有人——這件事她比誰都清楚，但她從來沒有停止嘗試。「別動，馬上幫你包紮！」在戰場上，這句話比任何口號都更像承諾。',
            tagline: '別動，馬上幫你包紮！',
            palette: { hair: '#a86a6a', hairDark: '#7e4f4f', eye: '#5a3a3a', outfit: '#4a5a6a', outfitDark: '#374552', boots: '#3a404a', skin: '#f9d1d0' },
            hairStyle: 'bun'
        },
        {
            id: 'gunner', name: '機槍手', rarity: 'R', source: 'tactical', limitedOnly: false,
            stats: { hp: 85, atk: 12, def: 8, spd: 92 },
            skill: { name: '彈鏈供給', desc: '射速 +8%。' },
            story: '壓制火力就是她的語言。彈鏈上膛的聲音是她的清嗓子，槍管過熱前的三十秒是她最安靜的時刻——因為全場都會為了她而安靜。她只信一件事：與其精準地打中十個敵人，不如讓一百個敵人不敢抬頭。',
            tagline: '彈藥充足，掩護我！',
            palette: { hair: '#5a6a7a', hairDark: '#42505c', eye: '#2a3a4a', outfit: '#3a4a5a', outfitDark: '#2c3945', boots: '#323a42', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'engineer', name: '工兵', rarity: 'R', source: 'tactical', limitedOnly: false,
            stats: { hp: 82, atk: 10, def: 10, spd: 96 },
            skill: { name: '槍械保養', desc: '傷害 +6%。' },
            story: '能修好的東西她都修過一遍：槍械、發電機、無線電，還有隊友們偶爾壞掉的心情——她堅持這幾樣東西的保養程序一模一樣：拆解、清潔、上油、裝回，然後拍兩下。「喀啦、喀啦——好了，如新！」她的工作檯上永遠擺著一個待修的小東西，她說那是幸運符。',
            tagline: '喀啦、喀啦——好了，如新！',
            palette: { hair: '#7a6a4a', hairDark: '#5c4f38', eye: '#4a3a2a', outfit: '#5a4a3a', outfitDark: '#42382c', boots: '#3a332a', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'sniper', name: '狙擊手', rarity: 'SR', source: 'tactical', limitedOnly: false,
            stats: { hp: 76, atk: 15, def: 6, spd: 100 },
            skill: { name: '精準射擊', desc: '暴擊率 +10%。' },
            story: '她的世界很安靜——安靜得只剩下風速、距離和自己的呼吸。在三百公尺外解決問題是她的日常，所以她說話簡短、睡覺很淺、朋友很少，但每一個都是可以背對背的交情。「風速 3，距離 240——命中。」她在報告裡這樣寫，然後繼續等待下一個三百公尺。',
            tagline: '風速 3，距離 240——命中。',
            palette: { hair: '#4a5a4a', hairDark: '#374537', eye: '#2a3a2a', outfit: '#354535', outfitDark: '#283528', boots: '#2c332c', skin: '#f9d1d0' },
            hairStyle: 'long'
        },
        {
            id: 'vanguard', name: '先鋒', rarity: 'SR', source: 'tactical', limitedOnly: false,
            stats: { hp: 94, atk: 11, def: 9, spd: 112 },
            skill: { name: '戰術突進', desc: '移動速度 +8%，衝撞傷害 +15%。' },
            story: '第一個衝進戰場的人。不是因為不怕死——她怕，怕得要命——而是她比誰都清楚：猶豫比子彈更致命，而總得有人先動。她的衝鋒不靠蠻勇，靠的是起跑前就把彈道、地形和退路全部想完的那股倔強。「跟上！別掉隊！」——回頭確認人數的瞬間，是她在戰場上唯一允許自己的減速。',
            tagline: '跟上！別掉隊！',
            palette: { hair: '#8a4a4a', hairDark: '#6a3737', eye: '#3a2a2a', outfit: '#5a3535', outfitDark: '#452a2a', boots: '#3a2c2c', skin: '#f9d1d0' },
            hairStyle: 'short'
        },
        {
            id: 'ace', name: '王牌指揮官', rarity: 'SSR', source: 'tactical', limitedOnly: false,
            stats: { hp: 96, atk: 15, def: 10, spd: 106 },
            skill: { name: '戰場直覺', desc: '全屬性 +5%。' },
            story: '她打過每一場沒人記得的戰役：名稱被塗黑的森林、座標作廢的城鎮、檔案裡只剩編號的防線。軍功章塞滿了抽屜，她卻一個都沒掛過——她說真正該統計的不是勳章的數量，而是帶回來多少名字。她的戰場直覺準得可怕，因為那直覺的每一條，都是用某個再也回不來的隊友換來的。「聽我口令，全體——反擊！」',
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
