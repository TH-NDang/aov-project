import { useEffect, useState } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiText } from "../../context/wiki-context"
import "./warehouse-tier-jumps.css"

export interface TierJump {
  key: string
  /** The tier as the list heads it, such as "III". */
  label: string
  count: number
}

/** How long the page must rest before the jumps come back out after a scroll. */
const REST_MS = 700

/** The id a tier section carries, so a jump can find it. */
export function tierSectionId(key: string) {
  return `wiki-item-tier-${key}`
}

/**
 * A floating row at the foot of the item list that jumps to each tier, the one in view marked, and back to the top.
 * While the page scrolls it tucks into the right edge, leaving a tab to grab, and it comes back once the page rests or a
 * pointer reaches it.
 */
export function TierJumps({
  tiers,
  onJump,
}: {
  tiers: TierJump[]
  /** Brings a tier into the list if it is not there yet, then scrolls to it. */
  onJump: (key: string) => void
}) {
  const text = useWikiText()
  const [tucked, setTucked] = useState(false)
  // A pointer that comes to the tucked row brings it out; the next scroll tucks it again.
  const show = () => setTucked(false)
  const [current, setCurrent] = useState(tiers[0]?.key)

  useEffect(() => {
    let rest: number | undefined
    let frame = 0
    const onScroll = () => {
      setTucked(true)
      window.clearTimeout(rest)
      rest = window.setTimeout(() => setTucked(false), REST_MS)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // The tier in view is the last one whose heading has passed the upper third of the window.
        const line = window.innerHeight / 3
        let found: string | undefined
        for (const tier of tiers) {
          const section = document.getElementById(tierSectionId(tier.key))
          if (section && section.getBoundingClientRect().top <= line) found = tier.key
        }
        setCurrent(found ?? tiers[0]?.key)
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.clearTimeout(rest)
      cancelAnimationFrame(frame)
    }
  }, [tiers])

  if (tiers.length < 2) return null
  return (
    <nav
      className="wiki-tier-jumps"
      data-tucked={tucked || undefined}
      aria-label={text("Đi tới cấp", "Go to tier")}
      onPointerEnter={show}
    >
      <span className="wiki-tier-jumps-grip" aria-hidden="true" />
      {tiers.map((tier) => (
        <button
          key={tier.key}
          type="button"
          aria-current={current === tier.key ? "location" : undefined}
          aria-label={text(`Cấp ${tier.label}, ${tier.count} món`, `Tier ${tier.label}, ${tier.count} items`)}
          onClick={() => onJump(tier.key)}
        >
          {tier.label}
          <small>{tier.count}</small>
        </button>
      ))}
      <button
        type="button"
        className="wiki-tier-jumps-top"
        aria-label={text("Lên đầu trang", "Back to top")}
        title={text("Lên đầu trang", "Back to top")}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <WikiIcon name="chevron" size={18} />
      </button>
    </nav>
  )
}
