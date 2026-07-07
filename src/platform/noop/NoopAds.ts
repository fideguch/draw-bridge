import type {
  AdEvent,
  AdInterface,
  AdPlacement,
  AdResult,
  InterstitialPlacement,
  RewardedPlacement,
} from '../interfaces';

/** Dev-only constructor options (contracts/platform-interfaces.md §5). */
export interface NoopAdsOptions {
  /**
   * Dev builds only: `isReady` → true, `showRewarded` → 'rewarded',
   * `showInterstitial` → 'closed' — exercises the flag-hidden ad UI without an
   * SDK. Off in production (BR-008: ad paths terminate as unavailable).
   */
  instantSuccess?: boolean;
}

/**
 * Default ad terminator for v1.0 everywhere (BR-008). The returned promise
 * always resolves — reward grants key off the resolved 'rewarded' value, not
 * off events. No network calls are made.
 */
export class NoopAds implements AdInterface {
  private readonly instantSuccess: boolean;

  constructor(options: NoopAdsOptions = {}) {
    this.instantSuccess = options.instantSuccess ?? false;
  }

  showRewarded(_placement: RewardedPlacement): Promise<AdResult> {
    return Promise.resolve(this.instantSuccess ? 'rewarded' : 'unavailable');
  }

  showInterstitial(_placement: InterstitialPlacement): Promise<AdResult> {
    return Promise.resolve(this.instantSuccess ? 'closed' : 'unavailable');
  }

  isReady(_placement: AdPlacement): boolean {
    return this.instantSuccess;
  }

  on(_event: AdEvent, _listener: (placement: AdPlacement) => void): () => void {
    // No events ever fire from the noop terminator; unsubscribe is a no-op.
    return () => {};
  }
}
