import type { CSSProperties, ReactNode } from "react"
import { hueOf } from "./community-ui"
import "./stage.css"

export type StageLight = { src?: string | null; darkSrc?: string | null; at: "left" | "right" | "center" }

/**
 * The dark stage a competition or a match stands on. It is lit by the logos of whoever is on it: each logo, blurred
 * to its colours, shines from its own end. Without a logo the light takes a hue from `tint`, the subject's name. The
 * stage is dark in both themes, so a logo drawn for dark backgrounds comes first. A head is a stage that `bleeds` from
 * one edge of the window to the other, flush with the bar above it. A stage that words stand all over is `shaded`, as
 * a pale picture would wash them out.
 */
export function Stage({
  tint,
  lights = [],
  bleeds = false,
  shaded = false,
  className = "",
  children,
}: {
  tint: string
  lights?: StageLight[]
  bleeds?: boolean
  shaded?: boolean
  className?: string
  children: ReactNode
}) {
  const lit = lights.flatMap(({ src, darkSrc, at }) => {
    const url = darkSrc || src
    return url ? [{ url, at }] : []
  })
  return (
    <div
      className={`tn-stage ${className}`}
      data-lit={lit.length > 0 || undefined}
      data-bleeds={bleeds || undefined}
      data-shaded={shaded || undefined}
      style={{ "--stage-hue": hueOf(tint) } as CSSProperties}
    >
      <span className="tn-stage-lights" aria-hidden="true">
        {lit.map(({ url, at }) => (
          <img key={`${at}:${url}`} className="tn-stage-light" data-at={at} src={url} alt="" decoding="async" />
        ))}
      </span>
      {children}
    </div>
  )
}
