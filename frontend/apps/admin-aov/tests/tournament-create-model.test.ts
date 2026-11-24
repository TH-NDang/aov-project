import assert from "node:assert/strict"
import { test } from "node:test"
import type { TournamentContent } from "@aov/community-contracts"
import { withGlobals } from "./fixtures/dom"

const [
  { nextSeasonName, tournamentSlug, yearInName },
  { changeField, createContent, createIssue, effectiveParts, newForm, withSource },
  { statusConflict, statusFromDates },
  { NO_SELECTION, runOneByOne, toggledRow },
  { partDefaults },
] = await withGlobals({ BroadcastChannel: undefined }, () =>
  Promise.all([
    import("../src/features/tournaments/model/season-name"),
    import("../src/features/tournaments/model/create-tournament-model"),
    import("../src/features/tournaments/model/tournament-status"),
    import("../src/features/tournaments/model/bulk-changes"),
    import("../src/features/tournaments/model/tournament-parts"),
  ]),
)

const NOW = new Date("2026-11-24T05:00:00Z")
const ZONE = "Asia/Ho_Chi_Minh"
const source: TournamentContent = {
  code: "dtdv-dong-2026",
  name: "Đấu Trường Danh Vọng Mùa Đông 2026",
  region: "VN",
  year: 2026,
  startsOn: "2026-08-29",
  endsOn: "2026-11-07",
  status: "FINISHED",
  tier: "A",
  competitionType: "LEAGUE",
  logoUrl: "https://img.example/dtdv.png",
  sourceUrl: "https://source.example/2026",
}

test("the season after a Vietnamese spring is the winter of the same year and the spring of the next", () => {
  assert.equal(nextSeasonName("Đấu Trường Danh Vọng Mùa Xuân 2026"), "Đấu Trường Danh Vọng Mùa Đông 2026")
  assert.equal(nextSeasonName("Đấu Trường Danh Vọng Mùa Đông 2026"), "Đấu Trường Danh Vọng Mùa Xuân 2027")
})

test("an English season goes from spring to summer to winter, then to the next year", () => {
  assert.equal(nextSeasonName("Garena Challenger Series Spring 2026"), "Garena Challenger Series Summer 2026")
  assert.equal(nextSeasonName("RoV Pro League 2026 Summer"), "RoV Pro League 2026 Winter")
  assert.equal(nextSeasonName("RoV Pro League 2026 Winter"), "RoV Pro League 2027 Spring")
})

test("a name without a season word goes up by its years or by its number", () => {
  assert.equal(nextSeasonName("Arena of Valor Premier League 2026"), "Arena of Valor Premier League 2027")
  assert.equal(nextSeasonName("City Cup 2025-2026"), "City Cup 2026-2027")
  assert.equal(nextSeasonName("Valor Cup Season 9"), "Valor Cup Season 10")
  assert.equal(nextSeasonName("Valor Cup", 2025), "Valor Cup 2026")
  assert.equal(nextSeasonName("Summerfest Cup 2026"), "Summerfest Cup 2027", "only whole words are seasons")
})

test("a code is suggested from Latin names only and a name tells its last year", () => {
  assert.equal(tournamentSlug("Đấu Trường Danh Vọng – Vòng loại 2027"), "dau-truong-danh-vong-vong-loai-2027")
  assert.equal(tournamentSlug("傳說對決 GCS 2027"), null)
  assert.equal(yearInName("City Cup 2025-2026"), "2026")
})

test("the code follows the name until it is typed by hand, and again once it is cleared", () => {
  let form = changeField(newForm({}, NOW), "name", "Cúp Mới 2027", NOW)
  assert.equal(form.values.code, "cup-moi-2027")
  assert.equal(form.values.year, "2027")

  form = changeField(form, "code", "cup", NOW)
  form = changeField(form, "name", "Cúp Khác 2028", NOW)
  assert.equal(form.values.code, "cup")

  form = changeField(form, "code", "", NOW)
  assert.equal(form.values.code, "cup-khac-2028")
})

test("the status follows the dates until it is chosen by hand", () => {
  let form = changeField(newForm({}, NOW), "startsOn", "2026-12-03", NOW)
  assert.equal(form.values.status, "UPCOMING")
  form = changeField(form, "startsOn", "2026-11-01", NOW)
  assert.equal(form.values.status, "ONGOING")
  form = changeField(changeField(form, "status", "ANNOUNCED", NOW), "endsOn", "2026-11-10", NOW)
  assert.equal(form.values.status, "ANNOUNCED")
})

test("a new season keeps market, tier, type and logos of its model and starts without dates and sources", () => {
  const { values } = withSource(newForm({}, NOW), source, NOW)
  assert.equal(values.name, "Đấu Trường Danh Vọng Mùa Xuân 2027")
  assert.equal(values.code, "dau-truong-danh-vong-mua-xuan-2027")
  assert.deepEqual(createContent(values), {
    code: "dau-truong-danh-vong-mua-xuan-2027",
    name: "Đấu Trường Danh Vọng Mùa Xuân 2027",
    region: "VN",
    year: 2027,
    logoUrl: "https://img.example/dtdv.png",
    tier: "A",
    competitionType: "LEAGUE",
    status: "ANNOUNCED",
  })
})

