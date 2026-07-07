/**
 * Dev-build E2E/gatekeeper hook (window.__inkbridge).
 * Contract: .fable/playscene-composition-spec.md §E2E + tests/e2e/l1-clear.spec.ts.
 * Installed ONLY from the dev composition root (import.meta.env.DEV guard at
 * the call site) — production builds tree-shake this module away.
 *
 * The game renders to a canvas (no DOM buttons), so E2E resolves tap targets
 * through buttonRect(id) and drives real pointer events at page coordinates.
 */
import type Phaser from 'phaser';

export interface DevHookPlayState {
  state: 'drawing' | 'anticipation' | 'running' | 'result' | null;
  tick: number;
  outcome: 'clear' | 'fail' | null;
}

export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InkbridgeHook {
  readonly scene: string;
  readonly state: DevHookPlayState['state'];
  readonly tick: number;
  readonly outcome: DevHookPlayState['outcome'];
  /** True once the clear overlay's Next button is active (tempo contract, T093). */
  readonly resultNextReady: boolean;
  /** Raw accepted stroke-point count while drawing (input-latency probe, NFR-002). */
  readonly strokePointCount: number;
  worldToScreen(x: number, y: number): { x: number; y: number };
  buttonRect(id: string): PageRect | null;
}

type GameRectGetter = () => { x: number; y: number; width: number; height: number };
type WorldToScreenFn = (x: number, y: number) => { x: number; y: number };

const buttonRegistry = new Map<string, GameRectGetter>();
const playState: DevHookPlayState = { state: null, tick: 0, outcome: null };
let worldToScreenFn: WorldToScreenFn | null = null;
let gameRef: Phaser.Game | null = null;
let isResultNextReady = false;
let strokePointCountValue = 0;

/** Register a tappable target under a stable id; auto-cleans on scene shutdown. */
export function registerDevButton(id: string, scene: Phaser.Scene, getGameRect: GameRectGetter): void {
  buttonRegistry.set(id, getGameRect);
  scene.events.once('shutdown', () => {
    // Only remove if not re-registered by a newer scene instance.
    if (buttonRegistry.get(id) === getGameRect) buttonRegistry.delete(id);
  });
}

/** PlayScene publishes its state machine here every frame. */
export function setDevPlayState(next: Partial<DevHookPlayState>): void {
  Object.assign(playState, next);
}

/** PlayScene registers its camera-aware world->GAME-coordinate transform. */
export function setWorldToGame(fn: WorldToScreenFn | null): void {
  worldToScreenFn = fn;
}

/** GoalSequence flips this true when the clear overlay's Next button activates. */
export function setDevResultNextReady(ready: boolean): void {
  isResultNextReady = ready;
}

/** PlayScene publishes the raw accepted stroke-point count while drawing. */
export function setDevStrokePointCount(count: number): void {
  strokePointCountValue = count;
}

function gameToPage(gx: number, gy: number): { x: number; y: number } {
  if (!gameRef) throw new Error('dev hook not installed');
  const bounds = gameRef.canvas.getBoundingClientRect();
  const scaleX = bounds.width / gameRef.scale.gameSize.width;
  const scaleY = bounds.height / gameRef.scale.gameSize.height;
  return { x: bounds.left + gx * scaleX, y: bounds.top + gy * scaleY };
}

export function installDevHook(game: Phaser.Game): void {
  gameRef = game;
  const hook: InkbridgeHook = {
    get scene(): string {
      const active = game.scene.getScenes(true);
      const top = active[active.length - 1];
      return top ? top.scene.key : '';
    },
    get state() {
      return playState.state;
    },
    get tick() {
      return playState.tick;
    },
    get outcome() {
      return playState.outcome;
    },
    get resultNextReady() {
      return isResultNextReady;
    },
    get strokePointCount() {
      return strokePointCountValue;
    },
    worldToScreen(x: number, y: number): { x: number; y: number } {
      if (!worldToScreenFn) throw new Error('worldToScreen not registered (PlayScene not active)');
      const gamePoint = worldToScreenFn(x, y);
      return gameToPage(gamePoint.x, gamePoint.y);
    },
    buttonRect(id: string): PageRect | null {
      const getter = buttonRegistry.get(id);
      if (!getter) return null;
      const rect = getter();
      const topLeft = gameToPage(rect.x, rect.y);
      const bottomRight = gameToPage(rect.x + rect.width, rect.y + rect.height);
      return {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (window as Window & { __inkbridge?: InkbridgeHook }).__inkbridge = hook;
}
