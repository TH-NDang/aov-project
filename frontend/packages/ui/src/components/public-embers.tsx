import { useEffect, useRef } from "react"

type Ember = { x: number; y: number; size: number; speed: number; sway: number; phase: number }

/**
 * Slow sparks of light drifting up over artwork, in the element's text color. Decoration only: it pauses off screen
 * and does not run for readers who ask for less motion.
 */
export function PublicEmbers({ className, count = 28 }: { className?: string; count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const context = canvas.getContext("2d")
    if (!context) return

    // One soft dot drawn once and reused: painting a glow for every spark on every frame would be far slower.
    const sprite = document.createElement("canvas")
    sprite.width = sprite.height = 32
    const paint = sprite.getContext("2d")!
    const glow = paint.createRadialGradient(16, 16, 0, 16, 16, 16)
    const color = getComputedStyle(canvas).color
    glow.addColorStop(0, color)
    glow.addColorStop(1, "transparent")
    paint.fillStyle = glow
    paint.fillRect(0, 0, 32, 32)

    let width = 0
    let height = 0
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    const embers: Ember[] = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 3 + Math.random() * 7,
      speed: 0.012 + Math.random() * 0.028,
      sway: 6 + Math.random() * 16,
      phase: Math.random() * Math.PI * 2,
    }))

    let frame = 0
    let last = 0
    const draw = (now: number) => {
      const elapsed = Math.min((now - last) / 1000, 0.1)
      last = now
      context.clearRect(0, 0, width, height)
      for (const ember of embers) {
        ember.y -= ember.speed * elapsed
        if (ember.y < -0.05) {
          ember.y = 1.05
          ember.x = Math.random()
        }
        const x = ember.x * width + Math.sin(now / 1800 + ember.phase) * ember.sway
        // Fades in near the bottom and out near the top, and flickers a little on the way.
        context.globalAlpha =
          Math.min(1, ember.y * 3, (1 - ember.y) * 3) * (0.45 + 0.35 * Math.sin(now / 700 + ember.phase))
        context.drawImage(sprite, x, ember.y * height, ember.size, ember.size)
      }
      frame = requestAnimationFrame(draw)
    }
    const start = () => {
      if (frame) return
      last = performance.now()
      frame = requestAnimationFrame(draw)
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }

    const size = new ResizeObserver(resize)
    size.observe(canvas)
    const visible = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? start() : stop()))
    visible.observe(canvas)
    return () => {
      stop()
      size.disconnect()
      visible.disconnect()
    }
  }, [count])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
