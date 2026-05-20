'use client'
import { useEffect, useRef } from 'react'

/**
 * Adjusts a fixed overlay element to stay within the visual viewport
 * when the software keyboard opens on mobile (iOS + Android).
 *
 * The Visual Viewport API reports the visible area excluding the keyboard.
 * By pinning the overlay to that rectangle, the modal always stays above the keyboard.
 */
export function useKeyboardAwareOverlay() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const el = ref.current
    if (!el) return

    function update() {
      if (!el || !vv) return
      el.style.top = `${vv.offsetTop}px`
      el.style.left = `${vv.offsetLeft}px`
      el.style.width = `${vv.width}px`
      el.style.height = `${vv.height}px`
      el.style.right = 'auto'
      el.style.bottom = 'auto'
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return ref
}
