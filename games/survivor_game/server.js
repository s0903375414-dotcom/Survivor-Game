const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const SharedConfig = require('./shared_config.js');

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // 移除查詢字串
    filePath = filePath.split('?')[0];
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
            '.ogg': 'audio/ogg',
            '.mp3': 'audio/mpeg',
            '.ico': 'image/x-icon'
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
const MAX_PLAYERS_PER_ROOM = 4;

function createRoom(roomId) {
    return {
        id: roomId,
        players: new Map(),
        enemies: [],
        bullets: [],
        xpOrbs: [],
        healthPacks: [],
        totalKills: 0,
        tick: 0,
        lastEnemySpawn: 0,
        lastHealthPackSpawn: 0,
        difficulty: 1,
        createdAt: Date.now()
    };
}

// Initialize a default room
rooms.set('中心指揮部', createRoom('中心指揮部'));

function broadcast(room, message) {
    const data = JSON.stringify(message);
    room.players.forEach(p => {
        if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(data);
        }
    });
}

function gameLoop() {
    rooms.forEach((room, roomId) => {
        const now = Date.now();
        room.tick++;
        
        // 1. Update Players
        room.players.forEach(player => {
            if (player.input) {
                const dx = player.input.dx || 0;
                const dy = player.input.dy || 0;
                player.x += dx * player.speed;
                player.y += dy * player.speed;
                
                // 自動射擊與自動瞄準邏輯
                if (player.input.shooting && now - player.lastShot > SharedConfig.PLAYER.FIRE_RATE) {
                    const angle = player.input.angle || 0;
                    room.bullets.push({
                        x: player.x,
                        y: player.y,
                        vx: Math.cos(angle) * SharedConfig.PLAYER.BULLET_SPEED,
                        vy: Math.sin(angle) * SharedConfig.PLAYER.BULLET_SPEED,
                        ownerId: player.id
                    });
                    player.lastShot = now;
                }
            }
        });

        // 2. Spawn Enemies & Logic
        if (room.players.size > 0) {
            const now = Date.now();
            // Enemy spawn rate increases with difficulty
            const spawnInterval = Math.max(500, 2000 - (room.difficulty * 100));
            
            if (now - room.lastEnemySpawn > spawnInterval) {
                const firstPlayer = room.players.values().next().value;
                const side = Math.floor(Math.random() * 4);
                let ex, ey;
                const dist = 800;
                if (side === 0) { ex = firstPlayer.x - dist; ey = firstPlayer.y + (Math.random() * dist*2 - dist); }
                else if (side === 1) { ex = firstPlayer.x + dist; ey = firstPlayer.y + (Math.random() * dist*2 - dist); }
                else if (side === 2) { ey = firstPlayer.y - dist; ex = firstPlayer.x + (Math.random() * dist*2 - dist); }
                else { ey = firstPlayer.y + dist; ex = firstPlayer.x + (Math.random() * dist*2 - dist); }

                // Boss Logic: Every 100 kills
                if (room.totalKills > 0 && room.totalKills % SharedConfig.BOSS_SPAWN_INTERVAL === 0 && !room.enemies.some(e => e.isBoss)) {
                    const bossCfg = SharedConfig.SLIME_TYPES.boss;
                    room.enemies.push({
                        id: `BOSS_${now}`,
                        x: ex, y: ey,
                        hp: 2000 + (room.difficulty * 500),
                        maxHp: 2000 + (room.difficulty * 500),
                        speed: bossCfg.speedMult,
                        radius: bossCfg.radius,
                        type: 'boss',
                        isBoss: true
                    });
                    broadcast(room, { type: 'notification', message: "🚨 強力生物特徵已偵測：大型 BOSS 進入戰場！ 🚨" });
                } else {
                    // Normal or Elite
                    const isElite = Math.random() < 0.1 + (room.difficulty * 0.05);
                    const type = isElite ? 'elite' : 'normal';
                    const cfg = SharedConfig.SLIME_TYPES[type];
                    room.enemies.push({
                        id: `E_${now}_${Math.random()}`,
                        x: ex, y: ey,
                        hp: isElite ? 150 : 50,
                        maxHp: isElite ? 150 : 50,
                        speed: cfg.speedMult + 0.5,
                        radius: cfg.radius,
                        type: type
                    });
                }
                room.lastEnemySpawn = now;
                room.difficulty += 0.01; // Scale difficulty
            }

            // Health pack spawn
            if (now - room.lastHealthPackSpawn > 15000 && room.healthPacks.length < 3) {
                const firstPlayer = room.players.values().next().value;
                room.healthPacks.push({
                    id: `H_${now}`,
                    x: firstPlayer.x + (Math.random() * 1000 - 500),
                    y: firstPlayer.y + (Math.random() * 1000 - 500)
                });
                room.lastHealthPackSpawn = now;
            }
        }

        // 3. Update Entities
        room.enemies.forEach(enemy => {
            let closestPlayer = null;
            let minDist = Infinity;
            room.players.forEach(p => {
                const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (d < minDist) { minDist = d; closestPlayer = p; }
            });

            if (closestPlayer) {
                const angle = Math.atan2(closestPlayer.y - enemy.y, closestPlayer.x - enemy.x);
                enemy.x += Math.cos(angle) * enemy.speed;
                enemy.y += Math.sin(angle) * enemy.speed;

                if (minDist < enemy.radius + 10) {
                    closestPlayer.hp -= enemy.isBoss ? 1 : 0.5;
                    if (closestPlayer.hp <= 0) {
                        closestPlayer.ws.send(JSON.stringify({ type: 'game_over' }));
                    }
                }
            }
        });

        // XP Pickup
        room.xpOrbs.forEach((orb, index) => {
            room.players.forEach(p => {
                if (Math.hypot(p.x - orb.x, p.y - orb.y) < 40) {
                    p.xp += orb.value;
                    p.ws.send(JSON.stringify({ type: 'pickup', item: 'xp' })); // 發送拾取事件
                    if (p.xp >= p.xpToNextLevel) {
                        p.level++;
                        p.xp = 0;
                        p.xpToNextLevel = Math.floor(p.xpToNextLevel * 1.2);
                        p.hp = Math.min(p.maxHp, p.hp + 20); // Heal on level up
                        p.ws.send(JSON.stringify({ type: 'level_up', level: p.level }));
                    }
                    room.xpOrbs.splice(index, 1);
                }
            });
        });

        // Health Pack Pickup
        room.healthPacks.forEach((pack, index) => {
            room.players.forEach(p => {
                if (Math.hypot(p.x - pack.x, p.y - pack.y) < 30) {
                    p.hp = Math.min(p.maxHp, p.hp + 30);
                    p.ws.send(JSON.stringify({ type: 'pickup', item: 'health' })); // 發送拾取事件
                    room.healthPacks.splice(index, 1);
                }
            });
        });

        // 4. Update Bullets
        for (let i = room.bullets.length - 1; i >= 0; i--) {
            const b = room.bullets[i];
            b.x += b.vx;
            b.y += b.vy;
            let hit = false;
            for (let j = room.enemies.length - 1; j >= 0; j--) {
                const e = room.enemies[j];
                if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 5) {
                    e.hp -= 25; // Base bullet damage
                    hit = true;
                    if (e.hp <= 0) {
                        room.totalKills++;
                        // Drop XP
                        room.xpOrbs.push({
                            x: e.x, y: e.y,
                            value: e.isBoss ? 500 : (e.type === 'elite' ? 100 : 20),
                            id: `XP_${Date.now()}_${Math.random()}`
                        });
                        room.enemies.splice(j, 1);
                    }
                    break;
                }
            }
            if (hit || Math.abs(b.x) > 10000 || Math.abs(b.y) > 10000) {
                room.bullets.splice(i, 1);
            }
        }

        const state = {
            type: 'state',
            tick: room.tick,
            players: Array.from(room.players.values()).map(p => ({
                id: p.id, name: p.name, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, level: p.level, xp: p.xp, xpToNextLevel: p.xpToNextLevel
            })),
            enemies: room.enemies.map(e => ({ x: e.x, y: e.y, type: e.type, hp: e.hp, maxHp: e.maxHp, radius: e.radius, isBoss: e.isBoss })),
            bullets: room.bullets.map(b => ({ x: b.x, y: b.y })),
            xpOrbs: room.xpOrbs.map(o => ({ x: o.x, y: o.y })),
            healthPacks: room.healthPacks.map(h => ({ x: h.x, y: h.y }))
        };
        broadcast(room, state);
    });
}

