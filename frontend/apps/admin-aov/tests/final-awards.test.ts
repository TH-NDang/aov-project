import assert from "node:assert/strict"
import { test } from "node:test"
import { awardGroups } from "../src/features/esports/model/award-groups"
import { withNextRecipient } from "../src/features/tournaments/model/final-table-model"

const award = (title: string, recipientName: string) => ({ title, recipientName })

test("awards of one title read together, in the order the titles first appear", () => {
  const groups = awardGroups([award("Line-up", "Fish"), award("MVP", "Vịt"), award("Line-up", "Shin")])

  assert.deepEqual(
    groups.map((group) => [group.title, group.awards.map((row) => row.recipientName)]),
    [
      ["Line-up", ["Fish", "Shin"]],
      ["MVP", ["Vịt"]],
    ],
  )
})

test("another recipient of an award follows the one it starts from", () => {
  assert.deepEqual(
    withNextRecipient([award("Line-up", "Fish"), award("MVP", "Vịt")], 0).map((row) => [row.title, row.recipientName]),
    [
      ["Line-up", "Fish"],
      ["Line-up", ""],
      ["MVP", "Vịt"],
    ],
  )
})
