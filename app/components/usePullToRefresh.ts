'use client'

import { useRef, useCallback } from 'react'

/**
 * Pull-to-refresh hook.
 * Returns { handleTouchStart, handleTouchMove, handleTouchEnd, refreshing }
 * Attach touch handlers to the scrollable container.
 */
export function usePullToRefresh(onRefresh: () => void, threshold = 80) {
  const touchStart = useRef(0)
  const refreshing = useRef(false)
  const didFire = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStart.current = e.touches[0].clientY
      refreshing.current = false
      didFire.current = false
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStart.current === 0 || refreshing.current || didFire.current) return
    const pullDistance = e.touches[0].clientY - touchStart.current
    if (pullDistance > threshold) {
      refreshing.current = true
      didFire.current = true
      onRefresh()
    }
  }, [onRefresh, threshold])

  const handleTouchEnd = useCallback(() => {
    touchStart.current = 0
  }, [])

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
