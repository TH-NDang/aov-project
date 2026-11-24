import "./tier-emblem.css"

/**
 * One silhouette per tier, so tiers are told apart without their colour: S wears a crown, A two wings, B is a plain
 * shield, C a short one and D an open ring.
 */
const SHAPES: Record<string, string> = {
  S: "M3 3.5 7.6 7 12 1l4.4 6L21 3.5V13c0 4.4-3.8 7.7-9 10-5.2-2.3-9-5.6-9-10z",
  A: "M1.5 4.5 7 5.8 12 2l5 3.8 5.5-1.3-1.7 8.8C19.9 17.6 16.6 20.6 12 23c-4.6-2.4-7.9-5.4-8.8-9.7z",
  B: "M3.5 4 12 2l8.5 2v9c0 4.4-3.4 7.4-8.5 10-5.1-2.6-8.5-5.6-8.5-10z",
  C: "M4.5 4.5h15V14c0 3.6-2.9 5.9-7.5 8-4.6-2.1-7.5-4.4-7.5-8z",
  D: "M12 3a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19z",
}

export const isTier = (tier: string | null | undefined): tier is string => !!tier && tier in SHAPES

/** The emblem of a tournament's tier. `label` names it for readers who do not see it. Unknown tiers draw nothing. */
export function TierEmblem({
  tier,
  size = 22,
  label,
}: {
  tier: string | null | undefined
  size?: number
  label: string
}) {
  if (!isTier(tier)) return null
  return (
    <span
      className="aov-tier"
      data-tier={tier}
      style={{ width: size, height: size, fontSize: size * 0.48 }}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={SHAPES[tier]} />
      </svg>
      <span aria-hidden="true">{tier}</span>
    </span>
  )
}
