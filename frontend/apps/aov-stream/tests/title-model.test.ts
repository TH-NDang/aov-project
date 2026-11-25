import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView } from "@aov/community-contracts"
import { circuitsToAsk, titleList, titleShelves, trophyForm, type TitleEntry } from "../src/lib/title-model.ts"
import { competition } from "./fixtures/competition.ts"

const NOW = Date.parse("2026-11-25T00:00:00Z")
const CIRCUIT = "circuit-page"

/** A finished season of a league, won by team `a` unless another is named. */
function season(id: string, endsOn: string, winner = "a", extra: object = {}): CompetitionView {
  return competition([{ key: "f", a: winner, b: "z", score: [4, 2] }], {
    id,
    tournament: { name: `Cup ${id}`, status: "FINISHED", tier: "A", competitionType: "LEAGUE", endsOn, ...extra },
    plan: { circuit: "Cup", circuitPageId: CIRCUIT },
  })
}
const entry = ({ id, content: { tournament } }: CompetitionView): TitleEntry => ({
  key: id,
  title: tournament.name,
  date: tournament.endsOn,
  competitionId: id,
})
const titles = (won: CompetitionView[], whole: CompetitionView[] = won) =>
  titleList(won.map(entry), won, new Map([[CIRCUIT, whole]]), NOW)
const from = (...countries: string[]) =>
  Object.fromEntries(countries.map((country, at) => [`t${at}`, { code: `t${at}`, name: `T${at}`, country }]))
const formOf = (tournament: object, teams: object = from("VN", "VN")) => {
  const view = season("x", "2026-05-10", "a", tournament)
  return trophyForm({ ...view, content: { ...view.content, teams } } as CompetitionView)
}

test("the trophy follows the tier and the kind of a competition", () => {
  assert.equal(formOf({ tier: "S", competitionType: "CUP" }), "globe")
  assert.equal(formOf({}), "cup")
  assert.equal(formOf({ competitionType: "CUP" }), "goblet")
  assert.equal(formOf({ tier: "B" }), "shield")
  assert.equal(formOf({ competitionType: "SHOWMATCH" }), "crystal")
})

test("teams of three countries or a region of many make a competition an international one", () => {
  assert.equal(formOf({}, from("VN", "TH", "TW")), "orbit")
  assert.equal(formOf({ competitionType: "CUP" }, from("VN", "TH", "TW")), "globe")
  assert.equal(formOf({ region: "ASIA" }), "orbit")
})

test("a league with a few guests is still the league of its country", () => {
  assert.equal(formOf({}, from("ID", "ID", "ID", "ID", "ID", "MY", "PH")), "cup")
})

test("seasons won one after the other are counted on the latest of them", () => {
  const won = [season("1", "2025-05-10"), season("2", "2025-11-02"), season("3", "2026-05-10")]
  assert.deepEqual(
    titles(won).map(({ key, streak }) => [key, streak]),
    [
      ["3", 3],
      ["2", 1],
      ["1", 1],
    ],
  )
})

test("a season another team won, or a year without one, ends the count", () => {
  const lost = season("2", "2025-11-02", "b")
  assert.deepEqual(
    titles(
      [season("1", "2025-05-10"), season("3", "2026-05-10")],
      [season("1", "2025-05-10"), lost, season("3", "2026-05-10")],
    ).map(({ streak }) => streak),
    [1, 1],
  )
  assert.deepEqual(
    titles([season("1", "2024-05-10"), season("3", "2026-05-10")]).map(({ streak }) => streak),
    [1, 1],
  )
})

test("the winner of the latest season reigns until another is won", () => {
  const [spring, winter] = [season("1", "2026-05-10"), season("2", "2026-11-07", "b")]
  assert.deepEqual(
    titles([spring]).map(({ reigning }) => reigning),
    [true],
  )
  assert.deepEqual(
    titles([spring], [spring, winter]).map(({ reigning }) => reigning),
    [false],
  )
})

test("nobody reigns over a circuit that was not read whole, or that ended long ago", () => {
  const spring = season("1", "2026-05-10")
  assert.equal(titleList([entry(spring)], [spring], new Map(), NOW)[0]!.reigning, false)
  assert.equal(titles([season("1", "2019-05-10")])[0]!.reigning, false)
})

test("only the circuits of titles won lately are asked for", () => {
  const [old, late] = [season("1", "2019-05-10"), season("2", "2026-05-10")]
  assert.deepEqual(circuitsToAsk([entry(old)], [old], NOW), [])
  assert.deepEqual(circuitsToAsk([entry(old), entry(late)], [old, late], NOW), [CIRCUIT])
})

test("a title without a defeat says so once it took enough matches", () => {
  const matches = ["b", "c", "d", "e", "z"].map((other, at) => ({
    key: `m${at}`,
    a: "a",
    b: other,
    score: [3, 1] as [number, number],
  }))
  const whole = competition(matches, {
    id: "w",
    tournament: {
      name: "Cup W",
      status: "FINISHED",
      endsOn: "2026-05-10",
      placements: [{ place: "1", teamId: "a", teamName: "Đội A" }],
    },
  })
  assert.deepEqual(
    titles([whole]).map(({ unbeaten, record }) => [unbeaten, record?.won]),
    [[true, 5]],
  )
  assert.equal(titles([season("1", "2026-05-10")])[0]!.unbeaten, false)
})

test("a title that is not published takes the trophy and the short name of the circuit its name starts with", () => {
  const known = season("1", "2026-05-10", "a", { tier: "B" })
  known.content.circuit = { id: CIRCUIT, code: "cup", name: "Cup", shortName: "CP", published: true } as never
  const [unpublished] = titleList([{ key: "u", title: "Cup Spring 2020", date: "2020-05-10" }], [known], new Map(), NOW)

  assert.deepEqual(
    [unpublished!.form, unpublished!.name, unpublished!.short, unpublished!.year],
    ["shield", "Cup Spring", "CP Spring", "2020"],
  )
})

test("a title nothing is known of is a cup under its own name", () => {
  const [title] = titleList([{ key: "u", title: "Some Open 2018", date: "2018-05-10" }], [], new Map(), NOW)
  assert.deepEqual([title!.form, title!.short, title!.competition], ["cup", "Some Open", null])
})

test("the greatest trophies come first, and many of them stand on shelves of their own", () => {
  const national = ["1", "2", "3", "4", "5"].map((id, at) => season(id, `202${at}-05-10`))
  const world = season("w", "2018-05-10", "a", { tier: "S", competitionType: "CUP" })
  const few = titleShelves(titles([national[0]!, world]))
  const many = titleShelves(titles([...national, world]))

  assert.deepEqual(
    few.map(({ key, titles: shown }) => [key, shown.map((title) => title.form)]),
    [[null, ["globe", "cup"]]],
  )
  assert.deepEqual(
    many.map(({ key, titles: shown }) => [key, shown.length]),
    [
      ["INTERNATIONAL", 1],
      ["NATIONAL", 5],
    ],
  )
})
