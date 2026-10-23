'use strict';

const fs = require('node:fs');
const path = require('node:path');

const WEB_FILES = [
    'index.html', 'style.css', 'game.js', 'mobile-server-config.js', 'shared_config.js',
    'i18n.js', 'i18n_dict_1.js', 'i18n_dict_2.js', 'i18n_dict_3.js', 'i18n_dict_4.js',
    'i18n_dict_5.js', 'i18n_dict_6.js', 'character.js', 'characters_data.js',
    'equipment.js', 'gacha.js', 'codex.js', 'manifest.json', 'sw.js', 'app-update.js'
];
const WEB_DIRECTORIES = ['assets', 'In-game music', 'menu_theme'];

function buildMobileAssets(projectRoot, webDir, files = WEB_FILES, directories = WEB_DIRECTORIES) {
    const source = path.resolve(projectRoot);
    const destination = path.resolve(webDir);
    if (source === destination || source.startsWith(`${destination}${path.sep}`)) {
        throw new Error('webDir must not be the project root or an ancestor of it.');
    }
    fs.rmSync(destination, { recursive: true, force: true });
    fs.mkdirSync(destination, { recursive: true });

    for (const file of files) {
        const from = path.join(source, file);
        if (!fs.existsSync(from) || !fs.statSync(from).isFile()) throw new Error(`Missing mobile web asset: ${file}`);
        fs.copyFileSync(from, path.join(destination, file));
    }
    for (const directory of directories) {
        const from = path.join(source, directory);
        if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) throw new Error(`Missing mobile asset directory: ${directory}`);
        fs.cpSync(from, path.join(destination, directory), { recursive: true });
    }

    const indexPath = path.join(destination, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    const configTag = '<script src="mobile-server-config.js"></script>';
    if (!html.includes(configTag)) throw new Error('index.html must load mobile-server-config.js.');
    const updateTag = '<script src="app-update.js"></script>';
    if (!html.includes(updateTag)) throw new Error('index.html must load app-update.js.');
    // Inject the Android flag script into <head> before style.css so the
    // html.android class exists before the first paint (no layout flash),
    // enabling APK-only CSS overrides (e.g. landscape main-menu fix).
    const stylesheetTag = '<link rel="stylesheet" href="style.css">';
    if (!html.includes(stylesheetTag)) throw new Error('index.html must link style.css.');
    html = html.replace(stylesheetTag, '<script src="android-runtime-flag.js"></script>' + stylesheetTag);
    fs.writeFileSync(indexPath, html);
    fs.writeFileSync(
        path.join(destination, 'android-runtime-flag.js'),
        'window.__SURVIVOR_ANDROID__ = true;\n' +
        'document.documentElement.classList.add("android");\n'
    );

    return { files: files.length, directories: directories.length, webDir: destination };
}

if (require.main === module) {
    const projectRoot = path.resolve(__dirname, '..');
    const result = buildMobileAssets(projectRoot, path.join(projectRoot, 'www'));
    console.log(`Prepared ${result.files} files and ${result.directories} asset folders in ${result.webDir}`);
}

module.exports = { buildMobileAssets, WEB_FILES, WEB_DIRECTORIES };
