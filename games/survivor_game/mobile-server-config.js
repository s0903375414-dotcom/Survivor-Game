'use strict';

(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root && root.window && root.document) api.configureNativeClient(root.window);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const STORAGE_KEY = 'survivor-game-server-url';
    // APK 預設伺服器:沒有 ?ws= 參數、也沒有已存位址時自動採用,
    // 開啟遊戲不再跳輸入框。日後換伺服器:改這裡重新建置,或清 App 資料後用 ?ws= 參數覆蓋。
    const DEFAULT_SERVER_ADDRESS = 'https://survivor-game-w2m3.onrender.com';

    function normalizeBackendAddress(value) {
        const input = String(value || '').trim();
        if (!input) throw new Error('請輸入遊戲伺服器位址。');
        const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `http://${input}`;
        let parsed;
        try {
            parsed = new URL(candidate);
        } catch (_) {
            throw new Error('伺服器位址格式不正確。');
        }
        if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol) || !parsed.hostname) {
            throw new Error('請使用 http://、https://、ws:// 或 wss:// 位址。');
        }
        if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== '/')) {
            throw new Error('請只輸入伺服器主機與連接埠，不要加路徑、帳密或查詢參數。');
        }
        const protocol = parsed.protocol === 'https:' || parsed.protocol === 'wss:' ? 'wss:' : 'ws:';
        return `${protocol}//${parsed.host}`;
    }

    function resolveBackendAddress({ queryAddress, storedAddress, defaultAddress, promptForAddress } = {}) {
        const candidate = queryAddress || storedAddress || String(defaultAddress || '') ||
            (typeof promptForAddress === 'function' ? promptForAddress() : '');
        if (!candidate) return null;
        return normalizeBackendAddress(candidate);
    }

    function configureNativeClient(win) {
        const capacitor = win.Capacitor;
        const isNative = win.__SURVIVOR_ANDROID__ === true ||
            (capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform());
        if (!isNative) return;

        const params = new URLSearchParams(win.location.search);
        let storedAddress = '';
        try { storedAddress = win.localStorage.getItem(STORAGE_KEY) || ''; } catch (_) { /* private storage may be unavailable */ }

        let address;
        try {
            address = resolveBackendAddress({
                queryAddress: params.get('ws'),
                storedAddress,
                defaultAddress: DEFAULT_SERVER_ADDRESS,
                promptForAddress: () => win.prompt(
                    '請輸入遊戲伺服器位址。區網可填 http://電腦IP:8080（手機與電腦需連同一 Wi-Fi）。',
                    'http://'
                )
            });
        } catch (error) {
            win.alert(error.message);
            return;
        }
        if (!address) return;

        try { win.localStorage.setItem(STORAGE_KEY, address); } catch (_) { /* query parameter still works */ }
        params.set('ws', address);
        const nextUrl = `${win.location.pathname}?${params.toString()}${win.location.hash}`;
        win.history.replaceState(null, '', nextUrl);
    }

    return { STORAGE_KEY, DEFAULT_SERVER_ADDRESS, normalizeBackendAddress, resolveBackendAddress, configureNativeClient };
});
