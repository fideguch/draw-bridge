import type { StorageInterface } from '../interfaces';

/**
 * Browser StorageInterface over `localStorage` (contracts/platform-interfaces.md
 * §Web). `set` is atomic per key. `QuotaExceededError` / security (private-mode)
 * errors surface as a rejected promise so callers follow the FR-021 recovery
 * path — this is the one interface allowed to reject.
 */
export class WebStorage implements StorageInterface {
  get(key: string): Promise<string | null> {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('WebStorage.get failed'));
    }
  }

  set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('WebStorage.set failed'));
    }
  }

  remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('WebStorage.remove failed'));
    }
  }
}
