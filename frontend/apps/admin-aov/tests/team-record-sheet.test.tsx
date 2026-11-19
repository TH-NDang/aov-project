import assert from "node:assert/strict"
import { after, test } from "node:test"
import type { DocumentView, PlayerContent, TeamContent } from "@aov/community-contracts"
import { answerConfirm, button, click, render, type, waitFor, withDom } from "./fixtures/dom"

withDom({ url: "http://localhost:5175/tournaments/event" })

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { TeamRecordSheet } = await import("../src/features/tournaments/components/team-record-sheet")
const { editedRecordContent } = await import("../src/features/tournaments/model/registry-form-model")

const view = <T,>(id: string, content: T): DocumentView<T> => ({
  id,
  version: 4,
  createdAt: "",
  updatedAt: "",
  missingFields: [],
  content,
})
const team = view<TeamContent>("team", {
  code: "saigon-phantom",
  name: "Saigon Phantom",
  shortName: "SGP",
  country: "VN",
  logoUrl: "https://example.com/sgp.png",
})
const player = view<PlayerContent>("player", {
  code: "lai-bang",
  nickname: "Lai Bâng",
  lane: "DRAGON",
  careerStatus: "ACTIVE",
  signatureHeroes: ["Capheny"],
})

const original = { read: tournamentApi.read, save: tournamentApi.save }
const saved: { kind: string; version: number; content: unknown }[] = []
tournamentApi.read = (async (kind: string) => (kind === "teams" ? team : player)) as typeof tournamentApi.read
tournamentApi.save = (async (kind: string, entry: DocumentView<unknown>, content: unknown) => {
  saved.push({ kind, version: entry.version, content })
  return { ...entry, version: entry.version + 1, content }
}) as typeof tournamentApi.save
after(() => Object.assign(tournamentApi, original))

const sheet = () =>
  render(<TeamRecordSheet teamId="team" playerIds={["player"]} actorKey="editor" canWrite onClose={() => {}} />)
const field = (label: string) =>
  [...document.querySelectorAll<HTMLLabelElement>("label")]
    .find((entry) => entry.textContent?.trim().startsWith(label))
    ?.querySelector<HTMLInputElement>("input")

test("an edited record keeps the fields the form does not show and drops the ones the editor cleared", () => {
  const content = editedRecordContent("players", player, { nickname: "Lai Bâng", fullName: "" }, [
    "nickname",
    "fullName",
  ])

  assert.deepEqual(content, { ...player.content, nickname: "Lai Bâng" })
})

test("a team's record reads as it is until its pencil opens a form that saves the change on purpose", async () => {
  saved.length = 0
  const rendered = await sheet()
  await waitFor(() => button("Sửa hồ sơ đội Saigon Phantom"))
  assert.equal(field("Tên đội"), undefined)

  await click(button("Sửa hồ sơ đội Saigon Phantom"), "team pencil")
  await type(await waitFor(() => field("Tên đội")), "Saigon Phantom Gaming")
  await click(button("Lưu"), "save")

  await waitFor(() => saved.length === 1)
  assert.equal(saved[0]!.kind, "teams")
  assert.equal(saved[0]!.version, 4)
  assert.deepEqual(saved[0]!.content, { ...team.content, name: "Saigon Phantom Gaming" })
  await rendered.unmount()
})

test("a player of the team is edited from its own pencil, with its photo shown in the list", async () => {
  saved.length = 0
  const rendered = await sheet()
  await waitFor(() => button("Sửa hồ sơ tuyển thủ Lai Bâng"))
  assert.ok(document.querySelector('[aria-label="Ảnh Lai Bâng"]'))

  await click(button("Sửa hồ sơ tuyển thủ Lai Bâng"), "player pencil")
  await type(await waitFor(() => field("Họ tên")), "Lai Bâng Thanh")
  await click(button("Lưu"), "save")

  await waitFor(() => saved.length === 1)
  assert.equal(saved[0]!.kind, "players")
  assert.deepEqual(saved[0]!.content, { ...player.content, fullName: "Lai Bâng Thanh" })
  await rendered.unmount()
})

test("leaving a form with unsaved changes asks before they are discarded", async () => {
  saved.length = 0
  const rendered = await sheet()
  await click(await waitFor(() => button("Sửa hồ sơ đội Saigon Phantom")), "team pencil")
  await type(await waitFor(() => field("Tên viết tắt")), "SGPX")

  await click(button("Sửa hồ sơ tuyển thủ Lai Bâng"), "player pencil")
  await answerConfirm("Ở lại chỉnh sửa")
  assert.equal(field("Tên viết tắt")?.value, "SGPX")

  await click(button("Sửa hồ sơ tuyển thủ Lai Bâng"), "player pencil")
  await answerConfirm("Bỏ thay đổi")
  await waitFor(() => field("Họ tên"))
  assert.equal(saved.length, 0)
  await rendered.unmount()
})
