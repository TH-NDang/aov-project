import assert from "node:assert/strict"
import test from "node:test"
import { watchCommand } from "../src/lib/watch-keys.ts"

const ROOM = { typing: false, control: false, slider: false, here: true, bare: false }
const ELSEWHERE = { ...ROOM, here: false }

const named: Record<string, string> = { " ": "Space", "[": "BracketLeft", "]": "BracketRight", "?": "Slash" }
const press = (key: string, more: Partial<Parameters<typeof watchCommand>[0]> = {}) => ({
  key,
  code: named[key] ?? (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key),
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...more,
})

test("every shortcut of the room has its command", () => {
  const table = {
    " ": "TOGGLE",
    k: "TOGGLE",
    j: "BACK_10",
    l: "ON_10",
    ArrowLeft: "BACK_5",
    ArrowRight: "ON_5",
    "[": "STEP_BACK",
    "]": "STEP_ON",
    p: "GAME_BACK",
    n: "GAME_ON",
    s: "SKIP",
    m: "MUTE",
    t: "SIZE",
    "?": "HELP",
  }
  for (const [key, command] of Object.entries(table)) assert.equal(watchCommand(press(key), ROOM), command, key)
})

test("a key that is no shortcut is left to the page", () => {
  for (const key of ["a", "h", "1", "/", "Enter", "Escape", "Tab", "ArrowUp", "ArrowDown", "Home", "F5"])
    assert.equal(watchCommand(press(key), ROOM), null, key)
})

test("a capital letter means the same as a small one", () => {
  assert.equal(watchCommand(press("K"), ROOM), "TOGGLE")
})

test("nothing is taken while something is typed", () => {
  for (const key of ["k", " ", "ArrowLeft", "?"])
    assert.equal(watchCommand(press(key), { ...ROOM, typing: true }), null, key)
})

test("a key with Ctrl, Alt or Meta is the browser's", () => {
  for (const modifier of ["ctrlKey", "altKey", "metaKey"])
    assert.equal(watchCommand(press("l", { [modifier]: true }), ROOM), null, modifier)
})

test("in a room with nothing beside the video there is no place to read the shortcuts", () => {
  assert.equal(watchCommand(press("?"), { ...ROOM, bare: true }), null)
})

test("every other key answers in a room with nothing beside the video", () => {
  const answered = [" ", "k", "j", "l", "ArrowLeft", "ArrowRight", "m", "t"].filter((key) =>
    watchCommand(press(key), { ...ROOM, bare: true }),
  )
  assert.equal(answered.length, 8)
})

test("the space bar is known by what it types and by where it stands", () => {
  assert.equal(watchCommand(press(" ", { code: "" }), ROOM), "TOGGLE")
  assert.equal(watchCommand(press("Spacebar", { code: "Space" }), ROOM), "TOGGLE")
})

test("Space is the button's on a button", () => {
  assert.equal(watchCommand(press(" "), { ...ROOM, control: true }), null)
})

test("a letter on a button is still the video's", () => {
  assert.equal(watchCommand(press("k"), { ...ROOM, control: true }), "TOGGLE")
})

test("the arrows are left to a range, a tab and a radio", () => {
  for (const key of ["ArrowLeft", "ArrowRight"])
    assert.equal(watchCommand(press(key), { ...ROOM, slider: true }), null, key)
})

test("on other pages only play, skip, sound and size answer", () => {
  const answered = [" ", "k", "j", "l", "ArrowLeft", "ArrowRight", "[", "]", "p", "n", "s", "m", "t", "?"].filter(
    (key) => watchCommand(press(key), ELSEWHERE),
  )
  assert.deepEqual(answered, ["k", "s", "m", "t"])
})

test("a keyboard of other letters is read by where its keys stand", () => {
  assert.equal(watchCommand(press("า", { code: "KeyK" }), ROOM), "TOGGLE")
  assert.equal(watchCommand(press("บ", { code: "BracketLeft" }), ROOM), "STEP_BACK")
})

test("a letter that stands elsewhere on the keyboard is read as it is typed", () => {
  assert.equal(watchCommand(press("m", { code: "Semicolon" }), ROOM), "MUTE")
  assert.equal(watchCommand(press("q", { code: "KeyA" }), ROOM), null)
})
