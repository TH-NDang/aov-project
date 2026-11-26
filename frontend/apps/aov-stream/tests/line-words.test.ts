import assert from "node:assert/strict"
import { test } from "node:test"
import { findGames, NOTHING_ASKED, type Question } from "../src/lib/finder-model.ts"
import { heroByKey } from "../src/lib/game-feed.ts"
import { askedBans, askedSeat, lineWords, type Asked } from "../src/lib/line-words.ts"
import { feedOf, five, type TestGame } from "./fixtures/lineups.ts"

const vi = (vietnamese: string) => vietnamese
const en = (_: string, english: string) => english
const game: TestGame = {
  id: "g1",
  series: "s1",
  number: 3,
  winner: "RED",
  seconds: 1581,
  mvp: "cat",
  blue: { team: "x", picks: ["star", ...five("a").slice(1)], players: ["ann"], bans: ["feared", "hated"] },
  red: { team: "y", picks: five("b"), players: ["cat"], bans: ["loved"] },
}
const feed = feedOf([game])
const hero = (key: string) => heroByKey(feed, key)!
const asked = (question: Partial<Question>) => findGames(feed.games, { ...NOTHING_ASKED, ...question })[0]!
const say = (question: Partial<Question> & Asked, text = vi, tag = "vi-VN") =>
  lineWords(feed.view, asked(question), question, text, tag)

test("a line says its day, who beat whom, how long it took and the best player", () => {
  assert.equal(say({}), "RR, 01/11, ván 3, Y thắng X, 26:21, X bên xanh, MVP cat")
  assert.equal(say({}, en, "en-US"), "RR, 11/01, game 3, Y beat X, 26:21, X on the blue side, MVP cat")
})

test("the winner comes first from whichever side the line is seen", () => {
  assert.match(say({ team: "y" }), /ván 3, Y thắng X/)
  assert.match(say({ team: "x" }), /ván 3, Y thắng X/)
})

test("a line about a hero says who played it, and who banned what was asked about", () => {
  const question = { pick: [hero("star")], ban: [hero("feared"), hero("loved")] }
  assert.match(say(question), /26:21, ann chơi STAR, X cấm FEARED, Y cấm LOVED, X bên xanh/)
})

test("a game without a winner, a match or a length says what is known", () => {
  const bare = feedOf([{ ...game, winner: null, seconds: undefined, series: "elsewhere", mvp: undefined }])
  const [found] = findGames(bare.games, NOTHING_ASKED)
  assert.equal(lineWords(bare.view, found!, {}, vi, "vi-VN"), "ván 3, X gặp Y, X bên xanh")
})

test("the seat a list is about is that of its one hero, or that of its player", () => {
  const found = asked({})
  assert.equal(askedSeat(found, { pick: [hero("star")] })?.playerId, "ann")
  assert.equal(askedSeat(found, { player: "ann" })?.hero.key, "star")
  assert.equal(askedSeat(found, { pick: [hero("a2")], player: "ann" })?.hero.key, "a2")
  assert.equal(askedSeat(found, { pick: [hero("star"), hero("a2")] }), null)
  assert.equal(askedSeat(found, {}), null)
})

test("a ban is struck at the side that made it", () => {
  const keys = (question: Asked) => {
    const bans = askedBans(asked({}), question)
    return [bans.a.map((ban) => ban.hero.key), bans.b.map((ban) => ban.hero.key)]
  }
  assert.deepEqual(keys({ ban: [hero("feared"), hero("loved")] }), [["feared"], ["loved"]])
  assert.deepEqual(keys({ banA: [hero("feared"), hero("loved")] }), [["feared"], []])
  assert.deepEqual(keys({ banB: [hero("hated")] }), [[], []])
})
