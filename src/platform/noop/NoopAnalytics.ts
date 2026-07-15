import type { AnalyticsEvent, AnalyticsInterface, AnalyticsParams } from '../interfaces';

export interface NoopAnalyticsOptions {
  /** Dev builds only: `console.debug` each event + params instead of dropping them. */
  devConsole?: boolean;
}

/**
 * Default analytics terminator for v1.0 everywhere (BR-008 — zero network
 * calls). Fire-and-forget, synchronous, never throws.
 */
export class NoopAnalytics implements AnalyticsInterface {
  private readonly devConsole: boolean;

  constructor(options: NoopAnalyticsOptions = {}) {
    this.devConsole = options.devConsole ?? false;
  }

  track<E extends AnalyticsEvent>(event: E, params: AnalyticsParams[E]): void {
    if (this.devConsole) {
      // Dev-only diagnostic — stripped from prod (BR-008 keeps this a Noop there).
      console.debug('[analytics:noop]', event, params);
    }
  }
}
