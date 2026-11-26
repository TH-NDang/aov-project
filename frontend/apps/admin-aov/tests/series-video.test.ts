import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { writeSeriesVideo } from "../src/features/esports/data/series-video"
import type { ContentChange } from "../src/features/esports/model/desk"

const link = "https://youtu.be/R5rCsGqDJIg"
const game = (id: string, sourceUrl?: string) =>
  ({ id, version: 1, content: { number: Number(id.slice(1)), sourceUrl } }) as DocumentView<GameContent>

/** A saver for each game kept in memory; `refuses` is a game whose saver refuses, as the service would. */
function savers(games: DocumentView<GameContent>[], refuses?: string) {
  const saved: string[] = []
  const contents = new Map(games.map((entry) => [entry.id, entry.content]))
  return {
    saved,
    of: (entry: DocumentView<GameContent>) => ({
      save: async (change: ContentChange) => {
        if (entry.id === refuses) return false
        const next = change(contents.get(entry.id)!)
        contents.set(entry.id, next)
        saved.push(`${entry.id}:${next.sourceUrl}`)
        return true
      },
    }),
    content: (id: string) => contents.get(id)!,
  }
}

test("a broadcast link is written to every game that does not carry it yet", async () => {
  const games = [game("g1", link), game("g2"), game("g3", "https://youtu.be/old")]
  const { of, saved } = savers(games)

  assert.deepEqual(await writeSeriesVideo(of, games, link, "gắn video"), { written: 2, total: 2 })
  assert.deepEqual(saved, [`g2:${link}`, `g3:${link}`])
})

test("a link for one game alone leaves the others as they are", async () => {
  const games = [game("g1", "https://youtu.be/day"), game("g2", "https://youtu.be/day")]
  const { of, saved } = savers(games)

  assert.deepEqual(await writeSeriesVideo(of, [games[1]!], link, "gắn video"), { written: 1, total: 1 })
  assert.deepEqual(saved, [`g2:${link}`])
})

test("a link that a game refuses part way says how many games already carry it and leaves the rest", async () => {
  const games = [game("g1"), game("g2"), game("g3")]
  const { of, saved } = savers(games, "g2")

  assert.deepEqual(await writeSeriesVideo(of, games, link, "gắn video"), { written: 1, total: 3 })
  assert.deepEqual(saved, [`g1:${link}`], "The games after the refusal are not touched")
})

test("a link is applied to the game as its saver has it, after what was saved of it meanwhile", async () => {
  const games = [game("g1")]
  const store = savers(games)
  await store.of(games[0]!).save((content) => ({ ...content, note: "Ghi chú vừa lưu" }))

  await writeSeriesVideo(store.of, games, link, "gắn video")

  assert.deepEqual(store.content("g1"), { number: 1, note: "Ghi chú vừa lưu", sourceUrl: link })
})
