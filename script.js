document.addEventListener('DOMContentLoaded', () => {
    // 👻 Halloween-themed words by length and difficulty
    const WORDS = {
        5: [ // 🎃 Round 1: 5-letter words (Warm-up)
            'GHOST','WITCH','SKULL','GRAVE','BONES','CURSE','EERIE','GHOUL','SPOOK','MUMMY',
            'DEMON','DEVIL','CRYPT','OUIJA','TAROT','SHADE','BLOOD','RAVEN','FANGS','CLAWS',
            'SCARE','BROOM','CANDY','KNIFE','TREAT','TRICK','TOMBS','SCARY','SLIME','SLASH',
            'CHILL','CHANT','HEXES','HEXED','SPELL','NOOSE','OMENS','OGRES','DREAD','HOWLS',
            'VAPOR','ETHER','ABYSS','GLOOM','RITES','SKULK','BLACK','BLADE'
        ],

        7: [ // 🕸️ Round 2: 7-letter words (Hard)
            'VAMPIRE', 'WARLOCK', 'ZOMBIES', 'SPIRITS', 'HAUNTED',
            'CURSING', 'GRAVEST', 'COFFINS',
            'MONSTER', 'PUMPKIN', 'WITCHES', 'GOBLINS', 'PHANTOM', 'SPOOKED',
            'BANSHEE','COBWEBS','RITUALS','SEANCES','HEXINGS','DEMONIC','SHADOWS','SCARIER','SHRIEKS',
            'CASKETS','SUCCUBI','INCUBUS','FUNERAL','WRAITHS','SEVERED','ASYLUMS','CHARNEL','EERIEST',
            'HORRORS','MORGUES','CRYPTIC','OMINOUS','HAUNTER','POSSESS','TORMENT','CULTIST','SORCERY','ENCHANT'
        ],

        9: [ // 💀 Round 3: 9-letter words (Difficult)
            'NIGHTMARE', 'FRIGHTFUL', 'TERRORIZE', 'HAUNTINGS', 'DARKENING',
            'BLOODMOON', 'GRAVEYARD', 'HYSTERICS', 'DEMONIACS',
'HEADSTONE', 'SPELLBOOK', 'NIGHTFALL', 'SCREAMING', 'ENCHANTED',
            'HALLOWEEN','AFTERLIFE','BLOODLUST','MOONLIGHT','CADAVERIC','TOMBSTONE','GHOSTSHIP',
            'SORCERERS','FLESHLESS','PHANTASMS','HELLHOUND','SEANCEING','WEREWOLFS','GRAVENESS','DARKENERS'
        ],

    };
    // Validate word lengths and filter out any mismatches at load time
    (function validateWordLengths() {
        const expected = Object.fromEntries(Object.keys(WORDS).map(k => [k, Number(k)]));
        let removedAny = false;
        for (const len of Object.keys(expected)) {
            const list = WORDS[len];
            const correctLen = expected[len];
            const filtered = list.filter(w => w && w.length === correctLen);
            if (filtered.length !== list.length) {
                removedAny = true;
                const bad = list.filter(w => !w || w.length !== correctLen);
                console.warn(`[WORDS] Removed words with wrong length for ${correctLen}:`, bad);
            }
            WORDS[len] = filtered;
        }
        if (!removedAny) {
            console.log('[WORDS] All word lists have correct lengths.');
        }
    })();

    // Utility to add more words from the browser console safely
    // Usage: window.addWords(5, ["ghost","witch", ...])
    window.addWords = function addWords(length, words) {
        const len = Number(length);
        if (!WORDS[len]) {
            console.error(`No word list configured for length ${len}.`);
            return;
        }
        if (!Array.isArray(words)) {
            console.error('Second argument must be an array of strings.');
            return;
        }
        const before = new Set(WORDS[len]);
        const added = [];
        const rejected = [];
        words.forEach(w => {
            if (typeof w !== 'string') { rejected.push(w); return; }
            const up = w.trim().toUpperCase();
            if (up.length !== len || !/^[A-Z]+$/.test(up)) { rejected.push(w); return; }
            if (!before.has(up)) { before.add(up); added.push(up); }
        });
        WORDS[len] = Array.from(before);
        ALLOWED_SETS[len] = new Set(WORDS[len]);
        console.log(`[WORDS] Added ${added.length} words to length ${len}. Rejected ${rejected.length}.`);
        if (added.length) console.debug('Added:', added);
        if (rejected.length) console.debug('Rejected:', rejected);
    };

    // Build an allowed dictionary per length (answers only; used for offline fallback)
    const ALLOWED_SETS = Object.fromEntries(
        Object.keys(WORDS).map(k => [Number(k), new Set(WORDS[k])])
    );
    const OFFLINE_FALLBACK_SET = new Set(Object.values(WORDS).flat());

    // Round configuration (three rounds only)
    const ROUND_LENGTHS = [5, 7, 9];
    const TOTAL_ROUNDS = ROUND_LENGTHS.length;

    // Select one random word per round
    const SELECTED_WORDS = ROUND_LENGTHS.map(len => {
        const arr = WORDS[len] || [];
        return arr[Math.floor(Math.random() * arr.length)];
    });

    // Track game state
    let currentRound = 0;
    let currentGuess = '';
    let currentRow = 0;
    let isGameOver = false;
    let roundStartTs = 0;
    let roundTimerId = null;
    let roundTimes = Array(TOTAL_ROUNDS).fill(null); // seconds per round
    let isTransitioning = false;

    const board = document.getElementById('board');
    const message = document.getElementById('message');
    const keyboard = document.getElementById('keyboard');
    const restartBtn = document.getElementById('restart-btn');
    const timerEl = document.getElementById('timer');
    const finalSummaryEl = document.getElementById('final-summary');

    const getCurrentWordLength = () => ROUND_LENGTHS[Math.min(currentRound, TOTAL_ROUNDS - 1)];
    const getTargetWord = () => SELECTED_WORDS[currentRound];

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function getRoundSecondsForRound(roundIndex) {
        const len = ROUND_LENGTHS[roundIndex];
        return len === 5 ? 180 : 300; // 3 minutes for 5-letter, 5 minutes for 7/9
    }

    function getCurrentRoundSeconds() {
        return getRoundSecondsForRound(currentRound);
    }

    function startRoundTimer() {
        clearInterval(roundTimerId);
        const ROUND_SECONDS = getCurrentRoundSeconds();
        roundStartTs = Date.now();
        function tick() {
            const elapsed = Math.floor((Date.now() - roundStartTs) / 1000);
            const remaining = Math.max(0, ROUND_SECONDS - elapsed);
            timerEl.textContent = `Round ${currentRound + 1}/${TOTAL_ROUNDS} — ${formatTime(remaining)}`;
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
        const cap = getCurrentRoundSeconds();
        const elapsed = Math.min(cap, Math.ceil((Date.now() - roundStartTs) / 1000));
        roundTimes[currentRound] = elapsed;
    }

    function handleRoundTimeout() {
        if (isGameOver) return;
        recordRoundTimeIfNeeded();
        showMessage('⏳ Time\'s up! Moving to next round.', 'error');
        advanceToNextRound(1200);
    }

    function advanceToNextRound(delayMs) {
        if (isTransitioning || isGameOver) return;
        isTransitioning = true;
        clearInterval(roundTimerId);
        const delay = typeof delayMs === 'number' ? delayMs : 0;
        setTimeout(() => {
            if (currentRound < TOTAL_ROUNDS - 1) {
                nextRound();
            } else {
                finalizeGame();
            }
            isTransitioning = false;
        }, delay);
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
                // Always allow official answers even if the dictionary doesn't recognize them
                if (!ALLOWED_SETS[wordLength].has(currentGuess) && currentGuess !== getTargetWord()) {
                    showMessage('📖 Not a valid English word', 'error');
                    return;
                }
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
            advanceToNextRound(2000);
            return;
        }

        currentRow++;
        currentGuess = '';

        if (currentRow === 6) {
            showMessage(`💀 The word was ${target}`, 'error');
            recordRoundTimeIfNeeded();
            advanceToNextRound(2500);
        }
    }

    // --- Move to Next Round ---
    function setupRound() {
        currentRow = 0;
        currentGuess = '';
        initializeBoard();
        initializeKeyboard();
        showMessage(`🎃 Round ${currentRound + 1} of ${TOTAL_ROUNDS} begins!`, 'success');
        startRoundTimer();
        isTransitioning = false;
    }

    function nextRound() {
        clearInterval(roundTimerId);
        currentRound++;
        setupRound();
    }

    function finalizeGame() {
        clearInterval(roundTimerId);
        isGameOver = true;
        const total = roundTimes.reduce((a, b, i) => a + (b || getRoundSecondsForRound(i)), 0);
        const list = roundTimes.map((t, i) => `Round ${i + 1}: ${formatTime(t || getRoundSecondsForRound(i))}`).join('<br>');
        finalSummaryEl.style.display = 'flex';
        finalSummaryEl.innerHTML = `
            <div class="modal">
                <h2>🏁 Final Stats</h2>
                <p>${list}</p>
                <p><strong>Total:</strong> ${formatTime(total)}</p>
                <button id="close-summary">Close</button>
            </div>
        `;
        const closeBtn = document.getElementById('close-summary');
        if (closeBtn) closeBtn.onclick = () => { finalSummaryEl.style.display = 'none'; };
        showMessage('🏆 You finished all rounds!', 'success');
    }

    // --- Restart Game ---
    restartBtn.addEventListener('click', () => {
        currentRound = 0;
        currentRow = 0;
        currentGuess = '';
        isGameOver = false;
        roundTimes = Array(TOTAL_ROUNDS).fill(null);
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
