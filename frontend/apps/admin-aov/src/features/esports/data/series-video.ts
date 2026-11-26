import type { DocumentView, GameContent } from "@aov/community-contracts"
import type { GameSaver } from "./use-game-saver"

/**
 * The link of a broadcast for the games it is given, all of a match or one of them, each keeping its own start second.
 * It is written through each game's own saver, after what is still being saved of that game, so it never meets the next
 * change as a conflict and never writes an old copy. A game that refuses it says so in its saver; the games after it
 * keep their link. Answers how many games of those that did not carry it carry it now.
 */
export async function writeSeriesVideo(
  saverOf: (entry: DocumentView<GameContent>) => Pick<GameSaver, "save">,
  games: DocumentView<GameContent>[],
  url: string,
  what: string,
) {
  const pending = games.filter((entry) => (entry.content.sourceUrl ?? "") !== url)
  let written = 0
  for (const entry of pending) {
    const carried = await saverOf(entry).save(
      (content) => ((content.sourceUrl ?? "") === url ? content : { ...content, sourceUrl: url }),
      what,
    )
    if (!carried) break
    written++
  }
  return { written, total: pending.length }
}
