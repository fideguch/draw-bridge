import type { StorageInterface } from '../interfaces';

/**
 * In-memory StorageInterface backed by a Map (contracts/platform-interfaces.md
 * §5, "NoopStorage"). Selected only in tests — never at runtime. `set` is
 * atomic per key; `get` returns null for absent keys.
 */
export class MemoryStorage implements StorageInterface {
  private readonly store = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.has(key) ? (this.store.get(key) as string) : null);
  }

  set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}
