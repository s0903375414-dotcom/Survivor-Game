# 星輝（Xinghui）資源系統 × 角色召喚（卡池 v2）— 功能交付文件

版本：v2.0（2026-10-15）｜範圍：`games/survivor_game`（前端 + Node 多人伺服器）

## 1. 系統總覽

- **貨幣**：星輝（原神/崩鐵風格命名）｜**道具**：召喚券（新手贈送 5 張，抽卡優先抵扣）
- **來源**：擊殺 Boss → +10 顆星輝（`GACHA_CONFIG.bossKillReward`）
- **消耗**：單抽 10 星輝或 1 券；十連 = 10 抽量（券優先抵扣、星輝補足，`planCost` 試算）
- **核心模組**：`gacha.js`（純邏輯，瀏覽器 `window.GachaSystem` / Node `module.exports`）；`characters_data.js`（17 位角色資料庫 + 程序化像素立繪產生器 `GachaPortraits`）
- **整合點**：`game.js`（狀態持久化 + 面板控制器 v2）、`index.html`（卡池分頁 modal）、`style.css`（結果卡動畫/稀有度配色）、`sw.js`（快取清單 v4）

## 2. 角色名冊（17 位）

二創角色之背景故事為**原創改編**，僅致敬原作世界觀與人物氣質，尊重原作 IP。

| 來源 | 角色 | 稀有度 | 取得方式 |
|---|---|---|---|
| 《魔法少女的魔女審判》二創 | 櫻羽艾瑪 emma | SSR | 常駐 + emma 限定 UP 池 |
| 〝 | 二階堂希羅 hiro | SR | 常駐 |
| 〝 | 橘雪莉 shelly | SR | 常駐 |
| 〝 | 冰上梅露露 meruru | R | 常駐 |
| 〝 | 月代雪 yuki | SSR | **限定專屬**（yuki UP 池） |
| 〝 | 遠野漢娜 hanna | R | 常駐 |
| 《不/存在的你，和我》二創 | 莉莉絲 lilith | SSR | **限定專屬**（lilith UP 池） |
| 〝 | 夏特露酱 charlotte | R | 常駐 |
| 〝 | 弗子酱 fuko | SR | 常駐 |
| 戰術部隊（本作原創） | 新兵/斥候/醫療兵 | N | 常駐 |
| 〝 | 機槍手/工兵 | R | 常駐 |
| 〝 | 狙擊手/先鋒 | SR | 常駐 |
| 〝 | 王牌指揮官 ace | SSR | 常駐 |

每位角色具備：屬性面板（hp/atk/def/spd）、專屬技能（名稱+效果）、背景故事、招牌台詞、立繪配色（palette）與髮型（hairStyle），由 `characters_data.js` 內建程序化像素立繪（32×40）即時生成，無外部圖檔依賴。

## 3. 卡池架構

- **常駐池** `standard`：全年開放。
- **限定池** `limitedBanners`：`yuki`／`lilith`／`emma` 三池輪換，週期 14 天（`rotationPeriodDays`），`activeLimitedBanner(now)` 依時間決定當前 UP 池。
- **限定專屬角色**（`limitedOnly: true`）：月代雪、莉莉絲僅在自家 UP 池出現；常駐池名單自動排除（`bannerPool`）。

### 機率（全部卡池同比例，總和 = 100）

| 稀有度 | N | R | SR | SSR |
|---|---|---|---|---|
| 機率 | 60% | 30% | 9% | 1% |

### 保底機制

- **SSR 硬保底**：60 抽內必出 SSR（`pitySSR: 60`，逐抽計數）。
- **SR 軟保底**：連續 10 抽未出 SR+ 則下一抽強制 SR（`pitySR: 10`）。
- **限定 UP**：SSR 有 50% 為當期 UP 角色；歪了（抽到非 UP 的 SSR）→ 下一次 SSR **必中** UP（`guaranteedUp` 大保底）。
- 保底計數與大保底狀態**逐池獨立**（`state.pity.standard` / `state.pity.limited`）並持久化。

### 道具與倉庫

- **召喚券**：抽卡優先抵扣（1 券 = 1 抽），不足部分以星輝補足（`planCost`）。
- **重複角色**：自動轉換 5 顆星輝（`dupeToDust: 5`）並寫入日誌（`dust` 欄位），倉庫以 `count` 累計。
- **倉庫格式**：`{id, name, rarity, count, firstGainedAt}`；舊格式自動遷移（`normalize`）。

## 4. 介面（卡池 v2 UI）

