
let breathInterval;
function toggleBreathing() {
    const circle = document.getElementById('breath-circle');
    const btn = document.getElementById('breath-btn');
    
    if (btn.innerText.includes("Start")) {
        btn.innerText = "Stop Breathing";
        circle.classList.add('expand');
        breathInterval = setInterval(() => {
            circle.classList.toggle('expand');
        }, 4000);
    } else {
        clearInterval(breathInterval);
        btn.innerText = "Start Breathing";
        circle.classList.remove('expand');
    }
}

const stressDataEl = document.getElementById('stress-data');
if (stressDataEl) {
    const stressLevel = stressDataEl.dataset.level;

    if (stressLevel === 'High') {
        initParticleFlow();
    } else if (stressLevel === 'Medium') {
        initBubblePop();
    } else if (stressLevel === 'Low') {
        initMemoryGame();
    }
}

function initParticleFlow() {
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 300;

    let particlesArray;
    const mouse = { x: null, y: null, radius: 100 };

    canvas.addEventListener('mousemove', function(event) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
    });

    class Particle {
        constructor(x, y, size, color) {
            this.x = x; this.y = y; this.size = size; this.color = color;
            this.baseX = x; this.baseY = y;
            this.density = (Math.random() * 30) + 1;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
        }
        update() {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            let forceDirectionX = dx / distance;
            let forceDirectionY = dy / distance;
            let maxDistance = mouse.radius;
            let force = (maxDistance - distance) / maxDistance;
            let directionX = forceDirectionX * force * this.density;
            let directionY = forceDirectionY * force * this.density;

            if (distance < mouse.radius) {
                this.x -= directionX;
                this.y -= directionY;
            } else {
                if (this.x !== this.baseX) {
                    let dx = this.x - this.baseX;
                    this.x -= dx / 10;
                }
                if (this.y !== this.baseY) {
                    let dy = this.y - this.baseY;
                    this.y -= dy / 10;
                }
            }
        }
    }

    function init() {
        particlesArray = [];
        for (let i = 0; i < 500; i++) {
            let x = Math.random() * canvas.width;
            let y = Math.random() * canvas.height;
            let size = Math.random() * 3 + 1;
            particlesArray.push(new Particle(x, y, size, '#a5b4fc'));
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].draw();
            particlesArray[i].update();
        }
        requestAnimationFrame(animate);
    }
    init();
    animate();
}

function initBubblePop() {
    const container = document.getElementById('bubble-container');
    const scoreSpan = document.getElementById('score');
    let score = 0;

    function createBubble() {
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        const size = Math.random() * 40 + 30;
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = Math.random() * (container.clientWidth - 50) + 'px';
        bubble.style.top = Math.random() * (container.clientHeight - 50) + 'px';
        
        bubble.addEventListener('click', () => {
            bubble.style.transform = "scale(0)";
            score++;
            scoreSpan.innerText = score;
            setTimeout(() => bubble.remove(), 200);
            createBubble();
        });

        container.appendChild(bubble);
    }

    for(let i=0; i<10; i++) createBubble();
}

function initMemoryGame() {
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    const emojis = ['🌙', '🌙', '⭐', '⭐', '🌊', '🌊', '🌸', '🌸', '🍃', '🍃', '🐚', '🐚'];
    const shuffled = emojis.sort(() => 0.5 - Math.random());
    let selected = [];

    shuffled.forEach(emoji => {
        const card = document.createElement('div');
        card.classList.add('card-memory');
        card.dataset.emoji = emoji;
        card.innerText = '?';
        
        card.addEventListener('click', () => {
            if (selected.length < 2 && !card.classList.contains('matched')) {
                card.innerText = emoji;
                card.classList.add('flipped');
                selected.push(card);

                if (selected.length === 2) {
                    setTimeout(checkMatch, 800);
                }
            }
        });
        grid.appendChild(card);
    });

    function checkMatch() {
        const [c1, c2] = selected;
        if (c1.dataset.emoji === c2.dataset.emoji) {
            c1.classList.add('matched');
            c2.classList.add('matched');
        } else {
            c1.innerText = '?'; c2.innerText = '?';
            c1.classList.remove('flipped'); c2.classList.remove('flipped');
        }
        selected = [];
    }
}