test("a model picked later leaves what the editor already wrote", () => {
  const typed = changeField(changeField(newForm({}, NOW), "name", "Cúp của tôi", NOW), "tier", "C", NOW)
  const { values } = withSource(typed, source, NOW)
  assert.equal(values.name, "Cúp của tôi")
  assert.equal(values.tier, "C")
  assert.equal(values.competitionType, "LEAGUE")
})

test("a new part keeps its main event, region and year whatever it is modelled on", () => {
  const main = { ...source, region: "TH", year: 2025, name: "Pro League" }
  const { values } = withSource(newForm(partDefaults("main", main), NOW), source, NOW)
  assert.equal(values.parentTournamentId, "main")
  assert.equal(values.region, "TH")
  assert.equal(values.year, "2025")
  assert.equal(values.competitionType, "QUALIFIER")
})

test("a part is not created while its name still ends where its own name belongs", () => {
  const form = newForm(partDefaults("main", source), NOW)
  assert.match(createIssue(form.values) ?? "", /Viết tiếp tên riêng/)
  assert.equal(createIssue(changeField(form, "name", `${source.name} - Vòng loại`, NOW).values), null)
})

test("an end before the start is told before anything is saved", () => {
  const started = changeField(changeField(newForm({}, NOW), "name", "Cúp", NOW), "startsOn", "2026-12-03", NOW)
  assert.match(createIssue(changeField(started, "endsOn", "2026-12-01", NOW).values) ?? "", /Ngày kết thúc/)
})

test("rosters and staff are only copied along with the teams they belong to", () => {
  assert.deepEqual([...effectiveParts(new Set(["info", "rosters", "staff", "broadcast"]))], ["info", "broadcast"])
  assert.deepEqual([...effectiveParts(new Set(["entrants", "rosters"]))], ["entrants", "rosters"])
})

test("a status that its dates contradict is told with the status the dates say", () => {
  const conflict = (status: TournamentContent["status"], startsOn?: string, endsOn?: string) =>
    statusConflict({ status, startsOn, endsOn }, NOW, ZONE)
  assert.deepEqual(conflict("UPCOMING", "2026-11-08", "2026-11-08"), {
    status: "FINISHED",
    reason: "Lịch đã hết 16 ngày",
  })
  assert.equal(conflict("UPCOMING", "2026-11-20", "2026-12-01")?.status, "ONGOING")
  assert.equal(conflict("ONGOING", "2026-12-03", "2026-12-27")?.status, "UPCOMING")
})

test("a status that its dates allow is left alone", () => {
  const conflict = (status: TournamentContent["status"], startsOn?: string, endsOn?: string) =>
    statusConflict({ status, startsOn, endsOn }, NOW, ZONE)
  assert.equal(conflict("FINISHED", "2026-11-01", "2026-11-30"), null, "declared over before its last day")
  assert.equal(conflict("ONGOING", "2026-11-01", "2026-11-24"), null, "its last day is today")
  assert.equal(conflict("UNKNOWN", "2026-11-01", "2026-11-02"), null, "an unknown status claims nothing")
  assert.equal(conflict("UPCOMING"), null, "no dates")
})

test("dates alone give a tournament its status", () => {
  assert.equal(statusFromDates({}, NOW, ZONE), "ANNOUNCED")
  assert.equal(statusFromDates({ startsOn: "2026-11-25" }, NOW, ZONE), "UPCOMING")
  assert.equal(statusFromDates({ startsOn: "2026-11-24" }, NOW, ZONE), "ONGOING")
  assert.equal(statusFromDates({ startsOn: "2026-11-01", endsOn: "2026-11-23" }, NOW, ZONE), "FINISHED")
})

test("Shift ticks every row between two clicks and unticks them the same way", () => {
  const order = ["a", "b", "c", "d"]
  let selection = toggledRow(NO_SELECTION, order, "b", false)
  selection = toggledRow(selection, order, "d", true)
  assert.deepEqual([...selection.ids], ["b", "c", "d"])
  selection = toggledRow(selection, order, "c", false)
  selection = toggledRow(selection, order, "b", true)
  assert.deepEqual([...selection.ids], ["d"])
})

test("a run goes on past a failure and keeps the reason of each", async () => {
  const seen: number[] = []
  const failures = await runOneByOne(
    ["a", "b", "c"],
    async (item) => {
      if (item === "b") throw new Error("conflict")
    },
    (done) => seen.push(done),
  )
  assert.deepEqual(
    failures.map(({ item, error }) => [item, (error as Error).message]),
    [["b", "conflict"]],
  )
  assert.deepEqual(seen, [0, 1, 2, 3])
})
