import assert from "node:assert/strict"
import { test } from "node:test"
import { barOf, marksOf, pressAt, readAt, staffOf, xOf } from "../src/lib/watch-bar.ts"
import { storyOf } from "../src/lib/watch-story.ts"
import type { Bar, BarCell, BarMark, Story } from "../src/lib/watch-types.ts"
import { BRU_EA, FPL_1S, HKA_LIT, SGP_BME, watchGames, type TestGame } from "./fixtures/watch.ts"

const of = (games: TestGame[], bestOf = 7) => storyOf(watchGames(games, bestOf))
const video = "j8AvYygkzm4"
const sgp = of(SGP_BME)
const bru = of(BRU_EA)
const bar = barOf(sgp, 1300, 2)
const widths = (cell: BarCell) => cell.parts.map(({ width }) => width.toFixed(1)).join(" ")
const lefts = ({ cells }: Bar) => cells.map(({ left, width }) => `${left.toFixed(1)}+${width.toFixed(1)}`)
const end = ({ cells }: Bar) => cells.at(-1)!.left + cells.at(-1)!.width
const x = (second: number, story: Story = sgp, on: Bar = bar) => {
  const at = xOf(story, on, story.videos[0]!, second)
  return `${at.x.toFixed(1)}${at.gap ? " ring" : ""}`
}

test("a bar gives every second of the story the same room", () => {
  assert.equal(bar.unit.toFixed(5), "0.16282")
  assert.equal(bar.folded, false)
  assert.deepEqual(
    bar.cells.map((cell) => `${cell.left.toFixed(1)}: ${widths(cell)}`),
    [
      "0.0: 53.4 147.0",
      "218.4: 58.0 133.8",
      "428.2: 84.2 99.5",
      "629.9: 74.1 112.5",
      "834.5: 81.1 197.2",
      "1130.7: 62.4 102.9",
    ],
  )
  assert.equal(barOf(sgp, 1854, 2).unit.toFixed(5), "0.23761")
})

test("a bar folds where a game would be narrower than 72 px", () => {
  // The shortest game of the match, its last, has 1015 of its 7407 s.
  const shortest = (width: number) => barOf(sgp, width, 2).cells[5]!
  assert.deepEqual([shortest(640).chip, Math.round(shortest(640).width)], [false, 79])
  assert.equal(shortest(615).chip, true)
})

test("a bar without room for its folded games gives the current one none", () => {
  assert.equal(barOf(sgp, 100, 2).cells[2]!.width, 0)
})

test("a bar fills its width", () => {
  for (const width of [712, 1094, 1300, 1854]) assert.ok(Math.abs(end(barOf(sgp, width, 0)) - width) < 0.01)
  assert.ok(Math.abs(end(barOf(bru, 1300, 0)) - 1300) < 0.01)
})

test("a folded bar keeps the current chapter", () => {
  const folded = barOf(sgp, 340, 2, { gap: 8, cut: 3 })
  assert.equal(folded.folded, true)
  assert.deepEqual(
    folded.cells.map(({ chip }) => chip),
    [true, true, false, true, true, true],
  )
  assert.deepEqual(lefts(folded), ["0.0+40.0", "48.0+40.0", "96.0+100.0", "204.0+40.0", "252.0+40.0", "300.0+40.0"])
  assert.deepEqual(folded.cells[0]!.parts, [])
  assert.equal(widths(folded.cells[2]!), "44.5 52.5")
})

test("a game without a time is a blank cell", () => {
  const cell = barOf(bru, 1300, 0).cells[5]!
  assert.deepEqual([cell.blank, cell.chip, cell.width], [true, false, 96])
})

test("a blank cell is as wide as it is asked to be", () => {
  assert.equal(barOf(bru, 1300, 0, { blank: 64 }).cells[5]!.width, 64)
})

test("a blank cell is not folded to a chip", () => {
  const cell = barOf(bru, 500, 0, { gap: 8, cut: 3, blank: 64 }).cells[5]!
  assert.deepEqual([cell.blank, cell.chip, cell.width], [true, false, 64])
})

test("a folded bar with a blank cell fills its width", () => {
  for (const current of [0, 4, 5]) {
    const folded = barOf(bru, 500, current, { gap: 8, cut: 3, blank: 64 })
    assert.equal(folded.folded, true)
    assert.ok(Math.abs(end(folded) - 500) < 0.01)
    assert.equal(folded.cells[current]!.chip, false)
  }
})

