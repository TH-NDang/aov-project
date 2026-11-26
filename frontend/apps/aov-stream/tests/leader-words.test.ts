import assert from "node:assert/strict"
import { test } from "node:test"
import type { LeaderKind } from "../src/lib/facts-model.ts"
import { tally, type HeroLine } from "../src/lib/hero-model.ts"
import { leaderFact, leaderTitle, stressed } from "../src/lib/leader-words.ts"

const vi = (text: string) => text
const en = (_: string, text: string) => text

type Counts = Partial<Pick<HeroLine, "picks" | "wins" | "losses" | "bans" | "presence" | "seen">>
const line = (counts: Counts): HeroLine => {
  const { picks = 0, wins = 0, losses = picks - wins, bans = 0 } = counts
  const { presence = picks + bans, seen = presence } = counts
  return {
    hero: { key: "star", id: null, code: null, name: "Star", iconUrl: null },
    picks,
    wins,
    losses,
    bans,
    presence,
    seen,
    blue: tally([]),
    red: tally([]),
    lanes: [],
  }
}
const title = (kind: LeaderKind, own: Counts, others: Counts[] = [], games = 327, shown = games) => {
  const leader = line(own)
  return leaderTitle({ kind, line: leader }, [leader, ...others.map(line)], { games, shown }, vi)
}
const fact = (kind: LeaderKind, own: Counts, games = 327, text = vi, shown = games) =>
  leaderFact({ kind, line: line(own) }, { games, shown }, text, "vi-VN")

test("the words between two asterisks are stressed", () => {
  assert.deepEqual(stressed("won *34* of 45"), [
    { part: "won ", strong: false },
    { part: "34", strong: true },
    { part: " of 45", strong: false },
  ])
})

test("a hero banned in most games is picked in nearly all the others, or it is only seen most", () => {
  assert.equal(title("PRESENT", { picks: 52, bans: 272 }), "Không cấm thì chọn")
  assert.equal(title("PRESENT", { picks: 17, bans: 167 }, [], 196), "Có mặt nhiều nhất")
  assert.equal(title("PRESENT", { picks: 60, bans: 33 }, [], 100), "Có mặt nhiều nhất")
  assert.equal(title("PRESENT", { picks: 0, bans: 100 }, [], 100), "Có mặt nhiều nhất")
})

test("whether a hero is picked when it is not banned is told by the games that show their bans", () => {
  // Of the 327 games 303 show their bans: it is banned in 252 and picked in 48 of them, and in 4 of the others.
  assert.equal(title("PRESENT", { picks: 52, bans: 252, seen: 300 }, [], 327, 303), "Không cấm thì chọn")
  // Banned in 258 and picked in 40 of the 45 left, which is not nearly all of them.
  assert.equal(title("PRESENT", { picks: 47, bans: 258, seen: 298 }, [], 327, 303), "Có mặt nhiều nhất")
})

test("a hero others were picked more than is named by its place", () => {
  assert.equal(title("PICKED", { picks: 109 }, [{ picks: 109 }, { picks: 80 }]), "Được chọn nhiều nhất")
  assert.equal(title("PICKED", { picks: 80 }, [{ picks: 109 }]), "Được chọn nhiều thứ hai")
  assert.equal(title("PICKED", { picks: 70 }, [{ picks: 109 }, { picks: 80 }]), "Được chọn nhiều thứ ba")
})

test("a hero others were banned more than is named by its place", () => {
  assert.equal(title("BANNED", { bans: 16 }, [{ bans: 19 }], 23), "Bị cấm nhiều thứ hai")
  assert.equal(title("BANNED", { bans: 19 }, [{ bans: 16 }], 23), "Bị cấm nhiều nhất")
})

test("the highest win rate says from how many games on it holds", () => {
  const lucky = { picks: 1, wins: 1 }
  assert.equal(title("WINNING", { picks: 45, wins: 34 }, [lucky]), "Tỷ lệ thắng cao nhất, từ 17 ván")
  const short = { picks: 14, wins: 10 }
  assert.equal(title("WINNING", { picks: 54, wins: 37 }, [lucky, short], 187), "Tỷ lệ thắng cao nhất, từ 15 ván")
})

test("without a shorter record above it the highest win rate holds for all", () => {
  assert.equal(title("WINNING", { picks: 9, wins: 8 }, [{ picks: 20, wins: 10 }], 20), "Tỷ lệ thắng cao nhất")
})

test("a hero that a longer and better record is ahead of comes second by win rate", () => {
  assert.equal(
    title("WINNING", { picks: 45, wins: 34 }, [
      { picks: 60, wins: 50 },
      { picks: 1, wins: 1 },
    ]),
    "Tỷ lệ thắng cao thứ hai, từ 17 ván",
  )
})

