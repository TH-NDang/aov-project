import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { SeriesVideoError, writeSeriesVideo } from "../src/features/esports/data/series-video"

const link = "https://youtu.be/R5rCsGqDJIg"
const game = (id: string, sourceUrl?: string) =>
  ({ id, version: 1, content: { number: Number(id.slice(1)), sourceUrl } }) as DocumentView<GameContent>

/** Games kept in memory; `failOn` makes the save of that game fail as the service would. */
function writer(games: DocumentView<GameContent>[], failOn?: string) {
  const saved: string[] = []
  return {
    saved,
    api: {
      read: async (_kind: "games", id: string) => games.find((entry) => entry.id === id)!,
      save: async (_kind: "games", entry: DocumentView<GameContent>, content: GameContent) => {
        if (entry.id === failOn) throw new Error("Máy chủ không trả lời.")
        saved.push(`${entry.id}:${content.sourceUrl}`)
        return { ...entry, version: entry.version + 1, content }
      },
    } as unknown as Parameters<typeof writeSeriesVideo>[0],
  }
}

test("a broadcast link is written to every game that does not carry it yet", async () => {
  const games = [game("g1", link), game("g2"), game("g3", "https://youtu.be/old")]
  const { api, saved } = writer(games)

  const written = await writeSeriesVideo(api, games, link)

  assert.equal(written, 2)
  assert.deepEqual(saved, [`g2:${link}`, `g3:${link}`])
})

test("a link that fails part way says how many games already carry it", async () => {
  const games = [game("g1"), game("g2"), game("g3")]
  const { api, saved } = writer(games, "g2")

  const failure = await writeSeriesVideo(api, games, link).then(
    () => assert.fail("The write should fail"),
    (error: unknown) => error,
  )

  assert.ok(failure instanceof SeriesVideoError)
  assert.equal(failure.written, 1)
  assert.equal(failure.total, 3)
  assert.match(failure.message, /1 trên 3 ván/)
  assert.match(failure.message, /Máy chủ không trả lời\./)
  assert.deepEqual(saved, [`g1:${link}`], "The games after the failure are not touched")
})
