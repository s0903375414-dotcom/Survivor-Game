const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const SharedConfig = require('./shared_config.js');

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = decodeURIComponent(filePath.split('?')[0]);
    const fullPath = path.join(__dirname, filePath);

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }
        
        const ext = path.extname(fullPath);
        const contentType = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ogg': 'audio/ogg',
            '.mp3': 'audio/mpeg',
            '.ico': 'image/x-icon',
            '.json': 'application/json',
            '.webmanifest': 'application/manifest+json'
        }[ext] || 'application/octet-stream';

        res.writeHead(200, { 
            'Content-Type': contentType,
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
        });
        res.end(data);
    });
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();
const MAX_PLAYERS_PER_ROOM = SharedConfig.MULTIPLAYER.MAX_PLAYERS_PER_ROOM || 8;
const MAX_SERVER_PLAYERS = SharedConfig.MULTIPLAYER.MAX_SERVER_PLAYERS || 20;

function createRoom(roomId, maxPlayers = 4, baseDifficulty = 1, gameMode = 'survival') {
    const clampedMax = Math.max(1, Math.min(MAX_PLAYERS_PER_ROOM, parseInt(maxPlayers, 10) || 4));
    const diff = baseDifficulty > 0 ? Number(baseDifficulty) || 1 : 1;
    const mode = ['survival', 'wave', 'boss'].includes(gameMode) ? gameMode : 'survival';
    return {
        id: roomId,
        maxPlayers: clampedMax,
        gameMode: mode,
        players: new Map(),
        enemies: [],
        bullets: [],
        xpOrbs: [],
        healthPacks: [],
        totalKills: 0,
        tick: 0,
        lastEnemySpawn: 0,
        lastHealthPackSpawn: 0,
        baseDifficulty: diff,
        difficulty: diff,
        wave: mode === 'wave' ? 1 : 0,
        waveEnemiesRemaining: 0,
        waveInProgress: false,
        createdAt: Date.now(),
        airStrikes: [],
        pendingUpgrades: new Map()
    };
}

rooms.set('中心指揮部', createRoom('中心指揮部'));

function broadcast(room, message) {
    const data = JSON.stringify(message);
    room.players.forEach(p => {
        if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(data);
        }
    });
}

function sendToPlayer(player, message) {
    if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
    }
}

function initPlayerUpgrades() {
    return {
        multishot: 0,
        fireRate: 0,
        damage: 0,
        speed: 0,
        hp: 0
    };
}

function calculatePlayerStats(player) {
    const base = SharedConfig.PLAYER;
    const up = player.upgrades;
    const units = player.units || {};
    
    let fireRateMult = 1 - (up.fireRate * 0.08);
    let damageMult = 1 + (up.damage * 0.15);
    let speedMult = 1 + (up.speed * 0.08);
    let maxHpMult = 1 + (up.hp * 0.15);
    let bulletCount = 1 + up.multishot;
    
    if (units.drone) bulletCount += 1;
    if (units.medic) maxHpMult += 0.2;
    
    return {
        fireRate: Math.max(50, base.FIRE_RATE * fireRateMult),
        damage: base.BULLET_DAMAGE * damageMult,
        speed: base.BASE_SPEED * speedMult,
        maxHp: base.BASE_HP * maxHpMult,
        bulletCount: bulletCount,
        bulletSpeed: base.BULLET_SPEED
    };
}

function rollUpgradeOptions() {
    const allUpgrades = Object.keys({
        multishot: { name: '火力網擴張', desc: '同步發射更多彈藥' },
        fireRate: { name: '射控優化', desc: '降低射擊冷卻時間' },
        damage: { name: '高能彈頭', desc: '強化子彈威力' },
        speed: { name: '推進強化', desc: '提升戰術移動速度' },
        hp: { name: '修復奈米', desc: '提升最大生命值' }
    });
    const shuffled = [...allUpgrades].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
}

