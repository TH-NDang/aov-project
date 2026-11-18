import assert from "node:assert/strict"
import { test } from "node:test"
import type { ProfileMember } from "@aov/community-contracts"
import { memberWords, rosterGroups } from "../src/features/community/model/team-roster-model.ts"

const member = (name: string, extra: Partial<ProfileMember> = {}): ProfileMember => ({ name, role: "", ...extra })

test("members group by their standing code in lineup, bench, staff and former order", () => {
  const { groups } = rosterGroups([
    member("Gone", { standing: "LEFT" }),
    member("Coach", { standing: "STAFF" }),
    member("Starter", { standing: "ACTIVE" }),
    member("Unknown"),
    member("Bench", { standing: "SUBSTITUTE" }),
  ])

  assert.deepEqual(
    groups.map((group) => [group.standing, group.rows.map((row) => row.member.name)]),
    [
      ["ACTIVE", ["Starter"]],
      ["SUBSTITUTE", ["Bench"]],
      ["STAFF", ["Coach"]],
      ["LEFT", ["Gone"]],
      [null, ["Unknown"]],
    ],
  )
})

test("the bench is marked from the code, whatever the status says", () => {
  const { groups } = rosterGroups([
    member("Bench", { standing: "SUBSTITUTE", status: "Substitute" }),
    member("Starter", { standing: "ACTIVE", status: "Dự bị" }),
  ])

  assert.deepEqual(
    groups.flatMap((group) => group.rows.map((row) => [row.member.name, row.bench])),
    [
      ["Starter", false],
      ["Bench", true],
    ],
  )
})

test("a coded member's status loses the standing it leads and the shared season, and keeps its notes", () => {
  const { season, groups } = rosterGroups([
    member("Jungler", { standing: "ACTIVE", status: "Chính thức · Mượn từ đội khác · AOG 2026" }),
    member("Trialist", { status: "Thử việc · AOG 2026" }),
  ])

  assert.equal(season, "AOG 2026")
  assert.deepEqual(
    groups.flatMap((group) => group.rows.map((row) => [row.member.name, row.note])),
    [
      ["Jungler", "Mượn từ đội khác"],
      ["Trialist", "Thử việc"],
    ],
  )
})

test("a coded member's role and standing read in the reader's language with their notes kept", () => {
  const jungler = member("Jungler", {
    lane: "JUNGLE",
    standing: "SUBSTITUTE",
    role: "Đi rừng · Đội trưởng",
    status: "Dự bị · AOG 2026",
  })
  const english = (_vi: string, en: string) => en

  assert.deepEqual(memberWords(jungler, english), { role: "Jungle", standing: "Substitute · AOG 2026", captain: "" })
  assert.deepEqual(memberWords(member("Coach", { role: "HLV trưởng", status: "Thử việc" }), english), {
    role: "HLV trưởng",
    standing: "Thử việc",
    captain: "",
  })
})

test("a captain is marked from the flag in the reader's language, never from the role's words", () => {
  const english = (_vi: string, en: string) => en
  const vietnamese = (vi: string) => vi

  assert.equal(
    memberWords(member("Jungler", { lane: "JUNGLE", role: "Đi rừng", captain: true }), english).captain,
    "Captain",
  )
  assert.equal(memberWords(member("Jungler", { captain: true }), vietnamese).captain, "Đội trưởng")
  assert.equal(memberWords(member("Mid", { role: "Đường giữa · Đội trưởng" }), english).captain, "")
})
