# 星輝（Xinghui）資源系統 × 角色抽卡 — 功能交付文件

版本：v1.0（2026-10-11）｜範圍：`games/survivor_game`（前端單檔遊戲 + Node 多人伺服器）

## 1. 系統總覽

- **貨幣名稱**：星輝（原神「原石」/ 崩鐵「星軛」風格命名）
- **來源**：擊殺任何 Boss → +10 顆（`gacha.js` → `GACHA_CONFIG.bossKillReward`）
- **用途**：角色抽卡，單抽 10 顆（`GACHA_CONFIG.costPerPull`）
- **核心模組**：`gacha.js` — 純邏輯、無 DOM/儲存耦合；瀏覽器掛載 `window.GachaSystem`，Node 環境 `module.exports`（供單元測試）
- **整合點**：
  - `game.js`：星輝狀態持久化（loadGachaState / saveGachaState）、抽卡面板接線、Boss 擊殺掉落掛鉤、`Player.diamond` 餘額即時同步
  - `index.html`：主選單「角色抽卡」按鈕 + 抽卡 modal（餘額 / 單抽 / 結果 / 倉庫最近 8 隻）
  - `i18n_dict_4.js`：全部新 UI 文字繁中→泰文鍵
  - `style.css`：稀有度配色（N 灰 / R 藍 / SR 紫 / SSR 金）

## 2. 資料庫欄位說明（玩家資料 = localStorage，依帳號隔離）

| Key（`_<帳號名>` 後綴；訪客無後綴） | 型別 | 說明 |
|---|---|---|
| `survivor_xinghui_<user>` | int | 星輝餘額 |
| `survivor_warehouse_<user>` | JSON array | 倉庫角色 `[{id, name, rarity, gainedAt}]` |
| `survivor_xinghui_logs_<user>` | JSON array | 掉落/消費日誌（上限 100 筆，自動修剪，供後續查核） |

日誌條目格式（雙重記帳，`spend` + `gacha_pull` 成對出現便於對帳）：

```json
{ "time": 1760130000000, "type": "gain",         "amount": 10,  "reason": "boss_kill:BOSS" }
{ "time": 1760130001000, "type": "spend",        "amount": -10, "reason": "gacha_pull" }
{ "time": 1760130001000, "type": "gacha_pull",  "amount": -10, "charId": "recruit", "charName": "新兵", "rarity": "N" }
```

## 3. 介面呼叫規範（GachaSystem API）

`state` 一律為 `{ diamond:int, warehouse:[], logs:[] }`，由呼叫端持有與持久化。

| 函式 | 簽章 | 回傳 |
|---|---|---|
| 即時讀取餘額 | `getBalance(state)` | `int` |
| 新增星輝 | `addDiamonds(state, amount, reason)` | 成功 `{ok:true, balance, gained}`；失敗 `{ok:false, error:'invalid_amount'}`（amount ≤ 0 或非有限數） |
| 扣除星輝 | `spendDiamonds(state, amount, reason)` | 成功 `{ok:true, balance, spent}`；不足 `{ok:false, error:'insufficient', balance, needed}` — **狀態完全不改動** |
| Boss 掉落 | `grantBossReward(state, bossName)` | `{ok:true, balance, gained, reward:10}`，日誌 reason = `boss_kill:<bossName>` |
| 單抽（原子） | `tryPull(state, rand?)` | 成功 `{ok:true, character, rarity, balance}`；餘額不足 `{ok:false, error:'insufficient'}`；內部異常 `{ok:false, error:'internal'}`（已回滾） |
| 設定檢查 | `validateConfig()` | `{ok:true}` 或 `{ok:false, error:'rates_sum_XX'|'empty_pool:X'|'bad_rate:X'|'bad_cost'}` |
| 稀有度抽取 | `rollRarity(rand?)` | `'N'|'R'|'SR'|'SSR'`（rand 可注入，測試用） |
| 角色抽取 | `pickCharacter(rarity, rand?)` | 池內角色物件或 `null` |

