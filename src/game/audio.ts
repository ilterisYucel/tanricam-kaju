/**
 * Tiny WebAudio synthesiser. The game ships without sampled SFX; these are
 * generated on the fly so the project stays offline and asset-free.
 */
class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private musicTimer: number | null = null;
  private musicStep = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(enabled ? 0.22 : 0, this.ctx.currentTime, 0.02);
    }
    if (!enabled) this.stopMusic();
    else if (this.ctx) this.startMusic();
  }

  unlock(): void {
    if (!this.enabled) return;
    this.ensure();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    this.startMusic();
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.22 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'square',
    volume = 0.35,
    endFrequency?: number,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * A tiny generated adventure loop. It is deliberately soft and replaceable:
   * drop in a recorded track later without touching the game scenes.
   */
  startMusic(): void {
    if (!this.enabled || this.musicTimer !== null) return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.playMusicStep(), 250);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playMusicStep(): void {
    if (!this.enabled) return;
    const chords = [
      { bass: 110.0, notes: [220.0, 261.63, 329.63, 440.0] },
      { bass: 87.31, notes: [174.61, 220.0, 261.63, 349.23] },
      { bass: 130.81, notes: [196.0, 261.63, 329.63, 392.0] },
      { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0] },
    ];
    const step = this.musicStep;
    const chord = chords[Math.floor(step / 8) % 4];

    if (step % 8 === 0) this.tone(chord.bass, 0.7, 'sine', 0.09);
    const note = chord.notes[step % 4];
    this.tone(note, 0.22, 'triangle', 0.045);
    if (step % 8 === 6) this.tone(note * 2, 0.3, 'sine', 0.025);
    if (step === 0) this.softBark();

    this.musicStep = (step + 1) % 64;
  }

  private softBark(): void {
    this.tone(480, 0.07, 'square', 0.05, 250);
    window.setTimeout(() => this.tone(410, 0.07, 'square', 0.04, 210), 90);
  }

  private noise(duration: number, volume = 0.25, frequency = 900): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  click(): void {
    this.tone(520, 0.06, 'triangle', 0.22, 660);
  }

  jump(): void {
    this.tone(330, 0.12, 'square', 0.2, 620);
  }

  throw(): void {
    this.tone(700, 0.09, 'sawtooth', 0.16, 240);
    this.noise(0.06, 0.08, 1400);
  }

  hit(): void {
    this.noise(0.12, 0.3, 380);
    this.tone(120, 0.14, 'square', 0.22, 60);
  }

  immune(): void {
    this.tone(180, 0.08, 'triangle', 0.2, 150);
    this.tone(150, 0.08, 'triangle', 0.16, 120);
  }

  pickup(): void {
    this.tone(880, 0.06, 'sine', 0.22);
    window.setTimeout(() => this.tone(1180, 0.08, 'sine', 0.18), 55);
  }

  levelUp(): void {
    [523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.12, 'triangle', 0.22), i * 70);
    });
  }

  hurt(): void {
    this.noise(0.2, 0.22, 220);
    this.tone(110, 0.2, 'sawtooth', 0.2, 50);
  }

  rescue(): void {
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.22, 'sine', 0.22), i * 100);
    });
  }

  bark(): void {
    this.tone(520, 0.07, 'square', 0.16, 260);
    window.setTimeout(() => this.tone(460, 0.07, 'square', 0.12, 220), 90);
  }

  boss(): void {
    this.tone(70, 0.5, 'sawtooth', 0.2, 40);
  }
}

export const sfx = new GameAudio();