function applyUpgrade(player, upgradeType) {
    if (!player.upgrades[upgradeType]) return false;
    player.upgrades[upgradeType]++;
    
    const stats = calculatePlayerStats(player);
    const oldMax = player.maxHp;
    player.maxHp = stats.maxHp;
    if (player.maxHp > oldMax) {
        player.hp += (player.maxHp - oldMax);
    }
    return true;
}

function spawnEnemy(room, forcedType = null) {
    if (room.players.size === 0) return;
    
    const firstPlayer = Array.from(room.players.values())[0];
    const side = Math.floor(Math.random() * 4);
    let ex, ey;
    const dist = 800;
    if (side === 0) { ex = firstPlayer.x - dist; ey = firstPlayer.y + (Math.random() * dist*2 - dist); }
    else if (side === 1) { ex = firstPlayer.x + dist; ey = firstPlayer.y + (Math.random() * dist*2 - dist); }
    else if (side === 2) { ey = firstPlayer.y - dist; ex = firstPlayer.x + (Math.random() * dist*2 - dist); }
    else { ey = firstPlayer.y + dist; ex = firstPlayer.x + (Math.random() * dist*2 - dist); }

    if (room.gameMode === 'boss') {
        if (room.enemies.filter(e => e.isBoss).length === 0) {
            const bossCfg = SharedConfig.SLIME_TYPES.boss;
            const bossId = `BOSS_${Date.now()}_${Math.random()}`;
            room.enemies.push({
                id: bossId,
                x: ex, y: ey,
                hp: 3000 + (room.difficulty * 800),
                maxHp: 3000 + (room.difficulty * 800),
                speed: bossCfg.speedMult,
                radius: bossCfg.radius,
                type: 'boss',
                isBoss: true,
                name: bossCfg.name
            });
            broadcast(room, { type: 'notification', key: '🚨 要塞級威脅降臨：{name}！ 🚨', vars: { name: bossCfg.name } });
            return;
        }
    }

    if (room.totalKills > 0 && room.totalKills % SharedConfig.BOSS_SPAWN_INTERVAL === 0 && !room.enemies.some(e => e.isBoss)) {
        const bossCfg = SharedConfig.SLIME_TYPES.boss;
        room.enemies.push({
            id: `BOSS_${Date.now()}`,
            x: ex, y: ey,
            hp: 2000 + (room.difficulty * 500),
            maxHp: 2000 + (room.difficulty * 500),
            speed: bossCfg.speedMult,
            radius: bossCfg.radius,
            type: 'boss',
            isBoss: true,
            name: bossCfg.name
        });
        broadcast(room, { type: 'notification', key: '🚨 強力生物特徵已偵測：{name} 進入戰場！ 🚨', vars: { name: bossCfg.name } });
        return;
    }

    const types = ['normal', 'fast', 'tank', 'elite', 'gold'];
    const weights = [60, 20, 10, 8, 2];
    let selectedType = forcedType || 'normal';
    
    if (!forcedType) {
        let rand = Math.random() * 100;
        let sum = 0;
        for (let i = 0; i < types.length; i++) {
            sum += weights[i];
            if (rand <= sum) {
                selectedType = types[i];
                break;
            }
        }
    }

    const cfg = SharedConfig.SLIME_TYPES[selectedType];
    const baseHp = 50 + (room.difficulty * 20);
    room.enemies.push({
        id: `E_${Date.now()}_${Math.random()}`,
        x: ex, y: ey,
        hp: baseHp * cfg.hpMult,
        maxHp: baseHp * cfg.hpMult,
        speed: cfg.speedMult + (room.difficulty * 0.05),
        radius: cfg.radius,
        type: selectedType,
        name: cfg.name
    });
}