test("the staff of a game takes the whole width", () => {
  const staff = (index: number) => widths(staffOf(sgp.chapters[index]!, 340))
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(staff), [
    "89.8 247.2",
    "101.8 235.2",
    "154.5 182.5",
    "133.8 203.2",
    "98.2 238.8",
    "127.2 209.8",
  ])
})

test("the place stands in its part", () => {
  assert.equal(x(685), "3.7")
  assert.equal(x(1546), "58.2")
  assert.equal(x(2432), "202.5")
  assert.equal(x(5600), "467.6")
  assert.equal(x(6208), "570.6")
  assert.equal(x(9930), "1026.2")
})

test("in a break, a wait or a pause the place is a ring in the gap", () => {
  assert.equal(x(1200), "55.4 ring")
  assert.equal(x(2500), "211.4 ring")
  assert.equal(x(4900), "421.2 ring")
  const own = barOf(bru, 1300, 0)
  const [cell] = own.cells.slice(4)
  const gap = cell!.left + cell!.parts[1]!.left + cell!.parts[1]!.width + 2
  assert.equal(x(41850, bru, own), `${gap.toFixed(1)} ring`)
})

test("before and after the match the place stands beside the bar", () => {
  assert.equal(x(300), "-8.0 ring")
  assert.equal(x(12300), "1308.0 ring")
})

test("in an untimed stretch the ring stands at the share that has passed", () => {
  const story = of(FPL_1S, 5)
  const own = barOf(story, 1300, 0)
  assert.equal(x(0, story, own), "8.0 ring")
  assert.equal(x(1189, story, own), "48.0 ring")
  const blank = barOf(bru, 1300, 0).cells[5]!
  assert.equal(x(50000, bru, barOf(bru, 1300, 0)), `${(blank.left + 48).toFixed(1)} ring`)
})

test("in an untimed stretch the ring stands on the games of that video alone", () => {
  const inOther = (game: TestGame, number: number): TestGame => ({
    ...game,
    number,
    link: "https://youtu.be/IHQBJayxnLM",
  })
  const story = of([FPL_1S[0]!, FPL_1S[1]!, inOther(FPL_1S[0]!, 3), inOther(FPL_1S[1]!, 4)], 7)
  const own = barOf(story, 1300, 0)
  assert.equal(xOf(story, own, story.videos[0]!, 1189).x.toFixed(1), "48.0")
  const blank = own.cells[2]!
  assert.equal(xOf(story, own, story.videos[1]!, 1189).x.toFixed(1), (blank.left + 48).toFixed(1))
})

test("a place in a game the bar does not hold stands before it", () => {
  const cells = [staffOf(sgp.chapters[2]!, 340)]
  const own: Bar = { cells, width: 340, unit: 1, folded: false }
  assert.equal(x(6208, sgp, own), "256.9")
  assert.equal(x(9930, sgp, own), "-8.0 ring")
  const single: Bar = { ...own, cells: [staffOf(bru.chapters[0]!, 340)] }
  assert.equal(x(50000, bru, single), "-8.0 ring")
})

test("in a chip the place stands in its middle", () => {
  const folded = barOf(sgp, 340, 2, { gap: 8, cut: 3 })
  assert.equal(x(2000, sgp, folded), "20.0")
})

test("after the game of a chip the place is a ring in its middle", () => {
  const folded = barOf(sgp, 340, 2, { gap: 8, cut: 3 })
  assert.equal(x(2500, sgp, folded), "20.0 ring")
})

test("a mark is a turn or a moment, as high as it matters", () => {
  const marks = marksOf(bar.cells[0]!, 1e9)
  assert.equal(marks.length, 39)
  const heights = (kind: BarMark["kind"]) => [
    ...new Set(marks.filter((mark) => mark.kind === kind).map((m) => m.height)),
  ]
  assert.deepEqual(
    (["BAN", "PICK", "TURRET", "ABYSSAL_DRAGON", "DARK_SLAYER"] as const).flatMap(heights),
    [5, 11, 6, 11, 16],
  )
  assert.deepEqual(
    bar.cells.map((cell) => marksOf(cell, 0).length),
    [39, 34, 31, 33, 33, 32],
  )
})

test("a moment of two is two marks", () => {
  const two = marksOf(bar.cells[0]!, 1e9).filter(({ moment }) => moment?.at === 503)
  assert.equal(two.length, 2)
  assert.ok(two[1]!.x - two[0]!.x >= 3)
})