- **卡池分頁**：常駐／限定切換；限定頁顯示 UP 角色名、輪換剩餘天數。
- **保底進度**：即時顯示「距離 SSR 保底 X 抽｜距離 SR 保底 Y 抽」。
- **單抽／十連**：按鈕文案依 `planCost` 動態顯示（券×N＋星輝），不足時停用。
- **抽卡動畫**：結果卡逐張翻入（staggered `gachaCardIn`）、SSR 金光脈動（`gachaSSRpulse`）＋全屏閃光（`gachaFlash`）＋音效；NEW／重複＋5 星輝／UP 徽章。
- **結果展示**：立繪縮圖 ×3、稀有度配色邊框、統計摘要列。
- **倉庫**：全角色列示（依稀有度排序）、立繪縮圖 ×2、重複數量。

## 5. 玩家資料（localStorage，依帳號隔離）

| Key | 說明 |
|---|---|
| `survivor_xinghui_<user>` | 星輝餘額 |
| `survivor_tickets_<user>` | 召喚券數 |
| `survivor_warehouse_<user>` | 倉庫角色 JSON |
| `survivor_xinghui_logs_<user>` | 日誌（上限 150 筆自動修剪） |
| `survivor_pity_<user>` | 保底計數＋大保底狀態（逐池） |
| `survivor_gacha_init_<user>` | 新手召喚券已發放標記 |

## 6. GachaSystem API（v2）

| 函式 | 說明 |
|---|---|
| `getBalance / getTickets / addDiamonds / spendDiamonds / addTickets / grantBossReward` | 資源讀寫（皆寫日誌） |
| `validateConfig()` | 機率總和、池非空、成本、保底值檢查 |
| `rollRarity(rand?, bannerId?)` | 稀有度抽取（rand 可注入） |
| `pickCharacter(rarity, rand?, banner?)` | 池內角色抽取 |
| `bannerPool(banner)` / `getBanner(id, now?)` / `activeLimitedBanner(now?)` / `rotationRemainMs(now?)` | 卡池名單與輪換 |
| `planCost(state, pulls)` | 消耗試算（券優先） |
| `pullBanner(state, bannerId, pulls, rand?, isUpRand?)` | **原子性批量抽卡**（單抽=1、十連=10；含保底/UP/重複轉換） |
| `tryPull(state, rand?)` | v1 相容單抽 |
| `pullTen(state, bannerId?, rand?, isUpRand?)` | 十連 |

## 7. 事務一致性（原子性）

`pullBanner` 進入即快照（diamond／tickets／warehouse／logs／pity）→ 驗證餘額 → 扣除 → 逐次抽取 → 發放。任一步例外 → 快照還原全部欄位 → `{ok:false, error:'internal'}`。不存在「已扣款未發放」或「已發放未扣款」被持久化的路徑（呼叫端僅在 `ok:true` 後 `saveGachaState()`）。

## 8. 營運調整指引

| 想調整什麼 | 位置 |
|---|---|
| 機率／保底／成本／輪換週期 | `gacha.js` → `GACHA_CONFIG` |
| 新增角色 | `characters_data.js` → `CHARS`（記得 `limitedOnly` 標記） |
| UP 池內容 | `GACHA_CONFIG.limitedBanners` |
| 日誌上限 | `GACHA_CONFIG.maxLogEntries` |
| 跑測試 | `node tests/test_gacha.js`（81 項全過為 green） |

## 9. 測試結果（2026-10-15 實測）

**`node tests/test_gacha.js`：81 通過 / 0 失敗（exit code 0）**

覆蓋：角色資料庫完整性（17 位／屬性／技能／故事／立繪規格／來源分布／限定標記／稀有度分布）、卡池設定合法性、機率區間邊界（N60/R30/SR9/SSR1；20000 次實抽 SSR 0.90%、N 60.86%）、星輝增減與日誌、Boss 掉落、餘額不足不扣款、**原子性回滾**、剛好 10 顆抽卡歸零、Boss→抽卡完整流程、**SSR 硬保底 60**、**SR 軟保底 10**、**限定 UP 50% 命中／歪後必中／大保底重置**、限定名單隔離、**重複角色轉 5 星輝**（餘額/倉庫 count/日誌）、**召喚券優先抵扣**（試算/十連/純券抽卡）、**卡池輪換**（14 天三池循環）、舊倉庫格式遷移。

## 10. 已知邊界

- 訪客與登入帳號的星輝/倉庫/保底互不相通（key 依帳號隔離）。
- 開發帳號（開發團隊）登入時固定 9999 星輝 + 99 券（僅供測試，不寫入儲存）。
- 保底計數由前端 localStorage 持有；多人模式下 Boss 擊殺同樣計入本地 `gachaState`。
