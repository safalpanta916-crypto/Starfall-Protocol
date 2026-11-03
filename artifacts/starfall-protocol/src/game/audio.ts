import type { GameSettings } from './types';

type SoundName =
  | 'shoot'
  | 'enemy'
  | 'damage'
  | 'graze'
  | 'collect'
  | 'bomb'
  | 'phase'
  | 'boss'
  | 'menu'
  | 'victory'
  | 'defeat';

const NOTES = [110, 130.81, 164.81, 196, 220, 261.63, 329.63, 392];

export class StarfallAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private bossMusic = false;
  private settings: GameSettings;
  private enabled = false;

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  updateSettings(settings: GameSettings): void {
    this.settings = settings;
    this.applyLevels();
  }

  unlock(): void {
    if (this.enabled || typeof window === 'undefined') return;
    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.context.destination);
      this.enabled = true;
      this.applyLevels();
      void this.context.resume();
      this.startMusic();
    } catch {
      this.enabled = false;
    }
  }

  play(name: SoundName, intensity = 1): void {
    this.unlock();
    const context = this.context;
    const output = this.sfxGain;
    if (!context || !output || this.settings.sfxVolume === 0) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const base = this.soundFrequency(name);
    oscillator.type = name === 'bomb' || name === 'phase' ? 'sawtooth' : 'square';
    oscillator.frequency.setValueAtTime(base, now);
    if (name === 'damage' || name === 'bomb' || name === 'boss') {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(35, base * 0.36),
        now + (name === 'bomb' ? 0.5 : 0.22),
      );
    } else if (name === 'collect' || name === 'graze' || name === 'victory') {
      oscillator.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.13);
    }

    const duration = name === 'bomb' ? 0.5 : name === 'victory' ? 0.7 : 0.16;
    const volume = Math.min(0.15, this.settings.sfxVolume * this.settings.masterVolume * 0.12 * intensity);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  setBossMusic(active: boolean): void {
    if (!this.context || !this.musicGain) return;
    this.bossMusic = active;
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.startMusic();
    const value = active ? 0.62 : 0.38;
    this.musicGain.gain.setTargetAtTime(
      value * this.settings.musicVolume * this.settings.masterVolume,
      this.context.currentTime,
      0.45,
    );
  }

  destroy(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.enabled = false;
    void this.context?.close();
    this.context = null;
  }

  private startMusic(): void {
    if (this.musicTimer !== null || !this.context || !this.musicGain) return;
    this.musicTimer = window.setInterval(
      () => this.playMusicNote(),
      this.bossMusic ? 290 : 460,
    );
  }

  private playMusicNote(): void {
    const context = this.context;
    const output = this.musicGain;
    if (!context || !output || context.state !== 'running') return;
    const now = context.currentTime;
    const sequence = [0, 3, 5, 2, 0, 6, 4, 2, 1, 4, 6, 3, 0, 5, 2, 4];
    const index = sequence[this.musicStep % sequence.length] ?? 0;
    this.musicStep += 1;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'triangle';
    const frequency = NOTES[index] ?? 110;
    oscillator.frequency.setValueAtTime(frequency * (this.bossMusic ? 1.5 : 1), now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(
        0.0002,
        this.settings.musicVolume * this.settings.masterVolume * (this.bossMusic ? 0.045 : 0.028),
      ),
      now + 0.07,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(now);
    oscillator.stop(now + 0.4);
  }

  private applyLevels(): void {
    if (!this.context || !this.master || !this.musicGain || !this.sfxGain) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.settings.masterVolume, now, 0.08);
    this.musicGain.gain.setTargetAtTime(
      this.settings.musicVolume * this.settings.masterVolume * 0.38,
      now,
      0.08,
    );
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.08);
  }

  private soundFrequency(name: SoundName): number {
    switch (name) {
      case 'shoot':
        return 680;
      case 'enemy':
        return 220;
      case 'damage':
        return 120;
      case 'graze':
        return 920;
      case 'collect':
        return 520;
      case 'bomb':
        return 85;
      case 'phase':
        return 270;
      case 'boss':
        return 95;
      case 'menu':
        return 440;
      case 'victory':
        return 660;
      case 'defeat':
        return 170;
    }
  }
}