前端顯示層約定：餘額不足 → `alert(tf('星輝不足…{cost}…{balance}…'))` 即時彈窗；成功 → 結果區顯示 `獲得角色：{name}（{rarity}）` 並刷新餘額/倉庫。

## 4. 事務一致性（原子性）設計

1. `tryPull` 進入時建立完整狀態快照（JSON 序列化 diamond / warehouse / logs）
2. 流程：**驗證餘額 → 扣除 → 機率抽取 → 發放倉庫**，全程同步單執行緒、無中斷點
3. 餘額不足在扣除**前**驗證失敗 → 直接返回，不寫任何日誌、餘額不變
4. 扣除後任一步拋出例外 → 以快照**還原全部三個欄位** → 回 `{ok:false, error:'internal'}`
5. 持久化（`saveGachaState`）僅在 `tryPull` 回傳 `ok:true` 後由呼叫端執行一次
   → 不存在「已扣款未發放」或「已發放未扣款」被寫入儲存的路徑

## 5. 後續調整操作指引（營運）

| 想調整什麼 | 位置 | 說明 |
|---|---|---|
| 單抽成本 | `gacha.js` → `GACHA_CONFIG.costPerPull` | UI 按鈕文字自動跟隨（tf 模板） |
| Boss 掉落量 | `GACHA_CONFIG.bossKillReward` | 通知文字數字自動跟隨 |
| 各稀有度機率 | `GACHA_CONFIG.rates` | 百分比；**總和必須 = 100**，`validateConfig()` 會檢查 |
| 新增角色 | `GACHA_CONFIG.pool.<稀有度>` 加 `{id, name}` | 新名稱需同步在 `i18n_dict_4.js` 補泰文鍵 |
| 日誌保留量 | `GACHA_CONFIG.maxLogEntries` | 預設 100 筆 |
| 掉落查核 | 讀 `survivor_xinghui_logs_<user>` | `reason` 以 `boss_kill:` 前綴過濾；金額对帳看 `spend`/`gacha_pull` 成對 |
| 跑測試 | `node tests/test_gacha.js` | 34 項全過為 green（exit code 0） |

## 6. 測試結果（2026-10-11 實測）

**單元 + 集成（`node tests/test_gacha.js`）：34 通過 / 0 失敗**

覆蓋：餘額讀取、新增/扣除、負數與零拒絕、不足不扣款、日誌寫入與上限修剪、Boss +10 與掉落日誌、連續 Boss 累積、機率區間邊界（N 60% / R 30% / SR 9% / SSR 1%；20000 次實抽 SSR 0.90%、N 60.86%）、**扣除後異常回滾（原子性）**、剛好 10 顆抽卡成功後歸零、歸零後再抽被拒、完整場景「擊殺 2 Boss（20 顆）→ 抽 2 次（20→10→0）→ 倉庫 2 隻 → 日誌齊全 → 再殺 Boss → 可再抽」。

**瀏覽器實測（http://localhost:8080）**：面板開啟與餘額顯示 0 → 餘額不足彈窗（繁中）→ 給 25 顆 → 單抽成功（獲得角色：新兵（N）、餘額 15）→ 倉庫 1 隻 → localStorage 三鍵寫入（餘額 15 / 倉庫 1 / 日誌 3）→ **頁面重載後餘額保留** → 切換泰文後面板全泰文（กาชาตัวละคร / ยอดสตาร์ไลท์: 15 / สุ่ม 1 ครั้ง (10 สตาร์ไลท์)）→ 泰文餘額不足彈窗正確。

## 7. 已知邊界

- 訪客（未登入）與登入帳號的星輝**不相通**（key 依帳號名隔離，與軍資行為一致）
- 開發帳號（開發團隊）登入時固定 9999 星輝（僅供測試抽卡，不寫入儲存）
- 多人模式下 Boss 由伺服器端擊殺判定時，星輝以本地玩家 `gachaState` 記錄（與單機一致）
