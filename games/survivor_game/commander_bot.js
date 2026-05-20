class CommanderBot {
    constructor() {
        console.log("CommanderBot initializing...");
        this.container = document.getElementById('commander-bot-container');
        this.img = document.getElementById('commander-bot-img');
        this.chatHistory = document.getElementById('chat-history');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-chat-btn');
        this.closeBtn = document.getElementById('close-bot-btn');
        this.openBtn = document.getElementById('open-commander-bot-btn');

        this.init();
    }

    init() {
        // Tilt Effect
        this.container.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.container.addEventListener('mouseleave', () => this.resetTilt());

        // Add floating animation
        this.img.style.animation = 'commander-float 3s ease-in-out infinite';
        const style = document.createElement('style');
        style.textContent = `
            @keyframes commander-float {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-15px) rotate(1deg); }
            }
        `;
        document.head.appendChild(style);

        // Chat Events
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // UI Toggle
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => {
                this.container.classList.remove('hidden');
                this.addBotMessage("指揮官，2.5D 聊天系統已就緒。請下達指令。");
            });
        }

        this.closeBtn.addEventListener('click', () => {
            this.container.classList.add('hidden');
        });
    }

    handleMouseMove(e) {
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Calculate tilt (max 15 degrees)
        const tiltX = (y - centerY) / centerY * 5;
        const tiltY = (centerX - x) / centerX * 10;

        // Apply 2.5D effect to image
        this.img.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.05)`;
        
        // Slight parallax for the chat area could be added too, but let's keep it on the character
    }

    resetTilt() {
        this.img.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
    }

    sendMessage() {
        const text = this.chatInput.value.trim();
        if (!text) return;

        this.addUserMessage(text);
        this.chatInput.value = '';

        // Simulate AI Response
        setTimeout(() => {
            this.generateResponse(text);
        }, 800);
    }

    addUserMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg user-msg';
        msgDiv.textContent = text;
        this.chatHistory.appendChild(msgDiv);
        this.scrollToBottom();
    }

    addBotMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg bot-msg';
        msgDiv.textContent = text;
        this.chatHistory.appendChild(msgDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    generateResponse(userInput) {
        let response = "";
        const input = userInput.toLowerCase();

        if (input.includes("你好") || input.includes("hello") || input.includes("嗨")) {
            response = "指揮官，歡迎回到指揮部。我是 2.5D 戰術導引系統。目前戰場狀況穩定，請指示。";
        } else if (input.includes("狀態") || input.includes("status") || input.includes("情況")) {
            response = "正在掃描戰區數據... 彈藥儲備充足，隊員士氣高昂。我們隨時可以發起下一波攻勢。";
        } else if (input.includes("誰") || input.includes("你是")) {
            response = "我是您的個人 AI 戰術導引官。透過 2.5D 投影技術，我能更直觀地與您交流並優化作戰方案。";
        } else if (input.includes("戰鬥") || input.includes("開始") || input.includes("打仗")) {
            response = "戰鬥程序已準備就緒。目標區域已鎖定。指揮官，請下達出擊命令，我們將徹底瓦解敵軍。";
        } else if (input.includes("計畫") || input.includes("策略")) {
            response = "目前的策略是：持續走位以拉扯敵軍陣型，並在能量飽和時呼叫空中支援。這將最大化我們的生存率。";
        } else if (input.includes("謝謝") || input.includes("感恩")) {
            response = "這是我職責所在，指揮官。您的勝利就是對我最大的回報。";
        } else {
            const genericResponses = [
                "收到。數據分析中... 建議您繼續監視敵方動向。",
                "這是一個值得考慮的觀點。我會將其納入戰術模擬中。",
                "指揮官，請確保您的通訊頻道暢通，後援部隊正在待命。",
                "正在處理您的請求... 請稍候，指揮官。"
            ];
            response = genericResponses[Math.floor(Math.random() * genericResponses.length)];
        }

        this.addBotMessage(response);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.commanderBot = new CommanderBot();
});
