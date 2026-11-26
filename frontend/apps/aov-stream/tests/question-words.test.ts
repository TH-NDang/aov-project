import assert from "node:assert/strict"
import { test } from "node:test"
import { conditions, NOTHING_ASKED, type Question } from "../src/lib/finder-model.ts"
import {
  conditionWords,
  foundWords,
  heroNames,
  lengthWords,
  namesOf,
  partiesWords,
  questionWords,
  scoredParty,
} from "../src/lib/question-words.ts"
import { roundRobinView } from "./fixtures/lineups.ts"

const vi = (vietnamese: string) => vietnamese
const en = (_: string, english: string) => english
const view = roundRobinView()
view.content.players = { shin: { code: "shin", nickname: "Shin" } } as never
const names = namesOf(view, vi)
const hero = (name: string) => ({ key: name, id: null, code: name, name, iconUrl: null })
const [marja, violet, rouie, zata] = ["Marja", "Violet", "Rouie", "Zata"].map(hero) as [
  ReturnType<typeof hero>,
  ReturnType<typeof hero>,
  ReturnType<typeof hero>,
  ReturnType<typeof hero>,
]
const asked = (question: Partial<Question>): Question => ({ ...NOTHING_ASKED, ...question })
const say = (question: Partial<Question>) => questionWords(asked(question), names, vi, "vi-VN")
const found = (question: Partial<Question>) => foundWords(asked(question), names, vi, "vi-VN")
const english = (question: Partial<Question>) => foundWords(asked(question), namesOf(view, en), en, "en-US")

test("a team is called by its short name, and an unknown one says so", () => {
  assert.equal(names.team("x"), "X")
  assert.equal(names.team("nobody"), "đội chưa rõ")
  assert.equal(names.player("nobody"), "tuyển thủ chưa rõ")
})

test("heroes are listed with one và, before the last", () => {
  assert.equal(heroNames([], vi), "")
  assert.equal(heroNames([marja], vi), "Marja")
  assert.equal(heroNames([marja, violet], vi), "Marja và Violet")
  assert.equal(heroNames([marja, violet, rouie], vi), "Marja, Violet và Rouie")
  assert.equal(heroNames([marja, violet, rouie], en), "Marja, Violet and Rouie")
})

test("nothing asked says nothing", () => {
  assert.equal(say({}), "")
  assert.equal(found({}), "")
})

test("a question reads as one sentence", () => {
  assert.equal(say({ pick: [marja], vs: [violet], ban: [rouie] }), "Marja gặp Violet khi Rouie bị cấm")
  assert.equal(say({ vs: [violet], opp: "y" }), "gặp Violet của Y")
  assert.equal(say({ team: "x", opp: "y" }), "X gặp Y")
})

test("a team plays its heroes, and a player plays one for the team", () => {
  assert.equal(say({ team: "x", pick: [marja, zata] }), "X chơi Marja và Zata")
  assert.equal(say({ player: "shin", pick: [marja] }), "Shin chơi Marja")
  assert.equal(say({ player: "shin", pick: [marja], team: "x" }), "Shin chơi Marja cho X")
  assert.equal(say({ player: "shin", team: "x" }), "X có Shin")
  assert.equal(say({ player: "shin", pick: [marja, zata] }), "Marja và Zata, có Shin")
})

test("two heroes asked of nobody were on one team", () => {
  assert.equal(partiesWords(asked({ pick: [marja, zata] }), names, vi), "Marja và Zata cùng đội")
  assert.equal(partiesWords(asked({ pick: [marja, zata], vs: [violet] }), names, vi), "Marja và Zata gặp Violet")
})

test("a ban says who made it", () => {
  assert.equal(say({ ban: [rouie] }), "Rouie bị cấm")
  assert.equal(say({ banA: [rouie] }), "đội này cấm Rouie")
  assert.equal(say({ banB: [rouie], opp: "y" }), "gặp Y khi Y cấm Rouie")
  assert.equal(say({ pick: [marja], ban: [rouie], banB: [zata] }), "Marja khi Rouie bị cấm và đối thủ cấm Zata")
})

test("a team asked for its own ban is named once", () => {
  assert.equal(say({ team: "x", banA: [rouie] }), "X cấm Rouie")
  assert.equal(say({ team: "x", banA: [rouie], ban: [zata] }), "X cấm Rouie khi Zata bị cấm")
  assert.equal(say({ team: "x", opp: "y", banA: [rouie] }), "X gặp Y khi X cấm Rouie")
})