function gameLoop() {
    rooms.forEach((room, roomId) => {
        if (room.players.size === 0) return;
        
        const now = Date.now();
        room.tick++;

        room.players.forEach(player => {
            if (!player.alive) return;
            
            const stats = calculatePlayerStats(player);
            
            if (player.input) {
                const dx = player.input.dx || 0;
                const dy = player.input.dy || 0;
                if (dx !== 0 || dy !== 0) {
                    const len = Math.hypot(dx, dy);
                    player.x += (dx / len) * stats.speed;
                    player.y += (dy / len) * stats.speed;
                }
                
                if (player.input.shooting && now - player.lastShot > stats.fireRate) {
                    const angle = player.input.angle || 0;
                    const bulletCount = stats.bulletCount;
                    const spread = 0.15;
                    
                    for (let i = 0; i < bulletCount; i++) {
                        const offsetAngle = bulletCount === 1 ? 0 : 
                            (i - (bulletCount - 1) / 2) * spread;
                        const bAngle = angle + offsetAngle;
                        room.bullets.push({
                            x: player.x,
                            y: player.y,
                            vx: Math.cos(bAngle) * stats.bulletSpeed,
                            vy: Math.sin(bAngle) * stats.bulletSpeed,
                            ownerId: player.id,
                            damage: stats.damage
                        });
                    }
                    player.lastShot = now;
                }
            }
            
            if (player.upgrades.hp > 0) {
                const regenRate = 0.02 * player.upgrades.hp;
                player.hp = Math.min(player.maxHp, player.hp + regenRate);
            }
        });

        if (room.gameMode === 'wave') {
            if (!room.waveInProgress && room.enemies.length === 0) {
                room.waveInProgress = true;
                room.waveEnemiesRemaining = 5 + room.wave * 3;
                broadcast(room, { type: 'notification', key: '🌊 第 {wave} 波開始！剩餘敵人：{waveEnemiesRemaining}', vars: { wave: room.wave, waveEnemiesRemaining: room.waveEnemiesRemaining } });
            }
        }

        const spawnCondition = room.gameMode === 'wave' 
            ? (room.waveInProgress && room.waveEnemiesRemaining > 0)
            : true;
            
        if (spawnCondition) {
            const spawnInterval = room.gameMode === 'wave' 
                ? Math.max(300, 1000 - room.wave * 30)
                : Math.max(500, 2000 - (room.difficulty * 100));
            
            if (now - room.lastEnemySpawn > spawnInterval) {
                spawnEnemy(room);
                if (room.gameMode === 'wave') room.waveEnemiesRemaining--;
                room.lastEnemySpawn = now;
                room.difficulty += room.gameMode === 'wave' ? 0.02 : 0.01;
            }
            
            if (room.gameMode === 'wave' && room.waveEnemiesRemaining <= 0 && room.enemies.length === 0) {
                room.waveInProgress = false;
                room.wave++;
                broadcast(room, { 
                    type: 'notification', 
                    key: '✅ 第 {wave1} 波完成！獎勵 +100 XP，準備下一波...', vars: { wave1: room.wave - 1 } 
                });
                room.players.forEach(p => {
                    if (p.alive) {
                        p.xp += 100;
                        checkPlayerLevelUp(room, p);
                    }
                });
            }
        } else if (room.gameMode !== 'wave') {
            const spawnInterval = Math.max(500, 2000 - (room.difficulty * 100));
            if (now - room.lastEnemySpawn > spawnInterval) {
                spawnEnemy(room);
                room.lastEnemySpawn = now;
                room.difficulty += 0.01;
            }
        }

        if (now - room.lastHealthPackSpawn > 15000 && room.healthPacks.length < 3) {
            const firstPlayer = room.players.values().next().value;
            room.healthPacks.push({
                id: `H_${now}`,
                x: firstPlayer.x + (Math.random() * 1000 - 500),
                y: firstPlayer.y + (Math.random() * 1000 - 500)
            });
            room.lastHealthPackSpawn = now;
        }

        room.enemies.forEach(enemy => {
            let closestPlayer = null;
            let minDist = Infinity;
            room.players.forEach(p => {
                if (!p.alive) return;
                const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (d < minDist) { minDist = d; closestPlayer = p; }
            });

            if (closestPlayer) {
                const angle = Math.atan2(closestPlayer.y - enemy.y, closestPlayer.x - enemy.x);
                enemy.x += Math.cos(angle) * enemy.speed;
                enemy.y += Math.sin(angle) * enemy.speed;

                if (minDist < enemy.radius + 10) {
                    const dmg = enemy.isBoss ? 1.5 : (enemy.type === 'elite' ? 0.8 : 0.5);
                    closestPlayer.hp -= dmg;
                    if (closestPlayer.hp <= 0 && closestPlayer.alive) {
                        handlePlayerDeath(room, closestPlayer);
                    }
                }
            }
        });

        room.airStrikes = room.airStrikes.filter(strike => {
            const elapsed = now - strike.startTime;
            if (elapsed >= 1500 && !strike.exploded) {
                strike.exploded = true;
                room.enemies.forEach((e, idx) => {
                    const d = Math.hypot(e.x - strike.x, e.y - strike.y);
                    if (d < 150) {
                        e.hp -= 200;
                        if (e.hp <= 0) {
                            killEnemy(room, e, strike.ownerId);
                        }
                    }
                });
                broadcast(room, {
                    type: 'airstrike_explode',
                    x: strike.x,
                    y: strike.y
                });
                return false;
            }
            if (elapsed < 2000) return true;
            return false;
        });

        room.xpOrbs.forEach((orb, index) => {
            let picked = false;
            room.players.forEach(p => {
                if (!p.alive || picked) return;
                if (Math.hypot(p.x - orb.x, p.y - orb.y) < 40) {
                    const playerCount = room.players.size;
                    const bonusMult = playerCount > 1 ? 1 + ((playerCount - 1) * SharedConfig.MULTIPLAYER.XP_BONUS_PER_PLAYER) : 1;
                    const units = p.units || {};
                    const logisticsMult = units.logistics ? 1.2 : 1;
                    
                    p.xp += Math.floor(orb.value * bonusMult * logisticsMult);
                    p.score += orb.value;
                    
                    sendToPlayer(p, { type: 'pickup', item: 'xp' });
                    checkPlayerLevelUp(room, p);
                    picked = true;
                }
            });
            if (picked) room.xpOrbs.splice(index, 1);
        });

        room.healthPacks.forEach((pack, index) => {
            let picked = false;
            room.players.forEach(p => {
                if (!p.alive || picked) return;
                if (Math.hypot(p.x - pack.x, p.y - pack.y) < 30) {
                    p.hp = Math.min(p.maxHp, p.hp + SharedConfig.HEALTH_PACK_HEAL);
                    sendToPlayer(p, { type: 'pickup', item: 'health' });
                    picked = true;
                }
            });
            if (picked) room.healthPacks.splice(index, 1);
        });

        for (let i = room.bullets.length - 1; i >= 0; i--) {
            const b = room.bullets[i];
            b.x += b.vx;
            b.y += b.vy;
            let hit = false;
            for (let j = room.enemies.length - 1; j >= 0; j--) {
                const e = room.enemies[j];
                if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 5) {
                    e.hp -= (b.damage || 25);
                    hit = true;
                    if (e.hp <= 0) {
                        killEnemy(room, e, b.ownerId);
                    }
                    break;
                }
            }
            if (hit || Math.abs(b.x) > 10000 || Math.abs(b.y) > 10000) {
                room.bullets.splice(i, 1);
            }
        }

        room.players.forEach(p => {
            if (!p.alive && p.respawnAt && now >= p.respawnAt) {
                respawnPlayer(room, p);
            }
        });

        if (room.tick % 2 === 0) {
            const state = {
                type: 'state',
                tick: room.tick,
                gameMode: room.gameMode,
                wave: room.wave,
                totalKills: room.totalKills,
                players: Array.from(room.players.values()).map(p => ({
                    id: p.id, 
                    name: p.name, 
                    x: p.x, 
                    y: p.y, 
                    hp: p.hp, 
                    maxHp: p.maxHp, 
                    level: p.level, 
                    xp: p.xp, 
                    xpToNextLevel: p.xpToNextLevel,
                    score: p.score,
                    alive: p.alive,
                    respawnAt: p.respawnAt || 0,
                    airSupportReady: p.airSupportReady,
                    airSupportCooldownEnd: p.airSupportCooldownEnd || 0
                })),
                enemies: room.enemies.map(e => ({ 
                    x: e.x, y: e.y, type: e.type, hp: e.hp, maxHp: e.maxHp, 
                    radius: e.radius, isBoss: e.isBoss 
                })),
                bullets: room.bullets.map(b => ({ x: b.x, y: b.y })),
                xpOrbs: room.xpOrbs.map(o => ({ x: o.x, y: o.y })),
                healthPacks: room.healthPacks.map(h => ({ x: h.x, y: h.y })),
                airStrikes: room.airStrikes.map(s => ({ 
                    x: s.x, y: s.y, startTime: s.startTime 
                }))
            };
            broadcast(room, state);
        }
    });
}

