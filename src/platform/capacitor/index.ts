/**
 * Native (Capacitor) platform implementations for v1.0: Storage + Haptics.
 *
 * Ads and Analytics terminate in the Noop implementations for v1.0 (BR-008:
 * all ad/analytics paths terminate in Noop; zero network calls). The
 * composition root (src/main.ts) injects NoopAds / NoopAnalytics for the native
 * runtime — this package deliberately ships no ad/analytics classes so the
 * layer boundary (platform impls import interfaces only) stays clean. v1.1
 * adapters are pre-selected but NOT installed: @capacitor-community/admob,
 * @capacitor-firebase/analytics (research R5).
 */
export { CapacitorStorage } from './CapacitorStorage';
export { CapacitorHaptics } from './CapacitorHaptics';
