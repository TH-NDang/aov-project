import { cn } from "@aov/ui/lib/utils"
import { useLocaleText } from "@aov/ui/hooks/use-locale-text"

/** A twelve-point seal, rounded by its stroke, so the badge reads as a stamp rather than a plain check. */
const seal = (() => {
  const points: string[] = []
  for (let index = 0; index < 24; index++) {
    const radius = index % 2 ? 9.2 : 11
    const angle = (Math.PI / 12) * index - Math.PI / 2
    points.push(`${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(" ")
})()

/**
 * Marks something run by the organization, team or player itself, e.g. an official channel or a page with a verified
 * representative. Pass `label` when the badge is the only thing telling users what it means.
 */
export function OfficialBadge({ className, label }: { className?: string; label?: string }) {
  const t = useLocaleText()
  const name = label ?? t("Chính thức", "Official")
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={name}
      className={cn("inline-block size-4 shrink-0 text-sky-500", className)}
    >
      <title>{name}</title>
      <polygon points={seal} fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M7.6 12.3l2.9 2.9 5.9-6.2"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