function killEnemy(room, enemy, killerId) {
    room.totalKills++;
    const xpValue = enemy.isBoss ? 500 : (enemy.type === 'elite' ? 100 : (enemy.type === 'gold' ? 500 : 20));
    const scoreValue = enemy.isBoss ? 1000 : (enemy.type === 'elite' ? 200 : (enemy.type === 'gold' ? 500 : 10));
    
    room.xpOrbs.push({
        x: enemy.x, y: enemy.y,
        value: xpValue,
        id: `XP_${Date.now()}_${Math.random()}`
    });
    
    const idx = room.enemies.findIndex(e => e.id === enemy.id);
    if (idx !== -1) room.enemies.splice(idx, 1);
    
    const killer = room.players.get(killerId);
    if (killer && killer.alive) {
        killer.kills = (killer.kills || 0) + 1;
        killer.score += scoreValue;
    }
}

function checkPlayerLevelUp(room, player) {
    while (player.xp >= player.xpToNextLevel) {
        player.level++;
        player.xp -= player.xpToNextLevel;
        player.xpToNextLevel = Math.floor(player.xpToNextLevel * 1.2);
        player.hp = Math.min(player.maxHp, player.hp + SharedConfig.LEVEL_UP_HEAL);
        
        const options = rollUpgradeOptions();
        room.pendingUpgrades.set(player.id, options);
        
        sendToPlayer(player, {
            type: 'level_up',
            level: player.level,
            hp: player.hp,
            maxHp: player.maxHp,
            options: options
        });
    }
}

