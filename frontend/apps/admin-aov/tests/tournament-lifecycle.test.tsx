import assert from "node:assert/strict"
import { test } from "node:test"
import { act, type ReactNode } from "react"
import { MemoryRouter } from "react-router"
import type { RecordDeletionImpact } from "@aov/community-contracts"
import { click, flush, renderer, type, withDom, withGlobals } from "./fixtures/dom"

withDom({ url: "http://localhost:5175/tournaments" })

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { lifecycleUsages, lifecycleErrorUsages } =
  await import("../src/features/tournaments/model/record-lifecycle-model")
const { ApiError } = await import("../src/lib/api/errors")

test("deletion references expose positive counts and only safe local admin links", () => {
  const usages = lifecycleUsages([
    { type: "ROSTER_MEMBERSHIP", count: 2, adminPath: "/tournaments?tab=teams&roster=team" },
    { type: "PUBLICATION_HISTORY", count: 1, adminPath: "https://external.example" },
    { type: "GAME", count: 3, adminPath: "//external.example" },
    { type: "GAME", count: -1, adminPath: "/tournaments" },
    { type: "GAME", count: 0.5, adminPath: "/tournaments" },
    null,
  ])
  assert.equal(usages.length, 3)
  assert.equal(usages[0].count, 2)
  assert.equal(usages[0].path, "/tournaments?tab=teams&roster=team")
  assert.equal(usages[1].label, "Lịch sử xuất bản")
  assert.equal(usages[1].path, undefined)
  assert.equal(usages[2].path, undefined)
  assert.deepEqual(
    lifecycleErrorUsages(
      new ApiError({
        status: 409,
        code: "TOURNAMENT_RECORD_IN_USE",
        ...{ usages: [{ type: "SERIES", count: 1, adminPath: "/tournaments" }] },
      }),
    ),
    [{ type: "SERIES", count: 1, label: "Trận đấu", path: "/tournaments" }],
  )
})

/** Mounts `node` in a router; later calls draw the new tree in the same root. */
const routed = () => {
  const draw = renderer()
  return (node: ReactNode) => draw(<MemoryRouter>{node}</MemoryRouter>)
}
const pressed = async (label: string) =>
  click(
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) =>
        button.getAttribute("aria-label") === label || button.textContent?.replace(/s+/g, " ").trim() === label,
    ),
    label,
  )

const clearImpact: RecordDeletionImpact = { id: "player", version: 7, deletedAt: null, canDelete: true, usages: [] }

test("deletion waits for a reviewed impact, blocks stale or referenced records, then preserves the version", async () => {
  const original = { impact: tournamentApi.deletionImpact, remove: tournamentApi.remove }
  let removed = 0
  let changed = 0
  let resolveImpact!: (value: RecordDeletionImpact) => void
  tournamentApi.deletionImpact = () =>
    new Promise((resolve) => {
      resolveImpact = resolve
    })
  tournamentApi.remove = async (_kind, entry) => {
    removed++
    assert.deepEqual(entry, { id: "player", version: 7 })
    return { ...entry, version: 8, deletedAt: "2026-10-27T00:00:00Z" }
  }
  const render = routed()
  try {
    const { RecordLifecycleActions } = await import("../src/features/tournaments/components/record-lifecycle-actions")
    await render(
      <RecordLifecycleActions
        kind="players"
        entry={{ id: "player", version: 7 }}
        name="Player"
        onChanged={() => {
          changed++
        }}
      />,
    )
    await pressed("Xóa Player")
    const confirmation = () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Chuyển vào thùng rác",
      )!
    assert.equal(confirmation().disabled, true)
    assert.equal(removed, 0)
    await act(async () =>
      resolveImpact({
        ...clearImpact,
        canDelete: false,
        usages: [{ type: "ROSTER_MEMBERSHIP", count: 2, adminPath: "/tournaments?tab=teams&roster=team" }],
      }),
    )
    await flush()
    assert.equal(confirmation().disabled, true)
    assert.ok(document.querySelector('a[href="/tournaments?tab=teams&roster=team"]'))
    assert.match(document.body.textContent ?? "", /Đội hình2/)
    await pressed("Giữ lại")
    await pressed("Xóa Player")
    await act(async () => resolveImpact({ ...clearImpact, version: 8 }))
    await flush()
    assert.equal(confirmation().disabled, true)
    assert.match(document.body.textContent ?? "", /Mục đã thay đổi/)
    await pressed("Giữ lại")
    await pressed("Xóa Player")
    await act(async () => resolveImpact(clearImpact))
    await flush()
    assert.equal(confirmation().disabled, false)
    await pressed("Chuyển vào thùng rác")
    assert.equal(removed, 1)
    assert.equal(changed, 1)
    assert.equal(document.querySelector('[role="alertdialog"]'), null)
  } finally {
    tournamentApi.deletionImpact = original.impact
    tournamentApi.remove = original.remove
  }
})

