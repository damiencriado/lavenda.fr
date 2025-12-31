// Lavenda – moteur d'animation (Enigma scramble)

// --- Modes (mini state machine, sans changer les comportements actuels) ---
const Modes = {
    BOOT: "boot",
    NORMAL: "normal",
    TARGET: "target",      // séquence Lavenda (acquisition + final glitch)
    FAILURE: "failure",
};

const Phases = {
    ACQUIRE: "acquire",
    FINAL_GLITCH: "final_glitch",
};

const state = {
    mode: Modes.BOOT,
    phase: Phases.ACQUIRE,
    expectedWord: "",
    sessionId: 0,
};

function bumpSession() {
    state.sessionId += 1;
    return state.sessionId;
}

function getSession() {
    return state.sessionId;
}

function setExpectedWord(word) {
    state.expectedWord = String(word || "");
}

function charClassFor(expectedText, i, shownChar) {
    if (!expectedText) return "";
    return isCorrectAtIndex(expectedText, i, shownChar) ? "char--lit" : "char--dim";
}

// --- Mode handlers: isoler les side-effects par mode ---
const ModeHandlers = {
    [Modes.BOOT]: {
        onEnter() {
            // Boot: le blink est géré par boot(); le jitter est global.
        },
        onExit() {},
    },
    [Modes.NORMAL]: {
        onEnter() {
            // Normal: rien de spécifique (jitter global).
        },
        onExit() {},
    },
    [Modes.TARGET]: {
        onEnter() {
            // Target: rien côté jitter (global). Les events TARGET restent gérés par la séquence.
        },
        onExit() {
            stopFinalGlitchMode();
            stopFinalRepaintLoop();
            if (finalGlitchTimer) {
                clearTimeout(finalGlitchTimer);
                finalGlitchTimer = null;
            }
        },
    },
    [Modes.FAILURE]: {
        onEnter() {
            // Failure: exclusif côté timers/loops (jitter global).
            stopFinalGlitchMode();
            stopFinalRepaintLoop();
            if (finalGlitchTimer) {
                clearTimeout(finalGlitchTimer);
                finalGlitchTimer = null;
            }
        },
        onExit() {},
    },
};

function runModeExit(prevMode) {
    const h = ModeHandlers[prevMode];
    h?.onExit?.();
}

function runModeEnter(nextMode) {
    const h = ModeHandlers[nextMode];
    h?.onEnter?.();
}

function setMode(nextMode, {phase} = {}) {
    if (state.mode === nextMode && (!phase || state.phase === phase)) return;

    const prevMode = state.mode;

    // Important: stoppe d'abord les effets du mode précédent
    runModeExit(prevMode);

    bumpSession();
    state.mode = nextMode;
    if (phase) state.phase = phase;

    // Classes body
    document.body.classList.toggle("booting", nextMode === Modes.BOOT);

    const isTarget = nextMode === Modes.TARGET;
    document.body.classList.toggle("is-target", isTarget);

    // Démarre ensuite les effets du mode courant
    runModeEnter(nextMode);
}

// (supprimé) dotColorForMode: on garde le pilotage LED actuel (impératif) pour ne rien changer.

