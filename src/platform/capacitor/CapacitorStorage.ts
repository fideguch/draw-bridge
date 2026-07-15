import { Preferences } from '@capacitor/preferences';
import type { StorageInterface } from '../interfaces';

/**
 * Native StorageInterface over `@capacitor/preferences` (async native KV,
 * atomic per key — contract §Capacitor). Rejections propagate so callers follow
 * the FR-021 recovery path.
 */
export class CapacitorStorage implements StorageInterface {
  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