test("marks keep 3 px and their cell", () => {
  for (const reached of [0, 800, 1e9])
    for (const cell of [...bar.cells, ...sgp.chapters.map((chapter) => staffOf(chapter, 340))]) {
      const marks = marksOf(cell, reached)
      const lanes = [
        marks.filter(({ ahead }) => ahead),
        ...(["A", "B"] as const).map((team) => marks.filter((mark) => mark.team === team)),
      ]
      for (const lane of lanes)
        lane.forEach((mark, index) => {
          assert.ok(mark.x >= 0 && mark.x <= cell.width - 2, `${mark.x} of ${cell.width}`)
          assert.ok(!index || mark.x - lane[index - 1]!.x >= 3 - 1e-9)
        })
    }
})

test("a mark is 2 px wide, and 3 from 1600 px of the track on", () => {
  const marks = (width: number) => [...new Set(barOf(sgp, width, 0).cells.map(({ mark }) => mark))]
  assert.deepEqual([340, 1300, 1599, 1600, 1854].map(marks), [[2], [2], [2], [3], [3]])
  assert.equal(staffOf(sgp.chapters[0]!, 340).mark, 2)
})

test("wide marks keep a pixel free between them, and their cell", () => {
  for (const reached of [0, 1e9])
    for (const cell of barOf(sgp, 1854, 0).cells) {
      const marks = marksOf(cell, reached)
      for (const team of ["A", "B", null] as const) {
        const lane = marks.filter((mark) => mark.team === team)
        lane.forEach((mark, index) => {
          assert.ok(mark.x >= 0 && mark.x <= cell.width - 3, `${mark.x} of ${cell.width}`)
          assert.ok(!index || mark.x - lane[index - 1]!.x >= 4 - 1e-9)
        })
      }
    }
})

test("a wide mark at the end of its part stays in it", () => {
  const turns = SGP_BME[2]!.turns!.replace("PR5753", "PR5875")
  const { cells } = barOf(of([SGP_BME[0]!, SGP_BME[1]!, { ...SGP_BME[2]!, turns }]), 1854, 0)
  const last = marksOf(cells[2]!, 1e9).find(({ second }) => second === 5875)!
  const { left, width } = cells[2]!.parts[0]!
  assert.equal(last.x, left + width - 3)
})

test("marks of nobody stand apart as well", () => {
  const [game] = watchGames([SGP_BME[0]!], 7)
  const note = (id: string) => ({ id, kind: "NOTE" as const, atSeconds: 300, title: id })
  game!.content.timeline!.events = [note("one"), note("two")]
  const [one, two] = marksOf(staffOf(storyOf([game!]).chapters[0]!, 900), 1e9).filter(({ kind }) => kind === "NOTE")
  assert.deepEqual([one!.team, two!.team], [null, null])
  assert.ok(two!.x - one!.x >= 3)
})

test("a turn that is timed outside the draft has no mark", () => {
  const turns = SGP_BME[0]!.turns!.replace("BB685", "BB600").replace("PR917", "PR1600")
  const [chapter] = of([{ ...SGP_BME[0]!, turns, moments: "" }]).chapters
  assert.equal(marksOf(staffOf(chapter!, 900), 1e9).length, 16)
})

test("marks stay in a cell that has no room for all of them", () => {
  const cell = { ...staffOf(sgp.chapters[0]!, 72), left: 0 }
  for (const { x: at } of marksOf(cell, 0)) assert.ok(at >= 0 && at <= 70)
})

test("marks stay in their part of the game, also where it is too narrow for all of them", () => {
  for (const cell of barOf(sgp, 840, 0, { gap: 8, cut: 3 }).cells)
    for (const { x: at, kind } of marksOf(cell, 0)) {
      const { left, width } = cell.parts[kind === "BAN" || kind === "PICK" ? 0 : 1]!
      assert.ok(at >= left && at <= left + width - 2 + 1e-9, `${kind} at ${at} of ${left}–${left + width}`)
    }
})

test("what is ahead has no lane", () => {
  const marks = marksOf(bar.cells[0]!, 400)
  assert.ok(marks.some(({ ahead }) => ahead) && marks.some(({ ahead }) => !ahead))
  for (const { ahead, at, team } of marks) {
    assert.equal(ahead, at > 400)
    assert.equal(team === null, ahead)
  }
})

test("a mark that has just been reached is no longer ahead", () => {
  const [first] = marksOf(bar.cells[0]!, 1e9)
  assert.equal(marksOf(bar.cells[0]!, first!.at)[0]!.ahead, false)
  assert.equal(marksOf(bar.cells[0]!, first!.at - 0.1)[0]!.ahead, true)
})

