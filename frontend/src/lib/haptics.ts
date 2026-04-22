import { WebHaptics, type HapticInput, type TriggerOptions } from 'web-haptics'

/**
 * Vanilla `WebHaptics` instance (see web-haptics readme). Single instance avoids
 * relying on the React hook’s effect timing with Vite + Strict Mode.
 * `debug: true` in dev enables audio fallback when `navigator.vibrate` is missing (most desktops).
 */
export const webHaptics = new WebHaptics({
  debug: import.meta.env.DEV,
})

export function triggerHaptic(input?: HapticInput, options?: TriggerOptions) {
  void webHaptics.trigger(input, options)
}
