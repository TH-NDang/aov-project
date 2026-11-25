import { OfficialBadge } from "@aov/ui/components/official-badge"
import { useStreamLocale } from "./stream-locale"
import "./official-name.css"

/** The letters that keep the mark beside them; the word they end may still break where it has no room. */
const KEPT = 2

/** A page's name with the mark of its verified representative, which stays on the line the name ends on. */
export function OfficialName({ name, official }: { name: string; official: boolean }) {
  const { text } = useStreamLocale()
  if (!official) return name
  const letters = [...name]
  return (
    <>
      {letters.slice(0, -KEPT).join("")}
      <span className="on-last">
        {letters.slice(-KEPT).join("")}
        <OfficialBadge label={text("Đại diện đã xác minh", "Verified representative")} />
      </span>
    </>
  )
}
