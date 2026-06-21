import { TtsEngine } from './tts.js';
import { encodeMp3 } from './mp3-encoder.js';

const SETTINGS_KEY = 'tts-settings';
const HANDOFF_KEY = 'tts-input-text';

class TtsApp {
    constructor() {
        this.elements = {
            input: document.getElementById('ttsInput'),
            charCount: document.getElementById('ttsCharCount'),
            language: document.getElementById('ttsLanguage'),
            model: document.getElementById('ttsModel'),
            voice: document.getElementById('ttsVoice'),
            stepsSetting: document.getElementById('ttsStepsSetting'),
            steps: document.getElementById('ttsSteps'),
            stepsValue: document.getElementById('ttsStepsValue'),
            speed: document.getElementById('ttsSpeed'),
            speedValue: document.getElementById('ttsSpeedValue'),
            generateBtn: document.getElementById('ttsGenerateBtn'),
            modelHint: document.getElementById('ttsModelHint'),
            status: document.getElementById('ttsStatus'),
            audioStage: document.getElementById('ttsAudioStage'),
            audioEmpty: document.getElementById('ttsAudioEmpty'),
            audio: document.getElementById('ttsAudio'),
            player: document.getElementById('ttsPlayer'),
            playToggle: document.getElementById('ttsPlayToggle'),
            playIcon: document.querySelector('.tts-player-icon--play'),
            pauseIcon: document.querySelector('.tts-player-icon--pause'),
            waveform: document.getElementById('ttsWaveform'),
            currentTime: document.getElementById('ttsCurrentTime'),
            duration: document.getElementById('ttsDuration'),
            volume: document.getElementById('ttsVolume'),
            volumeToggle: document.getElementById('ttsVolumeToggle'),
            volumeWrap: document.querySelector('.tts-volume'),
            controls: document.getElementById('ttsControls'),
            downloadWavBtn: document.getElementById('ttsDownloadWavBtn'),
            downloadMp3Btn: document.getElementById('ttsDownloadMp3Btn'),
            outputMeta: document.getElementById('ttsOutputMeta')
        };

        this.engine = new TtsEngine();
        this.currentUrl = null;
        this.currentBlob = null;
        this.currentAudio = null;
        this.currentSampleRate = 0;
        this.currentDuration = 0;
        this.currentLabel = 'speech';
        this.mp3Cache = null;
        this.playbackRate = 1;
        this.busy = false;
        this.waveformPeaks = null;
        this.waveformColors = null;
        this.rafId = 0;
        this.lastVolume = 1;
        this.loaded = new Set();
        this.phonemizerLoaded = false;
        this.pending = new Map();
        this.msgId = 0;

        this.setupWorker();
        this.saved = this.loadSettings();

        this.populateLanguages();
        this.applyHandoffText();
        this.bindEvents();
        this.updateCharCount();
        this.updateSpeedLabel();
        this.updateStepsLabel();
    }

    // -- Persistence --------------------------------------------------------

