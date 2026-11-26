import type { ReactNode } from "react"
import type { PublishedGame, Selection } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { present, referenceName } from "../../../lib/tournament-model"
import type { Chapter, WatchMatch, WatchTeam } from "../../../lib/watch-types"
import { shortName } from "../../../lib/watch-words"
import { ReferenceArt } from "./reference-art"
import "./watch-board.css"

/** How many heroes a side plays with. */
export const SEATS = 5

/** The head of one side: its team, and the side of the map it plays, or what it is doing (`busy`). */
export function SideHead({
  match,
  chapter,
  team,
  busy,
  children,
}: {
  match: WatchMatch
  chapter: Chapter
  team: WatchTeam
  busy?: string | null
  children?: ReactNode
}) {
  const { text } = useStreamLocale()
  const side = chapter.sides[team]
  const name = side && (side === "BLUE" ? text("Bên xanh", "Blue side") : text("Bên đỏ", "Red side"))
  return (
    <div className="tn-room-head" data-side={side ?? undefined}>
      <p data-busy={!!busy || undefined}>
        <b title={match.teams[team].name}>{shortName(match, team)}</b>
        {busy ? <em>{busy}</em> : name && <span>{name}</span>}
      </p>
      {children}
    </div>
  )
}

/** A banned hero, struck; a ban nobody saw or nobody made keeps its place and its stroke. */
export function BanFace({ game, hero }: { game: PublishedGame; hero: Selection | null | undefined }) {
  return present(hero) ? (
    <ReferenceArt catalog={game.catalog} kind="heroes" selection={hero} />
  ) : (
    <i aria-hidden="true" />
  )
}

/** The names of the heroes of a game; what nobody recorded, or what was not banned at all, is said as such. */
export function useHeroNames(game: PublishedGame) {
  const { text } = useStreamLocale()
  const name = (hero: Selection | null | undefined, unknown: string) =>
    present(hero) ? referenceName(game.catalog, "heroes", hero, unknown) : unknown
  return {
    pick: (hero?: Selection | null) => name(hero, text("Chưa rõ", "Unknown")),
    ban: (hero?: Selection | null) => name(hero, text("Không cấm hoặc chưa rõ", "No ban, or not seen")),
  }
}

/**
 * Both teams of a game, the first above the line and the second below it, as on the bar. Each half is a head and five
 * seats; `axis` stands between them.
 */
export function Board({
  heads,
  seats,
  axis,
}: {
  heads: Record<WatchTeam, ReactNode>
  /** Absent where nobody recorded who played. */
  seats: Record<WatchTeam, ReactNode> | null
  axis?: ReactNode
}) {
  return (
    <div className="tn-room-board">
      {heads.A}
      {seats?.A}
      {seats && axis}
      {seats?.B}
      {heads.B}
    </div>
  )
}
