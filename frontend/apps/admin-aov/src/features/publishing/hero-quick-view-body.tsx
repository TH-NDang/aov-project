import { startTransition, useEffect, useRef, useState, type ReactNode } from "react"

/** Keep workspace mounting out of the sheet's opening animation. */
export function HeroQuickViewBody({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const panel = container.current?.closest<HTMLElement>('[data-slot="sheet-content"]')
    if (!panel) return
    let revealed = false
    let timer: number | undefined
    const reveal = () => {
      if (revealed) return
      revealed = true
      window.clearTimeout(timer)
      startTransition(() => setReady(true))
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal()
      return
    }
    // Bound the wait when animations are disabled or no animation event arrives.
    timer = window.setTimeout(reveal, 300)
    const onStart = (event: AnimationEvent) => {
      if (event.target !== panel || revealed) return
      window.clearTimeout(timer)
      timer = window.setTimeout(reveal, 250)
    }
    const onEnd = (event: AnimationEvent) => {
      if (event.target === panel) reveal()
    }
    panel.addEventListener("animationstart", onStart)
    panel.addEventListener("animationend", onEnd)
    panel.addEventListener("animationcancel", onEnd)
    return () => {
      revealed = true
      panel.removeEventListener("animationstart", onStart)
      panel.removeEventListener("animationend", onEnd)
      panel.removeEventListener("animationcancel", onEnd)
      window.clearTimeout(timer)
    }
  }, [])
  return (
    <div ref={container} className="min-h-0 flex-1 overflow-y-auto">
      {ready ? (
        children
      ) : (
        <div role="status" className="space-y-5 p-6" aria-label="Đang mở chi tiết tướng">
          <div aria-hidden className="flex items-center gap-4">
            <span className="size-16 rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-44 rounded bg-muted" />
            </div>
          </div>
          <div aria-hidden className="h-8 rounded-lg bg-muted" />
          <p className="text-xs text-muted-foreground">Đang mở chi tiết tướng…</p>
        </div>
      )}
    </div>
  )
}
