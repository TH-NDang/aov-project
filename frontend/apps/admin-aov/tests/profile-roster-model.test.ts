import assert from "node:assert/strict"
import { test } from "node:test"
import type { CommunityProfile, ProfileMember } from "@aov/community-contracts"
import {
  choosePosition,
  chooseStanding,
  groupRoster,
  positionChoice,
  rosterGroup,
  rosterPosition,
  statusNote,
  writeStatusNote,
} from "../src/features/community/model/profile-roster-model"

const member = (extra: Partial<ProfileMember> = {}): ProfileMember => ({ name: "Member", role: "", ...extra })

test("a roster names its lanes like the match screens do", async () => {
  const { rosterLaneLabels } = await import("../src/features/community/model/profile-roster-model")
  const { LANE_LABELS } = await import("../src/lib/lanes")
  const { LANES } = await import("../src/features/tournaments/model/tournament-model")

  assert.equal(rosterLaneLabels.SUPPORT, LANE_LABELS.SUPPORT.name)
  assert.deepEqual(
    LANES.map((lane) => lane.name),
    ["Đường Caesar", "Đi rừng", "Đường giữa", "Đường Rồng", "Trợ thủ"],
  )
})

test("a member's lane comes from its code, not from the words of its role", () => {
  assert.equal(rosterPosition(member({ role: "Đi rừng", lane: "MID" })).lane, "MID")
  assert.equal(rosterPosition(member({ role: "Đi rừng" })).lane, undefined)
})

test("the captain's crown comes from the captain flag, not from the words of the role", () => {
  assert.equal(rosterPosition(member({ role: "Đường giữa", captain: true })).captain, true)
  assert.equal(rosterPosition(member({ role: "Đường giữa · Đội trưởng", lane: "MID" })).captain, false)
})

test("a staff member is an analyst only when its linked profile is one and no coach", () => {
  const profile = (roles: string[]) => ({ content: { personRoles: roles } }) as unknown as CommunityProfile
  const staff = member({ role: "Phân tích", standing: "STAFF" })

  assert.equal(rosterPosition(staff, profile(["TEAM_ANALYST"])).staff, "analyst")
  assert.equal(rosterPosition(staff, profile(["COACH", "TEAM_ANALYST"])).staff, "coach")
  assert.equal(rosterPosition(staff).staff, "coach")
  assert.equal(rosterPosition(member({ role: "Huấn luyện viên" })).staff, null)
})

test("members group by their standing code, and members without one stay apart", () => {
  assert.equal(rosterGroup(member({ standing: "ACTIVE", status: "Dự bị" })), "starting")
  assert.equal(rosterGroup(member({ standing: "SUBSTITUTE" })), "substitute")
  assert.equal(rosterGroup(member({ standing: "STAFF" })), "staff")
  assert.equal(rosterGroup(member({ standing: "LEFT" })), "former")
  assert.equal(rosterGroup(member({ status: "Đội hình chính" })), "other")
})

test("sorted cards preserve source indexes for edits and retain duplicate lanes and custom entries", () => {
  const members: ProfileMember[] = [
    { name: "Support", role: "Trợ thủ", lane: "SUPPORT", standing: "ACTIVE" },
    { name: "Former", role: "Đi rừng", lane: "JUNGLE", standing: "LEFT" },
    { name: "Top", role: "Đường Tà Thần", lane: "TOP", standing: "ACTIVE" },
    { name: "Other top", role: "Đường Caesar", lane: "TOP", standing: "ACTIVE" },
    { name: "Custom", role: "Chuyên môn khác", status: "Trạng thái riêng" },
  ]
  const before = structuredClone(members)
  const groups = groupRoster(members)

  assert.deepEqual(
    groups.starting.map((entry) => entry.index),
    [2, 3, 0],
  )
  assert.equal(groups.former[0]!.index, 1)
  assert.equal(groups.other[0]!.index, 4)
  assert.equal(groups.starting[0]!.member, members[2])
  assert.deepEqual(members, before)
})

test("picking a lane writes its code and Admin's words for it and keeps the role's notes", () => {
  const picked = choosePosition(member({ role: "Đi rừng · Đội trưởng", lane: "JUNGLE", standing: "ACTIVE" }), "MID")

  assert.deepEqual([picked.lane, picked.role, picked.standing], ["MID", "Đường giữa · Đội trưởng", "ACTIVE"])
  assert.equal(positionChoice(picked), "MID")
})

test("picking a staff role clears the lane and makes the member staff", () => {
  const picked = choosePosition(member({ role: "Đi rừng", lane: "JUNGLE", standing: "ACTIVE" }), "COACH")

  assert.deepEqual([picked.lane, picked.role, picked.standing], [null, "Huấn luyện viên", "STAFF"])
  assert.equal(positionChoice(picked), "COACH")
})

test("wording of an editor's own reads as a custom position", () => {
  assert.equal(positionChoice(member({ role: "Đi rừng / Đường giữa", lane: "JUNGLE" })), "CUSTOM")
  assert.equal(positionChoice(member()), "")
})

test("a standing leads the status with its words and keeps the notes after them", () => {
  const imported = member({ standing: "ACTIVE", status: "Chính thức · AOG Winter 2026" })
  const benched = chooseStanding(imported, "SUBSTITUTE")

  assert.equal(statusNote(imported), "AOG Winter 2026")
  assert.deepEqual([benched.standing, benched.status], ["SUBSTITUTE", "Dự bị · AOG Winter 2026"])
  assert.equal(writeStatusNote(benched, "Cho mượn").status, "Dự bị · Cho mượn")
  assert.equal(chooseStanding(member({ status: "Thử việc" }), "ACTIVE").status, "Chính thức · Thử việc")
})

test("making a player staff clears the lane they played", () => {
  assert.equal(chooseStanding(member({ role: "Đi rừng", lane: "JUNGLE" }), "STAFF").lane, null)
})