test("a reference added after preview returns actionable links and disables repeated deletion", async () => {
  const original = { impact: tournamentApi.deletionImpact, remove: tournamentApi.remove }
  let removed = 0
  tournamentApi.deletionImpact = async () => clearImpact
  tournamentApi.remove = async () => {
    removed++
    throw new ApiError({
      status: 409,
      code: "TOURNAMENT_RECORD_IN_USE",
      ...{ usages: [{ type: "GAME", count: 1, adminPath: "/tournaments?series=series" }] },
    })
  }
  const render = routed()
  try {
    const { RecordLifecycleActions } = await import("../src/features/tournaments/components/record-lifecycle-actions")
    await render(
      <RecordLifecycleActions
        kind="players"
        entry={{ id: "player", version: 7 }}
        name="Player"
        onChanged={() => assert.fail("Blocked record changed")}
      />,
    )
    await pressed("Xóa Player")
    await pressed("Chuyển vào thùng rác")
    assert.match(document.body.textContent ?? "", /Chưa thể xóa/)
    assert.ok(document.querySelector('a[href="/tournaments?series=series"]'))
    const confirmation = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Chuyển vào thùng rác",
    )!
    assert.equal(confirmation.disabled, true)
    assert.equal(removed, 1)
  } finally {
    tournamentApi.deletionImpact = original.impact
    tournamentApi.remove = original.remove
  }
})

