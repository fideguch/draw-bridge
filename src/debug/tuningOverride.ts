/**
 * tuningOverride — dev-only runtime tuning override registry (T083, FR-025).
 *
 * MECHANISM. TuningConstants exports plain, NON-frozen object literals
 * (`export const physics = { ... }`) and every consumer reads them by direct
 * property access on the shared module binding. ES module bindings are the same
 * object reference in every importer, so mutating a property in place —
 * `physics.subStepCount = 6` — is observed by every consumer that reads that
 * property AT CALL TIME. This is the sanctioned override path: SpikeScenario's
 * applyTuningOverrides/restoreTuning already rely on it, and the TuningConstants
 * header calls out that "the debug tuning panel live-edits these at runtime".
 *
 * We therefore do NOT (and cannot) "swap module exports" — an importer's binding
 * is read-only from the outside — nor do we modify TuningConstants.ts. We mutate
 * the existing group objects and snapshot their authored values at module load
 * so any change is reversible per-field / per-group / globally.
 *
 * LIVE vs RESTART-TO-APPLY. Whether a change takes effect immediately depends on
 * WHERE the constant is read:
 *   - LIVE:    read every tick/frame/event — camera follow & trauma (CameraDirector
 *              per frame), goal celebration params (read at the goal event), ink
 *              warn ratios (InkBar per update), physics.subStepCount (World.step
 *              passes it every tick).
 *   - RESTART: captured when bodies are built — bridge chain params & breakForce
 *              (BridgeChainBuilder + StressTracker at commit), vehicle motor /
 *              friction / suspension (Vehicle & Terrain constructors),
 *              physics.gravityY (World constructor). These apply on the NEXT
 *              attempt/testplay (a fresh GameSimulation or reset()).
 * Each field below is tagged accordingly; the panel labels its slider to match.
 *
 * Dev-only: reached exclusively through the TuningPanel, which the composition
 * root attaches under an import.meta.env.DEV dynamic import (tree-shaken from
 * release). This module never runs in production.
 */

import { bridge, camera, car, goal, ink, physics } from '@tuning/TuningConstants';

export type TuningGroupName = 'physics' | 'bridge' | 'car' | 'camera' | 'goal' | 'ink';

export type ApplyMode = 'live' | 'restart';

export interface TunableField {
  readonly group: TuningGroupName;
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  /** 'live' = takes effect immediately; 'restart' = applies on next attempt. */
  readonly apply: ApplyMode;
  /** Quantization step (integer-ish sliders); omitted = continuous. */
  readonly step?: number;
}

/** The mutable group objects, keyed by name (same references TuningConstants exports). */
const GROUPS: Record<TuningGroupName, Record<string, number>> = {
  physics: physics as unknown as Record<string, number>,
  bridge: bridge as unknown as Record<string, number>,
  car: car as unknown as Record<string, number>,
  camera: camera as unknown as Record<string, number>,
  goal: goal as unknown as Record<string, number>,
  ink: ink as unknown as Record<string, number>,
};

/**
 * Curated tunables (FR-025 main flow §2-4). Grouped physics/bridge/car (mostly
 * RESTART — bodies capture them at build) and camera/goal/ink (LIVE — read every
 * frame/event). Ranges come from the per-field comments in TuningConstants.
 */
