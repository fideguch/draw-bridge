import { describe, expect, it } from 'vitest';
import type { StorageInterface } from '@platform/interfaces';
import { MemoryStorage } from '@platform/noop';
import { SaveManager } from '@meta/SaveManager';
import {
  CURRENT_SCHEMA_VERSION,
  initialSaveData,
  STORAGE_KEY_MAIN,
  STORAGE_KEY_TMP,
} from '@meta/SaveData';
import type { CorruptionReport } from '@meta/SaveData';

/** A StorageInterface that records call order and can inject faults per op/key. */
class RecordingStorage implements StorageInterface {
  readonly calls: string[] = [];
  failOn?: (op: 'get' | 'set' | 'remove', key: string) => boolean;
  private readonly map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    this.calls.push(`get:${key}`);
    if (this.failOn?.('get', key)) throw new Error(`inject get ${key}`);
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.calls.push(`set:${key}`);
    if (this.failOn?.('set', key)) throw new Error(`inject set ${key}`);
    this.map.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.calls.push(`remove:${key}`);
    if (this.failOn?.('remove', key)) throw new Error(`inject remove ${key}`);
    this.map.delete(key);
  }

  seed(key: string, value: string): void {
    this.map.set(key, value);
  }

  raw(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
}

function goodSave(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    coins: 120,
    upgrades: { inkCapacityLv: 1, engineSpeedLv: 0 },
    progress: { 'ch1-l01': { bestStars: 3, cleared: true } },
    settings: { sound: true, haptics: true },
    ...overrides,
  });
}

describe('SaveManager — atomic tmp-swap write protocol (save-data.md §2)', () => {
  it('writes via set(tmp) -> verify -> set(main) -> remove(tmp)', async () => {
    const storage = new RecordingStorage();
    const manager = new SaveManager(storage);
    await manager.load(); // fresh install -> no write on boot
    storage.calls.length = 0;

    const result = await manager.save('levelEnd');

    expect(result.persisted).toBe(true);
    expect(storage.calls).toEqual([
      `set:${STORAGE_KEY_TMP}`,
      `get:${STORAGE_KEY_TMP}`,
      `set:${STORAGE_KEY_MAIN}`,
      `remove:${STORAGE_KEY_TMP}`,
    ]);
  });

  it('aborts and keeps the last good main when the main write rejects', async () => {
    const storage = new RecordingStorage();
    storage.seed(STORAGE_KEY_MAIN, goodSave({ coins: 100 }));
    const manager = new SaveManager(storage);
    await manager.load();

    storage.failOn = (op, key) => op === 'set' && key === STORAGE_KEY_MAIN;
    manager.mutate((data) => ({ ...data, coins: 999 }));
    const result = await manager.save('purchase');

    expect(result.persisted).toBe(false);
    // last good data survives on disk...
    expect(JSON.parse(storage.raw(STORAGE_KEY_MAIN) as string).coins).toBe(100);
    // ...while in-memory state remains authoritative (retried next trigger).
    expect(manager.getData().coins).toBe(999);
  });

  it('rejects a save that violates the coins >= 0 invariant (programming error)', async () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    await manager.load();
    manager.mutate((data) => ({ ...data, coins: -5 }));
    await expect(manager.save('levelEnd')).rejects.toThrow(/coins|invariant/i);
  });
});