test("the rest of a question follows in short parts", () => {
  assert.equal(
    say({ pick: [marja], side: "BLUE", won: false, max: 9, from: "2026-11-01", to: "2026-11-01" }),
    "Marja, bên xanh, thua, dưới 10 phút, ngày 01/11",
  )
  assert.equal(say({ pick: [marja], lane: "TOP", turn: 5 }), "Marja, đường Caesar, chọn ở lượt 5")
  assert.equal(say({ ban: [rouie], turn: 1 }), "Rouie bị cấm, ở lượt 1")
  assert.equal(say({ pick: [marja], vs: [violet], duel: true }), "Marja gặp Violet, cùng đường")
  assert.equal(say({ from: "2026-11-01", to: "2026-11-08" }), "từ 01/11 đến 08/11")
})

test("the best player of a game is named once", () => {
  assert.equal(say({ player: "shin", mvp: true }), "Shin là MVP")
  assert.equal(say({ player: "shin", mvp: true, pick: [marja] }), "Shin chơi Marja, là MVP")
  assert.equal(say({ player: "shin", mvp: true, team: "x" }), "X có Shin, Shin là MVP")
})

test("a side of the map that won is said in one breath", () => {
  assert.equal(say({ side: "BLUE", won: true }), "bên xanh thắng")
  assert.equal(english({ side: "BLUE", won: true }), "won on the blue side")
})

test("a length is one of those offered or the minutes asked for", () => {
  assert.equal(lengthWords({ min: null, max: 9 }, vi), "dưới 10 phút")
  assert.equal(lengthWords({ min: 10, max: 14 }, vi), "10–15 phút")
  assert.equal(lengthWords({ min: 20, max: null }, vi), "từ 20 phút")
  assert.equal(lengthWords({ min: 12, max: 12 }, vi), "dài 12 phút")
  assert.equal(lengthWords({ min: 11, max: 13 }, vi), "11–13 phút")
})

test("a team or a player alone owns the games it is counted in", () => {
  assert.equal(found({ team: "x" }), "của X")
  assert.equal(found({ player: "shin", won: true }), "của Shin, thắng")
  assert.equal(found({ team: "x", ban: [rouie] }), "của X khi Rouie bị cấm")
  assert.equal(found({ team: "x", banA: [rouie] }), "X cấm Rouie")
  assert.equal(found({ player: "shin", mvp: true }), "Shin là MVP")
  assert.equal(found({ pick: [marja], vs: [violet] }), "Marja gặp Violet")
})

test("in English the number of games is joined by a preposition", () => {
  assert.equal(english({ pick: [marja], vs: [violet] }), "of Marja against Violet")
  assert.equal(english({ vs: [violet] }), "against Violet")
  assert.equal(english({ ban: [rouie] }), "with Rouie banned")
  assert.equal(english({ max: 9 }), "under 10 minutes")
  assert.equal(english({ pick: [marja], lane: "SUPPORT" }), "of Marja, as support")
})

test("a score belongs to whoever the question names first", () => {
  const party = (question: Partial<Question>) => scoredParty(asked(question), names, vi)
  assert.equal(party({ pick: [marja], vs: [violet] }), "Marja")
  assert.equal(party({ pick: [marja], team: "x" }), "X")
  assert.equal(party({ pick: [marja], team: "x", player: "shin" }), "Shin")
  assert.equal(party({ opp: "y" }), "Đội này")
})

test("every condition has words of its own", () => {
  const question = asked({
    pick: [marja],
    vs: [violet],
    team: "x",
    player: "shin",
    mvp: true,
    duel: true,
    lane: "DRAGON",
    turn: 5,
    side: "RED",
    won: true,
    from: "2026-11-01",
    min: 20,
  })
  assert.deepEqual(
    conditions(question).map((condition) => conditionWords(condition, question, names, vi, "vi-VN")),
    [
      "Marja",
      "Violet",
      "X",
      "Shin",
      "đường Rồng",
      "lượt 5",
      "bên đỏ",
      "thắng",
      "cùng đường",
      "là MVP",
      "từ 01/11",
      "từ 20 phút",
    ],
  )
})
