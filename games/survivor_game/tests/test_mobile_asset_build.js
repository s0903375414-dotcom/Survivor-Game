'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildMobileAssets } = require('../scripts/build-mobile-assets.js');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'survivor-mobile-assets-'));
try {
    const source = path.join(temp, 'source');
    const web = path.join(source, 'www');
    fs.mkdirSync(path.join(source, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(source, 'index.html'), '<head><link rel="stylesheet" href="style.css"></head><h1>game</h1><script src="mobile-server-config.js"></script><script src="app-update.js"></script><script src="char-loadout.js"></script>');
    fs.writeFileSync(path.join(source, 'game.js'), 'console.log("game");');
    fs.writeFileSync(path.join(source, 'assets', 'icon.jpg'), 'icon-bytes');
    fs.mkdirSync(web, { recursive: true });
    fs.writeFileSync(path.join(web, 'stale.txt'), 'stale');

    buildMobileAssets(source, web, ['index.html', 'game.js'], ['assets']);

    const webHtml = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
    assert.ok(webHtml.indexOf('android-runtime-flag.js') < webHtml.indexOf('mobile-server-config.js'));
    assert.equal(fs.readFileSync(path.join(web, 'android-runtime-flag.js'), 'utf8'),
        'window.__SURVIVOR_ANDROID__ = true;\ndocument.documentElement.classList.add("android");\n');
    assert.ok(webHtml.indexOf('android-runtime-flag.js') < webHtml.indexOf('<link rel="stylesheet" href="style.css">'));
    assert.equal(fs.readFileSync(path.join(web, 'game.js'), 'utf8'), 'console.log("game");');
    assert.equal(fs.readFileSync(path.join(web, 'assets', 'icon.jpg'), 'utf8'), 'icon-bytes');
    assert.equal(fs.existsSync(path.join(web, 'stale.txt')), false);
    console.log('PASS mobile web assets are cleanly rebuilt from the requested files and folders');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
