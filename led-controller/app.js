// =============================================
//  NEON SYNC — Web Bluetooth LED Controller
//  Full-featured app.js
// =============================================

// --- STATE ---
let bleDevice = null;
let writeChar = null;
let isPoweredOn = true;
let currentMode = 1;
let currentMusicModel = 1;
let currentHwMusic = -1;
let lastSentTime = 0;
let micSensitivity = 5;

// --- 212 ADDRESSABLE MODES ---
const MODE_NAMES = {
    1: "Auto Play", 2: "Magic Forward", 3: "Magic Back", 4: "7-Color Energy", 5: "7-Color Jump",
    6: "3-Color Jump", 7: "1-Color Jump", 8: "Red Fade", 9: "Green Fade", 10: "Blue Fade",
    11: "Yellow Fade", 12: "Cyan Fade", 13: "Purple Fade", 14: "White Fade", 15: "R-G Cross Fade",
    16: "R-B Cross Fade", 17: "G-B Cross Fade", 18: "7-Color Strobe", 19: "Red Strobe", 20: "Green Strobe",
    21: "Blue Strobe", 22: "Yellow Strobe", 23: "Cyan Strobe", 24: "Purple Strobe", 25: "White Strobe",
    26: "7-Color Flow", 27: "Red Flow", 28: "Green Flow", 29: "Blue Flow", 30: "Yellow Flow",
    31: "Cyan Flow", 32: "Purple Flow", 33: "White Flow", 34: "7-Color Chase", 35: "Red Chase",
    36: "Green Chase", 37: "Blue Chase", 38: "Yellow Chase", 39: "Cyan Chase", 40: "Purple Chase",
    41: "White Chase", 42: "7-Color Twinkle", 43: "R-G-B Twinkle",
    44: "R-G-B Flush Close", 45: "R-G-B Flush Open", 46: "Y-C-P Flush Close", 47: "Y-C-P Flush Open"
};
const MODES = [];
for (let i = 1; i <= 212; i++) {
    let category = 'water';
    if (i <= 47) category = 'basic';
    else if (i <= 99) category = 'curtain';
    else if (i <= 150) category = 'trans';
    MODES.push({ id: i, name: MODE_NAMES[i] || `${i} Mode`, category });
}

// Hardware music modes (built-in on the controller chip)
const HW_MUSIC = [
    { id: 1, name: "Energy Beat", icon: "\u26A1" },
    { id: 2, name: "Spectrum", icon: "\uD83C\uDF08" },
    { id: 3, name: "Rolling", icon: "\uD83C\uDF0A" },
    { id: 4, name: "Stamp", icon: "\uD83D\uDCA5" },
    { id: 5, name: "Rhythm", icon: "\uD83C\uDFB6" },
    { id: 6, name: "Pulse", icon: "\uD83D\uDC93" },
    { id: 7, name: "Gradient", icon: "\uD83C\uDF1F" },
    { id: 8, name: "Firework", icon: "\uD83C\uDF86" },
    { id: 9, name: "Storm", icon: "\u26C8\uFE0F" },
    { id: 10, name: "Rainbow", icon: "\uD83E\uDD84" },
    { id: 11, name: "Aurora", icon: "\u2728" },
    { id: 12, name: "Flow", icon: "\uD83C\uDF0C" }
];

// --- DOM ELEMENTS ---
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const connectBtn = $('connectBtn');
const powerBtn = $('powerBtn');
const connectionStatus = $('connectionStatus');
const liveColorDot = $('liveColorDot');

const colorWheel = $('colorWheel');
const ctx = colorWheel.getContext('2d');
const colorPreview = $('colorPreview');
const inputR = $('inputR'), inputG = $('inputG'), inputB = $('inputB');
const brightnessSlider = $('brightnessSlider');
const cctSlider = $('cctSlider');

const modesList = $('modesList');
const speedSlider = $('speedSlider');
const speedValue = $('speedValue');

const musicHwGrid = $('musicHwGrid');
const musicSpeedSlider = $('musicSpeedSlider');

const musicSyncBtn = $('musicSyncBtn');
const micSensitivitySlider = $('micSensitivity');
const visualizer = $('visualizer');
const visCtx = visualizer.getContext('2d');

const sequenceList = $('sequenceList');
const customColorPicker = $('customColorPicker');
const addSequenceColorBtn = $('addSequenceColorBtn');
const clearSequenceBtn = $('clearSequenceBtn');
const customSpeedSlider = $('customSpeedSlider');
const playSequenceBtn = $('playSequenceBtn');

