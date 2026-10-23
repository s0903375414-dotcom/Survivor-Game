'use strict';
const assert = require('node:assert/strict');
const { compareVersions, decideUpdate, resolveHttpBaseUrl, STORAGE_KEY } = require('../app-update.js');

let passed = 0;
function ok(label, fn) {
    fn();
    passed++;
    console.log(`  PASS  ${label}`);
}

console.log('=== APK 自動更新：純函式 ===');

ok('compareVersions: 1.0 < 1.1', () => assert.equal(compareVersions('1.0', '1.1'), -1));
ok('compareVersions: 1.1 > 1.0', () => assert.equal(compareVersions('1.1', '1.0'), 1));
ok('compareVersions: 相等回 0', () => assert.equal(compareVersions('1.0.3', '1.0.3'), 0));
ok('compareVersions: 1.9 < 1.10（數值比較非字串）', () => assert.equal(compareVersions('1.9', '1.10'), -1));
ok('compareVersions: 2.0 > 1.99', () => assert.equal(compareVersions('2.0', '1.99'), 1));
ok('compareVersions: 缺邊視為 0', () => assert.equal(compareVersions('', '1.0'), -1));
ok('compareVersions: 兩邊皆空視為相等', () => assert.equal(compareVersions(undefined, undefined), 0));

ok('decideUpdate: 遠端較新 → true', () => assert.equal(decideUpdate('1.0', '1.1'), true));
ok('decideUpdate: 版本相同 → false', () => assert.equal(decideUpdate('1.1', '1.1'), false));
ok('decideUpdate: 遠端較舊 → false', () => assert.equal(decideUpdate('1.2', '1.1'), false));
ok('decideUpdate: 缺目前版本 → false（不提示）', () => assert.equal(decideUpdate('', '1.1'), false));
ok('decideUpdate: 缺遠端版本 → false', () => assert.equal(decideUpdate('1.0', ''), false));

function fakeWin(search, stored) {
    return {
        location: { search },
        URLSearchParams,
        localStorage: { getItem: (k) => (k === STORAGE_KEY ? (stored || '') : null) }
    };
}

ok('resolveHttpBaseUrl: ?ws= 參數 ws:// → http://', () =>
    assert.equal(resolveHttpBaseUrl(fakeWin('?ws=ws://192.168.1.5:8080', '')), 'http://192.168.1.5:8080'));
ok('resolveHttpBaseUrl: ?ws= 參數 wss:// → https://', () =>
    assert.equal(resolveHttpBaseUrl(fakeWin('?ws=wss%3A%2F%2Fgame.example.com', '')), 'https://game.example.com'));
ok('resolveHttpBaseUrl: 無參數時退回 localStorage', () =>
    assert.equal(resolveHttpBaseUrl(fakeWin('', 'ws://192.168.1.5:8080')), 'http://192.168.1.5:8080'));
ok('resolveHttpBaseUrl: 兩者皆無 → null（靜默不檢查）', () =>
    assert.equal(resolveHttpBaseUrl(fakeWin('', '')), null));
ok('resolveHttpBaseUrl: 帶路徑的位址不採用（伺服器位址格式限制）', () =>
    assert.equal(resolveHttpBaseUrl(fakeWin('', 'ws://192.168.1.5:8080/abc')), null));

console.log(`結果: ${passed} 通過 / 0 失敗`);
