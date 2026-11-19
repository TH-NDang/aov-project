import assert from "node:assert/strict"
import { test } from "node:test"
import type { BroadcastRole, CompetitionPerson, PlayerContent, StaffRole, TeamContent } from "@aov/community-contracts"
import { awardTeam, crewGroups, mvpOf, personEntry, teamStaff } from "../src/lib/crew-model.ts"

const BROADCAST: BroadcastRole[] = ["HOST", "CASTER", "INTERVIEWER", "GUEST_ANALYST"]
const STAFF: StaffRole[] = ["COACH", "TEAM_ANALYST"]

const published = (id: string, name: string, extra: Partial<CompetitionPerson> = {}): CompetitionPerson => ({
  id,
  code: name.toLowerCase(),
  name,
  avatarUrl: `https://cdn.test/${id}.png`,
  published: true,
  ...extra,
})
const draft = (id: string, name: string): CompetitionPerson => ({ id, name, published: false })

const people = {
  p1: published("p1", "Lam"),
  p2: published("p2", "Hoang"),
  p3: draft("p3", "Minh"),
  p4: published("p4", "Tu"),
}

test("a published person links to their page and keeps their picture", () => {
  assert.deepEqual(personEntry("p1", people), {
    pageId: "p1",
    name: "Lam",
    avatarUrl: "https://cdn.test/p1.png",
    href: "/pages/lam",
  })
})

test("an unpublished person is named as plain text without a picture", () => {
  assert.deepEqual(personEntry("p3", people), { pageId: "p3", name: "Minh", avatarUrl: null, href: null })
})

test("a person the snapshot does not name is left out", () => {
  assert.equal(personEntry("p9", people), null)
  assert.equal(personEntry("p1", undefined), null)
})

test("a crew is grouped by role in broadcast order whatever order the record lists it", () => {
  const groups = crewGroups(
    [
      { pageId: "p2", role: "CASTER" },
      { pageId: "p4", role: "GUEST_ANALYST" },
      { pageId: "p1", role: "HOST" },
      { pageId: "p3", role: "CASTER" },
    ],
    people,
    BROADCAST,
  )

  assert.deepEqual(
    groups.map((group) => [group.role, group.people.map((person) => person.name)]),
    [
      ["HOST", ["Lam"]],
      ["CASTER", ["Hoang", "Minh"]],
      ["GUEST_ANALYST", ["Tu"]],
    ],
  )
})

test("a person listed twice in one role of the crew shows once", () => {
  const groups = crewGroups(
    [
      { pageId: "p2", role: "CASTER" },
      { pageId: "p2", role: "CASTER" },
    ],
    people,
    BROADCAST,
  )

  assert.deepEqual(
    groups.map((group) => [group.role, group.people.length]),
    [["CASTER", 1]],
  )
})

test("a role whose people the snapshot does not name is left out of the crew", () => {
  const groups = crewGroups(
    [
      { pageId: "p9", role: "INTERVIEWER" },
      { pageId: "p1", role: "HOST" },
    ],
    people,
    BROADCAST,
  )

  assert.deepEqual(
    groups.map((group) => group.role),
    ["HOST"],
  )
})

test("a snapshot taken before people were linked has no crew", () => {
  assert.deepEqual(crewGroups([{ pageId: "p1", role: "HOST" }], undefined, BROADCAST), [])
  assert.deepEqual(crewGroups(undefined, people, BROADCAST), [])
})

test("a team's staff lists only that team, coaches first, with the title as written", () => {
  const staff = teamStaff(
    [
      { teamId: "t1", pageId: "p4", role: "TEAM_ANALYST" },
      { teamId: "t2", pageId: "p1", role: "COACH" },
      { teamId: "t1", pageId: "p2", role: "COACH", title: " Trợ lý huấn luyện viên " },
      { teamId: "t1", pageId: "p3", role: "COACH", title: "" },
    ],
    "t1",
    people,
    STAFF,
  )

  assert.deepEqual(
    staff.map((row) => [row.name, row.role, row.title, row.href]),
    [
      ["Hoang", "COACH", "Trợ lý huấn luyện viên", "/pages/hoang"],
      ["Minh", "COACH", null, null],
      ["Tu", "TEAM_ANALYST", null, "/pages/tu"],
    ],
  )
})

test("the same person in the same role of a team's staff shows once", () => {
  const staff = teamStaff(
    [
      { teamId: "t1", pageId: "p2", role: "COACH" },
      { teamId: "t1", pageId: "p2", role: "COACH", title: "Head coach" },
      { teamId: "t1", pageId: "p2", role: "TEAM_ANALYST" },
    ],
    "t1",
    people,
    STAFF,
  )

  assert.deepEqual(
    staff.map((row) => row.role),
    ["COACH", "TEAM_ANALYST"],
  )
})

const player = (nickname: string) => ({ code: nickname.toLowerCase(), nickname }) as PlayerContent

test("the MVP is named from the first snapshot that knows the player", () => {
  assert.deepEqual(mvpOf("m1", { other: player("Other") }, { m1: player("Lai Bâng") }), { id: "m1", name: "Lai Bâng" })
})

test("a record without an MVP, or with one no snapshot knows, names nobody", () => {
  assert.equal(mvpOf(null, { m1: player("Lai Bâng") }), null)
  assert.equal(mvpOf("m2", { m1: player("Lai Bâng") }, undefined), null)
})

const teams = { t1: { code: "fpl", name: "FPT Flash" } as TeamContent }

test("an award's team keeps the name the award writes and its link", () => {
  assert.deepEqual(awardTeam({ teamId: "t1", teamName: "FL" }, teams), { id: "t1", name: "FL" })
})

test("an award linked to a team without a written name reads the team's name", () => {
  assert.deepEqual(awardTeam({ teamId: "t1", teamName: null }, teams), { id: "t1", name: "FPT Flash" })
})

test("an award naming a team only in words stays plain text", () => {
  assert.deepEqual(awardTeam({ teamName: "Saigon Phantom" }, teams), { id: null, name: "Saigon Phantom" })
  assert.equal(awardTeam({}, teams), null)
})
