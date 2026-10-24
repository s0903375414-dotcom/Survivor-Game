// character.js — 可互動角色系統 + 2D 逐幀動畫
// 以「橘雪莉」立繪配色程序化生成像素 sprite sheet(免外部圖檔),支援 idle/run/hurt/dead 四狀態。
// 提供 CharacterAnim 類與 CharacterRenderer;Player.draw() 與多人遠端玩家共用。
(function (global) {
    'use strict';

    // ===== 立繪配色(取自 D:\橘雪莉_小说版立绘.jpeg 程序化調色盤分析)=====
    var PALETTE = {
        hair: '#87aad9',        // 淺藍長髮
        hairDark: '#5f7fae',    // 髮影
        skin: '#f9d1d0',        // 膚色
        skinShadow: '#e4b3b3', // 膚色陰影
        dress: '#4069aa',      // 藍色上衣
        dressDark: '#2c4a80',  // 上衣陰影
        boots: '#927393',      // 紫灰靴
        bootsDark: '#6d5370',  // 靴子陰影
        outline: '#182c4f',    // 深藍描邊
        eye: '#182c4f',        // 深藍眼
        white: '#ffffff'
    };

    // ===== Sprite sheet 規格 =====
    // 每幀 32x40 px,4 狀態 x 方向(下/上/左/右=4 列)
    var FW = 32, FH = 40;          // 幀尺寸
    var STATES = { idle: 4, run: 6, hurt: 2, dead: 4 };
    var FPS = { idle: 6, run: 12, hurt: 10, dead: 8 };  // 每狀態幀率
    var DIRS = ['down', 'up', 'left', 'right'];

    var sheetCache = {};   // charId -> sprite sheet 快取(v2:每個角色專屬模型)

    // 像素繪製輔助:px(ctx, x, y, w, h, color) — 以 1px 為單位畫矩形
    function px(c, x, y, w, h, color) {
        c.fillStyle = color;
        c.fillRect(x, y, w, h);
    }

    // hex 加深/提亮小工具
    function shade(hex, f) {
        var r = Math.max(0, Math.min(255, Math.floor(parseInt(hex.slice(1, 3), 16) * f)));
        var g = Math.max(0, Math.min(255, Math.floor(parseInt(hex.slice(3, 5), 16) * f)));
        var b = Math.max(0, Math.min(255, Math.floor(parseInt(hex.slice(5, 7), 16) * f)));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    // 由 CHARACTERS 的 palette 轉成 sprite 配色
    function paletteFromChar(ch) {
        var p = ch.palette || {};
        return {
            hair: p.hair || PALETTE.hair,
            hairDark: p.hairDark || shade(p.hair || PALETTE.hair, 0.72),
            skin: p.skin || PALETTE.skin,
            skinShadow: shade(p.skin || PALETTE.skin, 0.92),
            dress: p.outfit || PALETTE.dress,
            dressDark: p.outfitDark || shade(p.outfit || PALETTE.dress, 0.75),
            boots: p.boots || PALETTE.boots,
            bootsDark: shade(p.boots || PALETTE.boots, 0.75),
            outline: '#182c4f',
            eye: p.eye || PALETTE.eye,
            white: '#ffffff'
        };
    }

    // 在 (ox,oy) 畫一幀身體。f = 0..1 幀內相位;dir = 方向索引;pose = {bob, legSwing, armSwing, blink, knock}
    function drawFrame(c, ox, oy, dir, pose, P, hairStyle) {
        var bob = pose.bob | 0;              // 身體上下浮動
        var leg = pose.legSwing;             // 腿擺幅(-2..2)
        var arm = pose.armSwing;              // 手臂擺幅
        var blink = pose.blink;               // 眨眼
        var knock = pose.knock;               // 受擊位移
        var cx = ox + 16 + knock;             // 角色中心 x

        // ---- 影子(不隨 bob)----
        c.globalAlpha = 0.28;
        px(c, ox + 8, oy + 36, 16, 3, '#000000');
        c.globalAlpha = 1;

        var top = oy + 4 + bob;

        // ---- 頭(14x12,置中)----
        var hx = cx - 7;
        // 頭髮後層(依髮型像素變化)
        var backX = (dir === 2) ? hx + 3 : (dir === 3) ? hx - 3 : hx - 2;
        if (hairStyle === 'twin') {
            px(c, backX - 1, top + 2, 3, 9, P.hairDark);
            px(c, hx + 12, top + 2, 3, 9, P.hairDark);
            px(c, backX - 4, top + 8, 4, 8, P.hair);   // 左馬尾
            px(c, hx + 13, top + 8, 4, 8, P.hair);     // 右馬尾
        } else if (hairStyle === 'bun') {
            px(c, backX - 1, top + 2, 3, 8, P.hairDark);
            px(c, hx + 12, top + 2, 3, 8, P.hairDark);
            px(c, cx - 5, top - 6, 10, 5, P.hair);     // 髮髻
            px(c, cx - 3, top - 7, 6, 2, P.hairDark);  // 髮髻陰影
        } else if (hairStyle === 'short') {
            px(c, backX - 1, top + 2, 3, 6, P.hairDark);
            px(c, hx + 12, top + 2, 3, 6, P.hairDark);
        } else { // long(預設)
            px(c, backX - 1, top + 2, 3, 14, P.hairDark);
            px(c, hx + 12, top + 2, 3, 14, P.hairDark);
        }
        // 臉
        px(c, hx, top, 14, 12, P.skin);
        px(c, hx, top + 10, 14, 2, P.skinShadow);
        // 瀏海
        px(c, hx - 1, top - 2, 16, 4, P.hair);
        px(c, hx - 1, top + 2, 16, 2, P.hair);
        px(c, (dir === 2) ? hx - 2 : hx + 10, top - 3, 5, 6, P.hair); // 側髮包
        // 眼睛(依方向)
        if (dir === 1) {
            // 背面:全髮
            px(c, hx, top, 14, 12, P.hair);
            px(c, hx - 1, top - 2, 16, 16, P.hair);
        } else {
            var ey = top + 5;
            var blinkH = blink ? 1 : 3;
            if (dir === 0) {           // 正面雙眼
                px(c, hx + 3, ey, 2, blinkH, P.eye);
                px(c, hx + 9, ey, 2, blinkH, P.eye);
                if (!blink) { px(c, hx + 3, ey - 1, 2, 1, P.white); px(c, hx + 9, ey - 1, 2, 1, P.white); }
            } else if (dir === 2) {    // 左側單眼
                px(c, hx + 3, ey, 2, blinkH, P.eye);
            } else {                   // 右側單眼
                px(c, hx + 9, ey, 2, blinkH, P.eye);
            }
            // 腮紅
            c.globalAlpha = 0.5;
            px(c, hx + 2, top + 8, 2, 1, '#f2a9a9');
            px(c, hx + 10, top + 8, 2, 1, '#f2a9a9');
            c.globalAlpha = 1;
        }

        // ---- 身體(上衣 12x10)----
        var by = top + 12;
        px(c, cx - 6, by, 12, 9, P.dress);
        px(c, cx - 6, by + 7, 12, 2, P.dressDark);
        // 白色衣領
        px(c, cx - 2, by, 4, 2, P.white);

        // ---- 手臂(4x8,前後擺)----
        var ay = by + 1;
        px(c, cx - 8, ay + arm, 3, 7, P.dress);        // 後臂
        px(c, cx + 5, ay - arm, 3, 7, P.dress);        // 前臂
        px(c, cx - 8, ay + arm + 6, 3, 2, P.skin);     // 手
        px(c, cx + 5, ay - arm + 6, 3, 2, P.skin);

        // ---- 腿(靴子 4x6,走路交替)----
        var ly = by + 9;
        px(c, cx - 5, ly, 4, 6 + leg, P.boots);
        px(c, cx + 1, ly, 4, 6 - leg, P.boots);
        px(c, cx - 5, ly + 4 + leg, 4, 2, P.bootsDark);
        px(c, cx + 1, ly + 4 - leg, 4, 2, P.bootsDark);
        // 描邊重點(輪廓感)
        c.globalAlpha = 0.35;
        px(c, cx - 6, by - 1, 12, 1, P.outline);
        px(c, hx - 1, top - 3, 16, 1, P.outline);
        c.globalAlpha = 1;
    }

    // 幀參數表:每幀 {bob, legSwing, armSwing, blink, knock}
    function frameParams(state, i, n) {
        var ph = i / n;   // 0..1
        switch (state) {
            case 'idle':
                return { bob: Math.round(Math.sin(ph * Math.PI * 2) * 1.2), leg: 0, arm: 0, blink: (i === 2), knock: 0 };
            case 'run':
                return { bob: (i % 2 === 0) ? -1 : 1, leg: (i % 2 === 0) ? 2 : -2, arm: (i % 2 === 0) ? -2 : 2, blink: false, knock: 0 };
            case 'hurt':
                return { bob: 0, leg: 0, arm: 0, blink: true, knock: (i === 0) ? -2 : 2 };
            case 'dead':
                // 漸進倒地:身體下沉
                return { bob: Math.round(ph * 14), leg: 0, arm: 0, blink: true, knock: Math.round(ph * 4) };
        }
        return { bob: 0, leg: 0, arm: 0, blink: false, knock: 0 };
    }

    // 生成 sprite sheet 離屏 canvas
    function buildSheet(P, hairStyle) {
        var cv = document.createElement('canvas');
        var cols = Math.max.apply(null, [STATES.idle, STATES.run, STATES.hurt, STATES.dead]); // 6
        cv.width = cols * FW;
        cv.height = DIRS.length * FH * 4;   // 4 狀態區塊
        var c = cv.getContext('2d');
        var stateNames = ['idle', 'run', 'hurt', 'dead'];
        var rowMap = {};   // state -> {dirIndex -> row}
        var row = 0;
        stateNames.forEach(function (st) {
            var rows = [];
            for (var d = 0; d < DIRS.length; d++) {
                rows.push(row);
                for (var f = 0; f < STATES[st]; f++) {
                    var p = frameParams(st, f, STATES[st]);
                    c.save();
                    if (st === 'dead') {
                        // 死亡幀:整體透明度漸暗
                        c.globalAlpha = 1 - 0.15 * f;
                    }
                    drawFrame(c, f * FW, row * FH, d, { bob: p.bob, legSwing: p.leg, armSwing: p.arm, blink: p.blink, knock: p.knock }, P, hairStyle || 'long');
                    c.restore();
                }
                row++;
            }
            rowMap[st] = rows;
        });
        return { canvas: cv, rowMap: rowMap, cols: cols };
    }

    // 取得角色的 sprite sheet:charId 為 null → 預設橘雪莉;否則依 CHARACTERS 配色/髮型生成(含快取)
    function getSheetFor(charId) {
        var key = charId || '__default__';
        if (sheetCache[key]) return sheetCache[key];
        var P = PALETTE, hair = 'long';
        if (charId && typeof CHARACTERS !== 'undefined') {
            var ch = null;
            for (var i = 0; i < CHARACTERS.length; i++) {
                if (CHARACTERS[i].id === charId) { ch = CHARACTERS[i]; break; }
            }
            if (ch) {
                P = paletteFromChar(ch);
                hair = ch.hairStyle || 'long';
            }
        }
        sheetCache[key] = buildSheet(P, hair);
        return sheetCache[key];
    }

    function getSheet() { return getSheetFor(null); }

    // ===== CharacterAnim:狀態機 + 幀調度 =====
    // v2:建構時可傳入角色 id,該動畫物件即以該角色外觀繪製(多人遠端玩家預設為橘雪莉)。
    function CharacterAnim(charId) {
        this.charId = charId || null;
        this.state = 'idle';
        this.stateTime = 0;
        this.frameTime = 0;
        this.frame = 0;
        this.prevMoving = false;
        this.hurtTimer = 0;      // 受擊後短暫鎖定 hurt 動畫
        this.deadLocked = false;
        this.lastDir = 'down';
    }

    CharacterAnim.prototype.setCharId = function (id) {
        this.charId = id || null;
    };

    CharacterAnim.prototype.setState = function (st) {
        if (this.state === st) return;
        this.state = st;
        this.stateTime = 0;
        this.frame = 0;
        this.frameTime = 0;
        if (st === 'dead') this.deadLocked = true;
    };

    // dt:秒;moving:bool;hurt:bool(本幀受擊);dead:bool
    CharacterAnim.prototype.update = function (dt, moving, hurt, dead) {
        if (dead) { this.setState('dead'); }
        else if (this.deadLocked) { /* 死亡鎖定直到外部重置 */ }
        else if (hurt || this.hurtTimer > 0) {
            this.setState('hurt');
            if (hurt) this.hurtTimer = 0.28;
            this.hurtTimer -= dt;
        } else if (moving) { this.setState('run'); }
        else { this.setState('idle'); }

        this.stateTime += dt;
        var fps = FPS[this.state] || 6;
        this.frameTime += dt;
        var frameDur = 1 / fps;
        while (this.frameTime >= frameDur) {
            this.frameTime -= frameDur;
            this.frame++;
            // idle/hurt 結束回 loop;dead 播完停最後幀
            var n = STATES[this.state];
            if (this.frame >= n) {
                this.frame = (this.state === 'dead') ? n - 1 : (this.state === 'hurt') ? n - 1 : 0;
                if (this.state === 'hurt' && this.hurtTimer <= 0) { /* 維持最後幀直到狀態離開 */ }
            }
        }
    };

    CharacterAnim.prototype.reset = function () {
        this.state = 'idle'; this.stateTime = 0; this.frame = 0;
        this.frameTime = 0; this.hurtTimer = 0; this.deadLocked = false;
    };

    // 方向判定:優先水平(射擊遊戲慣例),否則用垂直
    CharacterAnim.prototype.dirIndex = function (vx, vy) {
        if (vx === 0 && vy === 0) return DIRS.indexOf(this.lastDir);
        var d;
        if (Math.abs(vx) > Math.abs(vy)) d = (vx < 0) ? 'left' : 'right';
        else d = (vy < 0) ? 'up' : 'down';
        this.lastDir = d;
        return DIRS.indexOf(d);
    };

    // 繪製到主 ctx:x,y = 世界座標(會自動扣 camera),scale = 放大倍率
    CharacterAnim.prototype.draw = function (ctx, x, y, camera, scale, moving) {
        var s = getSheetFor(this.charId);
        var st = this.state;
        var dir = DIRS.indexOf(this.lastDir);
        var row = s.rowMap[st][dir];
        var fx = this.frame * FW;
        var fy = row * FH;
        var sc = scale || 1;
        var dx = Math.round(x - camera.x - FW * sc / 2);
        var dy = Math.round(y - camera.y - FH * sc / 2);
        // 受擊閃紅
        if (st === 'hurt' && this.frame === 0) {
            ctx.save();
            ctx.globalAlpha = 0.9;
        }
        ctx.drawImage(s.canvas, fx, fy, FW, FH, dx, dy, FW * sc, FH * sc);
        if (st === 'hurt' && this.frame === 0) ctx.restore();
        // 武器指向提示(小圓點,跟隨面向)
        return { dx: dx, dy: dy, w: FW * sc, h: FH * sc };
    };

    // ===== 靜態工具繪製(多人遠端玩家/無 CharacterAnim 物件時)=====
    var sharedAnim = new CharacterAnim();

    // CharacterRenderer.drawRemote(ctx, x, y, camera, scale, moving, vx, vy, hurt, dead, dt)
    global.CharacterRenderer = {
        anim: sharedAnim,
        drawRemote: function (ctx, x, y, camera, scale, moving, vx, vy, hurt, dead, dt) {
            sharedAnim.update(dt || 0.016, !!moving, !!hurt, !!dead);
            if (vx !== undefined) sharedAnim.dirIndex(vx, vy);
            return sharedAnim.draw(ctx, x, y, camera, scale, moving);
        },
        // 除役介面:直接給舊代碼畫一個精靈(不用狀態機)
        drawStatic: function (ctx, x, y, camera, scale, dir, state, frame) {
            var s = getSheet();
            var dirI = (dir === undefined) ? 0 : DIRS.indexOf(dir);
            var row = s.rowMap[state || 'idle'][dirI < 0 ? 0 : dirI];
            var sc = scale || 1;
            ctx.drawImage(s.canvas, (frame || 0) * FW, row * FH, FW, FH,
                Math.round(x - camera.x - FW * sc / 2), Math.round(y - camera.y - FH * sc / 2), FW * sc, FH * sc);
        },
        PALETTE: PALETTE,
        buildSheet: buildSheet,
        getSheetFor: getSheetFor
    };
    global.CharacterAnim = CharacterAnim;
})(window);
