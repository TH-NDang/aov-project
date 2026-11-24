import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { createMemoryRouter, RouterProvider } from "react-router"
import type { ReactNode } from "react"
import type {
  CommunityProfile,
  PlayerDirectoryEntry,
  ProfileContent,
  TeamDirectoryEntry,
} from "@aov/community-contracts"
import { emptyProfile } from "@aov/community-contracts"
import { QuietResizeObserver, answerConfirm, button, click, render, type, waitFor, withDom } from "./fixtures/dom"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { onePage } from "./fixtures/tournament-list-data"

withDom({
  url: "http://localhost:5175/teams",
  globals: () => ({ ResizeObserver: QuietResizeObserver, IntersectionObserver: intersectionHarness().Observer }),
})

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { directoryApi } = await import("../src/features/community/directory/directory-api")
const { pageApi } = await import("../src/features/community/api/page-api")
const { TeamDirectory } = await import("../src/features/community/directory/team-directory")
const { PlayerDirectory } = await import("../src/features/community/directory/player-directory")
const { OrganizationDirectory } = await import("../src/features/community/directory/competition-page-directory")
const { CoachDirectory } = await import("../src/features/community/directory/personnel-directory")

const originals = { tournament: { ...tournamentApi }, directory: { ...directoryApi }, page: { ...pageApi } }
const access = (canWrite: boolean) => ({ actorKey: "a", canRead: true, canWrite, canPublish: false }) as never
const figures = { tournaments: 1, matches: 0, wins: 0, losses: 0, titles: 0, lineup: [] }
const teams: TeamDirectoryEntry[] = [
  { id: "flash", code: "flash", name: "Team Flash", logoUrl: "https://img.example/flash.png", ...figures },
  { id: "solyx", code: "solyx", name: "Solyx", ...figures },
]
const player: PlayerDirectoryEntry = {
  id: "fish",
  code: "fish",
  nickname: "Fish",
  careerStatus: "ACTIVE",
  signatureHeroes: [],
  tournaments: 3,
  titles: 0,
}
const page = (id: string, name: string, kind: CommunityProfile["kind"], content: Partial<ProfileContent> = {}) =>
  ({
    id,
    version: 4,
    code: id,
    kind,
    content: { ...emptyProfile(name), ...content },
    published: false,
    represented: false,
    followers: 0,
    updatedAt: "",
  }) as CommunityProfile
let router: ReturnType<typeof createMemoryRouter>

beforeEach(() => {
  Object.assign(directoryApi, {
    teams: async () => onePage(teams),
    players: async () => onePage([player]),
    profiles: async () => onePage([]),
    competitionPages: async () => [],
  })
})
afterEach(() => {
  Object.assign(tournamentApi, originals.tournament)
  Object.assign(directoryApi, originals.directory)
  Object.assign(pageApi, originals.page)
  router.dispose()
})

async function open(element: ReactNode, ready: string) {
  router = createMemoryRouter([{ path: "*", element }])
  await render(<RouterProvider router={router} />)
  await waitFor(() => document.body.textContent?.includes(ready), `${ready} is listed`)
}

test("a reader's directory has no pencils", async () => {
  await open(<TeamDirectory access={access(false)} />, "Solyx")
  assert.equal(button("Sửa hồ sơ đội Solyx"), undefined)
})

test("an entry without a logo is marked and one with a logo is not", async () => {
  await open(<TeamDirectory access={access(true)} />, "Solyx")
  const marks = [...document.querySelectorAll('[aria-label="Thiếu logo"]')]
  assert.deepEqual(
    marks.map((mark) => mark.closest("li")?.querySelector("h2")?.textContent),
    ["Solyx"],
  )
})

test("a team is edited in place and saved at the version that was read", async () => {
  const saved: unknown[] = []
  Object.assign(tournamentApi, {
    read: async () => ({ id: "solyx", version: 7, content: { code: "solyx", name: "Solyx", note: "kept" } }),
    save: async (_kind: string, entry: { version: number }, content: unknown) => saved.push([entry.version, content]),
  })
  await open(<TeamDirectory access={access(true)} />, "Solyx")
  await click(button("Sửa hồ sơ đội Solyx"))
  const name = await waitFor(() => document.querySelector<HTMLInputElement>('[role="dialog"] input[required]'))
  await type(name, "Solyx Esports")
  await click(button("Lưu", document.querySelector('[role="dialog"]')!))
  await waitFor(() => saved.length === 1, "The record is saved")
  assert.deepEqual(saved[0], [7, { code: "solyx", note: "kept", name: "Solyx Esports" }])
  await waitFor(() => !document.querySelector('[role="dialog"]'), "The sheet closes")
})

test("a player is folded into another profile from the list", async () => {
  await open(<PlayerDirectory access={access(true)} />, "Fish")
  await click(button("Gộp hồ sơ Fish"))
  const dialog = await waitFor(() => document.querySelector('[role="dialog"]'), "The merge sheet opens")
  assert.match(dialog.textContent ?? "", /Gộp vào hồ sơ khác/)
})

test("an organization is edited in place and what the sheet does not show stays", async () => {
  const entry = page("garena", "Garena", "ORGANIZATION", { biography: "kept" })
  const saved: ProfileContent[] = []
  directoryApi.profiles = async () => onePage([entry])
  Object.assign(pageApi, {
    read: async () => entry,
    save: async (_entry: CommunityProfile, content: ProfileContent) => saved.push(content),
  })
  await open(<OrganizationDirectory access={access(true)} />, "Garena")
  await click(button("Sửa hồ sơ Garena"))
  const name = await waitFor(() => document.querySelector<HTMLInputElement>('[role="dialog"] input[required]'))
  await type(name, "Garena VN")
  await click(button("Lưu", document.querySelector('[role="dialog"]')!))
  await waitFor(() => saved.length === 1, "The profile is saved")
  assert.equal(saved[0]!.name, "Garena VN")
  assert.equal(saved[0]!.biography, "kept")
})

test("leaving a person's form with changes asks first", async () => {
  const entry = page("coach", "Coach", "PERSON", { personRoles: ["COACH"] })
  directoryApi.profiles = async () => onePage([entry])
  pageApi.read = async () => entry
  await open(<CoachDirectory access={access(true)} />, "Coach")
  await click(button("Sửa hồ sơ Coach"))
  const name = await waitFor(() => document.querySelector<HTMLInputElement>('[role="dialog"] input[required]'))
  await type(name, "Coach B")
  await click(button("Hủy", document.querySelector('[role="dialog"]')!))
  await answerConfirm("Ở lại chỉnh sửa")
  assert.equal(name.value, "Coach B")
})
