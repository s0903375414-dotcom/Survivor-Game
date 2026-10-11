// i18n.js — 國際化核心模組(繁體中文 zh + ไทย th)
// 架構:字典以「繁中原文」為鍵、泰文為值;t() 在 zh 模式直接回傳原文(零成本)。
// 載入順序:i18n.js → i18n_dict_*.js → game.js
(function (global) {
    'use strict';

    var STORAGE_KEY = 'survivor_lang';
    var DICT = {};                       // { 繁中鍵: 泰文字串 }
    var ORIG_TEXTS = [];                 // 靜態 DOM 原文備份 [{node, text}]

    function detectLang() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'th' || saved === 'zh') return saved;
        } catch (e) { /* localStorage 不可用時忽略 */ }
        return 'zh';
    }

    var lang = detectLang();

    // ===== 核心 API =====
    // t(key):純字串查字典;th 模式查無則回原文
    function t(key) {
        if (lang === 'zh' || typeof key !== 'string') return key;
        var v = DICT[key];
        return (typeof v === 'string') ? v : key;
    }

    // tf(key, vars):模板字串;佔位符 {name} 由 vars 填入,vars 值若為已知字串自動再查 t()
    function tf(key, vars) {
        var tpl = t(key);
        if (!vars) return tpl;
        return tpl.replace(/\{(\w+)\}/g, function (m, name) {
            var v = vars[name];
            if (v === undefined || v === null) return m;
            return (typeof v === 'string') ? t(v) : String(v);
        });
    }

    // 供字典檔註冊
    global.I18N_ADD = function (entries) {
        for (var k in entries) if (Object.prototype.hasOwnProperty.call(entries, k)) DICT[k] = entries[k];
    };

    function getLang() { return lang; }

    // ===== 靜態 DOM 翻譯 =====
    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
    var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

    function normalize(s) { return s.replace(/\s+/g, ' ').trim(); }

    function applyToNode(node) {
        var orig = node.__i18nOrig;
        if (orig === undefined) { orig = node.nodeValue; node.__i18nOrig = orig; }
        if (lang !== 'th') { if (node.nodeValue !== orig) node.nodeValue = orig; return; }
        var nv = normalize(orig);
        if (nv && DICT[nv]) {
            var th = DICT[nv];
            // 保留前後空白排版
            var lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
            node.nodeValue = lead + th + trail;
        } else if (node.nodeValue !== orig) {
            node.nodeValue = orig;
        }
    }

    function applyToElement(el) {
        for (var i = 0; i < ATTRS.length; i++) {
            var a = ATTRS[i];
            if (!el.hasAttribute || !el.hasAttribute(a)) continue;
            var key = '__i18nOrig_' + a;
            var orig = el.getAttribute(key);
            if (orig === null) { orig = el.getAttribute(a); el.setAttribute(key, orig); }
            if (lang !== 'th') { if (el.getAttribute(a) !== orig) el.setAttribute(a, orig); continue; }
            var nv = normalize(orig);
            if (nv && DICT[nv]) el.setAttribute(a, orig.replace(nv, DICT[nv]));
        }
    }

    function walk(root) {
        if (!root) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
            acceptNode: function (n) {
                if (n.nodeType === 1) {
                    if (SKIP_TAGS[n.tagName]) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.SHOW_ELEMENT ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
                // 已翻譯過的節點(帶 __i18nOrig)必須接受,否則切回 zh 時泰文節點會被跳過而無法還原
                return (n.__i18nOrig !== undefined || /[一-龥]/.test(n.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        });
        var n;
        while ((n = walker.nextNode())) {
            if (n.nodeType === 3) applyToNode(n);
            else applyToElement(n);
        }
    }

    // 全站套用(靜態 DOM + <html lang> + 動態面板重繪掛鉤)
    function applyI18n() {
        document.documentElement.lang = (lang === 'th') ? 'th' : 'zh-TW';
        document.body.classList.toggle('lang-th', lang === 'th');
        walk(document.body);
        // 通知動態面板重繪(由 game.js 註冊)
        if (typeof global.onLanguageChange === 'function') {
            try { global.onLanguageChange(lang); } catch (e) { /* 面板重繪失敗不阻斷 */ }
        }
    }

    function setLang(l) {
        if (l !== 'th' && l !== 'zh') return;
        if (l === lang) { applyI18n(); return; }
        lang = l;
        try { localStorage.setItem(STORAGE_KEY, l); } catch (e) { /* 忽略 */ }
        applyI18n();
    }

    // ===== 原生對話框攔截(alert / confirm / prompt 內文中譯泰) =====
    var _alert = global.alert, _confirm = global.confirm, _prompt = global.prompt;
    global.alert = function (m) { return _alert.call(global, t(String(m))); };
    global.confirm = function (m) { return _confirm.call(global, t(String(m))); };
    global.prompt = function (m, d) { return _prompt.call(global, t(String(m)), d); };

    // ===== 匯出 =====
    global.I18N = {
        t: t, tf: tf, setLang: setLang, getLang: getLang, applyI18n: applyI18n,
        has: function (k) { return Object.prototype.hasOwnProperty.call(DICT, k); }
    };
    global.t = t;   // 供未來 DOMContentLoaded 前的早期呼叫
    global.tf = tf;

    if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyI18n);
    } else {
        applyI18n();
    }
})(window);