describe('SaveManager — schemaVersion forward migration (save-data.md §3)', () => {
  it('migrates a v0 save to current and preserves unknown fields verbatim', async () => {
    const storage = new MemoryStorage();
    await storage.set(
      STORAGE_KEY_MAIN,
      JSON.stringify({
        // no schemaVersion => treated as legacy v0
        coins: 40,
        upgrades: { inkCapacityLv: 2, engineSpeedLv: 1 },
        progress: { 'ch1-l01': { bestStars: 2, cleared: true } },
        settings: { sound: false, haptics: true },
        experimentalFlag: 'keep-me',
      }),
    );
    const manager = new SaveManager(storage);
    const result = await manager.load();

    expect(result.source).toBe('main');
    const data = manager.getData();
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.coins).toBe(40);
    expect(data.upgrades.inkCapacityLv).toBe(2);
    expect(data.experimentalFlag).toBe('keep-me');

    // unknown field + bumped version survive a save round-trip
    await manager.save('settingsChange');
    const reread = JSON.parse((await storage.get(STORAGE_KEY_MAIN)) as string);
    expect(reread.experimentalFlag).toBe('keep-me');
    expect(reread.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe('SaveManager — corruption partial restore (save-data.md §4)', () => {
  it('keeps paid upgrades when coins are unreadable (priority: upgrades+coins)', async () => {
    const storage = new MemoryStorage();
    await storage.set(
      STORAGE_KEY_MAIN,
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        coins: 'oops',
        upgrades: { inkCapacityLv: 3, engineSpeedLv: 2 },
        progress: { 'ch1-l01': { bestStars: 1, cleared: true } },
        settings: { sound: true, haptics: false },
      }),
    );
    const manager = new SaveManager(storage);
    const result = await manager.load();

    expect(result.corruption).not.toBeNull();
    const data = manager.getData();
    expect(data.upgrades).toEqual({ inkCapacityLv: 3, engineSpeedLv: 2 });
    expect(data.coins).toBe(0); // unreadable subtree -> initial
    expect(data.progress['ch1-l01']).toEqual({ bestStars: 1, cleared: true });
    expect(data.settings).toEqual({ sound: true, haptics: false });
    // salvaged state committed as clean JSON
    expect(JSON.parse((await storage.get(STORAGE_KEY_MAIN)) as string).coins).toBe(0);
  });

  it('resets unreadable progress while keeping coins/upgrades/settings', async () => {
    const storage = new MemoryStorage();
    await storage.set(
      STORAGE_KEY_MAIN,
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        coins: 75,
        upgrades: { inkCapacityLv: 1, engineSpeedLv: 0 },
        progress: 42,
        settings: { sound: true, haptics: true },
      }),
    );
    const manager = new SaveManager(storage);
    const result = await manager.load();

    const data = manager.getData();
    expect(data.coins).toBe(75);
    expect(data.progress).toEqual({});
    expect(result.corruption?.progressReset).toBe(true);
  });

  it('salvages every subtree from a newer-than-app version', async () => {
    const storage = new MemoryStorage();
    await storage.set(
      STORAGE_KEY_MAIN,
      JSON.stringify({
        schemaVersion: 99,
        coins: 200,
        upgrades: { inkCapacityLv: 5, engineSpeedLv: 4 },
        progress: { 'ch1-l05': { bestStars: 3, cleared: true } },
        settings: { sound: false, haptics: false },
      }),
    );
    const manager = new SaveManager(storage);
    const result = await manager.load();

    expect(result.corruption).not.toBeNull();
    const data = manager.getData();
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.coins).toBe(200);
    expect(data.upgrades).toEqual({ inkCapacityLv: 5, engineSpeedLv: 4 });
    expect(data.progress['ch1-l05']).toEqual({ bestStars: 3, cleared: true });
    expect(data.settings).toEqual({ sound: false, haptics: false });
  });

  it('resets to fresh WITH a user notification when nothing is salvageable', async () => {
    const storage = new MemoryStorage();
    await storage.set(STORAGE_KEY_MAIN, '{ this is not valid json');
    let notified: CorruptionReport | null = null;
    const manager = new SaveManager(storage, {
      onCorruption: (report) => {
        notified = report;
      },
    });
    const result = await manager.load();

    expect(result.source).toBe('fresh');
    expect(result.corruption?.fullReset).toBe(true);
    expect(result.corruption?.needsUserNotification).toBe(true);
    expect(notified).not.toBeNull();
    expect(manager.getData()).toEqual(initialSaveData());
  });
});

describe('SaveManager — crash-window recovery (save-data.md §2 load sequence)', () => {
  it('recovers from tmp when main is missing, then promotes tmp -> main', async () => {
    const storage = new MemoryStorage();
    await storage.set(STORAGE_KEY_TMP, goodSave({ coins: 333 }));
    const manager = new SaveManager(storage);
    const result = await manager.load();

    expect(result.source).toBe('tmp');
    expect(manager.getData().coins).toBe(333);
    expect(JSON.parse((await storage.get(STORAGE_KEY_MAIN)) as string).coins).toBe(333);
    expect(await storage.get(STORAGE_KEY_TMP)).toBeNull();
  });

  it('prefers a valid main over a stale tmp leftover', async () => {
    const storage = new MemoryStorage();
    await storage.set(STORAGE_KEY_MAIN, goodSave({ coins: 500 }));
    await storage.set(STORAGE_KEY_TMP, goodSave({ coins: 999 }));
    const manager = new SaveManager(storage);
    const result = await manager.load();

    expect(result.source).toBe('main');
    expect(manager.getData().coins).toBe(500);
  });
});

describe('SaveManager — triggers & progress reset (save-data.md §5, FR-020)', () => {
  it('exposes the three documented save triggers', async () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    await manager.load();

    await expect(manager.saveOnLevelEnd()).resolves.toMatchObject({ persisted: true, reason: 'levelEnd' });
    await expect(manager.saveOnPurchase()).resolves.toMatchObject({ persisted: true, reason: 'purchase' });
    await expect(manager.saveOnSettingsChange()).resolves.toMatchObject({
      persisted: true,
      reason: 'settingsChange',
    });
    expect(await storage.get(STORAGE_KEY_MAIN)).not.toBeNull();
  });

  it('resetProgress wipes coins/upgrades/progress but retains settings', async () => {
    const storage = new MemoryStorage();
    await storage.set(
      STORAGE_KEY_MAIN,
      goodSave({ coins: 500, settings: { sound: false, haptics: false } }),
    );
    const manager = new SaveManager(storage);
    await manager.load();

    manager.resetProgress();
    const data = manager.getData();
    expect(data.coins).toBe(0);
    expect(data.progress).toEqual({});
    expect(data.upgrades).toEqual({ inkCapacityLv: 0, engineSpeedLv: 0 });
    expect(data.settings).toEqual({ sound: false, haptics: false });
  });
});
