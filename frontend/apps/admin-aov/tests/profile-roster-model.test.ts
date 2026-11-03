import assert from "node:assert/strict"
import { test } from "node:test"
import type { ProfileMember } from "@aov/community-contracts"
import { groupRoster, rosterGroup, rosterPosition } from "../src/features/community/profile-roster-model"

test("imported lane labels and captain annotations resolve without changing their stored text", () => {
  const cases = [
    ["Đường Tà Thần", "TOP"],
    ["Đường Caesar", "TOP"],
    ["Đi rừng", "JUNGLE"],
    ["Đường giữa · Đội trưởng", "MID"],
    ["Bottom Lane", "DRAGON"],
    ["Roamer", "SUPPORT"],
  ] as const
  for (const [role, lane] of cases) assert.equal(rosterPosition(role).lane, lane)
  assert.equal(rosterPosition("Đường giữa · Đội trưởng").captain, true)
  assert.equal(rosterPosition("Chuyên viên phân tích đội tuyển").staff, "analyst")
  assert.equal(rosterPosition("Huấn luyện viên trưởng").staff, "coach")
  assert.equal(rosterPosition("Vai trò chưa xác định").lane, undefined)
  assert.equal(rosterPosition("constructor").lane, undefined)
})

test("status grouping respects explicit former and reserve status instead of guessing a starting lineup", () => {
  const member = (role: string, status?: string): ProfileMember => ({ name: "Member", role, status })
  assert.equal(rosterGroup(member("Đi rừng", "Đội hình chính · AOG Winter 2026")), "starting")
  assert.equal(rosterGroup(member("Đi rừng", "Dự bị · Chưa ra sân theo nguồn")), "substitute")
  assert.equal(rosterGroup(member("Huấn luyện viên trưởng", "Đã rời đội trong mùa")), "former")
  assert.equal(rosterGroup(member("Chuyên viên phân tích đội tuyển", "Ban huấn luyện · AOG Winter 2026")), "staff")
  assert.equal(rosterGroup(member("Đi rừng")), "other")
  assert.equal(rosterGroup(member("Đi rừng", "Thử việc")), "other")
})

test("sorted cards preserve source indexes for edits and retain duplicate lanes and custom entries", () => {
  const members: ProfileMember[] = [
    { name: "Support", role: "Trợ thủ", status: "Chính thức" },
    { name: "Former", role: "Đi rừng", status: "Đã rời đội" },
    { name: "Top", role: "Đường Tà Thần", status: "Chính thức" },
    { name: "Other top", role: "Đường Caesar", status: "Chính thức" },
    { name: "Custom", role: "Chuyên môn khác", status: "Trạng thái riêng" },
  ]
  const before = structuredClone(members)
  const groups = groupRoster(members)
  assert.deepEqual(
    groups.starting.map((entry) => entry.index),
    [2, 3, 0],
  )
  assert.equal(groups.former[0].index, 1)
  assert.equal(groups.other[0].index, 4)
  assert.equal(Object.values(groups).flat().length, members.length)
  assert.equal(groups.starting[0].member, members[2])
  assert.deepEqual(members, before)
})
