document.addEventListener('DOMContentLoaded', () => {
    // 👻 Halloween-themed words by length and difficulty
    const WORDS = {
        7: [ // 🕸️ Round 1: 7-letter words (Hard)
            'VAMPIRE', 'WARLOCK', 'ZOMBIES', 'SPIRITS', 'HAUNTED',
            'CURSING', 'GRAVEST', 'COFFINS',
            'MONSTER', 'PUMPKIN', 'WITCHES', 'GOBLINS', 'PHANTOM', 'SPOOKED'
        ],

        9: [ // 💀 Round 2: 9-letter words (Difficult)
            'NIGHTMARE', 'FRIGHTFUL', 'TERRORIZE', 'HAUNTINGS', 'DARKENING',
            'BLOODMOON', 'GRAVEYARD', 'HYSTERICS', 'DEMONIACS',
 'HEADSTONE', 'SPELLBOOK', 'NIGHTFALL', 'SCREAMING', 'ENCHANTED'
        ],

        12: [ // 🔥 Round 3: 12-letter words (Extreme) — all exactly 12 letters
            'DEMONOLOGIST', 'TRANSCENDING', 'BLOODTHIRSTY', 'NIGHTCRAWLER',
             'NECROMANCERS', 'RESURRECTION',
            'ABOMINATIONS', 'INCANTATIONS', 'SHAPESHIFTER', 'SPIRITUALISM'
        ]
    };

    // Build an allowed dictionary per length (answers only; used for offline fallback)
    const ALLOWED_SETS = {
        7: new Set(WORDS[7]),
        9: new Set(WORDS[9]),
        12: new Set(WORDS[12])
    };
    const OFFLINE_FALLBACK_SET = new Set([...WORDS[7], ...WORDS[9], ...WORDS[12]]);

    // Select one random word per round
    const SELECTED_WORDS = [
        WORDS[7][Math.floor(Math.random() * WORDS[7].length)],
        WORDS[9][Math.floor(Math.random() * WORDS[9].length)],
        WORDS[12][Math.floor(Math.random() * WORDS[12].length)]
    ];

    // Track game state
    let currentRound = 0;
    let currentGuess = '';
    let currentRow = 0;
    let isGameOver = false;
    let roundStartTs = 0;
    let roundTimerId = null;
    let roundTimes = [null, null, null]; // seconds per round

    const board = document.getElementById('board');
    const message = document.getElementById('message');
    const keyboard = document.getElementById('keyboard');
    const restartBtn = document.getElementById('restart-btn');
    const timerEl = document.getElementById('timer');
    const finalSummaryEl = document.getElementById('final-summary');

    const getCurrentWordLength = () => [7, 9, 12][Math.min(currentRound, 2)];
    const getTargetWord = () => SELECTED_WORDS[currentRound];

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function startRoundTimer() {
        clearInterval(roundTimerId);
        const ROUND_SECONDS = 300;
        roundStartTs = Date.now();
        function tick() {
            const elapsed = Math.floor((Date.now() - roundStartTs) / 1000);
            const remaining = Math.max(0, ROUND_SECONDS - elapsed);
            timerEl.textContent = `Round ${currentRound + 1}/3 — ${formatTime(remaining)}`;
            if (remaining <= 0) {
                clearInterval(roundTimerId);
                handleRoundTimeout();
            }
        }
        tick();
        roundTimerId = setInterval(tick, 250);
    }

    function recordRoundTimeIfNeeded() {
        if (roundTimes[currentRound] != null) return; // already recorded
        const elapsed = Math.min(300, Math.ceil((Date.now() - roundStartTs) / 1000));
        roundTimes[currentRound] = elapsed;
    }

    function handleRoundTimeout() {
        if (isGameOver) return;
        recordRoundTimeIfNeeded();
        showMessage('⏳ Time\'s up! Moving to next round.', 'error');
        if (currentRound < 2) {
            setTimeout(nextRound, 1200);
        } else {
            finalizeGame();
        }
    }

    // --- Initialize Board ---
    function initializeBoard() {
        board.innerHTML = '';
        const wordLength = getCurrentWordLength();
        for (let i = 0; i < 6; i++) {
            const row = document.createElement('div');
            row.className = 'row';
            for (let j = 0; j < wordLength; j++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                row.appendChild(tile);
            }
            board.appendChild(row);
        }
    }

    // --- Initialize Keyboard ---
    function initializeKeyboard() {
        const keyboardLayout = [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
        ];

        keyboard.innerHTML = '';

        keyboardLayout.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'keyboard-row';

            row.forEach(key => {
                const keyButton = document.createElement('button');
                keyButton.className = 'key';
                keyButton.textContent = key;

                if (key === 'Enter' || key === '⌫') {
                    keyButton.classList.add('special-key');
                }

                keyButton.addEventListener('click', () => handleKeyPress(key));
                rowDiv.appendChild(keyButton);
            });
            keyboard.appendChild(rowDiv);
        });
    }

    // --- Show Message ---
    function showMessage(text, type = '') {
        message.textContent = text;
        message.className = '';
        message.classList.add('show');
        if (type) message.classList.add(type);
        setTimeout(() => message.classList.remove('show'), 2500);
    }

    // Dictionary caching (memory + localStorage persistence)
    const LOCAL_STORAGE_KEY = 'dictionaryCacheV1';
    const MAX_CACHE_ENTRIES = 300;
    const dictionaryCache = new Map();

    function loadCacheFromStorage() {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data && typeof data === 'object') {
                const entries = Object.entries(data);
                for (const [k, v] of entries) {
                    dictionaryCache.set(k, Boolean(v));
                }
            }
        } catch (_) {
            // ignore corruption
        }
    }

    function saveCacheToStorage() {
        try {
            // Trim if too large (simple FIFO based on iteration order)
            if (dictionaryCache.size > MAX_CACHE_ENTRIES) {
                const toDelete = dictionaryCache.size - MAX_CACHE_ENTRIES;
                let i = 0;
                for (const key of dictionaryCache.keys()) {
                    dictionaryCache.delete(key);
                    i++;
                    if (i >= toDelete) break;
                }
            }
            const obj = {};
            for (const [k, v] of dictionaryCache.entries()) obj[k] = v;
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj));
        } catch (_) {
            // storage may be full or unavailable
        }
    }

    loadCacheFromStorage();

    async function isValidDictionaryWord(word) {
        const lower = word.toLowerCase();
        if (dictionaryCache.has(lower)) return { status: 'ok', valid: dictionaryCache.get(lower) };
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${lower}`);
            const isOk = res.ok;
            dictionaryCache.set(lower, isOk);
            saveCacheToStorage();
            return { status: 'ok', valid: isOk };
        } catch (_) {
            // Network error or offline
            return { status: 'offline' };
        }
    }

    // --- Handle Key Press ---
    async function handleKeyPress(key) {
        if (isGameOver) return;

        const wordLength = getCurrentWordLength();

        if (key === 'Enter') {
            if (currentGuess.length !== wordLength) {
                showMessage('⚠️ Not enough letters!', 'error');
                return;
            }
            // Validate against general English dictionary (online)
            const validation = await isValidDictionaryWord(currentGuess);
            if (validation.status === 'ok' && !validation.valid) {
                showMessage('📖 Not a valid English word', 'error');
                return;
            } else if (validation.status === 'offline') {
                // Allow only answers when offline/unreachable
                if (!OFFLINE_FALLBACK_SET.has(currentGuess)) {
                    showMessage('⚠️ Dictionary unavailable. Only answers allowed offline.', 'error');
                    return;
                }
            }
            checkGuess();
        } else if (key === '⌫') {
            currentGuess = currentGuess.slice(0, -1);
        } else if (/^[A-Z]$/.test(key)) {
            if (currentGuess.length < wordLength) {
                currentGuess += key;
            }
        }

        updateBoard();
    }

    // --- Update Board UI ---
    function updateBoard() {
        const rows = board.querySelectorAll('.row');
        const row = rows[currentRow];
        const tiles = row.querySelectorAll('.tile');

        tiles.forEach((tile, index) => {
            tile.textContent = currentGuess[index] || '';
        });
    }

    // --- Check Guess ---
    function checkGuess() {
        const target = getTargetWord();
        const row = board.querySelectorAll('.row')[currentRow];
        const tiles = row.querySelectorAll('.tile');
        const keyboardKeys = document.querySelectorAll('.key');

        const targetLetters = target.split('');
        const guessLetters = currentGuess.split('');

        guessLetters.forEach((letter, i) => {
            const tile = tiles[i];
            const keyButton = [...keyboardKeys].find(k => k.textContent === letter);

            if (letter === targetLetters[i]) {
                tile.dataset.state = 'correct';
                if (keyButton) keyButton.dataset.state = 'correct';
                targetLetters[i] = null;
            }
        });

        guessLetters.forEach((letter, i) => {
            const tile = tiles[i];
            const keyButton = [...keyboardKeys].find(k => k.textContent === letter);
            if (!tile.dataset.state) {
                if (targetLetters.includes(letter)) {
                    tile.dataset.state = 'present';
                    if (keyButton && keyButton.dataset.state !== 'correct')
                        keyButton.dataset.state = 'present';
                    targetLetters[targetLetters.indexOf(letter)] = null;
                } else {
                    tile.dataset.state = 'absent';
                    if (!keyButton.dataset.state)
                        keyButton.dataset.state = 'absent';
                }
            }
        });

        if (currentGuess === target) {
            showMessage(`🎉 You guessed it: ${target}!`, 'success');
            recordRoundTimeIfNeeded();
            if (currentRound < 2) {
                setTimeout(nextRound, 2000);
            } else {
                finalizeGame();
            }
            return;
        }

        currentRow++;
        currentGuess = '';

        if (currentRow === 6) {
            showMessage(`💀 The word was ${target}`, 'error');
            recordRoundTimeIfNeeded();
            if (currentRound < 2) setTimeout(nextRound, 2500); else finalizeGame();
        }
    }

    // --- Move to Next Round ---
    function setupRound() {
        currentRow = 0;
        currentGuess = '';
        initializeBoard();
        initializeKeyboard();
        showMessage(`🎃 Round ${currentRound + 1} begins!`, 'success');
        startRoundTimer();
    }

    function nextRound() {
        clearInterval(roundTimerId);
        currentRound++;
        setupRound();
    }

    function finalizeGame() {
        clearInterval(roundTimerId);
        isGameOver = true;
        const total = roundTimes.reduce((a, b) => a + (b || 300), 0);
        const list = roundTimes.map((t, i) => `Round ${i + 1}: ${formatTime(t || 300)}`).join('<br>');
        finalSummaryEl.style.display = 'block';
        finalSummaryEl.innerHTML = `
            <h2>🏁 Final Stats</h2>
            <p>${list}</p>
            <p><strong>Total:</strong> ${formatTime(total)}</p>
        `;
        showMessage('🏆 You finished all rounds!', 'success');
    }

    // --- Restart Game ---
    restartBtn.addEventListener('click', () => {
        currentRound = 0;
        currentRow = 0;
        currentGuess = '';
        isGameOver = false;
        roundTimes = [null, null, null];
        finalSummaryEl.style.display = 'none';
        setupRound();
        showMessage('👻 New spooky challenge started!');
    });

    // --- Keyboard Listener ---
    document.addEventListener('keydown', e => {
        const key = e.key.toUpperCase();
        if (e.key === 'Enter') handleKeyPress('Enter');
        else if (e.key === 'Backspace') handleKeyPress('⌫');
        else if (/^[A-Z]$/.test(key)) handleKeyPress(key);
    });

    // --- Initial setup ---
    setupRound();
});