const timerStatus = $('timerStatus');
const scheduleStatus = $('scheduleStatus');
const scheduleToggle = $('scheduleToggle');

// --- INIT ---
function init() {
    drawColorWheel();
    populateModes('basic');
    populateHwMusic();
    setupEventListeners();
    window.addEventListener('resize', drawColorWheel);
}

// --- BLE ---
async function sendCommand(payload) {
    if (!writeChar) return;
    if (Date.now() - lastSentTime < 40) return;
    lastSentTime = Date.now();
    try {
        const data = new Uint8Array(payload);
        if (writeChar.properties.writeWithoutResponse) await writeChar.writeValueWithoutResponse(data);
        else await writeChar.writeValue(data);
    } catch (e) { console.error("BLE Write Error", e); }
}

connectBtn.addEventListener('click', async () => {
    if (bleDevice && bleDevice.gatt.connected) { bleDevice.gatt.disconnect(); return; }
    try {
        bleDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
                '0000fff0-0000-1000-8000-00805f9b34fb',
                '0000ffe5-0000-1000-8000-00805f9b34fb',
                '0000ffd5-0000-1000-8000-00805f9b34fb'
            ]
        });
        connectionStatus.textContent = 'Connecting...';
        bleDevice.addEventListener('gattserverdisconnected', onDisconnect);
        const server = await bleDevice.gatt.connect();
        const services = await server.getPrimaryServices();
        for (const svc of services) {
            const chars = await svc.getCharacteristics();
            for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) { writeChar = c; break; }
            }
            if (writeChar) break;
        }
        if (writeChar) {
            connectionStatus.textContent = bleDevice.name || 'Connected';
            connectBtn.classList.add('connected');
            powerBtn.classList.add('on');
            isPoweredOn = true;
        } else { connectionStatus.textContent = 'No writable char'; }
    } catch (e) { connectionStatus.textContent = 'Disconnected'; }
});

function onDisconnect() {
    writeChar = null;
    connectionStatus.textContent = 'Disconnected';
    connectBtn.classList.remove('connected');
    powerBtn.classList.remove('on');
    stopMicSync();
    stopSequence();
}

// --- COMMANDS ---
async function setPower(on) {
    await sendCommand(on ?
        [0x7E, 0x04, 0x04, 0xF0, 0x00, 0x01, 0xFF, 0x00, 0xEF] :
        [0x7E, 0x04, 0x04, 0x00, 0x00, 0x00, 0xFF, 0x00, 0xEF]);
}

async function setColor(r, g, b) {
    await sendCommand([0x7E, 0x07, 0x05, 0x03, r, g, b, 0x10, 0xEF]);
    colorPreview.style.background = `rgb(${r},${g},${b})`;
    liveColorDot.style.background = `rgb(${r},${g},${b})`;
    inputR.value = r; inputG.value = g; inputB.value = b;
}

async function setBrightness(v) {
    await sendCommand([0x7E, 0x04, 0x01, v, 0x00, 0x00, 0x00, 0x00, 0xEF]);
}

async function setCCT(warm, cool) {
    await sendCommand([0x7E, 0x00, 0x05, 0x02, warm, cool, 0x00, 0x00, 0xEF]);
}

async function setMode(id) {
    await sendCommand([0x7E, 0x07, 0x03, id, 0x03, 0xFF, 0xFF, 0x00, 0xEF]);
    currentMode = id;
}