(function initSpeechRecognition() {
    const recordBtn = document.getElementById('record-btn');
    const voiceResultEl = document.getElementById('voice-result');
    const scanForm = document.getElementById('scan-form');
    const loadingOverlay = document.getElementById('loading');

    if (!recordBtn || !scanForm) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if (voiceResultEl) {
            voiceResultEl.textContent = 'Speech recognition is not supported in this browser.';
        }
        recordBtn.disabled = true;
        return;
    }

    const textArea = scanForm.querySelector('textarea[name="text"]');
    if (!textArea) return;

    let recognition = null;
    let isListening = false;
    let shouldRestart = false;

    function setButtonState(listening) {
        if (listening) {
            recordBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Recording (Listening...)';
        } else {
            recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Record Voice';
        }
        recordBtn.disabled = false;
        recordBtn.style.opacity = '';
        recordBtn.style.cursor = '';
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        shouldRestart = true;
        setButtonState(true);
        if (voiceResultEl) voiceResultEl.textContent = 'Listening...';
    };

    recognition.onerror = (event) => {
        isListening = false;
        shouldRestart = false;
        setButtonState(false);
        if (voiceResultEl) {
            voiceResultEl.textContent = `Speech recognition error: ${event.error || 'unknown error'}`;
        }
    };

    recognition.onresult = (event) => {
        let final_transcript = '';
        let interim_transcript = '';

        for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptPiece = result[0]?.transcript || '';
            if (!transcriptPiece) continue;

            if (result.isFinal) {
                final_transcript += transcriptPiece;
            } else {
                interim_transcript += transcriptPiece;
            }
        }

        const combined = `${final_transcript}${interim_transcript}`.replace(/\s+/g, ' ').trimStart();
        textArea.value = combined;
    };

    recognition.onend = () => {


        if (shouldRestart) {
            try {
                recognition.start();
            } catch (_) {

                setTimeout(() => {
                    if (shouldRestart) {
                        try { recognition.start(); } catch (_) {}
                    }
                }, 250);
            }
            return;
        }

        isListening = false;
        setButtonState(false);
        if (voiceResultEl) voiceResultEl.textContent = 'Stopped.';
    };

    recordBtn.addEventListener('click', () => {
        try {
            if (!isListening) {
                shouldRestart = true;
                recognition.start();
            } else {

                shouldRestart = false;
                recognition.stop();
                isListening = false;
                setButtonState(false);
            }
        } catch (err) {
            isListening = false;
            shouldRestart = false;
            setButtonState(false);
            if (voiceResultEl) voiceResultEl.textContent = `Speech recognition error: ${err?.message || err}`;
        }
    });
})();

(function initAssessmentScreenFlow() {
    const scanForm = document.getElementById('scan-form');
    const loadingOverlay = document.getElementById('loading');
    if (!scanForm) return;

    const mainScreen = document.getElementById('main-screen');
    const assessmentScreen = document.getElementById('assessment-screen');
    const stressEl = document.getElementById('assessment-stress-level');
    const rationaleEl = document.getElementById('assessment-rationale');
    const initiateBtn = document.getElementById('assessment-initiate-btn');

    function setLoading(isLoading) {
        if (!loadingOverlay) return;
        loadingOverlay.classList.toggle('hidden', !isLoading);
    }

    scanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(scanForm.action || '/predict', {
                method: 'POST',
                body: new FormData(scanForm),
                headers: { 'Accept': 'application/json' }
            });

            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.message || 'Clinical assessment failed.');
            }
            
            window.currentGameTitle = payload.title || 'Unknown Module';

            if (stressEl) stressEl.textContent = payload.stress_level || 'UNKNOWN';
            if (rationaleEl) rationaleEl.textContent = payload.clinical_message || '';
            if (initiateBtn) initiateBtn.href = payload.therapeutic_url || '/games';

            if (mainScreen) mainScreen.style.display = 'none';
            if (assessmentScreen) {
                assessmentScreen.style.display = 'block';
                assessmentScreen.classList.remove('is-visible');
                requestAnimationFrame(() => assessmentScreen.classList.add('is-visible'));
            }
        } catch (err) {
            alert(err?.message || String(err));
        } finally {
            setLoading(false);
        }
    });
})();

(function initCompanionChat() {
    const chatBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatDisplay = document.getElementById('chat-display');
    const stressEl = document.getElementById('assessment-stress-level');

    if (!chatBtn || !chatInput || !chatDisplay) return;

    function appendMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message', sender === 'user' ? 'msg-user' : 'msg-ai');
        msgDiv.textContent = text;
        chatDisplay.appendChild(msgDiv);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage(text, 'user');
        chatInput.value = '';

        const currentStress = stressEl ? stressEl.textContent : 'UNKNOWN';

        try {
            const tempAiMsg = document.createElement('div');
            tempAiMsg.classList.add('chat-message', 'msg-ai');
            tempAiMsg.innerHTML = '<span style="opacity: 0.5;">Thinking...</span>';
            chatDisplay.appendChild(tempAiMsg);
            chatDisplay.scrollTop = chatDisplay.scrollHeight;

            const res = await fetch('/companion_chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: text, 
                    stress_level: currentStress,
                    game_title: window.currentGameTitle || 'Unknown Module'
                })
            });

            const data = await res.json();
            chatDisplay.removeChild(tempAiMsg);

            if (!res.ok) throw new Error(data.message || 'Companion unavailable');

            chatDisplay.innerHTML += `<div style='text-align:left; margin-bottom:10px;'><span style='background:#333; color:white; padding:8px 12px; border-radius:15px; display:inline-block;'>${data.response}</span></div>`;
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        } catch (err) {
            appendMessage("Error: Could not connect to the neural module.", 'ai');

            if(chatDisplay.lastChild && chatDisplay.lastChild.innerHTML.includes('Thinking...')) {
                 chatDisplay.removeChild(chatDisplay.lastChild);
            }
        }
    }

    chatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
})();