// 在 server.js 的 res.writeHead 加入 Cross-Origin-Opener-Policy
res.writeHead(200, { 
    'Content-Type': contentType,
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' // 允許 Google 登入彈窗
});