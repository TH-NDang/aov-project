import type { CSSProperties } from "react"

export interface PageBackdropProps {
  image?: string
  color?: string
}

/** Keeps artwork bounded while its ambient color extends across wide viewports. */
export function PageBackdrop({ image, color = "#27283f" }: PageBackdropProps) {
  const style = { "--backdrop-color": color } as CSSProperties

  return (
    <div aria-hidden="true" className="page-backdrop" style={style}>
      <div
        className="page-backdrop-art"
        style={{
          backgroundImage: image
            ? `url(${JSON.stringify(image)})`
            : "radial-gradient(ellipse at 50% 0%, var(--amber-accent), transparent 70%)",
        }}
      />
    </div>
  )
}