test("the hero seen most is told by its bans and what came of the games left", () => {
  assert.equal(
    fact("PRESENT", { picks: 52, bans: 272 }),
    "bị cấm *272* trong 327 ván, 55 ván còn lại thì *52* ván được chọn",
  )
  assert.equal(fact("PRESENT", { picks: 4, bans: 19 }, 23), "bị cấm *19* trong 23 ván, *4* ván còn lại đều được chọn")
  assert.equal(fact("PRESENT", { picks: 1, bans: 29 }, 30), "bị cấm *29* trong 30 ván, ván còn lại được chọn")
  assert.equal(
    fact("PRESENT", { picks: 52, bans: 272 }, 327, en),
    "banned in *272* of 327 games, picked in *52* of the other 55",
  )
})

test("the games left are those of the games that show their bans", () => {
  const partly = (own: Counts, text = vi) => fact("PRESENT", own, 327, text, 303)
  assert.equal(
    partly({ picks: 47, bans: 258, seen: 298 }),
    "bị cấm *258* trong 303 ván có ghi lượt cấm, 45 ván còn lại thì *40* ván được chọn",
  )
  assert.equal(
    partly({ picks: 47, bans: 258, seen: 298 }, en),
    "banned in *258* of 303 games that record bans, picked in *40* of the other 45",
  )
  assert.equal(partly({ picks: 9, bans: 303, seen: 303 }), "bị cấm ở cả *303* ván có ghi lượt cấm")
})

test("a hero picked only where nobody wrote down the bans is told by its bans", () => {
  assert.equal(
    fact("PRESENT", { picks: 5, bans: 200, seen: 200 }, 327, vi, 303),
    "bị cấm *200* trong 303 ván có ghi lượt cấm",
  )
})

test("a hero that was not banned is told by the games that show it was not", () => {
  const partly = (own: Counts) => fact("PRESENT", own, 60, vi, 40)
  assert.equal(partly({ picks: 50, seen: 35 }), "được chọn *35* trong 40 ván có ghi lượt cấm, không ai cấm")
  assert.equal(partly({ picks: 50, seen: 40 }), "được chọn ở cả *40* ván có ghi lượt cấm, không ai cấm")
})

test("a hero nobody banned, or nobody picked, is told without the other half", () => {
  assert.equal(fact("PRESENT", { picks: 40 }, 52), "được chọn *40* trong 52 ván, không ai cấm")
  assert.equal(fact("PRESENT", { picks: 52 }, 52), "được chọn ở cả *52* ván, không ai cấm")
  assert.equal(fact("PRESENT", { bans: 40 }, 52), "bị cấm *40* trong 52 ván, không đội nào chọn")
  assert.equal(fact("PRESENT", { bans: 52 }, 52), "bị cấm ở cả *52* ván")
})

test("a hero both teams took in one game is told by the games it was seen in", () => {
  assert.equal(fact("PRESENT", { picks: 11, bans: 5, presence: 15 }, 20), "có mặt *15* trong 20 ván")
})

test("the hero picked most is told by its games and what they won", () => {
  assert.equal(fact("PICKED", { picks: 109, wins: 56 }), "*109* ván, thắng *56*")
  assert.equal(fact("PICKED", { picks: 4, wins: 4 }, 10), "*4* ván, thắng tất cả")
  assert.equal(fact("PICKED", { picks: 4, wins: 0 }, 10), "*4* ván, chưa thắng ván nào")
  assert.equal(fact("PICKED", { picks: 4, wins: 0, losses: 0 }, 10), "*4* ván")
  assert.equal(fact("PICKED", { picks: 1, wins: 0, losses: 0 }, 10, en), "*1* game")
})

test("a hero picked in games nobody knows the winner of did not win all of them", () => {
  assert.equal(fact("PICKED", { picks: 5, wins: 3, losses: 0 }, 10), "*5* ván, thắng *3*")
})

test("a win rate is written from ten games on", () => {
  assert.equal(fact("WINNING", { picks: 45, wins: 34 }), "thắng *34* trong 45 ván, tức *76%*")
  assert.equal(fact("WINNING", { picks: 6, wins: 5 }, 40), "thắng *5* trong 6 ván")
  assert.equal(fact("WINNING", { picks: 6, wins: 6 }, 40), "thắng cả *6* ván")
})

test("the hero banned most is told by its bans and its picks", () => {
  assert.equal(fact("BANNED", { picks: 4, bans: 16 }, 23), "bị cấm *16* trong 23 ván, được chọn *4*")
  assert.equal(fact("BANNED", { bans: 23 }, 23), "bị cấm ở cả *23* ván")
})

test("the bans of a hero and its picks are each told with the games they are out of", () => {
  const partly = (own: Counts, text = vi) => fact("BANNED", own, 23, text, 20)
  assert.equal(
    partly({ picks: 4, bans: 16, seen: 18 }),
    "bị cấm *16* trong 20 ván có ghi lượt cấm, được chọn *4* trong cả 23 ván",
  )
  assert.equal(
    partly({ picks: 4, bans: 16, seen: 18 }, en),
    "banned in *16* of 20 games that record bans, picked in *4* of all 23",
  )
  assert.equal(partly({ bans: 20 }), "bị cấm ở cả *20* ván có ghi lượt cấm")
})