const CONFIG = {
    items: ["Laurent", "Lavande", "Lavenda", "Avenir", "Damien"],
    target: "Lavenda",

    timing: {
        wordLockMs: 1000,
        settleEaseMs: 4000,
        holdWordMs: 400,
        scrambleFrameMs: 28,
        betweenUnlockFactor: 0.35,
        betweenUnlockMinMs: 300,
    },

    boot: {
        // 3 clignotements du dot avant d'afficher le 1er mot
        blinkCount: 3,
        // durée totale du boot blink (ms)
        blinkTotalMs: 3000,
        // couleurs du blink
        onColor: "white",
        offColor: "gray",
    },

    dot: {
        // rouge 1.5s -> gris 1.5s -> ... (0 désactive)
        finalBlinkMs: 1500,
    },

    scrambleChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",

    font: {
        family: "Screener W01SC Bold",
        loadSamplePx: 16,
        timeoutMs: 2500,
    },

    // Gamification fin: glitches aléatoires après lock (événements continus)
    finalGlitch: {
        enabled: true,
        // au plus 1 glitch toutes les X ms
        maxOneGlitchEveryMs: 5000,
        // au minimum 1 glitch toutes les X ms (évite deux glitches quasi collés)
        minOneGlitchEveryMs: 2000,
        // durée pendant laquelle une lettre reste FAUSSE (ms)
        glitchMs: 520,
        // durée de la "réacquisition" (scramble) après le glitch (ms)
        reacquireMs: 380,
        // max lettres fausses en même temps
        maxConcurrent: 2,
    },

    failure: {
        // nombre de clicks/glitches max avant failure
        maxClicks: 3,
        // fenêtre glissante (ms)
        windowMs: 1000,

        // clignotements
        blinkCount: 3,
        // ON/OFF cadence
        blinkMs: 200,

        // après le dernier blink, on maintient FAILURE affiché (ms)
        holdAfterMs: 1000,

        // disparition progressive (comme les autres mots) avant le scramble
        unlockOutMs: 650,
    },
};

const dot = document.getElementById("dot");
const label = document.getElementById("label");

const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

// largeur fixe pour éviter les shifts selon la longueur
const maxLen = CONFIG.items.reduce((m, w) => Math.max(m, String(w).length), 0);
if (label) {
    label.style.display = "inline-block";
    label.style.width = `${maxLen}ch`;
    label.style.textAlign = "left";
}

