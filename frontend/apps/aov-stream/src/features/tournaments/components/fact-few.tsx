import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"

/** Below this many games a single one moves every share. */
const FEW = 30

/** A word of caution over the figures of a few games; `only` narrows them in words. */
export function FewGames({ games, only = "" }: { games: number; only?: string }) {
  const { text, languageTag } = useStreamLocale()
  if (games >= FEW) return null
  const count = gamesText(games, text, languageTag) + only
  return <p className="tn-quiet">{text(`Chỉ ${count}, chưa nói lên nhiều.`, `Only ${count}, too few to say much.`)}</p>
}