async function setSpeed(v) {
    await sendCommand([0x7E, 0x07, 0x02, v, 0xFF, 0xFF, 0xFF, 0x00, 0xEF]);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Navigation
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            $$('.nav-item').forEach(n => n.classList.remove('active'));
            $$('.tab-pane').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            $(item.dataset.target).classList.add('active');
        });
    });

    // Sub-tabs (Style)
    $$('.stab').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.stab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            populateModes(btn.dataset.filter);
        });
    });

    // Music model buttons (Mic tab)
    $$('.mic-model').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.mic-model').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMusicModel = parseInt(btn.dataset.model);
        });
    });

    // Power
    powerBtn.addEventListener('click', () => {
        isPoweredOn = !isPoweredOn;
        powerBtn.classList.toggle('on', isPoweredOn);
        setPower(isPoweredOn);
    });

    // Color wheel interactions
    let dragging = false;
    colorWheel.addEventListener('mousedown', e => { dragging = true; pickColor(e); });
    colorWheel.addEventListener('mousemove', e => { if (dragging) pickColor(e); });
    window.addEventListener('mouseup', () => { dragging = false; });
    colorWheel.addEventListener('touchstart', e => { dragging = true; pickColor(e.touches[0]); }, { passive: true });
    colorWheel.addEventListener('touchmove', e => { if (dragging) { e.preventDefault(); pickColor(e.touches[0]); } }, { passive: false });
    window.addEventListener('touchend', () => { dragging = false; });

    // RGB inputs
    [inputR, inputG, inputB].forEach(inp => {
        inp.addEventListener('change', () => setColor(+inputR.value, +inputG.value, +inputB.value));
    });

    // Brightness
    brightnessSlider.addEventListener('input', e => setBrightness(+e.target.value));

    // CCT slider
    cctSlider.addEventListener('input', e => {
        const v = +e.target.value;
        const warm = 100 - v;
        const cool = v;
        setCCT(warm, cool);
    });

    // Presets
    $$('.pchip[data-r]').forEach(btn => {
        btn.addEventListener('click', () => setColor(+btn.dataset.r, +btn.dataset.g, +btn.dataset.b));
    });
    // CCT preset
    const cctChip = document.querySelector('.cct-chip');
    if (cctChip) cctChip.addEventListener('click', () => setCCT(50, 50));

    // Speed
    speedSlider.addEventListener('input', e => {
        speedValue.textContent = e.target.value;
        setSpeed(+e.target.value);
    });

    // Music speed
    musicSpeedSlider.addEventListener('input', e => setSpeed(+e.target.value));

    // Mic sensitivity
    micSensitivitySlider.addEventListener('input', e => { micSensitivity = +e.target.value; });

    // Timer buttons
    $$('.timer-btn').forEach(btn => {
        btn.addEventListener('click', () => setTimer(+btn.dataset.time));
    });

    // Transition buttons (Custom tab)
    $$('.trans-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.trans-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            transitionType = btn.dataset.type;
            if (isSequencePlaying) { stopSequence(); playSequence(); }
        });
    });

    // Schedule
    scheduleToggle.addEventListener('click', toggleSchedule);

    // Mic sync
    musicSyncBtn.addEventListener('click', () => { isMicActive ? stopMicSync() : startMicSync(); });

    // Custom sequence
    addSequenceColorBtn.addEventListener('click', addSeqColor);
    clearSequenceBtn.addEventListener('click', () => { sequenceColors = []; renderSeq(); stopSequence(); });
    playSequenceBtn.addEventListener('click', () => { isSequencePlaying ? stopSequence() : playSequence(); });
    customSpeedSlider.addEventListener('input', () => { if (isSequencePlaying) { stopSequence(); playSequence(); } });
}

// --- COLOR WHEEL ---
function drawColorWheel() {
    const r = colorWheel.width / 2;
    for (let a = 0; a < 360; a++) {
        ctx.beginPath(); ctx.moveTo(r, r);
        ctx.arc(r, r, r, (a - 1) * Math.PI / 180, a * Math.PI / 180);
        ctx.closePath(); ctx.fillStyle = `hsl(${a},100%,50%)`; ctx.fill();
    }
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, colorWheel.width, colorWheel.height);
}

function pickColor(e) {
    const rect = colorWheel.getBoundingClientRect();
    const sx = colorWheel.width / rect.width;
    const sy = colorWheel.height / rect.height;
    if (e.clientX === undefined) return;
    let x = (e.clientX - rect.left) * sx;
    let y = (e.clientY - rect.top) * sy;
    const r = colorWheel.width / 2;
    const dx = x - r, dy = y - r, d = Math.sqrt(dx * dx + dy * dy);
    if (d > r) { x = r + dx * r / d; y = r + dy * r / d; }
    const px = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    setColor(px[0], px[1], px[2]);
    customColorPicker.value = '#' + (1 << 24 | px[0] << 16 | px[1] << 8 | px[2]).toString(16).slice(1);
}

// --- MODES ---
function populateModes(cat) {
    modesList.innerHTML = '';
    MODES.filter(m => m.category === cat).forEach(m => {
        const d = document.createElement('div');
        d.className = 'mode-card' + (currentMode === m.id ? ' active' : '');
        d.textContent = m.name;
        d.addEventListener('click', () => {
            $$('.mode-card').forEach(el => el.classList.remove('active'));
            d.classList.add('active');
            setMode(m.id);
        });
        modesList.appendChild(d);
    });
}

