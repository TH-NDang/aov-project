import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  CommunityProfile,
  DocumentView,
  GameContent,
  LinkMention,
  SeriesContent,
  TournamentAward,
  TournamentContent,
} from "@aov/community-contracts"
import type { tournamentApi } from "../src/features/tournaments/api/tournament-api"
import { LinkTakenError, linkMention, runLinks, undoLinks } from "../src/features/tournaments/model/link-review-runner"
import {
  linkKey,
  mentionNames,
  mentionText,
  nameCandidates,
  nameIndex,
  pageCandidates,
  rowSuggestion,
  writtenName,
  type Named,
} from "../src/features/tournaments/model/link-suggestion-model"
import { game, match, view } from "./fixtures/match-records"

const mention = (extra: Partial<LinkMention> = {}): LinkMention => ({
  kind: "GAME_MVP",
  recordId: "g1",
  tournamentId: "t",
  tournamentName: "Cup",
  seriesId: "s",
  gameNumber: 1,
  label: "Azure vs Crimson",
  text: "TinSr",
  ...extra,
})

test("the note about where line-ups come from is not part of the name", () => {
  const text = "TinSr Tuyển thủ theo vị trí được suy ra từ đội hình giải trên Liquipedia, chưa đối chiếu từng ván."
  assert.equal(mentionText(text), "TinSr")
})

test("a sentence about who credited the player is not part of the name", () => {
  assert.equal(mentionText("LạcHQ LạcHQ was credited as the POTM on two pages."), "LạcHQ")
})

test("the brackets that tell a page from a namesake are not shown", () => {
  assert.equal(writtenName("Penguin (Vietnamese player)").name, "Penguin")
  assert.equal(writtenName("Sun_(Vietnamese_Player)Sun").name, "Sun")
})

test("a name written as a page and its label matches by either", () => {
  const written = writtenName("GustaiA|WHATIF")
  assert.equal(written.name, "WHATIF")
  assert.deepEqual(written.keys, ["whatif", "gustaia"])
})

test("accents, case and spacing do not tell names apart, but different digits do", () => {
  assert.equal(linkKey("Anh Đức"), linkKey("anhduc"))
  assert.notEqual(linkKey("7K²"), linkKey("7K2"))
})

test("a match MVP row that lists players names each of them once", () => {
  const names = mentionNames({ kind: "SERIES_MVP", text: "WeiZ, WeiZ, Xcen" })
  assert.deepEqual(
    names.map((name) => name.name),
    ["WeiZ", "Xcen"],
  )
})

const player = (id: string, name: string, extra: Partial<Named> = {}): Named => ({
  id,
  name,
  names: [name],
  detail: "Azure",
  ...extra,
})
const none = nameIndex([])

test("a player of the match is found by an alias, whatever the accents", () => {
  const roster = [player("p", "VinhHoang", { names: ["VinhHoang", "Trần Vĩnh", "TinSr"] })]
  const rows = nameCandidates(writtenName("tinsr"), roster, none)
  assert.deepEqual(
    rows.map((row) => [row.id, row.exact, row.inside]),
    [["p", true, true]],
  )
})

test("players of the match come before namesakes from elsewhere and before names that only resemble", () => {
  const inside = [player("near", "Fishy"), player("own", "Fish")]
  const rows = nameCandidates(writtenName("Fish"), inside, nameIndex([player("else", "FISH")]))
  assert.deepEqual(
    rows.map((row) => row.id),
    ["own", "else", "near"],
  )
})

test("someone who played for one of the teams before comes ahead of a stranger of that name", () => {
  const strangers = nameIndex([player("stranger", "Koffi"), player("former", "Koffi")])
  const rows = nameCandidates(writtenName("Koffi"), [], strangers, { near: [player("former", "Koffi")] })
  assert.deepEqual(
    rows.map((row) => row.id),
    ["former", "stranger"],
  )
})

test("the club's team of this event comes before its namesake from elsewhere", () => {
  const rows = nameCandidates(
    writtenName("eArena"),
    [player("women", "eArena Women")],
    nameIndex([player("club", "eArena")]),
    { resemblingFirst: true },
  )
  assert.deepEqual(
    rows.map((row) => row.id),
    ["women", "club"],
  )
})

const suggest = (kind: LinkMention["kind"], text: string, inside: Named[], everyone: Named[] = []) =>
  rowSuggestion({ kind, text }, (written) => nameCandidates(written, inside, nameIndex(everyone)))

test("one exact match from the match is certain", () => {
  assert.deepEqual(
    suggest("GAME_MVP", "Fish", [player("p", "Fish")]).certain?.map((row) => row.id),
    ["p"],
  )
})

test("two exact matches, or only one from elsewhere, are not certain", () => {
  assert.equal(suggest("GAME_MVP", "Fish", [player("p", "Fish"), player("q", "FISH")]).certain, null)
  assert.equal(suggest("GAME_MVP", "Fish", [], [player("p", "Fish")]).certain, null)
})

test("a match MVP row that lists several players leaves the choice to the editor", () => {
  const inside = [player("p", "Fish"), player("q", "Sea")]
  assert.equal(suggest("SERIES_MVP", "Fish, Sea", inside).certain, null)
})

const page = (id: string, kind: CommunityProfile["kind"], name: string) =>
  ({ id, kind, code: id, content: { name } }) as CommunityProfile

test("casters are certain only when every one of them has a single person page of that name", () => {
  const pages = [page("one", "PERSON", "Hoàng Sơn"), page("two", "PERSON", "Trần Nam")]
  const row = (text: string) =>
    rowSuggestion({ kind: "SERIES_BROADCAST", text }, (written) => pageCandidates(written, pages))
  assert.deepEqual(
    row("Hoàng Sơn, Trần Nam").certain?.map((person) => person.id),
    ["one", "two"],
  )
  assert.equal(row("Hoàng Sơn, Huy Popper").certain, null)
})