export const TUNABLE_FIELDS: readonly TunableField[] = [
  // physics
  { group: 'physics', key: 'subStepCount', label: 'sub-steps', min: 4, max: 8, step: 1, apply: 'live' },
  { group: 'physics', key: 'gravityY', label: 'gravity Y', min: -20, max: -4, apply: 'restart' },
  // bridge (rebuilt on commit)
  { group: 'bridge', key: 'jointHertz', label: 'joint hertz', min: 4, max: 8, apply: 'restart' },
  { group: 'bridge', key: 'jointDampingRatio', label: 'joint damping', min: 0.6, max: 0.8, apply: 'restart' },
  { group: 'bridge', key: 'jointAngleLimitRad', label: 'angle limit (rad)', min: 0.2, max: 0.4, apply: 'restart' },
  { group: 'bridge', key: 'breakForceFactor', label: 'break force ×load', min: 2, max: 15, apply: 'restart' },
  { group: 'bridge', key: 'strokeMassToCarRatio', label: 'chain mass ratio', min: 0.3, max: 1.0, apply: 'restart' },
  // car (built at construction)
  { group: 'car', key: 'motorSpeedBase', label: 'motor speed', min: 8, max: 24, apply: 'restart' },
  { group: 'car', key: 'maxMotorTorque', label: 'motor torque', min: 20, max: 200, apply: 'restart' },
  { group: 'car', key: 'tireFriction', label: 'tire friction', min: 0.8, max: 1.2, apply: 'restart' },
  { group: 'car', key: 'surfaceFriction', label: 'surface friction', min: 0.6, max: 0.9, apply: 'restart' },
  { group: 'car', key: 'suspensionHertz', label: 'suspension hertz', min: 3, max: 6, apply: 'restart' },
  { group: 'car', key: 'suspensionDampingRatio', label: 'suspension damping', min: 0.5, max: 0.9, apply: 'restart' },
  // camera (read per frame)
  { group: 'camera', key: 'followLerp', label: 'follow lerp', min: 0.08, max: 0.15, apply: 'live' },
  { group: 'camera', key: 'lookAheadCarLengths', label: 'look-ahead', min: 1, max: 2, apply: 'live' },
  { group: 'camera', key: 'traumaLaunch', label: 'trauma launch', min: 0, max: 0.5, apply: 'live' },
  { group: 'camera', key: 'traumaCrash', label: 'trauma crash', min: 0, max: 1, apply: 'live' },
  { group: 'camera', key: 'shakeMaxOffsetPx', label: 'shake offset px', min: 16, max: 30, apply: 'live' },
  // goal celebration (read at the goal event)
  { group: 'goal', key: 'hitStopMs', label: 'hit-stop ms', min: 80, max: 120, apply: 'live' },
  { group: 'goal', key: 'slowTimeScale', label: 'slow-mo scale', min: 0.1, max: 0.6, apply: 'live' },
  { group: 'goal', key: 'confettiCannonCount', label: 'confetti cannon', min: 40, max: 60, step: 1, apply: 'live' },
  { group: 'goal', key: 'confettiRainCount', label: 'confetti rain', min: 60, max: 100, step: 1, apply: 'live' },
  // ink bar (read per update)
  { group: 'ink', key: 'warnYellowRatio', label: 'warn yellow @', min: 0.3, max: 0.7, apply: 'live' },
  { group: 'ink', key: 'warnRedRatio', label: 'warn red @', min: 0.1, max: 0.3, apply: 'live' },
];

/** Authored defaults captured once at module load (before any override). */
const DEFAULTS: Record<string, number> = captureDefaults();

function fieldId(group: TuningGroupName, key: string): string {
  return `${group}.${key}`;
}

function captureDefaults(): Record<string, number> {
  const defaults: Record<string, number> = {};
  for (const field of TUNABLE_FIELDS) {
    defaults[fieldId(field.group, field.key)] = GROUPS[field.group][field.key] as number;
  }
  return defaults;
}

/** Current live value of a tunable (reads the shared TuningConstants object). */
export function getTuning(group: TuningGroupName, key: string): number {
  return GROUPS[group][key] as number;
}

/** Authored default of a tunable (its value at module load). */
export function defaultOf(group: TuningGroupName, key: string): number {
  return DEFAULTS[fieldId(group, key)] as number;
}

/** Override a tunable in place — observed live by any call-time reader. */
export function setTuning(group: TuningGroupName, key: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`tuningOverride.setTuning: value must be finite (got ${value})`);
  }
  GROUPS[group][key] = value;
}

/** Restore one tunable to its authored default. */
export function resetField(group: TuningGroupName, key: string): void {
  GROUPS[group][key] = defaultOf(group, key);
}

/** Restore every tunable in a group to its authored default. */
export function resetGroup(group: TuningGroupName): void {
  for (const field of TUNABLE_FIELDS) {
    if (field.group === group) {
      resetField(field.group, field.key);
    }
  }
}

/** Restore all registered tunables to their authored defaults. */
export function resetAll(): void {
  for (const field of TUNABLE_FIELDS) {
    resetField(field.group, field.key);
  }
}

/** Registered fields belonging to a group, in declaration order. */
export function fieldsForGroup(group: TuningGroupName): readonly TunableField[] {
  return TUNABLE_FIELDS.filter((field) => field.group === group);
}

/** Distinct group names in declaration order. */
export function tuningGroupNames(): readonly TuningGroupName[] {
  const seen: TuningGroupName[] = [];
  for (const field of TUNABLE_FIELDS) {
    if (!seen.includes(field.group)) {
      seen.push(field.group);
    }
  }
  return seen;
}
