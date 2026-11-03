import {
  DEFAULT_SETTINGS,
  type GameSettings,
  type SavedRun,
} from './types';

const SETTINGS_KEY = 'sppyntex.starfall.settings.v1';
const BEST_KEY = 'sppyntex.starfall.best.v1';
const TUTORIAL_KEY = 'sppyntex.starfall.tutorial.v1';
const RUN_KEY = 'sppyntex.starfall.run.v1';

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(): GameSettings {
  const storage = getStorage();
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      masterVolume: clamp(parsed.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
      musicVolume: clamp(parsed.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clamp(parsed.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume),
      screenShake: clamp(parsed.screenShake, 0, 1, DEFAULT_SETTINGS.screenShake),
      sensitivity: clamp(parsed.sensitivity, 0.5, 2, DEFAULT_SETTINGS.sensitivity),
      particles: parsed.particles !== false,
      reducedFlashing: parsed.reducedFlashing === true,
      mouseControl: parsed.mouseControl !== false,
      touchControl: parsed.touchControl !== false,
      fullscreen: parsed.fullscreen === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    getStorage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be disabled or full; the current session still works.
  }
}

export function loadBestScore(): number {
  try {
    const value = Number(getStorage()?.getItem(BEST_KEY) ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number): number {
  const best = Math.max(loadBestScore(), Math.floor(score));
  try {
    getStorage()?.setItem(BEST_KEY, String(best));
  } catch {
    // Keep the updated record in memory if browser storage is unavailable.
  }
  return best;
}

export function tutorialWasCompleted(): boolean {
  try {
    return getStorage()?.getItem(TUTORIAL_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markTutorialCompleted(): void {
  try {
    getStorage()?.setItem(TUTORIAL_KEY, 'true');
  } catch {
    // Tutorial state is optional if storage is unavailable.
  }
}

export function loadSavedRun(): SavedRun | null {
  try {
    const parsed = JSON.parse(getStorage()?.getItem(RUN_KEY) ?? 'null');
    if (!parsed || parsed.version !== 1 || parsed.lives <= 0) return null;
    return parsed as SavedRun;
  } catch {
    return null;
  }
}

export function saveRun(run: SavedRun): void {
  try {
    getStorage()?.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // The run remains playable; only resume-after-refresh is unavailable.
  }
}

export function clearSavedRun(): void {
  try {
    getStorage()?.removeItem(RUN_KEY);
  } catch {
    // Nothing to do.
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
}