test("trash restores the exact deleted version and explains blocked parents without hiding the row", async () => {
  const original = tournamentApi.restore
  let calls = 0
  tournamentApi.restore = async (_kind, entry) => {
    calls++
    assert.equal(entry.version, 8)
    throw new ApiError({
      status: 409,
      code: "TOURNAMENT_RESTORE_BLOCKED",
      ...{ usages: [{ type: "TEAM", count: 1, adminPath: "/tournaments?tab=teams&state=deleted" }] },
    })
  }
  const render = routed()
  try {
    const { RecordLifecycleActions } = await import("../src/features/tournaments/components/record-lifecycle-actions")
    await render(
      <RecordLifecycleActions
        kind="roster-memberships"
        entry={{ id: "membership", version: 8, deletedAt: "2026-10-27T00:00:00Z" }}
        name="Player"
        onChanged={() => assert.fail("Blocked restore changed record")}
      />,
    )
    await pressed("Khôi phục")
    assert.equal(calls, 1)
    assert.match(document.body.textContent ?? "", /cần khôi phục dữ liệu liên quan trước/)
    assert.ok(document.querySelector('a[href="/tournaments?tab=teams&state=deleted"]'))
    assert.ok([...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Khôi phục")))
  } finally {
    tournamentApi.restore = original
  }
})

test("trash keeps restore behind write permission and refreshes its list after recovery", async () => {
  const original = { list: tournamentApi.list, restore: tournamentApi.restore }
  let deleted = true
  const deletedPlayer = {
    id: "player",
    version: 8,
    createdAt: "",
    updatedAt: "",
    deletedAt: "2026-10-27T00:00:00Z",
    missingFields: [],
    content: { code: "old-player", nickname: "Old player", aliases: ["Earlier name"] },
  }
  tournamentApi.list = async (kind, _signal, filters) => {
    assert.equal(kind, "players")
    assert.equal(typeof filters === "object" ? filters.state : null, "DELETED")
    return (deleted ? [deletedPlayer] : []) as never
  }
  tournamentApi.restore = async (kind, entry) => {
    assert.equal(kind, "players")
    assert.equal(entry.id, "player")
    assert.equal(entry.version, 8)
    deleted = false
    return { id: entry.id, version: 9, deletedAt: null }
  }
  const render = routed()
  try {
    const { RecordTrash } = await import("../src/features/tournaments/components/record-trash")
    await render(<RecordTrash initialKind="players" actorKey="actor" canWrite={false} />)
    assert.match(document.body.textContent ?? "", /Old player/)
    assert.equal(
      [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Khôi phục")),
      false,
    )
    await render(<RecordTrash initialKind="players" actorKey="actor" canWrite />)
    await pressed("Khôi phục")
    assert.equal(deleted, false)
    assert.match(document.body.textContent ?? "", /Thùng rác đang trống/)
    assert.doesNotMatch(document.body.textContent ?? "", /Old player/)
  } finally {
    tournamentApi.list = original.list
    tournamentApi.restore = original.restore
  }
})

test("the trash page shows deleted tournaments to a reader without offering to restore them", async () => {
  const original = { me: tournamentApi.me, list: tournamentApi.list }
  tournamentApi.me = async () => ({ capabilities: ["tournament:read"] }) as never
  tournamentApi.list = async (kind, _signal, filters) => {
    assert.equal(typeof filters === "object" ? filters.state : null, "DELETED")
    if (kind !== "tournaments") return [] as never
    const removed = { id: "aog", version: 3, createdAt: "", updatedAt: "", deletedAt: "2026-11-16T00:00:00Z" }
    return [{ ...removed, missingFields: [], content: { code: "aog-old", name: "AOG cũ", region: "VN" } }] as never
  }
  const render = routed()
  try {
    const { TournamentTrashPage } = await import("../src/features/tournaments/pages/trash-page")
    await render(<TournamentTrashPage />)

    assert.equal(document.querySelector("h1")?.textContent, "Thùng rác giải đấu")
    assert.match(document.body.textContent ?? "", /AOG cũ/)
    assert.ok(![...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Khôi phục")))
  } finally {
    tournamentApi.me = original.me
    tournamentApi.list = original.list
  }
})

test("the game info panel saves only what changed and asks before taking the public copy down", async () => {
  const fetch = async () =>
    Response.json({
      seasons: [{ id: "s3", name: "S3 2026", patches: [{ id: "p3", code: "s3-final", title: "Baseline" }] }],
    })
  const render = routed()
  await withGlobals({ fetch }, async () => {
    const { GameInfoPanel, changedGameInfo, gameInfoOf } = await import("../src/features/esports/pages/game-info-panel")
    const content = { seriesId: "s", number: 2, region: "VN", locale: "vi-VN", sides: [], note: "MVP: A" }
    const entry = { id: "g", version: 4, createdAt: "", updatedAt: "", missingFields: [], content }
    const saved: unknown[] = []
    let withdrawn = 0
    let progress = 0
    const panel = (publishedAt: string | null, canPublish = true) => (
      <GameInfoPanel
        key={String(publishedAt)}
        entry={{ ...entry, publishedAt } as never}
        canPublish={canPublish}
        onSave={(change) => saved.push(change)}
        onWithdraw={() => withdrawn++}
        onDeleted={() => assert.fail("nothing was deleted")}
        onOpenProgress={() => progress++}
      />
    )
    const button = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].filter(
        (entry) => entry.textContent?.replace(/\s+/g, " ").trim() === label,
      )

    assert.deepEqual(changedGameInfo(gameInfoOf(content as never), gameInfoOf(content as never)), {})
    await render(panel(null))
    assert.equal(button("Lưu thông tin ván")[0]!.disabled, true, "nothing to save yet")
    assert.match(document.body.textContent ?? "", /Chưa xuất bản/)
    assert.equal(button("Gỡ công khai").length, 0)
    await pressed("Mở Tiến độ")
    assert.equal(progress, 1)

    await type(document.querySelector<HTMLTextAreaElement>("textarea")!, "MVP: B")
    await pressed("Lưu thông tin ván")
    assert.deepEqual(saved, [{ note: "MVP: B" }], "the market, season and number were not sent again")
    await type(document.querySelector<HTMLInputElement>('input[type="number"]')!, "0")
    assert.equal(button("Lưu thông tin ván")[0]!.disabled, true, "a game number outside 1 to 99 cannot be saved")
    await pressed("Hủy")
    assert.equal(document.querySelector<HTMLTextAreaElement>("textarea")!.value, "MVP: A")

    // A published game can be taken down, by someone who may publish, after a question.
    await render(panel("2026-11-12T03:00:00Z", false))
    assert.equal(button("Gỡ công khai").length, 0)
    await render(panel("2026-11-12T04:00:00Z"))
    await act(async () => button("Gỡ công khai")[0]!.click())
    await flush()
    assert.equal(withdrawn, 0, "the question comes first")
    assert.match(document.body.textContent ?? "", /Gỡ ván 2 khỏi trang công khai\?/)
    await act(async () => button("Gỡ công khai").at(-1)!.click())
    await flush()
    assert.equal(withdrawn, 1)
  })
})
