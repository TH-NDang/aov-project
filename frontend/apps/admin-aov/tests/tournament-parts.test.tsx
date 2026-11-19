import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { DocumentView, TournamentContent, TournamentPart } from "@aov/community-contracts"
import { inDom, renderer, withGlobals } from "./fixtures/dom"

const [
  { partLabel, partPhase, partsByMainEvent, partsOnLine },
  { initialRegistryValues, registryContent },
  { createTournamentApi },
] = await withGlobals({ BroadcastChannel: undefined }, () =>
  Promise.all([
    import("../src/features/tournaments/model/tournament-parts"),
    import("../src/features/tournaments/model/registry-form-model"),
    import("../src/features/tournaments/api/tournament-api"),
  ]),
)

const NOW = new Date("2026-11-13T05:00:00Z")
const ZONE = "Asia/Ho_Chi_Minh"
const part = (id: string, name: string, extra: Partial<TournamentPart> = {}): TournamentPart => ({
  id,
  parentId: "cup",
  name,
  ...extra,
})

test("a part is named by what it adds to its main event", () => {
  const main = "Arena of Valor Premier League 2026"
  assert.equal(partLabel(`${main} - Wildcard`, main), "Wildcard")
  assert.equal(partLabel(`${main}: Queens Showdown`, main), "Queens Showdown")
  assert.equal(partLabel(`${main} Japan Qualifier`, main), "Japan Qualifier")
  assert.equal(partLabel("arena of valor premier league 2026 – 1v1 Tournament", main), "1v1 Tournament")

  assert.equal(partLabel("Road to APL 2026 - GCS", main), "Road to APL 2026 - GCS", "a name of its own stays whole")
  assert.equal(partLabel(main, main), main, "nothing left over: the whole name")
  assert.equal(partLabel("Valor Cup Season 10 Finals", "Valor Cup Season 1"), "Valor Cup Season 10 Finals")
  assert.equal(partLabel("Arena of Glory Promotion", "Arena of Valor World Cup"), "Arena of Glory Promotion")
  assert.equal(partLabel(`${main} - Wildcard`, undefined), `${main} - Wildcard`, "main event not loaded yet")
})

test("siblings that only share their opening words drop those words", () => {
  assert.equal(
    partLabel("SAT ROV Valor City 2021 - Central Region", "SAT ROV Valor City 2021 - Finals"),
    "Central Region",
  )
  assert.equal(
    partLabel("33rd Southeast Asian Games - Esports - Vietnam Men Qualifier", "33rd Southeast Asian Games - Men"),
    "Esports - Vietnam Men Qualifier",
  )
})

test("a part stands against today by its dates, and by its status only when it has none", () => {
  const phase = (startsOn?: string, endsOn?: string, status?: TournamentPart["status"]) =>
    partPhase({ startsOn, endsOn, status }, NOW, ZONE)
  assert.equal(phase("2026-11-16", "2026-11-17"), "upcoming")
  assert.equal(phase("2026-11-12", "2026-11-13"), "ongoing", "ends today")
  assert.equal(phase("2026-11-13"), "ongoing", "a single day that is today")
  assert.equal(phase("2026-11-01", "2026-11-12"), "finished")
  assert.equal(phase("2026-11-01", "2026-11-30", "FINISHED"), "finished", "declared over before its last day")
  assert.equal(phase(undefined, "2026-11-20"), "ongoing", "only an end date, not reached yet")
  assert.equal(phase(undefined, undefined, "ONGOING"), "ongoing")
  assert.equal(phase(undefined, undefined, "ANNOUNCED"), "upcoming")
  assert.equal(phase(undefined, undefined, "FINISHED"), "finished")
  assert.equal(phase(), "unscheduled")
})

test("a list line leads with what a search names, then what is running or about to start", () => {
  const parts = [
    part("a", "Cup - Open Qualifier", { startsOn: "2026-09-01", endsOn: "2026-09-02" }),
    part("b", "Cup - Closed Qualifier", { startsOn: "2026-10-01", endsOn: "2026-10-02" }),
    part("c", "Cup - Wildcard", { startsOn: "2026-11-12", endsOn: "2026-11-14" }),
    part("d", "Cup - Show Match", { startsOn: "2026-11-20", endsOn: "2026-11-20" }),
    part("e", "Cup - Vòng thăng hạng", { startsOn: "2026-08-01", endsOn: "2026-08-02" }),
  ]
  const ids = (search: string, limit?: number) => {
    const line = partsOnLine(parts, search, limit, NOW)
    return { ids: line.shown.map((entry) => entry.part.id), hidden: line.hidden }
  }
  assert.deepEqual(ids(""), { ids: ["c", "d", "a", "b"], hidden: 1 })
  assert.deepEqual(ids("", 10), { ids: ["c", "d", "a", "b", "e"], hidden: 0 })
  assert.deepEqual(ids("thang hang", 2), { ids: ["e", "c"], hidden: 3 }, "accents do not matter to a search")
  assert.deepEqual(ids("qualifier", 3), { ids: ["a", "b", "c"], hidden: 2 })

  const grouped = partsByMainEvent([...parts, { ...part("z", "Other - Qualifier"), parentId: "other" }])
  assert.deepEqual([...grouped.keys()], ["cup", "other"])
  assert.deepEqual(
    grouped.get("cup")?.map((entry) => entry.id),
    ["a", "b", "c", "d", "e"],
    "the server's order is kept",
  )
})