// 提升至指定 FPS 讓移動更絲滑
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
                maxPlayers: MAX_PLAYERS_PER_ROOM
            }));
            ws.send(JSON.stringify({ type: 'room_list', rooms: roomList }));
        } 
        else if (msg.type === 'join') {
            const roomId = msg.roomId || '中心指揮部';
            const name = msg.name || '訪客';
            
            // Check if room exists
            if (!rooms.has(roomId)) {
                if (msg.create) {
                    rooms.set(roomId, createRoom(roomId));
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: '找不到該房間' }));
                    return;
                }
            }

            const room = rooms.get(roomId);

            // 1. Check if room is full
            if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
                ws.send(JSON.stringify({ type: 'error', message: '房間已滿' }));
                return;
            }

            // 2. 自動處理重複名稱：如果名稱已存在，移除舊的無效連線
            for (let [id, p] of room.players) {
                if (p.name === name) {
                    console.log(`清理重複名稱之舊連線: ${name}`);
                    room.players.delete(id);
                    break; 
                }
            }

            playerId = `P_${Math.random().toString(36).substr(2, 9)}`;
            currentRoomId = roomId;

            const newPlayer = {
                id: playerId,
                ws: ws,
                name: name,
                x: 0, y: 0,
                hp: 100, maxHp: 100,
                speed: 6, // 提升移動速度
                lastShot: 0,
                input: { dx: 0, dy: 0, shooting: false, angle: 0 }
            };
            room.players.set(playerId, newPlayer);
            
            ws.send(JSON.stringify({ type: 'joined', playerId, roomId }));
            console.log(`Player ${name} joined ${roomId}`);
        } 
        else if (msg.type === 'input' && playerId && currentRoomId) {
            const room = rooms.get(currentRoomId);
            if (room && room.players.has(playerId)) {
                room.players.get(playerId).input = msg;
            }
        }
    });

    ws.on('close', () => {
        if (playerId && currentRoomId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId);
            room.players.delete(playerId);
            if (room.players.size === 0 && currentRoomId !== '中心指揮部') {
                rooms.delete(currentRoomId);
            }
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log('Survivor Game Multiplayer Server running on http://localhost:' + PORT);
});
