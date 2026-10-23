'use strict';

/**
 * APK 自動更新檢查器（僅在 Android APK 內生效）。
 * 流程：啟動後向遊戲伺服器查詢 /app/version → 與原生 versionName 比較 →
 * 有新版時跳出提示 → 呼叫原生 AppUpdate 下載並啟動系統安裝器。
 * 純函式（compareVersions / decideUpdate / resolveHttpBaseUrl）可單元測試。
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof root !== 'undefined' && typeof root.window !== 'undefined' && typeof root.document !== 'undefined') {
        start(root.window);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const STORAGE_KEY = 'survivor-game-server-url';
    const DISMISS_KEY = 'survivor-update-dismissed';
    const CHECK_DELAY_MS = 1500;

    /** 比較版本號（逐段數值比較）：a < b 回 -1、a > b 回 1、相等回 0。 */
    function compareVersions(a, b) {
        const pa = String(a || '0').trim().split('.').map((s) => parseInt(s, 10) || 0);
        const pb = String(b || '0').trim().split('.').map((s) => parseInt(s, 10) || 0);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const da = pa[i] || 0;
            const db = pb[i] || 0;
            if (da !== db) return da < db ? -1 : 1;
        }
        return 0;
    }

    /** 遠端版本比目前版本新才回 true；任一版本缺失回 false。 */
    function decideUpdate(currentVersion, remoteVersion) {
        if (!currentVersion || !remoteVersion) return false;
        return compareVersions(remoteVersion, currentVersion) > 0;
    }

    /** 由 ?ws= 參數或 localStorage 取得伺服器位址，轉成 http(s) 基底 URL；取不到回 null。 */
    function resolveHttpBaseUrl(win) {
        let addr = '';
        try {
            const params = new win.URLSearchParams(win.location.search);
            addr = params.get('ws') || '';
        } catch (_) { /* 無參數 */ }
        if (!addr) {
            try { addr = win.localStorage.getItem(STORAGE_KEY) || ''; } catch (_) { /* 私密模式 */ }
        }
        if (!addr) return null;
        const m = /^(wss?|https?):\/\/([^/?#]+)$/i.exec(String(addr).trim());
        if (!m) return null;
        const secure = m[1].toLowerCase() === 'wss' || m[1].toLowerCase() === 'https';
        return (secure ? 'https://' : 'http://') + m[2];
    }

    function fetchWithTimeout(win, url, ms) {
        if (typeof win.AbortController === 'function') {
            const controller = new win.AbortController();
            const timer = win.setTimeout(() => controller.abort(), ms);
            return win.fetch(url, { signal: controller.signal, cache: 'no-store' })
                .then((res) => { win.clearTimeout(timer); return res; })
                .catch((err) => { win.clearTimeout(timer); throw err; });
        }
        return win.fetch(url, { cache: 'no-store' });
    }

    function getSessionFlag(win) {
        try { return win.sessionStorage.getItem(DISMISS_KEY) || ''; } catch (_) { return ''; }
    }

    function setSessionFlag(win, value) {
        try { win.sessionStorage.setItem(DISMISS_KEY, value); } catch (_) { /* 無法寫入就忽略 */ }
    }

    function getAppUpdatePlugin(win) {
        const cap = win.Capacitor;
        const plugin = cap && cap.Plugins && cap.Plugins.AppUpdate;
        return (plugin && typeof plugin.getVersion === 'function' && typeof plugin.downloadAndInstall === 'function')
            ? plugin
            : null;
    }

    async function checkForUpdate(win) {
        const base = resolveHttpBaseUrl(win);
        if (!base) return;
        const AppUpdate = getAppUpdatePlugin(win);
        if (!AppUpdate) return;

        let current = '';
        try {
            const info = await AppUpdate.getVersion();
            current = (info && info.version) || '';
        } catch (_) { return; }
        if (!current) return;

        let release;
        try {
            const res = await fetchWithTimeout(win, `${base}/app/version`, 6000);
            if (!res || !res.ok) return;
            release = await res.json();
        } catch (_) { return; } // 伺服器離線或逾時 → 靜默略過
        if (!release || !release.version) return;
        if (!decideUpdate(current, release.version)) return;
        if (getSessionFlag(win) === release.version) return; // 本次執行已略過此版本

        showUpdateDialog(win, { base, AppUpdate, current, release });
    }

    function showUpdateDialog(win, ctx) {
        const doc = win.document;
        if (doc.getElementById('app-update-modal')) return;

        const modal = doc.createElement('div');
        modal.id = 'app-update-modal';
        modal.className = 'modal';

        const content = doc.createElement('div');
        content.className = 'modal-content';

        const title = doc.createElement('h2');
        title.textContent = '🎉 發現新版本';

        const versionLine = doc.createElement('div');
        versionLine.className = 'app-update-version-line';
        versionLine.textContent = `目前版本 v${ctx.current} → 最新版本 `;
        const newVersion = doc.createElement('span');
        newVersion.textContent = `v${ctx.release.version}`;
        versionLine.appendChild(newVersion);

        const notes = doc.createElement('div');
        notes.className = 'app-update-notes';
        notes.textContent = String(ctx.release.notes || '').trim() || '版本更新。';

        const buttons = doc.createElement('div');
        buttons.className = 'app-update-buttons';

        const confirmBtn = doc.createElement('button');
        confirmBtn.className = 'action-btn endless-btn';
        confirmBtn.textContent = '⬇ 立即更新';

        const laterBtn = doc.createElement('button');
        laterBtn.className = 'action-btn unit-btn';
        laterBtn.textContent = '稍後再說';

        const hint = doc.createElement('div');
        hint.className = 'app-update-hint';

        // 進度事件（若手動註冊的外掛支援事件則顯示百分比；不支援也不影響流程）
        try {
            if (typeof ctx.AppUpdate.addListener === 'function') {
                ctx.AppUpdate.addListener('downloadProgress', (ev) => {
                    if (ev && typeof ev.percent === 'number' && confirmBtn.disabled) {
                        confirmBtn.textContent = `下載中… ${Math.floor(ev.percent)}%`;
                    }
                });
            }
        } catch (_) { /* 事件不可用就顯示純文字 */ }

        confirmBtn.addEventListener('click', async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '下載中…';
            hint.textContent = '';
            const relative = ctx.release.apkUrl || '/app/apk';
            const apkUrl = /^https?:\/\//i.test(relative) ? relative : `${ctx.base}${relative}`;
            try {
                const result = await ctx.AppUpdate.downloadAndInstall({ url: apkUrl });
                if (result && result.needsPermission) {
                    confirmBtn.textContent = '⚠ 需要安裝權限';
                    hint.textContent = '請在系統設定中允許本應用程式安裝未知應用程式，返回後再按「立即更新」。';
                    confirmBtn.disabled = false;
                    try { await ctx.AppUpdate.openInstallPermission(); } catch (_) { /* 手動前往設定 */ }
                    return;
                }
                confirmBtn.textContent = '✅ 已啟動安裝';
                hint.textContent = '請在系統安裝視窗按「安裝」，完成後遊戲會自動以新版重啟。';
            } catch (err) {
                confirmBtn.textContent = '❌ 更新失敗，請重試';
                hint.textContent = String((err && err.message) || '下載失敗');
                confirmBtn.disabled = false;
            }
        });

        laterBtn.addEventListener('click', () => {
            setSessionFlag(win, ctx.release.version);
            modal.remove();
        });

        buttons.appendChild(confirmBtn);
        buttons.appendChild(laterBtn);
        content.appendChild(title);
        content.appendChild(versionLine);
        content.appendChild(notes);
        content.appendChild(buttons);
        content.appendChild(hint);
        modal.appendChild(content);
        doc.body.appendChild(modal);
    }

    function start(win) {
        if (!win || win.__SURVIVOR_APP_UPDATE_STARTED__) return;
        win.__SURVIVOR_APP_UPDATE_STARTED__ = true;
        if (win.__SURVIVOR_ANDROID__ !== true) return; // 僅 APK 內啟用
        const begin = () => Promise.resolve(checkForUpdate(win)).catch(() => {});
        if (win.document.readyState === 'loading') {
            win.document.addEventListener('DOMContentLoaded', () => win.setTimeout(begin, CHECK_DELAY_MS));
        } else {
            win.setTimeout(begin, CHECK_DELAY_MS);
        }
    }

    return {
        STORAGE_KEY: STORAGE_KEY,
        DISMISS_KEY: DISMISS_KEY,
        compareVersions: compareVersions,
        decideUpdate: decideUpdate,
        resolveHttpBaseUrl: resolveHttpBaseUrl,
        start: start
    };
});