function handlePlayerDeath(room, player) {
    player.alive = false;
    player.hp = 0;
    const respawnTime = SharedConfig.MULTIPLAYER.RESPAWN_TIME_MS || 10000;
    player.respawnAt = Date.now() + respawnTime;
    
    sendToPlayer(player, {
        type: 'player_death',
        respawnAt: player.respawnAt,
        score: player.score,
        kills: player.kills || 0,
        level: player.level
    });
    
    broadcast(room, {
        type: 'notification',
        key: '💀 {name} 被擊敗，{v} 秒後復活', vars: { name: player.name, v: (respawnTime/1000).toFixed(0) }
    });
    
    const alivePlayers = Array.from(room.players.values()).filter(p => p.alive);
    if (alivePlayers.length === 0) {
        setTimeout(() => {
            const checkAlive = Array.from(room.players.values()).filter(p => p.alive);
            if (checkAlive.length === 0) {
                endRoomGame(room);
            }
        }, 3000);
    }
}

function respawnPlayer(room, player) {
    player.alive = true;
    player.x = 0;
    player.y = 0;
    player.hp = player.maxHp;
    player.respawnAt = null;
    
    sendToPlayer(player, {
        type: 'player_respawn',
        x: player.x,
        y: player.y,
        hp: player.hp
    });
    
    broadcast(room, {
        type: 'notification',
        key: '🔄 {name} 重返戰場！', vars: { name: player.name }
    });
}