test("the form keeps the main event of a part and a new part starts from its main event", () => {
  const content: TournamentContent = {
    code: "cup-wildcard",
    name: "Cup - Wildcard",
    region: "TH",
    year: 2026,
    parentTournamentId: "cup",
  }
  const entry: DocumentView<TournamentContent> = {
    id: "wildcard",
    version: 2,
    createdAt: "",
    updatedAt: "",
    missingFields: [],
    content,
  }
  const keys = ["code", "name", "parentTournamentId", "region", "year"]
  const values = initialRegistryValues(entry, "tournaments", undefined, { region: "VN", name: "ignored" })
  assert.equal(values.parentTournamentId, "cup")
  assert.equal(values.name, "Cup - Wildcard", "defaults never override a record that exists")
  assert.deepEqual(registryContent("tournaments", values, keys), content)

  const detached = registryContent("tournaments", { ...values, parentTournamentId: "" }, keys) as TournamentContent
  assert.equal("parentTournamentId" in detached, false, "a cleared field leaves the record a main event")

  const fresh = initialRegistryValues(undefined, "tournaments", undefined, {
    parentTournamentId: "cup",
    code: "cup-",
    name: "Cup - ",
    region: "TH",
    year: "2024",
    competitionType: "QUALIFIER",
  })
  assert.equal(fresh.parentTournamentId, "cup")
  assert.equal(fresh.region, "TH")
  assert.equal(fresh.year, "2024", "the main event's year, not this year")
  assert.equal(initialRegistryValues(undefined, "tournaments").year, String(new Date().getFullYear()))
})

test("lists ask for main events and the parts of an event are read on their own", async () => {
  const seen: string[] = []
  const api = createTournamentApi(async (path) => {
    seen.push(path)
    return { items: [], totalElements: 0, page: 0, size: 30 } as never
  })

  await api.searchTournaments({ q: "wildcard", level: "MAIN", page: 0 })
  assert.equal(new URL(seen[0], "http://localhost").searchParams.get("level"), "MAIN")
  await api.searchTournaments({ q: "wildcard" })
  assert.equal(new URL(seen[1], "http://localhost").searchParams.has("level"), false, "every tournament by default")

  await api.tournamentFacets(undefined, "MAIN")
  await api.tournamentFacets()
  await api.tournamentParts("cup")
  await api.tournamentParts()
  assert.deepEqual(seen.slice(2), [
    "/admin/tournaments/facets?level=MAIN",
    "/admin/tournaments/facets",
    "/admin/tournaments/parts?parentId=cup",
    "/admin/tournaments/parts",
  ])

  await api.pick("tournaments", { q: "", level: "MAIN", page: 0 })
  assert.equal(new URL(seen[6], "http://localhost").searchParams.get("level"), "MAIN", "the main event picker")
})

test("a main event names its parts under its row and each part opens on its own", async () => {
  await inDom({ url: "http://localhost:5175/tournaments" }, async ({ document }) => {
    const { TournamentList } = await import("../src/features/tournaments/components/tournament-list")
    const { MemoryRouter } = await import("react-router")
    const draw = renderer()
    const row = (id: string, name: string): DocumentView<TournamentContent> => ({
      id,
      version: 0,
      createdAt: "",
      updatedAt: "",
      missingFields: [],
      content: { code: id, name, region: "VN", startsOn: "2026-06-18", endsOn: "2026-07-19", status: "FINISHED" },
    })
    const names = ["Wildcard", "Queens Showdown", "1v1 Tournament", "Open Qualifier", "Closed Qualifier"]
    const parts = new Map([["cup", names.map((name, index) => part(`part-${index}`, `Premier League 2026 - ${name}`))]])
    let opened = ""
    const render = (search: string) =>
      draw(
        <MemoryRouter>
          <TournamentList
            entries={[row("cup", "Premier League 2026"), row("solo", "Solo Cup 2026")]}
            stats={new Map()}
            parts={parts}
            search={search}
            partHref={(id) => `/tournaments/${id}`}
            onOpen={(entry) => {
              opened = entry.id
            }}
          />
        </MemoryRouter>,
      )
    await render("")
    const rows = [...document.querySelectorAll("tbody tr")]
    assert.equal(rows.length, 2, "parts are not rows of their own")
    assert.match(rows[0].textContent ?? "", /5 phần/)
    assert.doesNotMatch(rows[1].textContent ?? "", /phần/, "an event without parts has no parts line")

    const links = [...rows[0].querySelectorAll<HTMLAnchorElement>("a")]
    assert.deepEqual(
      links.map((link) => link.textContent),
      ["Wildcard", "Queens Showdown", "1v1 Tournament", "Open Qualifier"],
    )
    assert.equal(links[0].getAttribute("href"), "/tournaments/part-0")
    assert.match(links[0].title, /^Premier League 2026 - Wildcard · /, "the full name stays one hover away")

    const more = [...rows[0].querySelectorAll("button")].find((button) => /phần khác/.test(button.textContent ?? ""))!
    assert.equal(more.textContent, "+1 phần khác")
    await act(async () => more.click())
    assert.equal(opened, "cup", "the rest wait inside the main event")

    await render("closed")
    assert.equal(document.querySelector("tbody tr a")?.textContent, "Closed Qualifier", "what was searched for leads")
  })
})
