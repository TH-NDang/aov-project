import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView, SeriesContent, TournamentContent } from "@aov/community-contracts"
import {
  initialRegistryValues,
  parseTeamAliases,
  registryContent,
  registryFormIssue,
} from "../src/features/tournaments/registry-form-model"
import { tournamentDates } from "../src/features/tournaments/tournament-metadata"

test("partial tournament dates label their known boundary without implying a complete range", () => {
  const base = { code: "event", name: "Event", region: "TH" }
  assert.equal(tournamentDates(base), "")
  assert.equal(tournamentDates({ ...base, startsOn: "2026-08-09" }), "Từ 9/8/2026")
  assert.equal(tournamentDates({ ...base, endsOn: "2026-08-09" }), "Đến 9/8/2026")
  assert.equal(tournamentDates({ ...base, startsOn: "2026-08-09", endsOn: "2026-10-18" }), "9/8/2026 — 18/10/2026")
})

test("series results round-trip final scores without fabricating games or allowing unfinished scores", () => {
  const content: SeriesContent = {
    code: "final",
    tournamentId: "event",
    teamAId: "blue",
    teamBId: "red",
    bestOf: 7,
    result: { scoreA: 4, scoreB: 0, sourceUrl: "https://source.example/final", verification: "PRIMARY" },
  }
  const entry: DocumentView<SeriesContent> = {
    id: "final",
    version: 3,
    createdAt: "",
    updatedAt: "",
    missingFields: [],
    content,
  }
  const values = initialRegistryValues(entry, "series")
  assert.equal(values["result.scoreB"], "0")
  assert.deepEqual(registryContent("series", values, Object.keys(content)), content)
  assert.equal(registryFormIssue("series", values), null)
  assert.match(registryFormIssue("series", { ...values, "result.scoreA": "3" }) ?? "", /thắng 4 ván/)
  assert.match(registryFormIssue("series", { ...values, "result.scoreB": "4" }) ?? "", /thắng 4 ván/)
  assert.match(registryFormIssue("series", { ...values, "result.sourceUrl": "" }) ?? "", /link nguồn/)
  assert.equal(
    registryContent(
      "series",
      { ...values, "result.scoreA": "", "result.scoreB": "", "result.sourceUrl": "", "result.verifiedOn": "" },
      ["code", "bestOf"],
    ).hasOwnProperty("result"),
    false,
  )
})

test("team aliases trim and deduplicate without replacing the canonical name or first spelling", () => {
  assert.deepEqual(parseTeamAliases(" Flash Wolves, flash wolves; WANIN Flash Wolves\n "), [
    "Flash Wolves",
    "WANIN Flash Wolves",
  ])
  assert.deepEqual(
    registryContent(
      "teams",
      {
        code: "fw",
        name: "WANIN FlashWolves",
        shortName: "FW",
        aliases: "Flash Wolves, flash wolves",
        country: "TW/HK/MO",
      },
      ["code", "name", "shortName", "aliases", "country"],
    ),
    { code: "fw", name: "WANIN FlashWolves", shortName: "FW", aliases: ["Flash Wolves"], country: "TW/HK/MO" },
  )
  assert.match(
    registryFormIssue("teams", { aliases: Array.from({ length: 21 }, (_, index) => `name-${index}`).join(",") }) ?? "",
    /20 tên/,
  )
})

test("tournament result and research metadata round-trip without inferring a status or a result", () => {
  const content: TournamentContent = {
    code: "event",
    name: "Regional Event",
    region: "TH",
    logoUrl: "https://img.example/asset/version.png",
    tier: "A",
    competitionType: "LEAGUE",
    venueMode: "OFFLINE",
    status: "FINISHED",
    sourceUrl: "https://primary.example/event",
    result: {
      winnerName: "Winner",
      runnerUpName: "Runner",
      winnerScore: 4,
      runnerUpScore: 0,
      sourceUrl: "https://secondary.example/result",
      verification: "SECONDARY_CAPTURE",
      verifiedOn: "2026-10-27",
    },
  }
  const entry: DocumentView<TournamentContent> = {
    id: "event",
    version: 1,
    createdAt: "",
    updatedAt: "",
    missingFields: [],
    content,
  }
  const values = initialRegistryValues(entry, "tournaments")
  assert.equal(values["result.runnerUpScore"], "0")
  assert.equal(values["result.verification"], "SECONDARY_CAPTURE")
  const keys = Object.keys(content).filter((key) => key !== "result")
  assert.deepEqual(registryContent("tournaments", values, keys), content)
  assert.equal(registryFormIssue("tournaments", values), null)

  const unconfirmed = registryContent(
    "tournaments",
    {
      code: "unknown",
      name: "Unknown Result",
      region: "VN",
      startsOn: "2026-01-01",
      endsOn: "2026-01-30",
      "result.verification": "UNVERIFIED",
    },
    ["code", "name", "region", "startsOn", "endsOn"],
  ) as TournamentContent
  assert.equal(unconfirmed.status, undefined)
  assert.equal(unconfirmed.result, undefined)
})

test("optional results require sourced distinct teams and a complete valid score pair", () => {
  const values = {
    "result.winnerName": "Winner",
    "result.runnerUpName": "Runner",
    "result.sourceUrl": "https://source.example/final",
    "result.verification": "SECONDARY_PRESS_ONLY",
  }
  assert.equal(registryFormIssue("tournaments", values), null)
  assert.match(registryFormIssue("tournaments", { ...values, "result.sourceUrl": "" }) ?? "", /link nguồn/)
  assert.match(registryFormIssue("tournaments", { ...values, "result.runnerUpName": "Winner" }) ?? "", /khác nhau/)
  assert.match(registryFormIssue("tournaments", { ...values, "result.winnerScore": "4" }) ?? "", /hai vế/)
  assert.match(
    registryFormIssue("tournaments", { ...values, "result.winnerScore": "3", "result.runnerUpScore": "4" }) ?? "",
    /lớn hơn/,
  )
  assert.match(
    registryFormIssue("tournaments", { ...values, "result.winnerScore": "4.5", "result.runnerUpScore": "3" }) ?? "",
    /số nguyên/,
  )
  assert.match(
    registryFormIssue("tournaments", { ...values, "result.sourceUrl": "javascript:alert(1)" }) ?? "",
    /https/,
  )
})