// --- HW MUSIC MODES ---
function populateHwMusic() {
    musicHwGrid.innerHTML = '';
    HW_MUSIC.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'hw-mode';
        btn.innerHTML = `<div class="hw-icon">${m.icon}</div><div class="hw-name">${m.name}</div>`;
        btn.addEventListener('click', () => {
            $$('.hw-mode').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            currentHwMusic = m.id;
            // HW music modes typically map to mode IDs in the 0x01-0x0C range with a music command
            setMode(m.id);
        });
        musicHwGrid.appendChild(btn);
    });
}

// --- MIC SYNC ---
let audioCtx, analyser, source;
let isMicActive = false;
let rafId, hueShift = 0, impactFlip = false, audioState = {};

async function startMicSync() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        isMicActive = true;
        stopSequence();
        musicSyncBtn.textContent = 'Stop Listening';
        musicSyncBtn.classList.replace('primary', 'secondary');
        tickMic();
    } catch (e) { alert('Microphone access denied.'); }
}

function stopMicSync() {
    isMicActive = false;
    musicSyncBtn.textContent = 'Start Listening';
    musicSyncBtn.classList.replace('secondary', 'primary');
    cancelAnimationFrame(rafId);
    if (audioCtx) audioCtx.close();
    visCtx.clearRect(0, 0, visualizer.width, visualizer.height);
}

function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function mapReactiveColor(modelId, aB, aM, aT, aE, hShift, flip, state = {}) {
    const bass = clampByte(aB * 1.2);
    const mid = clampByte(aM * 1.15);
    const treble = clampByte(aT * 1.1);
    const energy = clampByte(aE * 1.25);

    if (state.avgEnergy === undefined) state.avgEnergy = 25;
    if (state.smoothR === undefined) state.smoothR = 40;
    if (state.smoothG === undefined) state.smoothG = 10;
    if (state.smoothB === undefined) state.smoothB = 60;
    if (state.envelope === undefined) state.envelope = 0.2;
    if (state.melodyHue === undefined) state.melodyHue = 280;
    if (state.rippleDecay === undefined) state.rippleDecay = 0;

    state.avgEnergy = state.avgEnergy * 0.94 + energy * 0.06;
    const beatThreshold = Math.max(35, state.avgEnergy * 1.3);
    const isBeat = (energy > beatThreshold) && (bass > 50);

    const targetEnv = Math.min(1.0, Math.max(0.2, energy / 180));
    if (targetEnv > state.envelope) {
        state.envelope += (targetEnv - state.envelope) * 0.45;
    } else {
        state.envelope += (targetEnv - state.envelope) * 0.12;
    }

    let targetR = 0, targetG = 0, targetB = 0;

    switch (modelId) {
        case 1: {
            if (isBeat) { flip = !flip; state.rippleDecay = 1.0; }
            else { state.rippleDecay *= 0.88; }
            if (flip) {
                targetR = Math.round(10 + state.rippleDecay * 235);
                targetG = Math.round(180 * state.envelope + state.rippleDecay * 75);
                targetB = Math.round(220 + state.rippleDecay * 35);
            } else {
                targetR = Math.round(230 * state.envelope + state.rippleDecay * 25);
                targetG = Math.round(60 + state.rippleDecay * 140);
                targetB = Math.round(180 * (1 - state.rippleDecay));
            }
            break;
        }
        case 2: {
            state.melodyHue = (state.melodyHue + 0.35 + (mid / 500)) % 360;
            const bright = Math.min(0.8, Math.max(0.25, state.envelope * 0.85));
            [targetR, targetG, targetB] = hsl(state.melodyHue / 360, 0.85, bright);
            break;
        }
        case 3: {
            if (isBeat) { state.rippleDecay = 1.0; } else { state.rippleDecay *= 0.92; }
            const baseHue = 195 + (treble / 10);
            const rippleLum = Math.min(0.85, 0.2 + state.envelope * 0.3 + state.rippleDecay * 0.35);
            [targetR, targetG, targetB] = hsl((baseHue % 360) / 360, 0.9, rippleLum);
            break;
        }
        case 4: {
            hShift = (hShift + 1.5 + (energy / 40)) % 360;
            const lum = Math.min(0.75, Math.max(0.3, state.envelope * 0.75));
            [targetR, targetG, targetB] = hsl(hShift / 360, 0.95, lum);
            break;
        }
        case 5: {
            if (bass > 110 && isBeat) { state.rippleDecay = 1.0; } else { state.rippleDecay *= 0.85; }
            targetR = Math.round(120 + state.rippleDecay * 135);
            targetG = Math.round(20 + state.rippleDecay * 180);
            targetB = Math.round(40 + (1 - state.rippleDecay) * 80);
            break;
        }
        case 6: {
            state.melodyHue = (state.melodyHue + 0.2) % 360;
            const sunsetHue = 340 + Math.sin(state.melodyHue * Math.PI / 180) * 35;
            const sunsetLum = Math.min(0.75, Math.max(0.28, state.envelope * 0.7));
            [targetR, targetG, targetB] = hsl(((sunsetHue + 360) % 360) / 360, 0.9, sunsetLum);
            break;
        }
        case 7: {
            const vocal = Math.max(mid, treble * 0.9);
            const vocalGlow = Math.min(1.0, vocal / 160);
            targetR = Math.round(240 * (0.4 + vocalGlow * 0.6));
            targetG = Math.round(140 * (0.3 + vocalGlow * 0.7));
            targetB = Math.round(50 + treble * 0.5);
            break;
        }
        case 8: {
            hShift = (hShift + (isBeat ? 20 : 2)) % 360;
            const cyberHue = isBeat ? 310 : 185;
            const cyberLum = Math.min(0.8, Math.max(0.3, state.envelope * 0.8));
            [targetR, targetG, targetB] = hsl(cyberHue / 360, 1.0, cyberLum);
            break;
        }
    }

    state.smoothR += (targetR - state.smoothR) * 0.28;
    state.smoothG += (targetG - state.smoothG) * 0.28;
    state.smoothB += (targetB - state.smoothB) * 0.28;

    return {
        r: clampByte(state.smoothR),
        g: clampByte(state.smoothG),
        b: clampByte(state.smoothB),
        hueShift: hShift,
        impactFlip: flip,
        audioState: state
    };
}

