import assert from "node:assert/strict"
import { test } from "node:test"
import { initialRosterMembership, rosterFormIssue } from "../src/features/tournaments/roster-model"
import { registryContent, registryFormIssue, registrySearchText } from "../src/features/tournaments/registry-form-model"
import type { PlayerContent } from "@aov/community-contracts"

test("roster membership belongs to one event and team without inventing a lane or active status", () => {
  const first = initialRosterMembership("team", "event-one")
  const second = initialRosterMembership("team", "event-two")
  assert.equal(first.lane, null)
  assert.equal(first.status, "UNKNOWN")
  assert.equal(first.verification, "UNVERIFIED")
  first.lane = "TOP"
  assert.equal(second.lane, null)
  assert.equal(second.tournamentId, "event-two")
  assert.match(rosterFormIssue(first) ?? "", /hồ sơ tuyển thủ/)
  assert.equal(rosterFormIssue({ ...second, playerId: "known-player" }), null)
})

test("confirmed roster entries require sources and validate only known date boundaries", () => {
  const content = { ...initialRosterMembership("team", "event"), playerId: "player" }
  assert.match(rosterFormIssue({ ...content, verification: "PRIMARY" }) ?? "", /nguồn kiểm chứng/)
  assert.match(rosterFormIssue({ ...content, sourceUrl: "javascript:alert(1)" }) ?? "", /https/)
  assert.equal(
    rosterFormIssue({
      ...content,
      verification: "SECONDARY_CAPTURE",
      sourceUrl: "https://source.example/roster",
      startsOn: "2026-08-01",
    }),
    null,
  )
  assert.match(rosterFormIssue({ ...content, startsOn: "2026-10-01", endsOn: "2026-08-01" }) ?? "", /Ngày kết thúc/)
})

test("player profile aliases and optional photos stay separate from nationality and roster history", () => {
  const player = registryContent(
    "players",
    {
      code: "player",
      nickname: "Pro",
      fullName: "Đặng Văn A",
      aliases: "Pro Old, pro old",
      photoUrl: "https://img.example/asset/version.png",
    },
    ["code", "nickname", "fullName", "aliases", "photoUrl", "country"],
  ) as PlayerContent
  assert.deepEqual(player.aliases, ["Pro Old"])
  assert.equal(player.photoUrl, "https://img.example/asset/version.png")
  assert.equal(player.country, undefined)
  assert.equal("currentTeamId" in player, false)
  assert.equal(registrySearchText("Đặng Văn A"), "dang van a")
  assert.equal(registryFormIssue("players", { photoUrl: "data:image/png;base64,invalid" })?.includes("https"), true)
})
