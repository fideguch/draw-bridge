import type { AnalyticsEvent, AnalyticsInterface, AnalyticsParams } from '../interfaces';

/**
 * Web analytics seam. In v1.0 this is a no-op (BR-008: zero network calls) —
 * functionally identical to NoopAnalytics, kept as a distinct class because the
 * ESLint layer boundary forbids a `web/` impl from importing a `noop/` impl
 * (platform impls import interfaces only). This is the insertion point for the
 * GTM-phase web-portal adapter (Poki / CrazyGames) mapping onto the frozen GA4
 * vocabulary (contract §Web).
 */
export class WebAnalytics implements AnalyticsInterface {
  track<E extends AnalyticsEvent>(_event: E, _params: AnalyticsParams[E]): void {
    // v1.0: no-op.
  }
}