test("a player who shares a caster's name is offered but not certain", () => {
  const row = rowSuggestion({ kind: "SERIES_BROADCAST", text: "Laoban" }, (written) =>
    pageCandidates(written, [page("laoban", "PLAYER", "Laoban")]),
  )
  assert.deepEqual([row.names[0]!.candidates.length, row.certain], [1, null])
})

test("pages of another kind or with a longer name are not the caster", () => {
  const pages = [page("team", "TEAM", "JEX"), page("long", "PERSON", "JEX Studio")]
  assert.deepEqual(pageCandidates(writtenName("JEX"), pages), [])
})

type Api = Pick<typeof tournamentApi, "read" | "save">
/** Records kept in memory, so a link and its undo go through the same versions as the real service. */
function memory(...records: DocumentView<unknown>[]) {
  const rows = new Map(records.map((record) => [record.id, record]))
  const api = {
    read: async (_kind: string, id: string) => rows.get(id),
    save: async (_kind: string, entry: DocumentView<unknown>, content: unknown) => {
      const saved = { ...entry, content, version: entry.version + 1 }
      rows.set(entry.id, saved)
      return saved
    },
  } as unknown as Api
  return { api, content: <T>(id: string) => rows.get(id)!.content as T }
}
const choice = { id: "vinh-hoang", name: "VinhHoang" }

test("linking a game MVP sets the player and keeps the note as it is", async () => {
  const store = memory(view("g1", { ...game(1).content, note: "MVP: TinSr" }))
  await linkMention(store.api, mention(), [choice])
  const { mvpPlayerId, note } = store.content<GameContent>("g1")
  assert.deepEqual([mvpPlayerId, note], ["vinh-hoang", "MVP: TinSr"])
})

test("undoing a game MVP takes the player off again", async () => {
  const store = memory(game(1))
  const unlink = await linkMention(store.api, mention(), [choice])
  await unlink()
  assert.equal(store.content<GameContent>("g1").mvpPlayerId, null)
})

test("an MVP somebody set meanwhile is neither replaced nor undone", async () => {
  const taken = memory(view("g1", { ...game(1).content, mvpPlayerId: "other" }))
  await assert.rejects(linkMention(taken.api, mention(), [choice]), LinkTakenError)

  const store = memory(game(1))
  const unlink = await linkMention(store.api, mention(), [choice])
  await store.api.save("games", (await store.api.read("games", "g1"))!, {
    ...store.content<GameContent>("g1"),
    mvpPlayerId: "other",
  })
  await assert.rejects(unlink(), LinkTakenError)
  assert.equal(store.content<GameContent>("g1").mvpPlayerId, "other")
})

test("a broadcast row links every caster of the match at once", async () => {
  const store = memory(match())
  const people = [
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
  ]
  await linkMention(store.api, mention({ kind: "SERIES_BROADCAST", recordId: "s" }), people)
  assert.deepEqual(store.content<SeriesContent>("s").broadcast, [
    { pageId: "one", role: "CASTER" },
    { pageId: "two", role: "CASTER" },
  ])
})

const awards: TournamentAward[] = [
  { title: "Best Mid", recipientName: "Fish (Cá)|Fish" },
  { title: "Team of the Week", recipientName: "Sea", teamName: "eArena" },
  { title: "Team of the Week", recipientName: "Maris", teamName: "eArena" },
]
const tournament = () => view("t", { code: "cup", name: "Cup", region: "VN", awards } as TournamentContent)
const award = (kind: "AWARD_PLAYER" | "AWARD_TEAM", label: string, text: string) =>
  mention({ kind, recordId: "t", label, text, seriesId: null, gameNumber: null })

test("an award takes the record's own name with the link, and its undo brings the written name back", async () => {
  const store = memory(tournament())
  const unlink = await linkMention(store.api, award("AWARD_PLAYER", "Best Mid", "Fish (Cá)|Fish"), [
    { id: "fish", name: "Fish" },
  ])
  const first = () => store.content<TournamentContent>("t").awards![0]!
  assert.deepEqual([first().playerId, first().recipientName], ["fish", "Fish"])
  await unlink()
  assert.deepEqual([first().playerId, first().recipientName], [null, "Fish (Cá)|Fish"])
})

test("two awards written alike are linked one at a time, the first open one first", async () => {
  const store = memory(tournament())
  const row = award("AWARD_TEAM", "Team of the Week", "eArena")
  await linkMention(store.api, row, [{ id: "earena", name: "eArena" }])
  const teams = () => store.content<TournamentContent>("t").awards!.map((entry) => entry.teamId ?? null)
  assert.deepEqual(teams(), [null, "earena", null])
  await linkMention(store.api, row, [{ id: "earena", name: "eArena" }])
  assert.deepEqual(teams(), [null, "earena", "earena"])
})

test("a row that fails does not stop the rows after it, and one undo takes back what was linked", async () => {
  const store = memory(view("g1", { ...game(1).content, mvpPlayerId: "other" }), view("g2", game(2).content))
  const run = await runLinks(store.api, [
    { mention: mention(), choices: [choice] },
    { mention: mention({ recordId: "g2" }), choices: [choice] },
  ])
  assert.deepEqual([run.linked.length, run.failed.length], [1, 1])
  await undoLinks(run)
  assert.deepEqual(
    [store.content<GameContent>("g1").mvpPlayerId, store.content<GameContent>("g2").mvpPlayerId],
    ["other", null],
  )
})
