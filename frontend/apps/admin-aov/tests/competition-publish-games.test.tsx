import assert from "node:assert/strict"
import { after, test } from "node:test"
import { MemoryRouter } from "react-router"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import type { Workspace } from "../src/features/competition/workspace/parts"
import { answerConfirm, button, click, render, waitFor, withDom } from "./fixtures/dom"
import { completeGame, game, match, team } from "./fixtures/match-records"

withDom({ url: "http://localhost:5175/tournaments/t?step=publish" })

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { PublishGames } = await import("../src/features/competition/workspace/publish-games")
const { ApiError } = await import("../src/lib/api/errors")

const { publish } = tournamentApi
after(() => Object.assign(tournamentApi, { publish }))

/** A game with all a publication needs, whose spells nobody saw. */
const withoutSpells = (number: number): DocumentView<GameContent> => {
  const entry = completeGame(number, "a")
  return {
    ...entry,
    content: {
      ...entry.content,
      sides: entry.content.sides.map((side) => ({
        ...side,
        participants: side.participants.map((participant) => ({ ...participant, spell: null })),
      })),
    },
  }
}
const games = [completeGame(1, "a"), withoutSpells(2), withoutSpells(3), game(4)]

/** The step of a tournament of its own, so that the runs of one test are not those of another. */
const step = (tournamentId: string, shown = games) => {
  const ws = {
    entry: { id: tournamentId },
    access: { canPublish: true },
    games: shown,
    series: [match()],
    team,
    go: () => {},
  } as unknown as Workspace
  return (
    <MemoryRouter>
      <PublishGames ws={ws} />
    </MemoryRouter>
  )
}

/** The refusal of the service for a game whose number is past the best of its match; it names the field. */
const incomplete = { status: 422, code: "TOURNAMENT_INCOMPLETE", missingFields: ["number.exceedsBestOf"] }

/** Publications the test lets through one by one; a refusal is answered as the service would. */
function heldPublications(refuse: number[] = []) {
  const waiting: (() => void)[] = []
  tournamentApi.publish = (entry) =>
    new Promise((resolve, reject) => {
      waiting.push(() => (refuse.includes(entry.content.number) ? reject(new ApiError(incomplete)) : resolve(entry)))
    })
  return {
    count: () => waiting.length,
    release: async () => {
      await waitFor(() => waiting.length > 0, "a publication waits")
      waiting.shift()!()
    },
  }
}

const text = () => document.body.textContent ?? ""
const labelled = (words: string) => {
  const found = button(words)
  assert.ok(found, `no action ${words}`)
  return found
}

test("each group of games has its own action, and every word for it is xuất bản", async () => {
  await render(step("words"))

  for (const words of ["Ván đã xuất bản0/4", "2 ván xuất bản được, còn thiếu", "1 ván chưa xuất bản được"])
    assert.ok(text().includes(words), words)
  assert.ok(labelled("Xuất bản 1 ván đủ dữ liệu") && labelled("Xuất bản 2 ván còn thiếu"))
  assert.doesNotMatch(text(), /công bố/i)
})

test("the progress of a run stands on the action of the group it publishes, and both actions wait for it", async () => {
  const service = heldPublications()
  await render(step("progress"))
  await click(labelled("Xuất bản 2 ván còn thiếu"))
  await answerConfirm("Xuất bản 2 ván")
  await service.release()

  const running = await waitFor(() => button("Đang xuất bản 1/2…"))
  assert.equal(running.disabled, true)
  assert.equal(labelled("Xuất bản 1 ván đủ dữ liệu").disabled, true)
  await service.release()
  await waitFor(() => button("Xuất bản 2 ván còn thiếu") && !button("Xuất bản 2 ván còn thiếu")!.disabled)
})

test("a run goes on while another step is open, and coming back shows it and starts no second one", async () => {
  const service = heldPublications()
  const shown = await render(step("away"))
  await click(labelled("Xuất bản 2 ván còn thiếu"))
  await answerConfirm("Xuất bản 2 ván")
  await shown.rerender(<p>Chung cuộc</p>)
  await service.release()
  await shown.rerender(step("away"))

  const running = await waitFor(() => button("Đang xuất bản 1/2…"))
  assert.equal(running.disabled, true)
  await click(running)
  assert.equal(service.count() <= 1, true, "no game is published twice")
  await service.release()
  await waitFor(() => !button("Đang xuất bản 1/2…"))
})

test("the games the service refused in a run are listed when the step is opened again", async () => {
  const service = heldPublications([2])
  const shown = await render(step("refused"))
  await click(labelled("Xuất bản 2 ván còn thiếu"))
  await answerConfirm("Xuất bản 2 ván")
  await shown.rerender(<p>Chung cuộc</p>)
  await service.release()
  await service.release()
  await shown.rerender(step("refused"))

  const alert = await waitFor(() => document.querySelector('[role="alert"]'))
  assert.match(alert.textContent ?? "", /Không xuất bản được 1 ván.*Ván 2.*Số ván vượt quá thể thức BO của trận/)
})

test("a refused game that was published since is no longer listed as refused", async () => {
  const service = heldPublications([2])
  const shown = await render(step("since"))
  await click(labelled("Xuất bản 2 ván còn thiếu"))
  await answerConfirm("Xuất bản 2 ván")
  await service.release()
  await service.release()
  await waitFor(() => document.querySelector('[role="alert"]'))
  const later = games.map((entry) => (entry.content.number === 2 ? { ...entry, publishedAt: entry.updatedAt } : entry))
  await shown.rerender(step("since", later))

  assert.equal(document.querySelector('[role="alert"]'), null)
})

test("a run that ends while the panel shows another tournament ends for the one it was started for", async () => {
  const service = heldPublications()
  const shown = await render(step("own"))
  await click(labelled("Xuất bản 2 ván còn thiếu"))
  await answerConfirm("Xuất bản 2 ván")
  await shown.rerender(step("other"))
  await service.release()
  await service.release()
  // The run is over once the actions of the tournament on screen stop waiting for it.
  await waitFor(() => button("Xuất bản 2 ván còn thiếu") && !button("Xuất bản 2 ván còn thiếu")!.disabled)
  await shown.rerender(step("own"))

  assert.equal(button("Đang xuất bản 2/2…"), undefined)
  assert.equal(labelled("Xuất bản 2 ván còn thiếu").disabled, false)
})