// RNG seedée (répétable) pour rendre le mécanisme testable
const RNG_SEED = 1337;
function mulberry32(seed) {
    let t = seed >>> 0;
    return function rng() {
        t += 0x6D2B79F5;
        let x = t;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}
const rng = mulberry32(RNG_SEED);

function pickRandom(arr) {
    return arr[Math.floor(rng() * arr.length)];
}

// Remplace l'ancien randomChar basé sur Math.random
const randomChar = () => CONFIG.scrambleChars[Math.floor(rng() * CONFIG.scrambleChars.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function textIndices(text) {
    const t = String(text).toUpperCase();
    const idx = [];
    for (let i = 0; i < t.length; i += 1) {
        if (t[i] !== " ") idx.push(i);
    }
    return {t, idx};
}

function animateTimed(durationMs, frameMs, onFrame) {
    const duration = Math.max(0, durationMs);
    const endAt = performance.now() + duration;

    return new Promise((resolve) => {
        let lastFrameAt = 0;
        const tick = (ts) => {
            if (ts - lastFrameAt < frameMs) {
                requestAnimationFrame(tick);
                return;
            }
            lastFrameAt = ts;

            const now = performance.now();
            const progress = duration <= 0 ? 1 : clamp01(1 - (endAt - now) / duration);
            onFrame(progress);

            if (progress >= 1) {
                resolve();
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

function setWord(text) {
    if (!label) return;
    label.textContent = text;
}

function renderFixedCells(chars, getClassForIndex) {
    if (!label) return;
    const arr = Array.isArray(chars) ? chars : String(chars).split("");

    let html = "";
    for (let i = 0; i < maxLen; i += 1) {
        const ch = i < arr.length ? arr[i] : " ";
        const cls = typeof getClassForIndex === "function" ? getClassForIndex(i, ch) : "";

        const cellClasses = `char-cell ${cls}`;
        const cell = ch === " " ? "&nbsp;" : ch;
        html += `<span class=\"${cellClasses}\">${cell}</span>`;
    }
    label.innerHTML = html;
}

function applyDotColor(color) {
    if (!dot) return;
    dot.classList.remove("dot--red", "dot--white", "dot--gray", "dot--orange");
    if (color === "red") dot.classList.add("dot--red");
    else if (color === "white") dot.classList.add("dot--white");
    else if (color === "orange") dot.classList.add("dot--orange");
    else dot.classList.add("dot--gray");
}

let pulseTimer = null;
let currentPulseColor = "white";

function pulseDot() {
    if (!dot || reduceMotion) return;
    if (pulseTimer) {
        clearTimeout(pulseTimer);
        pulseTimer = null;
    }

    applyDotColor(currentPulseColor);
    pulseTimer = setTimeout(() => {
        pulseTimer = null;
        applyDotColor("gray");
    }, 80);
}

function cancelPulse() {
    if (pulseTimer) {
        clearTimeout(pulseTimer);
        pulseTimer = null;
    }
}

let glowFlickerTimer = null;

function startGlowFlicker() {
    if (reduceMotion) return;
    if (glowFlickerTimer) return;

    glowFlickerTimer = setInterval(() => {
        const jitter = 0.85 + rng() * 0.35; // [0.85..1.20]
        document.documentElement.style.setProperty("--glow-jitter", jitter.toFixed(3));
    }, 70);
}

function stopGlowFlicker() {
    if (glowFlickerTimer) {
        clearInterval(glowFlickerTimer);
        glowFlickerTimer = null;
    }
    document.documentElement.style.setProperty("--glow-jitter", "1");
}

// Règle lettre: blanc si affichée == attendue, sinon gris
function isCorrectAtIndex(targetText, i, shownChar) {
    const t = String(targetText).toUpperCase();
    const expected = i < t.length ? t[i] : " ";
    const shown = String(shownChar || " ").toUpperCase();
    if (expected === " ") return true;
    return shown === expected;
}

function randomCharExcept(expectedChar) {
    const expected = String(expectedChar || "").toUpperCase();
    if (!expected || expected === " ") return randomChar();

    // safety: boucle bornée
    for (let k = 0; k < 20; k += 1) {
        const c = randomChar();
        if (String(c).toUpperCase() !== expected) return c;
    }
    // fallback (rare): retourne quand même randomChar
    return randomChar();
}

async function scrambleStep(text, {mode, durationMs, frameMs, onLockDelta, onDone}) {
    if (!label) return;

    // snapshot session pour éviter qu'une ancienne anim écrive après un changement d'état
    const sid = getSession();

    if (reduceMotion) {
        setWord(text);
        return;
    }

    const {t, idx} = textIndices(text);
    const len = t.length;
    const order = shuffleInPlace([...idx]);

    const steps = order.length;
    const active = new Set();
    let lastActiveCount = 0;

    await animateTimed(durationMs, frameMs, (progress) => {
        if (sid !== getSession()) return; // annulé

        const shouldBeActive = Math.floor(progress * steps);
        for (let k = lastActiveCount; k < shouldBeActive; k += 1) {
            const i = order[k];
            if (i !== undefined) active.add(i);
        }

        // Delta de lock réel (pas basé sur le rendu)
        if (mode === "lock" && typeof onLockDelta === "function") {
            const activeCount = active.size;
            if (activeCount > lastActiveCount) {
                onLockDelta(activeCount - lastActiveCount);
            }
        }
        lastActiveCount = shouldBeActive;

        const out = [];
        for (let i = 0; i < len; i += 1) {
            const c = t[i];
            if (c === " ") {
                out.push(" ");
                continue;
            }
            if (mode === "lock") out.push(active.has(i) ? c : randomCharExcept(c));
            else out.push(active.has(i) ? randomCharExcept(c) : c);
        }

        renderFixedCells(out, (i, ch) => {
            if (i >= len) return "char--transparent";
            if (ch === " ") return "";
            return charClassFor(t, i, ch);
        });
    });

    if (sid !== getSession()) return; // annulé

    if (mode === "lock") {
        renderFixedCells(t.split(""), (i, ch) => {
            if (i >= len) return "char--transparent";
            if (ch === " ") return "";
            return "char--lit";
        });
    }

    onDone?.({t});
}

function lockLettersRandom(text, opts) {
    const isTarget = String(text).toLowerCase() === String(CONFIG.target).toLowerCase();

    return scrambleStep(text, {
        mode: "lock",
        durationMs: opts.durationMs,
        frameMs: opts.frameMs,
        onLockDelta: (delta) => {
            if (delta > 0) {
                currentPulseColor = isTarget ? "red" : "white";
                pulseDot();
            }
        },
    });
}

function unlockToScramble(text, opts) {
    return scrambleStep(text, {
        mode: "unlock",
        durationMs: opts.durationMs,
        frameMs: opts.frameMs,
    });
}

let finalGlitchTimer = null;
let activeFinalGlitches = null; // Map(index -> { wrongUntil, reacquireUntil, wrongChar })
let finalGlitchTarget = null; // { t, idx }
let lastFinalGlitchScheduledAt = 0; // invariant: pas 2 glitches dans la fenêtre max

function renderFinalGlitchFrame() {
    if (!finalGlitchTarget || !activeFinalGlitches) return;
    if (isFailureRunning) return;

    const now = performance.now();
    const {t, idx} = finalGlitchTarget;

    for (const [i, info] of [...activeFinalGlitches.entries()]) {
        if (!info) {
            activeFinalGlitches.delete(i);
            continue;
        }
        if (now >= info.reacquireUntil) activeFinalGlitches.delete(i);
    }

    const out = t.split("");
    for (const i of idx) {
        const info = activeFinalGlitches.get(i);
        if (!info) {
            out[i] = t[i];
            continue;
        }

        if (now < info.wrongUntil) {
            out[i] = info.wrongChar;
            continue;
        }

        if (now < info.reacquireUntil) {
            out[i] = randomCharExcept(t[i]);
            continue;
        }

        out[i] = t[i];
    }

    renderFixedCells(out, (i, ch) => {
        if (i >= t.length) return "char--transparent";
        if (ch === " ") return "";
        return charClassFor(t, i, ch);
    });

    // LED dérivée de l'état réel du texte affiché
    syncDotForExpectedWord(CONFIG.target, {matchedColor: "red", unmatchedColor: "gray"});
}

function scheduleNextFinalGlitch() {
    if (reduceMotion) return;
    if (!CONFIG.finalGlitch?.enabled) return;
    if (!finalGlitchTarget || !activeFinalGlitches) return;
    if (isFailureRunning) return;

    const cfg = CONFIG.finalGlitch;

    const minDelay = Math.max(0, cfg.minOneGlitchEveryMs ?? 0);
    const windowMs = Math.max(minDelay, cfg.maxOneGlitchEveryMs ?? minDelay);

    const now = performance.now();
    const earliest = Math.max(
        now + minDelay,
        lastFinalGlitchScheduledAt > 0 ? lastFinalGlitchScheduledAt + windowMs : now + minDelay
    );

    const slack = Math.max(0, windowMs - minDelay);
    const jitter = slack > 0 ? Math.floor(rng() * slack) : 0;

    const fireAt = earliest + jitter;
    const delay = Math.max(0, fireAt - now);

    if (finalGlitchTimer) clearTimeout(finalGlitchTimer);
    finalGlitchTimer = setTimeout(() => {
        finalGlitchTimer = null;

        if (!finalGlitchTarget || !activeFinalGlitches) return;

        if (activeFinalGlitches.size > 0) {
            scheduleNextFinalGlitch();
            return;
        }

        lastFinalGlitchScheduledAt = performance.now();

        const {idx, t} = finalGlitchTarget;
        const candidates = idx.filter((i) => !activeFinalGlitches.has(i));
        if (candidates.length === 0) {
            scheduleNextFinalGlitch();
            return;
        }

        const maxN = Math.max(1, Math.min(cfg.maxConcurrent ?? 1, candidates.length));
        const howMany = 1 + Math.floor(rng() * maxN);

        const now = performance.now();
        const wrongMs = Math.max(80, cfg.glitchMs ?? 400);
        const reacquireMs = Math.max(120, cfg.reacquireMs ?? 280);

        const pool = [...candidates];

        for (let k = 0; k < howMany; k += 1) {
            if (pool.length === 0) break;

            const chosen = pickRandom(pool);
            if (chosen === undefined) break;

            const pos = pool.indexOf(chosen);
            if (pos >= 0) pool.splice(pos, 1);

            let wrong = randomChar();
            const correct = t[chosen];
            let guard = 0;
            while (wrong === correct && guard < 10) {
                wrong = randomChar();
                guard += 1;
            }

            activeFinalGlitches.set(chosen, {
                wrongUntil: now + wrongMs,
                reacquireUntil: now + wrongMs + reacquireMs,
                wrongChar: wrong,
            });
        }

        renderFinalGlitchFrame();

        const repaint = () => {
            if (!activeFinalGlitches) return;

            renderFinalGlitchFrame();

            if (activeFinalGlitches.size === 0) {
                scheduleNextFinalGlitch();
                return;
            }
            requestAnimationFrame(repaint);
        };

        requestAnimationFrame(repaint);
    }, delay);
}

function startFinalGlitchMode(targetWord) {
    if (reduceMotion) return;
    if (!CONFIG.finalGlitch?.enabled) return;

    const {t, idx} = textIndices(targetWord);
    finalGlitchTarget = {t, idx};
    activeFinalGlitches = new Map();

    renderFinalGlitchFrame();
    scheduleNextFinalGlitch();
}

function stopFinalGlitchMode() {
    if (finalGlitchTimer) {
        clearTimeout(finalGlitchTimer);
        finalGlitchTimer = null;
    }
    stopFinalRepaintLoop();
    activeFinalGlitches = null;
    finalGlitchTarget = null;
}


async function runSequence() {
    setMode(Modes.NORMAL);

    const sequence = CONFIG.items.filter((w) => w.toLowerCase() !== CONFIG.target.toLowerCase());
    sequence.push(CONFIG.target);

    applyDotColor("gray");

    for (const word of sequence) {
        const isTarget = word.toLowerCase() === CONFIG.target.toLowerCase();
        currentPulseColor = isTarget ? "red" : "white";

        if (isTarget) {
            setMode(Modes.TARGET, {phase: Phases.ACQUIRE});
            setExpectedWord(CONFIG.target);
        } else {
            setExpectedWord(word);
        }

        await lockLettersRandom(word, {
            durationMs: isTarget ? CONFIG.timing.settleEaseMs : CONFIG.timing.wordLockMs,
            frameMs: CONFIG.timing.scrambleFrameMs,
        });

        cancelPulse();

        if (isTarget) {
            state.phase = Phases.FINAL_GLITCH;

            syncDotForExpectedWord(CONFIG.target, {matchedColor: "red"});

            startFinalGlitchMode(CONFIG.target);
            break;
        }

        // Hold: dot blanc uniquement si le mot est correctement affiché
        syncDotForExpectedWord(word, {matchedColor: "white"});

        if (!reduceMotion) await sleep(CONFIG.timing.holdWordMs);

        applyDotColor("gray");
        await unlockToScramble(word, {
            durationMs: Math.max(
                CONFIG.timing.betweenUnlockMinMs,
                Math.round(CONFIG.timing.wordLockMs * CONFIG.timing.betweenUnlockFactor)
            ),
            frameMs: CONFIG.timing.scrambleFrameMs,
        });
    }
}

async function waitForFont() {
    if (!document.fonts || !document.fonts.load) return;

    const sample = `${CONFIG.font.loadSamplePx}px "${CONFIG.font.family}"`;

    try {
        await Promise.race([
            (async () => {
                await document.fonts.load(sample);
                await document.fonts.ready;
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("font-timeout")), CONFIG.font.timeoutMs)),
        ]);
    } catch {
        // ignore
    }
}

async function bootDotBlink() {
    if (reduceMotion) return;

    const {blinkCount, blinkTotalMs, onColor, offColor} = CONFIG.boot;

    const half = Math.round(blinkTotalMs / (blinkCount * 2));
    for (let i = 0; i < blinkCount; i += 1) {
        applyDotColor(onColor);
        await sleep(half);
        applyDotColor(offColor);
        await sleep(half);
    }
}

(async function boot() {
    // Jitter global: actif dès le début, quel que soit le mode
    startGlowFlicker();

    setMode(Modes.BOOT);

    await waitForFont();

    applyDotColor("gray");
    setWord("");

    document.body.classList.remove("is-preparing");

    if (reduceMotion) {
        setWord(CONFIG.target);
        document.body.classList.remove("booting");
        applyDotColor("red");
        setMode(Modes.TARGET, {phase: Phases.FINAL_GLITCH});
        setExpectedWord(CONFIG.target);
        return;
    }

    await bootDotBlink();

    setWord(CONFIG.items.find((w) => w.toLowerCase() !== CONFIG.target.toLowerCase()) || CONFIG.items[0] || CONFIG.target);
    applyDotColor("gray");

    setMode(Modes.NORMAL);

    runSequence().finally(() => {
        cancelPulse();
        document.body.classList.remove("booting");
    });
})();

window.addEventListener("beforeunload", () => {
    cancelPulse();
    stopGlowFlicker();
    stopFinalGlitchMode();
});

// Gamification: chaque tap/click déclenche un glitch
window.addEventListener("pointerdown", () => {
    triggerFinalGlitchNow();
}, {passive: true});

let finalRepaintRaf = null;
function startFinalRepaintLoop() {
    if (finalRepaintRaf) return;

    const tick = () => {
        finalRepaintRaf = null;

        if (!activeFinalGlitches) return;

        renderFinalGlitchFrame();

        if (activeFinalGlitches.size === 0) {
            scheduleNextFinalGlitch();
            return;
        }

        finalRepaintRaf = requestAnimationFrame(tick);
    };

    finalRepaintRaf = requestAnimationFrame(tick);
}

function stopFinalRepaintLoop() {
    if (finalRepaintRaf) {
        cancelAnimationFrame(finalRepaintRaf);
        finalRepaintRaf = null;
    }
}

let clickGlitchTimes = [];
let isFailureRunning = false;

async function runFailureSequence() {
    if (isFailureRunning) return;
    isFailureRunning = true;

    setMode(Modes.FAILURE);

    // IMPORTANT: stoppe toutes les boucles/timers qui peuvent réécrire le label pendant FAILURE
    stopFinalGlitchMode();

    const toggles = CONFIG.failure.blinkCount * 2;
    const failureWord = "ERREUR";

    let on = false;
    for (let step = 0; step < toggles; step += 1) {
        on = !on;

        renderFixedCells(
            failureWord.split(""),
            (i, ch) => (ch === " " ? "" : (on ? "char--lit" : "char--dim"))
        );

        applyDotColor(on ? "orange" : "gray");

        await sleep(CONFIG.failure.blinkMs);
    }

    // Après le dernier blink: maintenir FAILURE 1s (dot orange allumé)
    renderFixedCells(
        failureWord.split(""),
        (i, ch) => (ch === " " ? "" : "char--lit")
    );
    applyDotColor("orange");
    await sleep(CONFIG.failure.holdAfterMs);

    // Disparition progressive (comme les autres mots) : on repasse en scramble progressivement
    applyDotColor("gray");
    if (!reduceMotion) {
        const unlockMs = Math.max(0, CONFIG.failure.unlockOutMs ?? 0);
        if (unlockMs > 0) {
            await unlockToScramble(failureWord, {
                durationMs: unlockMs,
                frameMs: CONFIG.timing.scrambleFrameMs,
            });
        }
    }

    // Clean
    applyDotColor("gray");

    // IMPORTANT: on sort du mode FAILURE AVANT de relancer la phase finale,
    // sinon render/schedule des glitches est court-circuité par isFailureRunning.
    clickGlitchTimes = [];
    isFailureRunning = false;

    // Relance la recherche Lavenda depuis zéro (pas de pop 'déjà trouvé')
    await startFinalPhaseFromScratch();
}

function registerClickGlitchAndCheckFailure() {
    const now = performance.now();
    clickGlitchTimes.push(now);
    const cutoff = now - CONFIG.failure.windowMs;
    clickGlitchTimes = clickGlitchTimes.filter((t) => t >= cutoff);
    return clickGlitchTimes.length > CONFIG.failure.maxClicks;
}

// Nouveau: redémarrer la phase finale depuis zéro (évite le 'pop' locké)
async function startFinalPhaseFromScratch() {
    stopFinalGlitchMode();

    lastFinalGlitchScheduledAt = 0;
    activeFinalGlitches = null;
    finalGlitchTarget = null;

    cancelPulse();

    setMode(Modes.TARGET, {phase: Phases.ACQUIRE});

    // Affiche un scramble plein largeur (maxLen) pour éviter tout pop
    if (!reduceMotion) {
        const t = String(CONFIG.target).toUpperCase();
        const out = [];
        for (let i = 0; i < maxLen; i += 1) {
            const expected = i < t.length ? t[i] : " ";
            out.push(expected === " " ? " " : randomCharExcept(expected));
        }
        renderFixedCells(out, (i, ch) => (ch === " " ? "" : "char--dim"));
        applyDotColor("gray");
        // laisse le navigateur peindre
        await new Promise((r) => requestAnimationFrame(() => r()));
    }

    await lockLettersRandom(CONFIG.target, {
        durationMs: CONFIG.timing.settleEaseMs,
        frameMs: CONFIG.timing.scrambleFrameMs,
    });

    cancelPulse();
    setMode(Modes.TARGET, {phase: Phases.FINAL_GLITCH});

    // état final + events
    syncDotForExpectedWord(CONFIG.target, {matchedColor: "red"});
    startFinalGlitchMode(CONFIG.target);
}

function triggerFinalGlitchNow() {
    if (reduceMotion) return;
    if (!CONFIG.finalGlitch?.enabled) return;
    if (!(state.mode === Modes.TARGET && state.phase === Phases.FINAL_GLITCH)) return;
    if (!finalGlitchTarget || !activeFinalGlitches) return;
    if (isFailureRunning) return;

    // Spam detect -> FAILURE
    if (registerClickGlitchAndCheckFailure()) {
        runFailureSequence();
        return;
    }

    const cfg = CONFIG.finalGlitch;
    const {idx, t} = finalGlitchTarget;

    const notGlitched = idx.filter((i) => !activeFinalGlitches.has(i));
    const chosen = pickRandom(notGlitched.length > 0 ? notGlitched : idx);
    if (chosen === undefined) return;

    const now = performance.now();
    const wrongMs = Math.max(80, cfg.glitchMs ?? 400);
    const reacquireMs = Math.max(120, cfg.reacquireMs ?? 280);

    activeFinalGlitches.set(chosen, {
        wrongUntil: now + wrongMs,
        reacquireUntil: now + wrongMs + reacquireMs,
        wrongChar: randomCharExcept(t[chosen]),
    });

    lastFinalGlitchScheduledAt = now;

    renderFinalGlitchFrame();
    startFinalRepaintLoop();
}

// --- Helpers (texte affiché + match exact + dot dérivé) ---
function getDisplayedText() {
    if (!label) return "";

    // Si on est en mode spans (innerHTML), on reconstruit.
    const cells = label.querySelectorAll?.(".char-cell");
    if (cells && cells.length > 0) {
        let s = "";
        cells.forEach((el) => {
            const t = (el.textContent || " ");
            s += t === "\u00A0" ? " " : t;
        });
        return s;
    }

    return label.textContent || "";
}

function isExactMatchPadded(displayed, target) {
    const d = String(displayed || "").toUpperCase();
    const t = String(target || "").toUpperCase();

    if (d.slice(0, t.length) !== t) return false;

    const rest = d.slice(t.length);
    return !(/[\S]/.test(rest));
}

function syncDotForExpectedWord(expectedWord, {matchedColor, unmatchedColor = "gray"} = {}) {
    const displayed = getDisplayedText();
    const ok = isExactMatchPadded(displayed, expectedWord);
    applyDotColor(ok ? matchedColor : unmatchedColor);
    return ok;
}

