'use client'

/**
 * Trigger haptic feedback on supported devices
 * Light: subtle feedback for navigation
 * Medium: standard feedback for actions
 * Heavy: strong feedback for confirmations
 */
export function haptic(type: 'light' | 'medium' | 'heavy' = 'medium') {
  if (typeof navigator === 'undefined') return
  
  // iOS Safari
  const nav = navigator as any
  if (nav.vibrate) {
    // Android vibration API
    const pattern = {
      light: 10,
      medium: 25,
      heavy: 50,
    }
    nav.vibrate(pattern[type])
  }
}

/**
 * Hook for haptic feedback with fallback
 */
export function useHaptic() {
  return {
    light: () => haptic('light'),
    medium: () => haptic('medium'),
    heavy: () => haptic('heavy'),
  }
}