import { StarfallAudio } from './audio';
import {
  type GameSettings,
  type GameSnapshot,
  type InputMode,
  type RunSummary,
  type SavedRun,
  INITIAL_SNAPSHOT,
} from './types';
import {
  clearSavedRun,
  loadBestScore,
  loadSavedRun,
  saveBestScore,
  saveRun,
} from './storage';

const W = 480;
const H = 720;
const PLAYER_HIT_RADIUS = 5;
const GRAZE_RADIUS = 28;
const TAU = Math.PI * 2;
const WAVE_NAMES = ['Nebula Patrol', 'Rift Squadron', 'Dreadnought Defense'];
const WAVE_LENGTHS = [66, 72, 80];

type EnemyType = 'scout' | 'fighter' | 'heavy' | 'interceptor' | 'elite';
type BulletShape = 'orb' | 'diamond' | 'needle';

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  shape: BulletShape;
  grazed: boolean;
  color: string;
};

type PlayerShot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
};

type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: EnemyType;
  age: number;
  fireTimer: number;
  lane: number;
};

type ScoreItem = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  age: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
};

type FloatingText = {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
};

type InputState = {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseSeen: boolean;
  mouseShoot: boolean;
  mouseFocus: boolean;
  touchX: number;
  touchY: number;
  touchMove: boolean;
  touchShoot: boolean;
  touchFocus: boolean;
  gamepadShoot: boolean;
  gamepadFocus: boolean;
  gamepadBomb: boolean;
};

type PlayerState = {
  x: number;
  y: number;
  invulnerable: number;
  fireTimer: number;
  damageFlash: number;
  focus: boolean;
};

