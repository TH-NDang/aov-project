import assert from "node:assert/strict"
import { test } from "node:test"
import {
  enchantmentCooldownText,
  enchantmentMatchTimeText,
  enchantmentUseFacts,
  enchantmentUsesText,
} from "../src/lib/enchantment-use.ts"

const vi = (vietnamese) => vietnamese
const en = (_, english) => english

test("a cooldown that grows with each use reads as a range", () => {
  assert.equal(enchantmentCooldownText({ cooldownSeconds: 100, cooldownMaxSeconds: 310 }, vi), "100–310 giây")
})

test("a cooldown keeps the game's decimal dot", () => {
  assert.equal(enchantmentCooldownText({ cooldownSeconds: 0.5 }, vi), "0.5 giây")
})

test("a match time on the minute names the minute alone", () => {
  assert.equal(enchantmentMatchTimeText(240, vi), "Phút 4")
})

test("a match time between minutes reads as a clock", () => {
  assert.equal(enchantmentMatchTimeText(270, en), "Minute 4:30")
})

test("a single use reads as once per match", () => {
  assert.equal(enchantmentUsesText(1, vi), "1 lần mỗi trận")
})

test("an unknown activation and missing numbers add no facts", () => {
  assert.deepEqual(enchantmentUseFacts({ activation: "UNKNOWN" }, vi), [])
})

test("an active enchantment lists its use, uses and window in order", () => {
  const facts = enchantmentUseFacts({ activation: "ACTIVE", maxUses: 1, availableFromSeconds: 240 }, vi).map(
    ({ label, value }) => `${label}: ${value}`,
  )
  assert.deepEqual(facts, ["Cách dùng: Kích hoạt", "Số lần dùng: 1 lần mỗi trận", "Có từ: Phút 4"])
})