test("a mark belongs to its team, whatever side that plays", () => {
  const [first, second] = [marksOf(bar.cells[0]!, 1e9)[0]!, marksOf(bar.cells[1]!, 1e9)[0]!]
  assert.equal(first.turn!.side, "BLUE")
  assert.equal(first.team, "B")
  assert.equal(second.turn!.side, "BLUE")
  assert.equal(second.team, "A")
})

test("a point of the bar reads the game, the second and the mark near it", () => {
  const tower = readAt(bar, 372, 3259)!
  assert.equal(tower.cell.chapter.number, 2)
  assert.equal(tower.part!.kind, "PLAY")
  assert.equal(tower.mark!.kind, "TURRET")
  assert.equal(tower.mark!.team, "B")
  const pick = readAt(bar, 455, 3259)!
  assert.deepEqual([pick.cell.chapter.number, pick.part!.kind, pick.mark!.kind], [3, "DRAFT", "PICK"])
  const ahead = readAt(bar, 1218, 3259)!
  assert.deepEqual([ahead.mark!.kind, ahead.mark!.ahead], ["ABYSSAL_DRAGON", true])
})

test("a mark is meant from 6 px on either side of it", () => {
  const cells = [staffOf(of([{ ...SGP_BME[0]!, turns: "", moments: "400Bt" }]).chapters[0]!, 900)]
  const own: Bar = { cells, width: 900, unit: 1, folded: false }
  const [{ x: at }] = marksOf(cells[0]!, 1e9) as [BarMark]
  const meant = (away: number) => readAt(own, at + away, 1e9)!.mark !== null
  assert.deepEqual([-8, -5, 0, 5, 8].map(meant), [false, true, true, true, false])
})

test("what is read of a mark stands at the mark, and what is read beside one where it is pointed at", () => {
  const read = readAt(bar, 372, 3259)!
  assert.equal(read.x, read.cell.left + read.mark!.x)
  assert.equal(readAt(bar, 285, 3259)!.x, 285)
})

test("a point between two chapters reads nothing", () => {
  assert.equal(readAt(bar, 210, 3259), null)
  assert.equal(pressAt(null), null)
})

test("a chip reads its game alone, and nothing is played from it", () => {
  const folded = readAt(barOf(sgp, 340, 2, { gap: 8, cut: 3 }), 10, 0)!
  assert.deepEqual([folded.cell.chapter.number, folded.part, folded.second, folded.x], [1, null, null, 20])
  assert.equal(pressAt(folded), null)
})

test("a blank cell reads its game alone, and nothing is played from it", () => {
  const own = barOf(bru, 1300, 0)
  const blank = readAt(own, own.cells[5]!.left + 10, 0)!
  assert.deepEqual([blank.cell.chapter.number, blank.part, blank.mark], [6, null, null])
  assert.equal(pressAt(blank), null)
})

test("a press on a mark plays from a little before it", () => {
  assert.deepEqual(pressAt(readAt(bar, 372, 3259)), { video, second: 4275 })
  assert.deepEqual(pressAt(readAt(bar, 455, 3259)), { video, second: 5496 })
  assert.deepEqual(pressAt(readAt(bar, 1218, 3259)), { video, second: 11735 })
})

test("a press on a mark never plays from before its part", () => {
  const [chapter] = of([{ ...SGP_BME[0]!, moments: "4Bt" }]).chapters
  const cells = [staffOf(chapter!, 900)]
  const own: Bar = { cells, width: 900, unit: 1, folded: false }
  const mark = marksOf(cells[0]!, 1e9).find(({ kind }) => kind === "TURRET")!
  assert.deepEqual(pressAt(readAt(own, mark.x, 1e9)), { video, second: 1541 })
})

test("a press beside a mark plays that second", () => {
  const read = readAt(bar, 285, 3259)!
  assert.equal(read.mark, null)
  assert.deepEqual(pressAt(read), { video, second: read.second })
  assert.equal(Math.round(read.second!), 3741)
})

test("a linked game is read and pressed by the second of its video", () => {
  const story = of(HKA_LIT, 5)
  const own = barOf(story, 1300, 0)
  const { left, width } = own.cells[1]!
  const read = readAt(own, left + width / 2, 0)!
  assert.equal(read.part!.kind, "GAME")
  assert.equal(Math.round(read.second!), 6504)
  assert.deepEqual(pressAt(read), { video: story.videos[0], second: read.second })
})
