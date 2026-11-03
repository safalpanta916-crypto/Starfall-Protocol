import { useEffect, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import '../starfall-interface.css';

export type GameScreen =
  | 'title'
  | 'intro'
  | 'playing'
  | 'paused'
  | 'settings'
  | 'controls'
  | 'credits'
  | 'tutorial'
  | 'results';

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

export type StarfallInterfaceProps = {
  screen: GameScreen;
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
  inputMode: 'keyboard' | 'mouse' | 'gamepad' | 'touch';
  tutorialStep: number;
  result: RunSummary | null;
  settings: GameSettings;
  canContinue: boolean;
  onStart: () => void;
  onContinue: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onUpdateSettings: (settings: GameSettings) => void;
  onSkipTutorial: () => void;
  onNextTutorial: () => void;
  onPause: () => void;
  onBomb: () => void;
  onPlayAgain: () => void;
  onShowControls: () => void;
  onShowSettings: () => void;
  onShowCredits: () => void;
  onBack: () => void;
  onSkipIntro: () => void;
  onToggleFullscreen: () => void;
  onTouchMove: (dx: number, dy: number) => void;
  onTouchShoot: (down: boolean) => void;
  onTouchFocus: (down: boolean) => void;
  onTouchBomb: () => void;
};

const tutorialCopy = [
  ['FLIGHT DECK', 'Guide Vesper-01 through the field with WASD or the arrow keys.'],
  ['WEAPON SYSTEM', 'Hold Space or the primary action to fire a steady stream.'],
  ['FOCUS DRIVE', 'Hold Shift to slow down and thread through tight patterns.'],
  ['NEAR MISS', 'Graze hostile fire to build your combo and charge energy.'],
  ['STARBREAK', 'Detonate a bomb to clear danger. Save it for the breach.'],
  ['SCORE SHARDS', 'Move close to drifting score items to collect their bonus.'],
];

const formatScore = (value: number) => Math.max(0, Math.floor(value)).toLocaleString('en-US');
const inputHints = {
  keyboard: 'WASD MOVE / SPACE FIRE / SHIFT FOCUS',
  mouse: 'POINTER MOVE / HOLD CLICK TO FIRE',
  gamepad: 'LEFT STICK MOVE / A FIRE / B FOCUS',
  touch: 'TOUCH PAD MOVE / FIRE AND FOCUS',
};

function Starfield() {
  return (
    <div className="sf-sky" aria-hidden="true">
      <div className="sf-nebula sf-nebula-one" />
      <div className="sf-nebula sf-nebula-two" />
      <div className="sf-star-layer sf-stars-a" />
      <div className="sf-star-layer sf-stars-b" />
      <div className="sf-gate">
        <i className="sf-gate-ring sf-gate-ring-outer" />
        <i className="sf-gate-ring sf-gate-ring-inner" />
        <i className="sf-gate-core" />
        <i className="sf-gate-spoke sf-spoke-a" />
        <i className="sf-gate-spoke sf-spoke-b" />
        <i className="sf-gate-spoke sf-spoke-c" />
        <i className="sf-gate-spoke sf-spoke-d" />
      </div>
      <div className="sf-scanlines" />
    </div>
  );
}

function FrameCorners() {
  return <div className="sf-frame-corners" aria-hidden="true"><i /><i /><i /><i /></div>;
}

export default function StarfallInterface(props: StarfallInterfaceProps) {
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const step = Math.min(5, Math.max(0, props.tutorialStep || tutorialIndex));
  const update = (key: keyof GameSettings, value: number | boolean) => {
    props.onUpdateSettings({ ...props.settings, [key]: value });
  };

  useEffect(() => {
    if (props.screen === 'title') {
      const handleStart = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          props.onStart();
        }
      };
      window.addEventListener('keydown', handleStart);
      return () => window.removeEventListener('keydown', handleStart);
    }
    if (props.screen !== 'playing' && props.screen !== 'paused') return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && props.screen === 'playing') {
        event.preventDefault();
        props.onPause();
      } else if (event.key === 'Escape' && props.screen === 'paused') {
        event.preventDefault();
        props.onResume();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [props.screen, props.onPause, props.onResume]);

  const touchMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const dy = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    props.onTouchMove(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
  };

  return (
    <main className={`sf-interface sf-screen-${props.screen}`} aria-label="Starfall Protocol game interface">
      <Starfield />
      <FrameCorners />

      {(props.screen === 'title' || props.screen === 'results') && (
        <div className="sf-signature">SPPyntex <span>·</span> STARFALL PROTOCOL</div>
      )}

      {props.screen === 'title' && (
        <section className="sf-title-layout sf-panel-enter">
          <div className="sf-title-copy">
            <div className="sf-title-brandline">
              <img className="sf-title-logo" src={`${import.meta.env.BASE_URL}brand/sppyntex-logo.jpg`} alt="SPPyntex logo" />
              <div className="sf-title-wordmark">
                <p className="sf-eyebrow"><span className="sf-live-dot" /> SIGNAL DETECTED <span className="sf-eyebrow-line" /> SECTOR 09 / VEGA</p>
                <div className="sf-title-lockup">
                  <div className="sf-title-small">THE LAST LIGHT BEFORE THE VOID</div>
                  <h1>STARFALL<span>PROTOCOL</span></h1>
                  <div className="sf-title-rule"><i /><span>✦</span><i /></div>
                </div>
              </div>
            </div>
            <p className="sf-title-description">An ancient gate has awakened.<br />The Aetherion is already here.</p>
            <p className="sf-title-credit">Developed by Safal Panta</p>
            <div className="sf-title-actions">
              <button className="sf-button sf-button-primary" onClick={props.onStart}><span>▶</span> BEGIN FLIGHT <kbd>ENTER</kbd></button>
              {props.canContinue && <button className="sf-button sf-button-quiet" onClick={props.onContinue}>CONTINUE RUN <span>↗</span></button>}
            </div>
            <nav className="sf-title-nav" aria-label="Main menu">
              <button onClick={props.onShowControls}>CONTROLS</button><b>/</b>
              <button onClick={props.onShowSettings}>SYSTEM</button><b>/</b>
              <button onClick={props.onShowCredits}>CREDITS</button>
            </nav>
          </div>
          <div className="sf-title-aside">
            <div className="sf-signal-card">
              <div className="sf-card-label">PILOT RECORD <span>NO. 001</span></div>
              <div className="sf-pilot-silhouette" aria-hidden="true"><span className="sf-ship-wing left" /><span className="sf-ship-body" /><span className="sf-ship-wing right" /><span className="sf-ship-flare" /></div>
              <div className="sf-pilot-name">VESPER-01</div>
              <div className="sf-pilot-meta">SINGLE SEAT INTERCEPTOR <span>● READY</span></div>
              <div className="sf-card-divider" />
              <div className="sf-record-row"><span>PERSONAL BEST</span><strong>{formatScore(props.bestScore)}</strong></div>
              <div className="sf-card-foot"><span>NEBULA FRONTIER</span><span>v.01.09</span></div>
            </div>
            <p className="sf-aside-caption"><span>///</span> TRANSMISSION ORIGIN: UNKNOWN</p>
          </div>
          <div className="sf-title-footer"><span>© SPPYNTEX</span><span>NO SIGNAL IS THE SAME AS NO HOPE</span><span>PRESS ENTER TO DEPLOY</span></div>
        </section>
      )}

      {props.screen === 'intro' && (
        <section className="sf-intro sf-panel-enter" aria-label="Mission briefing">
          <div className="sf-intro-stamp">STARFALL PROTOCOL <span>FIELD TRANSMISSION / 09:17:44</span></div>
          <div className="sf-intro-content">
            <p className="sf-eyebrow">VEGA FRONTIER // EMERGENCY CHANNEL</p>
            <h2>THE GATE<br /><em>IS OPEN.</em></h2>
            <p className="sf-intro-body">“Vesper, the Aetherion Dreadnought has crossed the threshold. The gate is feeding it. You are the only craft close enough to reach the core.”</p>
            <div className="sf-intro-attribution">— COMMANDER ILYA / LAST TRANSMISSION</div>
            <button className="sf-button sf-button-primary" onClick={props.onSkipIntro}>SKIP TRANSMISSION <span>→</span></button>
          </div>
          <div className="sf-intro-bottom"><span>INCOMING SIGNAL LOST</span><span>•••</span><span>VESPER-01 // DEPLOYMENT IMMINENT</span></div>
        </section>
      )}

      {props.screen === 'playing' && (
        <section className="sf-hud" aria-label="Game HUD">
          <div className="sf-hud-top">
            <div className="sf-hud-score">
              <span className="sf-hud-label">SCORE</span><strong>{formatScore(props.score)}</strong>
              <span className="sf-hud-best">BEST <b>{formatScore(props.bestScore)}</b></span>
            </div>
            <div className="sf-hud-stage"><span>OPERATION / <b>STARFALL</b></span><strong>WAVE <i>{String(props.wave).padStart(2, '0')}</i></strong><small>{props.waveName.toUpperCase()}</small></div>
            <div className="sf-hud-actions"><button className="sf-hud-icon" onClick={props.onBomb} aria-label="Use bomb"><span>✳</span><small>BOMB</small><kbd>X</kbd></button><button className="sf-hud-icon" onClick={props.onPause} aria-label="Pause game"><span>Ⅱ</span><small>PAUSE</small><kbd>ESC</kbd></button></div>
          </div>
          <div className="sf-hud-bottom">
            <div className="sf-lives"><span className="sf-hud-label">VESPER-01</span><div aria-label={`${props.lives} lives remaining`}>{Array.from({ length: Math.max(0, Math.min(props.lives, 8)) }, (_, index) => <i key={index} />)}</div><small>HULL / {String(props.lives).padStart(2, '0')}</small></div>
            <div className="sf-energy"><div className="sf-energy-heading"><span>STARBREAK ENERGY</span><b>{Math.round(Math.max(0, Math.min(100, props.energy)))}%</b></div><div className="sf-energy-track"><i style={{ width: `${Math.max(0, Math.min(100, props.energy))}%` }} /></div></div>
            <div className="sf-combo"><span>GRAZE CHAIN</span><strong>{String(props.combo).padStart(2, '0')}<small>×</small></strong></div>
          <div className="sf-input-readout"><i /> {props.inputMode.toUpperCase()} · {inputHints[props.inputMode]}</div>
          </div>
          {props.bossMaxHealth > 0 && (
            <div className="sf-boss-bar"><div className="sf-boss-heading"><span>HOSTILE SIGNATURE / AETHERION DREADNOUGHT</span><b>PHASE {String(props.bossPhase).padStart(2, '0')}</b></div><div className="sf-boss-track"><i style={{ width: `${Math.max(0, Math.min(100, (props.bossHealth / props.bossMaxHealth) * 100))}%` }} /></div></div>
          )}
          {props.settings.touchControl && <div className="sf-touch-layer" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); touchMove(event); }} onPointerMove={(event) => { if (event.buttons || event.pressure > 0) touchMove(event); }} onPointerUp={() => props.onTouchMove(0, 0)} onPointerCancel={() => props.onTouchMove(0, 0)} aria-label="Touch movement area" />}
          {props.settings.touchControl && <div className="sf-touch-controls">
            <div className="sf-touch-pad" aria-label="Virtual movement pad"><button aria-label="Move up" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); props.onTouchMove(0, -1); }} onPointerUp={() => props.onTouchMove(0, 0)} onPointerCancel={() => props.onTouchMove(0, 0)}>△</button><div><button aria-label="Move left" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); props.onTouchMove(-1, 0); }} onPointerUp={() => props.onTouchMove(0, 0)} onPointerCancel={() => props.onTouchMove(0, 0)}>◁</button><button aria-label="Move right" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); props.onTouchMove(1, 0); }} onPointerUp={() => props.onTouchMove(0, 0)} onPointerCancel={() => props.onTouchMove(0, 0)}>▷</button></div><button aria-label="Move down" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); props.onTouchMove(0, 1); }} onPointerUp={() => props.onTouchMove(0, 0)} onPointerCancel={() => props.onTouchMove(0, 0)}>▽</button></div>
            <div className="sf-touch-acts"><button className="sf-touch-action sf-shoot" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); props.onTouchShoot(true); }} onPointerUp={() => props.onTouchShoot(false)} onPointerCancel={() => props.onTouchShoot(false)} aria-label="Hold to shoot">FIRE</button><button className="sf-touch-action" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); props.onTouchFocus(true); }} onPointerUp={() => props.onTouchFocus(false)} onPointerCancel={() => props.onTouchFocus(false)} aria-label="Hold to focus">FOCUS</button><button className="sf-touch-action sf-bomb" onClick={props.onTouchBomb} aria-label="Use bomb">BOMB</button></div>
          </div>}
          <div className="sf-orientation-hint" aria-hidden="true"><span>↻</span> LANDSCAPE RECOMMENDED</div>
        </section>
      )}

      {props.screen === 'paused' && (
        <section className="sf-overlay-panel sf-panel-enter">
          <div className="sf-modal-tag">FLIGHT SYSTEM / STANDBY</div><p className="sf-overline">PAUSED // WAVE {String(props.wave).padStart(2, '0')}</p>
          <h2>HOLD<br /><em>POSITION.</em></h2><p className="sf-modal-copy">The field is waiting, pilot.</p>
          <div className="sf-modal-buttons"><button className="sf-button sf-button-primary" onClick={props.onResume}>RESUME FLIGHT <kbd>ESC</kbd></button><button className="sf-button sf-button-outline" onClick={props.onShowSettings}>SYSTEM SETTINGS</button><button className="sf-button sf-button-outline" onClick={props.onRestart}>RESTART RUN</button><button className="sf-button sf-button-text" onClick={props.onReturnTitle}>RETURN TO TITLE</button></div>
          <div className="sf-modal-foot">SCORE <b>{formatScore(props.score)}</b><span>·</span> BEST <b>{formatScore(props.bestScore)}</b></div>
        </section>
      )}

      {props.screen === 'settings' && (
        <section className="sf-page-panel sf-panel-enter">
          <div className="sf-page-heading"><div><p className="sf-overline">FLIGHT SYSTEM / CONFIGURATION</p><h2>SYSTEM <em>SETTINGS</em></h2></div><span className="sf-page-index">SYS. / 04</span></div>
          <div className="sf-settings-grid">
            <div className="sf-setting-group"><h3>ACOUSTICS <span>01—03</span></h3>
              <SettingSlider label="Master volume" value={props.settings.masterVolume} max={1} display={`${Math.round(props.settings.masterVolume * 100)}%`} onChange={(value) => update('masterVolume', value)} />
              <SettingSlider label="Music" value={props.settings.musicVolume} max={1} display={`${Math.round(props.settings.musicVolume * 100)}%`} onChange={(value) => update('musicVolume', value)} />
              <SettingSlider label="Sound effects" value={props.settings.sfxVolume} max={1} display={`${Math.round(props.settings.sfxVolume * 100)}%`} onChange={(value) => update('sfxVolume', value)} />
            </div>
            <div className="sf-setting-group"><h3>FIELD RESPONSE <span>04—06</span></h3>
              <SettingSlider label="Screen shake" value={props.settings.screenShake} max={1} display={`${Math.round(props.settings.screenShake * 100)}%`} onChange={(value) => update('screenShake', value)} />
              <SettingSlider label="Control sensitivity" value={props.settings.sensitivity} min={0.5} max={2} step={0.1} display={`${props.settings.sensitivity.toFixed(1)}×`} onChange={(value) => update('sensitivity', value)} />
              <SettingToggle label="Particles" checked={props.settings.particles} onChange={(value) => update('particles', value)} />
            </div>
            <div className="sf-setting-group"><h3>ACCESSIBILITY <span>07—08</span></h3>
              <SettingToggle label="Reduced flashing" checked={props.settings.reducedFlashing} onChange={(value) => update('reducedFlashing', value)} />
              <SettingToggle label="Mouse control" checked={props.settings.mouseControl} onChange={(value) => update('mouseControl', value)} />
              <SettingToggle label="Touch controls" checked={props.settings.touchControl} onChange={(value) => update('touchControl', value)} />
            </div>
            <div className="sf-setting-group sf-fullscreen-setting"><h3>DISPLAY <span>09</span></h3>
              <div className="sf-setting-row"><label>Fullscreen</label><button className={`sf-toggle ${props.settings.fullscreen ? 'is-on' : ''}`} role="switch" aria-checked={props.settings.fullscreen} onClick={() => { update('fullscreen', !props.settings.fullscreen); props.onToggleFullscreen(); }}><i /></button></div>
            </div>
          </div>
          <div className="sf-page-footer"><button className="sf-button sf-button-outline" onClick={props.onBack}>← BACK</button><span>CHANGES APPLY IN REAL TIME</span></div>
        </section>
      )}

      {props.screen === 'controls' && (
        <section className="sf-page-panel sf-panel-enter">
          <div className="sf-page-heading"><div><p className="sf-overline">PILOT REFERENCE / INPUT MAP</p><h2>FLIGHT <em>CONTROLS</em></h2></div><span className="sf-page-index">REF. / 02</span></div>
          <div className="sf-control-columns">
            <ControlGroup title="KEYBOARD" index="01" rows={ [['MOVE', 'W A S D', 'ARROW KEYS'], ['FIRE', 'SPACE', 'HOLD'], ['FOCUS', 'SHIFT', 'HOLD'], ['STARBREAK', 'X', 'BOMB'], ['PAUSE', 'ESC', 'MENU']] } />
            <ControlGroup title="MOUSE" index="02" rows={ [['MOVE', 'POINTER', 'TRACK SHIP'], ['FIRE', 'LEFT CLICK', 'HOLD'], ['FOCUS', 'RIGHT CLICK', 'HOLD'], ['STARBREAK', 'X / HUD', 'BOMB']] } />
            <ControlGroup title="GAMEPAD" index="03" rows={ [['MOVE', 'LEFT STICK', 'D-PAD'], ['FIRE', 'A / CROSS', 'HOLD'], ['FOCUS', 'B / CIRCLE', 'HOLD'], ['STARBREAK', 'Y / TRIANGLE', 'BOMB'], ['PAUSE', 'START', 'MENU']] } />
            {props.settings.touchControl && <ControlGroup title="TOUCH" index="04" rows={ [['MOVE', 'VIRTUAL PAD', 'LEFT SIDE'], ['FIRE', 'FIRE', 'HOLD'], ['FOCUS', 'FOCUS', 'HOLD'], ['STARBREAK', 'BOMB', 'TAP']] } />}
          </div>
          <div className="sf-page-footer"><button className="sf-button sf-button-outline" onClick={props.onBack}>← BACK</button><span>INPUT: {props.inputMode.toUpperCase()} <i className="sf-live-dot" /></span></div>
        </section>
      )}

      {props.screen === 'credits' && (
        <section className="sf-credits sf-panel-enter">
          <p className="sf-overline">A SMALL SIGNAL, SENT INTO THE DARK</p>
          <img className="sf-credits-logo" src={`${import.meta.env.BASE_URL}brand/sppyntex-logo.jpg`} alt="SPPyntex logo" />
          <h2>SPPyntex</h2>
          <div className="sf-credit-rule" />
          <p className="sf-credit-role">Developed by Safal Panta</p>
          <p className="sf-credit-dedication">For those who keep flying<br />when the stars go quiet.</p>
          <button className="sf-button sf-button-outline" onClick={props.onBack}>← BACK TO FLIGHT DECK</button>
          <div className="sf-credit-version">STARFALL PROTOCOL <span>·</span> BUILD 01.09</div>
        </section>
      )}

      {props.screen === 'tutorial' && (
        <section className="sf-tutorial sf-panel-enter">
          <div className="sf-tutorial-head"><p className="sf-overline">PILOT ORIENTATION / VEGA FRONTIER</p><span>FIELD MANUAL <b>01—06</b></span></div>
          <div className="sf-tutorial-body">
            <div className="sf-tutorial-count">0{step + 1}<span> / 06</span></div>
            <div className="sf-tutorial-copy"><p>TRAINING NOTE // {String(step + 1).padStart(2, '0')}</p><h2>{tutorialCopy[step][0]}</h2><div className="sf-tutorial-rule" /><p className="sf-tutorial-description">{tutorialCopy[step][1]}</p></div>
            <div className="sf-tutorial-glyph" aria-hidden="true">{['⌘', '✳', '⇧', '◎', '✦', '◈'][step]}</div>
          </div>
          <div className="sf-tutorial-footer"><button className="sf-button sf-button-text" onClick={props.onSkipTutorial}>SKIP BRIEFING</button><div className="sf-tutorial-dots" aria-label={`Step ${step + 1} of 6`}>{tutorialCopy.map((_, index) => <i key={index} className={index === step ? 'active' : ''} />)}</div><button className="sf-button sf-button-primary" onClick={() => { if (step < 5) setTutorialIndex(step + 1); props.onNextTutorial(); }}>{step === 5 ? 'DEPLOY' : 'NEXT'} <span>→</span></button></div>
        </section>
      )}

      {props.screen === 'results' && (
        <section className="sf-results sf-panel-enter">
          <div className={`sf-result-stamp ${props.result?.cleared ? 'is-clear' : ''}`}>{props.result?.cleared ? 'MISSION CLEAR' : 'SIGNAL LOST'}<span>{props.result?.cleared ? 'GATE SILENCED' : 'VESPER-01 / RECOVERY PENDING'}</span></div>
          <img className="sf-results-logo" src={`${import.meta.env.BASE_URL}brand/sppyntex-logo.jpg`} alt="SPPyntex logo" />
          <div className="sf-results-heading"><p className="sf-overline">RUN DEBRIEF / VEGA FRONTIER</p><h2>{props.result?.cleared ? 'THE STARS REMAIN.' : 'FLIGHT ENDED.'}</h2></div>
          <div className="sf-results-score"><span>FINAL SCORE</span><strong>{formatScore(props.result?.score ?? props.score)}</strong><small>PERSONAL BEST <b>{formatScore(props.result?.bestScore ?? props.bestScore)}</b></small></div>
          <div className="sf-stats-grid">
            <Stat label="ENEMIES DESTROYED" value={props.result?.enemiesDestroyed ?? 0} />
            <Stat label="GRAZES" value={props.result?.grazes ?? 0} />
            <Stat label="HIGHEST COMBO" value={`${props.result?.highestCombo ?? 0}×`} />
            <Stat label="BOMBS USED" value={props.result?.bombsUsed ?? 0} />
            <Stat label="LIVES LOST" value={props.result?.livesLost ?? 0} />
            <Stat label="MISSION STATUS" value={props.result?.cleared ? 'CLEARED' : 'FAILED'} special />
          </div>
          <div className="sf-results-actions"><button className="sf-button sf-button-primary" onClick={props.onPlayAgain}>FLY AGAIN <span>↗</span></button><button className="sf-button sf-button-outline" onClick={props.onShowControls}>CONTROLS</button><button className="sf-button sf-button-outline" onClick={props.onReturnTitle}>RETURN TO TITLE</button></div>
        </section>
      )}
    </main>
  );
}

function SettingSlider({ label, value, min = 0, max, step = 0.01, display, onChange }: { label: string; value: number; min?: number; max: number; step?: number; display: string; onChange: (value: number) => void }) {
  const progress = ((value - min) / (max - min)) * 100;
  return <div className="sf-setting-slider"><div className="sf-setting-row"><label>{label}</label><output>{display}</output></div><input type="range" min={min} max={max} step={step} value={value} style={{ '--range-progress': `${progress}%` } as CSSProperties} onChange={(event) => onChange(Number(event.currentTarget.value))} aria-label={label} /></div>;
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="sf-setting-row"><label>{label}</label><button className={`sf-toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><i /></button></div>;
}

function ControlGroup({ title, index, rows }: { title: string; index: string; rows: string[][] }) {
  return <div className="sf-control-group"><h3><span>{index} /</span> {title}</h3>{rows.map(([action, key, note]) => <div className="sf-control-row" key={action}><span>{action}</span><kbd>{key}</kbd><small>{note}</small></div>)}</div>;
}

function Stat({ label, value, special = false }: { label: string; value: string | number; special?: boolean }) {
  return <div className="sf-stat"><span>{label}</span><strong className={special ? 'sf-stat-status' : ''}>{value}</strong></div>;
}