export class StarfallEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private lastTime = 0;
  private accumulator = 0;
  private active = false;
  private disposed = false;
  private elapsed = 0;
  private waveTime = 0;
  private breakTime = 0;
  private saveTimer = 0;
  private emitTimer = 0;
  private stars: Array<{ x: number; y: number; depth: number; size: number; twinkle: number }> = [];
  private mouseIdle = 0;
  private gamepadStartWasDown = false;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private shots: PlayerShot[] = [];
  private items: ScoreItem[] = [];
  private particles: Particle[] = [];
  private texts: FloatingText[] = [];
  private player: PlayerState = {
    x: W / 2,
    y: H - 88,
    invulnerable: 0,
    fireTimer: 0,
    damageFlash: 0,
    focus: false,
  };
  private score = 0;
  private lives = 3;
  private energy = 0;
  private combo = 0;
  private comboTimer = 0;
  private highestCombo = 0;
  private enemiesDestroyed = 0;
  private grazes = 0;
  private bombsUsed = 0;
  private livesLost = 0;
  private wave = 0;
  private spawnTimer = 1.3;
  private bossHealth = 0;
  private bossMaxHealth = 16000;
  private bossPhase = 0;
  private bossAge = 0;
  private bossFireTimer = 1.2;
  private bombFlash = 0;
  private shake = 0;
  private nextBossPhase = 1;
  private settings: GameSettings;
  private snapshot: GameSnapshot = { ...INITIAL_SNAPSHOT };
  private inputMode: InputMode = 'keyboard';
  private onState: (state: GameSnapshot) => void;
  private onPause: () => void;
  private input: InputState = {
    keys: new Set(),
    mouseX: W / 2,
    mouseY: H - 88,
    mouseSeen: false,
    mouseShoot: false,
    mouseFocus: false,
    touchX: 0,
    touchY: 0,
    touchMove: false,
    touchShoot: false,
    touchFocus: false,
    gamepadShoot: false,
    gamepadFocus: false,
    gamepadBomb: false,
  };
  private audio: StarfallAudio;

  constructor(
    settings: GameSettings,
    onState: (state: GameSnapshot) => void,
    onPause: () => void,
  ) {
    this.settings = settings;
    this.onState = onState;
    this.onPause = onPause;
    this.audio = new StarfallAudio(settings);
    this.createStars();
    this.snapshot = {
      ...INITIAL_SNAPSHOT,
      bestScore: loadBestScore(),
      canContinue: Boolean(loadSavedRun()),
    };
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Canvas 2D is not supported by this browser.');
    canvas.width = W;
    canvas.height = H;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.publish();
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.canvas) {
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointerup', this.onPointerUp);
      this.canvas.removeEventListener('pointerleave', this.onPointerUp);
      this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    this.audio.destroy();
  }

  setActive(active: boolean): void {
    this.active = active && this.snapshot.status === 'playing';
    if (!this.active) this.input.keys.clear();
    this.lastTime = performance.now();
  }

  setSettings(settings: GameSettings): void {
    this.settings = settings;
    this.audio.updateSettings(settings);
    this.publish();
  }

  activateAudio(): void {
    this.audio.unlock();
  }

  beginRun(): void {
    this.resetRun();
    this.snapshot.status = 'playing';
    this.active = true;
    this.audio.unlock();
    this.audio.play('menu');
    this.saveTimer = 0;
    this.publish();
    this.saveCurrentRun();
  }

  continueRun(): boolean {
    const saved = loadSavedRun();
    if (!saved) return false;
    this.resetRun();
    this.score = saved.score;
    this.lives = saved.lives;
    this.energy = saved.energy;
    this.combo = saved.combo;
    this.highestCombo = saved.highestCombo;
    this.enemiesDestroyed = saved.enemiesDestroyed;
    this.grazes = saved.grazes;
    this.bombsUsed = saved.bombsUsed;
    this.livesLost = saved.livesLost;
    this.wave = Math.max(0, Math.min(3, saved.wave - 1));
    this.waveTime = saved.waveTime;
    this.bossHealth = saved.bossHealth;
    this.bossPhase = saved.bossPhase;
    this.player.x = saved.playerX;
    this.player.y = saved.playerY;
    this.elapsed = saved.elapsed;
    this.snapshot.status = 'playing';
    this.active = true;
    this.audio.unlock();
    this.audio.setBossMusic(this.wave === 3);
    this.publish();
    return true;
  }

  returnToTitle(): void {
    this.active = false;
    this.snapshot.status = 'idle';
    this.snapshot.result = null;
    this.clearCombat();
    this.publish();
  }

  updateTouchMove(dx: number, dy: number): void {
    this.input.touchX = Math.max(-1, Math.min(1, dx));
    this.input.touchY = Math.max(-1, Math.min(1, dy));
    this.input.touchMove = Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02;
    if (this.input.touchMove) this.inputMode = 'touch';
  }

  updateTouchShoot(down: boolean): void {
    this.input.touchShoot = down;
    if (down) this.inputMode = 'touch';
  }

  updateTouchFocus(down: boolean): void {
    this.input.touchFocus = down;
    if (down) this.inputMode = 'touch';
  }

  activateBomb(): void {
    if (!this.active || this.energy < 100) return;
    this.energy = 0;
    this.bombsUsed += 1;
    this.bombFlash = this.settings.reducedFlashing ? 0.18 : 0.42;
    this.shake = Math.max(this.shake, 8 * this.settings.screenShake);
    const cleared = this.bullets.length;
    this.score += cleared * 18;
    this.bullets = [];
    this.enemies.forEach((enemy) => {
      enemy.hp -= 210;
      this.burst(enemy.x, enemy.y, '#8b7dff', 8);
    });
    if (this.wave === 3 && this.bossHealth > 0) {
      const damage = this.bossPhase === 3
        ? Math.min(1450, Math.max(0, this.bossHealth - 1))
        : 1450;
      this.bossHealth = Math.max(1, this.bossHealth - damage);
    }
    for (let i = 0; i < 56; i += 1) {
      const angle = (i / 56) * TAU;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(angle) * (1.4 + Math.random() * 3.1),
        vy: Math.sin(angle) * (1.4 + Math.random() * 3.1),
        radius: 2 + Math.random() * 4,
        life: 0.9 + Math.random() * 0.7,
        maxLife: 1.6,
        color: i % 2 ? '#64f4f5' : '#a69bff',
      });
    }
    this.audio.play('bomb');
    this.addText(this.player.x, this.player.y - 40, 'STARFALL BURST', '#c7faff');
    this.publish();
  }

  private resetRun(): void {
    this.elapsed = 0;
    this.waveTime = 0;
    this.breakTime = 0;
    this.score = 0;
    this.lives = 3;
    this.energy = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.highestCombo = 0;
    this.enemiesDestroyed = 0;
    this.grazes = 0;
    this.bombsUsed = 0;
    this.livesLost = 0;
    this.wave = 0;
    this.spawnTimer = 1.2;
    this.bossHealth = 0;
    this.bossPhase = 0;
    this.bossAge = 0;
    this.bossFireTimer = 1.2;
    this.bombFlash = 0;
    this.shake = 0;
    this.nextBossPhase = 1;
    this.player = {
      x: W / 2,
      y: H - 88,
      invulnerable: 2.4,
      fireTimer: 0.15,
      damageFlash: 0,
      focus: false,
    };
    this.clearCombat();
    this.snapshot = {
      ...INITIAL_SNAPSHOT,
      status: 'playing',
      bestScore: loadBestScore(),
      canContinue: false,
    };
    this.audio.setBossMusic(false);
  }

  private clearCombat(): void {
    this.enemies = [];
    this.bullets = [];
    this.shots = [];
    this.items = [];
    this.particles = [];
    this.texts = [];
  }

  private frame = (time: number): void => {
    if (this.disposed) return;
    const delta = Math.min(0.1, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    this.accumulator = Math.min(0.2, this.accumulator + delta);
    while (this.accumulator >= 1 / 60) {
      this.step(1 / 60);
      this.accumulator -= 1 / 60;
    }
    this.draw();
    this.emitTimer += delta;
    if (this.emitTimer > 0.14) {
      this.emitTimer = 0;
      this.publish();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private step(dt: number): void {
    this.elapsed += dt;
    this.updateBackdrop(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
    this.mouseIdle = Math.max(0, this.mouseIdle - dt);
    this.bombFlash = Math.max(0, this.bombFlash - dt);
    this.shake = Math.max(0, this.shake - dt * 18);
    if (!this.active || this.snapshot.status !== 'playing') return;

    this.updateGamepad();
    this.updatePlayer(dt);
    this.updateShots(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateItems(dt);
    if (this.wave === 3 && this.bossPhase > 0 && this.bossHealth <= 0) {
      this.defeatBoss();
    } else {
      this.updateBoss(dt);
    }
    this.updateCombo(dt);
    this.waveTime += dt;
    this.saveTimer += dt;

    if (this.wave < 3) this.progressWaves();

    if (this.saveTimer > 4) {
      this.saveTimer = 0;
      this.saveCurrentRun();
    }
  }

  private updatePlayer(dt: number): void {
    const player = this.player;
    const keys = this.input.keys;
    const keyboardX =
      (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
      (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    const keyboardY =
      (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) -
      (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
    const padX = this.gamepadAxis(0);
    const padY = this.gamepadAxis(1);
    let moveX = keyboardX || padX || (this.input.touchMove ? this.input.touchX : 0);
    let moveY = keyboardY || padY || (this.input.touchMove ? this.input.touchY : 0);
    const length = Math.hypot(moveX, moveY);
    if (length > 1) {
      moveX /= length;
      moveY /= length;
    }

    player.focus =
      keys.has('ShiftLeft') ||
      keys.has('ShiftRight') ||
      this.input.mouseFocus ||
      this.input.touchFocus ||
      this.input.gamepadFocus;

    const shooting =
      keys.has('KeyZ') ||
      keys.has('Space') ||
      this.input.mouseShoot ||
      this.input.touchShoot ||
      this.input.gamepadShoot;

    const speed = player.focus ? 155 : 278;
    const directionalInput = Boolean(keyboardX || keyboardY || padX || padY || this.input.touchMove);
    if (
      this.input.mouseSeen &&
      this.mouseIdle > 0 &&
      this.settings.mouseControl &&
      this.active &&
      !directionalInput
    ) {
      const targetX = Math.max(22, Math.min(W - 22, this.input.mouseX));
      const targetY = Math.max(42, Math.min(H - 26, this.input.mouseY));
      const follow = Math.min(1, dt * 14 * this.settings.sensitivity);
      player.x += (targetX - player.x) * follow;
      player.y += (targetY - player.y) * follow;
      if (Math.abs(targetX - player.x) + Math.abs(targetY - player.y) > 3) {
        this.inputMode = 'mouse';
      }
    } else {
      player.x += moveX * speed * dt;
      player.y += moveY * speed * dt;
      if (keyboardX || keyboardY) this.inputMode = 'keyboard';
      if (padX || padY) this.inputMode = 'gamepad';
      player.x = Math.max(22, Math.min(W - 22, player.x));
      player.y = Math.max(42, Math.min(H - 26, player.y));
    }

    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.damageFlash = Math.max(0, player.damageFlash - dt);
    player.fireTimer -= dt;
    if (shooting && player.fireTimer <= 0) {
      this.firePlayerShot();
      player.fireTimer = player.focus ? 0.12 : 0.14;
    }
  }

  private firePlayerShot(): void {
    const x = this.player.x;
    const y = this.player.y - 18;
    this.shots.push(
      { x: x - 8, y, vx: -4, vy: -620, damage: 10 },
      { x: x + 8, y, vx: 4, vy: -620, damage: 10 },
    );
    if (this.player.focus) {
      this.shots.push({ x, y: y - 9, vx: 0, vy: -690, damage: 12 });
    }
    if (Math.random() < 0.15) this.audio.play('shoot', 0.35);
  }

  private updateShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i]!;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.y < -20 || shot.x < -20 || shot.x > W + 20) {
        this.shots.splice(i, 1);
        continue;
      }
      let consumed = false;
      for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = this.enemies[j]!;
        if (distanceSq(shot.x, shot.y, enemy.x, enemy.y) < (enemy.type === 'heavy' ? 22 : 17) ** 2) {
          enemy.hp -= shot.damage;
          this.burst(shot.x, shot.y, '#65f3f0', 2);
          this.shots.splice(i, 1);
          consumed = true;
          if (enemy.hp <= 0) this.destroyEnemy(j);
          break;
        }
      }
      if (consumed) continue;
      if (this.wave === 3 && this.bossHealth > 0 && this.bossPhase > 0) {
        const bossX = W / 2 + Math.sin(this.bossAge * 0.55) * 83;
        const bossY = 133 + Math.sin(this.bossAge * 0.33) * 12;
        const inCore = Math.abs(shot.x - bossX) < 48 && Math.abs(shot.y - bossY) < 40;
        if (inCore) {
          this.bossHealth = Math.max(0, this.bossHealth - shot.damage);
          this.burst(shot.x, shot.y, this.bossPhase === 3 ? '#ffbd67' : '#55e8ff', 1);
          this.shots.splice(i, 1);
        }
      }
    }
  }

  private progressWaves(): void {
    if (this.breakTime > 0) {
      this.breakTime -= 1 / 60;
      if (this.breakTime <= 0) {
        this.wave += 1;
        this.waveTime = 0;
        this.spawnTimer = 1.2;
        this.bullets = [];
        this.audio.play('phase');
        if (this.wave === 3) this.startBoss();
        this.publish();
      }
      return;
    }
    const duration = WAVE_LENGTHS[this.wave] ?? 0;
    if (this.waveTime >= duration) {
      this.score += 1200 + this.lives * 250;
      this.addText(W / 2, H * 0.46, `WAVE ${this.wave + 1} CLEAR  +${1200 + this.lives * 250}`, '#ffd18a');
      this.enemies.forEach((enemy) => this.dropItem(enemy.x, enemy.y, 1));
      this.enemies = [];
      this.bullets = [];
      this.breakTime = 4.2;
      this.waveTime = 0;
      this.audio.play('phase');
      this.publish();
      return;
    }
    this.spawnTimer -= 1 / 60;
    if (this.spawnTimer <= 0) {
      this.spawnFormation();
      const cadence = this.wave === 0 ? 3.1 : this.wave === 1 ? 2.7 : 2.35;
      this.spawnTimer = cadence + Math.random() * 0.85;
    }
  }

  private spawnFormation(): void {
    const w = this.wave;
    const choose: EnemyType[] =
      w === 0
        ? ['scout', 'fighter', 'scout', 'interceptor']
        : w === 1
          ? ['fighter', 'interceptor', 'heavy', 'elite']
          : ['heavy', 'elite', 'interceptor', 'fighter'];
    const type = choose[Math.floor(Math.random() * choose.length)] ?? 'scout';
    const count = type === 'scout' || type === 'interceptor' ? 3 : type === 'fighter' ? 2 : 1;
    const spacing = 67;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spacing;
      const hp =
        type === 'scout' ? 32 :
          type === 'fighter' ? 76 :
            type === 'heavy' ? 210 :
              type === 'elite' ? 132 : 54;
      const center = W / 2 + (Math.random() - 0.5) * 170;
      this.enemies.push({
        x: Math.max(28, Math.min(W - 28, center + offset)),
        y: -34 - i * 17,
        vx: type === 'interceptor' ? (Math.random() < 0.5 ? -45 : 45) : (Math.random() - 0.5) * 14,
        vy: type === 'heavy' ? 40 : type === 'elite' ? 67 : 54 + w * 8,
        hp,
        maxHp: hp,
        type,
        age: 0,
        fireTimer: 1.4 + Math.random() * 0.65,
        lane: Math.random() * TAU,
      });
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i]!;
      enemy.age += dt;
      if (enemy.type === 'interceptor') {
        enemy.x += (enemy.vx + Math.sin(enemy.age * 2.2) * 42) * dt;
        enemy.y += enemy.vy * dt;
        if (enemy.x < 38 || enemy.x > W - 38) enemy.vx *= -1;
      } else if (enemy.type === 'elite') {
        enemy.x += (Math.sin(enemy.age * 2 + enemy.lane) * 50 + enemy.vx) * dt;
        enemy.y += enemy.vy * dt;
      } else {
        enemy.x += Math.sin(enemy.age * 1.6 + enemy.lane) * (enemy.type === 'heavy' ? 10 : 24) * dt;
        enemy.y += enemy.vy * dt;
      }
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && enemy.y > 12 && enemy.y < H * 0.72) {
        this.enemyAttack(enemy);
        const base =
          enemy.type === 'scout' ? 1.7 :
            enemy.type === 'fighter' ? 2.3 :
              enemy.type === 'heavy' ? 2.8 :
                enemy.type === 'elite' ? 1.85 : 1.9;
        enemy.fireTimer = base + Math.random() * 0.4 - this.wave * 0.12;
      }
      if (enemy.y > H + 55 || enemy.x < -80 || enemy.x > W + 80) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (
        this.player.invulnerable <= 0 &&
        distanceSq(enemy.x, enemy.y, this.player.x, this.player.y) < 18 ** 2
      ) {
        this.damagePlayer();
        enemy.hp -= 30;
        if (enemy.hp <= 0) this.destroyEnemy(i);
      }
    }
  }

  private enemyAttack(enemy: Enemy): void {
    const angleToPlayer = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const speed = this.wave === 0 ? 146 : this.wave === 1 ? 170 : 190;
    if (enemy.type === 'scout') {
      this.spawnBullet(enemy.x, enemy.y + 8, angleToPlayer, speed, 'orb');
    } else if (enemy.type === 'fighter') {
      for (let n = -1; n <= 1; n += 1) {
        this.spawnBullet(enemy.x, enemy.y + 9, angleToPlayer + n * 0.2, speed * 0.88, 'diamond');
      }
    } else if (enemy.type === 'heavy') {
      this.spawnBullet(enemy.x, enemy.y + 13, angleToPlayer, speed * 0.72, 'needle');
      this.spawnBullet(enemy.x, enemy.y + 13, angleToPlayer - 0.14, speed * 0.72, 'needle');
      this.spawnBullet(enemy.x, enemy.y + 13, angleToPlayer + 0.14, speed * 0.72, 'needle');
    } else if (enemy.type === 'interceptor') {
      this.spawnBullet(enemy.x, enemy.y + 7, angleToPlayer - 0.13, speed, 'orb');
      this.spawnBullet(enemy.x, enemy.y + 7, angleToPlayer + 0.13, speed, 'orb');
    } else {
      for (let n = -2; n <= 2; n += 1) {
        this.spawnBullet(enemy.x, enemy.y + 10, angleToPlayer + n * 0.19, speed * 0.9, 'diamond');
      }
    }
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i]!;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (
        bullet.x < -30 ||
        bullet.x > W + 30 ||
        bullet.y < -40 ||
        bullet.y > H + 35
      ) {
        this.bullets.splice(i, 1);
        continue;
      }
      const d = Math.sqrt(distanceSq(bullet.x, bullet.y, this.player.x, this.player.y));
      if (!bullet.grazed && d < GRAZE_RADIUS && d > PLAYER_HIT_RADIUS + bullet.radius) {
        bullet.grazed = true;
        this.grazes += 1;
        this.combo += 1;
        this.highestCombo = Math.max(this.highestCombo, this.combo);
        this.comboTimer = 1.7;
        this.energy = Math.min(100, this.energy + 2.9);
        this.score += 24 + Math.min(50, this.combo);
        this.burst(this.player.x, this.player.y, '#c8ffff', 2);
        if (this.combo % 4 === 0) this.audio.play('graze', 0.22);
      }
      if (
        this.player.invulnerable <= 0 &&
        d < PLAYER_HIT_RADIUS + bullet.radius * 0.67
      ) {
        this.bullets.splice(i, 1);
        this.damagePlayer();
        return;
      }
    }
  }

  private updateItems(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i]!;
      item.age += dt;
      item.vy = Math.min(135, item.vy + 8 * dt);
      if (item.age > 0.8 && distanceSq(item.x, item.y, this.player.x, this.player.y) < 170 ** 2) {
        const angle = Math.atan2(this.player.y - item.y, this.player.x - item.x);
        item.vx += Math.cos(angle) * 235 * dt;
        item.vy += Math.sin(angle) * 235 * dt;
      }
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vx *= Math.pow(0.982, dt * 60);
      if (distanceSq(item.x, item.y, this.player.x, this.player.y) < 21 ** 2) {
        this.score += item.value * this.multiplier();
        this.energy = Math.min(100, this.energy + 0.8);
        this.addText(item.x, item.y, `+${item.value * this.multiplier()}`, '#ffe6a7');
        this.audio.play('collect', 0.28);
        this.items.splice(i, 1);
      } else if (item.y > H + 15 || item.age > 13) {
        this.items.splice(i, 1);
      }
    }
  }

  private updateBoss(dt: number): void {
    if (this.wave !== 3 || this.bossHealth <= 0) return;
    this.bossAge += dt;
    this.bossFireTimer -= dt;
    const ratio = this.bossHealth / this.bossMaxHealth;
    const phase = ratio > 0.65 ? 1 : ratio > 0.3 ? 2 : 3;
    if (phase !== this.bossPhase) {
      this.bossPhase = phase;
      this.bossFireTimer = 1.8;
      this.audio.play('phase');
      this.audio.setBossMusic(true);
      this.bombFlash = this.settings.reducedFlashing ? 0.1 : 0.24;
      this.addText(W / 2, 294, phase === 2 ? 'REACTOR AWAKENS' : 'STARFALL COLLAPSE', '#f4a8ff');
    }
    if (this.bossFireTimer <= 0) {
      this.bossAttack();
      this.bossFireTimer = this.bossPhase === 1 ? 1.26 : this.bossPhase === 2 ? 0.98 : 0.8;
    }
    if (this.bossHealth <= 0) this.defeatBoss();
  }

  private bossAttack(): void {
    const x = W / 2 + Math.sin(this.bossAge * 0.55) * 83;
    const y = 133 + Math.sin(this.bossAge * 0.33) * 12;
    const aimed = Math.atan2(this.player.y - y, this.player.x - x);
    if (this.bossPhase === 1) {
      for (let n = -3; n <= 3; n += 1) {
        this.spawnBullet(x + n * 16, y + 35, aimed + n * 0.17, 142, 'orb');
      }
      if (Math.floor(this.bossAge) % 3 === 0) {
        this.spawnBullet(x - 90, y + 20, Math.PI / 2 + 0.3, 122, 'diamond');
        this.spawnBullet(x + 90, y + 20, Math.PI / 2 - 0.3, 122, 'diamond');
      }
    } else if (this.bossPhase === 2) {
      const rotation = this.bossAge * 0.8;
      for (let n = 0; n < 9; n += 1) {
        this.spawnBullet(x, y + 35, rotation + (n / 9) * TAU, 116, n % 2 ? 'orb' : 'diamond');
      }
      for (let n = -1; n <= 1; n += 1) {
        this.spawnBullet(x, y + 46, aimed + n * 0.2, 190, 'needle');
      }
    } else {
      const fan = Math.sin(this.bossAge * 0.9) * 0.18;
      for (let n = -4; n <= 4; n += 1) {
        this.spawnBullet(x, y + 42, Math.PI / 2 + fan + n * 0.11, 158, n % 2 ? 'diamond' : 'orb');
      }
      if (Math.floor(this.bossAge * 1.3) % 2 === 0) {
        this.spawnBullet(x, y + 42, aimed, 225, 'needle');
      }
    }
  }

  private startBoss(): void {
    this.wave = 3;
    this.waveTime = 0;
    this.bossHealth = this.bossMaxHealth;
    this.bossPhase = 1;
    this.bossAge = 0;
    this.bossFireTimer = 1.75;
    this.audio.setBossMusic(true);
    this.audio.play('boss');
    this.addText(W / 2, H * 0.43, 'AETHERION DREADNOUGHT', '#9ffaff');
    this.addText(W / 2, H * 0.47, 'SIGNATURE LOCKED  /  VESPER-01 ENGAGE', '#ffd18a');
    this.shake = 4 * this.settings.screenShake;
    this.publish();
  }

  private defeatBoss(): void {
    this.bossHealth = 0;
    this.score += 25000 + this.lives * 1200;
    this.bossPhase = 0;
    this.bullets = [];
    this.audio.play('victory');
    this.audio.setBossMusic(false);
    this.bombFlash = this.settings.reducedFlashing ? 0.2 : 0.65;
    this.burst(W / 2, 140, '#9beeff', 75);
    this.burst(W / 2, 150, '#ffbf77', 40);
    this.addText(W / 2, 250, 'STAR GATE STABILIZED', '#d9fbff');
    this.finishRun(true);
  }

  private damagePlayer(): void {
    if (this.player.invulnerable > 0 || this.snapshot.status !== 'playing') return;
    this.lives -= 1;
    this.livesLost += 1;
    this.player.invulnerable = 1.9;
    this.player.damageFlash = 0.45;
    this.energy = Math.max(0, this.energy - 22);
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 11 * this.settings.screenShake;
    this.audio.play('damage');
    this.burst(this.player.x, this.player.y, '#ffac68', 18);
    this.bullets = this.bullets.filter(
      (bullet) => distanceSq(bullet.x, bullet.y, this.player.x, this.player.y) > 80 ** 2,
    );
    if (this.lives <= 0) {
      this.audio.play('defeat');
      this.finishRun(false);
    } else {
      this.player.x = W / 2;
      this.player.y = H - 88;
    }
  }

  private finishRun(cleared: boolean): void {
    this.active = false;
    this.snapshot.status = cleared ? 'won' : 'lost';
    const best = saveBestScore(this.score);
    this.snapshot.bestScore = best;
    const result: RunSummary = {
      score: this.score,
      bestScore: best,
      enemiesDestroyed: this.enemiesDestroyed,
      grazes: this.grazes,
      highestCombo: this.highestCombo,
      bombsUsed: this.bombsUsed,
      livesLost: this.livesLost,
      cleared,
    };
    this.snapshot.result = result;
    clearSavedRun();
    this.publish();
  }

  private destroyEnemy(index: number): void {
    const enemy = this.enemies[index];
    if (!enemy) return;
    this.enemiesDestroyed += 1;
    const base = enemy.type === 'heavy' ? 1100 : enemy.type === 'elite' ? 800 : 350;
    const points = base * this.multiplier();
    this.score += points;
    this.energy = Math.min(100, this.energy + (enemy.type === 'heavy' ? 5 : 2.5));
    this.burst(enemy.x, enemy.y, enemy.type === 'heavy' ? '#ffb767' : '#f089b6', 13);
    this.addText(enemy.x, enemy.y - 8, `+${points}`, '#94f6f6');
    this.dropItem(enemy.x, enemy.y, enemy.type === 'heavy' ? 3 : 1);
    this.audio.play('enemy', 0.42);
    this.enemies.splice(index, 1);
  }

  private dropItem(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      this.items.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 44,
        vy: -20 - Math.random() * 28,
        value: count > 1 ? 250 : 100,
        age: 0,
      });
    }
  }

  private spawnBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    shape: BulletShape,
  ): void {
    this.bullets.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: shape === 'needle' ? 6 : shape === 'diamond' ? 6.2 : 5.5,
      damage: 1,
      shape,
      grazed: false,
      color: shape === 'needle' ? '#ffb251' : shape === 'diamond' ? '#ffd078' : '#ff9179',
    });
    if (this.bullets.length > 600) this.bullets.splice(0, this.bullets.length - 600);
  }

  private burst(x: number, y: number, color: string, count: number): void {
    if (!this.settings.particles) count = Math.max(1, Math.floor(count / 3));
    const size = Math.min(90, count);
    for (let i = 0; i < size; i += 1) {
      const angle = Math.random() * TAU;
      const speed = 24 + Math.random() * (count > 15 ? 180 : 95);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1 + Math.random() * (count > 15 ? 3 : 2),
        life: 0.22 + Math.random() * 0.65,
        maxLife: 0.87,
        color,
      });
    }
    if (this.particles.length > 360) this.particles.splice(0, this.particles.length - 360);
  }

  private addText(x: number, y: number, text: string, color: string): void {
    this.texts.push({ x, y, text, life: 1.05, color });
    if (this.texts.length > 24) this.texts.shift();
  }

  private updateCombo(dt: number): void {
    if (this.combo <= 0) return;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.addText(this.player.x, this.player.y - 34, 'COMBO LOST', '#ba9cb5');
      this.combo = 0;
      this.comboTimer = 0;
    }
  }

  private multiplier(): number {
    return 1 + Math.min(3, Math.floor(this.combo / 15) * 0.25);
  }

  private updateBackdrop(dt: number): void {
    for (const star of this.stars) {
      star.y += star.depth * dt * 15;
      star.twinkle += dt * (0.5 + star.depth * 1.4);
      if (star.y > H + 3) {
        star.y = -3;
        star.x = Math.random() * W;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.985, dt * 60);
      p.vy *= Math.pow(0.985, dt * 60);
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updateTexts(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const text = this.texts[i]!;
      text.y -= 19 * dt;
      text.life -= dt;
      if (text.life <= 0) this.texts.splice(i, 1);
    }
  }

  private updateGamepad(): void {
    if (!('getGamepads' in navigator)) return;
    const pad = navigator.getGamepads().find((gamepad) => gamepad?.connected) ?? null;
    if (!pad) {
      this.input.gamepadShoot = false;
      this.input.gamepadFocus = false;
      this.input.gamepadBomb = false;
      return;
    }
    this.input.gamepadShoot = Boolean(pad.buttons[0]?.pressed);
    this.input.gamepadFocus = Boolean(pad.buttons[1]?.pressed);
    this.input.gamepadBomb = Boolean(pad.buttons[3]?.pressed);
    const active =
      Math.abs(pad.axes[0] ?? 0) > 0.15 ||
      Math.abs(pad.axes[1] ?? 0) > 0.15 ||
      pad.buttons.some((button) => button.pressed);
    if (active) this.inputMode = 'gamepad';
    if (this.input.gamepadBomb && this.energy >= 100) this.activateBomb();
    const startDown = Boolean(pad.buttons[9]?.pressed);
    if (startDown && !this.gamepadStartWasDown && this.active) this.onPause();
    this.gamepadStartWasDown = startDown;
  }

  private gamepadAxis(index: number): number {
    if (!('getGamepads' in navigator)) return 0;
    const pad = navigator.getGamepads().find((gamepad) => gamepad?.connected) ?? null;
    if (!pad) return 0;
    const analog = pad.axes[index] ?? 0;
    const digital =
      index === 0
        ? (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0)
        : (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
    return Math.abs(analog) > 0.16 ? analog : digital;
  }

  private createStars(): void {
    this.stars = Array.from({ length: 116 }, (_, index) => ({
      x: ((index * 137.5) % W + Math.random() * 18) % W,
      y: ((index * 89.7) % H + Math.random() * 20) % H,
      depth: 0.25 + Math.random() * 1.8,
      size: Math.random() > 0.88 ? 2 : 1,
      twinkle: Math.random() * TAU,
    }));
  }

  private publish(): void {
    const phase = this.wave === 3 ? this.bossPhase : 0;
    this.snapshot = {
      ...this.snapshot,
      score: Math.floor(this.score),
      bestScore: Math.max(this.snapshot.bestScore, loadBestScore()),
      lives: this.lives,
      energy: Math.min(100, Math.floor(this.energy)),
      combo: this.combo,
      wave: Math.min(4, this.wave + 1),
      waveName: this.wave < 3 ? WAVE_NAMES[this.wave] ?? WAVE_NAMES[2]! : 'Aetherion Dreadnought',
      bossPhase: phase,
      bossHealth: Math.floor(this.bossHealth),
      bossMaxHealth: this.wave === 3 && this.bossPhase > 0 ? this.bossMaxHealth : 0,
      enemiesDestroyed: this.enemiesDestroyed,
      grazes: this.grazes,
      highestCombo: this.highestCombo,
      bombsUsed: this.bombsUsed,
      livesLost: this.livesLost,
      canContinue: this.snapshot.status === 'playing' || Boolean(loadSavedRun()),
      inputMode: this.inputMode,
    };
    this.onState({ ...this.snapshot });
  }

  private saveCurrentRun(): void {
    if (this.snapshot.status !== 'playing') return;
    const data: SavedRun = {
      version: 1,
      score: this.score,
      lives: this.lives,
      energy: this.energy,
      combo: this.combo,
      highestCombo: this.highestCombo,
      enemiesDestroyed: this.enemiesDestroyed,
      grazes: this.grazes,
      bombsUsed: this.bombsUsed,
      livesLost: this.livesLost,
      wave: Math.min(4, this.wave + 1),
      waveTime: this.waveTime,
      bossHealth: this.bossHealth,
      bossPhase: this.bossPhase,
      playerX: this.player.x,
      playerY: this.player.y,
      elapsed: this.elapsed,
    };
    saveRun(data);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && this.active) {
      event.preventDefault();
      this.onPause();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      if (this.active) event.preventDefault();
    }
    if (event.code === 'KeyX' && !event.repeat) this.activateBomb();
    this.input.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.input.keys.delete(event.code);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.canvas || event.pointerType === 'touch') return;
    const rect = this.canvas.getBoundingClientRect();
    this.input.mouseX = ((event.clientX - rect.left) / rect.width) * W;
    this.input.mouseY = ((event.clientY - rect.top) / rect.height) * H;
    this.input.mouseSeen = true;
    this.mouseIdle = 0.7;
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    this.audio.unlock();
    if (event.button === 0) this.input.mouseShoot = true;
    if (event.button === 2) this.input.mouseFocus = true;
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    if (event.button === 0 || event.type === 'pointerleave') this.input.mouseShoot = false;
    if (event.button === 2 || event.type === 'pointerleave') this.input.mouseFocus = false;
  };

  private onContextMenu = (event: Event): void => event.preventDefault();
  private onWindowBlur = (): void => {
    this.input.keys.clear();
    this.input.mouseShoot = false;
    this.input.mouseFocus = false;
  };

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    }
    this.drawBackground(ctx);
    if (this.snapshot.status === 'playing') {
      this.drawItems(ctx);
      this.drawEnemies(ctx);
      this.drawBullets(ctx);
      this.drawShots(ctx);
      this.drawPlayer(ctx);
      if (this.wave === 3) this.drawDreadnought(ctx);
    } else {
      this.drawAttractShip(ctx);
    }
    this.drawParticles(ctx);
    this.drawTexts(ctx);
    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(121, 230, 255, ${Math.min(0.32, this.bombFlash * 0.48)})`;
      ctx.fillRect(-5, -5, W + 10, H + 10);
      ctx.strokeStyle = 'rgba(189, 169, 255, 0.45)';
      ctx.lineWidth = 2;
      const radius = (0.62 - this.bombFlash) * 1120;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.56, Math.max(0, radius), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#08091b';
    ctx.fillRect(0, 0, W, H);
    const cloud = ctx.createRadialGradient(W * 0.5, H * 0.27, 5, W * 0.5, H * 0.27, 310);
    cloud.addColorStop(0, 'rgba(88, 48, 134, 0.32)');
    cloud.addColorStop(0.42, 'rgba(48, 38, 100, 0.18)');
    cloud.addColorStop(1, 'rgba(10, 12, 38, 0)');
    ctx.fillStyle = cloud;
    ctx.fillRect(0, 0, W, H * 0.75);
    const lower = ctx.createRadialGradient(W * 0.8, H * 0.74, 2, W * 0.8, H * 0.74, 230);
    lower.addColorStop(0, 'rgba(16, 100, 137, 0.12)');
    lower.addColorStop(1, 'rgba(10, 12, 38, 0)');
    ctx.fillStyle = lower;
    ctx.fillRect(0, 0, W, H);

    for (const star of this.stars) {
      const alpha = 0.34 + (Math.sin(star.twinkle) + 1) * 0.26;
      ctx.fillStyle = `rgba(${star.depth > 1.3 ? '133, 224, 246' : '189, 186, 238'}, ${alpha})`;
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
      if (star.depth > 1.55) {
        ctx.fillStyle = `rgba(93, 209, 242, ${alpha * 0.18})`;
        ctx.fillRect(Math.floor(star.x - 1), Math.floor(star.y + 2), 1, 6);
      }
    }
    this.drawGate(ctx);
    ctx.strokeStyle = 'rgba(65, 104, 160, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(22, H);
    ctx.moveTo(W - 22, 0);
    ctx.lineTo(W - 22, H);
    ctx.stroke();
  }

  private drawGate(ctx: CanvasRenderingContext2D): void {
    const x = W / 2;
    const y = 178;
    const rotation = this.elapsed * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.strokeStyle = 'rgba(84, 209, 242, 0.26)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 164, 59, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(171, 129, 245, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 143, 48, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([3, 12]);
    ctx.strokeStyle = 'rgba(229, 190, 132, 0.31)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 177, 66, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-rotation * 1.7);
    ctx.strokeStyle = 'rgba(78, 181, 223, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 121, 39, 0, 0, TAU);
    ctx.stroke();
    const portal = ctx.createRadialGradient(0, 0, 4, 0, 0, 99);
    portal.addColorStop(0, 'rgba(27, 64, 130, 0.06)');
    portal.addColorStop(0.62, 'rgba(68, 60, 163, 0.1)');
    portal.addColorStop(1, 'rgba(87, 205, 255, 0)');
    ctx.fillStyle = portal;
    ctx.beginPath();
    ctx.ellipse(0, 0, 113, 34, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * TAU;
      const px = Math.cos(a) * 166;
      const py = Math.sin(a) * 59;
      ctx.fillStyle = i % 4 === 0 ? '#e7ba7a' : '#52cde9';
      ctx.fillRect(Math.floor(px - 3), Math.floor(py - 3), 6, 6);
    }
    ctx.restore();
  }

  private drawAttractShip(ctx: CanvasRenderingContext2D): void {
    const x = W / 2 + Math.sin(this.elapsed * 0.46) * 38;
    const y = H * 0.69 + Math.sin(this.elapsed * 1.1) * 7;
    this.drawShip(ctx, x, y, 1.25, this.elapsed, false, false);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    if (p.invulnerable > 0 && Math.floor(this.elapsed * 12) % 2 === 0) return;
    if (p.damageFlash > 0 && !this.settings.reducedFlashing) {
      ctx.globalAlpha = 0.6 + Math.random() * 0.4;
    }
    this.drawShip(ctx, p.x, p.y, 1, this.elapsed, p.focus, p.focus);
    ctx.globalAlpha = 1;
  }

  private drawShip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    time: number,
    focused: boolean,
    showHitbox: boolean,
  ): void {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    ctx.scale(scale, scale);
    const flame = 9 + Math.sin(time * 24) * 3;
    ctx.fillStyle = 'rgba(63, 213, 238, 0.25)';
    ctx.fillRect(-9, 14, 18, flame + 5);
    ctx.fillStyle = '#ffa75d';
    ctx.fillRect(-3, 14, 6, flame);
    ctx.fillStyle = '#eafcff';
    ctx.fillRect(-2, 15, 4, flame - 3);
    ctx.fillStyle = '#203e69';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(18, 12);
    ctx.lineTo(9, 18);
    ctx.lineTo(0, 11);
    ctx.lineTo(-9, 18);
    ctx.lineTo(-18, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#62eefa';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(7, 10);
    ctx.lineTo(0, 14);
    ctx.lineTo(-7, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d6ffff';
    ctx.fillRect(-2, -11, 4, 15);
    ctx.fillStyle = '#a780e8';
    ctx.fillRect(-16, 9, 7, 4);
    ctx.fillRect(9, 9, 7, 4);
    if (focused) {
      ctx.strokeStyle = 'rgba(143, 250, 255, 0.72)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-14, 1);
      ctx.lineTo(-10, 1);
      ctx.moveTo(14, 1);
      ctx.lineTo(10, 1);
      ctx.stroke();
    }
    if (showHitbox) {
      ctx.strokeStyle = '#fff7cc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 2, PLAYER_HIT_RADIUS, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#fff9df';
      ctx.fillRect(-1, 1, 2, 2);
    }
    ctx.restore();
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    for (const enemy of this.enemies) {
      ctx.save();
      ctx.translate(Math.floor(enemy.x), Math.floor(enemy.y));
      const damaged = enemy.hp / enemy.maxHp < 0.38;
      const glow = enemy.type === 'heavy' || enemy.type === 'elite' ? '#ffb26a' : '#d178bb';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = damaged ? '#633450' : '#382748';
      if (enemy.type === 'scout') {
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(14, -3);
        ctx.lineTo(6, -9);
        ctx.lineTo(0, -4);
        ctx.lineTo(-6, -9);
        ctx.lineTo(-14, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffb767';
        ctx.fillRect(-2, 0, 4, 6);
      } else if (enemy.type === 'fighter') {
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(19, -7);
        ctx.lineTo(9, -5);
        ctx.lineTo(0, -12);
        ctx.lineTo(-9, -5);
        ctx.lineTo(-19, -7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d18de9';
        ctx.fillRect(-4, -5, 8, 9);
        ctx.fillStyle = '#ffbf75';
        ctx.fillRect(-2, 7, 4, 4);
      } else if (enemy.type === 'heavy') {
        ctx.fillRect(-23, -12, 46, 23);
        ctx.fillStyle = '#9b668c';
        ctx.fillRect(-29, -7, 10, 15);
        ctx.fillRect(19, -7, 10, 15);
        ctx.fillStyle = '#ffb567';
        ctx.fillRect(-5, -7, 10, 12);
        ctx.fillStyle = '#241b3d';
        ctx.fillRect(-17, -3, 6, 6);
        ctx.fillRect(11, -3, 6, 6);
      } else if (enemy.type === 'interceptor') {
        ctx.beginPath();
        ctx.moveTo(0, 17);
        ctx.lineTo(11, -1);
        ctx.lineTo(27, -13);
        ctx.lineTo(15, -12);
        ctx.lineTo(0, -5);
        ctx.lineTo(-15, -12);
        ctx.lineTo(-27, -13);
        ctx.lineTo(-11, -1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffa957';
        ctx.fillRect(-2, 1, 4, 8);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, 17);
        ctx.lineTo(24, 4);
        ctx.lineTo(18, -14);
        ctx.lineTo(7, -10);
        ctx.lineTo(0, -18);
        ctx.lineTo(-7, -10);
        ctx.lineTo(-18, -14);
        ctx.lineTo(-24, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffce80';
        ctx.fillRect(-5, -4, 10, 10);
        ctx.fillStyle = '#31234b';
        ctx.fillRect(-2, -2, 4, 6);
      }
      ctx.shadowBlur = 0;
      if (enemy.hp < enemy.maxHp) {
        ctx.fillStyle = 'rgba(4, 8, 22, 0.8)';
        ctx.fillRect(-16, -23, 32, 3);
        ctx.fillStyle = '#61edeb';
        ctx.fillRect(-16, -23, Math.max(0, 32 * enemy.hp / enemy.maxHp), 3);
      }
      ctx.restore();
    }
  }

  private drawDreadnought(ctx: CanvasRenderingContext2D): void {
    if (this.bossHealth <= 0) return;
    const x = W / 2 + Math.sin(this.bossAge * 0.55) * 83;
    const y = 133 + Math.sin(this.bossAge * 0.33) * 12;
    const phase = this.bossPhase;
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    ctx.shadowColor = phase === 3 ? '#ff765f' : '#a867ed';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#181c36';
    ctx.beginPath();
    ctx.moveTo(0, -55);
    ctx.lineTo(42, -33);
    ctx.lineTo(139, -28);
    ctx.lineTo(113, -3);
    ctx.lineTo(100, 30);
    ctx.lineTo(47, 34);
    ctx.lineTo(21, 51);
    ctx.lineTo(0, 38);
    ctx.lineTo(-21, 51);
    ctx.lineTo(-47, 34);
    ctx.lineTo(-100, 30);
    ctx.lineTo(-113, -3);
    ctx.lineTo(-139, -28);
    ctx.lineTo(-42, -33);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = phase === 3 ? '#7d3648' : '#363759';
    ctx.fillRect(-124, -18, 45, 13);
    ctx.fillRect(79, -18, 45, 13);
    ctx.fillStyle = '#755883';
    ctx.fillRect(-75, -25, 150, 37);
    ctx.fillStyle = '#202442';
    ctx.fillRect(-46, -43, 92, 20);
    ctx.fillStyle = '#ffbb72';
    ctx.fillRect(-72, -7, 14, 11);
    ctx.fillRect(58, -7, 14, 11);
    const glow = phase === 3 ? '#ff815c' : phase === 2 ? '#c09cff' : '#64f5ff';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14 + Math.sin(this.bossAge * 5) * 3;
    ctx.fillStyle = glow;
    ctx.fillRect(-9, -16, 18, 22);
    ctx.fillStyle = '#efffff';
    ctx.fillRect(-3, -10, 6, 11);
    ctx.shadowBlur = 0;
    ctx.fillStyle = phase === 3 ? '#ffc27d' : '#6adcf0';
    for (let i = -2; i <= 2; i += 1) {
      ctx.fillRect(i * 24 - 4, 22, 8, 6);
    }
    if (phase > 1) {
      ctx.strokeStyle = phase === 3 ? 'rgba(255, 117, 94, 0.7)' : 'rgba(160, 151, 255, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 62 + Math.sin(this.bossAge * 2) * 4, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBullets(ctx: CanvasRenderingContext2D): void {
    for (const bullet of this.bullets) {
      ctx.save();
      ctx.translate(Math.floor(bullet.x), Math.floor(bullet.y));
      ctx.shadowColor = bullet.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = bullet.color;
      if (bullet.shape === 'needle') {
        ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(4, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-4, 0);
        ctx.closePath();
        ctx.fill();
      } else if (bullet.shape === 'diamond') {
        ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
        ctx.fillRect(-4, -6, 8, 12);
        ctx.fillStyle = '#fff0c2';
        ctx.fillRect(-1, -3, 2, 6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, bullet.radius, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff1ce';
        ctx.fillRect(-1, -2, 2, 4);
      }
      ctx.restore();
    }
  }

  private drawShots(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowColor = '#64f8ff';
    ctx.shadowBlur = 10;
    for (const shot of this.shots) {
      ctx.fillStyle = '#d7ffff';
      ctx.fillRect(Math.floor(shot.x - 2), Math.floor(shot.y - 8), 4, 13);
      ctx.fillStyle = '#45dbe9';
      ctx.fillRect(Math.floor(shot.x - 1), Math.floor(shot.y), 2, 8);
    }
    ctx.restore();
  }

  private drawItems(ctx: CanvasRenderingContext2D): void {
    for (const item of this.items) {
      const pulse = Math.sin(this.elapsed * 9 + item.x) * 1.4;
      ctx.save();
      ctx.translate(Math.floor(item.x), Math.floor(item.y));
      ctx.shadowColor = '#ffd57c';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffc76c';
      ctx.beginPath();
      ctx.moveTo(0, -7 - pulse);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7 + pulse);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c6';
      ctx.fillRect(-1, -3, 2, 6);
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.max(1, p.radius), Math.max(1, p.radius));
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const text of this.texts) {
      ctx.globalAlpha = Math.min(1, text.life * 1.5);
      ctx.fillStyle = text.color;
      ctx.font = 'bold 11px monospace';
      ctx.shadowColor = text.color;
      ctx.shadowBlur = 8;
      ctx.fillText(text.text, Math.floor(text.x), Math.floor(text.y));
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
}

function distanceSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}