function endRoomGame(room) {
    const results = [];
    room.players.forEach(p => {
        results.push({
            id: p.id,
            name: p.name,
            score: p.score || 0,
            kills: p.kills || 0,
            level: p.level,
            units: p.units || {}
        });
    });
    
    broadcast(room, {
        type: 'game_end',
        results: results,
        totalKills: room.totalKills,
        gameMode: room.gameMode,
        wave: room.wave
    });
    
    room.totalKills = 0;
    room.enemies = [];
    room.bullets = [];
    room.xpOrbs = [];
    room.healthPacks = [];
    room.airStrikes = [];
    room.difficulty = room.baseDifficulty;
    room.wave = room.gameMode === 'wave' ? 1 : 0;
    room.waveInProgress = false;
    
    room.players.forEach(p => {
        p.alive = true;
        p.x = 0;
        p.y = 0;
        p.hp = p.maxHp;
        p.level = 1;
        p.xp = 0;
        p.xpToNextLevel = 100;
        p.score = 0;
        p.kills = 0;
        p.upgrades = initPlayerUpgrades();
        p.airSupportReady = true;
        p.airSupportCooldownEnd = 0;
        p.respawnAt = null;
    });
    
    room.pendingUpgrades.clear();
}

setInterval(gameLoop, SharedConfig.TICK_MS);

