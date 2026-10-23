'use strict';

/**
 * APK 一鍵發布腳本：
 * 1. 將 android/app/build.gradle 的 versionName 設為指定版本、versionCode +1
 * 2. 呼叫 build-android.bat 重新建置 APK
 * 3. 複製 APK 到 releases/survivor-game.apk 並寫入 releases/app_release.json
 *    （server.js 會從 releases/ 讀取版本資訊並提供 /app/version、/app/apk）
 *
 * 用法：node scripts/release-apk.js <版本號> [更新說明...]
 * 範例：node scripts/release-apk.js 1.2 修正橫向選單、新增排行榜分頁
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const gradleFile = path.join(root, 'android', 'app', 'build.gradle');
const apkPath = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const releasesDir = path.join(root, 'releases');
const releaseJsonPath = path.join(releasesDir, 'app_release.json');
const TARGET_APK_NAME = 'survivor-game.apk';

function bumpGradleVersion(version) {
    let gradle = fs.readFileSync(gradleFile, 'utf8');
    const codeMatch = /versionCode (\d+)/.exec(gradle);
    if (!codeMatch) throw new Error('build.gradle 中找不到 versionCode。');
    if (!/versionName "[^"]*"/.test(gradle)) throw new Error('build.gradle 中找不到 versionName。');
    const nextCode = parseInt(codeMatch[1], 10) + 1;
    gradle = gradle.replace(/versionCode \d+/, `versionCode ${nextCode}`);
    gradle = gradle.replace(/versionName "[^"]*"/, `versionName "${version}"`);
    fs.writeFileSync(gradleFile, gradle);
    return nextCode;
}

function main() {
    const version = process.argv[2];
    if (!version || !/^\d+(\.\d+){0,3}$/.test(version)) {
        console.error('用法: node scripts/release-apk.js <版本號> [更新說明...]');
        console.error('範例: node scripts/release-apk.js 1.2 修正橫向選單');
        process.exit(1);
    }
    const notes = process.argv.slice(3).join(' ').trim();

    const versionCode = bumpGradleVersion(version);
    console.log(`[release] 版本 v${version} (versionCode ${versionCode})`);

    console.log('[release] 建置 APK（build-android.bat）…');
    const build = spawnSync(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', 'build-android.bat'],
        { cwd: root, stdio: 'inherit' }
    );
    if (build.status !== 0) {
        console.error(`[release] 建置失敗（exit ${build.status}）。`);
        process.exit(build.status === null ? 1 : build.status);
    }
    if (!fs.existsSync(apkPath)) throw new Error('找不到建置產物 app-debug.apk。');

    fs.mkdirSync(releasesDir, { recursive: true });
    const targetApk = path.join(releasesDir, TARGET_APK_NAME);
    fs.copyFileSync(apkPath, targetApk);
    const stat = fs.statSync(targetApk);

    const release = {
        version,
        versionCode,
        notes,
        apkPath: `releases/${TARGET_APK_NAME}`,
        apkUrl: '/app/apk',
        fileName: TARGET_APK_NAME,
        size: stat.size,
        releasedAt: new Date().toISOString()
    };
    fs.writeFileSync(releaseJsonPath, JSON.stringify(release, null, 2) + '\n');

    console.log(`[release] 已發布 releases/${TARGET_APK_NAME}（${(stat.size / 1048576).toFixed(1)} MB）`);
    console.log('[release] releases/app_release.json 已更新。');
    console.log('[release] 電腦執行 node server.js 後，APK 內會自動提示更新到 v' + version + '。');
}

main();
