import { useEffect, useRef, useState } from 'react';
import StarfallInterface from './components/StarfallInterface';
import type {
  GameScreen,
  GameSettings as InterfaceSettings,
} from './components/StarfallInterface';
import { StarfallEngine } from './game/StarfallEngine';
import { loadSettings, markTutorialCompleted, saveSettings, tutorialWasCompleted } from './game/storage';
import { INITIAL_SNAPSHOT, type GameSnapshot } from './game/types';

function App() {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StarfallEngine | null>(null);
  const previousScreen = useRef<GameScreen>('title');
  const [screen, setScreen] = useState<GameScreen>('title');
  const [snapshot, setSnapshot] = useState<GameSnapshot>({
    ...INITIAL_SNAPSHOT,
    bestScore: 0,
  });
  const [settings, setSettings] = useState<InterfaceSettings>(() => loadSettings());
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    const engine = new StarfallEngine(
      settings,
      (next) => {
        setSnapshot(next);
        if (next.status === 'won' || next.status === 'lost') setScreen('results');
      },
      () => setScreen((current) => (current === 'playing' ? 'paused' : current)),
    );
    engineRef.current = engine;
    if (canvasRef.current) engine.attach(canvasRef.current);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setActive(screen === 'playing');
  }, [screen]);

  useEffect(() => {
    engineRef.current?.setSettings(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const syncFullscreen = () => {
      const fullscreen = Boolean(document.fullscreenElement);
      setSettings((current) =>
        current.fullscreen === fullscreen ? current : { ...current, fullscreen },
      );
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (screen !== 'intro') return;
    const timer = window.setTimeout(() => {
      engineRef.current?.beginRun();
      setScreen('playing');
    }, 7200);
    return () => window.clearTimeout(timer);
  }, [screen]);

  const updateSettings = (next: InterfaceSettings) => {
    setSettings(next);
    saveSettings(next);
    engineRef.current?.setSettings(next);
  };

  const startFromTitle = () => {
    engineRef.current?.activateAudio();
    setTutorialStep(0);
    setScreen(tutorialWasCompleted() ? 'intro' : 'tutorial');
  };

  const startFlight = () => {
    engineRef.current?.beginRun();
    setScreen('playing');
  };

  const returnToTitle = () => {
    engineRef.current?.returnToTitle();
    setScreen('title');
  };

  const showPanel = (next: GameScreen) => {
    previousScreen.current = screen;
    setScreen(next);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await shellRef.current?.requestFullscreen();
      }
    } catch {
      // Fullscreen is optional; continue normally when the browser declines it.
    }
    updateSettings({
      ...settings,
      fullscreen: Boolean(document.fullscreenElement),
    });
  };

  const nextTutorial = () => {
    if (tutorialStep < 5) {
      setTutorialStep((step) => Math.min(5, step + 1));
      return;
    }
    markTutorialCompleted();
    setScreen('intro');
  };

  const skipTutorial = () => {
    markTutorialCompleted();
    setScreen('intro');
  };

  const canContinue = snapshot.canContinue && snapshot.status !== 'won' && snapshot.status !== 'lost';

  return (
    <div className={`starfall-shell ${screen === 'playing' || screen === 'paused' ? 'is-in-run' : ''}`} ref={shellRef}>
      <div className="sf-playfield" aria-hidden="true">
        <canvas ref={canvasRef} className="sf-game-canvas" aria-label="Starfall Protocol game field" />
      </div>
      <StarfallInterface
        screen={screen}
        score={snapshot.score}
        bestScore={snapshot.bestScore}
        lives={snapshot.lives}
        energy={snapshot.energy}
        combo={snapshot.combo}
        wave={snapshot.wave}
        waveName={snapshot.waveName}
        bossPhase={snapshot.bossPhase}
        bossHealth={snapshot.bossHealth}
        bossMaxHealth={snapshot.bossMaxHealth}
        inputMode={snapshot.inputMode}
        tutorialStep={tutorialStep}
        result={snapshot.result}
        settings={settings}
        canContinue={canContinue}
        onStart={startFromTitle}
        onContinue={() => {
          if (engineRef.current?.continueRun()) setScreen('playing');
        }}
        onResume={() => setScreen('playing')}
        onRestart={startFlight}
        onReturnTitle={returnToTitle}
        onUpdateSettings={updateSettings}
        onSkipTutorial={skipTutorial}
        onNextTutorial={nextTutorial}
        onPause={() => setScreen('paused')}
        onBomb={() => engineRef.current?.activateBomb()}
        onPlayAgain={startFlight}
        onShowControls={() => showPanel('controls')}
        onShowSettings={() => showPanel('settings')}
        onShowCredits={() => showPanel('credits')}
        onBack={() => setScreen(previousScreen.current)}
        onSkipIntro={startFlight}
        onToggleFullscreen={() => void toggleFullscreen()}
        onTouchMove={(dx, dy) => engineRef.current?.updateTouchMove(dx, dy)}
        onTouchShoot={(down) => engineRef.current?.updateTouchShoot(down)}
        onTouchFocus={(down) => engineRef.current?.updateTouchFocus(down)}
        onTouchBomb={() => engineRef.current?.activateBomb()}
      />
    </div>
  );
}

export default App;
