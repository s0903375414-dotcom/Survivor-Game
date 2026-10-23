'use strict';
const fs = require('node:fs');
const path = require('node:path');
const C = require('../mobile-server-config.js');

const checks = [];
function check(name, fn) {
    try { fn(); checks.push(`PASS ${name}`); }
    catch (error) { checks.push(`FAIL ${name}: ${error.message}`); }
}
function equal(actual, expected) {
    if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
}
function throws(fn) {
    let didThrow = false;
    try { fn(); } catch (_) { didThrow = true; }
    if (!didThrow) throw new Error('expected an error');
}

check('HTTP address becomes ws URL', () => equal(C.normalizeBackendAddress('http://game.example:8080/'), 'ws://game.example:8080'));
check('HTTPS address becomes secure wss URL', () => equal(C.normalizeBackendAddress('https://game.example'), 'wss://game.example'));
check('explicit websocket scheme is preserved', () => equal(C.normalizeBackendAddress('wss://game.example:443/'), 'wss://game.example'));
check('scheme-less LAN address defaults to ws', () => equal(C.normalizeBackendAddress('192.168.1.20:8080'), 'ws://192.168.1.20:8080'));
check('paths are rejected because server expects the root WebSocket endpoint', () => throws(() => C.normalizeBackendAddress('https://game.example/socket')));
check('unsupported schemes are rejected', () => throws(() => C.normalizeBackendAddress('ftp://game.example')));
check('blank addresses are rejected', () => throws(() => C.normalizeBackendAddress('  ')));
check('query address takes precedence over saved address', () => equal(C.resolveBackendAddress({ queryAddress: 'wss://one.example', storedAddress: 'ws://two.example' }), 'wss://one.example'));
check('saved address avoids prompting again', () => equal(C.resolveBackendAddress({ storedAddress: 'http://192.168.1.20:8080', promptForAddress: () => { throw new Error('should not prompt'); } }), 'ws://192.168.1.20:8080'));
check('missing address can be canceled without crashing', () => equal(C.resolveBackendAddress({ promptForAddress: () => null }), null));
check('native app saves prompted address and passes it to WebSocket query', () => {
    let saved = '';
    let replaced = '';
    const win = {
        __SURVIVOR_ANDROID__: true,
        location: { search: '', pathname: '/index.html', hash: '' },
        localStorage: { getItem: () => '', setItem: (_, value) => { saved = value; } },
        prompt: () => 'http://192.168.1.20:8080',
        alert: () => { throw new Error('unexpected alert'); },
        history: { replaceState: (_, __, url) => { replaced = url; } }
    };
    C.configureNativeClient(win);
    equal(saved, 'ws://192.168.1.20:8080');
    if (!replaced.includes('ws=ws%3A%2F%2F192.168.1.20%3A8080')) throw new Error(`query missing in ${replaced}`);
});
check('desktop browser is unchanged', () => {
    let prompted = false;
    const win = { Capacitor: { isNativePlatform: () => false }, prompt: () => { prompted = true; } };
    C.configureNativeClient(win);
    equal(prompted, false);
});
check('HTML loads native server config before the game networking code', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const configIndex = html.indexOf('<script src="mobile-server-config.js"></script>');
    const gameIndex = html.indexOf('<script src="game.js?v=11"></script>');
    if (configIndex < 0 || gameIndex < 0 || configIndex > gameIndex) throw new Error('mobile config must load before game.js');
});

console.log(checks.join('\n'));
if (checks.some(line => line.startsWith('FAIL'))) process.exitCode = 1;
