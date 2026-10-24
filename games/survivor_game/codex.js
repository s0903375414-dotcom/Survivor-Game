// codex.js — 角色圖鑑:高解析度純 2D 立繪(平滑向量風格,非像素)+ 分類瀏覽 / 搜尋 / 放大檢視
// 立繪由角色配色(palette)與髮型(hairStyle)程序化生成:512×640 輸出、內部 2× 超取樣抗鋸齒。
(function (global) {
    'use strict';

    // ================= 高解析度 2D 立繪產生器 =================
    var AR_W = 512, AR_H = 640;        // 輸出尺寸
    var SS = 2;                        // 內部超取樣倍率(1024×1280)
    var artCache = {};

    function hexA(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    function darken(hex, f) {
        var r = Math.floor(parseInt(hex.slice(1, 3), 16) * f),
            g = Math.floor(parseInt(hex.slice(3, 5), 16) * f),
            b = Math.floor(parseInt(hex.slice(5, 7), 16) * f);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    function lighten(hex, f) {
        var r = Math.min(255, Math.floor(parseInt(hex.slice(1, 3), 16) * f)),
            g = Math.min(255, Math.floor(parseInt(hex.slice(3, 5), 16) * f)),
            b = Math.min(255, Math.floor(parseInt(hex.slice(5, 7), 16) * f));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    function vGrad(ctx, x0, y0, x1, y1, c0, c1) {
        var g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, c0); g.addColorStop(1, c1);
        return g;
    }

    function drawStar(ctx, x, y, r, color, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
        ctx.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
        ctx.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
        ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
        ctx.fill();
        ctx.restore();
    }

    function drawArtLegacy(ctx, ch, rarity) { // 舊版繪製(2026-10 v2 重繪後保留參考)
        var P = ch.palette;
        var cx = 512, W = 1024, H = 1280;

        // ---------- 背景 ----------
        ctx.fillStyle = vGrad(ctx, 0, 0, 0, H, '#151322', '#0d0c17');
        ctx.fillRect(0, 0, W, H);
        var rarColor = { N: '#8b9aa9', R: '#4aa3ff', SR: '#c07bff', SSR: '#ffd700' }[rarity] || '#8b9aa9';
        var bgGlow = ctx.createRadialGradient(cx, 470, 60, cx, 470, 620);
        bgGlow.addColorStop(0, hexA(rarColor, 0.30));
        bgGlow.addColorStop(0.55, hexA(P.outfit, 0.16));
        bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bgGlow;
        ctx.fillRect(0, 0, W, H);
        // 光暈圓環
        ctx.save();
        ctx.globalAlpha = 0.20;
        ctx.strokeStyle = rarColor;
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(cx, 470, 330, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.10;
        ctx.lineWidth = 26;
        ctx.beginPath(); ctx.arc(cx, 470, 380, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // 斜向光帶
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#ffffff';
        for (var ray = -2; ray <= 2; ray++) {
            ctx.save();
            ctx.translate(cx + ray * 150, 0);
            ctx.rotate(ray * 0.12 + 0.5);
            ctx.fillRect(-30, -260, 60, 1500);
            ctx.restore();
        }
        ctx.restore();
        // 星光裝飾
        drawStar(ctx, 200, 250, 34, '#ffffff', 0.85);
        drawStar(ctx, 840, 190, 22, rarColor, 0.9);
        drawStar(ctx, 880, 520, 14, '#ffffff', 0.65);
        drawStar(ctx, 130, 620, 12, rarColor, 0.6);
        drawStar(ctx, 760, 880, 18, '#ffffff', 0.35);
        // 底部稀有度漸層帶
        ctx.fillStyle = vGrad(ctx, 0, H - 300, 0, H, 'rgba(0,0,0,0)', hexA(rarColor, 0.22));
        ctx.fillRect(0, H - 300, W, 300);

        // ---------- 後髮(髮型分層) ----------
        ctx.save();
        var hairG = vGrad(ctx, 0, 220, 0, 1080, P.hair, darken(P.hairDark, 0.9));
        ctx.fillStyle = hairG;
        if (ch.hairStyle === 'long') {
            // 大面積披髮:兩側瀑布狀髮流
            ctx.beginPath();
            ctx.moveTo(cx - 150, 360);
            ctx.bezierCurveTo(cx - 260, 420, cx - 250, 780, cx - 235, 1070);
            ctx.bezierCurveTo(cx - 175, 1090, cx - 105, 1060, cx - 110, 980);
            ctx.bezierCurveTo(cx - 120, 760, cx - 130, 560, cx - 92, 430);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 150, 360);
            ctx.bezierCurveTo(cx + 260, 420, cx + 250, 780, cx + 235, 1070);
            ctx.bezierCurveTo(cx + 175, 1090, cx + 105, 1060, cx + 110, 980);
            ctx.bezierCurveTo(cx + 120, 760, cx + 130, 560, cx + 92, 430);
            ctx.closePath(); ctx.fill();
            // 後方髮底
            ctx.beginPath();
            ctx.moveTo(cx - 160, 380);
            ctx.bezierCurveTo(cx - 200, 640, cx - 150, 860, cx, 940);
            ctx.bezierCurveTo(cx + 150, 860, cx + 200, 640, cx + 160, 380);
            ctx.closePath(); ctx.fill();
        } else if (ch.hairStyle === 'twin') {
            // 雙馬尾:側髮 + 兩束尾巴
            ctx.beginPath();
            ctx.moveTo(cx - 150, 370);
            ctx.bezierCurveTo(cx - 235, 460, cx - 210, 700, cx - 170, 830);
            ctx.bezierCurveTo(cx - 120, 845, cx - 90, 800, cx - 105, 700);
            ctx.bezierCurveTo(cx - 118, 570, cx - 118, 470, cx - 90, 420);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 150, 370);
            ctx.bezierCurveTo(cx + 235, 460, cx + 210, 700, cx + 170, 830);
            ctx.bezierCurveTo(cx + 120, 845, cx + 90, 800, cx + 105, 700);
            ctx.bezierCurveTo(cx + 118, 570, cx + 118, 470, cx + 90, 420);
            ctx.closePath(); ctx.fill();
            // 尾束(向外彎)
            ctx.beginPath();
            ctx.moveTo(cx - 195, 470);
            ctx.bezierCurveTo(cx - 330, 520, cx - 360, 740, cx - 285, 950);
            ctx.bezierCurveTo(cx - 240, 980, cx - 200, 940, cx - 218, 800);
            ctx.bezierCurveTo(cx - 232, 660, cx - 240, 560, cx - 195, 500);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 195, 470);
            ctx.bezierCurveTo(cx + 330, 520, cx + 360, 740, cx + 285, 950);
            ctx.bezierCurveTo(cx + 240, 980, cx + 200, 940, cx + 218, 800);
            ctx.bezierCurveTo(cx + 232, 660, cx + 240, 560, cx + 195, 500);
            ctx.closePath(); ctx.fill();
            // 髮帶
            ctx.fillStyle = P.eye;
            [-1, 1].forEach(function (s) {
                ctx.beginPath();
                ctx.ellipse(cx + s * 178, 468, 34, 24, s * 0.5, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.fillStyle = hairG;
        } else if (ch.hairStyle === 'bun') {
            // 短後髮 + 髮髻
            ctx.beginPath();
            ctx.moveTo(cx - 150, 370);
            ctx.bezierCurveTo(cx - 215, 500, cx - 175, 690, cx - 120, 780);
            ctx.bezierCurveTo(cx - 60, 800, cx + 60, 800, cx + 120, 780);
            ctx.bezierCurveTo(cx + 175, 690, cx + 215, 500, cx + 150, 370);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx, 245, 105, 88, 0, 0, Math.PI * 2);
            ctx.fill();
            // 髮髻陰影 + 髮夾
            ctx.fillStyle = darken(P.hairDark, 0.75);
            ctx.beginPath(); ctx.ellipse(cx - 20, 258, 78, 60, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = P.eye; ctx.lineWidth = 14; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx + 96, 210); ctx.lineTo(cx + 150, 172); ctx.stroke();
            ctx.fillStyle = hairG;
        } else { // short
            ctx.beginPath();
            ctx.moveTo(cx - 150, 370);
            ctx.bezierCurveTo(cx - 205, 480, cx - 180, 660, cx - 128, 745);
            ctx.bezierCurveTo(cx - 60, 768, cx + 60, 768, cx + 128, 745);
            ctx.bezierCurveTo(cx + 180, 660, cx + 205, 480, cx + 150, 370);
            ctx.closePath(); ctx.fill();
        }
        // 髮絲光澤
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(cx, 330, 150, 52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ---------- 身體(洋裝) ----------
        // 脖子
        ctx.fillStyle = vGrad(ctx, 0, 590, 0, 680, P.skin, darken(P.skin, 0.82));
        ctx.beginPath();
        ctx.moveTo(cx - 34, 590); ctx.lineTo(cx + 34, 590);
        ctx.quadraticCurveTo(cx + 30, 665, cx + 42, 690);
        ctx.lineTo(cx - 42, 690); ctx.quadraticCurveTo(cx - 30, 665, cx - 34, 590);
        ctx.closePath(); ctx.fill();
        // 裙身
        var dressG = vGrad(ctx, 0, 680, 0, 1280, P.outfit, darken(P.outfitDark, 0.72));
        ctx.fillStyle = dressG;
        ctx.beginPath();
        ctx.moveTo(cx - 150, 705);
        ctx.bezierCurveTo(cx - 175, 830, cx - 238, 1080, cx - 268, 1280);
        ctx.lineTo(cx + 268, 1280);
        ctx.bezierCurveTo(cx + 238, 1080, cx + 175, 830, cx + 150, 705);
        ctx.bezierCurveTo(cx + 60, 660, cx - 60, 660, cx - 150, 705);
        ctx.closePath(); ctx.fill();
        // 裙褶陰影
        ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = darken(P.outfitDark, 0.55);
        [ -150, -55, 40, 135 ].forEach(function (dx) {
            ctx.beginPath();
            ctx.moveTo(cx + dx * 0.55, 760);
            ctx.quadraticCurveTo(cx + dx, 1000, cx + dx * 1.5, 1280);
            ctx.quadraticCurveTo(cx + dx * 1.5 + 28, 1280, cx + dx * 1.5 + 30, 1270);
            ctx.quadraticCurveTo(cx + dx + 30, 1000, cx + dx * 0.55 + 26, 762);
            ctx.closePath(); ctx.fill();
        });
        ctx.restore();
        // 手臂(袖)沿裙側
        ctx.fillStyle = dressG;
        [-1, 1].forEach(function (s) {
            ctx.beginPath();
            ctx.moveTo(cx + s * 148, 712);
            ctx.bezierCurveTo(cx + s * 205, 760, cx + s * 216, 950, cx + s * 205, 1150);
            ctx.lineTo(cx + s * 262, 1280);
            ctx.lineTo(cx + s * 150, 1280);
            ctx.bezierCurveTo(cx + s * 156, 1060, cx + s * 148, 880, cx + s * 112, 742);
            ctx.closePath(); ctx.fill();
        });
        // 白色衣領
        ctx.fillStyle = '#f5f6fa';
        ctx.beginPath();
        ctx.moveTo(cx - 92, 692);
        ctx.quadraticCurveTo(cx, 745, cx + 92, 692);
        ctx.quadraticCurveTo(cx + 70, 780, cx, 800);
        ctx.quadraticCurveTo(cx - 70, 780, cx - 92, 692);
        ctx.closePath(); ctx.fill();
        // 蝴蝶結(胸飾,配色取髮色)
        ctx.fillStyle = P.hair;
        ctx.beginPath();
        ctx.moveTo(cx, 806); ctx.lineTo(cx - 64, 770); ctx.quadraticCurveTo(cx - 78, 806, cx - 64, 842); ctx.lineTo(cx, 826);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, 806); ctx.lineTo(cx + 64, 770); ctx.quadraticCurveTo(cx + 78, 806, cx + 64, 842); ctx.lineTo(cx, 826);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = darken(P.hairDark, 0.8);
        ctx.beginPath(); ctx.ellipse(cx, 806, 18, 22, 0, 0, Math.PI * 2); ctx.fill();

        // ---------- 臉 ----------
        var faceG = ctx.createRadialGradient(cx, 400, 40, cx, 470, 210);
        faceG.addColorStop(0, '#fff2f0');
        faceG.addColorStop(0.5, P.skin);
        faceG.addColorStop(1, darken(P.skin, 0.86));
        ctx.fillStyle = faceG;
        ctx.beginPath();
        ctx.moveTo(cx - 148, 400);
        ctx.bezierCurveTo(cx - 152, 300, cx - 90, 236, cx, 236);
        ctx.bezierCurveTo(cx + 90, 236, cx + 152, 300, cx + 148, 400);
        ctx.bezierCurveTo(cx + 142, 500, cx + 84, 620, cx, 632);
        ctx.bezierCurveTo(cx - 84, 620, cx - 142, 500, cx - 148, 400);
        ctx.closePath(); ctx.fill();
        // 耳朵
        [-1, 1].forEach(function (s) {
            ctx.beginPath();
            ctx.ellipse(cx + s * 146, 462, 20, 34, 0, 0, Math.PI * 2);
            ctx.fillStyle = darken(P.skin, 0.93); ctx.fill();
        });

        // ---------- 五官 ----------
        // 眉
        ctx.strokeStyle = darken(P.hairDark, 0.7); ctx.lineWidth = 11; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 108, 428); ctx.quadraticCurveTo(cx - 78, 412, cx - 46, 424); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 108, 428); ctx.quadraticCurveTo(cx + 78, 412, cx + 46, 424); ctx.stroke();
        // 眼睛(動畫風大眼)
        function eye(ex) {
            // 眼白
            ctx.fillStyle = '#fbfcff';
            ctx.beginPath();
            ctx.moveTo(ex - 62, 466);
            ctx.bezierCurveTo(ex - 52, 432, ex + 40, 428, ex + 58, 462);
            ctx.bezierCurveTo(ex + 46, 508, ex - 40, 512, ex - 62, 466);
            ctx.closePath(); ctx.fill();
            // 虹膜
            var iris = ctx.createRadialGradient(ex - 2, 472, 6, ex, 474, 46);
            iris.addColorStop(0, '#ffffff');
            iris.addColorStop(0.25, P.eye);
            iris.addColorStop(1, darken(P.eye, 0.45));
            ctx.fillStyle = iris;
            ctx.beginPath();
            ctx.ellipse(ex, 476, 38, 44, 0, 0, Math.PI * 2);
            ctx.fill();
            // 瞳孔
            ctx.fillStyle = '#1c1430';
            ctx.beginPath(); ctx.ellipse(ex, 480, 17, 24, 0, 0, Math.PI * 2); ctx.fill();
            // 高光
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.beginPath(); ctx.ellipse(ex - 14, 458, 13, 15, -0.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.ellipse(ex + 16, 498, 7, 8, 0.3, 0, Math.PI * 2); ctx.fill();
            // 上睫毛(厚曲線)
            ctx.strokeStyle = '#241d33'; ctx.lineWidth = 17; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(ex - 66, 468);
            ctx.quadraticCurveTo(ex - 20, 420, ex + 62, 458);
            ctx.stroke();
            // 下睫毛
            ctx.strokeStyle = 'rgba(36,29,51,0.45)'; ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(ex - 44, 505);
            ctx.quadraticCurveTo(ex, 520, ex + 46, 500);
            ctx.stroke();
        }
        eye(cx - 80);
        eye(cx + 80);
        // 鼻影
        ctx.fillStyle = 'rgba(150,90,90,0.35)';
        ctx.beginPath(); ctx.ellipse(cx, 545, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
        // 嘴(微笑)
        ctx.strokeStyle = '#c4566b'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 22, 572); ctx.quadraticCurveTo(cx, 590, cx + 22, 572);
        ctx.stroke();
        // 腮紅
        [-1, 1].forEach(function (s) {
            var blush = ctx.createRadialGradient(cx + s * 104, 536, 4, cx + s * 104, 536, 44);
            blush.addColorStop(0, 'rgba(242,140,150,0.42)');
            blush.addColorStop(1, 'rgba(242,140,150,0)');
            ctx.fillStyle = blush;
            ctx.beginPath(); ctx.ellipse(cx + s * 104, 536, 44, 30, 0, 0, Math.PI * 2); ctx.fill();
        });

        // ---------- 瀆海(前髮) ----------
        ctx.fillStyle = hairG;
        ctx.beginPath();
        ctx.moveTo(cx - 152, 402);
        ctx.bezierCurveTo(cx - 158, 296, cx - 96, 228, cx, 224);
        ctx.bezierCurveTo(cx + 96, 228, cx + 158, 296, cx + 152, 402);
        // 右側瀆海尖
        ctx.bezierCurveTo(cx + 128, 372, cx + 112, 352, cx + 96, 350);
        ctx.bezierCurveTo(cx + 108, 386, cx + 100, 420, cx + 78, 452);
        ctx.bezierCurveTo(cx + 66, 408, cx + 58, 372, cx + 42, 348);
        ctx.bezierCurveTo(cx + 46, 396, cx + 34, 442, cx + 8, 478);
        ctx.bezierCurveTo(cx + 8, 430, cx - 2, 380, cx - 22, 344);
        ctx.bezierCurveTo(cx - 18, 398, cx - 34, 446, cx - 58, 478);
        ctx.bezierCurveTo(cx - 66, 434, cx - 74, 386, cx - 86, 352);
        ctx.bezierCurveTo(cx - 100, 382, cx - 108, 416, cx - 104, 452);
        ctx.bezierCurveTo(cx - 124, 414, cx - 136, 386, cx - 152, 402);
        ctx.closePath(); ctx.fill();
        // 兩側長瀆/鬢角
        [-1, 1].forEach(function (s) {
            ctx.beginPath();
            ctx.moveTo(cx + s * 150, 396);
            ctx.bezierCurveTo(cx + s * 176, 470, cx + s * 168, 600, cx + s * 128, 706);
            ctx.quadraticCurveTo(cx + s * 92, 712, cx + s * 96, 660);
            ctx.bezierCurveTo(cx + s * 118, 570, cx + s * 120, 470, cx + s * 100, 408);
            ctx.closePath(); ctx.fill();
        });
        // 髮絲高光帶
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 13; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 108, 300);
        ctx.quadraticCurveTo(cx, 258, cx + 108, 300);
        ctx.stroke();
        ctx.restore();

        // ---------- 輪廓光(右側 rim light) ----------
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(cx + 150, 398);
        ctx.bezierCurveTo(cx + 156, 298, cx + 96, 226, cx, 222);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 150, 705);
        ctx.bezierCurveTo(cx + 176, 832, cx + 240, 1080, cx + 268, 1280);
        ctx.stroke();
        ctx.restore();

        // ---------- 暗角 ----------
        var vig = ctx.createRadialGradient(cx, 560, 380, cx, 560, 900);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
    }

    // ============================================================
    // drawArt v2 (2026-10 重繪)
    // 目標:可愛動漫風五官(眼睛縮小/視線一致/瀏海不壓眼)、明確的肩線手臂、
    // S 曲線髮流,並依角色 id 雜湊差異化:眼型/嘴型/瀏海/配件/衣領。
    // ============================================================
    function hashSeed(str) {
        var h = 2166136261;
        str = String(str || '');
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
        return h >>> 0;
    }

    function drawArt(ctx, ch, rarity) {
        var P = ch.palette;
        var cx = 512, W = 1024, H = 1280;
        var seed = hashSeed(ch.id);
        var eyeShape = seed % 3;              // 0 圓眼 1 杏眼 2 微上揚
        var mouthType = (seed >>> 3) % 3;     // 0 微笑 1 開口笑 2 貓嘴
        var bangType = (seed >>> 6) % 3;      // 0 柔和瀏海 1 窗簾瀏海 2 公主瀏海
        var accessory = (seed >>> 9) % 4;     // 0 無 1 呆毛 2 髮夾 3 側蝴蝶結
        var collarType = (seed >>> 12) % 3;   // 0 水手領 1 蝴蝶結領 2 圍巾領

        // ---------- 背景 ----------
        ctx.fillStyle = vGrad(ctx, 0, 0, 0, H, '#151322', '#0d0c17');
        ctx.fillRect(0, 0, W, H);
        var rarColor = { N: '#8b9aa9', R: '#4aa3ff', SR: '#c07bff', SSR: '#ffd700' }[rarity] || '#8b9aa9';
        var bgGlow = ctx.createRadialGradient(cx, 470, 60, cx, 470, 620);
        bgGlow.addColorStop(0, hexA(rarColor, 0.30));
        bgGlow.addColorStop(0.55, hexA(P.outfit, 0.16));
        bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bgGlow;
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.globalAlpha = 0.20;
        ctx.strokeStyle = rarColor;
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(cx, 470, 330, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.10;
        ctx.lineWidth = 26;
        ctx.beginPath(); ctx.arc(cx, 470, 380, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#ffffff';
        for (var ray = -2; ray <= 2; ray++) {
            ctx.save();
            ctx.translate(cx + ray * 150, 0);
            ctx.rotate(ray * 0.12 + 0.5);
            ctx.fillRect(-30, -260, 60, 1500);
            ctx.restore();
        }
        ctx.restore();
        drawStar(ctx, 200, 250, 34, '#ffffff', 0.85);
        drawStar(ctx, 840, 190, 22, rarColor, 0.9);
        drawStar(ctx, 880, 520, 14, '#ffffff', 0.65);
        drawStar(ctx, 130, 620, 12, rarColor, 0.6);
        drawStar(ctx, 760, 880, 18, '#ffffff', 0.35);
        ctx.fillStyle = vGrad(ctx, 0, H - 300, 0, H, 'rgba(0,0,0,0)', hexA(rarColor, 0.22));
        ctx.fillRect(0, H - 300, W, 300);

        var hairG = vGrad(ctx, 0, 220, 0, 1080, P.hair, darken(P.hairDark, 0.9));
        var hairDK = darken(P.hairDark, 0.82);

        // ---------- 後髮(身體底層,S 曲線髮流) ----------
        ctx.save();
        ctx.fillStyle = hairG;
        if (ch.hairStyle === 'long') {
            [-1, 1].forEach(function (s) {
                ctx.beginPath();
                ctx.moveTo(cx + s * 120, 330);
                ctx.bezierCurveTo(cx + s * 235, 430, cx + s * 205, 720, cx + s * 238, 985);
                ctx.bezierCurveTo(cx + s * 248, 1070, cx + s * 210, 1105, cx + s * 176, 1088);
                ctx.bezierCurveTo(cx + s * 140, 1010, cx + s * 158, 700, cx + s * 108, 470);
                ctx.bezierCurveTo(cx + s * 96, 400, cx + s * 92, 352, cx + s * 120, 330);
                ctx.closePath(); ctx.fill();
                // 髮束光帶
                ctx.globalAlpha = 0.18; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12; ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx + s * 168, 430);
                ctx.bezierCurveTo(cx + s * 198, 650, cx + s * 178, 850, cx + s * 205, 1000);
                ctx.stroke();
                ctx.globalAlpha = 1;
            });
            // 後方髮底
            ctx.beginPath();
            ctx.moveTo(cx - 160, 380);
            ctx.bezierCurveTo(cx - 200, 640, cx - 150, 860, cx, 940);
            ctx.bezierCurveTo(cx + 150, 860, cx + 200, 640, cx + 160, 380);
            ctx.closePath(); ctx.fill();
        } else if (ch.hairStyle === 'twin') {
            [-1, 1].forEach(function (s) {
                // 側髮
                ctx.beginPath();
                ctx.moveTo(cx + s * 140, 360);
                ctx.bezierCurveTo(cx + s * 200, 470, cx + s * 178, 640, cx + s * 150, 800);
                ctx.quadraticCurveTo(cx + s * 120, 830, cx + s * 112, 790);
                ctx.bezierCurveTo(cx + s * 128, 610, cx + s * 118, 470, cx + s * 96, 420);
                ctx.closePath(); ctx.fill();
                // 馬尾(波浪 S 型)
                ctx.beginPath();
                ctx.moveTo(cx + s * 150, 320);
                ctx.bezierCurveTo(cx + s * 250, 380, cx + s * 210, 520, cx + s * 262, 640);
                ctx.bezierCurveTo(cx + s * 300, 720, cx + s * 240, 760, cx + s * 218, 860);
                ctx.bezierCurveTo(cx + s * 210, 940, cx + s * 160, 950, cx + s * 152, 880);
                ctx.bezierCurveTo(cx + s * 150, 770, cx + s * 200, 700, cx + s * 178, 600);
                ctx.bezierCurveTo(cx + s * 160, 520, cx + s * 130, 440, cx + s * 118, 360);
                ctx.closePath(); ctx.fill();
                // 髮束
                ctx.strokeStyle = hairDK; ctx.lineWidth = 16; ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx + s * 148, 336); ctx.lineTo(cx + s * 178, 350);
                ctx.stroke();
                ctx.globalAlpha = 0.16; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10;
                ctx.beginPath();
                ctx.moveTo(cx + s * 232, 520); ctx.quadraticCurveTo(cx + s * 248, 660, cx + s * 234, 800);
                ctx.stroke();
                ctx.globalAlpha = 1;
            });
        } else if (ch.hairStyle === 'bun') {
            ctx.beginPath();
            ctx.moveTo(cx - 150, 380);
            ctx.bezierCurveTo(cx - 185, 600, cx - 130, 780, cx, 830);
            ctx.bezierCurveTo(cx + 130, 780, cx + 185, 600, cx + 150, 380);
            ctx.closePath(); ctx.fill();
            // 髮髻(高置大圓 + 底部髮圈,清楚可辨是包頭)
            ctx.beginPath(); ctx.ellipse(cx, 152, 95, 70, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = hairDK;
            ctx.beginPath(); ctx.ellipse(cx, 198, 66, 20, 0, 0, Math.PI * 2); ctx.fill();
            // 單條綁髮弧線
            ctx.strokeStyle = hairDK; ctx.lineWidth = 9; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx - 56, 134); ctx.quadraticCurveTo(cx, 182, cx + 56, 134); ctx.stroke();
            // 髮髻光澤
            ctx.globalAlpha = 0.22; ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.ellipse(cx - 30, 122, 32, 15, -0.5, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        } else { // short — 鮑伯頭
            ctx.beginPath();
            ctx.moveTo(cx - 130, 350);
            ctx.bezierCurveTo(cx - 190, 430, cx - 182, 560, cx - 150, 660);
            ctx.quadraticCurveTo(cx - 120, 690, cx - 96, 672);
            ctx.bezierCurveTo(cx - 118, 560, cx - 112, 470, cx - 92, 420);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 130, 350);
            ctx.bezierCurveTo(cx + 190, 430, cx + 182, 560, cx + 150, 660);
            ctx.quadraticCurveTo(cx + 120, 690, cx + 96, 672);
            ctx.bezierCurveTo(cx + 118, 560, cx + 112, 470, cx + 92, 420);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - 152, 372);
            ctx.bezierCurveTo(cx - 196, 560, cx - 158, 640, cx, 668);
            ctx.bezierCurveTo(cx + 158, 640, cx + 196, 560, cx + 152, 372);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        // ---------- 身體:脖子/肩線/手臂/裙身 ----------
        // 脖子(帶陰影)
        ctx.fillStyle = vGrad(ctx, 0, 620, 0, 710, darken(P.skin, 0.94), darken(P.skin, 0.8));
        ctx.beginPath();
        ctx.moveTo(cx - 34, 630); ctx.lineTo(cx + 34, 630);
        ctx.quadraticCurveTo(cx + 30, 672, cx + 40, 700);
        ctx.lineTo(cx - 40, 700); ctx.quadraticCurveTo(cx - 30, 672, cx - 34, 630);
        ctx.closePath(); ctx.fill();

        var dressG = vGrad(ctx, 0, 700, 0, 1280, P.outfit, darken(P.outfitDark, 0.72));

        // 裙身:上身合腰 → A 字裙擺
        ctx.fillStyle = dressG;
        ctx.beginPath();
        ctx.moveTo(cx - 112, 706);
        ctx.bezierCurveTo(cx - 128, 760, cx - 122, 830, cx - 108, 900);   // 左腰
        ctx.bezierCurveTo(cx - 190, 960, cx - 252, 1090, cx - 268, 1280);  // 左裙擺
        ctx.lineTo(cx + 268, 1280);
        ctx.bezierCurveTo(cx + 252, 1090, cx + 190, 960, cx + 108, 900);  // 右裙擺
        ctx.bezierCurveTo(cx + 122, 830, cx + 128, 760, cx + 112, 706);   // 右腰
        ctx.bezierCurveTo(cx + 60, 690, cx - 60, 690, cx - 112, 706);      // 肩領口
        ctx.closePath(); ctx.fill();
        // 腰帶
        ctx.fillStyle = darken(P.outfitDark, 0.75);
        ctx.fillRect(cx - 112, 878, 224, 26);
        // 裙褶陰影(兩道柔和陰影)
        ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = darken(P.outfitDark, 0.55);
        [-90, 90].forEach(function (dx) {
            ctx.beginPath();
            ctx.moveTo(cx + dx * 0.7, 940);
            ctx.quadraticCurveTo(cx + dx, 1100, cx + dx * 1.6, 1280);
            ctx.quadraticCurveTo(cx + dx * 1.6 + 26, 1280, cx + dx * 1.6 + 30, 1272);
            ctx.quadraticCurveTo(cx + dx + 30, 1100, cx + dx * 0.7 + 24, 942);
            ctx.closePath(); ctx.fill();
        });
        ctx.restore();

        // 手臂(袖) — 畫在裙身之後,袖/手自然垂在裙側前方
        [-1, 1].forEach(function (s) {
            var sleeveG = vGrad(ctx, 0, 742, 0, 1040, darken(P.outfit, 0.94), darken(P.outfitDark, 0.78));
            ctx.fillStyle = sleeveG;
            ctx.beginPath();
            ctx.moveTo(cx + s * 108, 742);
            ctx.bezierCurveTo(cx + s * 176, 764, cx + s * 208, 880, cx + s * 198, 1010);
            ctx.lineTo(cx + s * 152, 1014);
            ctx.bezierCurveTo(cx + s * 158, 900, cx + s * 136, 812, cx + s * 96, 790);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = darken(P.outfitDark, 0.6); ctx.lineWidth = 5;
            ctx.stroke();
            // 袖口
            ctx.fillStyle = darken(P.outfitDark, 0.8);
            ctx.beginPath();
            ctx.ellipse(cx + s * 175, 1002, 28, 16, s * 0.12, 0, Math.PI * 2);
            ctx.fill();
            // 手
            ctx.fillStyle = P.skin;
            ctx.beginPath();
            ctx.ellipse(cx + s * 175, 1040, 22, 26, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        // 衣領(依 collarType 差異化)
        ctx.fillStyle = '#f5f6fa';
        if (collarType === 0) { // 水手領
            ctx.beginPath();
            ctx.moveTo(cx - 96, 702);
            ctx.quadraticCurveTo(cx, 742, cx + 96, 702);
            ctx.lineTo(cx + 118, 766);
            ctx.quadraticCurveTo(cx, 820, cx - 118, 766);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = darken(P.outfitDark, 0.9); ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(cx - 104, 700); ctx.quadraticCurveTo(cx, 738, cx + 104, 700); ctx.stroke();
        } else if (collarType === 1) { // 蝴蝶結領
            ctx.beginPath();
            ctx.moveTo(cx - 92, 706);
            ctx.quadraticCurveTo(cx, 760, cx + 92, 706);
            ctx.quadraticCurveTo(cx + 66, 800, cx, 812);
            ctx.quadraticCurveTo(cx - 66, 800, cx - 92, 706);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = P.hair;
            ctx.beginPath();
            ctx.moveTo(cx, 800); ctx.lineTo(cx - 58, 766); ctx.quadraticCurveTo(cx - 72, 802, cx - 58, 838); ctx.lineTo(cx, 822);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx, 800); ctx.lineTo(cx + 58, 766); ctx.quadraticCurveTo(cx + 72, 802, cx + 58, 838); ctx.lineTo(cx, 822);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = darken(P.hairDark, 0.8);
            ctx.beginPath(); ctx.ellipse(cx, 812, 15, 18, 0, 0, Math.PI * 2); ctx.fill();
        } else { // 圍巾領
            ctx.beginPath();
            ctx.moveTo(cx - 100, 704);
            ctx.quadraticCurveTo(cx, 756, cx + 100, 704);
            ctx.quadraticCurveTo(cx + 84, 806, cx, 830);
            ctx.quadraticCurveTo(cx - 84, 806, cx - 100, 704);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = darken(P.hair, 0.92);
            ctx.beginPath();
            ctx.moveTo(cx + 30, 806); ctx.lineTo(cx + 96, 850); ctx.lineTo(cx + 60, 878); ctx.lineTo(cx + 18, 836);
            ctx.closePath(); ctx.fill();
        }

        // ---------- 臉(更圓潤的下巴線) ----------
        var faceG = ctx.createRadialGradient(cx, 420, 40, cx, 460, 220);
        faceG.addColorStop(0, '#fff2f0');
        faceG.addColorStop(0.5, P.skin);
        faceG.addColorStop(1, darken(P.skin, 0.88));
        ctx.fillStyle = faceG;
        ctx.beginPath();
        ctx.moveTo(cx - 150, 415);
        ctx.bezierCurveTo(cx - 154, 300, cx - 92, 242, cx, 242);
        ctx.bezierCurveTo(cx + 92, 242, cx + 154, 300, cx + 150, 415);
        ctx.bezierCurveTo(cx + 146, 520, cx + 108, 610, cx, 650);
        ctx.bezierCurveTo(cx - 108, 610, cx - 146, 520, cx - 150, 415);
        ctx.closePath(); ctx.fill();
        // 耳朵
        [-1, 1].forEach(function (s) {
            ctx.beginPath();
            ctx.ellipse(cx + s * 148, 480, 20, 34, 0, 0, Math.PI * 2);
            ctx.fillStyle = darken(P.skin, 0.93); ctx.fill();
        });

        // ---------- 五官 ----------
        // 眉(細而柔和)
        ctx.strokeStyle = darken(P.hairDark, 0.72); ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 100, 462); ctx.quadraticCurveTo(cx - 74, 450, cx - 48, 458); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 100, 462); ctx.quadraticCurveTo(cx + 74, 450, cx + 48, 458); ctx.stroke();

        // 眼睛(左右對稱、視線一致;瀏海底 435 與眼頂 470 保持距離)
        var eyeY = 512, eyeDX = 86;
        function eyeV2(ex) {
            var tilt = (eyeShape === 2) ? 0.16 : (eyeShape === 1 ? 0.08 : 0);
            var ry = (eyeShape === 1) ? 30 : 34;
            var rx = 34;
            ctx.save();
            ctx.translate(ex, eyeY);
            ctx.rotate(tilt * (ex < cx ? -1 : 1) * -1); // 外角微揚
            // 眼白
            ctx.fillStyle = '#fbfcff';
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            // 虹膜(上方亮的放射漸層)
            var iris = ctx.createRadialGradient(-4, -8, 4, 0, 0, 30);
            iris.addColorStop(0, lighten(P.eye, 1.45));
            iris.addColorStop(0.55, P.eye);
            iris.addColorStop(1, darken(P.eye, 0.45));
            ctx.fillStyle = iris;
            ctx.beginPath();
            ctx.ellipse(0, 2, 25, 27, 0, 0, Math.PI * 2);
            ctx.fill();
            // 瞳孔(兩眼注視同一方向)
            ctx.fillStyle = '#221a33';
            ctx.beginPath();
            ctx.ellipse(-2, 4, 12, 16, 0, 0, Math.PI * 2);
            ctx.fill();
            // 高光(大 + 小,兩眼一致)
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.beginPath(); ctx.ellipse(-10, -10, 9, 11, -0.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath(); ctx.ellipse(12, 12, 5, 6, 0.3, 0, Math.PI * 2); ctx.fill();
            // 上睫毛(輕薄曲線,外角小翼)
            ctx.strokeStyle = '#241d33'; ctx.lineWidth = 9; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-rx + 4, -ry + 8);
            ctx.quadraticCurveTo(-10, -ry - 4, rx - 14, -ry + 4);
            ctx.stroke();
            // 下眼線(淡)
            ctx.strokeStyle = 'rgba(36,29,51,0.28)'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-20, ry - 3);
            ctx.quadraticCurveTo(0, ry + 4, 22, ry - 5);
            ctx.stroke();
            ctx.restore();
        }
        eyeV2(cx - eyeDX);
        eyeV2(cx + eyeDX);

        // 鼻(小而可辨)
        ctx.strokeStyle = 'rgba(150,90,90,0.5)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 4, 566); ctx.quadraticCurveTo(cx + 4, 576, cx - 2, 580); ctx.stroke();

        // 嘴(依 mouthType 差異化,尺寸加大)
        ctx.strokeStyle = '#c4566b'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        if (mouthType === 0) { // 微笑
            ctx.beginPath(); ctx.moveTo(cx - 30, 602); ctx.quadraticCurveTo(cx, 622, cx + 30, 602); ctx.stroke();
        } else if (mouthType === 1) { // 開口笑
            ctx.fillStyle = '#c4566b';
            ctx.beginPath();
            ctx.moveTo(cx - 26, 600);
            ctx.quadraticCurveTo(cx, 594, cx + 26, 600);
            ctx.quadraticCurveTo(cx, 636, cx - 26, 600);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#e88a9a';
            ctx.beginPath(); ctx.ellipse(cx, 626, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
        } else { // 貓嘴
            ctx.beginPath(); ctx.moveTo(cx - 24, 602); ctx.quadraticCurveTo(cx - 10, 616, cx, 604); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + 24, 602); ctx.quadraticCurveTo(cx + 10, 616, cx, 604); ctx.stroke();
        }

        // 腮紅(眼下外側 + 斜線光暈)
        [-1, 1].forEach(function (s) {
            var blush = ctx.createRadialGradient(cx + s * 118, 566, 4, cx + s * 118, 566, 40);
            blush.addColorStop(0, 'rgba(242,140,150,0.34)');
            blush.addColorStop(1, 'rgba(242,140,150,0)');
            ctx.fillStyle = blush;
            ctx.beginPath(); ctx.ellipse(cx + s * 118, 566, 38, 26, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(242,140,150,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
            for (var b = 0; b < 3; b++) {
                ctx.beginPath();
                ctx.moveTo(cx + s * (100 + b * 12), 552);
                ctx.lineTo(cx + s * (94 + b * 12), 578);
                ctx.stroke();
            }
        });

        // ---------- 瀏海(依 bangType;底端 435,不壓眼) ----------
        ctx.fillStyle = hairG;
        if (bangType === 0) { // 柔和圓弧瀏海
            ctx.beginPath();
            ctx.moveTo(cx - 154, 412);
            ctx.bezierCurveTo(cx - 158, 296, cx - 96, 232, cx, 230);
            ctx.bezierCurveTo(cx + 96, 232, cx + 158, 296, cx + 154, 412);
            ctx.bezierCurveTo(cx + 130, 380, cx + 104, 372, cx + 88, 396);
            ctx.quadraticCurveTo(cx + 78, 414, cx + 60, 434);
            ctx.quadraticCurveTo(cx + 44, 404, cx + 34, 392);
            ctx.quadraticCurveTo(cx + 22, 412, cx + 8, 434);
            ctx.quadraticCurveTo(cx - 10, 404, cx - 26, 394);
            ctx.quadraticCurveTo(cx - 40, 416, cx - 56, 434);
            ctx.quadraticCurveTo(cx - 72, 406, cx - 92, 398);
            ctx.quadraticCurveTo(cx - 122, 380, cx - 154, 412);
            ctx.closePath(); ctx.fill();
        } else if (bangType === 1) { // 窗簾瀏海(中分)
            ctx.beginPath();
            ctx.moveTo(cx - 154, 415);
            ctx.bezierCurveTo(cx - 158, 296, cx - 96, 232, cx, 230);
            ctx.bezierCurveTo(cx + 96, 232, cx + 158, 296, cx + 154, 415);
            ctx.quadraticCurveTo(cx + 120, 330, cx + 62, 306);
            ctx.quadraticCurveTo(cx + 26, 300, cx + 4, 316);
            ctx.quadraticCurveTo(cx - 26, 300, cx - 62, 306);
            ctx.quadraticCurveTo(cx - 120, 330, cx - 154, 415);
            ctx.closePath(); ctx.fill();
        } else { // 公主瀏海(平瀏海 + 整齊弧緣)
            ctx.beginPath();
            ctx.moveTo(cx - 154, 408);
            ctx.bezierCurveTo(cx - 158, 296, cx - 96, 232, cx, 230);
            ctx.bezierCurveTo(cx + 96, 232, cx + 158, 296, cx + 154, 408);
            ctx.quadraticCurveTo(cx + 130, 420, cx + 104, 424);
            ctx.quadraticCurveTo(cx + 70, 430, cx + 36, 424);
            ctx.quadraticCurveTo(cx + 12, 421, cx, 424);
            ctx.quadraticCurveTo(cx - 36, 430, cx - 70, 424);
            ctx.quadraticCurveTo(cx - 104, 420, cx - 130, 422);
            ctx.quadraticCurveTo(cx - 142, 416, cx - 154, 408);
            ctx.closePath(); ctx.fill();
        }
        // 鬢角(框臉長瀏,尖端柔順)
        [-1, 1].forEach(function (s) {
            ctx.beginPath();
            ctx.moveTo(cx + s * 150, 400);
            ctx.bezierCurveTo(cx + s * 172, 470, cx + s * 160, 590, cx + s * 122, 706);
            ctx.quadraticCurveTo(cx + s * 92, 716, cx + s * 88, 662);
            ctx.bezierCurveTo(cx + s * 112, 566, cx + s * 112, 470, cx + s * 96, 412);
            ctx.closePath(); ctx.fill();
        });
        // 頂部髮絲高光
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 104, 302);
        ctx.quadraticCurveTo(cx, 252, cx + 104, 302);
        ctx.stroke();
        ctx.restore();

        // ---------- 配件(依 accessory) ----------
        if (accessory === 1) { // 呆毛(小捲曲,細線,髮梢收尾)
            ctx.strokeStyle = P.hair; ctx.lineWidth = 11; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx - 6, 240);
            ctx.bezierCurveTo(cx - 26, 186, cx + 8, 152, cx + 42, 168);
            ctx.stroke();
            ctx.strokeStyle = hairDK; ctx.lineWidth = 9;
            ctx.beginPath();
            ctx.moveTo(cx + 36, 172);
            ctx.quadraticCurveTo(cx + 54, 178, cx + 46, 198);
            ctx.stroke();
        } else if (accessory === 2) { // 髮夾(星形,取瞳色)
            drawStar(ctx, cx - 96, 330, 22, P.eye, 0.95);
            ctx.strokeStyle = lighten(P.eye, 1.2); ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(cx - 118, 344); ctx.lineTo(cx - 74, 344); ctx.stroke();
        } else if (accessory === 3) { // 側蝴蝶結
            var bx = cx + 118, by = 320;
            ctx.fillStyle = lighten(P.eye, 1.1);
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(bx + 46, by - 24); ctx.quadraticCurveTo(bx + 58, by + 4, bx + 46, by + 30); ctx.lineTo(bx, by + 12);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(bx - 46, by - 24); ctx.quadraticCurveTo(bx - 58, by + 4, bx - 46, by + 30); ctx.lineTo(bx, by + 12);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = darken(P.eye, 0.7);
            ctx.beginPath(); ctx.ellipse(bx, by + 6, 12, 14, 0, 0, Math.PI * 2); ctx.fill();
        }

        // ---------- 輪廓光(右側 rim light) ----------
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(cx + 152, 400);
        ctx.bezierCurveTo(cx + 158, 300, cx + 96, 236, cx, 234);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 176, 760);
        ctx.bezierCurveTo(cx + 208, 880, cx + 252, 1080, cx + 268, 1280);
        ctx.stroke();
        ctx.restore();

        // ---------- 暗角 ----------
        var vig = ctx.createRadialGradient(cx, 560, 380, cx, 560, 900);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
    }

    function renderArt(ch, rarity, width, height, mode) {
        // mode: 'bust'(預設) = 胸部以上特寫 — 圖鑑卡片/詳情臉部清晰可辨;
        //       'full' = 全身立繪 — 放大檢視用
        var bust = (mode !== 'full');
        var key = ch.id + '@' + (width || AR_W) + (bust ? 'b' : 'f');
        if (artCache[key]) return artCache[key];
        var cv = document.createElement('canvas');
        cv.width = AR_W * SS; cv.height = AR_H * SS;
        var ctx = cv.getContext('2d');
        // 注意:drawArt 本身就以 1024×1280(=512×640 的 2× 超取樣)座標繪製,
        // 這裡「不可」再 ctx.scale(SS,SS),否則座標系被壓成 512×640,
        // 圖會溢出只剩左上角(角色被切成右緣半臉特寫)。
        drawArt(ctx, ch, rarity);
        var out = document.createElement('canvas');
        out.width = width || AR_W;
        out.height = height || AR_H;
        var octx = out.getContext('2d');
        octx.imageSmoothingEnabled = true;
        octx.imageSmoothingQuality = 'high';
        if (bust) {
            // 胸部以上特寫:自主畫布裁 (192,100,640,800) — 頭+肩 4:5 構圖,臉部在卡片上清晰可辨
            octx.drawImage(cv, 192, 100, 640, 800, 0, 0, out.width, out.height);
        } else {
            octx.drawImage(cv, 0, 0, out.width, out.height);
        }
        artCache[key] = out;
        return out;
    }

    function artDataURL(ch, rarity, width, height, mode) {
        try { return renderArt(ch, rarity, width, height, mode).toDataURL('image/png'); } catch (e) { return ''; }
    }

    // ================= 圖鑑 UI =================
    var RARITY_ORDER = { SSR: 0, SR: 1, R: 2, N: 3 };
    var RARITY_COLOR = { N: '#8b9aa9', R: '#4aa3ff', SR: '#c07bff', SSR: '#ffd700' };
    var CATEGORY_LABELS = [
        { key: 'all', label: '全部' },
        { key: 'manosaba', label: '二創・魔女審判' },
        { key: 'noexist', label: '二創・不存在的你和我' },
        { key: 'tactical', label: '戰術部隊' }
    ];

    var codexModal = document.getElementById('codex-modal');
    var codexOpenBtn = document.getElementById('codex-btn');
    var codexCloseBtn = document.getElementById('codex-close-btn');
    var codexGrid = document.getElementById('codex-grid');
    var codexSearchInput = document.getElementById('codex-search');
    var codexTabsWrap = document.getElementById('codex-tabs');
    var codexProgressEl = document.getElementById('codex-progress');
    var codexDetailEl = document.getElementById('codex-detail');
    var codexZoomEl = document.getElementById('codex-zoom');
    var codexZoomImg = document.getElementById('codex-zoom-img');

    var codexCategory = 'all';
    var codexSearch = '';

    function ownedIds() {
        try { return (global.gachaState && Array.isArray(global.gachaState.warehouse)) ? global.gachaState.warehouse.map(function (w) { return w.id; }) : []; }
        catch (e) { return []; }
    }

    function renderCodexTabs() {
        if (!codexTabsWrap) return;
        codexTabsWrap.innerHTML = '';
        CATEGORY_LABELS.forEach(function (c) {
            var b = document.createElement('button');
            b.className = 'gacha-tab codex-tab' + (codexCategory === c.key ? ' active' : '');
            b.textContent = t(c.label);
            b.addEventListener('click', function () { codexCategory = c.key; renderCodex(); });
            codexTabsWrap.appendChild(b);
        });
    }

    function renderCodexProgress(owned) {
        if (!codexProgressEl) return;
        var total = (typeof CHARACTERS !== 'undefined') ? CHARACTERS.length : 17;
        codexProgressEl.textContent = tf('收藏進度：{owned} / {total}', { owned: owned.length, total: total });
    }

    function renderCodex() {
        if (!codexGrid || typeof CHARACTERS === 'undefined') return;
        renderCodexTabs();
        var owned = ownedIds();
        renderCodexProgress(owned);
        var q = codexSearch.trim().toLowerCase();
        var list = CHARACTERS.filter(function (c) {
            if (codexCategory !== 'all' && c.source !== codexCategory) return false;
            if (!q) return true;
            var name = String(c.name).toLowerCase();
            var nameTh = String(t(c.name)).toLowerCase();
            return name.indexOf(q) !== -1 || nameTh.indexOf(q) !== -1 || c.id.indexOf(q) !== -1;
        }).slice().sort(function (a, b) {
            var ra = RARITY_ORDER[a.rarity] !== undefined ? RARITY_ORDER[a.rarity] : 9;
            var rb = RARITY_ORDER[b.rarity] !== undefined ? RARITY_ORDER[b.rarity] : 9;
            return ra - rb;
        });
        codexGrid.innerHTML = '';
        if (!list.length) {
            codexGrid.innerHTML = '<div class="codex-empty">' + t('沒有符合的角色') + '</div>';
            return;
        }
        list.forEach(function (c) {
            var isOwned = owned.indexOf(c.id) !== -1;
            var card = document.createElement('div');
            card.className = 'codex-card rarity-' + c.rarity + (isOwned ? ' codex-owned' : '');
            card.dataset.charId = c.id;
            var img = artDataURL(c, c.rarity, 128, 160);
            card.innerHTML =
                '<div class="codex-card-art">' + (img ? '<img src="' + img + '" alt="">' : '') + '</div>' +
                '<div class="codex-card-name">' + t(c.name) + '</div>' +
                '<div class="codex-card-rarity">' + c.rarity + '</div>' +
                '<div class="codex-card-badge">' + t(isOwned ? '已獲得' : '未獲得') + '</div>';
            card.addEventListener('click', function () { openCodexDetail(c); });
            codexGrid.appendChild(card);
        });
    }

    var codexStatMax = { hp: 100, atk: 20, def: 12, spd: 120 };
    var codexStatLabels = { hp: '生命', atk: '攻擊', def: '防禦', spd: '速度' };

    function openCodexDetail(c) {
        if (!codexDetailEl) return;
        var isOwned = ownedIds().indexOf(c.id) !== -1;
        var bigImg = artDataURL(c, c.rarity, 256, 320);
        var statHtml = ['hp', 'atk', 'def', 'spd'].map(function (k) {
            var v = c.stats[k] || 0, max = codexStatMax[k] || 100;
            var pct = Math.max(4, Math.min(100, Math.round(v / max * 100)));
            return '<div class="char-stat-row"><span class="char-stat-label">' + t(codexStatLabels[k]) + '</span>' +
                '<div class="char-stat-track"><div class="char-stat-fill" style="width:' + pct + '%"></div></div>' +
                '<span class="char-stat-value">' + v + '</span></div>';
        }).join('');
        codexDetailEl.innerHTML =
            '<button id="codex-detail-close" class="close-btn codex-detail-close">&times;</button>' +
            '<div class="codex-detail-art" id="codex-detail-art">' + (bigImg ? '<img src="' + bigImg + '" alt="">' : '') + '</div>' +
            '<div class="codex-detail-info">' +
                '<div class="codex-detail-name">' + t(c.name) + ' <span class="codex-detail-rarity rarity-' + c.rarity + '">' + c.rarity + '</span></div>' +
                '<div class="codex-detail-badge">' + t(isOwned ? '已獲得' : '未獲得') + '</div>' +
                statHtml +
                '<div class="char-detail-section-title">' + t('專屬技能') + '：' + t(c.skill.name) + '</div>' +
                '<div class="char-skill-desc">' + t(c.skill.desc) + '</div>' +
                '<div class="char-detail-section-title">' + t('原創背景故事') + '</div>' +
                '<p class="char-story-text codex-story">' + t(c.story) + '</p>' +
                '<div class="codex-detail-tagline">『' + t(c.tagline) + '』</div>' +
            '</div>';
        codexDetailEl.classList.remove('hidden');
        var artEl = document.getElementById('codex-detail-art');
        if (artEl) artEl.addEventListener('click', function () { openCodexZoom(c); });
        var closeBtn = document.getElementById('codex-detail-close');
        if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); codexDetailEl.classList.add('hidden'); });
    }

    function openCodexZoom(c) {
        if (!codexZoomEl || !codexZoomImg) return;
        codexZoomImg.src = artDataURL(c, c.rarity, 512, 640, 'full');
        codexZoomEl.classList.remove('hidden');
    }

    if (codexOpenBtn) codexOpenBtn.addEventListener('click', function () {
        if (!codexModal) return;
        if (codexDetailEl) codexDetailEl.classList.add('hidden');
        renderCodex();
        codexModal.classList.remove('hidden');
    });
    if (codexCloseBtn) codexCloseBtn.addEventListener('click', function () { if (codexModal) codexModal.classList.add('hidden'); });
    if (codexModal) codexModal.addEventListener('click', function (e) { if (e.target === codexModal) codexModal.classList.add('hidden'); });
    if (codexZoomEl) codexZoomEl.addEventListener('click', function () { codexZoomEl.classList.add('hidden'); });
    if (codexSearchInput) codexSearchInput.addEventListener('input', function () {
        codexSearch = codexSearchInput.value || '';
        renderCodex();
    });

    global.CodexUI = { render: renderCodex, openDetail: openCodexDetail, art: artDataURL };
})(typeof window !== 'undefined' ? window : globalThis);
