import assert from "node:assert/strict"
import { after, beforeEach, test } from "node:test"
import type {
  CompetitionPlan,
  ContentVerification,
  DocumentView,
  RosterMembershipContent,
  SeriesContent,
  TournamentContent,
} from "@aov/community-contracts"
import type { Workspace, WorkspaceFocus } from "../src/features/competition/workspace/parts"
import type { ContentChecks } from "../src/features/competition/workspace/use-content-checks"
import { button, click, render, waitFor, withDom } from "./fixtures/dom"

withDom({ url: "http://localhost:5175/tournaments/event" })

const { competitionApi } = await import("../src/features/competition/competition-api")
const { useContentChecks } = await import("../src/features/competition/workspace/use-content-checks")
const { CheckMark, ContentChecksPanel } = await import("../src/features/competition/workspace/content-check")

let stored: ContentVerification[] = []
const sent: { part: string; contentToken: string; label?: string }[] = []
const removed: string[] = []
const { verifications, verify, unverify } = competitionApi
competitionApi.verifications = async () => stored
competitionApi.verify = async (_id, body) => {
  sent.push(body)
  const saved = {
    id: `v${sent.length}`,
    part: body.part,
    contentToken: body.contentToken,
    label: body.label,
    verifiedAt: "2026-11-28T05:00:00Z",
    verifiedByName: "ndang",
  }
  stored = [saved, ...stored]
  return saved
}
competitionApi.unverify = async (_id, verificationId) => {
  removed.push(verificationId)
  stored = stored.filter((mark) => mark.id !== verificationId)
}
after(() => Object.assign(competitionApi, { verifications, verify, unverify }))
beforeEach(() => {
  stored = []
  sent.length = 0
  removed.length = 0
})

const tournament: TournamentContent = { code: "aic", name: "AIC 2026", region: "VN" }
const plan = {
  circuit: "",
  organizer: "",
  timezone: "Asia/Ho_Chi_Minh",
  prizePool: "",
  currency: "",
  sourceUrl: "",
  notes: "",
  venues: [],
  entrants: [{ teamId: "sgp", status: "REGISTERED", note: "" }],
  stages: [],
  playoffSeeds: {},
  matches: [],
} satisfies CompetitionPlan
const rosters: DocumentView<RosterMembershipContent>[] = []
const series: DocumentView<SeriesContent>[] = []
const teamName = () => "Saigon Phantom"
const access = (canPublish: boolean) =>
  ({ actorKey: "owner", canRead: true, canWrite: true, canPublish }) as unknown as Workspace["access"]

/** The checks of a small tournament, drawn as the overview and the teams step draw them. */
function Screen({
  canPublish = true,
  dirty = false,
  went,
}: {
  canPublish?: boolean
  dirty?: boolean
  went: unknown[]
}) {
  const verification: ContentChecks = useContentChecks({
    tournamentId: "event",
    access: access(canPublish),
    tournament,
    plan,
    rosters,
    series,
    dirty,
    teamName,
  })
  const ws = {
    access: access(canPublish),
    verification,
    go: (step: string, focus?: WorkspaceFocus) => went.push([step, focus]),
  } as unknown as Workspace
  return (
    <>
      <ContentChecksPanel ws={ws} />
      <div id="team">
        <CheckMark ws={ws} part="TEAM:sgp" compact />
      </div>
    </>
  )
}

test("the overview lists every part and a part is marked as checked with the token of what is saved", async () => {
  const went: unknown[] = []
  const view = await render(<Screen went={went} />)
  const panel = await waitFor(() => view.container.querySelector('[aria-label="Kiểm chứng của bạn"]'))
  assert.match(panel.textContent ?? "", /0\/2 phần/)
  assert.match(panel.textContent ?? "", /Thông tin giải/)

  await click(button("Saigon Phantom", panel), "team line")
  assert.deepEqual(went, [["teams", { team: "sgp" }]])

  await click(button("Đánh dấu Saigon Phantom đã kiểm chứng", view.container.querySelector("#team")!), "mark")
  assert.equal(sent.length, 1)
  assert.equal(sent[0]!.part, "TEAM:sgp")
  assert.match(sent[0]!.contentToken, /^fp1:[0-9a-f]{32}$/)
  assert.equal(sent[0]!.label, "Saigon Phantom")
  await waitFor(() => /1\/2 phần/.test(panel.textContent ?? ""))
  assert.ok(button("Saigon Phantom: đã kiểm chứng", view.container.querySelector("#team")!))
  await view.unmount()
})

test("a part whose content changed after its check says so", async () => {
  stored = [
    {
      id: "old",
      part: "TEAM:sgp",
      contentToken: "fp1:00000000000000000000000000000000",
      verifiedAt: "2026-11-20T05:00:00Z",
      verifiedByName: "ndang",
    },
  ]
  const view = await render(<Screen went={[]} />)
  const team = view.container.querySelector("#team")!
  await waitFor(() => button("Saigon Phantom: đã đổi sau lần kiểm chứng", team))
  assert.match(view.container.textContent ?? "", /1 phần đã đổi sau lần kiểm chứng/)
  await view.unmount()
})

test("marking waits for a saved draft and for the right to publish", async () => {
  const dirty = await render(<Screen went={[]} dirty />)
  const unsaved = await waitFor(() => button("Đánh dấu Saigon Phantom đã kiểm chứng", dirty.container))
  assert.equal(unsaved.disabled, true)
  assert.equal(unsaved.title, "Lưu bản nháp trước khi đánh dấu")
  await dirty.unmount()

  const reader = await render(<Screen went={[]} canPublish={false} />)
  const locked = await waitFor(() => button("Đánh dấu Saigon Phantom đã kiểm chứng", reader.container))
  assert.equal(locked.disabled, true)
  await click(locked, "locked mark")
  assert.equal(sent.length, 0)
  await reader.unmount()
})
