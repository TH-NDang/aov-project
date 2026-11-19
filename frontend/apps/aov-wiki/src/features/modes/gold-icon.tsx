import { useId } from "react"
import "./gold-icon.css"

/**
 * The mode's gold: a small minted coin with a rim, a star stamp and a glint. It is artwork, so it keeps its own gold in
 * both themes; the number beside it carries the cost color.
 */
export function GoldIcon({ size = 14, label }: { size?: number; label?: string }) {
  const id = useId()
  const face = `${id}-face`
  const rim = `${id}-rim`
  return (
    <svg
      className="wiki-guide-gold-icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={face} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset="0.45" stopColor="#f7c948" />
          <stop offset="1" stopColor="#d48f12" />
        </radialGradient>
        <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe28a" />
          <stop offset="1" stopColor="#a5650a" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="9" fill={`url(#${rim})`} />
      <circle cx="10" cy="10" r="7.4" fill={`url(#${face})`} />
      <circle cx="10" cy="10" r="5.6" fill="none" stroke="#b97710" strokeOpacity="0.55" strokeWidth="0.8" />
      <path d="M10 5.9l1.15 2.95L14.1 10l-2.95 1.15L10 14.1l-1.15-2.95L5.9 10l2.95-1.15z" fill="#b97710" />
      <path
        d="M5.2 6.4a6 6 0 0 1 3.2-2.6"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.75"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  )
}
