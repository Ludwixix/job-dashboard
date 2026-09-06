/**
 * Cyberpunk Dystopian Ambient Web Audio Engine
 * Procedural synthesis of:
 * 1. Dystopian Ambient Pads (Lush, floating synth chords, detuned saw/tri, resonant low-pass with LFO)
 * 2. Sub-Bass & Pulses (Deep 50-60Hz sub-oscillator with slow analog heartbeat pulse)
 * 3. Organic Rain Soundscapes (Procedural pink noise with dual resonant band-pass filtering)
 * 
 * 100% native Web Audio API — zero external audio files, zero network latency.
 */

class AmbientAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.padsGain = null;
    this.subBassGain = null;
    this.rainGain = null;

    this.isPlaying = false;
    this.isMuted = false;
    this.masterVolume = 0.65;
    this.padsVolume = 0.7;
    this.subBassVolume = 0.6;
    this.rainVolume = 0.45;

    // Chord scheduling timers & state
    this.chordInterval = null;
    this.pulseInterval = null;
    this.activePadNodes = [];
    this.currentChordIndex = 0;

    // Cyberpunk Minor/Suspended Chord Palette: Dm9, Bbmaj7#11, Fmaj9, Am9
    this.chords = [
      [146.83, 174.61, 220.00, 261.63, 329.63], // D3, F3, A3, C4, E4 (Dm9)
      [116.54, 146.83, 174.61, 220.00, 329.63], // Bb2, D3, F3, A3, E4 (Bbmaj7#11)
      [87.31, 130.81, 164.81, 220.00, 392.00],  // F2, C3, E3, A3, G4 (Fmaj9)
      [110.00, 164.81, 196.00, 261.63, 246.94]  // A2, E3, G3, C4, B3 (Am9)
    ];

    this.listeners = new Set();
  }

  init() {
    if (this.ctx) return;
    if (typeof window === 'undefined') return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    // Master Gain & Analyser
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.85;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Layer sub-gains
    this.padsGain = this.ctx.createGain();
    this.padsGain.gain.setValueAtTime(this.padsVolume, this.ctx.currentTime);
    this.padsGain.connect(this.masterGain);

    this.subBassGain = this.ctx.createGain();
    this.subBassGain.gain.setValueAtTime(this.subBassVolume, this.ctx.currentTime);
    this.subBassGain.connect(this.masterGain);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(this.rainVolume, this.ctx.currentTime);
    this.rainGain.connect(this.masterGain);
  }

  async start() {
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (this.isPlaying) return;
    this.isPlaying = true;

    // Start Layers
    this._startAmbientPads();
    this._startSubBassPulses();
    this._startRainSoundscape();

    this._notifyListeners();
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.chordInterval) {
      clearInterval(this.chordInterval);
      this.chordInterval = null;
    }
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }

    // Fade out active pads
    this.activePadNodes.forEach(({ gain, oscs }) => {
      try {
        if (this.ctx) {
          gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
          setTimeout(() => {
            oscs.forEach(o => {
              try { o.stop(); o.disconnect(); } catch (_) {}
            });
          }, 1600);
        }
      } catch (_) {}
    });
    this.activePadNodes = [];

    // Stop rain
    if (this.rainSource) {
      try {
        this.rainSource.stop();
        this.rainSource.disconnect();
      } catch (_) {}
      this.rainSource = null;
    }

    this._notifyListeners();
  }

  _startAmbientPads() {
    this._playNextChord();
    // Transition chords every 10 seconds with smooth cross-fade
    this.chordInterval = setInterval(() => {
      if (!this.isPlaying) return;
      this._playNextChord();
    }, 10000);
  }

  _playNextChord() {
    if (!this.ctx || !this.padsGain) return;
    const frequencies = this.chords[this.currentChordIndex];
    this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;

    const now = this.ctx.currentTime;
    const chordGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Resonant Low-Pass Filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, now);
    filter.Q.setValueAtTime(2.8, now);

    // Subtle LFO modulation on pad filter cutoff (0.08Hz gentle wave)
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.08, now);
    lfoGain.gain.setValueAtTime(180, now);
    lfo.connect(filter.frequency);
    lfo.start(now);

    filter.connect(chordGain);
    chordGain.connect(this.padsGain);

    // Fade In Attack (4 seconds)
    chordGain.gain.setValueAtTime(0.0001, now);
    chordGain.gain.exponentialRampToValueAtTime(0.18, now + 4.0);

    const oscs = [lfo];

    // Build lush detuned voice pairs for each note in chord
    frequencies.forEach((freq) => {
      // Voice 1: Sawtooth (warm, dark harmonics)
      const oscSaw = this.ctx.createOscillator();
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.setValueAtTime(freq, now);
      oscSaw.detune.setValueAtTime(-6, now); // Detune -6 cents
      oscSaw.connect(filter);
      oscSaw.start(now);
      oscs.push(oscSaw);

      // Voice 2: Triangle (body and smooth sub-harmonics)
      const oscTri = this.ctx.createOscillator();
      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(freq, now);
      oscTri.detune.setValueAtTime(+6, now); // Detune +6 cents
      oscTri.connect(filter);
      oscTri.start(now);
      oscs.push(oscTri);
    });

    const nodeEntry = { gain: chordGain, oscs };
    this.activePadNodes.push(nodeEntry);

    // Schedule fade out and cleanup after 14 seconds (overlaps with next chord for 4 seconds)
    setTimeout(() => {
      if (!this.ctx) return;
      const fadeTime = this.ctx.currentTime;
      try {
        chordGain.gain.setValueAtTime(chordGain.gain.value, fadeTime);
        chordGain.gain.linearRampToValueAtTime(0.0001, fadeTime + 4.0);
        setTimeout(() => {
          oscs.forEach(o => {
            try { o.stop(); o.disconnect(); } catch (_) {}
          });
          this.activePadNodes = this.activePadNodes.filter(n => n !== nodeEntry);
        }, 4200);
      } catch (_) {}
    }, 10000);
  }

  _startSubBassPulses() {
    const triggerPulse = () => {
      if (!this.ctx || !this.subBassGain || !this.isPlaying) return;
      const now = this.ctx.currentTime;

      // 55Hz (A1) or 48.99Hz (G1) Sub-Bass Sine Wave
      const subOsc = this.ctx.createOscillator();
      const pulseGain = this.ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now);
      // Subtle pitch envelope drop (kick/sub feel: 62Hz down to 52Hz)
      subOsc.frequency.exponentialRampToValueAtTime(52, now + 0.35);

      subOsc.connect(pulseGain);
      pulseGain.connect(this.subBassGain);

      // Dark driving heartbeat envelope: quick attack (60ms), warm sustain, smooth decay (800ms)
      pulseGain.gain.setValueAtTime(0.0001, now);
      pulseGain.gain.exponentialRampToValueAtTime(0.45, now + 0.08);
      pulseGain.gain.exponentialRampToValueAtTime(0.12, now + 0.45);
      pulseGain.gain.linearRampToValueAtTime(0.0001, now + 1.1);

      subOsc.start(now);
      subOsc.stop(now + 1.15);
      setTimeout(() => {
        try { subOsc.disconnect(); pulseGain.disconnect(); } catch (_) {}
      }, 1200);
    };

    // Initial pulse
    triggerPulse();
    // 50 BPM heartbeat pulse (every 1.2 seconds)
    this.pulseInterval = setInterval(triggerPulse, 1200);
  }

  _startRainSoundscape() {
    if (!this.ctx || !this.rainGain) return;

    // Procedural pink-noise buffer (3 seconds looped)
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    // Dynamic bandpass filtering for gentle rain on pavement
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1400, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(0.8, this.ctx.currentTime);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(450, this.ctx.currentTime);

    rainSource.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(this.rainGain);

    rainSource.start(0);
    this.rainSource = rainSource;
  }

  // Trigger high-frequency holographic chime ping when telemetry event occurs
  triggerEventPing(frequency = 880) {
    if (!this.ctx || !this.isPlaying || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const pingOsc = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();

      pingOsc.type = 'sine';
      pingOsc.frequency.setValueAtTime(frequency, now);

      pingGain.gain.setValueAtTime(0.0001, now);
      pingGain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

      pingOsc.connect(pingGain);
      pingGain.connect(this.masterGain);

      pingOsc.start(now);
      pingOsc.stop(now + 0.85);
      setTimeout(() => {
        try { pingOsc.disconnect(); pingGain.disconnect(); } catch (_) {}
      }, 900);
    } catch (_) {}
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
    this._notifyListeners();
  }

  setLayerVolume(layer, val) {
    const clamped = Math.max(0, Math.min(1, val));
    if (!this.ctx) return;
    if (layer === 'pads' && this.padsGain) {
      this.padsVolume = clamped;
      this.padsGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    } else if (layer === 'subBass' && this.subBassGain) {
      this.subBassVolume = clamped;
      this.subBassGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    } else if (layer === 'rain' && this.rainGain) {
      this.rainVolume = clamped;
      this.rainGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
    this._notifyListeners();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    this._notifyListeners();
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(64);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getWaveformData() {
    if (!this.analyser) return new Uint8Array(64);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notifyListeners() {
    const state = {
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      masterVolume: this.masterVolume,
      padsVolume: this.padsVolume,
      subBassVolume: this.subBassVolume,
      rainVolume: this.rainVolume
    };
    this.listeners.forEach(fn => fn(state));
  }
}

export const ambientEngine = new AmbientAudioEngine();
