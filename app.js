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
let rafId, hueShift = 0;

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

function tickMic() {
    if (!isMicActive) return;
    rafId = requestAnimationFrame(tickMic);
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    // Draw visualizer
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

    if (Date.now() - lastSentTime > 120 && writeChar) {
        const sens = micSensitivity / 5;
        const aB = Math.min(255, Math.floor(bass / 10 * 1.5 * sens));
        const aM = Math.min(255, Math.floor(mid / 40 * 1.5 * sens));
        const aT = Math.min(255, Math.floor(treble / 40 * 1.5 * sens));
        const aE = Math.min(255, Math.floor((total / data.length) * 1.5 * sens));
        let r = 0, g = 0, b = 0;

        switch (currentMusicModel) {
            case 1: // Classic Beat
                if (aB > 50) { r = aB; g = Math.max(0, aB - 100); b = 255 - aB; }
                break;
            case 2: // Dynamic RGB
                r = aB > 40 ? aB : 0; g = aM > 40 ? aM : 0; b = aT > 40 ? aT : 0;
                break;
            case 3: // Rainbow Flow
                hueShift = (hueShift + aB / 10) % 360;
                if (aB > 30) { const c = hsl(hueShift / 360, 1, Math.max(50, aB) / 255); r = c[0]; g = c[1]; b = c[2]; }
                break;
            case 4: // Strobe Beat
                if (aB > 180 || aT > 150) { r = g = b = 255; }
                break;
            case 5: // Energy Pulse
                hueShift = (hueShift + 2) % 360;
                if (aE > 20) { const c = hsl(hueShift / 360, 1, aE / 255); r = c[0]; g = c[1]; b = c[2]; }
                break;
            case 6: // Bass Drop
                if (aB > 170) { const c = hsl(Math.random(), 1, 0.5); r = c[0]; g = c[1]; b = c[2]; }
                else { b = 50; }
                break;
            case 7: // Vocal React
                if (aM > 60) { r = aM; g = 255 - aM; b = aT; }
                break;
            case 8: // Chill Wave
                hueShift = (hueShift + 0.5) % 360;
                const bright = aE > 10 ? Math.max(30, aE * 0.6) : 0;
                if (bright > 0) { const c = hsl(hueShift / 360, 0.6, bright / 255); r = c[0]; g = c[1]; b = c[2]; }
                break;
        }
        if (r > 0 || g > 0 || b > 0 || currentMusicModel === 4 || currentMusicModel === 6) {
            setColor(r, g, b);
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
