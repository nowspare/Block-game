// Procedural sound effects via Web Audio API.
// No external audio files — every sound is synthesised.

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.6;
    this.enabled = true;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this._initialized = true;
    } catch (e) {
      this.enabled = false;
    }
  }

  set_volume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  _play_tones(freqs, durations, type = 'sine', gain = 0.3) {
    if (!this.enabled) return;
    if (!this._initialized) this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    let t = now;
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freqs[i];
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(gain, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + durations[i]);
      osc.connect(env);
      env.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + durations[i] + 0.02);
      t += durations[i] * 0.6;
    }
  }

  _play_noise(duration = 0.1, gain = 0.15, lowpass = 800) {
    if (!this.enabled) return;
    if (!this._initialized) this.init();
    if (!this.ctx) return;

    const buffer_size = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, buffer_size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer_size; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / buffer_size);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, this.ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);
    src.start();
  }

  break_block() {
    this._play_noise(0.12, 0.18, 900);
    this._play_tones([220, 160], [0.04, 0.06], 'square', 0.1);
  }

  place_block() {
    this._play_tones([180, 240], [0.05, 0.08], 'square', 0.15);
    this._play_noise(0.06, 0.08, 1200);
  }

  jump() {
    this._play_tones([320], [0.09], 'sine', 0.12);
  }

  land() {
    this._play_noise(0.1, 0.12, 500);
  }

  click() {
    this._play_tones([880], [0.03], 'square', 0.08);
  }

  place_error() {
    this._play_tones([160, 120], [0.06, 0.08], 'sawtooth', 0.1);
  }
}