    loadSettings() {
        try {
            return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
        } catch (_) {
            return {};
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                lang: this.elements.language.value,
                model: this.elements.model.value,
                voice: this.elements.voice.value,
                speed: this.elements.speed.value,
                steps: this.elements.steps.value
            }));
        } catch (_) {
            /* storage unavailable; ignore */
        }
    }

    applyHandoffText() {
        let text = null;
        try {
            text = sessionStorage.getItem(HANDOFF_KEY);
            if (text !== null) sessionStorage.removeItem(HANDOFF_KEY);
        } catch (_) {
            text = null;
        }
        if (text) {
            this.elements.input.value = text;
            this.setStatus('Text received from the Markdown Converter. Ready to generate.', 'good');
        }
    }

    bindEvents() {
        this.elements.input.addEventListener('input', () => this.updateCharCount());
        this.elements.language.addEventListener('change', () => { this.onLanguageChange(); this.saveSettings(); });
        this.elements.model.addEventListener('change', () => { this.onModelChange(); this.saveSettings(); });
        this.elements.voice.addEventListener('change', () => this.saveSettings());
        this.elements.speed.addEventListener('input', () => this.updateSpeedLabel());
        this.elements.speed.addEventListener('change', () => this.saveSettings());
        this.elements.steps.addEventListener('input', () => this.updateStepsLabel());
        this.elements.steps.addEventListener('change', () => this.saveSettings());
        this.elements.generateBtn.addEventListener('click', () => this.generate());
        this.elements.downloadWavBtn.addEventListener('click', () => this.downloadWav());
        this.elements.downloadMp3Btn.addEventListener('click', () => this.downloadMp3());

        this.elements.controls.querySelectorAll('button[data-rate]').forEach(btn => {
            btn.addEventListener('click', () => this.setPlaybackRate(Number(btn.dataset.rate)));
        });

        this.bindPlayer();

        if (this.saved.speed) { this.elements.speed.value = this.saved.speed; this.updateSpeedLabel(); }
        if (this.saved.steps) { this.elements.steps.value = this.saved.steps; this.updateStepsLabel(); }
    }

    // -- Selector population ------------------------------------------------

    populateLanguages() {
        const langs = this.engine.getLanguages();
        this.elements.language.innerHTML = langs
            .map(l => `<option value="${l.code}">${l.label}</option>`)
            .join('');
        const lang = langs.some(l => l.code === this.saved.lang) ? this.saved.lang : 'en';
        this.elements.language.value = lang;
        this.onLanguageChange();
    }

    onLanguageChange() {
        const lang = this.elements.language.value;
        const options = this.engine.getModelOptions(lang);
        this.elements.model.innerHTML = options
            .map(o => `<option value="${o.key}">${o.label}</option>`)
            .join('');
        if (options.some(o => o.key === this.saved.model)) {
            this.elements.model.value = this.saved.model;
        } else if (options.length) {
            this.elements.model.value = options[0].key;
        }
        this.onModelChange();
    }

    parseModel() {
        const [engine, dtype] = String(this.elements.model.value).split(':');
        return { engine, dtype };
    }

    selectedModelOption() {
        const lang = this.elements.language.value;
        const key = this.elements.model.value;
        return this.engine.getModelOptions(lang).find(o => o.key === key) || null;
    }

    onModelChange() {
        const { engine } = this.parseModel();
        const lang = this.elements.language.value;

        // Voices: group Kokoro English by accent, list everything else flat.
        const voices = this.engine.getVoices(engine, lang);
        const label = v => {
            const parts = [v.name];
            if (v.gender) parts.push(v.gender);
            if (v.grade) parts.push(`Grade ${v.grade}`);
            return parts.join(' · ');
        };
        const accents = [...new Set(voices.map(v => v.accent).filter(Boolean))];
        if (accents.length) {
            this.elements.voice.innerHTML = accents.map(accent => {
                const opts = voices
                    .filter(v => v.accent === accent)
                    .map(v => `<option value="${v.id}">${label(v)}</option>`)
                    .join('');
                return `<optgroup label="${accent} English">${opts}</optgroup>`;
            }).join('');
        } else {
            this.elements.voice.innerHTML = voices
                .map(v => `<option value="${v.id}">${label(v)}</option>`)
                .join('');
        }
        if (voices.some(v => v.id === this.saved.voice)) {
            this.elements.voice.value = this.saved.voice;
        } else if (voices.length) {
            this.elements.voice.value = voices[0].id;
        }

        // Quality steps slider is a Supertonic-only control.
        this.elements.stepsSetting.hidden = engine !== 'supertonic';

        this.updateModelHint();
    }

    updateModelHint() {
        const option = this.selectedModelOption();
        if (!option) { this.elements.modelHint.textContent = ''; return; }
        const lang = this.elements.language.value;
        const label = this.engine.modelLabel(option.engine);
        let hint = `${label} · ~${option.mb} MB downloaded from Hugging Face on first use, then cached.`;
        if (option.engine === 'kokoro' && lang !== 'en') {
            hint = `${label} · ~${option.mb} MB model plus a one-time pronunciation pack for this language, then cached.`;
        }
        this.elements.modelHint.textContent = hint;
    }

    // -- Labels -------------------------------------------------------------

    updateCharCount() {
        const n = this.elements.input.value.length;
        this.elements.charCount.textContent = `${n.toLocaleString('en-US')} character${n === 1 ? '' : 's'}`;
    }

    updateSpeedLabel() {
        this.elements.speedValue.innerHTML = `${Number(this.elements.speed.value).toFixed(2)}&times;`;
    }

    updateStepsLabel() {
        this.elements.stepsValue.textContent = `${this.elements.steps.value} steps`;
    }

    setStatus(message, tone = 'neutral') {
        this.elements.status.textContent = message;
        this.elements.status.dataset.tone = tone;
    }

    // -- Worker plumbing ----------------------------------------------------

    setupWorker() {
        try {
            this.worker = new Worker(new URL('./tts-worker.js', import.meta.url), { type: 'module' });
        } catch (_) {
            this.worker = null;
            return;
        }
        this.worker.addEventListener('message', event => {
            const m = event.data;
            if (!m) return;
            const p = this.pending.get(m.id);
            if (!p) return;
            if (m.type === 'progress') p.onProgress(m.file, m.progress);
            else if (m.type === 'chunk') p.onChunk(m.i, m.total);
            else if (m.type === 'done') { this.pending.delete(m.id); p.resolve(m.result); }
            else if (m.type === 'error') { this.pending.delete(m.id); p.reject(new Error(m.message)); }
        });
        this.worker.addEventListener('error', () => {
            // Worker could not start (e.g. module load failure). Fail any pending
            // request and disable the worker so later runs use the main thread.
            for (const p of this.pending.values()) p.reject(new Error('__worker_failed__'));
            this.pending.clear();
            this.worker = null;
        });
    }

    // Run synthesis in the worker if available, else on the main thread.
    synthesizeRequest(payload, { onProgress, onChunk }) {
        if (this.worker) {
            return new Promise((resolve, reject) => {
                const id = ++this.msgId;
                this.pending.set(id, { resolve, reject, onProgress, onChunk });
                this.worker.postMessage({ id, payload });
            });
        }
        return this.engine.synthesize(payload.text, {
            engine: payload.engine,
            dtype: payload.dtype,
            langCode: payload.langCode,
            voice: payload.voice,
            steps: payload.steps,
            speed: payload.speed,
            onProgress: p => { if (p && p.status === 'progress' && p.file) onProgress(String(p.file), typeof p.progress === 'number' ? p.progress : null); },
            onChunk
        });
    }

    // -- Generation ---------------------------------------------------------

    async generate() {
        if (this.busy) return;
        const text = this.elements.input.value.trim();
        if (!text) {
            this.setStatus('Enter some text to generate speech.', 'warning');
            return;
        }

        const { engine, dtype } = this.parseModel();
        const lang = this.elements.language.value;
        const voice = this.elements.voice.value;
        const option = this.selectedModelOption();
        const label = this.engine.modelLabel(engine);
        const key = `${engine}:${dtype}`;

        this.busy = true;
        this.elements.generateBtn.disabled = true;

        const needsPhon = this.engine.needsPhonemizer(engine, lang) && !this.phonemizerLoaded;
        if (!this.loaded.has(key)) {
            const extra = needsPhon ? ' plus a one-time ~19 MB pronunciation pack' : '';
            this.setStatus(`Loading ${label} (~${option ? option.mb : '?'} MB)${extra} for the first time. This downloads once and is cached afterwards...`, 'working');
        } else if (needsPhon) {
            this.setStatus('Loading the ~19 MB pronunciation pack for this language (one-time)...', 'working');
        } else {
            this.setStatus('Generating speech locally...', 'working');
        }

        const payload = {
            text,
            engine,
            dtype,
            langCode: lang,
            voice,
            speed: Number(this.elements.speed.value),
            steps: Number(this.elements.steps.value)
        };
        const callbacks = {
            onProgress: (file, pct) => this.reportProgress(file, pct),
            onChunk: (i, total) => {
                this.setStatus(total > 1
                    ? `Generating speech locally — part ${i + 1} of ${total}...`
                    : 'Generating speech locally...', 'working');
            }
        };

        try {
            let result;
            try {
                result = await this.synthesizeRequest(payload, callbacks);
            } catch (err) {
                // If the worker failed to start, retry once on the main thread.
                if (err && err.message === '__worker_failed__') {
                    this.worker = null;
                    result = await this.synthesizeRequest(payload, callbacks);
                } else {
                    throw err;
                }
            }

            this.loaded.add(key);
            if (engine === 'kokoro' && lang !== 'en') this.phonemizerLoaded = true;
            this.currentLabel = `${engine}-${voice}`;
            this.showAudio(result);
            this.setStatus('Speech generated locally. No text was uploaded.', 'good');
        } catch (error) {
            this.setStatus(error.message || 'Speech generation failed.', 'danger');
        } finally {
            this.busy = false;
            this.elements.generateBtn.disabled = false;
        }
    }

    reportProgress(file, pct) {
        if (!file) return;
        const name = String(file).split('/').pop();
        const p = typeof pct === 'number' ? ` ${Math.round(pct)}%` : '';
        this.setStatus(`Downloading model: ${name}${p}`, 'working');
    }

    showAudio({ blob, audio, sampleRate, durationSec }) {
        if (this.currentUrl) URL.revokeObjectURL(this.currentUrl);

        this.currentBlob = blob;
        this.currentAudio = audio;
        this.currentSampleRate = sampleRate;
        this.currentDuration = durationSec || 0;
        this.mp3Cache = null;
        this.currentUrl = URL.createObjectURL(blob);

        this.elements.audio.src = this.currentUrl;
        this.elements.audio.playbackRate = this.playbackRate;
        this.elements.audio.volume = Number(this.elements.volume.value);
        this.elements.audioEmpty.hidden = true;
        this.elements.player.hidden = false;
        this.elements.audioStage.dataset.state = 'ready';
        this.elements.controls.hidden = false;

        this.elements.duration.textContent = this.formatTime(this.currentDuration);
        this.elements.currentTime.textContent = '0:00';

        // Build and draw the waveform from the raw PCM.
        this.waveformPeaks = this.computeWaveformPeaks(audio, 160);
        this.updateWaveformColors();
        requestAnimationFrame(() => this.renderWaveform(0));

        this.elements.downloadWavBtn.disabled = false;
        this.elements.downloadMp3Btn.disabled = !audio;

        const seconds = durationSec ? `${durationSec.toFixed(1)} s` : 'unknown length';
        const sizeKb = Math.round(blob.size / 1024);
        this.elements.outputMeta.textContent =
            `${seconds} · ${sizeKb.toLocaleString('en-US')} KB · ${sampleRate.toLocaleString('en-US')} Hz WAV`;

        this.elements.audio.play().catch(() => {});
    }

    // -- Custom player ------------------------------------------------------

    bindPlayer() {
        const { audio, playToggle, waveform, volume, volumeToggle } = this.elements;

        playToggle.addEventListener('click', () => {
            if (audio.paused) audio.play().catch(() => {});
            else audio.pause();
        });

        audio.addEventListener('play', () => {
            playToggle.classList.add('is-playing');
            playToggle.setAttribute('aria-label', 'Pause');
            this.startWaveformLoop();
        });
        const showPlay = () => {
            playToggle.classList.remove('is-playing');
            playToggle.setAttribute('aria-label', 'Play');
            this.stopWaveformLoop();
        };
        audio.addEventListener('pause', () => { showPlay(); this.syncPlayhead(); });
        audio.addEventListener('ended', () => { showPlay(); currentTime.textContent = '0:00'; this.renderWaveform(0); });

        audio.addEventListener('loadedmetadata', () => {
            const d = isFinite(audio.duration) ? audio.duration : this.currentDuration;
            if (d) { this.currentDuration = d; this.elements.duration.textContent = this.formatTime(d); }
        });

        // Seek by clicking/dragging on the waveform.
        const seekToEvent = clientX => {
            if (!this.currentDuration) return;
            const rect = waveform.getBoundingClientRect();
            const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            audio.currentTime = frac * this.currentDuration;
            this.syncPlayhead();
        };
        let dragging = false;
        waveform.addEventListener('pointerdown', e => {
            dragging = true;
            seekToEvent(e.clientX); // seek first, so a failed capture never blocks it
            try { waveform.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
        });
        waveform.addEventListener('pointermove', e => { if (dragging) seekToEvent(e.clientX); });
        waveform.addEventListener('pointerup', e => { dragging = false; try { waveform.releasePointerCapture(e.pointerId); } catch (_) {} });
        // Fallback for environments where pointer capture interferes with the click.
        waveform.addEventListener('click', e => { if (!dragging) seekToEvent(e.clientX); });
        waveform.addEventListener('keydown', e => {
            if (!this.currentDuration) return;
            if (e.key === 'ArrowRight') { audio.currentTime = Math.min(this.currentDuration, audio.currentTime + 1); this.syncPlayhead(); e.preventDefault(); }
            else if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 1); this.syncPlayhead(); e.preventDefault(); }
            else if (e.key === ' ' || e.key === 'Enter') { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); e.preventDefault(); }
        });

        // Volume.
        volume.addEventListener('input', () => { audio.volume = Number(volume.value); audio.muted = false; this.updateVolumeIcon(); });
        volumeToggle.addEventListener('click', () => {
            if (audio.muted || audio.volume === 0) {
                audio.muted = false;
                audio.volume = this.lastVolume || 1;
                volume.value = audio.volume;
            } else {
                this.lastVolume = audio.volume;
                audio.muted = true;
            }
            this.updateVolumeIcon();
        });

        window.addEventListener('resize', () => this.syncPlayhead());
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.addEventListener('change', () => requestAnimationFrame(() => { this.updateWaveformColors(); this.syncPlayhead(); }));
    }

    updateVolumeIcon() {
        const muted = this.elements.audio.muted || this.elements.audio.volume === 0;
        this.elements.volumeWrap.classList.toggle('is-muted', muted);
        this.elements.volumeToggle.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    }

    startWaveformLoop() {
        this.stopWaveformLoop();
        const tick = () => {
            const audio = this.elements.audio;
            if (audio.paused) { this.rafId = 0; return; }
            this.syncPlayhead();
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    stopWaveformLoop() {
        if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
    }

    // Update the time label + waveform progress to the audio's current position.
    syncPlayhead() {
        if (this.elements.player.hidden || !this.currentDuration) return;
        const audio = this.elements.audio;
        this.elements.currentTime.textContent = this.formatTime(audio.currentTime);
        this.renderWaveform(audio.currentTime / this.currentDuration);
    }

    formatTime(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // -- Waveform ----------------------------------------------------------

    // Downsample Float32 PCM into per-bar peak amplitudes (0..1).
    computeWaveformPeaks(samples, bars) {
        const peaks = new Float32Array(bars);
        if (!samples || !samples.length) return peaks;
        const block = Math.floor(samples.length / bars) || 1;
        let max = 0;
        for (let i = 0; i < bars; i++) {
            let peak = 0;
            const start = i * block;
            const end = Math.min(start + block, samples.length);
            for (let j = start; j < end; j++) {
                const v = Math.abs(samples[j]);
                if (v > peak) peak = v;
            }
            peaks[i] = peak;
            if (peak > max) max = peak;
        }
        if (max > 0) for (let i = 0; i < bars; i++) peaks[i] /= max; // normalize
        return peaks;
    }

    // Cache theme colors so the render loop never triggers a style flush.
    updateWaveformColors() {
        const styles = getComputedStyle(document.documentElement);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        this.waveformColors = {
            played: (styles.getPropertyValue('--text-primary') || '#0a0a0a').trim(),
            unplayed: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(10,10,10,0.20)'
        };
    }

    renderWaveform(progress) {
        const canvas = this.elements.waveform;
        const peaks = this.waveformPeaks;
        if (!canvas || !peaks) return;
        if (!this.waveformColors) this.updateWaveformColors();
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 600;
        const cssH = canvas.clientHeight || 44;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssH * dpr);
        }
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const { played, unplayed } = this.waveformColors;
        const n = peaks.length;
        const gap = 2 * dpr;
        const barW = Math.max(1, (canvas.width - gap * (n - 1)) / n);
        const mid = canvas.height / 2;
        const progressX = progress * canvas.width;
        for (let i = 0; i < n; i++) {
            const x = i * (barW + gap);
            const h = Math.max(2 * dpr, peaks[i] * (canvas.height - 4 * dpr));
            ctx.fillStyle = (x + barW / 2) <= progressX ? played : unplayed;
            ctx.fillRect(x, mid - h / 2, barW, h);
        }
    }

    // -- Playback speed -----------------------------------------------------

    setPlaybackRate(rate) {
        this.playbackRate = rate;
        this.elements.audio.playbackRate = rate;
        this.elements.controls.querySelectorAll('button[data-rate]').forEach(b => {
            const active = Number(b.dataset.rate) === rate;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    // -- Downloads ----------------------------------------------------------

    saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    downloadWav() {
        if (!this.currentBlob) return;
        this.saveBlob(this.currentBlob, `speech-${this.currentLabel}.wav`);
        this.setStatus('WAV download started. The file stays on this device.', 'good');
    }

    async downloadMp3() {
        if (!this.currentAudio) return;
        if (this.mp3Cache) {
            this.saveBlob(this.mp3Cache, `speech-${this.currentLabel}.mp3`);
            return;
        }
        this.elements.downloadMp3Btn.disabled = true;
        this.setStatus('Encoding MP3 locally...', 'working');
        try {
            const blob = await encodeMp3(this.currentAudio, this.currentSampleRate);
            this.mp3Cache = blob;
            this.saveBlob(blob, `speech-${this.currentLabel}.mp3`);
            this.setStatus('MP3 download started. The file stays on this device.', 'good');
        } catch (error) {
            this.setStatus(error.message || 'MP3 encoding failed.', 'danger');
        } finally {
            this.elements.downloadMp3Btn.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.__ttsApp = new TtsApp();
});
