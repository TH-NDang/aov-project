import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView, SeriesContent, TournamentContent } from "@aov/community-contracts"
import {
  initialRegistryValues,
  keptTournamentFields,
  parseTeamAliases,
  registryContent,
  registryFormIssue,
} from "../src/features/tournaments/model/registry-form-model"
import { tournamentDates } from "../src/features/tournaments/components/tournament-metadata"

test("partial tournament dates label their known boundary without implying a complete range", () => {
  const base = { code: "event", name: "Event", region: "TH" }
  assert.equal(tournamentDates(base), "")
  assert.equal(tournamentDates({ ...base, startsOn: "2026-08-09" }), "Từ 09/08/2026")
  assert.equal(tournamentDates({ ...base, endsOn: "2026-08-09" }), "Đến 09/08/2026")
  assert.equal(tournamentDates({ ...base, startsOn: "2026-08-09", endsOn: "2026-10-18" }), "09/08/2026 — 18/10/2026")
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

const event: TournamentContent = {
  code: "event",
  name: "Regional Event",
  region: "TH",
  logoUrl: "https://img.example/asset/version.png",
  tier: "A",
  competitionType: "LEAGUE",
  venueMode: "OFFLINE",
  status: "FINISHED",
  sourceUrl: "https://primary.example/event",
}

test("research metadata round-trips without inferring a status", () => {
  const entry: DocumentView<TournamentContent> = {
    id: "event",
    version: 1,
    createdAt: "",
    updatedAt: "",
    missingFields: [],
    content: event,
  }
  const values = initialRegistryValues(entry, "tournaments")

  assert.deepEqual(registryContent("tournaments", values, Object.keys(event)), event)
  assert.equal(registryFormIssue("tournaments", values), null)
  assert.equal(
    (
      registryContent("tournaments", { code: "unknown", name: "Unknown", region: "VN" }, [
        "code",
        "name",
        "region",
      ]) as TournamentContent
    ).status,
    undefined,
  )
})

test("the tournament form writes no result, and saving keeps the one an import stored with the final table", () => {
  const stored: TournamentContent = {
    ...event,
    result: {
      winnerName: "Winner",
      runnerUpName: "Runner",
      sourceUrl: "https://secondary.example/result",
      verification: "SECONDARY_CAPTURE",
    },
    placements: [{ place: "1", teamName: "Winner" }],
  }
  const values = {
    ...initialRegistryValues(undefined, "tournaments"),
    ...{ code: "event", name: "Renamed", region: "TH" },
  }
  const fields = registryContent("tournaments", values, ["code", "name", "region"]) as TournamentContent

  assert.equal(fields.result, undefined)
  assert.deepEqual(keptTournamentFields(fields, stored), {
    ...fields,
    result: stored.result,
    placements: stored.placements,
    localCurrency: undefined,
    awards: undefined,
    links: undefined,
    broadcast: undefined,
    staff: undefined,
  })
})
