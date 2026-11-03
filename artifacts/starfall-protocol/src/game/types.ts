export type InputMode = 'keyboard' | 'mouse' | 'gamepad' | 'touch';
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export type GameSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: number;
  particles: boolean;
  reducedFlashing: boolean;
  mouseControl: boolean;
  touchControl: boolean;
  fullscreen: boolean;
  sensitivity: number;
};

export type RunSummary = {
  score: number;
  bestScore: number;
  enemiesDestroyed: number;
  grazes: number;
  highestCombo: number;
  bombsUsed: number;
  livesLost: number;
  cleared: boolean;
};

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  bestScore: number;
  lives: number;
  energy: number;
  combo: number;
  wave: number;
  waveName: string;
  bossPhase: number;
  bossHealth: number;
  bossMaxHealth: number;
  result: RunSummary | null;
  enemiesDestroyed: number;
  grazes: number;
  highestCombo: number;
  bombsUsed: number;
  livesLost: number;
  canContinue: boolean;
  inputMode: InputMode;
};

export type SavedRun = {
  version: 1;
  score: number;
  lives: number;
  energy: number;
  combo: number;
  highestCombo: number;
  enemiesDestroyed: number;
  grazes: number;
  bombsUsed: number;
  livesLost: number;
  wave: number;
  waveTime: number;
  bossHealth: number;
  bossPhase: number;
  playerX: number;
  playerY: number;
  elapsed: number;
};

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.65,
  musicVolume: 0.42,
  sfxVolume: 0.7,
  screenShake: 0.5,
  particles: true,
  reducedFlashing: false,
  mouseControl: true,
  touchControl: true,
  fullscreen: false,
  sensitivity: 1,
};

export const INITIAL_SNAPSHOT: GameSnapshot = {
  status: 'idle',
  score: 0,
  bestScore: 0,
  lives: 3,
  energy: 0,
  combo: 0,
  wave: 1,
  waveName: 'Nebula Patrol',
  bossPhase: 0,
  bossHealth: 0,
  bossMaxHealth: 0,
  result: null,
  enemiesDestroyed: 0,
  grazes: 0,
  highestCombo: 0,
  bombsUsed: 0,
  livesLost: 0,
  canContinue: false,
  inputMode: 'keyboard',
};