function tickMic() {
    if (!isMicActive) return;
    rafId = requestAnimationFrame(tickMic);
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    visCtx.clearRect(0, 0, visualizer.width, visualizer.height);
    const bw = visualizer.width / data.length * 2.5;
    let x = 0, bass = 0, mid = 0, treble = 0, total = 0;
    for (let i = 0; i < data.length; i++) {
        const bh = data[i] * 0.4;
        const hue = (i / data.length) * 280;
        visCtx.fillStyle = `hsl(${hue}, 80%, ${40 + bh * 0.2}%)`;
        visCtx.fillRect(x, visualizer.height - bh, bw, bh);
        x += bw + 1;
        total += data[i];
        if (i < 10) bass += data[i];
        else if (i < 50) mid += data[i];
        else treble += data[i];
    }

    if (Date.now() - lastSentTime > 40 && writeChar) {
        const sens = micSensitivity / 5;
        const aB = Math.min(255, Math.floor(bass / 10 * 1.5 * sens));
        const aM = Math.min(255, Math.floor(mid / 40 * 1.5 * sens));
        const aT = Math.min(255, Math.floor(treble / 40 * 1.5 * sens));
        const aE = Math.min(255, Math.floor((total / data.length) * 1.5 * sens));

        const mapped = mapReactiveColor(currentMusicModel, aB, aM, aT, aE, hueShift, impactFlip, audioState);
        hueShift = mapped.hueShift;
        impactFlip = mapped.impactFlip;
        audioState = mapped.audioState;
        if (mapped.r > 0 || mapped.g > 0 || mapped.b > 0) {
            setColor(mapped.r, mapped.g, mapped.b);
        }
    }
}

// --- CUSTOM SEQUENCES ---
let sequenceColors = [];
let seqInterval = null;
let seqRaf = null;
let seqIdx = 0;
let isSequencePlaying = false;
let transitionType = 'jump';

function addSeqColor() {
    const hex = customColorPicker.value;
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    sequenceColors.push({ r, g, b, hex });
    renderSeq();
}

function renderSeq() {
    sequenceList.innerHTML = '';
    sequenceColors.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = 'seq-block';
        d.style.background = c.hex;
        d.id = `sq-${i}`;
        // Click to remove
        d.addEventListener('click', () => {
            sequenceColors.splice(i, 1);
            renderSeq();
            if (isSequencePlaying && sequenceColors.length === 0) stopSequence();
        });
        sequenceList.appendChild(d);
    });
}

