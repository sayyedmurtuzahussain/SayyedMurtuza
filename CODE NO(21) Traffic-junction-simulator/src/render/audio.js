// Web Audio API Synthesizer for Emergency Sirens and UI Audio
// Pure procedural synthesis (zero external audio files required)

class SoundFX {
  constructor() {
    this.ctx = null;
    this.isMuted = true; // Default polite mute
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenInterval = null;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  toggleMute() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSiren();
    }
    return this.isMuted;
  }

  playClick() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      // Audio error ignored
    }
  }

  startSiren() {
    if (this.isMuted || !this.ctx || this.sirenOsc) return;
    try {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'sawtooth';

      this.sirenGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();

      let toggle = false;
      this.sirenInterval = setInterval(() => {
        if (!this.sirenOsc || !this.ctx) return;
        const now = this.ctx.currentTime;
        const targetFreq = toggle ? 960 : 720;
        this.sirenOsc.frequency.cancelScheduledValues(now);
        this.sirenOsc.frequency.linearRampToValueAtTime(targetFreq, now + 0.3);
        toggle = !toggle;
      }, 350);
    } catch (e) {}
  }

  stopSiren() {
    if (this.sirenInterval) {
      clearInterval(this.sirenInterval);
      this.sirenInterval = null;
    }
    if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenOsc.disconnect();
      } catch (e) {}
      this.sirenOsc = null;
    }
  }
}

export const soundFX = new SoundFX();
