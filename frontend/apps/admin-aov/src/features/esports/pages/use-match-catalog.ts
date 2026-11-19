import { useMemo } from "react"
import type { DocumentView, GameContent, Reference, SeriesContent } from "@aov/community-contracts"
import { useGameCatalog } from "../data/use-esports-data"
import { buildGameView, referenceIndex, type GameView } from "../model/game-view"
import { recordingProgress, type RecordingProgress } from "../model/recording-progress"
import { seriesLocks } from "../model/series-rules"
import { broadcastEvents, type GameChapter } from "../model/series-vod"
import { isMajorMoment, itemLookups } from "./focused-game"

/** The catalog's items until it loads; one array, so the lookups built from it are not rebuilt on every render. */
const NO_ITEMS: Reference[] = []

/**
 * The catalog of the focused game and what the match page reads through it: a view of every game, the major moments
 * on the video axis, hero and item pictures, each game's recording progress and the heroes the series rules lock.
 */
export function useMatchCatalog({
  series,
  games,
  chapters,
  focusedEntry,
  teams,
  players,
}: {
  series: { content: SeriesContent }
  games: DocumentView<GameContent>[]
  chapters: GameChapter[]
  focusedEntry: DocumentView<GameContent> | undefined
  teams: Parameters<typeof buildGameView>[1]
  players: Parameters<typeof buildGameView>[2]
}) {
  const catalog = useGameCatalog(focusedEntry?.content)
  const items = catalog.data?.items ?? NO_ITEMS
  const lookups = useMemo(() => itemLookups(items), [items])
  const views = useMemo(
    () => Object.fromEntries(games.map((entry) => [entry.id, buildGameView(entry, teams, players, catalog.data)])),
    [games, teams, players, catalog.data],
  ) as Record<string, GameView>
  const events = useMemo(() => broadcastEvents(chapters, isMajorMoment(lookups)), [chapters, lookups])
  const heroIcon = useMemo(() => {
    const icons = referenceIndex(catalog.data?.heroes)
    return (hero: { id?: string | null; name?: string | null }) => icons({ id: hero.id, name: hero.name })?.iconUrl
  }, [catalog.data?.heroes])
  const progressOf = useMemo(
    () => Object.fromEntries(games.map((entry) => [entry.id, recordingProgress(entry)])),
    [games],
  ) as Record<string, RecordingProgress | undefined>
  const locks = useMemo(
    () =>
      seriesLocks(games, focusedEntry?.content.number ?? 1, series.content.bestOf, series.content.repeatPicksAllowed),
    [games, focusedEntry?.content.number, series.content.bestOf, series.content.repeatPicksAllowed],
  )
  return { catalog: catalog.data, items, lookups, views, events, heroIcon, progressOf, locks }
}