wss.on('connection', (ws) => {
    let currentRoomId = null;
    let playerId = null;

    ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data); } catch (e) { return; }

        if (msg.type === 'get_rooms') {
            const roomList = Array.from(rooms.values()).map(r => ({
                id: r.id,
                playerCount: r.players.size,
                maxPlayers: r.maxPlayers || MAX_PLAYERS_PER_ROOM,
                difficulty: r.baseDifficulty || r.difficulty || 1,
                gameMode: r.gameMode || 'survival',
                wave: r.wave || 0
            }));
            ws.send(JSON.stringify({ type: 'room_list', rooms: roomList }));
        } 
        else if (msg.type === 'join') {
            const roomId = msg.roomId || '中心指揮部';
            const name = msg.name || '訪客';

            if (!playerId) {
                let totalPlayers = 0;
                rooms.forEach(r => totalPlayers += r.players.size);
                if (totalPlayers >= MAX_SERVER_PLAYERS) {
                    ws.send(JSON.stringify({ type: 'error', key: '大廳目前已滿員（最多 {MAX_SERVER_PLAYERS} 名指揮官）。', vars: { MAX_SERVER_PLAYERS: MAX_SERVER_PLAYERS } }));
                    return;
                }
            }
            
            if (!rooms.has(roomId)) {
                if (msg.create) {
                    const requestedMax = msg.maxPlayers;
                    const requestedDiff = msg.difficulty;
                    const requestedMode = msg.gameMode;
                    rooms.set(roomId, createRoom(roomId, requestedMax, requestedDiff, requestedMode));
                } else {
                    ws.send(JSON.stringify({ type: 'error', key: '找不到該房間' }));
                    return;
                }
            }

            const room = rooms.get(roomId);

            const limit = room.maxPlayers || MAX_PLAYERS_PER_ROOM;
            if (room.players.size >= limit) {
                ws.send(JSON.stringify({ type: 'error', key: '房間已滿' }));
                return;
            }

            for (let [id, p] of room.players) {
                if (p.name === name) {
                    console.log(`清理重複名稱之舊連線: ${name}`);
                    room.players.delete(id);
                    break; 
                }
            }

            playerId = `P_${Math.random().toString(36).substr(2, 9)}`;
            currentRoomId = roomId;
            
            const units = msg.units || {};
            const baseStats = SharedConfig.PLAYER;
            const maxHp = baseStats.BASE_HP * (units.medic ? 1.2 : 1);

            const newPlayer = {
                id: playerId,
                ws: ws,
                name: name,
                x: 0, y: 0,
                hp: maxHp, 
                maxHp: maxHp,
                speed: baseStats.BASE_SPEED,
                lastShot: 0,
                input: { dx: 0, dy: 0, shooting: false, angle: 0 },
                level: 1,
                xp: 0,
                xpToNextLevel: 100,
                score: 0,
                kills: 0,
                alive: true,
                upgrades: initPlayerUpgrades(),
                units: units,
                airSupportReady: true,
                airSupportCooldownEnd: 0,
                respawnAt: null,
                joinedAt: Date.now()
            };
            room.players.set(playerId, newPlayer);
            
            ws.send(JSON.stringify({ 
                type: 'joined', 
                playerId, 
                roomId,
                gameMode: room.gameMode,
                wave: room.wave,
                maxHp: newPlayer.maxHp
            }));
            
            broadcast(room, {
                type: 'notification',
                key: '📡 {name} 加入了 {roomId} ({size}/{limit})', vars: { name: name, roomId: roomId, size: room.players.size, limit: limit }
            });
            
            console.log(`Player ${name} joined ${roomId}, mode: ${room.gameMode}`);
        } 
        else if (msg.type === 'input' && playerId && currentRoomId) {
            const room = rooms.get(currentRoomId);
            if (room && room.players.has(playerId)) {
                const p = room.players.get(playerId);
                if (p.alive) {
                    p.input = msg;
                }
            }
        }
        else if (msg.type === 'select_upgrade' && playerId && currentRoomId) {
            const room = rooms.get(currentRoomId);
            if (room && room.players.has(playerId)) {
                const p = room.players.get(playerId);
                const options = room.pendingUpgrades.get(playerId);
                if (options && options.includes(msg.upgradeType)) {
                    applyUpgrade(p, msg.upgradeType);
                    room.pendingUpgrades.delete(playerId);
                    sendToPlayer(p, {
                        type: 'upgrade_applied',
                        upgradeType: msg.upgradeType,
                        level: p.level
                    });
                }
            }
        }
        else if (msg.type === 'use_air_support' && playerId && currentRoomId) {
            const room = rooms.get(currentRoomId);
            if (room && room.players.has(playerId)) {
                const p = room.players.get(playerId);
                const now = Date.now();
                if (p.alive && p.airSupportReady) {
                    const x = msg.x != null ? msg.x : p.x;
                    const y = msg.y != null ? msg.y : p.y;
                    
                    room.airStrikes.push({
                        x: x,
                        y: y,
                        startTime: now,
                        ownerId: playerId,
                        exploded: false
                    });
                    
                    p.airSupportReady = false;
                    const cd = SharedConfig.MULTIPLAYER.AIR_SUPPORT_COOLDOWN || 15000;
                    p.airSupportCooldownEnd = now + cd;
                    
                    setTimeout(() => {
                        p.airSupportReady = true;
                        sendToPlayer(p, { type: 'air_support_ready' });
                    }, cd);
                    
                    broadcast(room, {
                        type: 'airstrike_incoming',
                        x: x,
                        y: y,
                        ownerName: p.name
                    });
                }
            }
        }
        else if (msg.type === 'leave_room' && playerId && currentRoomId) {
            if (rooms.has(currentRoomId)) {
                const room = rooms.get(currentRoomId);
                const player = room.players.get(playerId);
                if (player) {
                    broadcast(room, {
                        type: 'notification',
                        key: '📴 {name} 離開了 {currentRoomId}', vars: { name: player.name, currentRoomId: currentRoomId }
                    });
                }
                room.players.delete(playerId);
                if (room.players.size === 0 && currentRoomId !== '中心指揮部') {
                    rooms.delete(currentRoomId);
                }
            }
            currentRoomId = null;
            playerId = null;
        }
    });

    ws.on('close', () => {
        if (playerId && currentRoomId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId);
            const player = room.players.get(playerId);
            if (player) {
                broadcast(room, {
                    type: 'notification',
                    key: '📴 {name} 失去連線', vars: { name: player.name }
                });
            }
            room.players.delete(playerId);
            if (room.players.size === 0 && currentRoomId !== '中心指揮部') {
                rooms.delete(currentRoomId);
            }
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log('========================================');
    console.log('  Survivor Game - 多人戰術指揮系統 v2.0');
    console.log('========================================');
    console.log(`  伺服器位置: http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}`);
    console.log(`  最大房間人數: ${MAX_PLAYERS_PER_ROOM}`);
    console.log(`  伺服器上限: ${MAX_SERVER_PLAYERS} 人`);
    console.log('  支援模式: 生存 / 波次 / BOSS 挑戰');
    console.log('========================================');
});