function stopSequence() {
    isSequencePlaying = false;
    playSequenceBtn.textContent = 'Play Sequence';
    playSequenceBtn.classList.replace('secondary', 'primary');
    clearInterval(seqInterval);
    cancelAnimationFrame(seqRaf);
    $$('.seq-block').forEach(el => el.classList.remove('playing'));
}

function playSequence() {
    if (!sequenceColors.length) return;
    stopMicSync();
    isSequencePlaying = true;
    playSequenceBtn.textContent = 'Stop';
    playSequenceBtn.classList.replace('primary', 'secondary');
    seqIdx = 0;
    if (transitionType === 'jump') runJump(); else runFade();
}

function runJump() {
    const speed = 2100 - +customSpeedSlider.value * 20;
    tickJump();
    seqInterval = setInterval(tickJump, speed);
}

function tickJump() {
    $$('.seq-block').forEach(el => el.classList.remove('playing'));
    const el = $(`sq-${seqIdx}`);
    if (el) el.classList.add('playing');
    const c = sequenceColors[seqIdx];
    if (Date.now() - lastSentTime > 40 && writeChar) setColor(c.r, c.g, c.b);
    seqIdx = (seqIdx + 1) % sequenceColors.length;
}

let fadeStart = 0, fadeDur = 1000;
function runFade() {
    fadeDur = 2100 - +customSpeedSlider.value * 20;
    fadeStart = Date.now();
    highlightSeq();
    seqRaf = requestAnimationFrame(fadeLoop);
}
function highlightSeq() {
    $$('.seq-block').forEach(el => el.classList.remove('playing'));
    const el = $(`sq-${seqIdx}`);
    if (el) el.classList.add('playing');
}
function fadeLoop() {
    if (!isSequencePlaying) return;
    let elapsed = Date.now() - fadeStart;
    if (elapsed >= fadeDur) {
        seqIdx = (seqIdx + 1) % sequenceColors.length;
        fadeStart = Date.now(); elapsed = 0;
        highlightSeq();
    }
    const cur = sequenceColors[seqIdx];
    const nxt = sequenceColors[(seqIdx + 1) % sequenceColors.length];
    const p = elapsed / fadeDur;
    const r = Math.round(cur.r + (nxt.r - cur.r) * p);
    const g = Math.round(cur.g + (nxt.g - cur.g) * p);
    const b = Math.round(cur.b + (nxt.b - cur.b) * p);
    if (Date.now() - lastSentTime > 50 && writeChar) setColor(r, g, b);
    seqRaf = requestAnimationFrame(fadeLoop);
}

// --- SCHEDULE ---
let timerId;
function setTimer(mins) {
    clearTimeout(timerId);
    if (mins === 0) { timerStatus.textContent = "Timer cancelled."; return; }
    timerStatus.textContent = `Lights off in ${mins} min`;
    timerId = setTimeout(() => {
        setPower(false); isPoweredOn = false; powerBtn.classList.remove('on');
        timerStatus.textContent = "Timer done. Lights off.";
    }, mins * 60000);
}

let scheduleEnabled = false;
let scheduleCheckId;
function toggleSchedule() {
    scheduleEnabled = !scheduleEnabled;
    scheduleToggle.textContent = scheduleEnabled ? 'Disable Schedule' : 'Enable Schedule';
    scheduleToggle.classList.toggle('primary', scheduleEnabled);
    scheduleToggle.classList.toggle('outline', !scheduleEnabled);
    scheduleStatus.textContent = scheduleEnabled ? 'Schedule active' : 'Schedule inactive';
    if (scheduleEnabled) {
        scheduleCheckId = setInterval(checkSchedule, 30000);
        checkSchedule();
    } else {
        clearInterval(scheduleCheckId);
    }
}

function checkSchedule() {
    const now = new Date();
    const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const onTime = $('scheduleOn').value;
    const offTime = $('scheduleOff').value;
    if (hm === onTime && !isPoweredOn) { setPower(true); isPoweredOn = true; powerBtn.classList.add('on'); }
    if (hm === offTime && isPoweredOn) { setPower(false); isPoweredOn = false; powerBtn.classList.remove('on'); }
}

// --- HELPERS ---
function hsl(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const h2 = (p2, q2, t) => {
            if (t < 0) t++; if (t > 1) t--;
            if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
            if (t < 1 / 2) return q2;
            if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
            return p2;
        };
        r = h2(p, q, h + 1 / 3); g = h2(p, q, h); b = h2(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// --- START ---
init();
